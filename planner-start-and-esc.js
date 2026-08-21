(() => {
  "use strict";
  if (window.__MEDORA_PLANNER_START_ESC__) return;
  window.__MEDORA_PLANNER_START_ESC__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dmy = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const maskDMY = value => {
    const digits = String(value || "").replace(/\D/g, "").slice(0,8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
    return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  };
  const parseDMY = s => {
    const m = String(s || "").match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    if (!m) return null;
    const day = +m[1], month = +m[2], year = +m[3];
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  };

  function addStyles() {
    if (document.getElementById("plannerStartEscStyle")) return;
    const style = document.createElement("style");
    style.id = "plannerStartEscStyle";
    style.textContent = `
      .lm-start-block{display:grid;gap:8px}
      .lm-start-block>span{font-size:11px;font-weight:800;color:#4e596d}
      .lm-start-mode{display:flex;gap:7px;flex-wrap:wrap}
      .lm-start-mode button{min-height:38px;padding:0 13px;border:1px solid #dfe5ee;border-radius:11px;background:#fff;color:#667187;font-size:11px;font-weight:800;cursor:pointer}
      .lm-start-mode button.active{border-color:#79cba9;background:#e9f8f1;color:#157653;box-shadow:0 0 0 3px rgba(45,167,117,.07)}
      .lm-start-date-wrap{display:grid;gap:6px;max-width:320px;color:#4e596d;font-size:11px;font-weight:800}
      .lm-start-date-wrap.hidden{display:none!important}
      .lm-start-date-wrap input{width:100%;min-height:44px;padding:0 12px;border:1px solid #dfe4ed;border-radius:12px;background:#fff;color:#283247;outline:none}
      .lm-start-date-wrap input:focus{border-color:#9eacee;box-shadow:0 0 0 4px rgba(92,113,232,.08)}
    `;
    document.head.appendChild(style);
  }

  function syncVisibility(form) {
    const duration = form.querySelector("#lmPlanDuration");
    const block = form.querySelector(".lm-start-block");
    if (!duration || !block) return;
    block.style.display = duration.value === "custom" ? "none" : "grid";
  }

  function patchPlanForm(form) {
    if (!form || form.dataset.startChoicePatched) return;
    form.dataset.startChoicePatched = "1";
    addStyles();

    const duration = form.querySelector("#lmPlanDuration");
    if (!duration) return;
    const row = duration.closest(".lm-form-grid");
    if (!row) return;

    const block = document.createElement("div");
    block.className = "lm-start-block";
    block.innerHTML = `
      <span>Start</span>
      <div class="lm-start-mode">
        <button type="button" data-start-mode="now" class="active">Start now</button>
        <button type="button" data-start-mode="date">Choose start date</button>
      </div>
      <label class="lm-start-date-wrap hidden">Starting date
        <input id="lmPresetStartDate" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/YYYY" value="${dmy(new Date())}">
      </label>
    `;
    row.insertAdjacentElement("afterend", block);

    const input = block.querySelector("#lmPresetStartDate");
    input.addEventListener("input", () => {
      const masked = maskDMY(input.value);
      if (input.value !== masked) input.value = masked;
    });

    block.querySelectorAll("[data-start-mode]").forEach(button => button.addEventListener("click", () => {
      block.querySelectorAll("[data-start-mode]").forEach(x => x.classList.remove("active"));
      button.classList.add("active");
      block.dataset.startMode = button.dataset.startMode;
      block.querySelector(".lm-start-date-wrap").classList.toggle("hidden", button.dataset.startMode !== "date");
      if (button.dataset.startMode === "date") input.focus();
    }));
    block.dataset.startMode = "now";

    duration.addEventListener("change", () => syncVisibility(form));
    syncVisibility(form);

    form.addEventListener("submit", event => {
      if (duration.value === "custom") return;
      const mode = block.dataset.startMode || "now";
      const start = mode === "date" ? parseDMY(input.value) : new Date();
      if (!start) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("Please enter the starting date as DD/MM/YYYY.");
        input.focus();
        return;
      }
      const durationDays = Number(duration.value);
      if (!Number.isFinite(durationDays) || durationDays < 1) return;
      const end = addDays(start, durationDays - 1);
      const title = form.querySelector("#lmPlanTitle")?.value.trim() || "";
      const stamp = Date.now();
      setTimeout(() => correctNewestPlan(title, stamp, iso(start), iso(end)), 350);
    }, true);
  }

  async function correctNewestPlan(title, stamp, startISO, endISO) {
    const { data: { user } } = await db.auth.getUser();
    if (!user || !title) return;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r,250));
      const q = await db.from("life_plans")
        .select("id,title,created_at,start_date,end_date")
        .eq("user_id", user.id)
        .eq("title", title)
        .order("created_at", { ascending:false })
        .limit(3);
      if (q.error) continue;
      const plan = (q.data || []).find(p => new Date(p.created_at).getTime() >= stamp - 2500);
      if (!plan) continue;
      if (plan.start_date !== startISO || plan.end_date !== endISO) {
        await db.from("life_plans")
          .update({ start_date:startISO, end_date:endISO })
          .eq("id",plan.id)
          .eq("user_id",user.id);
      }
      document.dispatchEvent(new CustomEvent("medora:plan-range-updated", { detail:{ planId:plan.id } }));
      return;
    }
  }

  function isVisible(el) {
    if (!el || el.classList.contains("hidden")) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function closeTopModal() {
    const selectors = [".lm-modal-backdrop", ".gpb-modal-bg", ".modal-backdrop"];
    const overlays = selectors.flatMap(s => [...document.querySelectorAll(s)]).filter(isVisible);
    const top = overlays.at(-1);
    if (!top) return false;
    const close = top.querySelector("[data-close],[data-gpb-close],[data-close-modal],.modal-close,.lm-cancel,.gpb-x");
    if (close) {
      close.click();
      return true;
    }
    if (top.classList.contains("modal-backdrop")) top.classList.add("hidden");
    else top.remove();
    return true;
  }

  function scan() {
    const form = document.querySelector("#lmPlanForm");
    if (form) patchPlanForm(form);
  }

  function init() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList:true, subtree:true });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (closeTopModal()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();