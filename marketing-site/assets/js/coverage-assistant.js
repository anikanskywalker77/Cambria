/* Peterson Medical Equipment — "Coverage & SWO Requirements" assistant widget.
 *
 * Calls our own Cloudflare Pages Function at /api/coverage-assistant, which talks
 * to the Anthropic API server-side. The widget itself never sees an API key.
 *
 * Hard rules (also enforced server-side):
 *   - No patient data. The widget refuses obviously-PHI input before it ever leaves
 *     the browser, and the server refuses it again.
 *   - Answers are reference information, not a coverage guarantee. The disclaimer
 *     is always shown.
 *
 * Degrades cleanly: if the Function is unreachable, the widget tells the user to
 * call or email instead. With JS disabled, the whole widget is replaced by a
 * <noscript> block in the HTML pointing to the same fallback.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/coverage-assistant";
  var MAX_LEN = 600;
  var PHONE = "509-783-7501";
  var ORDERS_EMAIL = "rx@petersonmedicalequipment.com";

  // Loose patterns that suggest someone pasted patient details. False positives
  // are fine here — we just nudge them to rephrase.
  var PHI_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/,                                              // SSN-like
    /\b[1-9][A-Za-z][0-9A-Za-z]\d[A-Za-z][0-9A-Za-z]\d[A-Za-z]{2}\d{2}\b/, // MBI-like
    /\bMBI\b/i,
    /\bD\.?O\.?B\.?\b/i,
    /date of birth/i,
    /patient\s*(name|dob|address|phone)\s*[:#]/i,
    /\bmedicare\s*(id|number)\s*[:#]/i
  ];

  function looksLikePHI(text) {
    for (var i = 0; i < PHI_PATTERNS.length; i++) if (PHI_PATTERNS[i].test(text)) return true;
    return false;
  }

  /* --- tiny safe renderer: plain text -> paragraphs + simple bullet lists --- */
  function renderAnswer(container, text) {
    container.textContent = "";
    var blocks = String(text || "").trim().split(/\n{2,}/);
    blocks.forEach(function (block) {
      var lines = block.split(/\n/);
      var bulletLines = lines.filter(function (l) { return /^\s*[-•*]\s+/.test(l); });
      if (bulletLines.length === lines.length && lines.length > 0) {
        var ul = document.createElement("ul");
        lines.forEach(function (l) {
          var li = document.createElement("li");
          li.textContent = l.replace(/^\s*[-•*]\s+/, "");
          ul.appendChild(li);
        });
        container.appendChild(ul);
      } else {
        var p = document.createElement("p");
        // join wrapped lines within a paragraph with spaces
        p.textContent = lines.join(" ").replace(/\s+/g, " ").trim();
        if (p.textContent) container.appendChild(p);
      }
    });
    if (!container.childNodes.length) {
      var fp = document.createElement("p");
      fp.textContent = text || "";
      container.appendChild(fp);
    }
  }

  function renderCitations(listEl, citations) {
    listEl.textContent = "";
    (citations || []).forEach(function (c) {
      var li = document.createElement("li");
      if (c.code) {
        var code = document.createElement("code");
        code.textContent = c.code;
        li.appendChild(code);
        li.appendChild(document.createTextNode(" "));
      }
      var span = document.createElement("span");
      span.textContent = c.label || "";
      li.appendChild(span);
      if (c.url) {
        li.appendChild(document.createTextNode(" — "));
        var a = document.createElement("a");
        a.href = c.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "source";
        li.appendChild(a);
      }
      listEl.appendChild(li);
    });
  }

  function fallbackMessage() {
    return "This assistant isn't available right now. For coverage and order questions, " +
      "call us at " + PHONE + " or email " + ORDERS_EMAIL + " — we'll answer directly. " +
      "You can also check the product pages, which list the governing LCDs and prior-authorization rules.";
  }

  function initWidget(root) {
    var form     = root.querySelector("[data-assistant-form]");
    var input    = root.querySelector("[data-assistant-input]");
    var submit   = root.querySelector("[data-assistant-submit]");
    var chipsBox = root.querySelector("[data-assistant-chips]");
    var output   = root.querySelector("[data-assistant-output]");
    var answerEl = root.querySelector("[data-assistant-answer]");
    var citeWrap = root.querySelector("[data-assistant-citations]");
    var citeList = root.querySelector("[data-assistant-citelist]");
    var loading  = root.querySelector("[data-assistant-loading]");
    var errorEl  = root.querySelector("[data-assistant-error]");
    var discl    = root.querySelector("[data-assistant-disclaimer]");

    if (!form || !input || !output) return;

    // chips
    if (chipsBox && window.PME_ASSISTANT_PROMPTS) {
      window.PME_ASSISTANT_PROMPTS.forEach(function (q) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = q;
        b.addEventListener("click", function () {
          input.value = q; input.focus();
          // auto-submit for a snappy feel
          form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
        });
        chipsBox.appendChild(b);
      });
    }

    function setBusy(busy) {
      if (submit) { submit.disabled = busy; submit.setAttribute("aria-disabled", busy ? "true" : "false"); }
      if (loading) loading.classList.toggle("is-visible", busy);
    }
    function showError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.classList.add("is-visible"); }
      output.classList.add("is-visible");
    }
    function clearError() { if (errorEl) { errorEl.textContent = ""; errorEl.classList.remove("is-visible"); } }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (input.value || "").trim();
      clearError();
      if (citeWrap) citeWrap.hidden = true;
      if (answerEl) answerEl.textContent = "";

      if (!q) { input.focus(); return; }
      if (q.length > MAX_LEN) { showError("That's a long one — please shorten the question to under " + MAX_LEN + " characters."); return; }
      if (looksLikePHI(q)) {
        showError("Please don't include any patient details (names, dates of birth, MBIs, addresses). " +
                  "Ask in general terms — for example, by HCPCS code or product name. For patient-specific " +
                  "questions, call us at " + PHONE + ".");
        return;
      }

      output.classList.add("is-visible");
      setBusy(true);

      var controller = ("AbortController" in window) ? new AbortController() : null;
      var timeout = setTimeout(function () { if (controller) controller.abort(); }, 25000);

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (r) {
          if (!r.ok || !r.data) {
            if (r.data && r.data.error) { showError(r.data.error); return; }
            showError(fallbackMessage());
            return;
          }
          if (r.data.refused) { showError(r.data.message || "I can't help with that one — try rephrasing without patient details."); return; }
          if (answerEl) renderAnswer(answerEl, r.data.answer || "");
          if (citeList && r.data.citations && r.data.citations.length) {
            renderCitations(citeList, r.data.citations);
            if (citeWrap) citeWrap.hidden = false;
          }
          if (discl && r.data.disclaimer) discl.textContent = r.data.disclaimer;
        })
        .catch(function () { showError(fallbackMessage()); })
        .finally(function () { clearTimeout(timeout); setBusy(false); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var widgets = document.querySelectorAll("[data-assistant]");
    for (var i = 0; i < widgets.length; i++) initWidget(widgets[i]);
  });
})();
