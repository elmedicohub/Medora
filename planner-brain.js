(() => {
  "use strict";

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    console.warn("Life Mind: Supabase configuration unavailable.");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const STORE_SCREEN = "medora.lastScreen";
  const STORE_TAB = "medora.lifeMindTab";
  const STORE_DURATION = "medora.planDuration";

  const DURATIONS = [
    { value: 7, short: "1W", label: "1 week" },
    { value: 30, short: "1M", label: "1 month" },
    { value: 90, short: "3M", label: "3 months" },
    { value: 180, short: "6M", label: "6 months" },
    { value: 365, short: "1Y", label: "1 year" },
    { value: "custom", short: "Custom", label: "Custom duration" }
  ];

  const TEMPLATES = [
    {key:"gym",category:"Fitness",icon:"🏋️",title:"Gym",subtitle:"Build a consistent training rhythm.",days:[1,3,5],time:"19:00",routine:"Gym session",target:1,unit:"session"},
    {key:"walking",category:"Fitness",icon:"🚶",title:"Walking target",subtitle:"Set a daily step target.",days:[0,1,2,3,4,5,6],time:"18:00",routine:"Walking",target:8000,unit:"steps"},
    {key:"language",category:"Learning",icon:"🗣️",title:"Language practice",subtitle:"Daily or selected study days.",days:[0,2,4,6],time:"20:00",routine:"Language practice",target:30,unit:"minutes"},
    {key:"quran",category:"Faith",icon:"📖",title:"Quran",subtitle:"Reading, revision or memorization.",days:[0,1,2,3,4,5,6],time:"21:00",routine:"Quran reading / memorization",target:4,unit:"pages"},
    {key:"prayers",category:"Faith",icon:"🕌",title:"Daily prayers",subtitle:"Track the five daily prayers.",days:[0,1,2,3,4,5,6],time:"",routine:"Five daily prayers",target:5,unit:"prayers",bonus:"congregation"},
    {key:"worship",category:"Faith",icon:"⛪",title:"Mosque / church",subtitle:"Congregational worship and attendance.",days:[5],time:"12:00",routine:"Congregational worship",target:1,unit:"attendance",bonus:"congregation",basePoints:1.25},
    {key:"sadaqah",category:"Service",icon:"🤲",title:"Sadaqah",subtitle:"Money, food, time or support.",days:[5],time:"17:00",routine:"Sadaqah / charity",target:1,unit:"act"},
    {key:"zakah",category:"Faith",icon:"💠",title:"Zakah planning",subtitle:"Private review and reminder.",days:[5],time:"18:00",routine:"Review Zakah plan",target:1,unit:"review"},
    {key:"help",category:"Service",icon:"🤝",title:"Help people",subtitle:"Support with money, food, time or care.",days:[2,5],time:"17:00",routine:"Help someone",target:1,unit:"act"},
    {key:"music",category:"Life",icon:"🎵",title:"Music practice",subtitle:"Lessons and deliberate practice.",days:[1,3,6],time:"20:00",routine:"Music practice",target:30,unit:"minutes"},
    {key:"travel",category:"Life",icon:"✈️",title:"Travel plan",subtitle:"Move trip preparation forward weekly.",days:[5],time:"18:00",routine:"Travel planning",target:1,unit:"session"},
    {key:"custom",category:"Custom",icon:"✨",title:"Custom plan",subtitle:"Create any routine you want.",days:[1,3,5],time:"19:00",routine:"My routine",target:1,unit:"session"}
  ];

  const state = {
    user: null,
    tab: safeGet(STORE_TAB, "today"),
    duration: safeGet(STORE_DURATION, "90"),
    plans: [],
    routines: [],
    checkins: [],
    participants: [],
    profiles: [],
    connections: [],
    loaded: false,
    reminderTimer: null
  };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function safeGet(k, fallback="") {
    try { return localStorage.getItem(k) || fallback; } catch { return fallback; }
  }
  function safeSet(k, v) {
    try { localStorage.setItem(k, String(v)); } catch {}
  }
  function isoDate(d=new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function parseDate(s) {
    const [y,m,d] = String(s).split("-").map(Number);
    return new Date(y, m-1, d);
  }
  function addDays(d,n) {
    const x = new Date(d);
    x.setDate(x.getDate()+n);
    return x;
  }
  function owns(plan) { return plan.user_id === state.user?.id; }
  function planRoutines(id) { return state.routines.filter(r => r.plan_id === id && r.is_active !== false); }
  function planParticipants(id) { return state.participants.filter(p => p.plan_id === id); }
  function profileName(id) {
    if (id === state.user?.id) return "You";
    const p = state.profiles.find(x => x.user_id === id);
    return p?.display_name || p?.username || "Medora partner";
  }

  function plannerActive() {
    return Boolean(document.querySelector(
      '.nav-item[data-screen="planner"].active, .mobile-nav-item[data-screen="planner"].active'
    ));
  }

  function scheduledOn(routine, date) {
    if (routine.is_active === false) return false;
    const days = Array.isArray(routine.days_of_week) ? routine.days_of_week.map(Number) : [];
    if (routine.schedule_type === "daily") return true;
    return days.includes(date.getDay());
  }

  function expectedCount(plan, routine, until=new Date()) {
    const start = parseDate(plan.start_date);
    const endPlan = plan.end_date ? parseDate(plan.end_date) : until;
    const end = new Date(Math.min(endPlan.getTime(), until.getTime()));
    if (end < start) return 0;
    let count = 0;
    for (let d=new Date(start), guard=0; d<=end && guard<800; d=addDays(d,1),guard++) {
      if (scheduledOn(routine,d)) count++;
    }
    return count;
  }

  function compliance(plan, userId) {
    let expected = 0, earned = 0;
    for (const routine of planRoutines(plan.id)) {
      expected += expectedCount(plan,routine);
      const checks = state.checkins.filter(c => c.routine_id === routine.id && c.user_id === userId);
      earned += checks.reduce((sum,c) => sum + Number(c.compliance_score || 0), 0);
    }
    return expected ? Math.min(100, Math.round((earned/expected)*100)) : 0;
  }

  function points(plan,userId) {
    return Math.round(state.checkins
      .filter(c => c.plan_id === plan.id && c.user_id === userId)
      .reduce((sum,c)=>sum+Number(c.points||0),0)*10)/10;
  }

  function todayRows() {
    const today = new Date();
    const iso = isoDate(today);
    const rows = [];
    for (const plan of state.plans.filter(p => p.status === "active")) {
      const canCheck = owns(plan) ||
        (plan.visibility === "together" && planParticipants(plan.id).some(p => p.user_id === state.user.id));
      if (!canCheck) continue;
      for (const routine of planRoutines(plan.id)) {
        if (!scheduledOn(routine,today)) continue;
        rows.push({
          plan,
          routine,
          check: state.checkins.find(c =>
            c.routine_id === routine.id &&
            c.user_id === state.user.id &&
            c.scheduled_for === iso
          )
        });
      }
    }
    return rows.sort((a,b)=>(a.routine.due_time||"99:99").localeCompare(b.routine.due_time||"99:99"));
  }

  function guidance() {
    const mine = state.plans.filter(p => owns(p) && p.status === "active");
    if (!mine.length) {
      return {
        title:"Start with one area that matters.",
        text:"Choose a plan length, then let Medora turn your intention into a simple routine."
      };
    }
    const avg = Math.round(mine.reduce((s,p)=>s+compliance(p,state.user.id),0)/mine.length);
    if (avg < 50) return {
      title:`Your rhythm is ${avg}%. Make the plan easier to keep.`,
      text:"Reduce frequency before giving up the goal. Consistency matters more than ambition on paper."
    };
    if (avg < 80) return {
      title:`You are at ${avg}% compliance.`,
      text:"Protect the routines that already work before adding more."
    };
    return {
      title:`Strong rhythm: ${avg}% compliance.`,
      text:"You are keeping your commitments. Increase difficulty only when the current plan feels sustainable."
    };
  }

  async function load() {
    const { data:{ user }, error:userError } = await db.auth.getUser();
    if (userError || !user) return false;
    state.user = user;

    const since = isoDate(addDays(new Date(), -365));
    const queries = await Promise.all([
      db.from("life_plans").select("*").order("created_at",{ascending:false}),
      db.from("plan_routines").select("*").order("created_at",{ascending:true}),
      db.from("plan_checkins").select("*").gte("scheduled_for",since),
      db.from("plan_participants").select("*"),
      db.from("public_profiles").select("user_id,display_name,username,headline,is_visible"),
      db.from("connections").select("requester_id,addressee_id,status").eq("status","accepted")
    ]);

    const failed = queries.find(q => q.error);
    if (failed) {
      console.error("Life Mind data load failed", failed.error);
      return false;
    }

    [state.plans,state.routines,state.checkins,state.participants,state.profiles,state.connections] =
      queries.map(q=>q.data||[]);
    state.loaded = true;
    return true;
  }

  function header() {
    const kicker = $("#topbarKicker");
    const title = $("#topbarTitle");
    if (kicker) kicker.textContent = "PLANNER";
    if (title) title.textContent = "Make the next move obvious.";
  }

  function durationBar() {
    return `<div class="lm-duration-bar">
      <div class="lm-duration-label">
        <strong>Plan length</strong>
        <small>How far ahead do you want to think?</small>
      </div>
      <div class="lm-duration-options">
        ${DURATIONS.map(d => `<button type="button"
          class="lm-duration ${String(state.duration)===String(d.value)?"active":""}"
          data-duration="${d.value}" title="${d.label}">${d.short}</button>`).join("")}
      </div>
    </div>`;
  }

  function hero() {
    const mine = state.plans.filter(p=>owns(p)&&p.status==="active");
    const avg = mine.length ? Math.round(mine.reduce((s,p)=>s+compliance(p,state.user.id),0)/mine.length) : 0;
    return `<section class="lm-hero">
      <div>
        <span class="lm-eyebrow">MEDORA LIFE MIND</span>
        <h1>What should future you thank you for?</h1>
        <p>Choose what matters. Medora turns it into a realistic plan, brings today's commitment forward, and learns from your consistency.</p>
        <div class="lm-hero-actions">
          <button type="button" class="lm-primary" data-start-plan>+ Start a plan</button>
          <button type="button" class="lm-secondary" data-tab="today">See today</button>
        </div>
      </div>
      <aside class="lm-rhythm">
        <small>YOUR CURRENT RHYTHM</small>
        <strong>${avg}%</strong>
        <span>${mine.length} active plan${mine.length===1?"":"s"} · ${todayRows().length} commitment${todayRows().length===1?"":"s"} today</span>
      </aside>
    </section>`;
  }

  function tabs() {
    const labels = [["today","Today"],["plans","Plans"],["explore","Explore"],["shared","Shared"]];
    return `<nav class="lm-tabs">${labels.map(([key,label]) =>
      `<button type="button" data-tab="${key}" class="${state.tab===key?"active":""}">${label}</button>`
    ).join("")}</nav>`;
  }

  function todayView() {
    const rows = todayRows();
    return `<section class="lm-section">
      <div class="lm-section-head"><div><h2>Today's commitments</h2><p>One tap updates your compliance.</p></div></div>
      <div class="lm-list">
        ${rows.length ? rows.map(({plan,routine,check}) => {
          const bonus = routine.bonus_rule === "congregation";
          return `<article class="lm-today-card">
            <div class="lm-icon">${esc(plan.icon||"✦")}</div>
            <div class="lm-today-copy">
              <strong>${esc(routine.title)}</strong>
              <small>${esc(plan.title)}${routine.due_time?` · ${esc(String(routine.due_time).slice(0,5))}`:""}${routine.target_value?` · target ${esc(routine.target_value)} ${esc(routine.target_unit||"")}`:""}</small>
            </div>
            <div class="lm-checks">
              <button data-check="done" data-plan="${plan.id}" data-routine="${routine.id}" class="${check?.status==="done"&&!check?.details?.bonus?"selected":""}">✓ Done</button>
              ${bonus?`<button data-check="bonus" data-plan="${plan.id}" data-routine="${routine.id}" class="${check?.details?.bonus?"selected bonus":""}">✦ Congregation</button>`:""}
              <button data-check="partial" data-plan="${plan.id}" data-routine="${routine.id}" class="${check?.status==="partial"?"selected":""}">½ Partly</button>
              <button data-check="missed" data-plan="${plan.id}" data-routine="${routine.id}" class="${check?.status==="missed"?"selected missed":""}">Not done</button>
            </div>
          </article>`;
        }).join("") : `<div class="lm-empty"><strong>Nothing scheduled today.</strong><span>Your plans will place today's actions here automatically.</span></div>`}
      </div>
    </section>`;
  }

  function plansView() {
    const mine = state.plans.filter(owns);
    return `<section class="lm-section">
      <div class="lm-section-head">
        <div><h2>Your plans</h2><p>Pick a familiar timeframe or create a custom one.</p></div>
        <button type="button" class="lm-small-primary" data-start-plan>+ New plan</button>
      </div>
      ${durationBar()}
      <div class="lm-list">
        ${mine.length ? mine.map(plan=>{
          const score = compliance(plan,state.user.id);
          const r = planRoutines(plan.id);
          return `<article class="lm-plan-card">
            <div class="lm-plan-top">
              <div class="lm-plan-title">
                <span>${esc(plan.icon||"✦")}</span>
                <div><strong>${esc(plan.title)}</strong>
                <small>${esc(plan.category||"Plan")} · ${r.length} routine${r.length===1?"":"s"}${plan.end_date?` · until ${esc(plan.end_date)}`:""}</small></div>
              </div>
              <div class="lm-score"><strong>${score}%</strong><small>compliance</small></div>
            </div>
            <div class="lm-progress"><span style="width:${score}%"></span></div>
            <div class="lm-meta">
              <span>${esc(plan.visibility||"private")}</span>
              <span>${points(plan,state.user.id)} points</span>
              <span>${esc(plan.status||"active")}</span>
            </div>
            <div class="lm-card-actions">
              <button type="button" data-share="${plan.id}">Share / together</button>
              <button type="button" class="danger" data-delete="${plan.id}">Delete</button>
            </div>
          </article>`;
        }).join("") : `<div class="lm-empty"><strong>No plans yet.</strong><span>Choose 1W, 1M, 3M, 6M, 1Y or Custom, then pick what you want to improve.</span></div>`}
      </div>
    </section>`;
  }

  function exploreView() {
    const categories = [...new Set(TEMPLATES.map(t=>t.category))];
    return `<section class="lm-section">
      <div class="lm-section-head"><div><h2>What do you want to improve?</h2><p>Choose a template. You can change days, time, target and privacy before creating it.</p></div></div>
      ${durationBar()}
      <div class="lm-template-grid">
        ${TEMPLATES.map(t=>`<button type="button" class="lm-template" data-template="${t.key}">
          <span>${t.icon}</span><strong>${esc(t.title)}</strong><small>${esc(t.subtitle)}</small><em>Build this plan →</em>
        </button>`).join("")}
      </div>
    </section>`;
  }

  function sharedView() {
    const shared = state.plans.filter(p => !owns(p) || p.visibility !== "private");
    return `<section class="lm-section">
      <div class="lm-section-head"><div><h2>Shared & together</h2><p>Accountability when you want it, privacy when you don't.</p></div></div>
      <div class="lm-list">
        ${shared.length ? shared.map(plan=>{
          const members = [{user_id:plan.user_id,role:"owner"},...planParticipants(plan.id)];
          return `<article class="lm-plan-card">
            <div class="lm-plan-top">
              <div class="lm-plan-title"><span>${esc(plan.icon||"✦")}</span><div><strong>${esc(plan.title)}</strong><small>${esc(plan.visibility)}</small></div></div>
            </div>
            <div class="lm-compare">
              ${members.slice(0,4).map(m=>`<div><strong>${esc(profileName(m.user_id))}: ${compliance(plan,m.user_id)}%</strong><small>${points(plan,m.user_id)} points · ${esc(m.role)}</small></div>`).join("")}
            </div>
          </article>`;
        }).join("") : `<div class="lm-empty"><strong>No shared plans yet.</strong><span>Share any plan with a Medora connection when you are ready.</span></div>`}
      </div>
    </section>`;
  }

  function render() {
    if (!plannerActive()) return;
    header();
    const root = $("#screenContainer");
    if (!root) return;

    const guide = guidance();
    root.innerHTML = `<section class="screen lm-root">
      ${hero()}
      ${tabs()}
      <div class="lm-guide-row">
        <article class="lm-guide">
          <span>MEDORA THINKS WITH YOU</span>
          <strong>${esc(guide.title)}</strong>
          <small>${esc(guide.text)}</small>
        </article>
        <article class="lm-reminder">
          <div><strong>Due-time reminders</strong><small>Ask “Did you do it?” when a routine is due.</small></div>
          <button type="button" data-enable-reminders>${typeof Notification!=="undefined"&&Notification.permission==="granted"?"Enabled":"Enable"}</button>
        </article>
      </div>
      ${state.tab==="today"?todayView():""}
      ${state.tab==="plans"?plansView():""}
      ${state.tab==="explore"?exploreView():""}
      ${state.tab==="shared"?sharedView():""}
      <div id="lmModal"></div>
    </section>`;
    bindRendered();
  }

  function bindRendered() {
    $$("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
      state.tab=b.dataset.tab;
      safeSet(STORE_TAB,state.tab);
      safeSet(STORE_SCREEN,"planner");
      render();
    }));
    $$("[data-duration]").forEach(b=>b.addEventListener("click",()=>{
      state.duration=b.dataset.duration;
      safeSet(STORE_DURATION,state.duration);
      if (state.tab==="plans") {
        state.tab="explore";
        safeSet(STORE_TAB,"explore");
      }
      render();
    }));
    $$("[data-start-plan]").forEach(b=>b.addEventListener("click",()=>{
      state.tab="explore";
      safeSet(STORE_TAB,"explore");
      render();
    }));
    $$("[data-template]").forEach(b=>b.addEventListener("click",()=>openPlanModal(b.dataset.template)));
    $$("[data-check]").forEach(b=>b.addEventListener("click",()=>saveCheck(b.dataset.plan,b.dataset.routine,b.dataset.check)));
    $$("[data-delete]").forEach(b=>b.addEventListener("click",()=>deletePlan(b.dataset.delete)));
    $$("[data-share]").forEach(b=>b.addEventListener("click",()=>openShareModal(b.dataset.share)));
    $("[data-enable-reminders]")?.addEventListener("click",enableReminders);
  }

  function selectedDurationDays() {
    if (state.duration === "custom") return null;
    const n = Number(state.duration);
    return Number.isFinite(n) && n > 0 ? n : 90;
  }

  function openPlanModal(key) {
    const t = TEMPLATES.find(x=>x.key===key) || TEMPLATES[TEMPLATES.length-1];
    const host = $("#lmModal");
    if (!host) return;
    const preset = selectedDurationDays();

    host.innerHTML = `<div class="lm-modal-backdrop">
      <section class="lm-modal-card">
        <div class="lm-modal-head">
          <div><span>BUILD MY PLAN</span><h2>${t.icon} ${esc(t.title)}</h2></div>
          <button type="button" data-close>×</button>
        </div>
        <form id="lmPlanForm" class="lm-form">
          <label>Plan name<input id="lmPlanTitle" value="${esc(t.title)}" maxlength="180" required></label>

          <div class="lm-form-grid">
            <label>Duration
              <select id="lmPlanDuration">
                <option value="7">1 week</option>
                <option value="30">1 month</option>
                <option value="90">3 months</option>
                <option value="180">6 months</option>
                <option value="365">1 year</option>
                <option value="custom">Custom weeks</option>
              </select>
            </label>
            <label>Due time<input id="lmDueTime" type="time" value="${esc(t.time)}"></label>
          </div>

          <label id="lmCustomDurationWrap" class="hidden">Custom number of weeks
            <input id="lmCustomWeeks" type="number" min="1" max="104" value="5">
          </label>

          <label>Days
            <div class="lm-days">
              ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>
                `<button type="button" data-day="${i}" class="${t.days.includes(i)?"active":""}">${d}</button>`
              ).join("")}
            </div>
          </label>

          <div class="lm-form-grid">
            <label>Target<input id="lmTarget" type="number" min="0" step="1" value="${esc(t.target)}"></label>
            <label>Unit<input id="lmUnit" value="${esc(t.unit)}" maxlength="40"></label>
          </div>

          <label>Privacy
            <select id="lmVisibility">
              <option value="private">Private — only me</option>
              <option value="accountability">Accountability — share progress</option>
              <option value="together">Together — we both do it</option>
            </select>
          </label>

          <div class="lm-modal-actions">
            <button type="button" class="lm-cancel" data-close>Cancel</button>
            <button type="submit" class="lm-save">Create plan →</button>
          </div>
        </form>
      </section>
    </div>`;

    const durationSelect = $("#lmPlanDuration",host);
    durationSelect.value = state.duration === "custom" ? "custom" : String(preset || 90);
    const customWrap = $("#lmCustomDurationWrap",host);
    const syncCustom = () => customWrap.classList.toggle("hidden",durationSelect.value !== "custom");
    syncCustom();
    durationSelect.addEventListener("change", syncCustom);

    $$("[data-day]",host).forEach(b=>b.addEventListener("click",()=>b.classList.toggle("active")));
    $$("[data-close]",host).forEach(b=>b.addEventListener("click",()=>host.innerHTML=""));
    $("#lmPlanForm",host).addEventListener("submit",e=>createPlan(e,t));
  }

  async function createPlan(e,t) {
    e.preventDefault();
    const form=e.currentTarget;
    const days=$$("[data-day].active",form).map(b=>Number(b.dataset.day));
    if(!days.length){ alert("Choose at least one day."); return; }

    const durationValue=$("#lmPlanDuration",form).value;
    let durationDays;
    if(durationValue==="custom"){
      const weeks=Number($("#lmCustomWeeks",form).value);
      if(!Number.isFinite(weeks)||weeks<1){ alert("Enter a valid number of weeks."); return; }
      durationDays=Math.min(104,Math.round(weeks))*7;
    } else {
      durationDays=Number(durationValue);
    }

    const start=new Date();
    const end=addDays(start,durationDays-1);
    const visibility=$("#lmVisibility",form).value;

    const saveBtn=$(".lm-save",form);
    saveBtn.disabled=true;
    saveBtn.textContent="Creating…";

    const {data:plan,error}=await db.from("life_plans").insert({
      user_id:state.user.id,
      title:$("#lmPlanTitle",form).value.trim(),
      description:t.subtitle,
      category:t.category,
      template_key:t.key,
      icon:t.icon,
      visibility,
      start_date:isoDate(start),
      end_date:isoDate(end)
    }).select().single();

    if(error){ alert(error.message); saveBtn.disabled=false; saveBtn.textContent="Create plan →"; return; }

    const {data:routine,error:rError}=await db.from("plan_routines").insert({
      plan_id:plan.id,
      user_id:state.user.id,
      title:t.routine,
      schedule_type:days.length===7?"daily":"selected_days",
      days_of_week:days,
      due_time:$("#lmDueTime",form).value||null,
      target_value:Number($("#lmTarget",form).value)||null,
      target_unit:$("#lmUnit",form).value.trim()||null,
      base_points:Number(t.basePoints||1),
      bonus_rule:t.bonus||null,
      metadata:{template_key:t.key}
    }).select().single();

    if(rError){
      await db.from("life_plans").delete().eq("id",plan.id);
      alert(rError.message);
      return;
    }

    state.plans.unshift(plan);
    state.routines.push(routine);
    state.tab="plans";
    safeSet(STORE_TAB,"plans");
    $("#lmModal").innerHTML="";
    render();

    if(visibility!=="private") setTimeout(()=>openShareModal(plan.id),100);
  }

  async function saveCheck(planId,routineId,kind) {
    const routine=state.routines.find(r=>r.id===routineId);
    if(!routine) return;
    let status="done", score=1, pts=Number(routine.base_points||1), details={};
    if(kind==="partial"){status="partial";score=.5;pts*=.5;}
    if(kind==="missed"){status="missed";score=0;pts=0;}
    if(kind==="bonus"){status="done";score=1;pts*=1.25;details={bonus:true,bonus_type:routine.bonus_rule||"bonus"};}

    const payload={
      plan_id:planId,
      routine_id:routineId,
      user_id:state.user.id,
      scheduled_for:isoDate(),
      status,
      compliance_score:score,
      points:pts,
      details,
      completed_at:status==="missed"?null:new Date().toISOString()
    };

    const {data,error}=await db.from("plan_checkins")
      .upsert(payload,{onConflict:"routine_id,user_id,scheduled_for"})
      .select().single();

    if(error){alert(error.message);return;}
    const i=state.checkins.findIndex(c=>c.routine_id===routineId&&c.user_id===state.user.id&&c.scheduled_for===isoDate());
    if(i>=0) state.checkins[i]=data; else state.checkins.unshift(data);
    render();
  }

  async function deletePlan(id) {
    if(!confirm("Delete this plan and its routine history?")) return;
    const {error}=await db.from("life_plans").delete().eq("id",id).eq("user_id",state.user.id);
    if(error){alert(error.message);return;}
    state.plans=state.plans.filter(p=>p.id!==id);
    state.routines=state.routines.filter(r=>r.plan_id!==id);
    state.checkins=state.checkins.filter(c=>c.plan_id!==id);
    render();
  }

  function connectedPeople() {
    const uid=state.user.id;
    return state.connections.map(c=>{
      const id=c.requester_id===uid?c.addressee_id:c.requester_id;
      return {id,profile:state.profiles.find(p=>p.user_id===id)};
    }).filter(x=>x.id);
  }

  function openShareModal(planId) {
    const plan=state.plans.find(p=>p.id===planId);
    if(!plan||!owns(plan)) return;
    const people=connectedPeople();
    const host=$("#lmModal");
    if(!host) return;

    host.innerHTML=`<div class="lm-modal-backdrop">
      <section class="lm-modal-card">
        <div class="lm-modal-head"><div><span>SHARE PLAN</span><h2>${esc(plan.title)}</h2></div><button type="button" data-close>×</button></div>
        ${people.length?`<form id="lmShareForm" class="lm-form">
          <label>Person<select id="lmShareUser">${people.map(x=>`<option value="${x.id}">${esc(x.profile?.display_name||x.profile?.username||"Connection")}</option>`).join("")}</select></label>
          <label>Mode<select id="lmShareMode"><option value="accountability">Accountability — they see progress</option><option value="together">Together — both complete the plan</option></select></label>
          <label>Visibility<select id="lmShareLevel"><option value="progress">Progress only</option><option value="detailed">Detailed check-ins</option></select></label>
          <div class="lm-modal-actions"><button type="button" class="lm-cancel" data-close>Cancel</button><button class="lm-save" type="submit">Share →</button></div>
        </form>`:`<div class="lm-empty"><strong>No accepted connections yet.</strong><span>Connect with someone in People first.</span></div>`}
      </section>
    </div>`;
    $$("[data-close]",host).forEach(b=>b.addEventListener("click",()=>host.innerHTML=""));
    $("#lmShareForm",host)?.addEventListener("submit",async e=>{
      e.preventDefault();
      const userId=$("#lmShareUser",e.currentTarget).value;
      const mode=$("#lmShareMode",e.currentTarget).value;
      const shareLevel=$("#lmShareLevel",e.currentTarget).value;

      const {error:pError}=await db.from("life_plans").update({visibility:mode}).eq("id",plan.id).eq("user_id",state.user.id);
      if(pError){alert(pError.message);return;}
      const {error}=await db.from("plan_participants").upsert({
        plan_id:plan.id,user_id:userId,role:"partner",share_level:shareLevel
      },{onConflict:"plan_id,user_id"});
      if(error){alert(error.message);return;}
      plan.visibility=mode;
      state.participants=state.participants.filter(p=>!(p.plan_id===plan.id&&p.user_id===userId));
      state.participants.push({plan_id:plan.id,user_id:userId,role:"partner",share_level:shareLevel});
      host.innerHTML="";
      render();
    });
  }

  async function enableReminders() {
    if(typeof Notification==="undefined"){alert("Browser notifications are not supported here.");return;}
    const permission=await Notification.requestPermission();
    if(permission==="granted"){
      startReminderLoop();
      render();
    }
  }

  function startReminderLoop() {
    clearInterval(state.reminderTimer);
    const notified=new Set();
    const tick=()=>{
      if(!plannerActive()) return;
      const now=new Date();
      const hhmm=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      for(const {plan,routine,check} of todayRows()){
        if(check || !routine.due_time) continue;
        const due=String(routine.due_time).slice(0,5);
        const key=`${routine.id}-${isoDate()}`;
        if(due===hhmm&&!notified.has(key)){
          notified.add(key);
          new Notification(`${routine.title} is due`,{
            body:`${plan.title}: Did you do it? Open Medora to check in.`,
            icon:"assets/icon-192.png"
          });
        }
      }
    };
    tick();
    state.reminderTimer=setInterval(tick,30000);
  }

  async function activate() {
    if(!plannerActive()) return;
    safeSet(STORE_SCREEN,"planner");
    header();

    const root=$("#screenContainer");
    if(root) root.innerHTML=`<section class="screen lm-root"><div class="lm-loading">Loading your Life Mind…</div></section>`;

    if(!state.loaded) {
      const ok=await load();
      if(!ok) {
        if(root) root.innerHTML=`<section class="screen lm-root"><div class="lm-empty"><strong>Life Mind could not load.</strong><span>Please refresh once. Your existing Planner data is safe.</span></div></section>`;
        return;
      }
    }
    render();
    if(typeof Notification!=="undefined"&&Notification.permission==="granted") startReminderLoop();
  }

  function maybeRestoreAfterRefresh() {
    if(safeGet(STORE_SCREEN,"")!=="planner") return;
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const app=$("#appView");
      const button=$('.nav-item[data-screen="planner"]');
      if(app&&!app.classList.contains("hidden")&&button){
        clearInterval(timer);
        if(!button.classList.contains("active")) button.click();
        else activate();
      } else if(attempts>40) clearInterval(timer);
    },150);
  }

  function init() {
    document.addEventListener("click",e=>{
      if(e.target.closest('[data-screen="planner"]')){
        safeSet(STORE_SCREEN,"planner");
        setTimeout(activate,0);
      } else {
        const other=e.target.closest('[data-screen]');
        if(other?.dataset.screen&&other.dataset.screen!=="planner") safeSet(STORE_SCREEN,other.dataset.screen);
      }
    },true);

    maybeRestoreAfterRefresh();

    if(plannerActive()) setTimeout(activate,0);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();