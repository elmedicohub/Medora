(() => {
  "use strict";

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let busy = false;
  let timer = null;

  function styleOnce() {
    if (document.getElementById("lmPlanCardEnhancementStyle")) return;
    const style = document.createElement("style");
    style.id = "lmPlanCardEnhancementStyle";
    style.textContent = `
      .lm-plan-extra {
        display:grid;
        gap:12px;
        margin-top:14px;
        padding-top:14px;
        border-top:1px solid #edf0f5;
      }
      .lm-plan-summary-grid {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }
      .lm-plan-summary-box {
        min-height:58px;
        padding:10px 12px;
        border-radius:13px;
        background:#f7f9fc;
        border:1px solid #edf0f5;
      }
      .lm-plan-summary-box small {
        display:block;
        margin-bottom:4px;
        color:#8a93a4;
        font-size:9px;
        font-weight:800;
        letter-spacing:.05em;
        text-transform:uppercase;
      }
      .lm-plan-summary-box strong {
        display:block;
        color:#303a50;
        font-size:12px;
        line-height:1.35;
      }
      .lm-plan-timeline-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .lm-plan-timeline-head strong {font-size:11px;color:#47536a}
      .lm-plan-timeline-head small {font-size:9px;color:#8a93a4}
      .lm-plan-timeline {
        display:grid;
        grid-template-columns:repeat(28,minmax(0,1fr));
        gap:5px;
        align-items:center;
      }
      .lm-day-dot {
        width:100%;
        aspect-ratio:1;
        min-width:8px;
        max-width:18px;
        justify-self:center;
        border-radius:50%;
        background:#dfe4ec;
        border:2px solid transparent;
        box-shadow:inset 0 0 0 1px rgba(77,88,109,.06);
      }
      .lm-day-dot.done {background:#28b77b;box-shadow:0 0 0 3px rgba(40,183,123,.10)}
      .lm-day-dot.missed {background:#e56778;box-shadow:0 0 0 3px rgba(229,103,120,.09)}
      .lm-day-dot.today {background:#4e7df2;box-shadow:0 0 0 4px rgba(78,125,242,.14)}
      .lm-day-dot.unscheduled {background:#edf0f5}
      .lm-day-dot.future {background:#dfe4ec}
      .lm-plan-timeline-legend {
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        color:#8a93a4;
        font-size:9px;
      }
      .lm-plan-timeline-legend span {display:inline-flex;align-items:center;gap:5px}
      .lm-legend-dot {width:7px;height:7px;border-radius:50%;display:inline-block}
      .lm-legend-dot.green{background:#28b77b}.lm-legend-dot.red{background:#e56778}.lm-legend-dot.blue{background:#4e7df2}.lm-legend-dot.gray{background:#dfe4ec}
      @media(max-width:900px){
        .lm-plan-summary-grid{grid-template-columns:1fr 1fr}
        .lm-plan-timeline{gap:4px}
      }
      @media(max-width:620px){
        .lm-plan-summary-grid{grid-template-columns:1fr}
        .lm-plan-timeline{grid-template-columns:repeat(14,minmax(0,1fr));row-gap:8px}
      }
    `;
    document.head.appendChild(style);
  }

  function parseISO(value) {
    if (!value) return null;
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  function addDays(date, n) {
    const x = new Date(date);
    x.setDate(x.getDate() + n);
    return x;
  }

  function daysBetween(a, b) {
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((end - start) / 86400000) + 1;
  }

  function formatDMY(value) {
    const d = value instanceof Date ? value : parseISO(value);
    if (!d || Number.isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  }

  function durationLabel(plan) {
    const start = parseISO(plan.start_date);
    const end = parseISO(plan.end_date);
    if (!start || !end) return "Ongoing plan";
    const days = daysBetween(start, end);
    if (days <= 8) return "1 week plan";
    if (days >= 27 && days <= 32) return "1 month plan";
    if (days >= 83 && days <= 97) return "3 month plan";
    if (days >= 170 && days <= 190) return "6 month plan";
    if (days >= 350 && days <= 380) return "1 year plan";
    if (days % 7 === 0) return `${days / 7} week plan`;
    return `${days} day plan`;
  }

  function scheduledOn(routine, date) {
    if (!routine || routine.is_active === false) return false;
    if (routine.schedule_type === "daily") return true;
    const days = Array.isArray(routine.days_of_week) ? routine.days_of_week.map(Number) : [];
    return days.includes(date.getDay());
  }

  function targetText(routines) {
    if (!routines.length) return "No daily target";
    const daily = routines.find(r => r.schedule_type === "daily") || routines[0];
    if (daily.target_value == null) return daily.title || "Routine";
    return `${Number(daily.target_value)} ${daily.target_unit || ""}${daily.schedule_type === "daily" ? " / day" : ""}`.trim();
  }

  function timelineHtml(plan, routines, checkins) {
    const start = parseISO(plan.start_date);
    if (!start) return "";
    const end = parseISO(plan.end_date) || addDays(start, 27);
    const todayISO = isoDate(new Date());
    const now = parseISO(todayISO);
    const dots = [];

    for (let i = 0; i < 28; i++) {
      const date = addDays(start, i);
      const dateISO = isoDate(date);
      const beyondPlan = date > end;
      const scheduledRoutines = beyondPlan ? [] : routines.filter(r => scheduledOn(r, date));
      const checks = checkins.filter(c => c.scheduled_for === dateISO && scheduledRoutines.some(r => r.id === c.routine_id));

      let status = "future";
      let label = `${formatDMY(date)} — upcoming`;

      if (beyondPlan || !scheduledRoutines.length) {
        status = "unscheduled";
        label = `${formatDMY(date)} — no scheduled routine`;
      } else if (checks.some(c => c.status === "done" || Number(c.compliance_score || 0) >= 1)) {
        status = "done";
        label = `${formatDMY(date)} — achieved`;
      } else if (checks.some(c => c.status === "missed")) {
        status = "missed";
        label = `${formatDMY(date)} — missed`;
      } else if (dateISO === todayISO) {
        status = "today";
        label = `${formatDMY(date)} — today`;
      } else if (date < now) {
        status = "missed";
        label = `${formatDMY(date)} — missed`;
      }

      dots.push(`<span class="lm-day-dot ${status}" title="${label}" aria-label="${label}"></span>`);
    }

    return `
      <div class="lm-plan-timeline-head">
        <strong>28-day timeline</strong>
        <small>${formatDMY(start)} → ${formatDMY(addDays(start,27))}</small>
      </div>
      <div class="lm-plan-timeline" aria-label="28-day plan timeline">${dots.join("")}</div>
      <div class="lm-plan-timeline-legend">
        <span><i class="lm-legend-dot green"></i>Achieved</span>
        <span><i class="lm-legend-dot red"></i>Missed</span>
        <span><i class="lm-legend-dot blue"></i>Today</span>
        <span><i class="lm-legend-dot gray"></i>Upcoming</span>
      </div>`;
  }

  function replaceVisibleDate(card, plan) {
    const small = card.querySelector(".lm-plan-title small");
    if (!small) return;
    const routineCount = card.querySelectorAll(".lm-plan-extra").length;
    const category = plan.category || "Plan";
    const routines = card.dataset.enhancementRoutineCount || "";
    const current = small.textContent || "";
    const routineMatch = current.match(/(\d+)\s+routine/);
    const count = routineMatch ? Number(routineMatch[1]) : 1;
    small.textContent = `${category} · ${count} routine${count === 1 ? "" : "s"} · until ${formatDMY(plan.end_date)}`;
  }

  async function enhance() {
    if (busy) return;
    const cards = [...document.querySelectorAll(".lm-plan-card")].filter(card => card.querySelector("[data-share], [data-delete]"));
    if (!cards.length) return;
    busy = true;
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const ids = [...new Set(cards.map(card => card.querySelector("[data-share], [data-delete]")?.dataset.share || card.querySelector("[data-delete]")?.dataset.delete).filter(Boolean))];
      if (!ids.length) return;

      const [plansRes, routinesRes, checksRes] = await Promise.all([
        db.from("life_plans").select("id,title,category,start_date,end_date,user_id").in("id", ids),
        db.from("plan_routines").select("id,plan_id,title,schedule_type,days_of_week,target_value,target_unit,is_active").in("plan_id", ids),
        db.from("plan_checkins").select("plan_id,routine_id,user_id,scheduled_for,status,compliance_score").in("plan_id", ids).eq("user_id", user.id)
      ]);
      if (plansRes.error || routinesRes.error || checksRes.error) return;

      const plans = plansRes.data || [];
      const routines = routinesRes.data || [];
      const checkins = checksRes.data || [];

      for (const card of cards) {
        const action = card.querySelector("[data-share], [data-delete]");
        const planId = action?.dataset.share || action?.dataset.delete;
        const plan = plans.find(p => p.id === planId);
        if (!plan) continue;
        const planR = routines.filter(r => r.plan_id === planId);
        const planC = checkins.filter(c => c.plan_id === planId);

        replaceVisibleDate(card, plan);

        let extra = card.querySelector(".lm-plan-extra");
        if (!extra) {
          extra = document.createElement("div");
          extra.className = "lm-plan-extra";
          const actions = card.querySelector(".lm-card-actions");
          if (actions) card.insertBefore(extra, actions);
          else card.appendChild(extra);
        }

        extra.innerHTML = `
          <div class="lm-plan-summary-grid">
            <div class="lm-plan-summary-box"><small>Plan</small><strong>${durationLabel(plan)}</strong></div>
            <div class="lm-plan-summary-box"><small>Daily target</small><strong>${targetText(planR)}</strong></div>
            <div class="lm-plan-summary-box"><small>Ends</small><strong>${formatDMY(plan.end_date)}</strong></div>
          </div>
          ${timelineHtml(plan, planR, planC)}
        `;
      }
    } catch (error) {
      console.warn("Planner card enhancement skipped", error);
    } finally {
      busy = false;
    }
  }

  function scheduleEnhance() {
    clearTimeout(timer);
    timer = setTimeout(enhance, 100);
  }

  function init() {
    styleOnce();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      if (event.target.closest('[data-tab="plans"], [data-screen="planner"]')) setTimeout(enhance, 120);
    }, true);
    scheduleEnhance();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();