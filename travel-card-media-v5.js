(() => {
  'use strict';
  if (window.__MEDORA_TRAVEL_CARD_MEDIA_V5__) return;
  window.__MEDORA_TRAVEL_CARD_MEDIA_V5__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S={tripId:null,segments:new Map(),hubs:new Map(),timer:null,observer:null};

  function activeTripId(){return $('#journeyPlanSelect')?.value||localStorage.getItem('medoraTravelActiveTrip')||null}
  function clean(v=''){return String(v).replace(/^Go to\s+/i,'').replace(/^You (?:are now at|arrived at|have arrived in)\s+/i,'').trim()}
  async function signedPhoto(v){
    if(!v)return null;
    if(v.startsWith('storage://travel-media/')){
      const path=v.replace('storage://travel-media/','');
      const {data}=await db.storage.from('travel-media').createSignedUrl(path,3600);
      return data?.signedUrl||null;
    }
    return v;
  }

  async function loadData(force=false){
    const tripId=activeTripId();if(!tripId)return false;if(!force&&S.tripId===tripId&&S.segments.size)return true;
    const [segRes,hubRes]=await Promise.all([
      db.from('travel_transport_segments').select('*').eq('trip_id',tripId),
      db.from('travel_hubs').select('*').eq('trip_id',tripId)
    ]);
    if(segRes.error||hubRes.error)return false;
    S.tripId=tripId;S.segments=new Map((segRes.data||[]).map(x=>[x.id,x]));S.hubs=new Map((hubRes.data||[]).map(x=>[x.id,x]));return true;
  }

  function photoTarget(card){
    const b=card.querySelector('[data-edit-photo]');if(!b)return null;
    try{return JSON.parse(b.dataset.editPhoto||'{}')}catch{return null}
  }
  function transportId(card){return card.querySelector('[data-edit-transport]')?.dataset.editTransport||null}
  function setPhoto(card,url,credit=''){
    const photo=card.querySelector('.step-photo');if(!photo||!url)return;
    photo.dataset.photoDone='1';photo.dataset.photoUrl=url;photo.dataset.photoCredit=credit||'';
    photo.style.backgroundImage=`url("${String(url).replaceAll('"','%22')}")`;
    photo.style.backgroundPosition='center';photo.style.backgroundSize='cover';photo.classList.remove('photo-skeleton');
    let c=photo.querySelector('.photo-credit');
    if(credit){if(!c){c=document.createElement('span');c.className='photo-credit';photo.appendChild(c)}c.textContent=credit}else c?.remove();
  }
  function hubIcon(h){
    if(h.hub_type==='airport')return h.planned_departure_at?'🛫':'🛬';
    if(h.hub_type==='bus_station')return'🚌';
    if(h.hub_type==='train_station')return'🚉';
    if(['hostel','hotel'].includes(h.hub_type))return'🛏';
    return'📍';
  }
  function transportIcon(mode){return({flight:'✈',bus:'🚌',train:'🚆',car:'🚗',walk:'🚶',metro:'Ⓜ',tram:'🚋',taxi:'🚕',airport_transfer:'⇄'})[mode]||'→'}
  function modeLabel(mode){return({flight:'FLIGHT',bus:'BUS',train:'TRAIN',car:'CAR',walk:'WALK',metro:'METRO',tram:'TRAM',taxi:'TAXI',airport_transfer:'AIRPORT TRANSFER'})[mode]||String(mode||'TRANSPORT').toUpperCase()}
  function transportTitle(s){
    if(s.mode==='flight')return `${s.provider||'Airline'} flight`;
    if(s.mode==='bus')return `${s.provider||'Bus'} bus`;
    if(s.mode==='train')return `${s.provider||'Train'} train`;
    return `${s.provider||modeLabel(s.mode)}`;
  }

  async function fixTransportCard(card,s){
    card.dataset.mediaEntity='transport';card.dataset.mediaId=s.id;
    const label=card.querySelector('.step-type');if(label)label.textContent=modeLabel(s.mode);
    const title=card.querySelector('.step-copy h3');if(title)title.textContent=transportTitle(s);
    const logo=card.querySelector('.transport-logo');if(logo)logo.textContent=transportIcon(s.mode);
    const boxStrong=card.querySelector('.transport-card strong');if(boxStrong)boxStrong.textContent=[s.provider,s.service_number].filter(Boolean).join(' · ')||modeLabel(s.mode);
    const boxSmall=card.querySelector('.transport-card small');if(boxSmall)boxSmall.textContent=`${s.from_name} → ${s.to_name}`;
    const url=await signedPhoto(s.photo_url);if(url)setPhoto(card,url,s.photo_credit||'');
  }

  async function fixHubCard(card,h){
    card.dataset.mediaEntity='hub';card.dataset.mediaId=h.id;
    const label=card.querySelector('.step-type');
    if(label)label.textContent=h.hub_type==='airport'?'AIRPORT':h.hub_type==='bus_station'?'BUS STATION':h.hub_type==='train_station'?'TRAIN STATION':['hostel','hotel'].includes(h.hub_type)?h.hub_type.toUpperCase():'WAYPOINT';
    const title=card.querySelector('.step-copy h3');if(title)title.textContent=h.name;
    const logo=card.querySelector('.transport-logo');if(logo)logo.textContent=hubIcon(h);
    const boxStrong=card.querySelector('.transport-card strong');if(boxStrong)boxStrong.textContent=h.name;
    const boxSmall=card.querySelector('.transport-card small');if(boxSmall)boxSmall.textContent=h.address||'Address not set';
    const url=await signedPhoto(h.photo_url);if(url)setPhoto(card,url,h.photo_credit||'');
  }

  async function fixCard(card){
    const tid=transportId(card);if(tid&&S.segments.has(tid)){await fixTransportCard(card,S.segments.get(tid));return}
    const target=photoTarget(card);if(target?.table==='travel_hubs'&&S.hubs.has(target.id)){await fixHubCard(card,S.hubs.get(target.id))}
  }
  async function scan(force=false){if(!(await loadData(force)))return;for(const card of $$('.journey-step-card'))await fixCard(card)}

  function closeMediaInfo(){document.getElementById('mediaInfoOverlay')?.remove()}
  async function wikiSummary(q){
    try{const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean(q).replaceAll(' ','_'))}`);if(!r.ok)return null;const j=await r.json();return{extract:j.extract||'',url:j.content_urls?.desktop?.page||''}}catch{return null}
  }
  async function showEntityInfo(kind,row){
    closeMediaInfo();const summary=await wikiSummary(kind==='transport'?(row.provider||row.from_name):row.name);
    const url=await signedPhoto(row.photo_url);const title=kind==='transport'?transportTitle(row):row.name;
    const kicker=kind==='transport'?modeLabel(row.mode):(row.hub_type||'waypoint').replaceAll('_',' ').toUpperCase();
    const fallback=kind==='transport'?`${[row.provider,row.service_number].filter(Boolean).join(' · ')}. ${row.from_name} → ${row.to_name}.`:row.notes||`${row.name} is saved in your private journey.`;
    const o=document.createElement('div');o.id='mediaInfoOverlay';o.className='smart-entity-overlay';o.innerHTML=`<section class="smart-entity-modal"><div class="smart-entity-head"><div><span class="smart-entity-kicker">MEDORA RECOGNIZED · ${esc(kicker)}</span><h2>${esc(title)}</h2></div><button class="smart-close" data-media-close type="button">×</button></div><div class="smart-entity-body"><div class="smart-entity-photo" ${url?`style="background-image:url('${esc(url)}');background-size:cover;background-position:center"`:''}></div><div class="smart-entity-copy"><p>${esc(summary?.extract||fallback)}</p><div class="smart-entity-actions">${summary?.url?`<a href="${esc(summary.url)}" target="_blank" rel="noopener">More info ↗</a>`:''}<button type="button" data-media-close>Close</button></div></div></div></section>`;document.body.appendChild(o);o.onclick=e=>{if(e.target===o)closeMediaInfo()};o.querySelectorAll('[data-media-close]').forEach(b=>b.onclick=closeMediaInfo);
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('.journey-step-card .smart-card-tools button');if(!b||!/^ⓘ\s*Info/i.test(b.textContent||''))return;
    const card=b.closest('.journey-step-card');if(!card)return;
    const kind=card.dataset.mediaEntity,id=card.dataset.mediaId;if(!kind||!id)return;
    const row=kind==='transport'?S.segments.get(id):S.hubs.get(id);if(!row)return;
    e.preventDefault();e.stopImmediatePropagation();showEntityInfo(kind,row);
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('mediaInfoOverlay')){e.preventDefault();e.stopPropagation();closeMediaInfo()}},true);
  document.addEventListener('change',e=>{if(e.target?.id==='journeyPlanSelect'){S.tripId=null;setTimeout(()=>scan(true),250)}},true);

  function schedule(){clearTimeout(S.timer);S.timer=setTimeout(()=>scan(false),120)}
  const start=()=>{scan(true);S.observer=new MutationObserver(schedule);S.observer.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();