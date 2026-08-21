(() => {
  "use strict";
  if (window.__MEDORA_PLANNER_CUSTOM_RANGE__) return;
  window.__MEDORA_PLANNER_CUSTOM_RANGE__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dmy = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  const maskDMY = value => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
    return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  };
  const parseDMY = s => {
    const m = String(s || "").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3], x = new Date(y, mo - 1, d);
    return x.getFullYear() === y && x.getMonth() === mo - 1 && x.getDate() === d ? x : null;
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  function styleOnce() {
    if (document.getElementById("plannerCustomRangeStyle")) return;
    const s = document.createElement("style");
    s.id = "plannerCustomRangeStyle";
    s.textContent = `
      .lm-custom-range{display:grid;grid-template-columns:1fr 1fr;gap:11px}
      .lm-custom-range label{display:grid;gap:6px}
      .lm-custom-range input{width:100%;min-height:44px;padding:0 12px;border:1px solid #dfe4ed;border-radius:12px;background:#fff;color:#283247;outline:none}
      .lm-custom-range input:focus{border-color:#9eacee;box-shadow:0 0 0 4px rgba(92,113,232,.08)}
      .lm-custom-range small{grid-column:1/-1;color:#7d8698;font-size:10px}
      #lmCustomDurationWrap[data-range-patched="1"]{display:none!important}
      @media(max-width:620px){.lm-custom-range{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function updateVisibility(form) {
    const select = form.querySelector("#lmPlanDuration");
    const range = form.querySelector(".lm-custom-range");
    if (!select || !range) return;
    range.style.display = select.value === "custom" ? "grid" : "none";
  }

  function patchForm(form) {
    if (!form || form.dataset.customRangePatched) return;
    form.dataset.customRangePatched = "1";
    styleOnce();

    const duration = form.querySelector("#lmPlanDuration");
    const oldWrap = form.querySelector("#lmCustomDurationWrap");
    if (!duration || !oldWrap) return;
    const customOption = duration.querySelector('option[value="custom"]');
    if (customOption) customOption.textContent = "Custom dates";
    oldWrap.dataset.rangePatched = "1";

    const start = new Date();
    const end = addDays(start, 27);
    const range = document.createElement("div");
    range.className = "lm-custom-range";
    range.innerHTML = `
      <label>From<input id="lmCustomFrom" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/YYYY" value="${dmy(start)}"></label>
      <label>To<input id="lmCustomTo" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/YYYY" value="${dmy(end)}"></label>
      <small>Custom plans use exact start and end dates.</small>
    `;
    oldWrap.insertAdjacentElement("afterend", range);
    range.querySelectorAll("input").forEach(input => input.addEventListener("input", () => {
      const masked = maskDMY(input.value);
      if (input.value !== masked) input.value = masked;
    }));
    updateVisibility(form);
    duration.addEventListener("change", () => updateVisibility(form));

    form.addEventListener("submit", e => {
      if (duration.value !== "custom") return;
      const from = parseDMY(form.querySelector("#lmCustomFrom")?.value);
      const to = parseDMY(form.querySelector("#lmCustomTo")?.value);
      if (!from || !to || to < from) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("Please enter a valid custom range using DD/MM/YYYY. The To date must be on or after the From date.");
        return;
      }
      const days = Math.floor((to - from) / 86400000) + 1;
      const weeks = Math.max(1, Math.ceil(days / 7));
      const hiddenWeeks = form.querySelector("#lmCustomWeeks");
      if (hiddenWeeks) hiddenWeeks.value = weeks;
      const title = form.querySelector("#lmPlanTitle")?.value.trim() || "";
      const stamp = Date.now();
      setTimeout(() => correctNewestPlan(title, stamp, iso(from), iso(to)), 350);
    }, true);
  }

  async function correctNewestPlan(title, stamp, fromISO, toISO) {
    const { data: { user } } = await db.auth.getUser();
    if (!user || !title) return;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      const q = await db.from("life_plans")
        .select("id,title,created_at,start_date,end_date")
        .eq("user_id", user.id)
        .eq("title", title)
        .order("created_at", { ascending: false })
        .limit(3);
      if (q.error) continue;
      const plan = (q.data || []).find(p => new Date(p.created_at).getTime() >= stamp - 2500);
      if (!plan) continue;
      if (plan.start_date !== fromISO || plan.end_date !== toISO) {
        await db.from("life_plans").update({ start_date: fromISO, end_date: toISO }).eq("id", plan.id).eq("user_id", user.id);
      }
      document.dispatchEvent(new CustomEvent("medora:plan-range-updated", { detail: { planId: plan.id } }));
      return;
    }
  }

  function scan() {
    const form = document.querySelector("#lmPlanForm");
    if (form) patchForm(form);
  }

  const observer = new MutationObserver(() => scan());
  function init() {
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();