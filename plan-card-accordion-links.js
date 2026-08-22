(() => {
  "use strict";
  if (window.__MEDORA_PLAN_CARD_ACCORDION_LINKS__) return;
  window.__MEDORA_PLAN_CARD_ACCORDION_LINKS__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const STORE_PLAN = "medora.planAccordion.open";
  const STORE_GOAL = "medora.goalAccordion.open";
  const STORE_TAB = "medora.lifeMindTab";
  const STORE_SCREEN = "medora.lastScreen";
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  let cache = { user:null, plans:[], goals:[], at:0 };
  let loading = null;
  let timer = null;

  function safeGet(k, fallback="") { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } }
  function safeSet(k,v) { try { if (v) localStorage.setItem(k,String(v)); else localStorage.removeItem(k); } catch {} }
  function esc(v="") { return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function addStyles() {
    if ($("#medoraPlanAccordionLinksStyle")) return;
    const s = document.createElement("style");
    s.id = "medoraPlanAccordionLinksStyle";
    s.textContent = `
      .lm-plan-card.pca-card{position:relative;overflow:hidden;padding:0;border-radius:18px;transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease}
      .lm-plan-card.pca-card:hover{border-color:#d4dbe8;box-shadow:0 9px 28px rgba(30,43,72,.06)}
      .lm-plan-card.pca-card.is-open{border-color:#cfd8ec;box-shadow:0 14px 36px rgba(30,43,72,.08)}
      .pca-card .lm-plan-top{min-height:88px;padding:15px 17px;cursor:pointer;user-select:none;background:linear-gradient(100deg,#f7f9ff,#fff 38%,#fff);border-bottom:1px solid transparent;transition:background .2s ease,border-color .2s ease}
      .pca-card.is-open .lm-plan-top{border-bottom-color:#edf0f5;background:linear-gradient(100deg,#f2f6ff,#fff 44%,#fff)}
      .pca-card .lm-plan-title{min-width:0;align-items:center}
      .pca-card .lm-plan-title>div{min-width:0}
      .pca-card .lm-plan-title strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pca-top-links{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px}
      .pca-goal-link{min-height:25px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid #dde4fb;border-radius:999px;background:#f1f4ff;color:#5268d5;font-size:8px;font-weight:850;cursor:pointer}
      .pca-goal-link:hover{background:#e9eeff}
      .pca-target-mini{display:inline-flex;align-items:center;gap:4px;min-height:25px;padding:0 8px;border-radius:999px;background:#f3f6f9;color:#6c778b;font-size:8px;font-weight:800}
      .pca-toggle{width:34px;height:34px;flex:0 0 auto;display:grid;place-items:center;margin-left:8px;border:0;border-radius:10px;background:#f0f3f8;color:#6d788d;font-size:18px;cursor:pointer;transition:transform .22s ease,background .22s ease,color .22s ease}
      .pca-card.is-open .pca-toggle{transform:rotate(180deg);background:#edf1ff;color:#596fdc}
      .pca-details{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .28s ease,opacity .18s ease}
      .pca-details-inner{min-height:0;overflow:hidden;padding:0 16px}
      .pca-card.is-open .pca-details{grid-template-rows:1fr;opacity:1}
      .pca-card.is-open .pca-details-inner{padding:0 16px 16px}
      .pca-card.is-open .pca-details-inner>.lm-progress:first-child{margin-top:14px}
      .pca-existing-goal-link{cursor:pointer!important;outline:none}
      .pca-existing-goal-link:hover{filter:brightness(.97);box-shadow:0 0 0 2px rgba(82,104,213,.08)}
      .pca-focus{animation:pcaPulse 1.25s ease 1}
      @keyframes pcaPulse{0%,100%{box-shadow:0 14px 36px rgba(30,43,72,.08)}45%{box-shadow:0 0 0 5px rgba(96,121,232,.14),0 18px 42px rgba(30,43,72,.11)}}

      .gpl-plan-count{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 8px;border:1px solid #dde4fb;border-radius:999px;background:#f2f5ff;color:#5268d5;font-size:8px;font-weight:850}
      button.gpl-plan-count{cursor:pointer}
      button.gpl-plan-count:hover{background:#e9eeff}
      .gpb-plan.gpl-linked-plan{position:relative;cursor:pointer;border:1px solid transparent;transition:background .18s ease,border-color .18s ease,transform .18s ease}
      .gpb-plan.gpl-linked-plan:hover{background:#f0f4ff;border-color:#dbe3fb;transform:translateY(-1px)}
      .gpl-link-label{display:inline-flex!important;align-items:center;gap:5px;width:max-content;margin:0 0 5px!important;padding:3px 6px;border-radius:999px;background:#eaf0ff;color:#566bd7!important;font-size:7px!important;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
      .gpl-open-cue{display:inline-flex!important;align-items:center;gap:4px;width:max-content;margin-top:6px!important;color:#5268d5!important;font-size:8px!important;font-weight:850}
      .gpl-linked-plan:focus-visible{outline:3px solid rgba(88,111,218,.16);outline-offset:2px}
      @media(max-width:620px){
        .pca-card .lm-plan-top{min-height:82px;padding:13px 14px}
        .pca-card .lm-plan-title strong{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .pca-card .lm-score{margin-left:auto}
        .pca-toggle{width:31px;height:31px;margin-left:5px}
        .pca-details-inner,.pca-card.is-open .pca-details-inner{padding-left:13px;padding-right:13px}
        .gpb-plan.gpl-linked-plan{align-items:flex-start}
      }
    `;
    document.head.appendChild(s);
  }

  function plannerActive() {
    return !!document.querySelector('.nav-item[data-screen="planner"].active,.mobile-nav-item[data-screen="planner"].active');
  }
  function goalsActive() {
    return !!document.querySelector('.nav-item[data-screen="goals"].active,.mobile-nav-item[data-screen="goals"].active');
  }

  async function loadData(force=false) {
    if (!force && cache.user && Date.now()-cache.at < 15000) return cache;
    if (loading) return loading;
    loading = (async()=>{
      const {data:{user}} = await db.auth.getUser();
      if (!user) return cache;
      const [plansRes,goalsRes] = await Promise.all([
        db.from("life_plans").select("id,title,goal_id,category,status,created_at,user_id").eq("user_id",user.id).order("created_at",{ascending:false}),
        db.from("goals").select("id,title,status,created_at,user_id").eq("user_id",user.id).order("created_at",{ascending:false})
      ]);
      if (plansRes.error || goalsRes.error) {
        console.warn("Plan/goal navigation enhancement skipped", plansRes.error || goalsRes.error);
        return cache;
      }
      cache = {user,plans:plansRes.data||[],goals:goalsRes.data||[],at:Date.now()};
      return cache;
    })().finally(()=>{ loading=null; });
    return loading;
  }

  function planId(card) {
    if (!card) return "";
    if (card.dataset.pcaPlanId) return card.dataset.pcaPlanId;
    const share = card.querySelector("[data-share]")?.dataset.share;
    const del = card.querySelector("[data-delete]")?.dataset.delete;
    return share || del || "";
  }

  function goalId(card) {
    const b = card?.querySelector("[data-gpb-edit],[data-gpb-create-plan],[data-gpb-progress],[data-gpb-link]");
    return b?.dataset.gpbEdit || b?.dataset.gpbCreatePlan || b?.dataset.gpbProgress || b?.dataset.gpbLink || "";
  }

  function findPlanCard(id) {
    return $$(".lm-plan-card").find(c => planId(c) === id) || null;
  }
  function findGoalCard(id) {
    return $$(".gpb-card").find(c => goalId(c) === id) || null;
  }

  function setPlanOpen(card,open,persist=true) {
    if (!card) return;
    card.classList.toggle("is-open",open);
    card.querySelector(".lm-plan-top")?.setAttribute("aria-expanded",String(open));
    const t = card.querySelector(".pca-toggle");
    if (t) { t.setAttribute("aria-expanded",String(open)); t.title = open ? "Collapse plan" : "Open plan details"; }
    if (persist) safeSet(STORE_PLAN,open?planId(card):"");
  }

  function closeOtherPlans(except) {
    $$(".lm-plan-card.pca-card.is-open").forEach(c=>{ if(c!==except)setPlanOpen(c,false,false); });
  }

  function togglePlan(card) {
    const open = !card.classList.contains("is-open");
    closeOtherPlans(open?card:null);
    setPlanOpen(card,open,true);
  }

  function wrapPlanDetails(card) {
    if (card.querySelector(":scope > .pca-details")) return true;
    const top = card.querySelector(":scope > .lm-plan-top");
    if (!top || !card.querySelector(".lm-plan-extra")) return false;
    const nodes = [...card.children].filter(n=>n!==top && !n.classList.contains("pca-details"));
    const outer = document.createElement("div"); outer.className="pca-details";
    const inner = document.createElement("div"); inner.className="pca-details-inner";
    nodes.forEach(n=>inner.appendChild(n)); outer.appendChild(inner); card.appendChild(outer);
    return true;
  }

  function linkedGoal(plan,data) {
    return plan?.goal_id ? data.goals.find(g=>g.id===plan.goal_id) || null : null;
  }

  function refreshPlanHeader(card,plan,data) {
    const titleBox = card.querySelector(".lm-plan-title > div");
    if (!titleBox) return;
    let links = titleBox.querySelector(".pca-top-links");
    if (!links) { links=document.createElement("div"); links.className="pca-top-links"; titleBox.appendChild(links); }
    links.innerHTML="";
    const goal = linkedGoal(plan,data);
    if (goal) {
      const b=document.createElement("button");
      b.type="button"; b.className="pca-goal-link"; b.dataset.pcaGoal=goal.id;
      b.innerHTML=`<span>🎯</span><span>Goal: ${esc(goal.title)}</span>`;
      b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openExactGoal(goal.id);});
      links.appendChild(b);
    }
    const target = card.querySelector(".pgp-target-box strong")?.textContent?.trim();
    if (target) {
      const m=document.createElement("span"); m.className="pca-target-mini"; m.textContent=`Target ${target}`; links.appendChild(m);
    }

    const oldChip = card.querySelector(".gpb-goal-chip");
    if (oldChip && goal && !oldChip.dataset.pcaBound) {
      oldChip.dataset.pcaBound="1";
      oldChip.classList.add("pca-existing-goal-link");
      oldChip.setAttribute("role","button"); oldChip.setAttribute("tabindex","0");
      const go=()=>openExactGoal(goal.id);
      oldChip.addEventListener("click",e=>{e.stopPropagation();go();});
      oldChip.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
    }
  }

  function enhancePlanCard(card,data) {
    const id=planId(card); if(!id) return;
    const plan=data.plans.find(p=>p.id===id); if(!plan) return;
    card.dataset.pcaPlanId=id;
    if (!wrapPlanDetails(card)) return;
    if (!card.classList.contains("pca-card")) {
      card.classList.add("pca-card");
      const top=card.querySelector(":scope > .lm-plan-top");
      top.setAttribute("role","button"); top.setAttribute("tabindex","0"); top.setAttribute("aria-expanded","false");
      if (!top.querySelector(".pca-toggle")) {
        const b=document.createElement("button"); b.type="button"; b.className="pca-toggle"; b.innerHTML="⌄"; b.setAttribute("aria-label","Open plan details"); top.appendChild(b);
      }
      top.addEventListener("click",e=>{
        if(e.target.closest(".pca-goal-link"))return;
        if(e.target.closest(".pca-toggle"))e.preventDefault();
        togglePlan(card);
      });
      top.addEventListener("keydown",e=>{
        if(e.target.closest(".pca-goal-link"))return;
        if(e.key==="Enter"||e.key===" "){e.preventDefault();togglePlan(card);}
      });
    }
    refreshPlanHeader(card,plan,data);
    const wanted=safeGet(STORE_PLAN,"");
    setPlanOpen(card,wanted===id,false);
  }

  async function enhancePlans() {
    if(!plannerActive()) return;
    const data=await loadData();
    const cards=$$(".lm-plan-card").filter(c=>c.querySelector("[data-share],[data-delete]"));
    if(!cards.length)return;
    cards.forEach(c=>enhancePlanCard(c,data));
  }

  function decorateGoalRow(row,plan) {
    if(!row||!plan)return;
    row.classList.add("gpl-linked-plan"); row.dataset.gplPlan=plan.id;
    row.setAttribute("role","button"); row.setAttribute("tabindex","0");
    row.setAttribute("aria-label",`Open linked plan ${plan.title}`);
    const left=row.firstElementChild;
    if(left && !left.querySelector(".gpl-link-label")) {
      const lab=document.createElement("span"); lab.className="gpl-link-label"; lab.textContent="▦ Linked plan"; left.insertBefore(lab,left.firstChild);
    }
    if(left && !left.querySelector(".gpl-open-cue")) {
      const cue=document.createElement("span"); cue.className="gpl-open-cue"; cue.textContent="Open this plan →"; left.appendChild(cue);
    }
    if(!row.dataset.gplBound){
      row.dataset.gplBound="1";
      const go=()=>openExactPlan(plan.id);
      row.addEventListener("click",e=>{ if(e.target.closest("button,a,input,select,textarea"))return; go(); });
      row.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest("button,a,input,select,textarea")){e.preventDefault();go();}});
    }
  }

  function addGoalPlanCount(card,linked) {
    const titleBox=card.querySelector(".gpb-title > div"); if(!titleBox)return;
    let old=titleBox.querySelector(".gpl-plan-count"); if(old)old.remove();
    if(!linked.length)return;
    const el=document.createElement(linked.length===1?"button":"span");
    if(el.tagName==="BUTTON")el.type="button";
    el.className="gpl-plan-count";
    el.innerHTML=`<span>▦</span><span>${linked.length} linked plan${linked.length===1?"":"s"}</span>`;
    const mini=titleBox.querySelector(".gca-mini-metrics");
    if(mini)mini.insertAdjacentElement("afterend",el); else titleBox.appendChild(el);
    if(linked.length===1){
      el.title=`Open ${linked[0].title}`;
      el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openExactPlan(linked[0].id);});
    }
  }

  async function enhanceGoals() {
    if(!goalsActive())return;
    const data=await loadData();
    const cards=$$(".gpb-card");
    if(!cards.length)return;
    for(const card of cards){
      const gid=goalId(card); if(!gid)continue;
      const linked=data.plans.filter(p=>p.goal_id===gid);
      addGoalPlanCount(card,linked);
      const rows=$$(".gpb-plan",card);
      linked.forEach((p,i)=>decorateGoalRow(rows[i],p));
    }
  }

  function clickPlannerNav(){
    const visible=$$('.nav-item[data-screen="planner"],.mobile-nav-item[data-screen="planner"]').find(x=>x.offsetParent!==null);
    (visible||$('.nav-item[data-screen="planner"],.mobile-nav-item[data-screen="planner"]'))?.click();
  }
  function clickGoalsNav(){
    const visible=$$('.nav-item[data-screen="goals"],.mobile-nav-item[data-screen="goals"]').find(x=>x.offsetParent!==null);
    (visible||$('.nav-item[data-screen="goals"],.mobile-nav-item[data-screen="goals"]'))?.click();
  }

  function openExactPlan(id){
    safeSet(STORE_PLAN,id); safeSet(STORE_TAB,"plans"); safeSet(STORE_SCREEN,"planner");
    clickPlannerNav();
    let tries=0;
    const seek=()=>{
      tries++;
      const tab=$('[data-tab="plans"]'); if(tab&&!tab.classList.contains("active"))tab.click();
      const card=findPlanCard(id);
      if(card&&card.querySelector(".lm-plan-extra")){
        loadData().then(data=>{
          enhancePlanCard(card,data); closeOtherPlans(card); setPlanOpen(card,true,false);
          card.classList.remove("pca-focus"); void card.offsetWidth; card.classList.add("pca-focus");
          const topbar=$(".topbar")?.getBoundingClientRect().height||0;
          const y=card.getBoundingClientRect().top+window.scrollY-topbar-12;
          window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
        });
        return;
      }
      if(tries<35)setTimeout(seek,120);
    };
    setTimeout(seek,120);
  }

  function openExactGoal(id){
    safeSet(STORE_GOAL,id); safeSet(STORE_SCREEN,"goals"); clickGoalsNav();
    let tries=0;
    const seek=()=>{
      tries++;
      const card=findGoalCard(id);
      if(card){
        if(!card.classList.contains("is-open"))card.querySelector(".gca-toggle")?.click();
        const topbar=$(".topbar")?.getBoundingClientRect().height||0;
        const y=card.getBoundingClientRect().top+window.scrollY-topbar-12;
        window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
        return;
      }
      if(tries<30)setTimeout(seek,120);
    };
    setTimeout(seek,120);
  }

  async function enhanceAll(){
    try{ await Promise.all([enhancePlans(),enhanceGoals()]); }
    catch(e){ console.warn("Plan accordion/link enhancement skipped",e); }
  }

  function schedule(){ clearTimeout(timer); timer=setTimeout(enhanceAll,180); }
  function init(){
    addStyles();
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    document.addEventListener("click",e=>{
      if(e.target.closest('[data-screen="planner"],[data-screen="goals"],[data-tab="plans"],[data-gpb-link],[data-gpb-create-plan],[data-gpb-edit],[data-gpb-progress]'))setTimeout(()=>{cache.at=0;schedule();},180);
    },true);
    schedule();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
