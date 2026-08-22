(() => {
  "use strict";
  if (window.__MEDORA_PLAN_UPDATE_REFLECTION__) return;
  window.__MEDORA_PLAN_UPDATE_REFLECTION__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const PENDING = "medora.pendingPlanReflection";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let currentPlanId = null, timer = null;
  const beforeByPlan = new Map();

  function addStyles(){
    if($("#planUpdateReflectionStyle"))return;
    const s=document.createElement("style");s.id="planUpdateReflectionStyle";s.textContent=`
      .pur-hidden{display:none!important}
      .pur-update-btn{min-height:35px;padding:0 12px;border:0;border-radius:10px;background:#edf0ff;color:#5268d5;font-size:10px;font-weight:850;cursor:pointer}
      .pur-row-update{min-height:30px;padding:0 9px;border:1px solid #dfe5f7;border-radius:9px;background:#fff;color:#5268d5;font-size:9px;font-weight:850;cursor:pointer}
      .pur-reflection{display:grid;gap:9px;padding:15px;border:1px solid #dfe5f4;border-radius:16px;background:linear-gradient(145deg,#f8fbff,#fbf9ff)}
      .pur-reflection h3{margin:0;font-size:15px}.pur-reflection p{margin:0;color:#7b8699;font-size:9px;line-height:1.5}
      .pur-reflection textarea{min-height:92px!important}
      .pur-preview{padding:11px 12px;border-radius:12px;background:#fff;border:1px solid #e4e9f1}
      .pur-preview small,.pur-preview strong,.pur-preview span{display:block}.pur-preview small{color:#8791a3;font-size:8px;font-weight:900;letter-spacing:.07em}.pur-preview strong{margin-top:4px;color:#3d4960;font-size:11px}.pur-preview span{margin-top:4px;color:#69758a;font-size:9px;line-height:1.5}
      .pur-last{display:grid;gap:4px;margin-top:10px;padding:11px 12px;border-radius:12px;background:#f7f9fd;border:1px solid #edf0f5}
      .pur-last small{color:#8892a4;font-size:8px;font-weight:850;letter-spacing:.06em}.pur-last strong{font-size:10px;color:#455168}.pur-last p{margin:0;color:#6f7a8e;font-size:9px;line-height:1.45}
      .pur-linked-label{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:4px 7px;border-radius:999px;background:#eef1ff;color:#596ed7;font-size:8px;font-weight:850}
    `;document.head.appendChild(s);
  }

  function safeGet(){try{return JSON.parse(localStorage.getItem(PENDING)||"null")}catch{return null}}
  function safeSet(v){try{if(v)localStorage.setItem(PENDING,JSON.stringify(v));else localStorage.removeItem(PENDING)}catch{}}
  function token(){try{return crypto.randomUUID()}catch{return `${Date.now()}-${Math.random().toString(16).slice(2)}`}}
  function norm(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
  function has(t,words){return words.some(w=>t.includes(w))}

  function classify(reason){
    const t=norm(reason);
    if(has(t,["typo","mistake","wrong","correction","accident","غلط","خطأ","تصحيح"]))return {category:"correction",label:"Simple correction",text:"This looks like a correction rather than a loss of commitment. Medora will preserve the history and treat the new version as the intended plan."};
    if(has(t,["sick","ill","pain","injury","recover","recovery","tired physically","مرض","مريض","تعبان","اصابة","إصابة","تعافي"]))return {category:"recovery_health",label:"Recovery / health",text:"Recovery or health is affecting execution. Adjusting the plan temporarily is more useful than treating recovery as failure."};
    if(has(t,["travel","trip","holiday","vacation","سفر","مسافر","رحلة","اجازة","إجازة"]))return {category:"travel_disruption",label:"Travel / disruption",text:"The plan is colliding with travel or a temporary disruption. A temporary version of the routine may work better than abandoning it."};
    if(has(t,["exam","deadline","priority","urgent","family","project","another goal","امتحان","أولوية","اولوية","مشروع","عيلة","أسرة"]))return {category:"competing_priority",label:"Competing priority",text:"Another priority is competing for the same time or attention. Re-rank the week instead of expecting both commitments to run at full intensity."};
    if(has(t,["busy","no time","work","shift","late","meeting","schedule","timing","وقت","مشغول","شغل","نوبتجية","نوبتشيه","ميعاد","جدول"]))return {category:"schedule_conflict",label:"Schedule / timing conflict",text:"Your reason points to a timing conflict. Medora will treat this as a scheduling problem first—move the routine before shrinking the goal itself."};
    if(has(t,["too much","too hard","hard","difficult","ambitious","unrealistic","many","كتير","صعب","طموح زيادة","مش واقعي","غير واقعي"]))return {category:"too_ambitious",label:"Plan too ambitious",text:"The plan may have been harder to sustain than expected. A smaller repeatable target can improve consistency without changing the destination."};
    if(has(t,["lazy","laziness","motivation","unmotivated","energy","procrast","didn't feel","dont feel","don't feel","كسل","كسلان","مكسل","مش متحمس","طاقة","تسويف","مش قادر"]))return {category:"low_energy_motivation",label:"Motivation / energy friction",text:"You described motivation or energy friction. Medora treats that as a plan-design signal, not a character judgment—make the next version easier to start or move it to a better time."};
    if(has(t,["goal changed","changed my goal","not important anymore","no longer","غيرت الهدف","الهدف اتغير","مش مهم"]))return {category:"changed_goal",label:"Goal changed",text:"The destination itself may be changing. Medora will keep this separate from ordinary compliance so a changed priority is not mistaken for poor execution."};
    return {category:"other",label:"Context saved",text:"Medora saved this context. Repeated reasons over time can reveal the pattern behind your plan changes and improve future recommendations."};
  }

  function cleanPlan(p){if(!p)return{};return {id:p.id,title:p.title,description:p.description,category:p.category,start_date:p.start_date,end_date:p.end_date,goal_id:p.goal_id,visibility:p.visibility,status:p.status,updated_at:p.updated_at}}
  function cleanRoutine(r){return {id:r.id,title:r.title,target_value:r.target_value,target_unit:r.target_unit,due_time:r.due_time,days_of_week:r.days_of_week,schedule_type:r.schedule_type,is_active:r.is_active}}
  function snapshot(plan,routines){return {plan:cleanPlan(plan),routines:(routines||[]).map(cleanRoutine)}}
  function summary(before,after){
    const out={plan_fields:[],routine_changes:[]},a=before?.plan||{},b=after?.plan||{};
    ["title","description","category","start_date","end_date","goal_id","visibility","status"].forEach(k=>{if(JSON.stringify(a[k]??null)!==JSON.stringify(b[k]??null))out.plan_fields.push(k)});
    const bm=new Map((before?.routines||[]).map(r=>[r.id,r]));
    for(const r of after?.routines||[]){const old=bm.get(r.id);if(!old){out.routine_changes.push({id:r.id,type:"added"});continue}const fields=[];["title","target_value","target_unit","due_time","days_of_week","schedule_type","is_active"].forEach(k=>{if(JSON.stringify(old[k]??null)!==JSON.stringify(r[k]??null))fields.push(k)});if(fields.length)out.routine_changes.push({id:r.id,type:"updated",fields})}
    return out;
  }

  async function loadPlanSnapshot(planId){
    const {data:{user}}=await db.auth.getUser();if(!user)return null;
    const [p,r]=await Promise.all([db.from("life_plans").select("*").eq("id",planId).eq("user_id",user.id).maybeSingle(),db.from("plan_routines").select("*").eq("plan_id",planId).eq("user_id",user.id).order("created_at")]);
    if(p.error||!p.data||r.error)return null;return {user,plan:p.data,routines:r.data||[],snap:snapshot(p.data,r.data||[])};
  }

  async function flushPending(){
    const pending=safeGet();if(!pending)return;
    if(Date.now()-Number(pending.submitted_at||0)>10*60*1000){safeSet(null);return}
    const data=await loadPlanSnapshot(pending.plan_id);if(!data)return;
    const updated=new Date(data.plan.updated_at||0).getTime();
    if(updated+1500<Number(pending.submitted_at||0))return;
    const analysis=classify(pending.reason_text);
    const payload={user_id:data.user.id,plan_id:data.plan.id,goal_id:data.plan.goal_id||pending.goal_id||null,reason_text:pending.reason_text,reason_category:analysis.category,analysis_text:analysis.text,analysis_source:"rules_v1",change_summary:summary(pending.before_snapshot||{},data.snap),before_snapshot:pending.before_snapshot||{},after_snapshot:data.snap,client_token:pending.client_token};
    const ins=await db.from("plan_change_reflections").insert(payload);
    if(!ins.error||ins.error?.code==="23505")safeSet(null);else console.warn("Plan reflection save skipped",ins.error);
  }

  function preview(host,reason){
    const box=$(".pur-preview",host);if(!box)return;const a=classify(reason);
    box.innerHTML=`<small>MEDORA REFLECTION</small><strong>${esc(a.label)}</strong><span>${esc(a.text)}</span>`;
  }

  async function augmentEditor(host,planId){
    if(!host||host.dataset.purDone||!planId)return;host.dataset.purDone="1";host.dataset.purPlan=planId;
    const data=await loadPlanSnapshot(planId);if(!data)return;beforeByPlan.set(planId,data.snap);
    const head=$(".pe-head",host);if(head){const h=head.querySelector("h2"),p=head.querySelector("p");if(h)h.textContent="Update this plan.";if(p)p.textContent="Adjust the plan, and tell Medora why so it can learn what helps or blocks your consistency."}
    const form=$("#peForm",host),warning=$(".pe-warning",host);if(!form||form.querySelector("#purReason"))return;
    const section=document.createElement("section");section.className="pur-reflection";section.innerHTML=`<div><h3>Why are you changing this plan?</h3><p>Write naturally. This context is saved with the change so Medora can learn whether the issue was timing, ambition, energy, another priority, recovery, travel, or something else.</p></div><label>What happened?<textarea id="purReason" required minlength="2" maxlength="4000" placeholder="Example: I keep missing this after work because I am exhausted, so I want to move it earlier."></textarea><span class="pe-hint">Be candid. Medora analyzes the friction, not your character.</span></label><div class="pur-preview"><small>MEDORA REFLECTION</small><strong>Waiting for your reason</strong><span>Your words will help Medora understand why this version of the plan needs to change.</span></div>`;
    if(warning)warning.insertAdjacentElement("beforebegin",section);else form.querySelector(".pe-actions")?.insertAdjacentElement("beforebegin",section);
    const ta=$("#purReason",section);ta?.addEventListener("input",()=>preview(section,ta.value));
    form.addEventListener("submit",()=>{
      const reason=ta?.value.trim()||"";if(reason.length<2)return;
      safeSet({client_token:token(),plan_id:planId,goal_id:$("#peGoal",form)?.value||data.plan.goal_id||null,reason_text:reason,before_snapshot:beforeByPlan.get(planId)||data.snap,submitted_at:Date.now()});
    },true);
  }

  async function loadGoalLinks(){
    const {data:{user}}=await db.auth.getUser();if(!user)return null;
    const [g,p]=await Promise.all([db.from("goals").select("id,title,status,success_measure").eq("user_id",user.id),db.from("life_plans").select("id,title,goal_id,status").eq("user_id",user.id).order("created_at",{ascending:false})]);
    if(g.error||p.error)return null;return {goals:g.data||[],plans:p.data||[]};
  }

  function goalId(card){const b=card.querySelector("[data-gpb-edit]");return b?.dataset.gpbEdit||""}
  function applyGoalTerminology(card,linked){
    const actions=$(".gpb-row-actions",card);if(!actions)return;
    const create=actions.querySelector("[data-gpb-create-plan]"),link=actions.querySelector("[data-gpb-link]");
    create?.classList.toggle("pur-hidden",linked.length>0);link?.classList.toggle("pur-hidden",linked.length>0);
    let update=actions.querySelector("[data-pur-update-linked]");
    if(!linked.length){update?.remove();return}
    if(!update){update=document.createElement("button");update.type="button";update.className="pur-update-btn";update.dataset.purUpdateLinked="1";actions.insertBefore(update,actions.firstChild)}
    if(linked.length===1){update.textContent="Update this plan";update.dataset.editPlan=linked[0].id;delete update.dataset.purManage}
    else{update.textContent="Manage linked plans";delete update.dataset.editPlan;update.dataset.purManage="1"}
    const rows=$$(".gpb-plan",card);
    linked.forEach((p,i)=>{const row=rows[i];if(!row)return;let b=row.querySelector(".pur-row-update");if(!b){b=document.createElement("button");b.type="button";b.className="pur-row-update";row.appendChild(b)}b.dataset.editPlan=p.id;b.textContent="Update plan"});
  }

  async function enhanceGoalActions(){
    const cards=$$(".gpb-card");if(!cards.length)return;const data=await loadGoalLinks();if(!data)return;
    cards.forEach(card=>{const gid=goalId(card);if(!gid)return;applyGoalTerminology(card,data.plans.filter(p=>p.goal_id===gid))});
  }

  async function decoratePlanReflections(){
    const cards=$$(".lm-plan-card").filter(c=>c.querySelector("[data-share],[data-delete]"));if(!cards.length)return;
    const ids=cards.map(c=>c.querySelector("[data-share]")?.dataset.share||c.querySelector("[data-delete]")?.dataset.delete).filter(Boolean);if(!ids.length)return;
    const q=await db.from("plan_change_reflections").select("plan_id,reason_text,reason_category,analysis_text,created_at").in("plan_id",ids).order("created_at",{ascending:false});if(q.error)return;
    const latest=new Map();(q.data||[]).forEach(r=>{if(!latest.has(r.plan_id))latest.set(r.plan_id,r)});
    cards.forEach(card=>{const id=card.querySelector("[data-share]")?.dataset.share||card.querySelector("[data-delete]")?.dataset.delete,r=latest.get(id);let box=card.querySelector(".pur-last");if(!r){box?.remove();return}if(!box){box=document.createElement("div");box.className="pur-last";const extra=card.querySelector(".lm-plan-extra");if(extra)extra.appendChild(box);else card.querySelector(".lm-card-actions")?.insertAdjacentElement("beforebegin",box)}const label=String(r.reason_category||"other").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());box.innerHTML=`<small>WHY THIS PLAN CHANGED · ${new Date(r.created_at).toLocaleDateString()}</small><strong>${esc(label)}</strong><p>${esc(r.analysis_text||r.reason_text)}</p>`});
  }

  async function enhance(){try{await enhanceGoalActions();await decoratePlanReflections()}catch(e){console.warn("Plan update reflection enhancement skipped",e)}}
  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,220)}

  function bind(){
    addStyles();flushPending().finally(schedule);
    document.addEventListener("click",e=>{
      const edit=e.target.closest("[data-edit-plan]");if(edit)currentPlanId=edit.dataset.editPlan;
      const manage=e.target.closest("[data-pur-manage]");if(manage){e.preventDefault();const card=manage.closest(".gpb-card");card?.querySelector(".gpb-plan")?.scrollIntoView({behavior:"smooth",block:"center"})}
    },true);
    const obs=new MutationObserver(()=>{
      const host=$("#plannerEditModalHost");if(host&&!host.dataset.purDone){const pid=currentPlanId||host.dataset.purPlan;if(pid)augmentEditor(host,pid)}
      schedule();
    });obs.observe(document.body,{childList:true,subtree:true});
    schedule();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
