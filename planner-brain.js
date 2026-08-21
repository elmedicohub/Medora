(() => {
  "use strict";

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const TEMPLATES = [
    {key:"gym",category:"fitness",icon:"🏋️",title:"Gym routine",subtitle:"Build consistency, not guilt.",duration:84,days:[1,3,5],time:"19:00",routine:"Gym session",unit:"session",target:1},
    {key:"walking",category:"fitness",icon:"🚶",title:"Daily walking",subtitle:"A simple target you can keep.",duration:90,days:[0,1,2,3,4,5,6],time:"18:00",routine:"Walking target",unit:"steps",target:8000},
    {key:"language",category:"learning",icon:"🗣️",title:"Language practice",subtitle:"Daily or selected study days.",duration:90,days:[0,2,4,6],time:"20:00",routine:"Language practice",unit:"minutes",target:30},
    {key:"quran",category:"faith",icon:"📖",title:"Quran daily",subtitle:"Read, revise or memorize consistently.",duration:90,days:[0,1,2,3,4,5,6],time:"21:00",routine:"Quran reading / memorization",unit:"pages",target:4},
    {key:"prayers",category:"faith",icon:"🕌",title:"Five daily prayers",subtitle:"Track the day and keep it private by default.",duration:90,days:[0,1,2,3,4,5,6],time:"",routine:"Five daily prayers",unit:"prayers",target:5,bonus:"congregation"},
    {key:"mosque_church",category:"faith",icon:"⛪",title:"Mosque / church attendance",subtitle:"Congregational worship earns bonus points.",duration:90,days:[5],time:"12:00",routine:"Congregational worship",unit:"attendance",target:1,bonus:"congregation",basePoints:1.25},
    {key:"sadaqah",category:"service",icon:"🤲",title:"Sadaqah / charity",subtitle:"Money, food, time or support.",duration:90,days:[5],time:"17:00",routine:"Act of charity",unit:"act",target:1},
    {key:"help_people",category:"service",icon:"🤝",title:"Help someone",subtitle:"Support people with time, food, money or care.",duration:90,days:[2,5],time:"17:00",routine:"Help someone",unit:"act",target:1},
    {key:"music",category:"life",icon:"🎵",title:"Music practice",subtitle:"Lessons plus deliberate practice.",duration:84,days:[1,3,6],time:"20:00",routine:"Music practice",unit:"minutes",target:30},
    {key:"travel",category:"life",icon:"✈️",title:"Plan a trip",subtitle:"Make travel preparation move every week.",duration:60,days:[5],time:"18:00",routine:"Travel planning session",unit:"session",target:1},
    {key:"zakah",category:"faith",icon:"💠",title:"Zakah planning",subtitle:"A private reminder to review and prepare your obligation.",duration:365,days:[5],time:"18:00",routine:"Review Zakah plan",unit:"review",target:1},
    {key:"custom",category:"custom",icon:"✨",title:"Create my own",subtitle:"Start with your own idea.",duration:90,days:[1,3,5],time:"19:00",routine:"My routine",unit:"session",target:1}
  ];

  const state = {
    user:null, plans:[], routines:[], checkins:[], participants:[], profiles:[], connections:[],
    tab:"today", category:"all", selectedTemplate:null, observer:null, reminderTimer:null
  };

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const escapeHtml = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const dateFromISO = s => { const [y,m,d]=String(s).split("-").map(Number); return new Date(y,m-1,d); };
  const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const toISODate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function profileName(userId){
    if(userId===state.user?.id) return "You";
    return state.profiles.find(p=>p.user_id===userId)?.display_name || "Medora partner";
  }

  function planRoutines(planId){ return state.routines.filter(r=>r.plan_id===planId && r.is_active!==false); }
  function planCheckins(planId,userId){ return state.checkins.filter(c=>c.plan_id===planId && c.user_id===userId); }
  function participantsFor(planId){ return state.participants.filter(p=>p.plan_id===planId); }
  function owns(plan){ return plan.user_id===state.user?.id; }

  function scheduledOn(routine,date){
    if(!routine?.is_active) return false;
    const day=date.getDay();
    if(routine.schedule_type==="daily") return true;
    if(routine.schedule_type==="weekly") return !routine.days_of_week?.length || routine.days_of_week.includes(day);
    if(routine.schedule_type==="selected_days") return (routine.days_of_week||[]).includes(day);
    return (routine.days_of_week||[]).includes(day);
  }

  function expectedDates(plan,routine,until=new Date()){
    const start=dateFromISO(plan.start_date);
    const rawEnd=plan.end_date?dateFromISO(plan.end_date):until;
    const end=new Date(Math.min(rawEnd.getTime(),until.getTime()));
    const out=[];
    for(let d=new Date(start),guard=0;d<=end && guard<800;d=addDays(d,1),guard++) if(scheduledOn(routine,d)) out.push(toISODate(d));
    return out;
  }

  function compliance(plan,userId){
    let expected=0,earned=0,excused=0;
    for(const routine of planRoutines(plan.id)){
      for(const date of expectedDates(plan,routine)){
        const check=state.checkins.find(c=>c.routine_id===routine.id && c.user_id===userId && c.scheduled_for===date);
        if(check?.status==="excused"){excused++;continue;}
        expected++;
        if(check) earned+=Number(check.compliance_score||0);
      }
    }
    return expected?Math.round((earned/expected)*100):0;
  }

  function points(plan,userId){ return Math.round(planCheckins(plan.id,userId).reduce((s,c)=>s+Number(c.points||0),0)*10)/10; }

  function todayItems(){
    const now=new Date(); const iso=todayISO(); const rows=[];
    for(const plan of state.plans.filter(p=>p.status==="active")){
      const currentCanCheck=owns(plan) || (plan.visibility==="together" && participantsFor(plan.id).some(p=>p.user_id===state.user.id && p.role==="partner"));
      if(!currentCanCheck) continue;
      for(const routine of planRoutines(plan.id)){
        if(scheduledOn(routine,now)){
          rows.push({plan,routine,check:state.checkins.find(c=>c.routine_id===routine.id && c.user_id===state.user.id && c.scheduled_for===iso)});
        }
      }
    }
    return rows.sort((a,b)=>(a.routine.due_time||"99:99").localeCompare(b.routine.due_time||"99:99"));
  }

  function smartGuide(){
    const mine=state.plans.filter(p=>owns(p)&&p.status==="active");
    if(!mine.length) return {title:"Start smaller than your ambition.",text:"Choose one area you care about. Medora will turn it into a routine and show you what to do today."};
    const scores=mine.map(p=>compliance(p,state.user.id));
    const avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    if(avg<50) return {title:`Your current compliance is ${avg}%.`,text:"Your plan may be asking too much. Keep the goal, but reduce frequency or duration until consistency becomes easier."};
    if(avg<80) return {title:`You are at ${avg}% compliance.`,text:"You are building momentum. Protect the routines you already complete well before adding another plan."};
    return {title:`Strong rhythm: ${avg}% compliance.`,text:"You are keeping your commitments. Medora recommends increasing difficulty only if this feels sustainable, not merely possible."};
  }

  async function loadData(){
    const {data:{user}}=await db.auth.getUser();
    if(!user) return false;
    state.user=user;
    const [plans,routines,participants,checkins,profiles,connections]=await Promise.all([
      db.from("life_plans").select("*").order("created_at",{ascending:false}),
      db.from("plan_routines").select("*").order("created_at",{ascending:true}),
      db.from("plan_participants").select("*"),
      db.from("plan_checkins").select("*").gte("scheduled_for",toISODate(addDays(new Date(),-180))).order("scheduled_for",{ascending:false}),
      db.from("public_profiles").select("user_id,display_name,username,headline,is_visible").eq("is_visible",true),
      db.from("connections").select("requester_id,addressee_id,status").eq("status","accepted")
    ]);
    const error=[plans,routines,participants,checkins,profiles,connections].find(x=>x.error)?.error;
    if(error){console.warn("Life Mind load:",error);return false;}
    state.plans=plans.data||[]; state.routines=routines.data||[]; state.participants=participants.data||[]; state.checkins=checkins.data||[]; state.profiles=profiles.data||[]; state.connections=connections.data||[];
    return true;
  }

  function acceptedConnections(){
    const uid=state.user.id;
    return state.connections.map(c=>c.requester_id===uid?c.addressee_id:c.requester_id).filter(Boolean).map(id=>({id,profile:state.profiles.find(p=>p.user_id===id)}));
  }

  function renderTemplates(){
    const list=state.category==="all"?TEMPLATES:TEMPLATES.filter(t=>t.category===state.category);
    return `<div class="lm-template-grid">${list.map(t=>`<button type="button" class="lm-template" data-lm-template="${t.key}"><span class="lm-template-icon">${t.icon}</span><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.subtitle)}</small><em>Start this plan →</em></button>`).join("")}</div>`;
  }

  function renderToday(){
    const rows=todayItems();
    return `<div class="lm-today-list">${rows.length?rows.map(({plan,routine,check})=>{
      const done=check?.status==="done";
      const partial=check?.status==="partial";
      const missed=check?.status==="missed";
      const bonus=routine.bonus_rule==="congregation";
      return `<article class="lm-today-item"><span class="lm-today-icon">${escapeHtml(plan.icon||"✦")}</span><div class="lm-today-copy"><strong>${escapeHtml(routine.title)}</strong><small>${escapeHtml(plan.title)}${routine.due_time?` · ${escapeHtml(String(routine.due_time).slice(0,5))}`:" · Today"}${routine.target_value?` · target ${escapeHtml(routine.target_value)} ${escapeHtml(routine.target_unit||"")}`:""}</small></div><div class="lm-check-actions"><button type="button" class="lm-check ${done&&!check?.details?.bonus?"done":""}" data-lm-check="done" data-routine="${routine.id}" data-plan="${plan.id}">✓ Done</button>${bonus?`<button type="button" class="lm-check bonus ${check?.details?.bonus?"done":""}" data-lm-check="bonus" data-routine="${routine.id}" data-plan="${plan.id}">✦ Congregation</button>`:""}<button type="button" class="lm-check ${partial?"done":""}" data-lm-check="partial" data-routine="${routine.id}" data-plan="${plan.id}">½ Partly</button><button type="button" class="lm-check ${missed?"done":""}" data-lm-check="missed" data-routine="${routine.id}" data-plan="${plan.id}">Not done</button></div></article>`;
    }).join(""):`<div class="lm-empty"><strong>Nothing scheduled from your plans today.</strong><span>Enjoy the space, or start a plan that matters to you.</span></div>`}</div>`;
  }

  function sharedComparison(plan){
    const members=[{user_id:plan.user_id,role:"owner"},...participantsFor(plan.id)];
    if(plan.visibility!=="together"||members.length<2) return "";
    return `<div class="lm-shared-row">${members.slice(0,4).map(m=>`<div class="lm-person-progress"><strong>${escapeHtml(profileName(m.user_id))}: ${compliance(plan,m.user_id)}%</strong><small>${points(plan,m.user_id)} points · ${escapeHtml(m.role)}</small></div>`).join("")}</div>`;
  }

  function renderPlans(filter="all"){
    let plans=state.plans.filter(p=>filter==="shared"?!owns(p)||p.visibility!=="private":owns(p));
    return `<div class="lm-plan-list">${plans.length?plans.map(plan=>{
      const score=compliance(plan,plan.user_id);
      const routines=planRoutines(plan.id);
      const share=plan.visibility==="private"?"Private":plan.visibility==="accountability"?"Accountability":"Together";
      return `<article class="lm-plan-card"><div class="lm-plan-top"><div class="lm-plan-name"><span>${escapeHtml(plan.icon||"✦")}</span><div><strong>${escapeHtml(plan.title)}</strong><small>${escapeHtml(plan.category)} · ${routines.length} routine${routines.length===1?"":"s"}${plan.end_date?` · until ${escapeHtml(plan.end_date)}`:""}</small></div></div><div class="lm-score"><strong>${score}%</strong><small>compliance</small></div></div><div class="lm-progress"><span style="width:${clamp(score,0,100)}%"></span></div><div class="lm-plan-meta"><span class="lm-mini">${escapeHtml(share)}</span><span class="lm-mini">${points(plan,plan.user_id)} points</span><span class="lm-mini">${escapeHtml(plan.status)}</span></div>${sharedComparison(plan)}<div class="lm-plan-actions">${owns(plan)?`<button type="button" data-lm-share="${plan.id}">Share / together</button><button type="button" data-lm-delete="${plan.id}" class="danger">Delete</button>`:""}</div></article>`;
    }).join(""):`<div class="lm-empty"><strong>${filter==="shared"?"No shared plans yet.":"No long-term plans yet."}</strong><span>${filter==="shared"?"Share one of your plans with a connection or do it together.":"Pick a template above and Medora will build the routine for you."}</span></div>`}</div>`;
  }

  function renderRoot(){
    const root=document.querySelector("#screenContainer"); if(!root) return;
    const guide=smartGuide();
    const mine=state.plans.filter(p=>owns(p)&&p.status==="active");
    const avg=mine.length?Math.round(mine.reduce((s,p)=>s+compliance(p,state.user.id),0)/mine.length):0;
    root.innerHTML=`<section class="screen life-mind-root"><article class="lm-hero"><div><span class="eyebrow light">MEDORA LIFE MIND</span><h1>What should future you thank you for?</h1><p>Choose what matters. Medora turns it into a realistic plan, brings today's commitment forward, and learns from your consistency.</p><div class="lm-hero-actions"><button type="button" class="lm-btn primary" data-lm-start>+ Start a plan</button><button type="button" class="lm-btn glass" data-lm-tab="today">See today</button></div></div><div class="lm-pulse"><span>YOUR CURRENT RHYTHM</span><strong>${avg}%</strong><span>${mine.length} active plan${mine.length===1?"":"s"} · ${todayItems().length} commitment${todayItems().length===1?"":"s"} today</span></div></article><div class="lm-tabs"><button type="button" class="lm-tab ${state.tab==="today"?"active":""}" data-lm-tab="today">Today</button><button type="button" class="lm-tab ${state.tab==="plans"?"active":""}" data-lm-tab="plans">90-day plans</button><button type="button" class="lm-tab ${state.tab==="templates"?"active":""}" data-lm-tab="templates">Explore</button><button type="button" class="lm-tab ${state.tab==="shared"?"active":""}" data-lm-tab="shared">Shared</button></div><div class="lm-mind"><article class="lm-panel lm-guide"><span class="eyebrow">MEDORA THINKS WITH YOU</span><strong>${escapeHtml(guide.title)}</strong><small>${escapeHtml(guide.text)}</small></article><article class="lm-panel"><div class="lm-reminder"><div><strong>Due-time reminders</strong><small>Ask “Did you do it?” when a routine is due.</small></div><button type="button" data-lm-reminders>${typeof Notification!=="undefined"&&Notification.permission==="granted"?"Enabled":"Enable"}</button></div></article></div>${state.tab==="today"?`<div class="lm-template-head"><div><h2>Today's commitments</h2><p>One tap updates your compliance.</p></div></div>${renderToday()}`:""}${state.tab==="plans"?`<div class="lm-template-head"><div><h2>Your longer plans</h2><p>Plans create routines; routines create today's actions.</p></div><button type="button" class="lm-chip active" data-lm-start>+ New plan</button></div>${renderPlans("all")}`:""}${state.tab==="shared"?`<div class="lm-template-head"><div><h2>Accountability & together</h2><p>Share progress or complete the same plan side by side.</p></div></div>${renderPlans("shared")}`:""}${state.tab==="templates"?`<div class="lm-template-head"><div><h2>What do you want to improve?</h2><p>Start from a ready-made plan, then make it yours.</p></div></div><div class="lm-category-row"><button class="lm-chip ${state.category==="all"?"active":""}" data-lm-category="all">All</button><button class="lm-chip ${state.category==="fitness"?"active":""}" data-lm-category="fitness">🏃 Fitness</button><button class="lm-chip ${state.category==="faith"?"active":""}" data-lm-category="faith">🕌 Faith</button><button class="lm-chip ${state.category==="service"?"active":""}" data-lm-category="service">🤝 Service</button><button class="lm-chip ${state.category==="learning"?"active":""}" data-lm-category="learning">📚 Learning</button><button class="lm-chip ${state.category==="life"?"active":""}" data-lm-category="life">✨ Life</button></div>${renderTemplates()}`:""}<div id="lmModalHost"></div></section>`;
    bindRoot();
  }

  function templateByKey(key){ return TEMPLATES.find(t=>t.key===key)||TEMPLATES[TEMPLATES.length-1]; }

  function openSetup(template){
    state.selectedTemplate=template;
    const host=$("#lmModalHost"); if(!host) return;
    const defaultTitle=template.key==="language"?"Language practice":template.title;
    host.innerHTML=`<div class="lm-modal" data-lm-modal><section class="lm-modal-card"><div class="lm-modal-head"><div><span class="eyebrow">BUILD MY PLAN</span><h2>${template.icon} ${escapeHtml(template.title)}</h2></div><button type="button" class="lm-close" data-lm-close>×</button></div><form id="lmPlanForm" class="lm-form"><label>Plan name<input id="lmPlanTitle" value="${escapeHtml(defaultTitle)}" maxlength="180" required></label><div class="lm-form-grid"><label>Duration<select id="lmDuration"><option value="30">30 days</option><option value="60">60 days</option><option value="90" selected>90 days</option><option value="84">12 weeks</option><option value="180">6 months</option><option value="365">1 year</option></select></label><label>Due time<input id="lmDueTime" type="time" value="${escapeHtml(template.time||"")}"></label></div><label>Which days?<div class="lm-days">${dayNames.map((d,i)=>`<button type="button" class="lm-day ${template.days.includes(i)?"active":""}" data-lm-day="${i}">${d}</button>`).join("")}</div></label><div class="lm-form-grid"><label>Target<input id="lmTarget" type="number" min="0" step="1" value="${escapeHtml(template.target)}"></label><label>Unit<input id="lmUnit" value="${escapeHtml(template.unit)}" maxlength="40"></label></div><label>Privacy<select id="lmVisibility"><option value="private">Private — only me</option><option value="accountability">Accountability — share my progress</option><option value="together">Together — we both do it</option></select></label><div class="lm-modal-actions"><button type="button" class="secondary" data-lm-close>Cancel</button><button type="submit" class="primary">Create my plan →</button></div></form></section></div>`;
    $$("[data-lm-close]",host).forEach(b=>b.addEventListener("click",()=>host.innerHTML=""));
    $$("[data-lm-day]",host).forEach(b=>b.addEventListener("click",()=>b.classList.toggle("active")));
    $("#lmDuration",host).value=String(template.duration===84?84:template.duration===365?365:90);
    $("#lmPlanForm",host).addEventListener("submit",createPlan);
  }

  async function createPlan(event){
    event.preventDefault(); const t=state.selectedTemplate||templateByKey("custom");
    const days=$$("[data-lm-day].active",event.currentTarget).map(b=>Number(b.dataset.lmDay));
    if(!days.length){alert("Choose at least one day.");return;}
    const duration=Number($("#lmDuration").value||90); const start=new Date(); const end=addDays(start,duration-1); const visibility=$("#lmVisibility").value;
    const {data:plan,error}=await db.from("life_plans").insert({user_id:state.user.id,title:$("#lmPlanTitle").value.trim(),description:t.subtitle,category:t.category,template_key:t.key,icon:t.icon,visibility,start_date:toISODate(start),end_date:toISODate(end)}).select().single();
    if(error){alert(error.message);return;}
    const scheduleType=days.length===7?"daily":"selected_days";
    const {data:routine,error:rError}=await db.from("plan_routines").insert({plan_id:plan.id,user_id:state.user.id,title:t.routine,schedule_type:scheduleType,days_of_week:days,due_time:$("#lmDueTime").value||null,target_value:Number($("#lmTarget").value||0)||null,target_unit:$("#lmUnit").value.trim()||null,base_points:Number(t.basePoints||1),bonus_rule:t.bonus||null,metadata:{template_key:t.key}}).select().single();
    if(rError){await db.from("life_plans").delete().eq("id",plan.id);alert(rError.message);return;}
    state.plans.unshift(plan); state.routines.push(routine); $("#lmModalHost").innerHTML=""; state.tab="plans"; renderRoot();
    if(visibility!=="private") setTimeout(()=>openShare(plan.id),80);
  }

  async function saveCheck(planId,routineId,kind){
    const routine=state.routines.find(r=>r.id===routineId); if(!routine)return;
    let status="done",score=1,point=Number(routine.base_points||1),details={};
    if(kind==="partial"){status="partial";score=.5;point*=.5;}
    if(kind==="missed"){status="missed";score=0;point=0;}
    if(kind==="bonus"){status="done";score=1;point*=1.25;details={bonus:true,bonus_type:routine.bonus_rule||"bonus"};}
    const payload={plan_id:planId,routine_id:routineId,user_id:state.user.id,scheduled_for:todayISO(),status,compliance_score:score,points:point,details,completed_at:status==="missed"?null:new Date().toISOString()};
    const {data,error}=await db.from("plan_checkins").upsert(payload,{onConflict:"routine_id,user_id,scheduled_for"}).select().single();
    if(error){alert(error.message);return;}
    const i=state.checkins.findIndex(c=>c.routine_id===routineId&&c.user_id===state.user.id&&c.scheduled_for===todayISO()); if(i>=0)state.checkins[i]=data;else state.checkins.unshift(data); renderRoot();
  }

  function openShare(planId){
    const plan=state.plans.find(p=>p.id===planId); if(!plan||!owns(plan))return;
    const conns=acceptedConnections(); const host=$("#lmModalHost");
    host.innerHTML=`<div class="lm-modal"><section class="lm-modal-card"><div class="lm-modal-head"><div><span class="eyebrow">SHARE PLAN</span><h2>${escapeHtml(plan.title)}</h2></div><button type="button" class="lm-close" data-lm-close>×</button></div>${conns.length?`<form id="lmShareForm" class="lm-form"><label>Share with<select id="lmShareUser">${conns.map(x=>`<option value="${x.id}">${escapeHtml(x.profile?.display_name||x.profile?.username||"Connection")}</option>`).join("")}</select></label><label>How?<select id="lmShareMode"><option value="accountability">Accountability — they see my progress</option><option value="together">Together — we both complete it</option></select></label><label>What can they see?<select id="lmShareLevel"><option value="progress">Progress only</option><option value="detailed">Detailed check-ins</option></select></label><div class="lm-modal-actions"><button type="button" class="secondary" data-lm-close>Cancel</button><button type="submit" class="primary">Share plan →</button></div></form>`:`<div class="lm-empty" style="margin-top:18px"><strong>No accepted connections yet.</strong><span>Connect with someone first, then come back to share a plan.</span></div>`}</section></div>`;
    $$("[data-lm-close]",host).forEach(b=>b.addEventListener("click",()=>host.innerHTML=""));
    $("#lmShareForm",host)?.addEventListener("submit",async e=>{e.preventDefault();const userId=$("#lmShareUser").value;const mode=$("#lmShareMode").value;const shareLevel=$("#lmShareLevel").value;const {data,error}=await db.from("plan_participants").upsert({plan_id:plan.id,user_id:userId,role:mode==="together"?"partner":"accountability",share_level:shareLevel},{onConflict:"plan_id,user_id"}).select().single();if(error){alert(error.message);return;}await db.from("life_plans").update({visibility:mode}).eq("id",plan.id);plan.visibility=mode;const idx=state.participants.findIndex(p=>p.plan_id===plan.id&&p.user_id===userId);if(idx>=0)state.participants[idx]=data;else state.participants.push(data);host.innerHTML="";renderRoot();});
  }

  async function deletePlan(id){
    if(!confirm("Delete this plan and its routine history?"))return;
    const {error}=await db.from("life_plans").delete().eq("id",id); if(error){alert(error.message);return;}
    state.plans=state.plans.filter(p=>p.id!==id);state.routines=state.routines.filter(r=>r.plan_id!==id);state.checkins=state.checkins.filter(c=>c.plan_id!==id);state.participants=state.participants.filter(p=>p.plan_id!==id);renderRoot();
  }

  async function enableReminders(){
    if(typeof Notification==="undefined"){alert("Browser notifications are not supported here.");return;}
    const permission=await Notification.requestPermission();
    if(permission==="granted"){startReminderLoop();renderRoot();}
  }

  function startReminderLoop(){
    if(state.reminderTimer) clearInterval(state.reminderTimer);
    const tick=async()=>{
      if(typeof Notification==="undefined"||Notification.permission!=="granted")return;
      const now=new Date(); const hh=String(now.getHours()).padStart(2,"0"); const mm=String(now.getMinutes()).padStart(2,"0"); const current=`${hh}:${mm}`;
      for(const {plan,routine,check} of todayItems()){
        if(check||!routine.due_time)continue;
        const due=String(routine.due_time).slice(0,5); if(due!==current)continue;
        const key=`lm-${routine.id}-${todayISO()}`; if(sessionStorage.getItem(key))continue; sessionStorage.setItem(key,"1");
        try{const reg=await navigator.serviceWorker?.ready; if(reg)await reg.showNotification(`${routine.title} is due`,{body:`${plan.title} — did you do it?`,icon:"assets/icon-192.png",tag:key}); else new Notification(`${routine.title} is due`,{body:`${plan.title} — did you do it?`});}catch(e){console.warn(e);}
      }
    };
    tick(); state.reminderTimer=setInterval(tick,30000);
  }

  function bindRoot(){
    $$('[data-lm-tab]').forEach(b=>b.addEventListener("click",()=>{state.tab=b.dataset.lmTab;renderRoot();}));
    $$('[data-lm-category]').forEach(b=>b.addEventListener("click",()=>{state.category=b.dataset.lmCategory;renderRoot();}));
    $$('[data-lm-template]').forEach(b=>b.addEventListener("click",()=>openSetup(templateByKey(b.dataset.lmTemplate))));
    $$('[data-lm-start]').forEach(b=>b.addEventListener("click",()=>{state.tab="templates";renderRoot();}));
    $$('[data-lm-check]').forEach(b=>b.addEventListener("click",()=>saveCheck(b.dataset.plan,b.dataset.routine,b.dataset.lmCheck)));
    $$('[data-lm-share]').forEach(b=>b.addEventListener("click",()=>openShare(b.dataset.lmShare)));
    $$('[data-lm-delete]').forEach(b=>b.addEventListener("click",()=>deletePlan(b.dataset.lmDelete)));
    $('[data-lm-reminders]')?.addEventListener("click",enableReminders);
  }

  async function activateIfPlanner(){
    const active=document.querySelector('.nav-item[data-screen="planner"].active, .mobile-nav-item[data-screen="planner"].active');
    const kicker=document.getElementById("topbarKicker");
    if(!active && kicker?.textContent!=="PLANNER") return;
    const container=document.getElementById("screenContainer");
    if(!container||container.querySelector(".life-mind-root"))return;
    if(await loadData()){
      if(kicker) kicker.textContent="LIFE MIND";
      const title=document.getElementById("topbarTitle"); if(title) title.textContent="Think ahead. Live today.";
      renderRoot(); if(typeof Notification!=="undefined"&&Notification.permission==="granted")startReminderLoop();
    }
  }

  function watch(){
    document.addEventListener("click",e=>{if(e.target.closest('[data-screen="planner"]'))setTimeout(activateIfPlanner,0);},true);
    const container=document.getElementById("screenContainer");
    if(container){state.observer=new MutationObserver(()=>{const planner=document.querySelector('.nav-item[data-screen="planner"].active, .mobile-nav-item[data-screen="planner"].active');if(planner&&!container.querySelector(".life-mind-root"))setTimeout(activateIfPlanner,0);});state.observer.observe(container,{childList:true});}
    activateIfPlanner();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch();
})();
