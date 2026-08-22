(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_PATHWAY_21__) return;
  window.__MEDORA_TRAVEL_PATHWAY_21__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const S = { user:null, tripId:null, cities:[], places:[], hubs:[], stops:[], cityFilter:"all", loading:null, observer:null, timer:null };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const city=id=>S.cities.find(x=>x.id===id), place=id=>S.places.find(x=>x.id===id), hub=id=>S.hubs.find(x=>x.id===id);
  const TZ={Budapest:"Europe/Budapest",Zagreb:"Europe/Zagreb",Bratislava:"Europe/Bratislava",Athens:"Europe/Athens"};
  const HICON={hostel:"🛏",hotel:"🏨",airport:"✈",bus_station:"🚌",train_station:"🚆",meeting_point:"◎",other:"📍"};
  const MICON={walk:"🚶",metro:"Ⓜ",tram:"🚋",bus:"🚌",train:"🚆",taxi:"🚕",airport_transfer:"⇄",flight:"✈",other:"→"};

  function toast(msg,type=""){
    const n=$("#travelToast"); if(!n)return; n.textContent=msg;n.className=`travel-toast show ${type}`.trim();clearTimeout(toast.t);toast.t=setTimeout(()=>n.className="travel-toast",2800);
  }
  function dateLabel(v){if(!v)return"";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d)?String(v):new Intl.DateTimeFormat(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d)}
  function localDT(v,cityId){if(!v)return"";const d=new Date(v),c=city(cityId);if(Number.isNaN(d.getTime()))return"";return new Intl.DateTimeFormat(undefined,{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:TZ[c?.city_name]||undefined}).format(d)}
  const tm=v=>v?String(v).slice(0,5):"—";
  function pstatus(p){if(!p)return"saved";if(p.visit_status&&p.visit_status!=="saved")return p.visit_status;return p.is_visited?"visited":"saved"}
  function mapUrl(name,address,cityName){const q=[address||name,!address?cityName:""].filter(Boolean).join(", ");return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}

  async function load(force=false){
    const tripId=$("#tripSelect")?.value;if(!tripId)return false;if(!force&&S.tripId===tripId&&S.cities.length)return true;if(S.loading)return S.loading;
    S.loading=(async()=>{
      const {data:{user}}=await db.auth.getUser();if(!user)return false;S.user=user;S.tripId=tripId;
      const q=await Promise.all([
        db.from("travel_cities").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_places").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_hubs").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_route_stops").select("*").eq("trip_id",tripId).order("route_date").order("sequence")
      ]);
      const bad=q.find(x=>x.error);if(bad){toast(bad.error.message||"Pathway could not load.","error");return false}
      [S.cities,S.places,S.hubs,S.stops]=q.map(x=>x.data||[]);if(S.cityFilter!=="all"&&!S.cities.some(c=>c.id===S.cityFilter))S.cityFilter="all";return true;
    })();
    try{return await S.loading}finally{S.loading=null}
  }

  function install(){
    const tabs=$(".travel-tabs"),planner=$("#plannerView");if(!tabs||!planner)return false;
    let b=tabs.querySelector('[data-v2-tab="pathway"]');
    if(!b){b=document.createElement("button");b.type="button";b.className="travel-tab";b.dataset.v2Tab="pathway";b.textContent="Pathway";tabs.insertBefore(b,tabs.querySelector('[data-tab="bookings"]')||null)}
    if(!$("#pathwayTab")){const p=document.createElement("section");p.id="pathwayTab";p.className="travel-tab-panel hidden";planner.appendChild(p)}
    if(!b.dataset.tpBound){b.dataset.tpBound="1";b.onclick=async e=>{e.preventDefault();$$('.travel-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');["overviewTab","placesTab","itineraryTab","bookingsTab"].forEach(id=>$("#"+id)?.classList.add("hidden"));$("#pathwayTab")?.classList.remove("hidden");if(await load(true))render()}}
    $$('.travel-tab[data-tab]').forEach(x=>{if(x.dataset.tp21)return;x.dataset.tp21="1";x.addEventListener('click',()=>$("#pathwayTab")?.classList.add('hidden'))});
    return true;
  }

  function anchorText(h){const a=[];if(h.planned_arrival_at)a.push(`Arrive ${localDT(h.planned_arrival_at,h.city_id)}`);if(h.planned_departure_at)a.push(`Leave ${localDT(h.planned_departure_at,h.city_id)}`);if(h.buffer_minutes)a.push(`${h.buffer_minutes} min buffer`);return a.join(" · ")||h.address||"Address not added yet"}
  function anchorCard(h){const c=city(h.city_id),missing=!h.address;return `<article class="tp-anchor ${missing?"missing":""}"><div class="tp-anchor-icon">${HICON[h.hub_type]||"📍"}</div><div><strong>${esc(h.name)}</strong><small>${esc(c?.city_name||"")} · ${esc((h.hub_type||"other").replaceAll("_"," "))}</small><small>${esc(anchorText(h))}</small></div><div class="tp-anchor-actions">${h.address?`<a class="travel-btn small" target="_blank" rel="noopener" href="${mapUrl(h.name,h.address,c?.city_name)}">Map ↗</a>`:""}<button class="travel-btn small" type="button" data-tp-edit-hub="${h.id}">${missing?"Add address":"Edit"}</button><span class="tp-chip ${h.is_confirmed?"visited":""}">${h.is_confirmed?"confirmed":"needs detail"}</span></div></article>`}

  function groups(){const rows=S.cityFilter==="all"?S.stops:S.stops.filter(x=>x.city_id===S.cityFilter),m=new Map();rows.forEach(s=>{const k=`${s.route_date}|${s.city_id}`;(m.get(k)||m.set(k,[]).get(k)).push(s)});return [...m.entries()].map(([k,stops])=>{const [date,cityId]=k.split('|');return{date,cityId,city:city(cityId),stops:stops.sort((a,b)=>a.sequence-b.sequence)}}).sort((a,b)=>a.date.localeCompare(b.date)||(a.city?.order_index||0)-(b.city?.order_index||0))}
  function stopLoc(s){const c=city(s.city_id);if(s.hub_id){const h=hub(s.hub_id);return h?.address||(h?.name?`${h.name}, ${c?.city_name||""}`:"")}if(s.place_id){const p=place(s.place_id);return p?.address||(p?.name?`${p.name}, ${c?.city_name||""}`:"")}return""}
  function dirUrl(stops){const a=stops.map(stopLoc).filter(Boolean);if(!a.length)return"";if(a.length===1)return mapUrl(a[0],"","");let u=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a[0])}&destination=${encodeURIComponent(a[a.length-1])}`;if(a.length>2)u+=`&waypoints=${encodeURIComponent(a.slice(1,-1).join('|'))}`;return u}
  function miniMap(stops){const a=stops.filter(s=>s.stop_type!=="break");return `<div class="tp-route-map"><div class="tp-section-head"><div><h3>Virtual pathway</h3><p>All route stops are kept in order. The live Maps route can be opened when needed.</p></div></div><div class="tp-route-map-line">${a.map((s,i)=>`${i?'<span class="tp-map-link"></span>':''}<div class="tp-map-stop"><span class="tp-map-dot ${s.stop_type}">${s.sequence}</span><span class="tp-map-label">${esc(s.title)}<span class="tp-map-mode">${MICON[s.travel_mode]||"→"} ${s.travel_minutes?`${s.travel_minutes} min · `:""}${esc((s.travel_mode||"other").replaceAll('_',' '))}</span></span></div>`).join('')}</div></div>`}

  function actions(s){
    if(s.place_id){const p=place(s.place_id),st=pstatus(p),c=city(p?.city_id);if(!p)return"";return `<div class="tp-stop-actions"><button class="travel-btn small" type="button" data-tp-info="${p.id}">Info</button><button class="travel-btn small ${st==='found'?'active-found':''}" type="button" data-tp-status="found" data-place="${p.id}">✓ Found</button><button class="travel-btn small ${st==='visited'?'active-visited':''}" type="button" data-tp-status="visited" data-place="${p.id}">✓ Visited</button><a class="travel-btn small" target="_blank" rel="noopener" href="${mapUrl(p.name,p.address,c?.city_name)}">Map ↗</a></div>`}
    if(s.hub_id){const h=hub(s.hub_id),c=city(s.city_id);if(!h)return"";return `<div class="tp-stop-actions">${h.address?`<a class="travel-btn small" target="_blank" rel="noopener" href="${mapUrl(h.name,h.address,c?.city_name)}">Map ↗</a>`:""}<button class="travel-btn small" type="button" data-tp-edit-hub="${h.id}">${h.address?"Anchor info":"Add address"}</button></div>`}
    return"";
  }
  function stopRow(s){const p=place(s.place_id),st=p?pstatus(p):s.status,chip=st&&!['saved','planned'].includes(st)?`<span class="tp-chip ${st}">${esc(st)}</span>`:"";return `<div class="tp-stop ${s.is_hard_deadline?"deadline":""}"><div class="tp-node ${s.stop_type}">${s.sequence}</div><div class="tp-stop-copy"><div class="tp-stop-title"><strong>${esc(s.title)}</strong>${chip}${s.is_hard_deadline?'<span class="tp-chip deadline">HARD TIME</span>':''}</div>${s.notes?`<p>${esc(s.notes)}</p>`:""}<div class="tp-stop-meta"><span class="tp-chip">${MICON[s.travel_mode]||"→"} ${esc((s.travel_mode||"other").replaceAll('_',' '))}${s.travel_minutes?` · ${s.travel_minutes} min`:''}</span><span class="tp-chip">${esc(s.stop_type)}</span></div></div><div class="tp-time"><strong>${tm(s.planned_start)}</strong><small>${s.planned_end?`→ ${tm(s.planned_end)}`:''}</small></div>${actions(s)}</div>`}
  function dayCard(g){const url=dirUrl(g.stops),hard=g.stops.filter(s=>s.is_hard_deadline).length;return `<article class="tp-day"><header class="tp-day-head"><div><h3>${esc(g.city?.city_name||"")} · ${esc(dateLabel(g.date))}</h3><p>${g.stops.length} planned stops${hard?` · ${hard} fixed transport deadline${hard===1?'':'s'}`:''}</p></div><div class="tp-day-actions">${url?`<a class="travel-btn small" target="_blank" rel="noopener" href="${url}">Open day route ↗</a>`:''}</div></header>${miniMap(g.stops)}<div class="tp-route">${g.stops.map(stopRow).join('')}</div></article>`}

  function render(){
    const panel=$("#pathwayTab");if(!panel)return;const gs=groups(),anchors=S.cityFilter==="all"?S.hubs:S.hubs.filter(h=>h.city_id===S.cityFilter),missing=S.hubs.filter(h=>!h.address),visited=S.places.filter(p=>pstatus(p)==='visited').length,found=S.places.filter(p=>['found','visited'].includes(pstatus(p))).length;
    panel.innerHTML=`<section class="tp-hero"><div class="tp-hero-grid"><div><span class="eyebrow light">SMART TRIP PATHWAY</span><h2>Your trip, timed around the things you cannot miss.</h2><p>Hostels, stations, airports and sightseeing stops are connected to your fixed transport times. Walking/transit minutes are planning buffers, while Maps gives live routing on the day.</p><span class="tp-private">🔒 Private · route data is protected by your Medora account</span></div><div class="tp-hero-stat"><strong>${found}/${S.places.length}</strong><small>found · ${visited} visited</small></div></div></section>${missing.length?`<div class="tp-alert"><div><strong>One anchor is still missing</strong><span>${esc(missing.map(h=>h.name).join(', '))}. Add its exact address and your route links will use it immediately.</span></div><button class="travel-btn small" type="button" data-tp-edit-hub="${missing[0].id}">Add address</button></div>`:''}<div class="tp-city-filter"><button type="button" data-tp-city="all" class="${S.cityFilter==='all'?'active':''}">Whole trip</button>${S.cities.map(c=>`<button type="button" data-tp-city="${c.id}" class="${S.cityFilter===c.id?'active':''}">${esc(c.city_name)}</button>`).join('')}</div><section class="tp-anchor-panel"><div class="tp-section-head"><div><h3>Stay & transport anchors</h3><p>Accommodation, bus stations and airports that the sightseeing route must respect.</p></div></div><div class="tp-anchors">${anchors.length?anchors.map(anchorCard).join(''):'<div class="tp-empty"><strong>No anchors in this view</strong></div>'}</div></section>${gs.length?gs.map(dayCard).join(''):'<div class="tp-empty"><strong>No timed pathway yet</strong></div>'}`;bind();
  }

  async function setStatus(id,want){
    const p=place(id);if(!p)return;const cur=pstatus(p),next=cur===want?'saved':want,now=new Date().toISOString();
    const payload={visit_status:next,is_visited:next==='visited',found_at:['found','visited'].includes(next)?(p.found_at||now):null,visited_at:next==='visited'?now:null,updated_at:now};
    const {error}=await db.from('travel_places').update(payload).eq('id',id);if(error)return toast(error.message,'error');const rs=next==='saved'?'planned':next;await db.from('travel_route_stops').update({status:rs,updated_at:now}).eq('trip_id',S.tripId).eq('place_id',id);Object.assign(p,payload);S.stops.filter(s=>s.place_id===id).forEach(s=>s.status=rs);toast(next==='saved'?'Place reset to saved.':`Marked ${next}.`,'success');if(!$("#pathwayTab")?.classList.contains('hidden'))render();enhanceCards(true);
  }

  function ensureDialogs(){
    if(!$('#tpPlaceDialog')){const d=document.createElement('dialog');d.id='tpPlaceDialog';d.className='tp-dialog';document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.close()})}
    if(!$('#tpHubDialog')){const d=document.createElement('dialog');d.id='tpHubDialog';d.className='tp-dialog';document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.close()})}
  }
  function placeDialog(id){
    ensureDialogs();const p=place(id);if(!p)return;const c=city(p.city_id),st=pstatus(p),d=$('#tpPlaceDialog');
    d.innerHTML=`<div class="tp-dialog-inner"><div class="tp-dialog-head"><div><span class="eyebrow">${esc(c?.city_name||'')} · ${esc(p.priority||'')}</span><h2>${esc(p.name)}</h2></div><button class="icon-close" type="button" data-close>×</button></div><div class="tp-detail-grid"><div class="tp-detail"><small>Status</small><strong>${esc(st)}</strong></div><div class="tp-detail"><small>Category</small><strong>${esc(p.category||'Place')}</strong></div><div class="tp-detail"><small>Best time</small><strong>${esc(p.best_time||'Flexible')}</strong></div><div class="tp-detail"><small>Typical visit</small><strong>${p.estimated_minutes?`≈ ${p.estimated_minutes} min`:'Not set'}</strong></div><div class="tp-detail"><small>Opening hours</small><strong>${esc(p.opening_hours_text||'Recheck before travel')}</strong></div><div class="tp-detail"><small>Ticket / entry</small><strong>${esc(p.entry_fee_note||'Check venue information')}</strong></div></div><div class="tp-info-block"><strong>Why visit</strong><p>${esc(p.why_visit||p.notes||'Saved in your trip.')}</p></div>${p.seasonal_note?`<div class="tp-info-block"><strong>Seasonal note</strong><p>${esc(p.seasonal_note)}</p></div>`:''}${p.address?`<div class="tp-info-block"><strong>Exact location</strong><p>${esc(p.address)}</p></div>`:''}<div class="tp-dialog-actions"><button class="travel-btn ${st==='found'?'success':''}" type="button" data-dialog-status="found">✓ Found</button><button class="travel-btn ${st==='visited'?'success':''}" type="button" data-dialog-status="visited">✓ Visited</button><button class="travel-btn" type="button" data-dialog-status="skipped">Skip</button><button class="travel-btn" type="button" data-dialog-status="closed">Closed</button><a class="travel-btn" target="_blank" rel="noopener" href="${mapUrl(p.name,p.address,c?.city_name)}">Map ↗</a>${p.source_url?`<a class="travel-btn" target="_blank" rel="noopener" href="${esc(p.source_url)}">Official / info ↗</a>`:''}</div></div>`;
    d.querySelector('[data-close]').onclick=()=>d.close();d.querySelectorAll('[data-dialog-status]').forEach(b=>b.onclick=async()=>{const want=b.dataset.dialogStatus;d.close();await setStatus(id,want);placeDialog(id)});if(!d.open)d.showModal();
  }
  function hubDialog(id){
    ensureDialogs();const h=hub(id);if(!h)return;const c=city(h.city_id),d=$('#tpHubDialog');
    d.innerHTML=`<div class="tp-dialog-inner"><div class="tp-dialog-head"><div><span class="eyebrow">PRIVATE ROUTE ANCHOR</span><h2>${esc(h.name)}</h2></div><button class="icon-close" type="button" data-close>×</button></div><form id="tpHubForm" class="tp-form"><label><span>Name</span><input id="tpHubName" maxlength="160" required value="${esc(h.name)}"></label><label><span>Type</span><select id="tpHubType">${[['hostel','Hostel'],['hotel','Hotel'],['airport','Airport'],['bus_station','Bus station'],['train_station','Train station'],['meeting_point','Meeting point'],['other','Other']].map(([v,l])=>`<option value="${v}" ${h.hub_type===v?'selected':''}>${l}</option>`).join('')}</select></label><label><span>Exact address</span><input id="tpHubAddress" maxlength="300" placeholder="Street, number, city, country" value="${esc(h.address||'')}"></label><label><span>Safety buffer before departure (min)</span><input id="tpHubBuffer" type="number" min="0" max="360" value="${Number(h.buffer_minutes||0)}"></label><label><span>Confirmed?</span><select id="tpHubConfirmed"><option value="true" ${h.is_confirmed?'selected':''}>Yes</option><option value="false" ${!h.is_confirmed?'selected':''}>Not yet</option></select></label><div class="tp-dialog-actions"><button class="travel-btn primary" type="submit">Save anchor</button>${h.address?`<a class="travel-btn" target="_blank" rel="noopener" href="${mapUrl(h.name,h.address,c?.city_name)}">Check map ↗</a>`:''}</div></form></div>`;
    d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('#tpHubForm').onsubmit=async e=>{e.preventDefault();const payload={name:$('#tpHubName',d).value.trim(),hub_type:$('#tpHubType',d).value,address:$('#tpHubAddress',d).value.trim()||null,buffer_minutes:Number($('#tpHubBuffer',d).value||0),is_confirmed:$('#tpHubConfirmed',d).value==='true',updated_at:new Date().toISOString()};const {error}=await db.from('travel_hubs').update(payload).eq('id',h.id);if(error)return toast(error.message,'error');if(['hostel','hotel'].includes(payload.hub_type)&&c)await db.from('travel_cities').update({accommodation_name:payload.name,accommodation_address:payload.address,updated_at:new Date().toISOString()}).eq('id',c.id);Object.assign(h,payload);d.close();toast('Route anchor saved.','success');render()};if(!d.open)d.showModal();
  }

  function bind(){
    $$('[data-tp-city]').forEach(b=>b.onclick=()=>{S.cityFilter=b.dataset.tpCity;render()});$$('[data-tp-info]').forEach(b=>b.onclick=()=>placeDialog(b.dataset.tpInfo));$$('[data-tp-status]').forEach(b=>b.onclick=()=>setStatus(b.dataset.place,b.dataset.tpStatus));$$('[data-tp-edit-hub]').forEach(b=>b.onclick=()=>hubDialog(b.dataset.tpEditHub));
  }

  function cardUpdate(card,p,force=false){
    const st=pstatus(p),sig=`${p.id}:${st}`;if(!force&&card.dataset.tpSig===sig)return;card.dataset.tpSig=sig;card.dataset.tpEnhanced='1';card.classList.toggle('tp-visited',st==='visited');
    let state=card.querySelector('.tp-place-status');if(!state){state=document.createElement('div');state.className='tp-place-status';card.querySelector('.place-copy')?.appendChild(state)}state.innerHTML=`<span class="tp-place-state ${st}">${esc(st)}</span>`;
    const actions=card.querySelector('.place-actions');if(!actions)return;actions.querySelectorAll('[data-tp-card]').forEach(x=>x.remove());
    const make=(text,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.className=`travel-btn small ${cls}`.trim();b.dataset.tpCard='1';b.textContent=text;b.onclick=e=>{e.stopPropagation();fn()};return b};
    actions.prepend(make('✓ Visited',()=>setStatus(p.id,'visited'),st==='visited'?'success':''));actions.prepend(make('✓ Found',()=>setStatus(p.id,'found'),st==='found'?'active-found':''));actions.prepend(make('Details',()=>placeDialog(p.id)));
  }
  function enhanceCards(force=false){$$('#placesTab .place-card').forEach(card=>{const id=card.querySelector('[data-toggle-place]')?.dataset.togglePlace,p=place(id);if(p)cardUpdate(card,p,force)})}
  function schedule(){clearTimeout(S.timer);S.timer=setTimeout(()=>{install();enhanceCards(false)},90)}

  async function boot(){
    let n=0;while(!$('#plannerView')&&n++<70)await new Promise(r=>setTimeout(r,100));if(!$('#plannerView'))return;install();ensureDialogs();await load(true);enhanceCards();$('#tripSelect')?.addEventListener('change',async()=>{await load(true);if(!$('#pathwayTab')?.classList.contains('hidden'))render();enhanceCards(true)});document.addEventListener('click',e=>{if(e.target.closest('[data-tab="places"]'))setTimeout(()=>enhanceCards(),100)},true);S.observer=new MutationObserver(schedule);S.observer.observe($('#plannerView'),{subtree:true,childList:true});
  }
  boot().catch(e=>{console.error('Travel Pathway 2.1',e);toast('Travel pathway could not start.','error')});
})();
