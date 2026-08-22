(() => {
  "use strict";
  if (window.__MEDORA_PLAN_GOAL_PROGRESS__) return;
  window.__MEDORA_PLAN_GOAL_PROGRESS__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  let busy=false, timer=null;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(n,v)=>{if(n&&n.textContent!==String(v))n.textContent=String(v)};
  const setHTML=(n,v)=>{if(n&&n.innerHTML!==v)n.innerHTML=v};

  function styleOnce(){
    if($("#planGoalProgressStyle"))return;
    const s=document.createElement("style");s.id="planGoalProgressStyle";s.textContent=`
      .pgp-metric-note{margin-top:7px;color:#7d8798;font-size:9px;line-height:1.45}
      .pgp-goal-auto{margin-top:8px;padding:8px 10px;border-radius:10px;background:#f2faf6;color:#39745e;font-size:9px;font-weight:700}
      .pgp-plan-values{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;color:#788397;font-size:9px}
      .pgp-plan-values span{display:inline-flex;align-items:center;gap:4px}.pgp-plan-values b{color:#344057}
      .gpb-metrics.pgp-three{grid-template-columns:repeat(3,1fr)}
      @media(max-width:850px){.gpb-metrics.pgp-three{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  const parseISO=v=>{const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const scheduled=(r,d)=>r?.is_active!==false&&(r.schedule_type==="daily"||(r.days_of_week||[]).map(Number).includes(d.getDay()));

  function plannedOccurrences(plan,routine){
    const start=parseISO(plan.start_date),end=parseISO(plan.end_date);if(!start||!end||end<start)return 0;
    let count=0;for(let d=new Date(start),guard=0;d<=end&&guard<1200;d=addDays(d,1),guard++)if(scheduled(routine,d))count++;return count;
  }
  function dueOccurrences(plan,routine){
    const start=parseISO(plan.start_date),endPlan=parseISO(plan.end_date);if(!start)return 0;
    const today=parseISO(isoDate(new Date())),end=endPlan&&endPlan<today?endPlan:today;if(end<start)return 0;
    let count=0;for(let d=new Date(start),guard=0;d<=end&&guard<1200;d=addDays(d,1),guard++)if(scheduled(routine,d))count++;return count;
  }
  function planMetrics(plan,routines,checks,userId){
    const pr=routines.filter(r=>r.plan_id===plan.id&&r.is_active!==false),pc=checks.filter(c=>c.plan_id===plan.id&&c.user_id===userId);
    let planned=0,completed=0,due=0,earned=0;const units=new Set();
    for(const r of pr){
      const value=Number(r.target_value??1)||1;if(r.target_unit)units.add(r.target_unit);
      planned+=plannedOccurrences(plan,r)*value;due+=dueOccurrences(plan,r);
      for(const c of pc.filter(x=>x.routine_id===r.id)){const score=Math.max(0,Math.min(1,Number(c.compliance_score||0)));completed+=score*value;earned+=score;}
    }
    return {target:planned?Math.min(100,Math.round(completed/planned*100)):0,compliance:due?Math.min(100,Math.round(earned/due*100)):0,completed,planned,unit:units.size===1?[...units][0]:(pr.length?"units":"")};
  }

  async function loadData(){
    const {data:{user}}=await db.auth.getUser();if(!user)return null;const since=new Date();since.setFullYear(since.getFullYear()-2);
    const q=await Promise.all([
      db.from("goals").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      db.from("life_plans").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      db.from("plan_routines").select("*").eq("user_id",user.id),
      db.from("plan_checkins").select("*").eq("user_id",user.id).gte("scheduled_for",isoDate(since))
    ]);
    if(q.some(x=>x.error))return null;return {user,goals:q[0].data||[],plans:q[1].data||[],routines:q[2].data||[],checks:q[3].data||[]};
  }

  function ensurePlannerTargetBox(grid){
    let box=grid.querySelector(".pgp-target-box");
    if(!box){box=document.createElement("div");box.className="lm-plan-summary-box pgp-target-box";box.dataset.pceBox="target-progress";box.innerHTML="<small>Target progress</small><strong>0%</strong><div class=\"pgp-metric-note\">—</div>";grid.appendChild(box);}
    let small=box.querySelector("small");if(!small){small=document.createElement("small");box.prepend(small);}
    let strong=box.querySelector("strong");if(!strong){strong=document.createElement("strong");box.appendChild(strong);}
    let note=box.querySelector(".pgp-metric-note,.pce-note");if(!note){note=document.createElement("div");note.className="pgp-metric-note";box.appendChild(note);}
    return {box,small,strong,note};
  }

  function enhancePlanner(data){
    for(const card of $$(".lm-plan-card").filter(c=>c.querySelector("[data-share],[data-delete]"))){
      const action=card.querySelector("[data-share],[data-delete]"),id=action?.dataset.share||action?.dataset.delete,plan=data.plans.find(p=>p.id===id);if(!plan)continue;
      const m=planMetrics(plan,data.routines,data.checks,data.user.id),grid=card.querySelector(".lm-plan-summary-grid");
      if(grid){const t=ensurePlannerTargetBox(grid),amount=m.planned?`${Number(m.completed.toFixed(1))}/${Number(m.planned.toFixed(1))}${m.unit?` ${m.unit}`:""}`:"—";setText(t.small,"Target progress");setText(t.strong,`${m.target}%`);setText(t.note,amount);}
      const score=card.querySelector(".lm-score");if(score&&!score.querySelector(".pgp-compliance-note")){const note=document.createElement("div");note.className="pgp-metric-note pgp-compliance-note";note.textContent="Compliance = what was due so far";score.appendChild(note);}
    }
  }

  function goalId(card){const b=card.querySelector("[data-gpb-edit],[data-gpb-create-plan],[data-gpb-link],[data-gpb-progress]");return b?.dataset.gpbEdit||b?.dataset.gpbCreatePlan||b?.dataset.gpbLink||b?.dataset.gpbProgress||"";}

  function enhanceGoals(data){
    const cards=$$(".gpb-card");if(!cards.length)return;let effectiveSum=0;
    for(const card of cards){
      const goal=data.goals.find(g=>g.id===goalId(card));if(!goal)continue;
      const linked=data.plans.filter(p=>p.goal_id===goal.id);
      if(!linked.length){effectiveSum+=Number(goal.progress||0);continue;}
      const pm=linked.map(p=>planMetrics(p,data.routines,data.checks,data.user.id)),totalPlanned=pm.reduce((s,m)=>s+m.planned,0),totalCompleted=pm.reduce((s,m)=>s+m.completed,0);
      const target=totalPlanned?Math.min(100,Math.round(totalCompleted/totalPlanned*100)):0;
      const due=linked.reduce((s,p)=>s+data.routines.filter(r=>r.plan_id===p.id&&r.is_active!==false).reduce((a,r)=>a+dueOccurrences(p,r),0),0);
      const earned=linked.reduce((s,p)=>s+data.routines.filter(r=>r.plan_id===p.id&&r.is_active!==false).reduce((a,r)=>a+data.checks.filter(c=>c.plan_id===p.id&&c.routine_id===r.id&&c.user_id===data.user.id).reduce((x,c)=>x+Math.max(0,Math.min(1,Number(c.compliance_score||0))),0),0),0);
      const compliance=due?Math.min(100,Math.round(earned/due*100)):0,hasOutcome=Boolean(String(goal.success_measure||"").trim());
      effectiveSum+=hasOutcome?Number(goal.progress||0):target;

      const metrics=card.querySelector(".gpb-metrics");if(metrics){metrics.classList.toggle("pgp-three",hasOutcome);const html=hasOutcome
        ? `<div class="gpb-metric"><div><span>Outcome progress</span><b>${Number(goal.progress||0)}%</b></div><div class="gpb-track"><i style="width:${Number(goal.progress||0)}%"></i></div></div><div class="gpb-metric"><div><span>Target progress</span><b>${target}%</b></div><div class="gpb-track"><i style="width:${target}%"></i></div><div class="pgp-metric-note">How much of the full plan target is completed</div></div><div class="gpb-metric"><div><span>Plan compliance</span><b>${compliance}%</b></div><div class="gpb-track"><i style="width:${compliance}%"></i></div><div class="pgp-metric-note">How much of what was due so far was done</div></div>`
        : `<div class="gpb-metric"><div><span>Goal / target progress</span><b>${target}%</b></div><div class="gpb-track"><i style="width:${target}%"></i></div><div class="pgp-metric-note">Auto-calculated from linked plan target</div></div><div class="gpb-metric"><div><span>Plan compliance</span><b>${compliance}%</b></div><div class="gpb-track"><i style="width:${compliance}%"></i></div><div class="pgp-metric-note">How consistently you completed what was due</div></div>`;setHTML(metrics,html);}

      const success=card.querySelector(".gpb-success");if(success&&!hasOutcome){setHTML(success,"<b>Progress source:</b> Linked plan target automatically drives this goal.");if(!card.querySelector(".pgp-goal-auto")){const auto=document.createElement("div");auto.className="pgp-goal-auto";auto.textContent="Goal progress now updates automatically from your linked plan. Compliance stays separate.";success.insertAdjacentElement("afterend",auto);}}

      const rows=$$(".gpb-plan",card);linked.forEach((p,i)=>{const row=rows[i];if(!row)return;const m=planMetrics(p,data.routines,data.checks,data.user.id),right=row.lastElementChild;if(right)setHTML(right,`<div class="pgp-plan-values"><span><b>${m.target}%</b> target</span><span><b>${m.compliance}%</b> compliance</span></div>`);});
      const progressBtn=card.querySelector("[data-gpb-progress]");if(progressBtn&&!hasOutcome)setText(progressBtn,"Add outcome measure");
    }

    const summary=$$(".gpb-summary article");if(summary[2]){setText(summary[2].querySelector("small"),"Goal progress");setText(summary[2].querySelector("strong"),`${data.goals.length?Math.round(effectiveSum/data.goals.length):0}%`);}
  }

  async function enhance(){
    if(busy)return;if(!$('.nav-item[data-screen="planner"].active,.mobile-nav-item[data-screen="planner"].active,.nav-item[data-screen="goals"].active,.mobile-nav-item[data-screen="goals"].active'))return;
    busy=true;try{const data=await loadData();if(!data)return;enhancePlanner(data);enhanceGoals(data);}catch(e){console.warn("Plan/goal progress enhancement skipped",e);}finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,180);}
  function init(){styleOnce();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});document.addEventListener("click",e=>{if(e.target.closest('[data-screen="goals"],[data-screen="planner"],[data-tab="plans"],[data-check],[data-multi-check],[data-gpb-link]'))setTimeout(enhance,220);},true);document.addEventListener("medora:plan-range-updated",()=>setTimeout(enhance,200));schedule();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();