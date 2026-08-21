(() => {
  "use strict";
  if (window.__MEDORA_DATE_INPUT_FORMAT__) return;
  window.__MEDORA_DATE_INPUT_FORMAT__ = true;

  const pad = n => String(n).padStart(2, "0");
  const toDMY = iso => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return "";
    const date = `${m[3]}/${m[2]}/${m[1]}`;
    return m[4] ? `${date} ${m[4]}:${m[5]}` : date;
  };
  const parseDMY = (text, withTime = false) => {
    const re = withTime
      ? /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\s*$/
      : /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;
    const m = String(text || "").match(re);
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const test = new Date(y, mo - 1, d);
    if (test.getFullYear() !== y || test.getMonth() !== mo - 1 || test.getDate() !== d) return null;
    const base = `${y}-${pad(mo)}-${pad(d)}`;
    if (!withTime) return base;
    const hh = m[4] == null ? "00" : pad(Math.min(23, +m[4]));
    const mm = m[5] == null ? "00" : pad(Math.min(59, +m[5]));
    return `${base}T${hh}:${mm}`;
  };

  function styleOnce() {
    if (document.getElementById("medoraDateInputStyle")) return;
    const s = document.createElement("style");
    s.id = "medoraDateInputStyle";
    s.textContent = `
      .medora-date-shell{position:relative;display:flex;align-items:center;width:100%}
      .medora-date-shell .medora-date-text{width:100%!important;padding-right:42px!important}
      .medora-date-picker-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#566177;cursor:pointer;font-size:15px;display:grid;place-items:center}
      .medora-date-native{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;right:8px!important;bottom:0!important;padding:0!important;border:0!important}
      .medora-date-text.invalid{border-color:#d85d72!important;box-shadow:0 0 0 3px rgba(216,93,114,.08)!important}
    `;
    document.head.appendChild(s);
  }

  function enhance(input) {
    if (!input || input.dataset.medoraDateEnhanced) return;
    if (!/^(date|datetime-local)$/.test(input.type)) return;
    input.dataset.medoraDateEnhanced = "1";
    const withTime = input.type === "datetime-local";
    const shell = document.createElement("span");
    shell.className = "medora-date-shell";
    const visible = document.createElement("input");
    visible.type = "text";
    visible.className = "medora-date-text";
    visible.placeholder = withTime ? "DD/MM/YYYY HH:MM" : "DD/MM/YYYY";
    visible.autocomplete = "off";
    visible.value = toDMY(input.value);
    visible.setAttribute("aria-label", withTime ? "Date and time DD/MM/YYYY HH:MM" : "Date DD/MM/YYYY");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "medora-date-picker-btn";
    button.innerHTML = "▣";
    button.title = "Choose date";

    input.parentNode.insertBefore(shell, input);
    shell.appendChild(visible);
    shell.appendChild(input);
    shell.appendChild(button);
    input.classList.add("medora-date-native");

    const syncToNative = () => {
      const parsed = parseDMY(visible.value, withTime);
      if (!visible.value.trim()) {
        input.value = "";
        visible.classList.remove("invalid");
      } else if (parsed) {
        input.value = parsed;
        visible.classList.remove("invalid");
      } else {
        visible.classList.add("invalid");
        return false;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };

    visible.addEventListener("blur", syncToNative);
    visible.addEventListener("change", syncToNative);
    visible.addEventListener("input", () => visible.classList.remove("invalid"));
    input.addEventListener("change", () => { visible.value = toDMY(input.value); });
    button.addEventListener("click", () => {
      try { input.showPicker?.(); } catch {}
    });

    const form = input.form;
    if (form && !form.dataset.medoraDateGuard) {
      form.dataset.medoraDateGuard = "1";
      form.addEventListener("submit", e => {
        let ok = true;
        form.querySelectorAll(".medora-date-shell").forEach(shell => {
          const txt = shell.querySelector(".medora-date-text");
          const nat = shell.querySelector("input.medora-date-native");
          if (!txt || !nat || !txt.value.trim()) return;
          const parsed = parseDMY(txt.value, nat.type === "datetime-local");
          if (!parsed) { txt.classList.add("invalid"); ok = false; }
          else nat.value = parsed;
        });
        if (!ok) {
          e.preventDefault();
          e.stopImmediatePropagation();
          alert("Please enter dates as DD/MM/YYYY.");
        }
      }, true);
    }
  }

  function scan(root = document) {
    styleOnce();
    root.querySelectorAll?.('input[type="date"],input[type="datetime-local"]').forEach(enhance);
  }

  const observer = new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => n.nodeType === 1 && scan(n))));
  function init() {
    document.documentElement.lang = "en-GB";
    scan(document);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
      document.querySelectorAll(".medora-date-shell").forEach(shell => {
        const txt = shell.querySelector(".medora-date-text");
        const nat = shell.querySelector("input.medora-date-native");
        if (txt && nat && document.activeElement !== txt && nat.value && txt.value !== toDMY(nat.value)) txt.value = toDMY(nat.value);
      });
    }, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();