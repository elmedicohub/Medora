(() => {
  "use strict";

  const OPTIONS = [
    [7, "1 week"],
    [14, "2 weeks"],
    [21, "3 weeks"],
    [28, "4 weeks"],
    [42, "6 weeks"],
    [56, "8 weeks"],
    [60, "2 months"],
    [84, "12 weeks"],
    [90, "3 months"],
    [180, "6 months"],
    [365, "1 year"]
  ];

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
        text.textContent = "Choose anything from 1 week to a year — or set your own duration.";
      }
    });
  }

  function enhanceDurationSelect() {
    const select = document.getElementById("lmDuration");
    if (!select || select.dataset.flexDuration === "true") return;

    const oldValue = Number(select.value || 90);
    select.dataset.flexDuration = "true";
    select.innerHTML = OPTIONS.map(([value, label]) =>
      `<option value="${value}">${label}</option>`
    ).join("") + '<option value="custom">Custom weeks…</option>';

    const exact = OPTIONS.some(([value]) => value === oldValue);
    select.value = exact ? String(oldValue) : "90";

    const label = select.closest("label");
    if (!label) return;

    const hint = document.createElement("small");
    hint.className = "lm-duration-hint";
    hint.textContent = "Short plan, long plan, or your own number of weeks.";
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
    select.addEventListener("change", toggleCustom);
    toggleCustom();

    const form = select.closest("form");
    if (form && form.dataset.flexDurationSubmit !== "true") {
      form.dataset.flexDurationSubmit = "true";
      form.addEventListener("submit", (event) => {
        if (select.value !== "custom") return;
        const input = document.getElementById("lmCustomWeeks");
        const weeks = Math.max(1, Math.min(104, Number(input?.value || 0)));
        if (!Number.isFinite(weeks) || weeks < 1) {
          event.preventDefault();
          input?.focus();
          return;
        }
        const days = Math.round(weeks * 7);
        let option = [...select.options].find((item) => item.value === String(days));
        if (!option) {
          option = document.createElement("option");
          option.value = String(days);
          option.textContent = `${weeks} weeks`;
          select.appendChild(option);
        }
        select.value = String(days);
      }, true);
    }
  }

  function enhance() {
    ensureStyle();
    renamePlannerLabels();
    enhanceDurationSelect();
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
