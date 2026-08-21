(() => {
  "use strict";

  const DURATION_OPTIONS = [
    [7, "1 week"],
    [14, "2 weeks"],
    [21, "3 weeks"],
    [28, "4 weeks"],
    [30, "1 month"],
    [42, "6 weeks"],
    [56, "8 weeks"],
    [60, "2 months"],
    [84, "12 weeks"],
    [90, "3 months"],
    [180, "6 months"],
    [365, "1 year"]
  ];

  const QUICK_LENGTHS = [
    ["7", "1W", "1 week"],
    ["30", "1M", "1 month"],
    ["90", "3M", "3 months"],
    ["180", "6M", "6 months"],
    ["365", "1Y", "1 year"],
    ["custom", "Custom", "Choose my own duration"]
  ];

  const STORAGE = {
    screen: "medora.lastScreen",
    lifeMindTab: "medora.lifeMindTab",
    preferredDuration: "medora.preferredPlanDuration"
  };

  let restoredMainScreen = false;
  let restoringLifeMindTab = false;

  function safeGet(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch {}
  }

  function ensureStyle() {
    if (document.getElementById("lmDurationPatchStyle")) return;
    const style = document.createElement("style");
    style.id = "lmDurationPatchStyle";
    style.textContent = `
      .lm-custom-weeks {
        margin-top: 10px;
        padding: 10px 12px;
        border: 1px solid #e4e8f1;
        border-radius: 12px;
        background: #f8faff;
      }
      .lm-custom-weeks span {
        display: block;
        margin-bottom: 6px;
        color: #69748b;
        font-size: 11px;
        font-weight: 750;
      }
      .lm-duration-hint {
        display:block;
        margin-top:6px;
        color:#8a93a4;
        font-size:10px;
        line-height:1.45;
      }
      .lm-quick-lengths {
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
        margin: 8px 0 18px;
        padding: 12px 14px;
        border: 1px solid #e4e8f1;
        border-radius: 16px;
        background: rgba(255,255,255,.72);
      }
      .lm-quick-lengths > span {
        margin-right: 4px;
        color:#6c7790;
        font-size:11px;
        font-weight:800;
        letter-spacing:.03em;
        text-transform:uppercase;
      }
      .lm-length-chip {
        min-width:52px;
        min-height:38px;
        padding:0 13px;
        border:1px solid #dfe5f0;
        border-radius:999px;
        background:#fff;
        color:#4e5b76;
        font-size:12px;
        font-weight:800;
        cursor:pointer;
        transition:.16s ease;
      }
      .lm-length-chip:hover,
      .lm-length-chip.active {
        border-color:#bdc8ff;
        color:#5369db;
        background:linear-gradient(110deg,rgba(25,197,180,.08),rgba(100,134,255,.11),rgba(138,92,246,.08));
      }
      @media (max-width:620px) {
        .lm-quick-lengths { gap:6px; padding:10px; }
        .lm-quick-lengths > span { width:100%; margin-bottom:2px; }
        .lm-length-chip { min-width:48px; flex:1 1 auto; padding:0 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function renamePlannerLabels() {
    document.querySelectorAll('[data-lm-tab="plans"]').forEach((button) => {
      if (button.textContent.trim() === "90-day plans") button.textContent = "Plans";
    });

    document.querySelectorAll(".lm-template-head h2").forEach((heading) => {
      if (heading.textContent.trim() === "Your longer plans") heading.textContent = "Your plans";
    });

    document.querySelectorAll(".lm-template-head p").forEach((text) => {
      if (text.textContent.includes("Plans create routines")) {
        text.textContent = "Choose a proven duration or build a custom plan.";
      }
    });
  }

  function addQuickLengths() {
    const root = document.querySelector(".life-mind-root");
    if (!root) return;

    const plansTab = root.querySelector('[data-lm-tab="plans"].active');
    if (!plansTab) return;

    const heading = [...root.querySelectorAll(".lm-template-head")].find((node) =>
      node.querySelector("h2")?.textContent.trim() === "Your plans"
    );
    if (!heading || root.querySelector(".lm-quick-lengths")) return;

    const selected = safeGet(STORAGE.preferredDuration, "90");
    const bar = document.createElement("div");
    bar.className = "lm-quick-lengths";
    bar.setAttribute("aria-label", "Quick plan duration");
    bar.innerHTML = `
      <span>Start by length</span>
      ${QUICK_LENGTHS.map(([value, shortLabel, fullLabel]) => `
        <button type="button" class="lm-length-chip ${selected === value ? "active" : ""}"
          data-lm-quick-length="${value}" title="${fullLabel}">${shortLabel}</button>
      `).join("")}
    `;

    heading.insertAdjacentElement("afterend", bar);

    bar.querySelectorAll("[data-lm-quick-length]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.lmQuickLength;
        safeSet(STORAGE.preferredDuration, value);
        safeSet(STORAGE.lifeMindTab, "templates");
        const start = root.querySelector("[data-lm-start]");
        start?.click();
      });
    });
  }

  function enhanceDurationSelect() {
    const select = document.getElementById("lmDuration");
    if (!select || select.dataset.flexDuration === "true") return;

    const preferred = safeGet(STORAGE.preferredDuration, "");
    const oldValue = Number(select.value || 90);
    select.dataset.flexDuration = "true";
    select.innerHTML = DURATION_OPTIONS.map(([value, label]) =>
      `<option value="${value}">${label}</option>`
    ).join("") + '<option value="custom">Custom weeks…</option>';

    const preferredNumber = Number(preferred);
    if (preferred === "custom") {
      select.value = "custom";
    } else if (DURATION_OPTIONS.some(([value]) => value === preferredNumber)) {
      select.value = String(preferredNumber);
    } else if (DURATION_OPTIONS.some(([value]) => value === oldValue)) {
      select.value = String(oldValue);
    } else {
      select.value = "90";
    }

    const label = select.closest("label");
    if (!label) return;

    const hint = document.createElement("small");
    hint.className = "lm-duration-hint";
    hint.textContent = "1W, 1M, 3M, 6M, 1Y — or choose your own number of weeks.";
    label.appendChild(hint);

    const wrap = document.createElement("div");
    wrap.className = "lm-custom-weeks";
    wrap.hidden = true;
    wrap.innerHTML = `
      <span>Custom duration in weeks</span>
      <input id="lmCustomWeeks" type="number" min="1" max="104" step="1" value="5" inputmode="numeric" aria-label="Custom plan duration in weeks">
      <small class="lm-duration-hint">Example: 5 weeks, 10 weeks, 20 weeks.</small>
    `;
    label.appendChild(wrap);

    const toggleCustom = () => {
      wrap.hidden = select.value !== "custom";
      if (!wrap.hidden) setTimeout(() => document.getElementById("lmCustomWeeks")?.focus(), 0);
    };
    select.addEventListener("change", () => {
      safeSet(STORAGE.preferredDuration, select.value);
      toggleCustom();
    });
    toggleCustom();

    const form = select.closest("form");
    if (form && form.dataset.flexDurationSubmit !== "true") {
      form.dataset.flexDurationSubmit = "true";
      form.addEventListener("submit", (event) => {
        if (select.value !== "custom") return;
        const input = document.getElementById("lmCustomWeeks");
        const raw = Number(input?.value || 0);
        if (!Number.isFinite(raw) || raw < 1) {
          event.preventDefault();
          input?.focus();
          return;
        }
        const weeks = Math.max(1, Math.min(104, Math.round(raw)));
        const days = weeks * 7;
        let option = [...select.options].find((item) => item.value === String(days));
        if (!option) {
          option = document.createElement("option");
          option.value = String(days);
          option.textContent = `${weeks} weeks`;
          select.appendChild(option);
        }
        select.value = String(days);
        safeSet(STORAGE.preferredDuration, String(days));
      }, true);
    }
  }

  function rememberNavigation(event) {
    const wall = event.target.closest("[data-wall-link]");
    if (wall) {
      safeSet(STORAGE.screen, "wall");
      return;
    }

    const screenButton = event.target.closest("[data-screen]");
    if (screenButton?.dataset.screen) {
      safeSet(STORAGE.screen, screenButton.dataset.screen);
      if (screenButton.dataset.screen !== "planner") safeSet(STORAGE.lifeMindTab, "today");
    }

    const tab = event.target.closest("[data-lm-tab]");
    if (tab?.dataset.lmTab) {
      safeSet(STORAGE.screen, "planner");
      safeSet(STORAGE.lifeMindTab, tab.dataset.lmTab);
    }

    if (event.target.closest("[data-lm-start]")) {
      safeSet(STORAGE.screen, "planner");
      safeSet(STORAGE.lifeMindTab, "templates");
    }
  }

  function restoreMainScreen() {
    if (restoredMainScreen) return;
    const target = safeGet(STORAGE.screen, "day");
    if (!target || target === "day") {
      restoredMainScreen = true;
      return;
    }

    const appView = document.getElementById("appView");
    if (!appView || appView.classList.contains("hidden")) return;

    let button = null;
    if (target === "wall") button = document.querySelector("[data-wall-link]");
    else button = document.querySelector(`.nav-item[data-screen="${CSS.escape(target)}"]`);

    if (!button) return;
    restoredMainScreen = true;
    setTimeout(() => button.click(), 0);
  }

  function restoreLifeMindTab() {
    if (restoringLifeMindTab) return;
    const root = document.querySelector(".life-mind-root");
    if (!root) return;

    const desired = safeGet(STORAGE.lifeMindTab, "today");
    const desiredButton = root.querySelector(`[data-lm-tab="${CSS.escape(desired)}"]`);
    if (!desiredButton || desiredButton.classList.contains("active")) return;

    restoringLifeMindTab = true;
    setTimeout(() => {
      desiredButton.click();
      restoringLifeMindTab = false;
    }, 0);
  }

  function enhance() {
    ensureStyle();
    renamePlannerLabels();
    addQuickLengths();
    enhanceDurationSelect();
    restoreMainScreen();
    restoreLifeMindTab();
  }

  document.addEventListener("click", rememberNavigation, true);

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  enhance();
})();
