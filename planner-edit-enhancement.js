(() => {
  "use strict";
  if (window.__MEDORA_PLANNER_EDIT__) return;
  window.__MEDORA_PLANNER_EDIT__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const DAY_OPTIONS = [
    [6, "Sat"], [0, "Sun"], [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"]
  ];
  const CATEGORIES = ["Fitness", "Learning", "Faith", "Service", "Life", "Custom"];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const pad = n => String(n).padStart(2, "0");

  function isoToDMY(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  }

  function dmyToISO(value) {
    const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }

  function maskDateInput(input) {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 8);
      let out = digits.slice(0, 2);
      if (digits.length > 2) out += "/" + digits.slice(2, 4);
      if (digits.length > 4) out += "/" + digits.slice(4, 8);
      input.value = out;
    });
  }

  function addStyles() {
    if ($("#plannerEditEnhancementStyle")) return;
    const s = document.createElement("style");
    s.id = "plannerEditEnhancementStyle";
    s.textContent = `
      .pe-edit-btn{min-height:38px;padding:0 14px;border:0;border-radius:11px;background:#eef2f8;color:#536078;font-weight:800;cursor:pointer}
      .pe-edit-btn:hover{background:#e6ecf5}
      .pe-bg{position:fixed;z-index:780;inset:0;display:grid;place-items:center;padding:18px;background:#0c152880;backdrop-filter:blur(6px)}
      .pe-modal{width:min(920px,100%);max-height:92vh;overflow:auto;padding:24px;border-radius:24px;background:#fff;box-shadow:0 32px 90px #101a3433}
      .pe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.pe-head small{display:block;color:#758098;font-size:9px;font-weight:900;letter-spacing:.1em}.pe-head h2{margin:5px 0 5px;font-size:28px}.pe-head p{margin:0;color:#7d879a;font-size:11px}.pe-x{width:40px;height:40px;border:0;border-radius:50%;background:#f0f3f7;color:#5e697e;font-size:22px;cursor:pointer}
      .pe-form{display:grid;gap:15px;margin-top:20px}.pe-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pe-form label{display:grid;gap:6px;color:#526078;font-size:10px;font-weight:850}.pe-form input,.pe-form select,.pe-form textarea{width:100%;border:1px solid #dfe5ee;border-radius:11px;background:#fff;color:#273247;outline:none}.pe-form input,.pe-form select{min-height:44px;padding:0 11px}.pe-form textarea{min-height:82px;padding:11px;resize:vertical}.pe-hint{color:#8b94a5;font-size:9px;line-height:1.45}
      .pe-section{display:grid;gap:10px;padding:15px;border:1px solid #e2e7ef;border-radius:17px;background:#fbfcfe}.pe-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.pe-section-head h3{margin:0;font-size:15px}.pe-section-head small{color:#8791a3;font-size:9px}.pe-routine{display:grid;gap:11px;padding:13px;border-radius:13px;background:#fff;border:1px solid #e8ecf2}.pe-routine-grid{display:grid;grid-template-columns:minmax(0,1.4fr) .6fr .7fr .65fr;gap:8px}.pe-days{display:flex;gap:6px;flex-wrap:wrap}.pe-day{min-width:45px;min-height:34px;padding:0 9px;border:1px solid #dfe5ee;border-radius:9px;background:#f3f5f9;color:#68758b;font-size:9px;font-weight:850;cursor:pointer}.pe-day.on{border-color:#8fd6c8;background:#eaf8f4;color:#18786a}.pe-active{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:7px!important}.pe-active input{width:auto!important;min-height:auto!important}
      .pe-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}.pe-cancel,.pe-save{min-height:42px;padding:0 15px;border:0;border-radius:11px;font-weight:850;cursor:pointer}.pe-cancel{background:#eef2f7;color:#5d687b}.pe-save{color:#fff;background:linear-gradient(115deg,#18b8aa,#667ff2 55%,#8558e9)}.pe-save:disabled{opacity:.55;cursor:default}
      .pe-warning{padding:11px 12px;border-radius:11px;background:#fff8e9;color:#806427;font-size:9px;line-height:1.5}
      @media(max-width:760px){.pe-grid,.pe-routine-grid{grid-template-columns:1fr}.pe-modal{padding:18px}.pe-actions{position:sticky;bottom:-18px;margin:0 -18px -18px;padding:12px 18px;background:#fff;border-top:1px solid #edf0f4}}
    `;
    document.head.appendChild(s);
  }

  function planIdFromCard(card) {
    const action = card?.querySelector("[data-share], [data-delete]");
    return action?.dataset.share || action?.dataset.delete || null;
  }

  function injectButtons() {
    $$(".lm-plan-card").forEach(card => {
      const planId = planIdFromCard(card);
      if (!planId || card.querySelector("[data-edit-plan]")) return;
      const actions = card.querySelector(".lm-card-actions");
      if (!actions) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pe-edit-btn";
      b.dataset.editPlan = planId;
      b.textContent = "Edit plan";
      const share = actions.querySelector("[data-share]");
      if (share) actions.insertBefore(b, share); else actions.insertBefore(b, actions.firstChild);
    });
  }

  function categoriesHtml(current) {
    const list = CATEGORIES.includes(current) ? CATEGORIES : [current, ...CATEGORIES].filter(Boolean);
    return [...new Set(list)].map(x => `<option value="${esc(x)}" ${x===current?"selected":""}>${esc(x)}</option>`).join("");
  }

  function goalOptions(goals, selected) {
    return `<option value="">No linked goal</option>${goals.map(g => `<option value="${g.id}" ${g.id===selected?"selected":""}>${esc(g.title)}</option>`).join("")}`;
  }

  function routineHtml(r, index) {
    const days = r.schedule_type === "daily" ? [0,1,2,3,4,5,6] : (Array.isArray(r.days_of_week) ? r.days_of_week.map(Number) : []);
    return `<div class="pe-routine" data-routine-row="${esc(r.id)}">
      <div class="pe-routine-grid">
        <label>Routine<input data-r-title value="${esc(r.title || "")}" maxlength="160"></label>
        <label>Target<input data-r-target type="number" min="0" step="0.01" value="${r.target_value ?? ""}"></label>
        <label>Unit<input data-r-unit value="${esc(r.target_unit || "")}" placeholder="prayers, pages…"></label>
        <label>Due time<input data-r-time type="time" value="${esc(String(r.due_time || "").slice(0,5))}"></label>
      </div>
      <div>
        <div class="pe-hint" style="margin-bottom:6px">Days</div>
        <div class="pe-days">${DAY_OPTIONS.map(([n,label]) => `<button type="button" class="pe-day ${days.includes(n)?"on":""}" data-day="${n}">${label}</button>`).join("")}</div>
      </div>
      <label class="pe-active"><input data-r-active type="checkbox" ${r.is_active!==false?"checked":""}> Keep this routine active</label>
    </div>`;
  }

  async function openEditor(planId) {
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return;

    const [planRes, routinesRes, goalsRes] = await Promise.all([
      db.from("life_plans").select("*").eq("id", planId).eq("user_id", user.id).maybeSingle(),
      db.from("plan_routines").select("*").eq("plan_id", planId).eq("user_id", user.id).order("created_at", { ascending:true }),
      db.from("goals").select("id,title,status").eq("user_id", user.id).order("created_at", { ascending:false })
    ]);

    if (planRes.error || !planRes.data) {
      alert(planRes.error?.message || "This plan could not be opened for editing.");
      return;
    }
    if (routinesRes.error) {
      alert(routinesRes.error.message);
      return;
    }

    const plan = planRes.data;
    const routines = routinesRes.data || [];
    const goals = (goalsRes.data || []).filter(g => g.status === "active" || g.id === plan.goal_id);

    closeEditor();
    const host = document.createElement("div");
    host.id = "plannerEditModalHost";
    host.innerHTML = `<div class="pe-bg" data-pe-backdrop><section class="pe-modal" role="dialog" aria-modal="true" aria-label="Edit plan">
      <div class="pe-head"><div><small>EDIT PLAN</small><h2>Correct this plan.</h2><p>Change what you approved by mistake without deleting the plan or its history.</p></div><button class="pe-x" type="button" data-pe-close>×</button></div>
      <form id="peForm" class="pe-form">
        <div class="pe-grid">
          <label>Plan name<input id="peTitle" value="${esc(plan.title || "")}" maxlength="160" required></label>
          <label>Category<select id="peCategory">${categoriesHtml(plan.category || "Custom")}</select></label>
        </div>
        <label>Description<textarea id="peDescription" placeholder="Optional">${esc(plan.description || "")}</textarea></label>
        <div class="pe-grid">
          <label>Start date<input id="peStart" inputmode="numeric" placeholder="DD/MM/YYYY" value="${isoToDMY(plan.start_date)}" required><span class="pe-hint">DD/MM/YYYY</span></label>
          <label>End / review date<input id="peEnd" inputmode="numeric" placeholder="DD/MM/YYYY" value="${isoToDMY(plan.end_date)}" required><span class="pe-hint">You can correct the plan end date here.</span></label>
        </div>
        <div class="pe-grid">
          <label>Linked goal<select id="peGoal">${goalOptions(goals, plan.goal_id)}</select></label>
          <label>Sharing<select id="peVisibility">
            <option value="private" ${plan.visibility==="private"?"selected":""}>Private</option>
            <option value="progress" ${plan.visibility==="progress"?"selected":""}>Share progress</option>
            <option value="together" ${plan.visibility==="together"?"selected":""}>Do it together</option>
          </select></label>
        </div>
        <section class="pe-section">
          <div class="pe-section-head"><div><h3>Routine${routines.length===1?"":"s"}</h3><small>Edit target, time and scheduled days.</small></div></div>
          ${routines.length ? routines.map(routineHtml).join("") : `<div class="pe-hint">No routine found for this plan.</div>`}
        </section>
        <div class="pe-warning">Existing check-ins are preserved. Changing dates or scheduled days changes how future compliance is calculated; old check-ins are not deleted.</div>
        <div class="pe-actions"><button class="pe-cancel" type="button" data-pe-close>Cancel</button><button class="pe-save" type="submit">Save changes</button></div>
      </form>
    </section></div>`;
    document.body.appendChild(host);

    maskDateInput($("#peStart", host));
    maskDateInput($("#peEnd", host));
    $$(".pe-day", host).forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
    $$('[data-pe-close]', host).forEach(b => b.addEventListener("click", closeEditor));
    $("[data-pe-backdrop]", host)?.addEventListener("click", e => { if (e.target === e.currentTarget) closeEditor(); });
    $("#peForm", host)?.addEventListener("submit", e => saveEditor(e, plan, routines, user));
  }

  async function saveEditor(event, plan, routines, user) {
    event.preventDefault();
    const form = event.currentTarget;
    const start = dmyToISO($("#peStart", form)?.value);
    const end = dmyToISO($("#peEnd", form)?.value);
    if (!start || !end) {
      alert("Please enter valid dates as DD/MM/YYYY.");
      return;
    }
    if (new Date(`${end}T00:00:00`) < new Date(`${start}T00:00:00`)) {
      alert("End / review date cannot be before the start date.");
      return;
    }

    const rows = $$('[data-routine-row]', form).map(row => {
      const selectedDays = $$(".pe-day.on", row).map(b => Number(b.dataset.day));
      return {
        id: row.dataset.routineRow,
        title: $("[data-r-title]", row)?.value.trim() || "Routine",
        target_value: $("[data-r-target]", row)?.value === "" ? null : Number($("[data-r-target]", row).value),
        target_unit: $("[data-r-unit]", row)?.value.trim() || null,
        due_time: $("[data-r-time]", row)?.value || null,
        days_of_week: selectedDays,
        schedule_type: selectedDays.length === 7 ? "daily" : "weekly",
        is_active: !!$("[data-r-active]", row)?.checked
      };
    });

    if (rows.some(r => r.is_active && !r.days_of_week.length)) {
      alert("Choose at least one day for each active routine.");
      return;
    }

    const save = $(".pe-save", form);
    save.disabled = true;
    save.textContent = "Saving…";

    const planPayload = {
      title: $("#peTitle", form).value.trim(),
      description: $("#peDescription", form).value.trim() || null,
      category: $("#peCategory", form).value,
      start_date: start,
      end_date: end,
      goal_id: $("#peGoal", form).value || null,
      visibility: $("#peVisibility", form).value,
      updated_at: new Date().toISOString()
    };

    const planSave = await db.from("life_plans")
      .update(planPayload)
      .eq("id", plan.id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (planSave.error) {
      alert(planSave.error.message);
      save.disabled = false;
      save.textContent = "Save changes";
      return;
    }

    for (const r of rows) {
      const routineSave = await db.from("plan_routines")
        .update({
          title: r.title,
          target_value: r.target_value,
          target_unit: r.target_unit,
          due_time: r.due_time,
          days_of_week: r.days_of_week,
          schedule_type: r.schedule_type,
          is_active: r.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", r.id)
        .eq("plan_id", plan.id)
        .eq("user_id", user.id);

      if (routineSave.error) {
        alert(`Plan saved, but a routine could not be updated: ${routineSave.error.message}`);
        save.disabled = false;
        save.textContent = "Save changes";
        return;
      }
    }

    try { localStorage.setItem("medora.lastScreen", "planner"); } catch {}
    closeEditor();
    window.location.reload();
  }

  function closeEditor() {
    $("#plannerEditModalHost")?.remove();
  }

  function bind() {
    addStyles();
    injectButtons();
    const observer = new MutationObserver(() => requestAnimationFrame(injectButtons));
    observer.observe(document.body, { childList:true, subtree:true });

    document.addEventListener("click", e => {
      const b = e.target.closest("[data-edit-plan]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      openEditor(b.dataset.editPlan);
    }, true);

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && $("#plannerEditModalHost")) closeEditor();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once:true });
  else bind();
})();
