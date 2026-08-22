(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_DATE_FORMAT_V42__) return;
  window.__MEDORA_TRAVEL_DATE_FORMAT_V42__ = true;

  const IDS = new Set(["npStart","npEnd","epStart","epEnd"]);

  function isoToDisplay(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value || "";
  }

  function displayToIso(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    if (yyyy < 1900 || yyyy > 2200 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
    return `${String(yyyy).padStart(4,"0")}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  }

  function formatTyping(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 8);
    let out = digits.slice(0, 2);
    if (digits.length > 2) out += "/" + digits.slice(2, 4);
    if (digits.length > 4) out += "/" + digits.slice(4, 8);
    input.value = out;
  }

  function enhance(input) {
    if (!input || input.dataset.medoraDate42) return;
    if (!IDS.has(input.id)) return;
    input.dataset.medoraDate42 = "1";
    const starting = input.value;
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = 10;
    input.placeholder = "DD/MM/YYYY";
    input.classList.add("jm-date-input");
    input.value = isoToDisplay(starting);
    input.setAttribute("aria-label", `${input.closest("label")?.childNodes?.[0]?.textContent?.trim() || "Date"} DD/MM/YYYY`);

    const label = input.closest("label");
    if (label && !label.querySelector(".jm-date-hint")) {
      const hint = document.createElement("span");
      hint.className = "jm-date-hint";
      hint.textContent = "DD/MM/YYYY";
      label.insertBefore(hint, input);
    }

    input.addEventListener("input", () => {
      input.setCustomValidity("");
      formatTyping(input);
    });
    input.addEventListener("blur", () => {
      if (input.value && displayToIso(input.value) === null) {
        input.setCustomValidity("Please enter the date as DD/MM/YYYY.");
      } else {
        input.setCustomValidity("");
      }
    });
  }

  function scan(root = document) {
    IDS.forEach(id => enhance(root.querySelector?.(`#${id}`)));
  }

  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const inputs = [...form.querySelectorAll(".jm-date-input")];
    if (!inputs.length) return;

    const restore = [];
    for (const input of inputs) {
      const display = input.value;
      const iso = displayToIso(display);
      if (iso === null) {
        input.setCustomValidity("Please enter the date as DD/MM/YYYY.");
        input.reportValidity();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      input.setCustomValidity("");
      restore.push([input, display]);
      input.value = iso;
    }

    setTimeout(() => {
      restore.forEach(([input, display]) => {
        if (document.contains(input)) input.value = display;
      });
    }, 0);
  }, true);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        scan(node);
        if (node.matches?.("#journeyOverlay")) scan(node);
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      scan();
      observer.observe(document.body, { childList:true, subtree:true });
    }, { once:true });
  } else {
    scan();
    observer.observe(document.body, { childList:true, subtree:true });
  }
})();
