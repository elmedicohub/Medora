(() => {
  "use strict";
  if (window.__MEDORA_PLANNER_INDEFINITE__) return;
  window.__MEDORA_PLANNER_INDEFINITE__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2,"0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDMY = value => {
    const m = String(value || "").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
    if (!m) return null;
    const d=+m[1], mo=+m[2], y=+m[3], x=new Date(y,mo-1,d);
    return x.getFullYear()===y && x.getMonth()===mo-1 && x.getDate()===d ? x : null;
  };

  function addStyles(){
    if ($('#plannerIndefiniteStyle')) return;
    const style=document.createElement('style');
    style.id='plannerIndefiniteStyle';
    style.textContent=`
      .lm-indefinite-note{display:none;margin-top:8px;padding:9px 11px;border-radius:11px;background:#f1f6ff;color:#63718b;font-size:9px;line-height:1.45}
      .lm-indefinite-note.show{display:block}
    `;
    document.head.appendChild(style);
  }

  function sync(form){
    const duration=$('#lmPlanDuration',form);
    const note=$('.lm-indefinite-note',form);
    if (!duration || !note) return;
    note.classList.toggle('show', duration.value==='indefinite');
    const range=$('.lm-custom-range',form);
    if (range && duration.value==='indefinite') range.style.display='none';
  }

  function patchForm(form){
    if (!form || form.dataset.indefinitePatched) return;
    form.dataset.indefinitePatched='1';
    addStyles();
    const duration=$('#lmPlanDuration',form);
    if (!duration) return;

    if (!duration.querySelector('option[value="indefinite"]')) {
      const option=document.createElement('option');
      option.value='indefinite';
      option.textContent='Indefinite (no end date)';
      const custom=duration.querySelector('option[value="custom"]');
      duration.insertBefore(option,custom || null);
    }

    const note=document.createElement('div');
    note.className='lm-indefinite-note';
    note.textContent='No end date. This plan keeps running until you pause, edit or delete it.';
    duration.closest('label')?.insertAdjacentElement('afterend',note);
    duration.addEventListener('change',()=>sync(form));
    sync(form);
  }

  function chosenStart(form){
    const block=$('.lm-start-block',form);
    if (!block || block.dataset.startMode!=='date') return new Date();
    return parseDMY($('#lmPresetStartDate',form)?.value) || new Date();
  }

  async function correctNewest(title,stamp,startISO){
    const {data:{user}}=await db.auth.getUser();
    if (!user || !title) return;
    let plan=null;
    for(let i=0;i<24;i++){
      await new Promise(r=>setTimeout(r,250));
      const q=await db.from('life_plans')
        .select('id,title,created_at,start_date,end_date')
        .eq('user_id',user.id)
        .eq('title',title)
        .order('created_at',{ascending:false})
        .limit(3);
      if(q.error) continue;
      plan=(q.data||[]).find(p=>new Date(p.created_at).getTime()>=stamp-2500);
      if(plan) break;
    }
    if(!plan) return;

    const apply=async()=>{
      await db.from('life_plans').update({start_date:startISO,end_date:null}).eq('id',plan.id).eq('user_id',user.id);
      document.dispatchEvent(new CustomEvent('medora:plan-range-updated',{detail:{planId:plan.id,indefinite:true}}));
      patchVisiblePlan(plan.id);
    };
    await apply();
    setTimeout(apply,1200);
    setTimeout(apply,2600);
  }

  function patchVisiblePlan(planId){
    const card=$$('.lm-plan-card').find(c=>{
      const action=c.querySelector('[data-share],[data-delete]');
      return (action?.dataset.share || action?.dataset.delete)===planId;
    });
    if(!card) return;
    const meta=card.querySelector('.lm-plan-title small');
    if(meta){
      meta.textContent=meta.textContent.replace(/\s*·\s*until\s+\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\s*·\s*until\s+\d{4}-\d{2}-\d{2}/i,'');
      if(!/indefinite/i.test(meta.textContent)) meta.textContent += ' · indefinite';
    }
    const endBox=card.querySelector('[data-pce-box="ends"] strong');
    if(endBox) endBox.textContent='No end date';
    const planBox=card.querySelector('[data-pce-box="plan"] strong');
    if(planBox) planBox.textContent='Ongoing plan';
    const targetBox=card.querySelector('[data-pce-box="target-progress"]');
    if(targetBox){
      const strong=targetBox.querySelector('strong');
      if(strong) strong.textContent='Ongoing';
      let note=targetBox.querySelector('.pce-note');
      if(note) note.textContent='No fixed end target';
    }
  }

  // Capture before the Planner's own submit handler. Temporarily give the old
  // creator a valid duration, then immediately convert the new plan to null end_date.
  document.addEventListener('submit',event=>{
    const form=event.target.closest?.('#lmPlanForm');
    if(!form) return;
    const duration=$('#lmPlanDuration',form);
    if(!duration || duration.value!=='indefinite') return;
    const title=$('#lmPlanTitle',form)?.value.trim() || '';
    const startISO=iso(chosenStart(form));
    const stamp=Date.now();
    duration.dataset.indefiniteSubmitting='1';
    duration.value='365';
    queueMicrotask(()=>{
      if(document.documentElement.contains(duration)){
        duration.value='indefinite';
        sync(form);
      }
    });
    setTimeout(()=>correctNewest(title,stamp,startISO),350);
  },true);

  function scan(){
    const form=$('#lmPlanForm');
    if(form) patchForm(form);
  }

  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,40)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-start-plan],[data-template],[data-tab="explore"]')) setTimeout(scan,40);
  },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true}); else scan();
})();
