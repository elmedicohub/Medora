(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_MAP_22__) return;
  window.__MEDORA_TRAVEL_MAP_22__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const M={tripId:null,cities:[],places:[],hubs:[],stops:[],map:null,layers:[],loading:null,lastGeocode:0,renderToken:0,timer:null,observer:null};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const city=id=>M.cities.find(x=>x.id===id), place=id=>M.places.find(x=>x.id===id), hub=id=>M.hubs.find(x=>x.id===id);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const coord=e=>{const a=num(e?.latitude),b=num(e?.longitude);return a!==null&&b!==null?[a,b]:null};

  function activeCity(){return $(".tp-city-filter button.active[data-tp-city]")?.dataset.tpCity||"all"}
  function mapUrl(name,address,cityName){const q=[address||name,!address?cityName:""].filter(Boolean).join(", ");return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}
  function setStatus(t){const n=$("#tmStatus");if(n)n.textContent=t}

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

  function destroyMap(){
    if(M.map){try{M.map.remove()}catch{}}
    M.map=null;M.layers=[];
  }

  function ensureShell(){
    let s=$("#tpGeoMapShell");if(s)return s;
    const panel=$("#pathwayTab");if(!panel)return null;
    destroyMap();
    s=document.createElement('section');s.id='tpGeoMapShell';s.className='tm-shell';
    s.innerHTML=`<header class="tm-head"><div><h3>Exact-stop map</h3><p>Saved accommodation, stations, airports and sightseeing pins. Route lines show sequence; live road/transit navigation opens separately.</p></div><span id="tmStatus" class="tm-status">Preparing map…</span></header><div id="tpGeoMap" class="tm-map"></div><footer class="tm-foot"><span><strong>Map data:</strong> OpenStreetMap · coordinates are cached in your private trip rows.</span><span>Straight lines = pathway sequence, not turn-by-turn directions.</span></footer>`;
    const after=$(".tp-city-filter",panel)||$(".tp-hero",panel);if(after)after.insertAdjacentElement('afterend',s);else panel.prepend(s);
    s.addEventListener('click',e=>{
      const p=e.target.closest('[data-tm-place]');if(p){document.querySelector(`[data-tp-info="${p.dataset.tmPlace}"]`)?.click();return}
      const h=e.target.closest('[data-tm-hub]');if(h)document.querySelector(`[data-tp-edit-hub="${h.dataset.tmHub}"]`)?.click();
    });
    return s;
  }

  async function geocode(entity,table,cityName){
    const c=coord(entity);if(c)return c;
    const q=entity.address||[entity.name,cityName].filter(Boolean).join(', ');if(!q)return null;
    const wait=Math.max(0,1100-(Date.now()-M.lastGeocode));if(wait)await new Promise(r=>setTimeout(r,wait));M.lastGeocode=Date.now();
    try{
      const u=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const res=await fetch(u,{headers:{Accept:'application/json','Accept-Language':'en'}});if(!res.ok)return null;
      const x=(await res.json())?.[0];if(!x)return null;const lat=Number(x.lat),lng=Number(x.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
      entity.latitude=lat;entity.longitude=lng;
      db.from(table).update({latitude:lat,longitude:lng,updated_at:new Date().toISOString()}).eq('id',entity.id).then(()=>{}).catch(()=>{});
      return [lat,lng];
    }catch(e){console.warn('Travel geocode skipped',q,e);return null}
  }

  function entries(filter){
    if(filter==='all')return M.hubs.map((h,i)=>({kind:'hub',entity:h,city:city(h.city_id),label:i+1,title:h.name,deadline:!!h.planned_departure_at,occ:[]}));
    const map=new Map();
    M.stops.filter(s=>s.city_id===filter&&s.stop_type!=='break').forEach(s=>{
      const key=s.place_id?`p:${s.place_id}`:s.hub_id?`h:${s.hub_id}`:null;if(!key)return;
      if(!map.has(key)){
        const e=s.place_id?place(s.place_id):hub(s.hub_id);if(!e)return;
        map.set(key,{kind:s.place_id?'place':'hub',entity:e,city:city(s.city_id),label:s.sequence,title:s.title,deadline:!!s.is_hard_deadline,occ:[]});
      }
      map.get(key).occ.push(s);
    });
    return [...map.values()];
  }

  function popup(x){
    const e=x.entity,c=x.city,t=x.occ.slice(0,3).map(s=>`${esc(s.route_date)} · ${esc(String(s.planned_start||'').slice(0,5)||'—')}`).join('<br>');
    const detail=x.kind==='place'?`<button type="button" data-tm-place="${e.id}">Details</button>`:`<button type="button" data-tm-hub="${e.id}">Anchor info</button>`;
    return `<div class="tm-popup"><strong>${esc(e.name||x.title)}</strong><small>${esc(c?.city_name||'')}${t?`<br>${t}`:''}</small><div class="tm-popup-actions">${detail}<a target="_blank" rel="noopener" href="${mapUrl(e.name,e.address,c?.city_name)}">Maps ↗</a></div></div>`;
  }

  function icon(x){return L.divIcon({className:'',html:`<span class="tm-pin ${x.kind==='hub'?'hub':''} ${x.deadline?'deadline':''}">${esc(x.label)}</span>`,iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-14]})}
  function removeLayers(){if(!M.map)return;M.layers.forEach(l=>{try{M.map.removeLayer(l)}catch{}});M.layers=[]}

  async function draw(){
    const panel=$("#pathwayTab");if(!panel||panel.classList.contains('hidden')||!window.L)return;
    const token=++M.renderToken;if(!(await load(false))||token!==M.renderToken)return;
    ensureShell();const mapEl=$("#tpGeoMap");if(!mapEl)return;
    if(M.map&&M.map.getContainer()!==mapEl)destroyMap();
    const filter=activeCity(),list=entries(filter),resolved=[];setStatus(list.length?`Resolving ${list.length} stops…`:'No stops');
    for(let i=0;i<list.length;i++){
      if(token!==M.renderToken)return;
      const x=list[i],c=await geocode(x.entity,x.kind==='place'?'travel_places':'travel_hubs',x.city?.city_name);if(c)resolved.push({...x,coord:c});setStatus(`Map ${i+1}/${list.length}`);
    }
    if(token!==M.renderToken)return;
    if(!M.map){M.map=L.map(mapEl,{zoomControl:true,scrollWheelZoom:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(M.map)}else removeLayers();
    const bounds=[];
    resolved.forEach(x=>{const marker=L.marker(x.coord,{icon:icon(x)}).bindPopup(popup(x));marker.addTo(M.map);M.layers.push(marker);bounds.push(x.coord)});

    if(filter==='all'){
      const pts=M.cities.map(c=>M.hubs.find(h=>h.city_id===c.id&&coord(h))).filter(Boolean).map(coord);
      if(pts.length>1){const l=L.polyline(pts,{weight:4,opacity:.45,dashArray:'10 8'}).addTo(M.map);M.layers.push(l)}
    }else{
      const by={};M.stops.filter(s=>s.city_id===filter&&s.stop_type!=='break').forEach(s=>(by[s.route_date]??=[]).push(s));
      Object.values(by).forEach(rows=>{const pts=[];rows.sort((a,b)=>a.sequence-b.sequence).forEach(s=>{const e=s.place_id?place(s.place_id):s.hub_id?hub(s.hub_id):null,c=coord(e);if(c)pts.push(c)});if(pts.length>1){const l=L.polyline(pts,{weight:4,opacity:.5,dashArray:'8 7'}).addTo(M.map);M.layers.push(l)}});
    }

    if(bounds.length===1)M.map.setView(bounds[0],14);else if(bounds.length>1)M.map.fitBounds(bounds,{padding:[35,35],maxZoom:15});else M.map.setView([48.4,16.2],5);
    setTimeout(()=>M.map?.invalidateSize(),30);setStatus(`${resolved.length}/${list.length} exact pins`);
  }

  function schedule(ms=160){clearTimeout(M.timer);M.timer=setTimeout(draw,ms)}
  async function boot(){
    let n=0;while((!$("#plannerView")||!window.L)&&n++<100)await new Promise(r=>setTimeout(r,100));if(!$("#plannerView")||!window.L)return;
    document.addEventListener('click',e=>{if(e.target.closest('[data-v2-tab="pathway"]')||e.target.closest('[data-tp-city]')||e.target.closest('[data-tp-status]'))schedule(260)},true);
    $('#tripSelect')?.addEventListener('change',()=>{M.tripId=null;destroyMap();schedule(350)});
    const p=$("#pathwayTab");if(p){M.observer=new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.id!=='tpGeoMapShell')||[...x.removedNodes].some(n=>n.id==='tpGeoMapShell')))schedule(220)});M.observer.observe(p,{childList:true})}
    schedule(500);
  }
  boot().catch(e=>console.warn('Travel exact map',e));
})();