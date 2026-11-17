/* Presentation only. Reads existing DOM geometry; never owns study state. */
function uiGlassEffects() {
  "use strict";
  const doc = document;
  const html = doc.documentElement;
  const reduce = () => doc.body.classList.contains("rm") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const surfaces = ".top,#focusCard,.sess,#tabbar,#island,.sheet>div,.ui-glass-dialog,.lg-seg";
  let lightFrame = 0;
  let lightTarget = null;
  let lightX = 0;
  let lightY = 0;
  function light(event) {
    if (reduce()) return;
    const target = event.target.closest?.(surfaces);
    if (!target) return;
    lightTarget = target;
    lightX = event.clientX;
    lightY = event.clientY;
    if (lightFrame) return;
    lightFrame = requestAnimationFrame(() => {
      lightFrame = 0;
      const bounds = lightTarget.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      lightTarget.style.setProperty("--ui-light-x", `${Math.max(0, Math.min(100, (lightX - bounds.left) / bounds.width * 100))}%`);
      lightTarget.style.setProperty("--ui-light-y", `${Math.max(0, Math.min(100, (lightY - bounds.top) / bounds.height * 100))}%`);
    });
  }
  doc.addEventListener("pointermove", light, {passive: true});
  doc.addEventListener("pointerdown", light, {passive: true});

  // The existing neutral-centre map is shared; no additional image or network request.
  const map = doc.querySelector("#lgLens feImage")?.getAttribute("href");
  if (map && CSS.supports("backdrop-filter", "url(#ui-glass-lens)")) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    // Subtle channel separation, confined by the neutral map to the outer rim.
    svg.innerHTML = `<defs><filter id="ui-glass-lens" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage href="${map}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="edge"/>
      <feDisplacementMap in="SourceGraphic" in2="edge" scale=".012" xChannelSelector="R" yChannelSelector="G" result="red"/>
      <feColorMatrix in="red" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="edge" scale=".015" xChannelSelector="R" yChannelSelector="G" result="green"/>
      <feColorMatrix in="green" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
      <feDisplacementMap in="SourceGraphic" in2="edge" scale=".018" xChannelSelector="R" yChannelSelector="G" result="blue"/>
      <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>
      <feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>
    </filter></defs>`;
    doc.body.appendChild(svg);
    html.classList.add("ui-glass-lens-ready");
  }

  // No permission request: iOS devices requiring consent retain pointer reflections.
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") {
    addEventListener("deviceorientation", event => {
      if (reduce() || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
      html.style.setProperty("--ui-tilt-x", `${Math.max(35, Math.min(65, 50 + event.gamma / 6))}%`);
      html.style.setProperty("--ui-tilt-y", `${Math.max(0, Math.min(20, event.beta / 8))}%`);
    }, {passive: true});
  }

  // Original app writes the final SVG values. Animate only their rendered projection.
  for (const id of ["ringPh", "ringNet"]) {
    const ring = doc.getElementById(id);
    if (!ring) continue;
    let last = Number.parseFloat(ring.style.strokeDashoffset);
    let frame = 0;
    let animation = null;
    new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = Number.parseFloat(ring.style.strokeDashoffset);
        if (!Number.isFinite(next) || next === last) return;
        animation?.cancel();
        if (!reduce() && Number.isFinite(last) && doc.visibilityState === "visible") {
          animation = ring.animate([{strokeDashoffset: last}, {strokeDashoffset: next}], {duration: 280, easing: "linear"});
        }
        last = next;
      });
    }).observe(ring, {attributes: true, attributeFilter: ["style"]});
  }

  const steps = doc.getElementById("steps");
  if (steps) {
    const decorateChecks = () => {
      for (const check of steps.querySelectorAll(".ckb.s2")) {
        if (check.querySelector(".ui-glass-check")) continue;
        const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "ui-glass-check");
        svg.innerHTML = '<path d="m5 12 4.5 4.5L19 7"/>';
        check.appendChild(svg);
      }
    };
    new MutationObserver(decorateChecks).observe(steps, {subtree: true, childList: true});
    decorateChecks();
  }

  // Presentation observers do no work while an entire screen is hidden.
  if ("IntersectionObserver" in window) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle("ui-glass-offscreen", !entry.isIntersecting);
    }, {rootMargin: "80px"});
    doc.querySelectorAll("#focusCard,.top").forEach(element => visibility.observe(element));
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", uiGlassEffects, {once: true});
else uiGlassEffects();
