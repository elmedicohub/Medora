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
      .lm-plan-extra{display:grid;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid #edf0f5}
      .lm-plan-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .lm-plan-summary-box{min-height:58px;padding:10px 12px;border-radius:13px;background:#f7f9fc;border:1px solid #edf0f5}
      .lm-plan-summary-box small{display:block;margin-bottom:4px;color:#8a93a4;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
      .lm-plan-summary-box strong{display:block;color:#303a50;font-size:12px;line-height:1.35}
      .lm-plan-summary-box .pce-note{margin-top:5px;color:#8a93a4;font-size:9px;line-height:1.35;text-transform:none;letter-spacing:0;font-weight:600}
      .lm-plan-timeline-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .lm-plan-timeline-head strong{font-size:11px;color:#47536a}.lm-plan-timeline-head small{font-size:9px;color:#8a93a4}
      .lm-plan-timeline{display:grid;grid-template-columns:repeat(28,minmax(0,1fr));gap:5px;align-items:center}
      .lm-day-dot{width:100%;aspect-ratio:1;min-width:8px;max-width:18px;justify-self:center;border-radius:50%;background:#dfe4ec;border:2px solid transparent;box-shadow:inset 0 0 0 1px rgba(77,88,109,.06)}
      .lm-day-dot.done{background:#28b77b;box-shadow:0 0 0 3px rgba(40,183,123,.10)}
      .lm-day-dot.missed{background:#e56778;box-shadow:0 0 0 3px rgba(229,103,120,.09)}
      .lm-day-dot.today{background:#4e7df2;box-shadow:0 0 0 4px rgba(78,125,242,.14)}
      .lm-day-dot.unscheduled{background:#edf0f5}.lm-day-dot.future{background:#dfe4ec}
      .lm-plan-timeline-legend{display:flex;flex-wrap:wrap;gap:10px;color:#8a93a4;font-size:9px}
      .lm-plan-timeline-legend span{display:inline-flex;align-items:center;gap:5px}
      .lm-legend-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
      .lm-legend-dot.green{background:#28b77b}.lm-legend-dot.red{background:#e56778}.lm-legend-dot.blue{background:#4e7df2}.lm-legend-dot.gray{background:#dfe4ec}
      @media(max-width:1050px){.lm-plan-summary-grid{grid-template-columns:1fr 1fr}.lm-plan-timeline{gap:4px}}
      @media(max-width:620px){.lm-plan-summary-grid{grid-template-columns:1fr}.lm-plan-timeline{grid-template-columns:repeat(14,minmax(0,1fr));row-gap:8px}}
    `;
    document.head.appendChild(style);
  }

  const parseISO = value => {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const isoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const addDays = (date,n) => { const x = new Date(date); x.setDate(x.getDate()+n); return x; };
  const daysBetween = (a,b) => Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate()) - new Date(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000) + 1;

  function formatDMY(value) {
    const d = value instanceof Date ? value : parseISO(value);
    if (!d || Number.isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  }

  function durationLabel(plan) {
    const start=parseISO(plan.start_date), end=parseISO(plan.end_date);
    if(!start||!end)return "Ongoing plan";
    const days=daysBetween(start,end);
    if(days<=8)return "1 week plan";
    if(days>=27&&days<=32)return "1 month plan";
    if(days>=83&&days<=97)return "3 month plan";
    if(days>=170&&days<=190)return "6 month plan";
    if(days>=350&&days<=380)return "1 year plan";
    if(days%7===0)return `${days/7} week plan`;
    return `${days} day plan`;
  }

  function scheduledOn(routine,date) {
    if(!routine || routine.is_active===false)return false;
    if(routine.schedule_type==="daily")return true;
    return (routine.days_of_week||[]).map(Number).includes(date.getDay());
  }

  function occurrences(plan,routine) {
    const start=parseISO(plan.start_date), end=parseISO(plan.end_date);
    if(!start||!end||end<start)return 0;
    let n=0;
    for(let d=new Date(start),guard=0;d<=end&&guard<1200;d=addDays(d,1),guard++)if(scheduledOn(routine,d))n++;
    return n;
  }

  function targetMetrics(plan,routines,checkins,userId) {
    let planned=0,completed=0;
    const units=new Set();
    for(const r of routines.filter(x=>x.is_active!==false)){
      const value=Number(r.target_value??1)||1;
      if(r.target_unit)units.add(r.target_unit);
      planned+=occurrences(plan,r)*value;
      for(const c of checkins.filter(x=>x.routine_id===r.id&&x.user_id===userId)){
        const score=Math.max(0,Math.min(1,Number(c.compliance_score||0)));
        completed+=score*value;
      }
    }
    const target=planned?Math.min(100,Math.round(completed/planned*100)):0;
    const unit=units.size===1?[...units][0]:(routines.length?"units":"");
    return {planned,completed,target,unit};
  }

  function targetText(routines) {
    if(!routines.length)return "No daily target";
    const daily=routines.find(r=>r.schedule_type==="daily")||routines[0];
    if(daily.target_value==null)return daily.title||"Routine";
    return `${Number(daily.target_value)} ${daily.target_unit||""}${daily.schedule_type==="daily"?" / day":""}`.trim();
  }

  function timelineHtml(plan,routines,checkins) {
    const start=parseISO(plan.start_date);
    if(!start)return "";
    const end=parseISO(plan.end_date)||addDays(start,27);
    const todayISO=isoDate(new Date()), now=parseISO(todayISO), dots=[];
    for(let i=0;i<28;i++){
      const date=addDays(start,i), dateISO=isoDate(date), beyond=date>end;
      const scheduled=beyond?[]:routines.filter(r=>scheduledOn(r,date));
      const checks=checkins.filter(c=>c.scheduled_for===dateISO&&scheduled.some(r=>r.id===c.routine_id));
      const earned=checks.reduce((s,c)=>s+Math.max(0,Math.min(1,Number(c.compliance_score||0))),0);
      const expected=scheduled.length;
      let status="future", label=`${formatDMY(date)} — upcoming`;
      if(beyond||!expected){status="unscheduled";label=`${formatDMY(date)} — no scheduled routine`;}
      else if(expected&&earned>=expected){status="done";label=`${formatDMY(date)} — achieved`;}
      else if(dateISO===todayISO){status="today";label=`${formatDMY(date)} — today`;}
      else if(date<now){status="missed";label=`${formatDMY(date)} — missed`;}
      dots.push(`<span class="lm-day-dot ${status}" title="${label}" aria-label="${label}"></span>`);
    }
    return `<div class="lm-plan-timeline-head"><strong>28-day timeline</strong><small>${formatDMY(start)} → ${formatDMY(addDays(start,27))}</small></div><div class="lm-plan-timeline" aria-label="28-day plan timeline">${dots.join("")}</div><div class="lm-plan-timeline-legend"><span><i class="lm-legend-dot green"></i>Achieved</span><span><i class="lm-legend-dot red"></i>Missed</span><span><i class="lm-legend-dot blue"></i>Today</span><span><i class="lm-legend-dot gray"></i>Upcoming</span></div>`;
  }

  function setText(node,text){ if(node && node.textContent!==text)node.textContent=text; }

  function ensureBox(grid,key,label) {
    let box=grid.querySelector(`[data-pce-box="${key}"]`);
    if(!box){
      box=document.createElement("div");
      box.className=`lm-plan-summary-box${key==="target-progress"?" pgp-target-box":""}`;
      box.dataset.pceBox=key;
      box.innerHTML=`<small>${label}</small><strong>—</strong>`;
      grid.appendChild(box);
    }
    return box;
  }

  function ensureExtra(card) {
    let extra=card.querySelector(".lm-plan-extra");
    if(!extra){
      extra=document.createElement("div");
      extra.className="lm-plan-extra";
      const actions=card.querySelector(".lm-card-actions");
      if(actions)card.insertBefore(extra,actions);else card.appendChild(extra);
    }
    let grid=extra.querySelector(".lm-plan-summary-grid");
    if(!grid){grid=document.createElement("div");grid.className="lm-plan-summary-grid";extra.prepend(grid);}

    // Adopt legacy boxes once instead of redrawing/removing them.
    const legacy=[...grid.children].filter(x=>x.classList.contains("lm-plan-summary-box")&&!x.dataset.pceBox&&!x.classList.contains("pgp-target-box"));
    ["plan","daily-target","ends"].forEach((key,i)=>{if(legacy[i])legacy[i].dataset.pceBox=key;});

    let timeline=extra.querySelector(".pce-timeline-host");
    if(!timeline){
      timeline=document.createElement("div");timeline.className="pce-timeline-host";timeline.style.display="contents";
      [...extra.children].filter(x=>x!==grid&&(x.classList.contains("lm-plan-timeline-head")||x.classList.contains("lm-plan-timeline")||x.classList.contains("lm-plan-timeline-legend"))).forEach(x=>x.remove());
      extra.appendChild(timeline);
    }
    return {extra,grid,timeline};
  }

  function replaceVisibleDate(card,plan,routineCount) {
    const small=card.querySelector(".lm-plan-title small");
    if(!small)return;
    const text=`${plan.category||"Plan"} · ${routineCount} routine${routineCount===1?"":"s"}${plan.end_date?` · until ${formatDMY(plan.end_date)}`:""}`;
    setText(small,text);
  }

  async function enhance() {
    if(busy)return;
    const cards=[...document.querySelectorAll(".lm-plan-card")].filter(card=>card.querySelector("[data-share],[data-delete]"));
    if(!cards.length)return;
    busy=true;
    try{
      const {data:{user}}=await db.auth.getUser(); if(!user)return;
      const ids=[...new Set(cards.map(card=>card.querySelector("[data-share]")?.dataset.share||card.querySelector("[data-delete]")?.dataset.delete).filter(Boolean))];
      if(!ids.length)return;
      const [plansRes,routinesRes,checksRes]=await Promise.all([
        db.from("life_plans").select("id,title,category,start_date,end_date,user_id").in("id",ids),
        db.from("plan_routines").select("id,plan_id,title,schedule_type,days_of_week,target_value,target_unit,is_active").in("plan_id",ids),
        db.from("plan_checkins").select("plan_id,routine_id,user_id,scheduled_for,status,compliance_score").in("plan_id",ids).eq("user_id",user.id)
      ]);
      if(plansRes.error||routinesRes.error||checksRes.error)return;
      const plans=plansRes.data||[], routines=routinesRes.data||[], checkins=checksRes.data||[];

      for(const card of cards){
        const planId=card.querySelector("[data-share]")?.dataset.share||card.querySelector("[data-delete]")?.dataset.delete;
        const plan=plans.find(p=>p.id===planId); if(!plan)continue;
        const planR=routines.filter(r=>r.plan_id===planId), planC=checkins.filter(c=>c.plan_id===planId);
        replaceVisibleDate(card,plan,planR.filter(r=>r.is_active!==false).length);
        const {grid,timeline}=ensureExtra(card);
        const planBox=ensureBox(grid,"plan","Plan"), dailyBox=ensureBox(grid,"daily-target","Daily target"), endBox=ensureBox(grid,"ends","Ends"), targetBox=ensureBox(grid,"target-progress","Target progress");
        setText(planBox.querySelector("small"),"Plan");setText(planBox.querySelector("strong"),durationLabel(plan));
        setText(dailyBox.querySelector("small"),"Daily target");setText(dailyBox.querySelector("strong"),targetText(planR));
        setText(endBox.querySelector("small"),"Ends");setText(endBox.querySelector("strong"),formatDMY(plan.end_date));
        const m=targetMetrics(plan,planR,planC,user.id);
        setText(targetBox.querySelector("small"),"Target progress");setText(targetBox.querySelector("strong"),`${m.target}%`);
        let note=targetBox.querySelector(".pce-note"); if(!note){note=document.createElement("div");note.className="pce-note";targetBox.appendChild(note);}
        const amount=m.planned?`${Number(m.completed.toFixed(1))}/${Number(m.planned.toFixed(1))}${m.unit?` ${m.unit}`:""}`:"—";
        setText(note,amount);
        const timelineMarkup=timelineHtml(plan,planR,planC); if(timeline.innerHTML!==timelineMarkup)timeline.innerHTML=timelineMarkup;
      }
    }catch(error){console.warn("Planner card enhancement skipped",error);}finally{busy=false;}
  }

  function scheduleEnhance(){clearTimeout(timer);timer=setTimeout(enhance,130);}
  function init(){
    styleOnce();
    new MutationObserver(scheduleEnhance).observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click",event=>{if(event.target.closest('[data-tab="plans"],[data-screen="planner"],[data-check],[data-multi-check]'))setTimeout(enhance,160);},true);
    document.addEventListener("medora:plan-range-updated",()=>setTimeout(enhance,160));
    scheduleEnhance();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();