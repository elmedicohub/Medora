(() => {
  "use strict";
  if (window.__MEDORA_PLACE_HISTORY__) return;
  window.__MEDORA_PLACE_HISTORY__ = true;

  const cfg=window.MEDORA_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
  let places=[],byName=new Map(),observer=null,timer=null;

  function closeAll(){
    document.getElementById('placeHistoryOverlay')?.remove();
    document.getElementById('journeyOverlay')?.remove();
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
  }

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const any=document.getElementById('placeHistoryOverlay')||document.getElementById('journeyOverlay')||document.querySelector('dialog[open]');
      if(any){e.preventDefault();e.stopPropagation();closeAll()}
    }
  },true);

  async function load(){
    const {data:{user}}=await db.auth.getUser();if(!user)return;
    const {data,error}=await db.from('travel_places').select('id,name,place_key,category,priority,best_time,estimated_minutes,address,source_url,why_visit,notes,opening_hours_text,entry_fee_note,established_text,historical_period,history_summary,historical_significance,photo_url').eq('user_id',user.id);
    if(error){console.warn('Travel place history load',error);return}
    places=data||[];byName=new Map();places.forEach(p=>byName.set(norm(p.name),p));enhance();
  }

  function findPlaceForCard(card){
    const title=card.querySelector('.step-copy h3')?.textContent?.trim();if(!title)return null;
    const exact=byName.get(norm(title));if(exact)return exact;
    return places.find(p=>norm(title).includes(norm(p.name))||norm(p.name).includes(norm(title)))||null;
  }

  function enhance(){
    $$('.journey-step-card').forEach(card=>{
      if(card.dataset.placeHistoryBound==='1')return;
      const place=findPlaceForCard(card);if(!place)return;
      const actions=card.querySelector('.step-actions');if(!actions)return;
      const b=document.createElement('button');b.type='button';b.className='jbtn small place-info-btn';b.textContent='ⓘ About';b.dataset.placeHistory=place.id;b.onclick=e=>{e.preventDefault();e.stopPropagation();openInfo(place)};
      actions.insertBefore(b,actions.firstChild);card.dataset.placeHistoryBound='1';
    });
  }

  function openInfo(p){
    closeAll();
    const bg=document.createElement('div');bg.id='placeHistoryOverlay';bg.className='place-history-overlay';
    const photo=p.photo_url||'';
    bg.innerHTML=`<section class="place-history-modal" role="dialog" aria-modal="true" aria-label="About ${esc(p.name)}">
      <div class="ph-photo" ${photo?`style="background-image:url('${esc(photo)}')"`:''}>
        <button class="ph-close" type="button" aria-label="Close">×</button>
        <div class="ph-photo-copy"><span>SHORT PLACE STORY</span><h2>${esc(p.name)}</h2></div>
      </div>
      <div class="ph-body">
        <div class="ph-facts">
          <div class="ph-fact"><small>Since when?</small><strong>${esc(p.established_text||'Historical date not added yet')}</strong></div>
          <div class="ph-fact"><small>Period</small><strong>${esc(p.historical_period||p.category||'Historic site')}</strong></div>
          <div class="ph-fact"><small>Typical visit</small><strong>${p.estimated_minutes?`About ${p.estimated_minutes} min`:'Flexible'}</strong></div>
          <div class="ph-fact"><small>Best time</small><strong>${esc(p.best_time||'Flexible')}</strong></div>
        </div>
        <div class="ph-section"><strong>What happened here?</strong><p>${esc(p.history_summary||p.why_visit||p.notes||'Short historical information will be added here.')}</p></div>
        <div class="ph-section"><strong>Why is it important?</strong><p>${esc(p.historical_significance||p.why_visit||'It is included because of its importance to the city’s history and identity.')}</p></div>
        ${p.opening_hours_text?`<div class="ph-section"><strong>Practical note</strong><p>${esc(p.opening_hours_text)}${p.entry_fee_note?` ${esc(p.entry_fee_note)}`:''}</p></div>`:''}
        <div class="ph-actions">
          ${p.address?`<a class="primary" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}">Map ↗</a>`:''}
          ${p.source_url?`<a target="_blank" rel="noopener" href="${esc(p.source_url)}">Official / more info ↗</a>`:''}
          <button type="button" data-ph-close>Close</button>
        </div>
        <div class="ph-esc">Press Esc anytime to close</div>
      </div>
    </section>`;
    document.body.appendChild(bg);
    bg.addEventListener('click',e=>{if(e.target===bg)closeAll()});
    bg.querySelector('.ph-close').onclick=closeAll;bg.querySelector('[data-ph-close]').onclick=closeAll;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(enhance,80)}

  async function boot(){
    await load();
    const root=document.getElementById('journeyRoot');if(root){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true})}
    document.addEventListener('change',e=>{if(e.target?.id==='planSelect')setTimeout(load,180)},true);
  }
  boot().catch(e=>console.warn('Travel place history',e));
})();