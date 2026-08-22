(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_MAP_V2__) return;
  window.__MEDORA_TRAVEL_MAP_V2__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const M = {tripId:null,cities:[],places:[],hubs:[],stops:[],map:null,layers:[],loading:null,renderToken:0,lastGeocode:0,timer:null};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const city=id=>M.cities.find(x=>x.id===id), place=id=>M.places.find(x=>x.id===id), hub=id=>M.hubs.find(x=>x.id===id);

  function mapUrl(name,address,cityName){const q=[address||name,!address?cityName:""].filter(Boolean).join(", ");return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}
  function activeCity(){const b=$(".tp-city-filter button.active[data-tp-city]");return b?.dataset.tpCity||"all"}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
  function coords(entity){const lat=num(entity?.latitude),lng=num(entity?.longitude);return lat!==null&&lng!==null?[lat,lng]:null}

  async function load(force=false){
    const tripId=$("#tripSelect")?.value;if(!tripId)return false;if(!force&&M.tripId===tripId&&M.cities.length)return true;if(M.loading)return M.loading;
    M.loading=(async()=>{
      M.tripId=tripId;
      const r=await Promise.all([
        db.from('travel_cities').select('*').eq('trip_id',tripId).order('order_index'),
        db.from('travel_places').select('*').eq('trip_id',tripId).order('order_index'),
        db.from('travel_hubs').select('*').eq('trip_id',tripId).order('order_index'),
        db.from('travel_route_stops').select('*').eq('trip_id',tripId).order('route_date').order('sequence')
      ]);
      const bad=r.find(x=>x.error);if(bad){console.warn('Travel map data',bad.error);return false}
      [M.cities,M.places,M.hubs,M.stops]=r.map(x=>x.data||[]);return true;
    })();
    try{return await M.loading}finally{M.loading=null}
  }

  function shell(){
    let s=$("#tpGeoMapShell");if(s)return s;
    const panel=$("#pathwayTab");if(!panel)return null;
    s=document.createElement('section');s.id='tpGeoMapShell';s.className='tm-shell';
    s.innerHTML=`<header class="tm-head"><div><h3>Exact-stop map</h3><p>Saved hotels/hostels, stations, airports and sightseeing pins. Lines show stop sequence; use “Open day route” for live road/transit navigation.</p></div><span id="tmStatus" class="tm-status">Preparing map…</span></header><div id="tpGeoMap" class="tm-map"></div><footer class="tm-foot"><span><strong>Map data:</strong> OpenStreetMap · exact pins are cached privately in your trip data.</span><span>Straight lines = sequence guide, not turn-by-turn routing.</span></footer>`;
    const after=$(".tp-city-filter",panel)||$(".tp-hero",panel);if(after)after.insertAdjacentElement('afterend',s);else panel.prepend(s);
    s.addEventListener('click',e=>{
      const p=e.target.closest('[data-tm-place]');if(p){const b=document.querySelector(`[data-tp-info="${CSS.escape(p.dataset.tmPlace)}"]`);b?.click();return}
      const h=e.target.closest('[data-tm-hub]');if(h){const b=document.querySelector(`[data-tp-edit-hub="${CSS.escape(h.dataset.tmHub)}"]`);b?.click()}
    });
    return s;
  }

  function setStatus(text){const n=$("#tmStatus");if(n)n.textContent=text}

  async function geocode(entity,table,cityName){
    const existing=coords(entity);if(existing)return existing;
    const query=entity.address||[entity.name,cityName].filter(Boolean).join(', ');if(!query)return null;
    const wait=Math.max(0,1100-(Date.now()-M.lastGeocode));if(wait)await new Promise(r=>setTimeout(r,wait));
    M.lastGeocode=Date.now();
    try{
      const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`;
      const res=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'en'}});if(!res.ok)return null;
      const data=await res.json();if(!data?.[0])return null;
      const lat=Number(data[0].lat),lng=Number(data[0].lon);if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
      entity.latitude=lat;entity.longitude=lng;
      db.from(table).update({latitude:lat,longitude:lng,updated_at:new Date().toISOString()}).eq('id',entity.id).then(()=>{}).catch(()=>{});
      return [lat,lng];
    }catch(e){console.warn('Geocoding skipped',query,e);return null}
  }

  function currentEntries(filter){
    if(filter==='all'){
      return M.hubs.map((h,i)=>({key:`h:${h.id}`,kind:'hub',entity:h,city:city(h.city_id),label:i+1,title:h.name,deadline:!!h.planned_departure_at,occurrences:[]}));
    }
    const rows=M.stops.filter(s=>s.city_id===filter&&s.stop_type!=='break');
    const by=new Map();
    rows.forEach(s=>{
      const key=s.place_id?`p:${s.place_id}`:s.hub_id?`h:${s.hub_id}`:`s:${s.id}`;
      if(!by.has(key)){
        const ent=s.place_id?place(s.place_id):s.hub_id?hub(s.hub_id):null;
        if(!ent)return;
        by.set(key,{key,kind:s.place_id?'place':'hub',entity:ent,city:city(s.city_id),label:s.sequence,title:s.title,deadline:!!s.is_hard_deadline,occurrences:[]});
      }
      by.get(key)?.occurrences.push(s);
    });
    return [...by.values()];
  }

  function popup(entry){
    const e=entry.entity,c=entry.city;
    const times=entry.occurrences.slice(0,3).map(s=>`${esc(s.route_date)} · ${esc(String(s.planned_start||'').slice(0,5)||'—')}`).join('<br>');
    const detail=entry.kind==='place'?`<button type="button" data-tm-place="${e.id}">Details</button>`:`<button type="button" data-tm-hub="${e.id}">Anchor info</button>`;
    return `<div class="tm-popup"><strong>${esc(e.name||entry.title)}</strong><small>${esc(c?.city_name||'')}${times?`<br>${times}`:''}</small><div class="tm-popup-actions">${detail}<a target="_blank" rel="noopener" href="${mapUrl(e.name,e.address,c?.city_name)}">Maps ↗</a></div></div>`;
  }

  function clearMap(){if(!M.map)return;M.layers.forEach(l=>{try{M.map.removeLayer(l)}catch{}});M.layers=[]}
  function pinIcon(entry){return L.divIcon({className:'',html:`<span class="tm-pin ${entry.kind==='hub'?'hub':''} ${entry.deadline?'deadline':''}">${esc(entry.label)}</span>`,iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-14]})}

  async function draw(){
    const token=++M.renderToken;if(!window.L)return;const s=shell();if(!s)return;if(!(await load(false)))return;if(token!==M.renderToken)return;
    const filter=activeCity(),entries=currentEntries(filter);setStatus(entries.length?`Resolving ${entries.length} stops…`:'No stops');
    const resolved=[];
    for(let i=0;i<entries.length;i++){
      if(token!==M.renderToken)return;
      const x=entries[i],p=await geocode(x.entity,x.kind==='place'?'travel_places':'travel_hubs',x.city?.city_name);if(p)resolved.push({...x,coords:p});setStatus(`Map ${Math.min(i+1,entries.length)}/${entries.length}`);
    }
    if(token!==M.renderToken)return;
    if(!M.map){M.map=L.map('tpGeoMap',{zoomControl:true,scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(M.map)}else{clearMap();setTimeout(()=>M.map.invalidateSize(),20)}
    const bounds=[];
    resolved.forEach(x=>{const m=L.marker(x.coords,{icon:pinIcon(x)}).bindPopup(popup(x));m.addTo(M.map);M.layers.push(m);bounds.push(x.coords)});

    if(filter!=='all'){
      const groups={};M.stops.filter(s=>s.city_id===filter&&s.stop_type!=='break').forEach(s=>(groups[s.route_date]??=[]).push(s));
      Object.values(groups).forEach(stops=>{
        const pts=[];stops.sort((a,b)=>a.sequence-b.sequence).forEach(s=>{const e=s.place_id?place(s.place_id):s.hub_id?hub(s.hub_id):null;const p=coords(e);if(p)pts.push(p)});
        if(pts.length>1){const line=L.polyline(pts,{weight:4,opacity:.5,dashArray:'8 7'}).addTo(M.map);M.layers.push(line)}
      });
    }else{
      const ordered=M.cities.map(c=>M.hubs.find(h=>h.city_id===c.id&&coords(h))).filter(Boolean).map(coords);
      if(ordered.length>1){const line=L.polyline(ordered,{weight:4,opacity:.45,dashArray:'10 8'}).addTo(M.map);M.layers.push(line)}
    }

    if(bounds.length===1)M.map.setView(bounds[0],14);else if(bounds.length>1)M.map.fitBounds(bounds,{padding:[35,35],maxZoom:15});else M.map.setView([48.4,16.2],5);
    setStatus(`${resolved.length}/${entries.length} exact pins`);
  }

  function schedule(delay=120){clearTimeout(M.timer);M.timer=setTimeout(()=>{const p=$("#pathwayTab");if(p&&!p.classList.contains('hidden'))draw()},delay)}
  async function boot(){
    let n=0;while((!$("#plannerView")||!window.L)&&n++<100)await new Promise(r=>setTimeout(r,100));if(!$("#plannerView")||!window.L)return;
    document.addEventListener('click',e=>{if(e.target.closest('[data-v2-tab="pathway"]')||e.target.closest('[data-tp-city]'))schedule(180)},true);
    $('#tripSelect')?.addEventListener('change',()=>{M.tripId=null;schedule(250)});
    const obs=new MutationObserver(()=>schedule(160));obs.observe($('#plannerView'),{childList:true,subtree:true});schedule(500);
  }
  boot().catch(e=>console.warn('Travel geographic map',e));
})();