(() => {
  "use strict";

  const DESKTOP_ICON = "◉";
  const MOBILE_ICON = "◉";

  function loadDateFormatPatch(doc = document) {
    try {
      if (doc.querySelector('script[data-medora-date-format]')) return;
      const script = doc.createElement("script");
      script.src = "date-format-patch.js?v=1.0.0";
      script.defer = true;
      script.dataset.medoraDateFormat = "true";
      doc.head.appendChild(script);
    } catch (error) {
      console.warn("Date format patch skipped", error);
    }
  }

  function loadLifeMindSafely() {
    if (!document.querySelector('link[data-life-mind-style]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "life-mind.css?v=2.0.0";
      link.dataset.lifeMindStyle = "true";
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-life-mind-script]')) {
      const script = document.createElement("script");
      script.src = "planner-brain.js?v=2.0.0";
      script.defer = true;
      script.dataset.lifeMindScript = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-life-mind-card-enhancement]')) {
      const script = document.createElement("script");
      script.src = "planner-card-enhancement.js?v=1.0.0";
      script.defer = true;
      script.dataset.lifeMindCardEnhancement = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-goal-plan-bridge]')) {
      const script = document.createElement("script");
      script.src = "goal-plan-bridge.js?v=1.0.0";
      script.defer = true;
      script.dataset.goalPlanBridge = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-medora-date-input-format]')) {
      const script = document.createElement("script");
      script.src = "date-input-format.js?v=1.1.0";
      script.defer = true;
      script.dataset.medoraDateInputFormat = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-planner-custom-range]')) {
      const script = document.createElement("script");
      script.src = "planner-custom-range.js?v=1.2.0";
      script.defer = true;
      script.dataset.plannerCustomRange = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-planner-sharing-enhancement]')) {
      const script = document.createElement("script");
      script.src = "planner-sharing-enhancement.js?v=1.0.0";
      script.defer = true;
      script.dataset.plannerSharingEnhancement = "true";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-planner-start-esc]')) {
      const script = document.createElement("script");
      script.src = "planner-start-and-esc.js?v=1.0.0";
      script.defer = true;
      script.dataset.plannerStartEsc = "true";
      document.head.appendChild(script);
    }
  }

  function addWallButtons() {
    const mainNav = document.querySelector(".main-nav");
    if (mainNav && !mainNav.querySelector("[data-wall-link]")) {
      const progress = mainNav.querySelector('[data-screen="progress"]');
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.wallLink = "true";
      button.innerHTML = `<span class="nav-icon">${DESKTOP_ICON}</span><span>Wall</span>`;
      mainNav.insertBefore(button, progress || null);
    }

    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav && !mobileNav.querySelector("[data-wall-link]")) {
      const profileMore = mobileNav.querySelector('[data-screen="profile"]');
      if (profileMore) {
        profileMore.removeAttribute("data-screen");
        profileMore.dataset.wallLink = "true";
        profileMore.innerHTML = `<span>${MOBILE_ICON}</span><small>Wall</small>`;
      }
    }
  }

  function reorderNavigation() {
    const mainNav = document.querySelector(".main-nav");
    if (mainNav) {
      const goals = mainNav.querySelector('[data-screen="goals"]');
      const planner = mainNav.querySelector('[data-screen="planner"]');
      if (goals && planner && goals.nextElementSibling !== planner) mainNav.insertBefore(goals, planner);
    }
    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav) {
      const goals = mobileNav.querySelector('[data-screen="goals"]');
      const planner = mobileNav.querySelector('[data-screen="planner"]');
      if (goals && planner && goals.nextElementSibling !== planner) mobileNav.insertBefore(goals, planner);
    }
  }

  function clearWallActive() {
    document.querySelectorAll("[data-wall-link]").forEach(b => b.classList.remove("active"));
  }

  function setWallActive() {
    document.querySelectorAll(".nav-item[data-screen], .mobile-nav-item[data-screen]")
      .forEach(b => b.classList.remove("active"));
    document.querySelectorAll("[data-wall-link]").forEach(b => b.classList.add("active"));
  }

  function styleEmbeddedWall(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const style = doc.createElement("style");
      style.textContent = `
        .wall-topbar,.wall-left{display:none!important}
        body{background:transparent!important}
        .wall-layout{width:100%!important;max-width:none!important;margin:0!important;grid-template-columns:minmax(0,1fr) 270px!important;gap:18px!important}
        .wall-right{position:static!important;top:auto!important}
        @media(max-width:1050px){.wall-layout{grid-template-columns:1fr!important}.wall-right{display:none!important}}
      `;
      doc.head.appendChild(style);
      loadDateFormatPatch(doc);
    } catch (e) {
      console.warn("Wall styling skipped", e);
    }
  }

  function openWall(event) {
    event?.preventDefault();
    setWallActive();
    const kicker = document.getElementById("topbarKicker");
    const title = document.getElementById("topbarTitle");
    const container = document.getElementById("screenContainer");
    if (kicker) kicker.textContent = "WALL";
    if (title) title.textContent = "Share progress. Grow together.";
    if (!container) return;
    container.innerHTML = `<section class="screen" aria-label="Medora Wall">
      <iframe id="medoraWallFrame" title="Medora Wall" src="wall.html?embedded=1"
        style="width:100%;height:calc(100vh - 128px);min-height:650px;border:0;border-radius:22px;background:transparent;display:block;"></iframe>
    </section>`;
    const frame = document.getElementById("medoraWallFrame");
    frame?.addEventListener("load", () => styleEmbeddedWall(frame), { once:true });
  }

  function bind() {
    addWallButtons();
    reorderNavigation();
    loadDateFormatPatch();
    loadLifeMindSafely();
    document.addEventListener("click", event => {
      const wall = event.target.closest("[data-wall-link]");
      if (wall) { openWall(event); return; }
      if (event.target.closest("[data-screen]") || event.target.closest("#avatarButton")) clearWallActive();
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once:true }); else bind();
})();