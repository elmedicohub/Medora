(() => {
  "use strict";
  if (window.__MEDORA_PLAN_ACCOUNTABILITY__) return;
  window.__MEDORA_PLAN_ACCOUNTABILITY__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const CHECK_TIME = "23:00";
  const S = { user:null, plans:[], routines:[], checkins:[], loading:false, loadedAt:0 };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,"0");
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};

  function addStyles(){
    if($("#planAccountabilityStyle")) return;
    const st=document.createElement("style");
    st.id="planAccountabilityStyle";
    st.textContent=`
      .pa-checkin-note{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:5px 8px;border-radius:999px;background:#f0f4ff;color:#5c6fd0;font-size:9px;font-weight:800}
      .pa-checkin-note::before{content:"◷";font-size:12px}
      .pa-multi{min-width:min(470px,100%);display:grid;gap:7px}
      .pa-multi-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#7c8799;font-size:9px;font-weight:800}
      .pa-multi-head strong{color:#344057;font-size:10px}
      .pa-chips{display:flex;gap:6px;flex-wrap:wrap}
      .pa-chip{min-height:35px;display:inline-flex;align-items:center;gap:6px;padding:0 9px;border:1px solid #dfe5ee;border-radius:10px;background:#fff;color:#606b80;font-size:9px;font-weight:800;cursor:pointer;transition:.16s ease}
      .pa-chip:hover{border-color:#b8c4ee;background:#f8f9ff}
      .pa-chip .pa-box{width:18px;height:18px;display:grid;place-items:center;border:1.5px solid #cbd3df;border-radius:6px;background:#fff;color:transparent;font-size:10px;transition:.16s ease}
      .pa-chip.done{border-color:#a8ddcf;background:#f1fbf7;color:#28745e}
      .pa-chip.done .pa-box{border-color:#22a982;background:#22a982;color:#fff}
      .pa-multi-summary{height:4px;overflow:hidden;border-radius:999px;background:#e9edf3}
      .pa-multi-summary span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#18b8aa,#647ff0,#8459e8);transition:width .2s ease}
      .pa-saving{opacity:.58;pointer-events:none}
      @media(max-width:720px){.pa-multi{min-width:100%}.pa-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.pa-chip{justify-content:center;padding:0 6px}.lm-today-card{align-items:flex-start}}
      @media(max-width:430px){.pa-chips{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(st);
  }

  function plannerActive(){return !!$('.nav-item[data-screen="planner"].active,.mobile-nav-item[data-screen="planner"].active')}
  function scheduled(r,d){if(r.is_active===false)return false;const days=Array.isArray(r.days_of_week)?r.days_of_week.map(Number):[];return r.schedule_type==='daily'||days.includes(d.getDay())}
  function expected(plan,routine){const start=parseDate(plan.start_date);if(!start)return 0;const now=new Date();now.setHours(0,0,0,0);const pe=parseDate(plan.end_date);const end=pe&&pe<now?pe:now;if(end<start)return 0;let n=0;for(let d=new Date(start),g=0;d<=end&&g<1000;d=addDays(d,1),g++)if(scheduled(routine,d))n++;return n}

  function repeatInfo(routine,plan){
    const meta=routine.metadata||{};
    let count=Number(meta.daily_check_count||0);
    const unit=String(routine.target_unit||"").trim().toLowerCase();
    const target=Number(routine.target_value||0);
    const discrete=new Set(["prayer","prayers","time","times","dose","doses","session","sessions","set","sets","rep","reps","repetition","repetitions","meal","meals","glass","glasses","pill","pills","medication","medications","act","acts"]);
    const prayer=meta.template_key==='prayers'||plan?.template_key==='prayers'||unit==='prayer'||unit==='prayers'||/five daily prayers|daily prayers/i.test(routine.title||'');
    if(prayer) count=5;
    else if(!count && Number.isInteger(target) && target>=2 && target<=12 && discrete.has(unit)) count=target;
    if(!count || count<2 || count>12) return null;
    let labels=Array.isArray(meta.check_labels)?meta.check_labels.slice(0,count):[];
    if(prayer) labels=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
    while(labels.length<count) labels.push(String(labels.length+1));
    return {count,labels,prayer};
  }

  async function load(force=false){
    if(S.loading)return false;
    if(!force && S.user && Date.now()-S.loadedAt<1500)return true;
    S.loading=true;
    try{
      const {data:{user}}=await db.auth.getUser(); if(!user)return false; S.user=user;
      const since=iso(addDays(new Date(),-400));
      const q=await Promise.all([
        db.from('life_plans').select('*').order('created_at',{ascending:false}),
        db.from('plan_routines').select('*').order('created_at',{ascending:true}),
        db.from('plan_checkins').select('*').eq('user_id',user.id).gte('scheduled_for',since)
      ]);
      if(q.some(x=>x.error)){console.warn('Plan accountability load skipped',q.find(x=>x.error)?.error);return false}
      [S.plans,S.routines,S.checkins]=q.map(x=>x.data||[]); S.loadedAt=Date.now(); return true;
    } finally { S.loading=false; }
  }

  function stateFor(check,info){
    const raw=check?.details?.subchecks;
    if(Array.isArray(raw) && raw.length===info.count) return raw.map(Boolean);
    if(check?.status==='done') return Array(info.count).fill(true);
    if(check?.status==='partial') { const n=Math.max(1,Math.round(info.count*Number(check.compliance_score||.5))); return Array.from({length:info.count},(_,i)=>i<n); }
    return Array(info.count).fill(false);
  }

  function multiHtml(plan,routine,check,info){
    const vals=stateFor(check,info),done=vals.filter(Boolean).length,pct=Math.round(done/info.count*100);
    return `<div class="pa-multi" data-pa-plan="${plan.id}" data-pa-routine="${routine.id}">
      <div class="pa-multi-head"><span>${info.prayer?'Today’s prayers':'Today’s repetitions'}</span><strong>${done}/${info.count} · ${pct}%</strong></div>
      <div class="pa-chips">${info.labels.map((label,i)=>`<button type="button" class="pa-chip ${vals[i]?'done':''}" data-pa-index="${i}" aria-pressed="${vals[i]?'true':'false'}"><span class="pa-box">✓</span><span>${String(label).replace(/[&<>]/g,'')}</span></button>`).join('')}</div>
      <div class="pa-multi-summary"><span style="width:${pct}%"></span></div>
    </div>`;
  }

  function enhanceToday(){
    if(!plannerActive())return;
    const cards=$$('.lm-today-card');
    const today=iso(new Date());
    cards.forEach(card=>{
      const old=card.querySelector('.lm-checks'); if(!old)return;
      const source=old.querySelector('[data-routine][data-plan]'); if(!source)return;
      const rid=source.dataset.routine,pid=source.dataset.plan;
      const routine=S.routines.find(r=>r.id===rid),plan=S.plans.find(p=>p.id===pid); if(!routine||!plan)return;
      const info=repeatInfo(routine,plan); if(!info)return;
      const check=S.checkins.find(c=>c.routine_id===rid&&c.user_id===S.user.id&&c.scheduled_for===today);
      const holder=document.createElement('div'); holder.innerHTML=multiHtml(plan,routine,check,info);
      old.replaceWith(holder.firstElementChild);
    });
    const head=$('.lm-section-head p');
    if(head && !$('.pa-checkin-note')) head.insertAdjacentHTML('afterend',`<span class="pa-checkin-note">I’ll check on you every day at 11:00 PM</span>`);
  }

  function compliance(plan){
    let due=0,earned=0;
    S.routines.filter(r=>r.plan_id===plan.id&&r.is_active!==false).forEach(r=>{
      due+=expected(plan,r);
      earned+=S.checkins.filter(c=>c.routine_id===r.id&&c.user_id===S.user.id).reduce((s,c)=>s+Number(c.compliance_score||0),0);
    });
    return due?Math.min(100,Math.round(earned/due*100)):0;
  }

  function enhancePlanScores(){
    $$('.lm-plan-card').forEach(card=>{
      const a=card.querySelector('[data-share],[data-delete]'); const id=a?.dataset.share||a?.dataset.delete; if(!id)return;
      const plan=S.plans.find(p=>p.id===id); if(!plan)return;
      const v=compliance(plan),strong=card.querySelector('.lm-score strong'),bar=card.querySelector('.lm-progress span');
      if(strong)strong.textContent=`${v}%`; if(bar)bar.style.width=`${v}%`;
    });
  }

  function patchBrain(){
    const p=$('#medoraBrainDay .mb-hero > div > p');
    if(p && /^This is due from\b/i.test(p.textContent.trim())) p.textContent=`I’ll check on you every day at 11:00 PM.`;
    if(!$('#medoraBrainDay'))return;
    const today=iso(new Date());
    const pending=S.plans.filter(p=>p.status==='active').flatMap(plan=>S.routines.filter(r=>r.plan_id===plan.id&&r.is_active!==false&&scheduled(r,new Date())).map(r=>({plan,r,check:S.checkins.find(c=>c.routine_id===r.id&&c.scheduled_for===today&&c.user_id===S.user.id)}))).filter(x=>!x.check||Number(x.check.compliance_score||0)<1);
    if(!pending.length)return;
    const first=pending[0],info=repeatInfo(first.r,first.plan),hero=$('#medoraBrainDay .mb-hero > div');
    if(hero && info){
      const title=hero.querySelector('h1'),text=hero.querySelector('p');
      const done=first.check?Math.round(Number(first.check.compliance_score||0)*info.count):0;
      if(title)title.textContent=`${first.plan.icon||'✓'} ${first.r.title}`;
      if(text)text.textContent=`You’re at ${done}/${info.count} today. I’ll check on you every day at 11:00 PM.`;
    }
    const stat=$$('#medoraBrainDay .mb-stat')[0]?.querySelector('strong');
    if(stat){const total=S.plans.filter(p=>p.status==='active').flatMap(plan=>S.routines.filter(r=>r.plan_id===plan.id&&r.is_active!==false&&scheduled(r,new Date()))).length;stat.textContent=`${pending.length}/${total}`;}
  }

  async function toggleMulti(button){
    const box=button.closest('.pa-multi'); if(!box||box.classList.contains('pa-saving'))return;
    const pid=box.dataset.paPlan,rid=box.dataset.paRoutine,idx=Number(button.dataset.paIndex);
    const plan=S.plans.find(p=>p.id===pid),routine=S.routines.find(r=>r.id===rid),info=repeatInfo(routine,plan); if(!plan||!routine||!info)return;
    const day=iso(new Date()); let check=S.checkins.find(c=>c.routine_id===rid&&c.user_id===S.user.id&&c.scheduled_for===day);
    const vals=stateFor(check,info); vals[idx]=!vals[idx]; const done=vals.filter(Boolean).length,score=done/info.count;
    box.classList.add('pa-saving');
    try{
      if(done===0){
        if(check){const del=await db.from('plan_checkins').delete().eq('id',check.id).eq('user_id',S.user.id);if(del.error)throw del.error;S.checkins=S.checkins.filter(c=>c.id!==check.id);check=null;}
      }else{
        const details={...(check?.details||{}),multi_check:true,subchecks:vals,subcheck_count:info.count,check_labels:info.labels};
        const payload={plan_id:pid,routine_id:rid,user_id:S.user.id,scheduled_for:day,status:done===info.count?'done':'partial',compliance_score:score,points:Number(routine.base_points||1)*score,details,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        const res=await db.from('plan_checkins').upsert(payload,{onConflict:'routine_id,user_id,scheduled_for'}).select().single(); if(res.error)throw res.error;
        S.checkins=S.checkins.filter(c=>!(c.routine_id===rid&&c.user_id===S.user.id&&c.scheduled_for===day));S.checkins.push(res.data);check=res.data;
      }
      box.outerHTML=multiHtml(plan,routine,check,info);
      enhancePlanScores(); patchBrain();
      document.dispatchEvent(new CustomEvent('medora:plan-checkin-updated',{detail:{planId:pid,routineId:rid,score}}));
    }catch(e){console.warn(e);alert(e.message||'Could not save this check.');box.classList.remove('pa-saving');}
  }

  async function enhance(force=false){
    const ok=await load(force); if(!ok)return; enhanceToday(); enhancePlanScores(); patchBrain();
  }

  function maybeElevenPmPrompt(){
    const now=new Date(); if(now.getHours()<23)return;
    const key=`medora.11pmCheck.${iso(now)}`; try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1')}catch{}
    const pending=S.plans.filter(p=>p.status==='active').some(plan=>S.routines.some(r=>r.plan_id===plan.id&&r.is_active!==false&&scheduled(r,now)&&!S.checkins.find(c=>c.routine_id===r.id&&c.user_id===S.user?.id&&c.scheduled_for===iso(now)&&Number(c.compliance_score||0)>=1)));
    if(!pending)return;
    const toast=$('#toast'); if(toast){toast.textContent='11 PM check-in: how did your plans go today?';toast.className='toast show';setTimeout(()=>{if(toast.textContent.startsWith('11 PM check-in'))toast.className='toast'},7000);}
    if(window.Notification?.permission==='granted'){try{new Notification('Medora check-in',{body:'How did your plans go today? Open Planner to check them off.'})}catch{}}
  }

  function init(){
    addStyles();
    document.addEventListener('click',e=>{const b=e.target.closest('[data-pa-index]');if(b){e.preventDefault();e.stopImmediatePropagation();toggleMulti(b);}},true);
    let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>enhance(false),160)}).observe(document.body,{childList:true,subtree:true});
    enhance(true);setInterval(()=>{enhance(false);maybeElevenPmPrompt()},60000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();