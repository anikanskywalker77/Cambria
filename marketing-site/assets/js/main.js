/* Peterson Medical Equipment — site behaviours.
   Progressive enhancement only: the site is fully usable with this file absent. */
(function () {
  "use strict";

  /* ---- mobile nav -------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    // close on link click (mobile)
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
    // close on escape / on resize up to desktop
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 940 && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  /* ---- current year in footer ------------------------------------------- */
  var y = document.querySelectorAll("[data-year]");
  for (var i = 0; i < y.length; i++) y[i].textContent = new Date().getFullYear();

  /* ---- mark active nav link --------------------------------------------- */
  // Pages may also hard-code aria-current; this is a safety net.
  try {
    var here = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") || "/";
    var links = document.querySelectorAll("#primary-nav a[href]");
    for (var j = 0; j < links.length; j++) {
      var href = links[j].getAttribute("href").replace(/index\.html$/, "").replace(/\/$/, "");
      if (href === "") href = "/";
      if (href === here) links[j].setAttribute("aria-current", "page");
    }
  } catch (e) { /* no-op */ }

  /* ---- reveal on scroll -------------------------------------------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-in"); });
    }
  }

  /* ---- smooth anchor offset for the sticky header ----------------------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 72;
    var top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 12;
    window.scrollTo({ top: top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.replaceState(null, "", "#" + id);
  });
})();
