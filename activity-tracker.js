(() => {
  "use strict";
  if (window.__MEDORA_ACTIVITY_TRACKER__) return;
  window.__MEDORA_ACTIVITY_TRACKER__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const STORE_SCREEN = "medora.lastScreen";
  const STORE_PERIOD = "medora.activityReportPeriod";
  const DEFAULTS = [
    ["Work","💼","productive"],
    ["Sleep","🌙","recovery"],
    ["Study","📚","productive"],
    ["Family","👨‍👩‍👧","family"],
    ["Transport","🚗","neutral"],
    ["Prayers","🕌","spiritual"],
    ["Social media","📱","distraction"],
    ["TV","📺","distraction"],
    ["Nap","😴","recovery"],
    ["Quran","📖","spiritual"],
    ["Reading","📕","productive"],
    ["Sport","🏃","productive"],
    ["Silence","🧘","recovery"]
  ];

  const GROUP_LABELS = {
    productive:"Productive",
    recovery:"Recovery",
    family:"Family",
    spiritual:"Spiritual",
    neutral:"Neutral",
    distraction:"Distraction"
  };

  const state = {
    user:null,
    types:[],
    sessions:[],
    active:null,
    reportPeriod: safeGet(STORE_PERIOD,"week"),
    timer:null,
    loaded:false
  };

  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const esc = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function safeGet(k,f="") { try { return localStorage.getItem(k) || f; } catch { return f; } }
  function safeSet(k,v) { try { localStorage.setItem(k,String(v)); } catch {} }
  function pad(n){ return String(n).padStart(2,"0"); }
  function dmy(d){ return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
  function hm(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function isoDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function minutesBetween(a,b){ return Math.max(0,(b-a)/60000); }
  function durationText(mins){
    mins=Math.max(0,Math.round(mins));
    const h=Math.floor(mins/60), m=mins%60;
    if(h && m) return `${h}h ${m}m`;
    if(h) return `${h}h`;
    return `${m}m`;
  }
  function activityType(id){ return state.types.find(t=>t.id===id); }
  function activityActive(){ return !!document.querySelector("[data-activity-link].active"); }

  function addStyles(){
    if($("#medoraActivityStyle")) return;
    const s=document.createElement("style");
    s.id="medoraActivityStyle";
    s.textContent=`
      .at-root{display:grid;gap:16px}.at-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(270px,.75fr);gap:18px;padding:27px;border-radius:26px;color:#fff;background:radial-gradient(circle at 94% 4%,rgba(124,84,223,.42),transparent 31%),radial-gradient(circle at 2% 100%,rgba(22,184,169,.26),transparent 36%),linear-gradient(135deg,#0d1934,#1d2d60 70%,#29235f)}
      .at-ey{font-size:10px;font-weight:850;letter-spacing:.12em;color:#ffffff9e}.at-hero h1{margin:7px 0 9px;font-size:clamp(34px,4vw,49px);line-height:1.03;letter-spacing:-.05em}.at-hero p{margin:0;max-width:760px;color:#ffffffaa;line-height:1.58}.at-running{display:grid;align-content:center;gap:8px;padding:20px;border:1px solid #ffffff20;border-radius:19px;background:#ffffff0c}.at-running small{color:#ffffff9c}.at-running strong{font-size:27px}.at-running-time{font-size:35px!important;letter-spacing:-.04em}.at-end{min-height:42px;border:0;border-radius:11px;background:#fff;color:#17213a;font-weight:850;cursor:pointer}.at-idle{color:#ffffffaa;font-size:13px}
      .at-tabs{display:flex;gap:5px;width:max-content;padding:5px;border-radius:14px;background:#e9eff7}.at-tabs button{min-height:39px;padding:0 15px;border:0;border-radius:10px;background:transparent;color:#68748a;font-weight:800;cursor:pointer}.at-tabs button.active{background:#fff;color:#253047;box-shadow:0 5px 15px #1d284612}
      .at-card{padding:19px;border:1px solid #e0e6ef;border-radius:19px;background:#fff}.at-head{display:flex;align-items:end;justify-content:space-between;gap:12px}.at-head h2{margin:0;font-size:23px}.at-head p{margin:4px 0 0;color:#7d8799;font-size:12px}.at-soft{min-height:37px;padding:0 12px;border:0;border-radius:10px;background:#eef1ff;color:#5368d6;font-size:11px;font-weight:800;cursor:pointer}
      .at-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:14px}.at-type{display:grid;gap:8px;min-height:116px;padding:14px;border:1px solid #e2e7ef;border-radius:16px;background:#fff;text-align:left;cursor:pointer;transition:.15s ease}.at-type:hover{transform:translateY(-1px);box-shadow:0 10px 23px #26314f10}.at-type.active{border-color:#72c7a7;background:#edf9f4;box-shadow:0 0 0 3px #2da77512}.at-type .icon{font-size:23px}.at-type strong{font-size:12px;color:#344057}.at-type small{color:#818a9b;font-size:9px}.at-type em{margin-top:auto;color:#5670da;font-size:9px;font-style:normal;font-weight:850}.at-type.active em{color:#167352}
      .at-today{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr);gap:12px}.at-list{display:grid;gap:7px;margin-top:12px}.at-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#f7f9fc}.at-row-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:#fff;font-size:18px}.at-row strong,.at-row small{display:block}.at-row small{margin-top:2px;color:#838c9e;font-size:9px}.at-duration{font-weight:850;color:#4c5870;font-size:11px}.at-delete{width:31px;height:31px;border:0;border-radius:9px;background:#fff0f3;color:#a54255;cursor:pointer}
      .at-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.at-stat{padding:13px;border-radius:13px;background:#f7f9fc}.at-stat small,.at-stat strong{display:block}.at-stat small{color:#838c9e;font-size:9px}.at-stat strong{margin-top:4px;font-size:20px}.at-bar{height:8px;margin-top:8px;overflow:hidden;border-radius:999px;background:#edf1f6}.at-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#18b7a8,#667ff1,#8659e8)}
      .at-periods{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.at-periods button{min-height:36px;padding:0 12px;border:1px solid #dfe5ee;border-radius:999px;background:#fff;color:#637087;font-size:10px;font-weight:850;cursor:pointer}.at-periods button.active{border-color:#bdc8ff;background:#eef1ff;color:#5369d7}.at-report-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.55fr);gap:11px;margin-top:12px}.at-breakdown{display:grid;gap:7px}.at-break-row{display:grid;grid-template-columns:minmax(100px,.45fr) minmax(0,1fr) auto;align-items:center;gap:8px;font-size:10px}.at-mini{height:7px;border-radius:999px;background:#edf1f6;overflow:hidden}.at-mini span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#1bb6a8,#687ff1)}.at-coach{padding:16px;border-radius:16px;background:linear-gradient(135deg,#f8fbff,#f6f3ff);border:1px solid #e2e6f1}.at-coach>span{color:#6e7890;font-size:9px;font-weight:850;letter-spacing:.1em}.at-coach h3{margin:7px 0 8px;font-size:17px}.at-coach ul{margin:0;padding-left:18px;color:#59667a;font-size:11px;line-height:1.55}.at-coach li+li{margin-top:6px}.at-note{margin-top:10px;color:#8a92a2;font-size:9px;line-height:1.45}
      .at-modal-bg{position:fixed;z-index:520;inset:0;display:grid;place-items:center;padding:18px;background:#0c15287c;backdrop-filter:blur(5px)}.at-modal{width:min(760px,100%);max-height:88vh;overflow:auto;padding:23px;border-radius:22px;background:#fff}.at-modal-h{display:flex;justify-content:space-between;gap:12px}.at-modal-h h2{margin:4px 0 0}.at-x{width:37px;height:37px;border:0;border-radius:50%;background:#f0f3f7;font-size:20px;cursor:pointer}.at-edit-list{display:grid;gap:7px;margin-top:15px}.at-edit-row{display:grid;grid-template-columns:62px minmax(150px,1fr) 150px auto;gap:7px;align-items:center}.at-edit-row input,.at-edit-row select,.at-new input,.at-new select{min-height:40px;padding:0 10px;border:1px solid #dfe4ed;border-radius:10px;background:#fff}.at-edit-row .icon-input{width:62px;text-align:center}.at-hide{min-height:38px;border:0;border-radius:9px;background:#f1f4f8;color:#657086;font-size:10px;font-weight:800;cursor:pointer}.at-new{display:grid;grid-template-columns:62px minmax(150px,1fr) 150px auto;gap:7px;margin-top:14px;padding-top:14px;border-top:1px solid #edf0f5}.at-add{min-height:40px;padding:0 12px;border:0;border-radius:10px;background:#edf0ff;color:#5268d5;font-weight:850;cursor:pointer}.at-save{min-height:42px;padding:0 14px;border:0;border-radius:11px;color:#fff;background:linear-gradient(115deg,#19b8aa,#667ff2 52%,#8558ea);font-weight:850;cursor:pointer}.at-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.at-muted{color:#828c9e;font-size:10px}.at-empty{padding:28px;border:1px dashed #dce3ec;border-radius:15px;text-align:center;color:#7f899b}
      @media(max-width:1100px){.at-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.at-hero,.at-report-grid,.at-today{grid-template-columns:1fr}}@media(max-width:760px){.at-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.at-summary{grid-template-columns:1fr 1fr}.at-edit-row,.at-new{grid-template-columns:55px 1fr}.at-edit-row select,.at-edit-row .at-hide,.at-new select,.at-new .at-add{grid-column:auto}.at-tabs{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}}@media(max-width:520px){.at-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.at-summary{grid-template-columns:1fr}.at-row{grid-template-columns:auto minmax(0,1fr) auto}.at-delete{grid-column:3}.at-hero{padding:22px}.at-hero h1{font-size:34px}}
    `;
    document.head.appendChild(s);
  }

  function ensureNav(){
    const main=$(".main-nav");
    if(main && !main.querySelector("[data-activity-link]")){
      const b=document.createElement("button");
      b.type="button"; b.className="nav-item"; b.dataset.activityLink="true";
      b.innerHTML='<span class="nav-icon">◷</span><span>Activity</span>';
      const planner=main.querySelector('[data-screen="planner"]');
      if(planner?.nextSibling) main.insertBefore(b,planner.nextSibling); else main.appendChild(b);
    }
    const mobile=$(".mobile-nav");
    if(mobile && !mobile.querySelector("[data-activity-link]")){
      const b=document.createElement("button");
      b.type="button"; b.className="mobile-nav-item"; b.dataset.activityLink="true";
      b.innerHTML='<span>◷</span><small>Activity</small>';
      const planner=mobile.querySelector('[data-screen="planner"]');
      if(planner?.nextSibling) mobile.insertBefore(b,planner.nextSibling); else mobile.appendChild(b);
    }
  }

  function setActiveNav(){
    $$(".nav-item.active,.mobile-nav-item.active,[data-wall-link].active").forEach(x=>x.classList.remove("active"));
    $$('[data-activity-link]').forEach(x=>x.classList.add("active"));
  }
  function clearActivityNav(){ $$('[data-activity-link]').forEach(x=>x.classList.remove("active")); }

  async function seedTypes(){
    const {data,error}=await db.from("activity_types").select("id").eq("user_id",state.user.id).limit(1);
    if(error || data?.length) return;
    const rows=DEFAULTS.map((x,i)=>({user_id:state.user.id,name:x[0],icon:x[1],analysis_group:x[2],sort_order:i}));
    await db.from("activity_types").insert(rows);
  }

  async function loadData(days=190){
    const {data:{user},error:uErr}=await db.auth.getUser();
    if(uErr||!user) return false;
    state.user=user;
    await seedTypes();
    const since=addDays(new Date(),-days).toISOString();
    const [typesRes,sessionsRes]=await Promise.all([
      db.from("activity_types").select("*").eq("user_id",user.id).order("sort_order").order("created_at"),
      db.from("activity_sessions").select("*").eq("user_id",user.id).gte("started_at",since).order("started_at",{ascending:false})
    ]);
    if(typesRes.error||sessionsRes.error){ console.warn("Activity load failed",typesRes.error||sessionsRes.error); return false; }
    state.types=typesRes.data||[];
    state.sessions=sessionsRes.data||[];
    state.active=state.sessions.find(s=>!s.ended_at)||null;
    state.loaded=true;
    return true;
  }

  function currentDuration(){
    if(!state.active) return 0;
    return minutesBetween(new Date(state.active.started_at),new Date());
  }

  function activePanel(){
    if(!state.active) return `<aside class="at-running"><small>RIGHT NOW</small><strong>No activity running</strong><div class="at-idle">Choose an activity below and press Start.</div></aside>`;
    const t=activityType(state.active.activity_type_id);
    return `<aside class="at-running"><small>RIGHT NOW</small><strong>${esc(t?.icon||"◷")} ${esc(t?.name||"Activity")}</strong><strong class="at-running-time" id="atRunningTime">${durationText(currentDuration())}</strong><small>Started ${hm(new Date(state.active.started_at))}</small><button class="at-end" data-at-end>End activity</button></aside>`;
  }

  function activityGrid(){
    const types=state.types.filter(t=>t.is_active);
    return `<div class="at-grid">${types.map(t=>{
      const running=state.active?.activity_type_id===t.id;
      return `<button class="at-type ${running?"active":""}" type="button" data-at-start="${t.id}"><span class="icon">${esc(t.icon)}</span><strong>${esc(t.name)}</strong><small>${esc(GROUP_LABELS[t.analysis_group]||"Neutral")}</small><em>${running?"● Running — tap to end":"▶ Start"}</em></button>`;
    }).join("")}</div>`;
  }

  function todaySessions(){
    const today=isoDate(new Date());
    return state.sessions.filter(s=>isoDate(new Date(s.started_at))===today);
  }

  function timelineRows(list=todaySessions()){
    if(!list.length) return `<div class="at-empty">No activities logged yet today.</div>`;
    return `<div class="at-list">${list.map(s=>{
      const t=activityType(s.activity_type_id);
      const end=s.ended_at?new Date(s.ended_at):new Date();
      return `<div class="at-row"><span class="at-row-icon">${esc(t?.icon||"◷")}</span><div><strong>${esc(t?.name||"Activity")}</strong><small>${hm(new Date(s.started_at))} → ${s.ended_at?hm(end):"now"}</small></div><span class="at-duration">${durationText(minutesBetween(new Date(s.started_at),end))}</span>${s.ended_at?`<button class="at-delete" title="Delete mistaken log" data-at-delete="${s.id}">×</button>`:""}</div>`;
    }).join("")}</div>`;
  }

  function rangeFor(period){
    const end=new Date();
    let days=7;
    if(period==="month") days=30;
    if(period==="3m") days=90;
    if(period==="6m") days=180;
    const start=addDays(end,-(days-1)); start.setHours(0,0,0,0);
    return {start,end,days};
  }

  function reportMetrics(period){
    const {start,end,days}=rangeFor(period);
    const byType=new Map(), byGroup=new Map();
    let total=0;
    for(const s of state.sessions){
      const ss=new Date(s.started_at), ee=s.ended_at?new Date(s.ended_at):new Date();
      if(ee<start||ss>end) continue;
      const a=new Date(Math.max(ss.getTime(),start.getTime()));
      const b=new Date(Math.min(ee.getTime(),end.getTime()));
      const mins=minutesBetween(a,b); if(mins<=0) continue;
      total+=mins;
      const t=activityType(s.activity_type_id);
      if(!t) continue;
      byType.set(t.id,(byType.get(t.id)||0)+mins);
      byGroup.set(t.analysis_group,(byGroup.get(t.analysis_group)||0)+mins);
    }
    const types=[...byType.entries()].map(([id,mins])=>({type:activityType(id),mins})).sort((a,b)=>b.mins-a.mins);
    const group = g => byGroup.get(g)||0;
    return {period,start,end,days,total,types,byGroup,productive:group("productive"),recovery:group("recovery"),family:group("family"),spiritual:group("spiritual"),neutral:group("neutral"),distraction:group("distraction")};
  }

  function percentage(x,total){ return total?Math.round(x/total*100):0; }

  function coachAdvice(m){
    if(!m.total) return ["Track a few days first. Medora needs real time data before it can identify useful patterns."];
    const advice=[];
    const distractionPct=percentage(m.distraction,m.total);
    const productivePct=percentage(m.productive,m.total);
    const recoveryPct=percentage(m.recovery,m.total);
    const social=m.types.find(x=>/social media/i.test(x.type?.name||""));
    const sleep=m.types.filter(x=>/^(sleep|nap)$/i.test(x.type?.name||"")).reduce((s,x)=>s+x.mins,0);
    const sport=m.types.find(x=>/sport|gym|walk|run|exercise/i.test(x.type?.name||""));

    if(distractionPct>=12){
      const specific=social?` Social media alone used ${durationText(social.mins)}.`:"";
      advice.push(`Distraction time is ${distractionPct}% of your tracked time.${specific} Try fixed social-media/TV windows instead of open-ended use.`);
    } else if(distractionPct>0) advice.push(`Distraction time is currently ${distractionPct}% of tracked time. Keep it intentional rather than letting it expand between activities.`);

    if(productivePct>=35) advice.push(`Productive activities account for ${productivePct}% of tracked time. Protect the times of day when work/study/reading are already happening consistently.`);
    else advice.push(`Productive activities account for ${productivePct}% of tracked time. Consider reserving one uninterrupted daily focus block before adding more goals.`);

    if(sleep>0){
      const avg=sleep/m.days/60;
      advice.push(`Logged sleep + naps average ${avg.toFixed(1)} hours/day across this period. Compare that with your own intended sleep schedule before deciding whether it needs to be reduced.`);
    } else if(recoveryPct>0) advice.push(`Recovery activities represent ${recoveryPct}% of tracked time. Check whether they are restoring energy or simply filling unscheduled gaps.`);

    if(!sport) advice.push(`No sport/exercise activity was logged in this period. If physical activity is one of your priorities, schedule a fixed recurring slot rather than relying on spare time.`);

    const top=m.types[0];
    if(top) advice.push(`${top.type?.name||"Your largest activity"} is your biggest recorded time block at ${percentage(top.mins,m.total)}%. Ask whether that share matches what matters most to you.`);
    return advice.slice(0,5);
  }

  function reportHtml(){
    const m=reportMetrics(state.reportPeriod);
    const labels={week:"7 days",month:"30 days","3m":"3 months","6m":"6 months"};
    const max=m.types[0]?.mins||1;
    const advice=coachAdvice(m);
    return `<section class="at-card"><div class="at-head"><div><h2>Performance report</h2><p>${dmy(m.start)} → ${dmy(m.end)} · ${labels[state.reportPeriod]}</p></div><button class="at-soft" data-at-save-report>Save report</button></div>
      <div class="at-periods">${[["week","Week"],["month","Month"],["3m","3M"],["6m","6M"]].map(([k,l])=>`<button class="${state.reportPeriod===k?"active":""}" data-at-period="${k}">${l}</button>`).join("")}</div>
      <div class="at-summary" style="margin-top:12px"><div class="at-stat"><small>Tracked time</small><strong>${durationText(m.total)}</strong></div><div class="at-stat"><small>Productive share</small><strong>${percentage(m.productive,m.total)}%</strong></div><div class="at-stat"><small>Distraction share</small><strong>${percentage(m.distraction,m.total)}%</strong></div></div>
      <div class="at-report-grid"><div class="at-breakdown">${m.types.length?m.types.slice(0,12).map(x=>`<div class="at-break-row"><span>${esc(x.type?.icon||"◷")} ${esc(x.type?.name||"Activity")}</span><div class="at-mini"><span style="width:${Math.max(3,x.mins/max*100)}%"></span></div><b>${durationText(x.mins)}</b></div>`).join(""):'<div class="at-empty">No data in this period.</div>'}</div><aside class="at-coach"><span>MEDORA COACH</span><h3>What your time suggests</h3><ul>${advice.map(a=>`<li>${esc(a)}</li>`).join("")}</ul><div class="at-note">This first version uses transparent pattern analysis from your logs. A generative AI narrative can be connected later through a model API without changing your tracking data.</div></aside></div>
    </section>`;
  }

  function render(){
    if(!activityActive()) return;
    const root=$("#screenContainer"); if(!root) return;
    const k=$("#topbarKicker"),t=$("#topbarTitle");
    if(k) k.textContent="ACTIVITY";
    if(t) t.textContent="See where your time actually goes.";
    const today=todaySessions();
    const todayMins=today.reduce((sum,s)=>sum+minutesBetween(new Date(s.started_at),s.ended_at?new Date(s.ended_at):new Date()),0);
    root.innerHTML=`<section class="screen at-root"><section class="at-hero"><div><span class="at-ey">MEDORA ACTIVITY</span><h1>Track life as it happens.</h1><p>Start an activity when it begins, end it when it finishes, and let Medora find the patterns across your work, sleep, study, family, worship, reading, sport and screen time.</p></div>${activePanel()}</section>
      <section class="at-card"><div class="at-head"><div><h2>What are you doing now?</h2><p>Your activity list is fully editable.</p></div><button class="at-soft" data-at-manage>Manage activities</button></div>${activityGrid()}</section>
      <div class="at-today"><section class="at-card"><div class="at-head"><div><h2>Today</h2><p>${dmy(new Date())}</p></div></div>${timelineRows(today)}</section><aside class="at-card"><h2 style="margin-top:0">Today at a glance</h2><div class="at-summary"><div class="at-stat"><small>Tracked</small><strong>${durationText(todayMins)}</strong></div><div class="at-stat"><small>Activities</small><strong>${today.length}</strong></div><div class="at-stat"><small>Current</small><strong>${state.active?esc(activityType(state.active.activity_type_id)?.name||"Running"):"Idle"}</strong></div></div></aside></div>
      ${reportHtml()}<div id="atModal"></div></section>`;
    bindRendered(); startTimer();
  }

  function bindRendered(){
    $$('[data-at-start]').forEach(b=>b.addEventListener("click",()=>toggleStart(b.dataset.atStart)));
    $('[data-at-end]')?.addEventListener("click",endCurrent);
    $('[data-at-manage]')?.addEventListener("click",openManage);
    $$('[data-at-delete]').forEach(b=>b.addEventListener("click",()=>deleteSession(b.dataset.atDelete)));
    $$('[data-at-period]').forEach(b=>b.addEventListener("click",()=>{state.reportPeriod=b.dataset.atPeriod;safeSet(STORE_PERIOD,state.reportPeriod);render();}));
    $('[data-at-save-report]')?.addEventListener("click",saveReport);
  }

  function startTimer(){
    clearInterval(state.timer);
    if(!state.active) return;
    state.timer=setInterval(()=>{ const el=$("#atRunningTime"); if(el) el.textContent=durationText(currentDuration()); },30000);
  }

  async function toggleStart(typeId){
    if(state.active?.activity_type_id===typeId){ await endCurrent(); return; }
    if(state.active){
      const old=activityType(state.active.activity_type_id)?.name||"current activity";
      const next=activityType(typeId)?.name||"new activity";
      if(!confirm(`End ${old} and start ${next}?`)) return;
      const {error:e1}=await db.from("activity_sessions").update({ended_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",state.active.id).eq("user_id",state.user.id);
      if(e1){alert(e1.message);return;}
    }
    const {data,error}=await db.from("activity_sessions").insert({user_id:state.user.id,activity_type_id:typeId,started_at:new Date().toISOString()}).select().single();
    if(error){alert(error.message);return;}
    state.sessions=state.sessions.filter(s=>s.id!==state.active?.id);
    if(state.active) state.sessions.unshift({...state.active,ended_at:new Date().toISOString()});
    state.sessions.unshift(data); state.active=data; render();
  }

  async function endCurrent(){
    if(!state.active) return;
    const ended=new Date().toISOString();
    const {data,error}=await db.from("activity_sessions").update({ended_at:ended,updated_at:ended}).eq("id",state.active.id).eq("user_id",state.user.id).select().single();
    if(error){alert(error.message);return;}
    state.sessions=state.sessions.map(s=>s.id===data.id?data:s); state.active=null; render();
  }

  async function deleteSession(id){
    if(!confirm("Delete this activity log?")) return;
    const {error}=await db.from("activity_sessions").delete().eq("id",id).eq("user_id",state.user.id);
    if(error){alert(error.message);return;}
    state.sessions=state.sessions.filter(s=>s.id!==id); render();
  }

  function groupOptions(selected){ return Object.entries(GROUP_LABELS).map(([k,v])=>`<option value="${k}" ${k===selected?"selected":""}>${v}</option>`).join(""); }

  function openManage(){
    const host=$("#atModal"); if(!host) return;
    host.innerHTML=`<div class="at-modal-bg"><section class="at-modal"><div class="at-modal-h"><div><span class="at-ey" style="color:#71809b">EDITABLE ACTIVITY LIST</span><h2>Choose what Medora tracks.</h2><p class="at-muted">The analysis group tells Medora how to interpret the time. You can change it.</p></div><button class="at-x" data-at-close>×</button></div><div class="at-edit-list">${state.types.map(t=>`<div class="at-edit-row" data-at-type-row="${t.id}"><input class="icon-input" maxlength="8" value="${esc(t.icon)}"><input class="name-input" maxlength="60" value="${esc(t.name)}"><select class="group-input">${groupOptions(t.analysis_group)}</select><button class="at-hide" data-at-toggle="${t.id}">${t.is_active?"Hide":"Show"}</button></div>`).join("")}</div><div class="at-new"><input id="atNewIcon" maxlength="8" value="✨"><input id="atNewName" maxlength="60" placeholder="New activity"><select id="atNewGroup">${groupOptions("neutral")}</select><button class="at-add" data-at-add>+ Add</button></div><div class="at-modal-actions"><button class="at-save" data-at-save-types>Save changes</button></div></section></div>`;
    $$('[data-at-close]',host).forEach(b=>b.addEventListener("click",()=>host.innerHTML=""));
    $$('[data-at-toggle]',host).forEach(b=>b.addEventListener("click",async()=>{
      const t=state.types.find(x=>x.id===b.dataset.atToggle); if(!t)return;
      const {error}=await db.from("activity_types").update({is_active:!t.is_active,updated_at:new Date().toISOString()}).eq("id",t.id).eq("user_id",state.user.id);
      if(error){alert(error.message);return;} t.is_active=!t.is_active; openManage();
    }));
    $('[data-at-add]',host)?.addEventListener("click",addType);
    $('[data-at-save-types]',host)?.addEventListener("click",saveTypes);
  }

  async function addType(){
    const host=$("#atModal"); const name=$("#atNewName",host)?.value.trim(); if(!name){alert("Enter an activity name.");return;}
    const icon=$("#atNewIcon",host)?.value.trim()||"◷"; const group=$("#atNewGroup",host)?.value||"neutral";
    const {data,error}=await db.from("activity_types").insert({user_id:state.user.id,name,icon,analysis_group:group,sort_order:state.types.length}).select().single();
    if(error){alert(error.message);return;} state.types.push(data); openManage();
  }

  async function saveTypes(){
    const host=$("#atModal");
    for(const row of $$('[data-at-type-row]',host)){
      const id=row.dataset.atTypeRow; const t=state.types.find(x=>x.id===id); if(!t)continue;
      const name=$('.name-input',row).value.trim(); if(!name){alert("Activity names cannot be empty.");return;}
      const icon=$('.icon-input',row).value.trim()||"◷"; const group=$('.group-input',row).value;
      const {error}=await db.from("activity_types").update({name,icon,analysis_group:group,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",state.user.id);
      if(error){alert(error.message);return;} Object.assign(t,{name,icon,analysis_group:group});
    }
    host.innerHTML=""; render();
  }

  async function saveReport(){
    const m=reportMetrics(state.reportPeriod); const advice=coachAdvice(m);
    const metrics={tracked_minutes:Math.round(m.total),productive_minutes:Math.round(m.productive),recovery_minutes:Math.round(m.recovery),family_minutes:Math.round(m.family),spiritual_minutes:Math.round(m.spiritual),neutral_minutes:Math.round(m.neutral),distraction_minutes:Math.round(m.distraction),by_activity:m.types.map(x=>({name:x.type?.name,minutes:Math.round(x.mins)}))};
    const analysis=advice.join("\n");
    const {error}=await db.from("activity_reports").insert({user_id:state.user.id,period_type:state.reportPeriod,period_start:isoDate(m.start),period_end:isoDate(m.end),metrics,analysis});
    if(error){alert(error.message);return;} alert("Performance report saved.");
  }

  async function openActivity(){
    safeSet(STORE_SCREEN,"activity"); setActiveNav();
    const root=$("#screenContainer"); if(root) root.innerHTML='<section class="screen at-root"><div class="at-empty">Loading your activity tracker…</div></section>';
    if(!state.loaded){ const ok=await loadData(); if(!ok){ if(root)root.innerHTML='<section class="screen"><div class="at-empty">Activity tracker could not load. Please refresh once.</div></section>'; return; } }
    render();
  }

  function closeActivityModal(){ const m=$(".at-modal-bg"); if(m){m.remove();return true;} return false; }

  function restore(){
    if(safeGet(STORE_SCREEN,"")!=="activity") return;
    let n=0; const i=setInterval(()=>{ n++; const app=$("#appView"); const b=$('[data-activity-link]'); if(app&&!app.classList.contains("hidden")&&b){clearInterval(i);openActivity();} else if(n>50)clearInterval(i); },150);
  }

  function init(){
    addStyles(); ensureNav();
    new MutationObserver(()=>ensureNav()).observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click",e=>{
      const activity=e.target.closest('[data-activity-link]');
      if(activity){ e.preventDefault(); e.stopPropagation(); openActivity(); return; }
      const normal=e.target.closest('[data-screen],[data-wall-link]');
      if(normal&&!normal.matches('[data-activity-link]')){ clearActivityNav(); if(activityActive()) clearInterval(state.timer); }
    },true);
    document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&closeActivityModal()){e.preventDefault();e.stopPropagation();} },true);
    restore();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();