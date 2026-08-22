(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_PATHWAY_V2__) return;
  window.__MEDORA_TRAVEL_PATHWAY_V2__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const S = {
    user: null,
    tripId: null,
    cities: [],
    places: [],
    hubs: [],
    routeStops: [],
    pathwayCity: "all",
    loading: null,
    refreshTimer: null
  };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cityById = id => S.cities.find(c => c.id === id);
  const placeById = id => S.places.find(p => p.id === id);
  const hubById = id => S.hubs.find(h => h.id === id);
  const TZ = { Budapest:"Europe/Budapest", Zagreb:"Europe/Zagreb", Bratislava:"Europe/Bratislava", Athens:"Europe/Athens" };
  const HUB_ICON = { hostel:"🛏", hotel:"🏨", airport:"✈", bus_station:"🚌", train_station:"🚆", meeting_point:"◎", other:"📍" };
  const MODE_ICON = { walk:"🚶", metro:"Ⓜ", tram:"🚋", bus:"🚌", train:"🚆", taxi:"🚕", airport_transfer:"⇄", flight:"✈", other:"→" };

  function toast(message, type="") {
    const n = $("#travelToast");
    if (!n) return;
    n.textContent = message;
    n.className = `travel-toast show ${type}`.trim();
    clearTimeout(toast._t);
    toast._t = setTimeout(() => n.className = "travel-toast", 2800);
  }

  function localDate(value) {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0,10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { weekday:"short", day:"numeric", month:"short", year:"numeric" }).format(d);
  }

  function cityDateTime(value, cityId) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const city = cityById(cityId);
    return new Intl.DateTimeFormat(undefined, {
      weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit",
      timeZone: TZ[city?.city_name] || undefined
    }).format(d);
  }

  function timeText(value) {
    if (!value) return "—";
    return String(value).slice(0,5);
  }

  function statusFor(place) {
    if (!place) return "saved";
    if (place.visit_status && place.visit_status !== "saved") return place.visit_status;
    return place.is_visited ? "visited" : "saved";
  }

  function mapSearchUrl(name, address, city) {
    const q = [address || name, !address ? city : ""].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function stopLocation(stop) {
    const city = cityById(stop.city_id);
    if (stop.hub_id) {
      const h = hubById(stop.hub_id);
      return h?.address || (h?.name ? `${h.name}, ${city?.city_name || ""}` : "");
    }
    if (stop.place_id) {
      const p = placeById(stop.place_id);
      return p?.address || (p?.name ? `${p.name}, ${city?.city_name || ""}` : "");
    }
    return "";
  }

  function directionsUrl(stops) {
    const locations = stops.map(stopLocation).filter(Boolean);
    if (!locations.length) return "";
    if (locations.length === 1) return mapSearchUrl(locations[0], "", "");
    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1,-1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
    return url;
  }

  async function load(force=false) {
    const tripId = $("#tripSelect")?.value || null;
    if (!tripId) return false;
    if (!force && S.tripId === tripId && S.cities.length) return true;
    if (S.loading) return S.loading;
    S.loading = (async () => {
      const { data:{ user } } = await db.auth.getUser();
      if (!user) return false;
      S.user = user;
      S.tripId = tripId;
      const [cities, places, hubs, routeStops] = await Promise.all([
        db.from("travel_cities").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_places").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_hubs").select("*").eq("trip_id",tripId).order("order_index"),
        db.from("travel_route_stops").select("*").eq("trip_id",tripId).order("route_date").order("sequence")
      ]);
      const failed = [cities,places,hubs,routeStops].find(x => x.error);
      if (failed) {
        console.warn("Travel Pathway load failed", failed.error);
        toast(failed.error.message || "Pathway could not load.", "error");
        return false;
      }
      S.cities = cities.data || [];
      S.places = places.data || [];
      S.hubs = hubs.data || [];
      S.routeStops = routeStops.data || [];
      if (S.pathwayCity !== "all" && !S.cities.some(c => c.id === S.pathwayCity)) S.pathwayCity = "all";
      return true;
    })();
    try { return await S.loading; } finally { S.loading = null; }
  }

  function installPathwayTab() {
    const tabs = $(".travel-tabs");
    if (!tabs) return false;
    if (!tabs.querySelector('[data-v2-tab="pathway"]')) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "travel-tab";
      b.dataset.v2Tab = "pathway";
      b.textContent = "Pathway";
      tabs.insertBefore(b, tabs.querySelector('[data-tab="bookings"]') || null);
      b.addEventListener("click", async e => {
        e.preventDefault();
        $(".travel-tab.active")?.classList.remove("active");
        b.classList.add("active");
        ["overviewTab","placesTab","itineraryTab","bookingsTab"].forEach(id => $("#"+id)?.classList.add("hidden"));
        const panel = $("#pathwayTab");
        panel?.classList.remove("hidden");
        if (await load(true)) renderPathway();
      });
    }
    if (!$("#pathwayTab")) {
      const panel = document.createElement("section");
      panel.id = "pathwayTab";
      panel.className = "travel-tab-panel hidden";
      $("#plannerView")?.appendChild(panel);
    }
    $$('.travel-tab[data-tab]').forEach(b => {
      if (b.dataset.tpBound) return;
      b.dataset.tpBound = "1";
      b.addEventListener("click", () => $("#pathwayTab")?.classList.add("hidden"));
    });
    return true;
  }

  function anchorMeta(h) {
    const parts = [];
    if (h.planned_arrival_at) parts.push(`Arrive ${cityDateTime(h.planned_arrival_at,h.city_id)}`);
    if (h.planned_departure_at) parts.push(`Leave ${cityDateTime(h.planned_departure_at,h.city_id)}`);
    if (h.buffer_minutes) parts.push(`${h.buffer_minutes} min buffer`);
    return parts.join(" · ") || (h.address || "Address not added yet");
  }

  function anchorCard(h) {
    const city = cityById(h.city_id);
    const missing = !h.address;
    return `<article class="tp-anchor ${missing?"missing":""}">
      <div class="tp-anchor-icon">${HUB_ICON[h.hub_type]||"📍"}</div>
      <div><strong>${esc(h.name)}</strong><small>${esc(city?.city_name||"")} · ${esc(h.hub_type.replaceAll("_"," "))}</small><small>${esc(anchorMeta(h))}</small></div>
      <div class="tp-anchor-actions">
        ${h.address?`<a class="travel-btn small" target="_blank" rel="noopener" href="${mapSearchUrl(h.name,h.address,city?.city_name)}">Map ↗</a>`:""}
        <button type="button" class="travel-btn small" data-tp-edit-hub="${h.id}">${missing?"Add address":"Edit"}</button>
        <span class="tp-chip ${h.is_confirmed?"visited":""}">${h.is_confirmed?"confirmed":"needs detail"}</span>
      </div>
    </article>`;
  }

  function routeGroups() {
    const filtered = S.pathwayCity === "all" ? S.routeStops : S.routeStops.filter(s => s.city_id === S.pathwayCity);
    const map = new Map();
    filtered.forEach(stop => {
      const key = `${stop.route_date}|${stop.city_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(stop);
    });
    return [...map.entries()].map(([key,stops]) => {
      const [date,cityId] = key.split("|");
      return { date, cityId, city:cityById(cityId), stops:stops.sort((a,b)=>a.sequence-b.sequence) };
    }).sort((a,b) => a.date.localeCompare(b.date) || Number(a.city?.order_index||0)-Number(b.city?.order_index||0));
  }

  function routeMap(stops) {
    const display = stops.filter(s => s.stop_type !== "break");
    return `<div class="tp-route-map">
      <div class="tp-section-head"><div><h3>Virtual pathway</h3><p>Every numbered stop is shown in sequence. Tap a place for details or open the route in Maps.</p></div></div>
      <div class="tp-route-map-line">
        ${display.map((s,i)=>`${i?`<span class="tp-map-link"></span>`:""}<div class="tp-map-stop"><span class="tp-map-dot ${s.stop_type}">${s.sequence}</span><span class="tp-map-label">${esc(s.title)}<span class="tp-map-mode">${MODE_ICON[s.travel_mode]||"→"} ${s.travel_minutes?`${s.travel_minutes} min · `:""}${esc(s.travel_mode.replaceAll("_"," "))}</span></span></div>`).join("")}
      </div>
    </div>`;
  }

  function stopActions(stop) {
    if (stop.place_id) {
      const p = placeById(stop.place_id);
      const st = statusFor(p);
      return `<div class="tp-stop-actions">
        <button type="button" class="travel-btn small" data-tp-info="${p.id}">Info</button>
        <button type="button" class="travel-btn small ${st==="found"?"active-found":""}" data-tp-status="found" data-place="${p.id}">✓ Found</button>
        <button type="button" class="travel-btn small ${st==="visited"?"active-visited":""}" data-tp-status="visited" data-place="${p.id}">✓ Visited</button>
        <a class="travel-btn small" target="_blank" rel="noopener" href="${mapSearchUrl(p.name,p.address,cityById(p.city_id)?.city_name)}">Map ↗</a>
      </div>`;
    }
    if (stop.hub_id) {
      const h = hubById(stop.hub_id), city = cityById(stop.city_id);
      return `<div class="tp-stop-actions">${h?.address?`<a class="travel-btn small" target="_blank" rel="noopener" href="${mapSearchUrl(h.name,h.address,city?.city_name)}">Map ↗</a>`:""}<button type="button" class="travel-btn small" data-tp-edit-hub="${h?.id||""}">${h?.address?"Anchor info":"Add address"}</button></div>`;
    }
    return "";
  }

  function stopRow(stop) {
    const p = placeById(stop.place_id);
    const status = p ? statusFor(p) : stop.status;
    const stateChip = status && status !== "saved" && status !== "planned" ? `<span class="tp-chip ${status}">${esc(status)}</span>` : "";
    return `<div class="tp-stop ${stop.is_hard_deadline?"deadline":""}">
      <div class="tp-node ${stop.stop_type}">${stop.sequence}</div>
      <div class="tp-stop-copy">
        <div class="tp-stop-title"><strong>${esc(stop.title)}</strong>${stateChip}${stop.is_hard_deadline?`<span class="tp-chip deadline">HARD TIME</span>`:""}</div>
        ${stop.notes?`<p>${esc(stop.notes)}</p>`:""}
        <div class="tp-stop-meta"><span class="tp-chip">${MODE_ICON[stop.travel_mode]||"→"} ${esc(stop.travel_mode.replaceAll("_"," "))}${stop.travel_minutes?` · ${stop.travel_minutes} min`:""}</span><span class="tp-chip">${esc(stop.stop_type)}</span></div>
      </div>
      <div class="tp-time"><strong>${timeText(stop.planned_start)}</strong><small>${stop.planned_end?`→ ${timeText(stop.planned_end)}`:""}</small></div>
      ${stopActions(stop)}
    </div>`;
  }

  function dayCard(group) {
    const url = directionsUrl(group.stops);
    const deadlines = group.stops.filter(s=>s.is_hard_deadline).length;
    return `<article class="tp-day">
      <header class="tp-day-head">
        <div><h3>${esc(group.city?.city_name||"")} · ${esc(localDate(group.date))}</h3><p>${group.stops.length} planned stops${deadlines?` · ${deadlines} fixed transport deadline${deadlines===1?"":"s"}`:""}</p></div>
        <div class="tp-day-actions">${url?`<a class="travel-btn small" target="_blank" rel="noopener" href="${url}">Open day route ↗</a>`:""}</div>
      </header>
      ${routeMap(group.stops)}
      <div class="tp-route">${group.stops.map(stopRow).join("")}</div>
    </article>`;
  }

  function renderPathway() {
    const panel = $("#pathwayTab");
    if (!panel) return;
    const groups = routeGroups();
    const anchors = S.pathwayCity === "all" ? S.hubs : S.hubs.filter(h => h.city_id === S.pathwayCity);
    const missing = S.hubs.filter(h => !h.address);
    const visited = S.places.filter(p=>statusFor(p)==="visited").length;
    const found = S.places.filter(p=>["found","visited"].includes(statusFor(p))).length;
    panel.innerHTML = `
      <section class="tp-hero"><div class="tp-hero-grid"><div><span class="eyebrow light">SMART TRIP PATHWAY</span><h2>Your trip, timed around the things you cannot miss.</h2><p>Hostels, bus stations, airports and sightseeing stops are connected to fixed departures. Travel times are planning buffers — open Maps for live routing when you travel.</p><span class="tp-private">🔒 Private · only your signed-in Medora account can read these route rows</span></div><div class="tp-hero-stat"><strong>${found}/${S.places.length}</strong><small>found · ${visited} visited</small></div></div></section>
      ${missing.length?`<div class="tp-alert"><div><strong>One route anchor still needs your exact address</strong><span>${esc(missing.map(h=>h.name).join(", "))}. Add it and the pathway / Maps links will use it immediately.</span></div><button type="button" class="travel-btn small" data-tp-edit-hub="${missing[0].id}">Add address</button></div>`:""}
      <div class="tp-city-filter"><button type="button" data-tp-city="all" class="${S.pathwayCity==="all"?"active":""}">Whole trip</button>${S.cities.map(c=>`<button type="button" data-tp-city="${c.id}" class="${S.pathwayCity===c.id?"active":""}">${esc(c.city_name)}</button>`).join("")}</div>
      <section class="tp-anchor-panel"><div class="tp-section-head"><div><h3>Stay & transport anchors</h3><p>These are the places that the route must respect: accommodation, stations and airports.</p></div></div><div class="tp-anchors">${anchors.length?anchors.map(anchorCard).join(""):`<div class="tp-empty"><strong>No anchors in this view</strong></div>`}</div></section>
      ${groups.length?groups.map(dayCard).join(""):`<div class="tp-empty"><strong>No timed pathway yet</strong><small>Add route stops for this trip.</small></div>`}
    `;
    bindPathwayActions();
  }

  async function setPlaceStatus(placeId, requested) {
    const p = placeById(placeId);
    if (!p) return;
    const current = statusFor(p);
    const next = current === requested ? "saved" : requested;
    const now = new Date().toISOString();
    const payload = {
      visit_status: next,
      is_visited: next === "visited",
      found_at: ["found","visited"].includes(next) ? (p.found_at || now) : null,
      visited_at: next === "visited" ? now : null,
      updated_at: now
    };
    const { error } = await db.from("travel_places").update(payload).eq("id",placeId);
    if (error) return toast(error.message,"error");
    const routeStatus = next === "saved" ? "planned" : next;
    await db.from("travel_route_stops").update({status:routeStatus,updated_at:now}).eq("place_id",placeId).eq("trip_id",S.tripId);
    Object.assign(p,payload);
    S.routeStops.filter(s=>s.place_id===placeId).forEach(s=>s.status=routeStatus);
    toast(next === "saved" ? "Place reset to saved." : `Marked ${next}.`,"success");
    if (!$("#pathwayTab")?.classList.contains("hidden")) renderPathway();
    enhancePlaceCards();
    if ($("#tpPlaceDialog")?.open) openPlaceInfo(placeId);
  }

  function placeInfoHtml(p) {
    const city = cityById(p.city_id), st = statusFor(p);
    return `<div class="tp-dialog-inner">
      <div class="tp-dialog-head"><div><span class="eyebrow">${esc(city?.city_name||"")} · ${esc(p.priority||"")}</span><h2>${esc(p.name)}</h2></div><button type="button" class="icon-close" data-tp-close>×</button></div>
      <div class="tp-detail-grid">
        <div class="tp-detail"><small>Status</small><strong>${esc(st)}</strong></div>
        <div class="tp-detail"><small>Category</small><strong>${esc(p.category||"Place")}</strong></div>
        <div class="tp-detail"><small>Best time</small><strong>${esc(p.best_time||"Flexible")}</strong></div>
        <div class="tp-detail"><small>Typical time</small><strong>${p.estimated_minutes?`≈ ${p.estimated_minutes} min`:"Not set"}</strong></div>
        <div class="tp-detail"><small>Opening hours</small><strong>${esc(p.opening_hours_text||"Recheck before travel")}</strong></div>
        <div class="tp-detail"><small>Entry / ticket</small><strong>${esc(p.entry_fee_note||"Check venue information")}</strong></div>
      </div>
      <div class="tp-info-block"><strong>Why it is on your route</strong><p>${esc(p.why_visit||p.notes||"Saved as part of your trip.")}</p></div>
      ${p.seasonal_note?`<div class="tp-info-block"><strong>Seasonal note</strong><p>${esc(p.seasonal_note)}</p></div>`:""}
      ${p.address?`<div class="tp-info-block"><strong>Location</strong><p>${esc(p.address)}</p></div>`:""}
      <div class="tp-dialog-actions">
        <button type="button" class="travel-btn ${st==="found"?"success":""}" data-tp-status="found" data-place="${p.id}">✓ Found</button>
        <button type="button" class="travel-btn ${st==="visited"?"success":""}" data-tp-status="visited" data-place="${p.id}">✓ Visited</button>
        <a class="travel-btn" target="_blank" rel="noopener" href="${mapSearchUrl(p.name,p.address,city?.city_name)}">Open map ↗</a>
        ${p.source_url?`<a class="travel-btn" target="_blank" rel="noopener" href="${esc(p.source_url)}">Official / info ↗</a>`:""}
      </div>
    </div>`;
  }

  function ensureDialogs() {
    if (!$("#tpPlaceDialog")) {
      const d = document.createElement("dialog"); d.id="tpPlaceDialog"; d.className="tp-dialog"; document.body.appendChild(d);
      d.addEventListener("click",e=>{if(e.target===d)d.close()});
    }
    if (!$("#tpHubDialog")) {
      const d = document.createElement("dialog"); d.id="tpHubDialog"; d.className="tp-dialog"; document.body.appendChild(d);
      d.addEventListener("click",e=>{if(e.target===d)d.close()});
    }
  }

  function openPlaceInfo(id) {
    ensureDialogs();
    const p = placeById(id); if (!p) return;
    const d = $("#tpPlaceDialog"); d.innerHTML = placeInfoHtml(p); d.showModal();
    d.querySelector('[data-tp-close]').onclick=()=>d.close();
    d.querySelectorAll('[data-tp-status]').forEach(b=>b.onclick=()=>setPlaceStatus(b.dataset.place,b.dataset.tpStatus));
  }

  function openHubEditor(id) {
    ensureDialogs();
    const h = hubById(id); if (!h) return;
    const city = cityById(h.city_id);
    const d = $("#tpHubDialog");
    d.innerHTML = `<div class="tp-dialog-inner"><div class="tp-dialog-head"><div><span class="eyebrow">PRIVATE ROUTE ANCHOR</span><h2>${esc(h.name)}</h2></div><button type="button" class="icon-close" data-tp-close>×</button></div>
      <form id="tpHubForm" class="tp-form">
        <label><span>Name</span><input id="tpHubName" maxlength="160" required value="${esc(h.name)}"></label>
        <label><span>Type</span><select id="tpHubType">${[["hostel","Hostel"],["hotel","Hotel"],["airport","Airport"],["bus_station","Bus station"],["train_station","Train station"],["meeting_point","Meeting point"],["other","Other"]].map(([v,l])=>`<option value="${v}" ${h.hub_type===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <label><span>Exact address</span><input id="tpHubAddress" maxlength="300" placeholder="Street, number, city, country" value="${esc(h.address||"")}"></label>
        <label><span>Safety buffer before departure (minutes)</span><input id="tpHubBuffer" type="number" min="0" max="360" value="${Number(h.buffer_minutes||0)}"></label>
        <label><span>Confirmed?</span><select id="tpHubConfirmed"><option value="true" ${h.is_confirmed?"selected":""}>Yes</option><option value="false" ${!h.is_confirmed?"selected":""}>Not yet</option></select></label>
        <div class="tp-dialog-actions"><button type="submit" class="travel-btn primary">Save anchor</button>${h.address?`<a class="travel-btn" target="_blank" rel="noopener" href="${mapSearchUrl(h.name,h.address,city?.city_name)}">Check on map ↗</a>`:""}</div>
      </form></div>`;
    d.showModal();
    d.querySelector('[data-tp-close]').onclick=()=>d.close();
    d.querySelector('#tpHubForm').onsubmit=async e=>{
      e.preventDefault();
      const payload={name:$('#tpHubName',d).value.trim(),hub_type:$('#tpHubType',d).value,address:$('#tpHubAddress',d).value.trim()||null,buffer_minutes:Number($('#tpHubBuffer',d).value||0),is_confirmed:$('#tpHubConfirmed',d).value==='true',updated_at:new Date().toISOString()};
      const {error}=await db.from('travel_hubs').update(payload).eq('id',h.id);
      if(error)return toast(error.message,'error');
      if(['hostel','hotel'].includes(payload.hub_type) && city){await db.from('travel_cities').update({accommodation_name:payload.name,accommodation_address:payload.address,updated_at:new Date().toISOString()}).eq('id',city.id)}
      Object.assign(h,payload);d.close();toast('Route anchor saved.','success');renderPathway();
    };
  }

  function bindPathwayActions() {
    $$('[data-tp-city]').forEach(b=>b.onclick=()=>{S.pathwayCity=b.dataset.tpCity;renderPathway()});
    $$('[data-tp-info]').forEach(b=>b.onclick=()=>openPlaceInfo(b.dataset.tpInfo));
    $$('[data-tp-status]').forEach(b=>b.onclick=()=>setPlaceStatus(b.dataset.place,b.dataset.tpStatus));
    $$('[data-tp-edit-hub]').forEach(b=>b.onclick=()=>openHubEditor(b.dataset.tpEditHub));
  }

  function updatePlaceCard(card, p) {
    if (!card || !p) return;
    card.dataset.tpEnhanced="1";
    card.classList.toggle("tp-visited",statusFor(p)==="visited");
    let status = card.querySelector('.tp-place-status');
    if (!status) {
      status=document.createElement('div');status.className='tp-place-status';card.querySelector('.place-copy')?.appendChild(status);
    }
    const st=statusFor(p);status.innerHTML=`<span class="tp-place-state ${st}">${esc(st)}</span>`;
    const actions=card.querySelector('.place-actions');
    if(actions){
      actions.querySelectorAll('[data-tp-card-action]').forEach(x=>x.remove());
      const wrap=document.createDocumentFragment();
      const info=document.createElement('button');info.type='button';info.className='travel-btn small';info.dataset.tpCardAction='1';info.textContent='Info';info.onclick=e=>{e.stopPropagation();openPlaceInfo(p.id)};wrap.appendChild(info);
      const found=document.createElement('button');found.type='button';found.className=`travel-btn small ${st==='found'?'active-found':''}`;found.dataset.tpCardAction='1';found.textContent='✓ Found';found.onclick=e=>{e.stopPropagation();setPlaceStatus(p.id,'found')};wrap.appendChild(found);
      const visited=document.createElement('button');visited.type='button';visited.className=`travel-btn small ${st==='visited'?'success':''}`;visited.dataset.tpCardAction='1';visited.textContent='✓ Visited';visited.onclick=e=>{e.stopPropagation();setPlaceStatus(p.id,'visited')};wrap.appendChild(visited);
      actions.prepend(wrap);
    }
  }

  function enhancePlaceCards() {
    $$('#placesTab .place-card').forEach(card=>{
      const id=card.querySelector('[data-toggle-place]')?.dataset.togglePlace;
      const p=placeById(id);if(p)updatePlaceCard(card,p);
    });
  }

  function scheduleRefresh() {
    clearTimeout(S.refreshTimer);
    S.refreshTimer=setTimeout(async()=>{
      installPathwayTab();
      const tripId=$("#tripSelect")?.value;
      if(tripId && tripId!==S.tripId) await load(true);
      if(!S.cities.length && tripId) await load(true);
      enhancePlaceCards();
    },80);
  }

  async function boot() {
    let tries=0;
    while(!$("#plannerView") && tries<60){await new Promise(r=>setTimeout(r,100));tries++}
    if(!$("#plannerView"))return;
    installPathwayTab();ensureDialogs();
    await load(true);
    enhancePlaceCards();
    $("#tripSelect")?.addEventListener("change",async()=>{await load(true);if(!$("#pathwayTab")?.classList.contains('hidden'))renderPathway()});
    document.addEventListener('click',e=>{if(e.target.closest('[data-tab="places"]'))setTimeout(enhancePlaceCards,80)},true);
    const obs=new MutationObserver(scheduleRefresh);obs.observe($("#plannerView"),{childList:true,subtree:true});
  }

  boot().catch(err=>{console.error("Travel Pathway v2",err);toast("Travel pathway could not start.","error")});
})();
