/* Peterson Medical Equipment — contact form handler.
 * Posts to the Cloudflare Pages Function at /api/contact. Degrades to a normal
 * page (the form is still readable; with JS off there's no submit, but the page
 * lists phone/fax/email prominently). The form never collects patient data — a
 * client-side check nudges the user if they paste something that looks like PHI,
 * and the server enforces it too.
 */
(function () {
  "use strict";
  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = document.getElementById("contact-status");
  var submit = document.getElementById("cf-submit");
  var endpoint = "/api/contact";

  var PHI = [
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b[1-9][A-Za-z][0-9A-Za-z]\d[A-Za-z][0-9A-Za-z]\d[A-Za-z]{2}\d{2}\b/,
    /\bMBI\b/i, /\bD\.?O\.?B\.?\b/i, /date of birth/i,
    /patient\s*(name|dob|address|phone|mbi)\s*[:#=]/i,
    /\bmedicare\s*(id|number|beneficiary)\s*[:#=]/i, /\bSSN\b/i
  ];

  function show(kind, msg) {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove("is-ok", "is-err");
    status.classList.add(kind === "ok" ? "is-ok" : "is-err");
  }
  function clear() { if (status) { status.textContent = ""; status.classList.remove("is-ok", "is-err"); } }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clear();

    var data = {
      name: (form.name && form.name.value || "").trim(),
      email: (form.email && form.email.value || "").trim(),
      phone: (form.phone && form.phone.value || "").trim(),
      org: (form.org && form.org.value || "").trim(),
      message: (form.message && form.message.value || "").trim(),
      company_website: (form.company_website && form.company_website.value || "") // honeypot
    };

    if (!data.name) { show("err", "Please add your name."); form.name && form.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { show("err", "Please add a valid email address."); form.email && form.email.focus(); return; }
    if (!data.message) { show("err", "Please add a short message."); form.message && form.message.focus(); return; }
    for (var i = 0; i < PHI.length; i++) {
      if (PHI[i].test(data.message)) {
        show("err", "For your patients' privacy, please don't include patient details here. For patient-specific questions, call 509-783-7501 or fax documentation to 509-980-7062.");
        form.message && form.message.focus();
        return;
      }
    }

    if (submit) { submit.disabled = true; submit.textContent = "Sending…"; }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (r) {
        if (r.ok && r.body && r.body.ok) {
          form.reset();
          show("ok", "Thanks — your message is on its way. We'll reply by email. For anything urgent, call 509-783-7501.");
        } else {
          var msg = (r.body && r.body.error) ? r.body.error
            : "We couldn't send that just now. Please email rx@petersonmedicalequipment.com or call 509-783-7501.";
          show("err", msg);
        }
      })
      .catch(function () {
        show("err", "We couldn't reach the server. Please email rx@petersonmedicalequipment.com or call 509-783-7501.");
      })
      .finally(function () {
        if (submit) { submit.disabled = false; submit.textContent = "Send inquiry"; }
      });
  });
})();
