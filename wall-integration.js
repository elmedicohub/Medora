(() => {
  "use strict";

  const DESKTOP_ICON = "◉";
  const MOBILE_ICON = "◉";
  const TRAVEL_ICON = "✈";
  const NAV_ORDER = [
    '[data-screen="day"]',
    '[data-wall-link]',
    '[data-screen="goals"]',
    '[data-screen="planner"]',
    '[data-travel-link]',
    '[data-study-link]',
    '[data-activity-link]',
    '[data-notes-link]',
    '[data-screen="progress"]',
    '[data-screen="interests"]',
    '[data-screen="people"]'
  ];

  let navReordering = false;
  let navTimer = null;

  function installNavBootStyle() {
    if (document.getElementById("medoraNavBootStyle")) return;
    const style = document.createElement("style");
    style.id = "medoraNavBootStyle";
    style.textContent = `
      .main-nav,.mobile-nav{visibility:hidden!important}
      html.medora-nav-ready .main-nav,
      html.medora-nav-ready .mobile-nav{visibility:visible!important}
      html.medora-travel-open #mbFloat,
      html.medora-travel-open .mb-float{display:none!important}
      @media(max-width:820px){.mobile-nav.medora-travel-enabled{grid-template-columns:repeat(7,1fr)!important}}
    `;
    document.head.appendChild(style);
  }

  installNavBootStyle();

  function setTravelMode(active) {
    document.documentElement.classList.toggle("medora-travel-open", !!active);
  }

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

    const scripts = [
      ["data-life-mind-script", "planner-brain.js?v=2.0.0"],
      ["data-life-mind-card-enhancement", "planner-card-enhancement.js?v=1.0.0"],
      ["data-goal-plan-bridge", "goal-plan-bridge.js?v=1.0.0"],
      ["data-medora-date-input-format", "date-input-format.js?v=1.1.0"],
      ["data-planner-custom-range", "planner-custom-range.js?v=1.2.0"],
      ["data-planner-sharing-enhancement", "planner-sharing-enhancement.js?v=1.0.0"],
      ["data-planner-start-esc", "planner-start-and-esc.js?v=1.0.0"],
      ["data-planner-checkin-indications", "planner-checkin-indications.js?v=1.0.0"],
      ["data-plan-goal-progress", "plan-goal-progress-enhancement.js?v=1.0.0"],
      ["data-activity-tracker", "activity-tracker.js?v=1.0.0"],
      ["data-study-hub", "study-hub.js?v=1.0.0"],
      ["data-study-hub-pro", "study-hub-pro.js?v=1.0.0"],
      ["data-study-hub-insights-plus", "study-hub-insights-plus.js?v=1.0.0"],
      ["data-note-hub", "note-hub.js?v=1.0.0"]
    ];

    scripts.forEach(([attr, src]) => {
      if (document.querySelector(`script[${attr}]`)) return;
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute(attr, "true");
      document.head.appendChild(script);
    });
  }

  function addWallButtons() {
    const mainNav = document.querySelector(".main-nav");
    if (mainNav && !mainNav.querySelector("[data-wall-link]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.wallLink = "true";
      button.innerHTML = `<span class="nav-icon">${DESKTOP_ICON}</span><span>Wall</span>`;
      mainNav.appendChild(button);
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

  function addTravelButtons() {
    const mainNav = document.querySelector(".main-nav");
    if (mainNav && !mainNav.querySelector("[data-travel-link]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.travelLink = "true";
      button.innerHTML = `<span class="nav-icon">${TRAVEL_ICON}</span><span>Travel</span>`;
      mainNav.appendChild(button);
    }

    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav && !mobileNav.querySelector("[data-travel-link]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-nav-item";
      button.dataset.travelLink = "true";
      button.innerHTML = `<span>${TRAVEL_ICON}</span><small>Travel</small>`;
      mobileNav.appendChild(button);
      mobileNav.classList.add("medora-travel-enabled");
    }
  }

  function applyNavOrder(container) {
    if (!container || navReordering) return;
    const wanted = NAV_ORDER.map(selector => container.querySelector(selector)).filter(Boolean);
    if (!wanted.length) return;

    const wantedSet = new Set(wanted);
    const current = [...container.children].filter(node => wantedSet.has(node));
    const isCorrect = current.length === wanted.length && current.every((node, index) => node === wanted[index]);
    if (isCorrect) return;

    navReordering = true;
    wanted.forEach(node => container.appendChild(node));
    navReordering = false;
  }

  function mainNavComplete() {
    const mainNav = document.querySelector(".main-nav");
    return !!mainNav && NAV_ORDER.every(selector => !!mainNav.querySelector(selector));
  }

  function revealNavigation(force = false) {
    if (force || mainNavComplete()) document.documentElement.classList.add("medora-nav-ready");
  }

  function reorderNavigation() {
    applyNavOrder(document.querySelector(".main-nav"));
    applyNavOrder(document.querySelector(".mobile-nav"));
    revealNavigation(false);
  }

  function scheduleNavOrder(delay = 20) {
    clearTimeout(navTimer);
    navTimer = setTimeout(reorderNavigation, delay);
  }

  function watchNavigation() {
    const observer = new MutationObserver(() => {
      if (!navReordering) scheduleNavOrder();
    });
    const mainNav = document.querySelector(".main-nav");
    const mobileNav = document.querySelector(".mobile-nav");
    if (mainNav) observer.observe(mainNav, { childList: true });
    if (mobileNav) observer.observe(mobileNav, { childList: true });

    [0, 50, 100, 180, 300, 500, 800, 1200].forEach(ms => setTimeout(reorderNavigation, ms));
    setTimeout(() => { reorderNavigation(); revealNavigation(true); }, 1800);
  }

  function clearWallActive() {
    document.querySelectorAll("[data-wall-link]").forEach(b => b.classList.remove("active"));
  }

  function clearTravelActive() {
    document.querySelectorAll("[data-travel-link]").forEach(b => b.classList.remove("active"));
  }

  function setWallActive() {
    document.querySelectorAll(".nav-item[data-screen], .mobile-nav-item[data-screen], [data-study-link], [data-activity-link], [data-notes-link], [data-travel-link]")
      .forEach(b => b.classList.remove("active"));
    document.querySelectorAll("[data-wall-link]").forEach(b => b.classList.add("active"));
  }

  function setTravelActive() {
    document.querySelectorAll(".nav-item[data-screen], .mobile-nav-item[data-screen], [data-study-link], [data-activity-link], [data-notes-link], [data-wall-link]")
      .forEach(b => b.classList.remove("active"));
    document.querySelectorAll("[data-travel-link]").forEach(b => b.classList.add("active"));
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
    } catch (e) { console.warn("Wall styling skipped", e); }
  }

  function styleEmbeddedTravel(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const style = doc.createElement("style");
      style.textContent = `
        .travel-topbar{display:none!important}
        .travel-app{width:100%!important;max-width:none!important;padding:0 0 36px!important}
        body{background:transparent!important}
      `;
      doc.head.appendChild(style);
    } catch (e) { console.warn("Travel styling skipped", e); }
  }

  function openWall(event) {
    event?.preventDefault();
    setTravelMode(false);
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

  function openTravel(event) {
    event?.preventDefault();
    setTravelMode(true);
    setTravelActive();
    const kicker = document.getElementById("topbarKicker");
    const title = document.getElementById("topbarTitle");
    const container = document.getElementById("screenContainer");
    if (kicker) kicker.textContent = "TRAVEL";
    if (title) title.textContent = "Your trip, from idea to arrival.";
    if (!container) return;
    container.innerHTML = `<section class="screen" aria-label="Medora Travel Planner">
      <iframe id="medoraTravelFrame" title="Medora Travel Planner" src="travel.html?embedded=1&v=2.0.0"
        style="width:100%;height:calc(100vh - 128px);min-height:720px;border:0;border-radius:22px;background:transparent;display:block;"></iframe>
    </section>`;
    const frame = document.getElementById("medoraTravelFrame");
    frame?.addEventListener("load", () => styleEmbeddedTravel(frame), { once:true });
  }

  function bind() {
    addWallButtons();
    addTravelButtons();
    reorderNavigation();
    watchNavigation();
    loadDateFormatPatch();
    loadLifeMindSafely();

    document.addEventListener("click", event => {
      const wall = event.target.closest("[data-wall-link]");
      if (wall) { clearTravelActive(); openWall(event); return; }
      const travel = event.target.closest("[data-travel-link]");
      if (travel) { clearWallActive(); openTravel(event); return; }
      if (event.target.closest("[data-screen]") || event.target.closest("[data-study-link]") || event.target.closest("[data-activity-link]") || event.target.closest("[data-notes-link]") || event.target.closest("#avatarButton")) {
        setTravelMode(false);
        clearWallActive();
        clearTravelActive();
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once:true });
  else bind();
})();