(() => {
  "use strict";

  const config = window.MEDORA_CONFIG || {};
  const db = window.supabase?.createClient?.(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const state = {
    user: null,
    trips: [],
    trip: null,
    cities: [],
    places: [],
    itinerary: [],
    bookings: [],
    selectedCityId: null,
    activeTab: "overview",
    placeFilter: "all"
  };

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  const EURO_TEMPLATE = {
    trip: {
      title: "EURO TRIP · Budapest → Zagreb → Bratislava → Athens",
      start_date: "2026-12-27",
      end_date: "2027-01-03",
      home_currency: "EUR",
      status: "planning",
      notes: "Winter city trip template. Confirm attraction hours and seasonal events close to travel dates."
    },
    cities: [
      { city_name:"Budapest", country_name:"Hungary", country_code:"HU", order_index:1, notes:"Budapest stay begins 27 Dec. Castle Hill + Danube are the core; thermal bath is excellent in winter." },
      { city_name:"Zagreb", country_name:"Croatia", country_code:"HR", order_index:2, notes:"Compact centre: Dolac → Upper Town → Lower Town. Advent Zagreb is a major late-December bonus; verify 2026 dates." },
      { city_name:"Bratislava", country_name:"Slovakia", country_code:"SK", order_index:3, notes:"Very walkable centre. Castle + Old Town fit comfortably in one day; Devín is the optional add-on." },
      { city_name:"Athens", country_name:"Greece", country_code:"GR", order_index:4, notes:"Prioritize Acropolis early, then Agora/Plaka. Sunset viewpoint only if daylight and weather cooperate." }
    ],
    places: {
      Budapest: [
        {place_key:"bud-parliament",name:"Hungarian Parliament Building",category:"landmark",priority:"must",estimated_minutes:75,best_time:"Morning / blue hour outside",neighborhood:"Kossuth tér",address:"Kossuth Lajos tér 1-3, Budapest, Hungary",notes:"Iconic Danube landmark. Book an interior tour only from an official/authorized channel; exterior + river view are essential.",source_url:"https://www.budapest.com/en/locations/parliament-building",order_index:1},
        {place_key:"bud-shoes",name:"Shoes on the Danube Bank",category:"memorial",priority:"must",estimated_minutes:25,best_time:"Before/after Parliament",neighborhood:"Danube promenade",address:"Shoes on the Danube Bank, Budapest, Hungary",notes:"Powerful Holocaust memorial a short walk from Parliament.",order_index:2},
        {place_key:"bud-chain",name:"Széchenyi Chain Bridge",category:"landmark",priority:"must",estimated_minutes:25,best_time:"Walk across near sunset or after dark",neighborhood:"Danube",address:"Széchenyi Chain Bridge, Budapest, Hungary",notes:"Walk it rather than only viewing it; it links Pest directly to Castle Hill.",order_index:3},
        {place_key:"bud-buda",name:"Buda Castle & Castle District",category:"historic district",priority:"must",estimated_minutes:120,best_time:"Afternoon",neighborhood:"Castle Hill",address:"Buda Castle, Budapest, Hungary",notes:"Treat the whole hill as one cluster: courtyards, viewpoints, old streets and palace terraces.",source_url:"https://www.budapestinfo.org/castledistrict/",order_index:4},
        {place_key:"bud-fisher",name:"Fisherman’s Bastion",category:"viewpoint",priority:"must",estimated_minutes:45,best_time:"Late afternoon / night",neighborhood:"Castle Hill",address:"Fisherman’s Bastion, Budapest, Hungary",notes:"One of the best Parliament/Danube views. Combine with Matthias Church.",source_url:"https://www.budapestinfo.hu/en/fishermans-bastion",order_index:5},
        {place_key:"bud-matthias",name:"Matthias Church",category:"church",priority:"should",estimated_minutes:40,best_time:"With Fisherman’s Bastion",neighborhood:"Castle Hill",address:"Matthias Church, Szentháromság tér 2, Budapest, Hungary",notes:"Distinctive tiled roof and historic interior; ideal paired stop on Castle Hill.",order_index:6},
        {place_key:"bud-basilica",name:"St. Stephen’s Basilica",category:"church",priority:"must",estimated_minutes:60,best_time:"Late morning / evening exterior",neighborhood:"District V",address:"Szent István tér 1, Budapest, Hungary",notes:"See the interior; panorama terrace is worthwhile if weather is clear.",source_url:"https://www.budapest.com/en/locations/st-stephens-basilica",order_index:7},
        {place_key:"bud-szechenyi",name:"Széchenyi Thermal Bath",category:"experience",priority:"must",estimated_minutes:150,best_time:"Late afternoon / evening",neighborhood:"City Park",address:"Széchenyi Thermal Bath, Budapest, Hungary",notes:"Winter highlight. Allow extra time for changing, lockers and transit.",order_index:8},
        {place_key:"bud-heroes",name:"Heroes’ Square & City Park",category:"square / park",priority:"should",estimated_minutes:55,best_time:"Before the thermal bath",neighborhood:"Városliget",address:"Heroes’ Square, Budapest, Hungary",notes:"Easy pairing with Széchenyi Bath and the park architecture.",order_index:9},
        {place_key:"bud-market",name:"Central Market Hall",category:"market",priority:"should",estimated_minutes:60,best_time:"Morning / lunch",neighborhood:"Fővám tér",address:"Central Market Hall, Vámház körút 1-3, Budapest, Hungary",notes:"Good for Hungarian food, paprika, souvenirs and a warm indoor stop.",order_index:10},
        {place_key:"bud-cruise",name:"Danube evening cruise",category:"experience",priority:"should",estimated_minutes:75,best_time:"After dark",neighborhood:"Danube",address:"Danube Promenade, Budapest, Hungary",notes:"The Parliament and Castle lighting make the river perspective especially strong at night.",order_index:11},
        {place_key:"bud-winter",name:"Vörösmarty / Basilica festive centre",category:"seasonal",priority:"optional",estimated_minutes:75,best_time:"Evening",neighborhood:"Central Pest",address:"Vörösmarty tér, Budapest, Hungary",seasonal_note:"Late-December festive-market dates vary; verify the 2026 closing date before relying on it.",notes:"Add only if the 2026 festive markets are still operating during your dates.",order_index:12}
      ],
      Zagreb: [
        {place_key:"zag-ban",name:"Ban Jelačić Square",category:"square",priority:"must",estimated_minutes:30,best_time:"Start / evening",neighborhood:"Lower Town",address:"Ban Jelačić Square, Zagreb, Croatia",notes:"Best orientation point and natural start for the historic core.",order_index:1},
        {place_key:"zag-dolac",name:"Dolac Market",category:"market",priority:"must",estimated_minutes:45,best_time:"Morning",neighborhood:"Kaptol",address:"Dolac Market, Zagreb, Croatia",notes:"Go early while the market is active; pair immediately with the cathedral area and Tkalčićeva.",source_url:"https://www.infozagreb.hr/hr/digital-nomads-and-zagreb/zagreb-top-10",order_index:2},
        {place_key:"zag-cathedral",name:"Zagreb Cathedral area",category:"church",priority:"must",estimated_minutes:35,best_time:"Morning",neighborhood:"Kaptol",address:"Zagreb Cathedral, Kaptol, Zagreb, Croatia",notes:"Even if interior access is restricted by ongoing restoration, the cathedral/Kaptol area remains a core city stop.",order_index:3},
        {place_key:"zag-tkalca",name:"Tkalčićeva Street",category:"street",priority:"must",estimated_minutes:60,best_time:"Lunch / evening",neighborhood:"Historic centre",address:"Tkalčićeva Street, Zagreb, Croatia",notes:"Cafés, food and atmosphere; it links the lower centre to the Upper Town walk.",order_index:4},
        {place_key:"zag-stone",name:"Stone Gate (Kamenita vrata)",category:"historic site",priority:"must",estimated_minutes:20,best_time:"En route to Upper Town",neighborhood:"Upper Town",address:"Stone Gate, Zagreb, Croatia",notes:"Small but distinctive devotional/historic gateway on the climb into Gradec.",order_index:5},
        {place_key:"zag-mark",name:"St. Mark’s Square & Church",category:"landmark",priority:"must",estimated_minutes:40,best_time:"Daylight",neighborhood:"Upper Town",address:"St. Mark’s Square, Zagreb, Croatia",notes:"The colourful tiled roof is Zagreb’s signature Upper Town image.",source_url:"https://www.infozagreb.hr/en/explore-zagreb/attractions/squares/st-marks-square",order_index:6},
        {place_key:"zag-lotrscak",name:"Lotrščak Tower & Upper Town viewpoints",category:"viewpoint",priority:"should",estimated_minutes:45,best_time:"Around midday / sunset",neighborhood:"Upper Town",address:"Lotrščak Tower, Zagreb, Croatia",notes:"Strong city panorama; combine with Strossmayer Promenade.",order_index:7},
        {place_key:"zag-funicular",name:"Zagreb Funicular",category:"experience",priority:"should",estimated_minutes:15,best_time:"Between Upper/Lower Town",neighborhood:"Upper Town",address:"Zagreb Funicular, Tomićeva ul., Zagreb, Croatia",notes:"Very short ride but a classic Zagreb experience.",order_index:8},
        {place_key:"zag-broken",name:"Museum of Broken Relationships",category:"museum",priority:"should",estimated_minutes:75,best_time:"Cold/rainy period",neighborhood:"Upper Town",address:"Ćirilometodska ul. 2, Zagreb, Croatia",notes:"Compact, unusual museum and an excellent indoor winter option.",order_index:9},
        {place_key:"zag-zrinjevac",name:"Zrinjevac & Lenuci Horseshoe",category:"park / architecture",priority:"should",estimated_minutes:60,best_time:"Late afternoon / evening",neighborhood:"Lower Town",address:"Zrinjevac, Zagreb, Croatia",notes:"Elegant parks and Austro-Hungarian streetscape; especially attractive with winter lights.",order_index:10},
        {place_key:"zag-advent",name:"Advent Zagreb zones",category:"seasonal",priority:"must",estimated_minutes:120,best_time:"Evening",neighborhood:"Central Zagreb",address:"Zrinjevac, Zagreb, Croatia",seasonal_note:"Advent Zagreb is a major seasonal event; verify exact 2026 dates and open zones before the trip.",notes:"If your late-December dates overlap, make this your evening plan rather than treating it as an extra.",source_url:"https://www.infozagreb.hr/en/events/other-events/advent-zagreb-en",order_index:11},
        {place_key:"zag-mirogoj",name:"Mirogoj Cemetery",category:"architecture",priority:"optional",estimated_minutes:75,best_time:"Daylight",neighborhood:"Mirogoj",address:"Mirogoj Cemetery, Zagreb, Croatia",notes:"Beautiful arcades and sculpture park; worthwhile only if you have extra time beyond the centre.",order_index:12}
      ],
      Bratislava: [
        {place_key:"bra-main",name:"Main Square & Old Town",category:"historic district",priority:"must",estimated_minutes:75,best_time:"Morning + evening",neighborhood:"Staré Mesto",address:"Hlavné námestie, Bratislava, Slovakia",notes:"Use this as the centre of the walking route: Old Town Hall, lanes, cafés and seasonal market area.",source_url:"https://www.visitbratislava.com/bratislava-in-2-days-for-first-timers/",order_index:1},
        {place_key:"bra-michael",name:"Michael’s Gate",category:"landmark",priority:"must",estimated_minutes:30,best_time:"Morning",neighborhood:"Old Town",address:"Michael's Gate, Bratislava, Slovakia",notes:"Only surviving medieval city gate and one of the most recognisable Old Town stops.",order_index:2},
        {place_key:"bra-cumil",name:"Čumil (Man at Work)",category:"public art",priority:"should",estimated_minutes:10,best_time:"While walking Old Town",neighborhood:"Old Town",address:"Čumil, Panská, Bratislava, Slovakia",notes:"Tiny stop, classic photo, directly on the historic walking circuit.",order_index:3},
        {place_key:"bra-martin",name:"St. Martin’s Cathedral",category:"church",priority:"must",estimated_minutes:40,best_time:"Before Castle climb",neighborhood:"Old Town edge",address:"St. Martin's Cathedral, Rudnayovo námestie, Bratislava, Slovakia",notes:"Historic coronation cathedral; natural bridge between Old Town and Castle Hill.",order_index:4},
        {place_key:"bra-castle",name:"Bratislava Castle & Baroque Garden",category:"castle",priority:"must",estimated_minutes:105,best_time:"Late morning / afternoon",neighborhood:"Castle Hill",address:"Bratislava Castle, Bratislava, Slovakia",notes:"Top panoramic stop. Grounds and garden matter even if you skip the museum interior.",source_url:"https://www.visitbratislava.com/places/bratislava-castle/",order_index:5},
        {place_key:"bra-blue",name:"Blue Church (St. Elizabeth)",category:"church",priority:"must",estimated_minutes:30,best_time:"Daylight",neighborhood:"Bezručova",address:"Blue Church, Bezručova 2, Bratislava, Slovakia",notes:"Distinctive Art Nouveau exterior; slightly outside the tightest Old Town loop but very walkable.",source_url:"https://www.visitbratislava.com/top10/10-things-you-can-experience-only-in-bratislava/",order_index:6},
        {place_key:"bra-hviez",name:"Hviezdoslavovo Square",category:"square",priority:"should",estimated_minutes:35,best_time:"Evening",neighborhood:"Old Town",address:"Hviezdoslavovo námestie, Bratislava, Slovakia",notes:"Broad pedestrian square leading toward the river; a seasonal-market location in winter.",order_index:7},
        {place_key:"bra-ufo",name:"UFO Observation Deck",category:"viewpoint",priority:"should",estimated_minutes:60,best_time:"Sunset / night",neighborhood:"Most SNP",address:"UFO Observation Deck, Most SNP, Bratislava, Slovakia",notes:"Modern counterpoint to the historic centre; good city/river views if weather is clear.",order_index:8},
        {place_key:"bra-primate",name:"Primate’s Palace",category:"palace",priority:"should",estimated_minutes:45,best_time:"Daytime",neighborhood:"Old Town",address:"Primate's Palace, Primaciálne námestie 2, Bratislava, Slovakia",notes:"Easy add beside Main Square; elegant courtyard and historic interior.",order_index:9},
        {place_key:"bra-market",name:"Christmas market squares",category:"seasonal",priority:"should",estimated_minutes:90,best_time:"Evening",neighborhood:"Main / Hviezdoslav Squares",address:"Hlavné námestie, Bratislava, Slovakia",seasonal_note:"The official 2026 schedule may change. The 2025 season ran to 6 Jan with holiday closures; verify your exact dates.",notes:"Treat as an evening atmosphere/food stop if operating.",source_url:"https://www.visitbratislava.com/christmas-in-bratislava/",order_index:10},
        {place_key:"bra-devin",name:"Devín Castle",category:"castle / excursion",priority:"optional",estimated_minutes:180,best_time:"Daylight / good weather",neighborhood:"Devín",address:"Devín Castle, Bratislava, Slovakia",notes:"Excellent Danube/Morava setting, but it costs transit time. Add only if you have more than a compact city day.",source_url:"https://www.visitbratislava.com/attraction-categories/parks-and-gardens/",order_index:11}
      ],
      Athens: [
        {place_key:"ath-acropolis",name:"Acropolis & Parthenon",category:"archaeology",priority:"must",estimated_minutes:120,best_time:"First entry / early morning",neighborhood:"Acropolis",address:"Acropolis of Athens, Athens, Greece",notes:"Non-negotiable. Go early; winter daylight is limited and the rock is much more enjoyable before crowds.",source_url:"https://www.thisisathens.org/itineraries/48-hour-itinerary",order_index:1},
        {place_key:"ath-museum",name:"Acropolis Museum",category:"museum",priority:"must",estimated_minutes:120,best_time:"After Acropolis / afternoon",neighborhood:"Makrygianni",address:"Acropolis Museum, Dionysiou Areopagitou 15, Athens, Greece",notes:"Best context for what you just saw on the Acropolis; also a strong bad-weather option.",order_index:2},
        {place_key:"ath-plaka",name:"Plaka & Anafiotika",category:"neighbourhood",priority:"must",estimated_minutes:90,best_time:"Late morning / evening",neighborhood:"Plaka",address:"Plaka, Athens, Greece",notes:"Wander rather than schedule every street. Anafiotika gives a tiny island-village feel beneath the Acropolis.",source_url:"https://www.thisisathens.org/neighbourhoods/plaka-guide",order_index:3},
        {place_key:"ath-agora",name:"Ancient Agora & Temple of Hephaestus",category:"archaeology",priority:"must",estimated_minutes:100,best_time:"Late morning / early afternoon",neighborhood:"Monastiraki / Thissio",address:"Ancient Agora of Athens, Adrianou 24, Athens, Greece",notes:"One of the best-preserved classical areas and much more spacious/relaxed than the Acropolis.",source_url:"https://www.thisisathens.org/antiquities/ancient-agora-stoa-attalos",order_index:4},
        {place_key:"ath-monast",name:"Monastiraki Square & Flea Market",category:"neighbourhood / shopping",priority:"must",estimated_minutes:75,best_time:"Afternoon / evening",neighborhood:"Monastiraki",address:"Monastiraki Square, Athens, Greece",notes:"Easy continuation from the Agora; good for street life, food, souvenirs and Acropolis views.",order_index:5},
        {place_key:"ath-syntagma",name:"Syntagma Square & Changing of the Guard",category:"civic landmark",priority:"should",estimated_minutes:45,best_time:"On the hour",neighborhood:"Syntagma",address:"Syntagma Square, Athens, Greece",notes:"See the Evzones at the Tomb of the Unknown Soldier; pair with the National Garden.",order_index:6},
        {place_key:"ath-garden",name:"National Garden",category:"park",priority:"should",estimated_minutes:45,best_time:"Daylight",neighborhood:"Syntagma",address:"National Garden, Athens, Greece",notes:"Quiet green connector between Syntagma and the stadium area.",order_index:7},
        {place_key:"ath-stadium",name:"Panathenaic Stadium",category:"landmark",priority:"should",estimated_minutes:60,best_time:"Daylight",neighborhood:"Pangrati",address:"Panathenaic Stadium, Vasileos Konstantinou, Athens, Greece",notes:"All-marble stadium tied to the first modern Olympics; good compact stop.",order_index:8},
        {place_key:"ath-zeus",name:"Hadrian’s Arch & Temple of Olympian Zeus",category:"archaeology",priority:"should",estimated_minutes:45,best_time:"Between Acropolis and Syntagma",neighborhood:"Historic centre",address:"Temple of Olympian Zeus, Athens, Greece",notes:"Easy geographic add-on rather than a separate trip across town.",order_index:9},
        {place_key:"ath-lycabettus",name:"Lycabettus Hill",category:"viewpoint",priority:"should",estimated_minutes:90,best_time:"Sunset",neighborhood:"Kolonaki",address:"Mount Lycabettus, Athens, Greece",notes:"Highest central viewpoint. Use funicular/taxi strategy if legs are tired after archaeology.",source_url:"https://www.thisisathens.org/itineraries/48-hour-itinerary",order_index:10},
        {place_key:"ath-philopappos",name:"Philopappos Hill / Acropolis viewpoint",category:"viewpoint",priority:"optional",estimated_minutes:75,best_time:"Golden hour",neighborhood:"Koukaki",address:"Philopappos Hill, Athens, Greece",notes:"Excellent free viewpoint and pleasant walk; choose this or Lycabettus if time is tight.",order_index:11}
      ]
    }
  };

  const FLAG = { HU:"🇭🇺", HR:"🇭🇷", SK:"🇸🇰", GR:"🇬🇷" };
  const CATEGORY_ICON = { flight:"✈️", train:"🚆", bus:"🚌", accommodation:"🛏️", attraction:"🎟️", restaurant:"🍽️", transfer:"🚕", other:"📌" };

  function toast(message, type = "") {
    const node = $("travelToast");
    node.textContent = message;
    node.className = `travel-toast show ${type}`.trim();
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => node.className = "travel-toast", 3000);
  }

  function formatDate(value, opts = {}) {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0,10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short",year:"numeric",...opts}).format(d);
  }

  function mapUrl(place, city) {
    const q = [place.name, place.address || "", city?.city_name || ""].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function setLoading(button, loading, text = "Working…") {
    if (!button) return;
    if (loading) { button.dataset.old = button.innerHTML; button.disabled = true; button.textContent = text; }
    else { button.disabled = false; if (button.dataset.old) button.innerHTML = button.dataset.old; }
  }

  async function boot() {
    if (!db || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
      $("travelLoading").innerHTML = "<strong>Medora configuration is unavailable.</strong>";
      return;
    }
    const { data } = await db.auth.getSession();
    state.user = data.session?.user || null;
    if (!state.user) {
      const embedded = new URLSearchParams(location.search).get("embedded") === "1";
      if (embedded && window.parent !== window) window.parent.location.href = "index.html";
      else location.href = "index.html";
      return;
    }
    $("travelLoading").classList.add("hidden");
    $("travelApp").classList.remove("hidden");
    if (new URLSearchParams(location.search).get("embedded") === "1") document.body.classList.add("embedded");
    bindStaticEvents();
    await loadTrips();
  }

  async function loadTrips(selectId = null) {
    const { data, error } = await db.from("travel_trips").select("*").eq("user_id",state.user.id).order("start_date",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});
    if (error) { toast(error.message,"error"); return; }
    state.trips = data || [];
    if (!state.trips.length) {
      state.trip = null; state.cities=[]; state.places=[]; state.itinerary=[]; state.bookings=[];
      renderShell();
      return;
    }
    const wanted = selectId || state.trip?.id || state.trips[0].id;
    state.trip = state.trips.find(x => x.id === wanted) || state.trips[0];
    await loadTripData();
  }

  async function loadTripData() {
    const tripId = state.trip.id;
    const [citiesRes, placesRes, itineraryRes, bookingsRes] = await Promise.all([
      db.from("travel_cities").select("*").eq("trip_id",tripId).order("order_index"),
      db.from("travel_places").select("*").eq("trip_id",tripId).order("order_index"),
      db.from("travel_itinerary_items").select("*").eq("trip_id",tripId).order("plan_date").order("start_time",{ascending:true,nullsFirst:false}).order("order_index"),
      db.from("travel_bookings").select("*").eq("trip_id",tripId).order("booking_date",{ascending:true,nullsFirst:false}).order("created_at")
    ]);
    const err = [citiesRes,placesRes,itineraryRes,bookingsRes].find(x => x.error)?.error;
    if (err) { toast(err.message,"error"); return; }
    state.cities = citiesRes.data || [];
    state.places = placesRes.data || [];
    state.itinerary = itineraryRes.data || [];
    state.bookings = bookingsRes.data || [];
    if (!state.cities.some(c => c.id === state.selectedCityId)) state.selectedCityId = state.cities[0]?.id || null;
    renderShell();
  }

  function renderShell() {
    const hasTrip = !!state.trip;
    $("emptyTravel").classList.toggle("hidden", hasTrip);
    $("plannerView").classList.toggle("hidden", !hasTrip);
    if (!hasTrip) return;
    $("tripTitle").textContent = state.trip.title;
    $("tripMeta").textContent = [state.trip.start_date && formatDate(state.trip.start_date), state.trip.end_date && formatDate(state.trip.end_date)].filter(Boolean).join(" → ") || "Dates not set";
    $("tripSelect").innerHTML = state.trips.map(t => `<option value="${t.id}" ${t.id===state.trip.id?"selected":""}>${esc(t.title)}</option>`).join("");
    const visited = state.places.filter(p=>p.is_visited).length;
    const must = state.places.filter(p=>p.priority==="must").length;
    const mustDone = state.places.filter(p=>p.priority==="must"&&p.is_visited).length;
    $("tripHeroStats").innerHTML = [
      [state.cities.length,"Cities"],
      [state.places.length,"Saved places"],
      [`${visited}/${state.places.length}`,"Visited"],
      [`${mustDone}/${must}`,"Must-sees done"]
    ].map(([a,b])=>`<div class="hero-stat"><strong>${a}</strong><small>${b}</small></div>`).join("");
    renderActiveTab();
  }

  function renderActiveTab() {
    qsa(".travel-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.activeTab));
    ["overview","places","itinerary","bookings"].forEach(tab=>$(tab+"Tab").classList.toggle("hidden",tab!==state.activeTab));
    if (state.activeTab === "overview") renderOverview();
    if (state.activeTab === "places") renderPlaces();
    if (state.activeTab === "itinerary") renderItinerary();
    if (state.activeTab === "bookings") renderBookings();
  }

  function cityProgress(cityId) {
    const list = state.places.filter(p=>p.city_id===cityId);
    const done = list.filter(p=>p.is_visited).length;
    return {total:list.length,done,pct:list.length?Math.round(done/list.length*100):0};
  }

  function selectedCity() { return state.cities.find(c=>c.id===state.selectedCityId) || null; }

  function renderOverview() {
    const city = selectedCity();
    const mustOpen = state.places.filter(p => p.city_id===city?.id && p.priority==="must" && !p.is_visited).slice(0,5);
    $("overviewTab").innerHTML = `
      <div class="overview-grid">
        <article class="panel panel-pad">
          <div class="panel-head"><div><h2>Your route</h2><p>Open a city to see its priorities and progress.</p></div><button class="travel-btn small" data-add-city>+ City</button></div>
          ${state.cities.length ? `<div class="city-grid">${state.cities.map(c=>{
            const pg=cityProgress(c.id);
            return `<div class="city-card ${c.id===state.selectedCityId?"active":""}" data-city-card="${c.id}">
              <div class="city-card-top"><div class="city-flag">${FLAG[c.country_code]||"📍"}</div><span class="badge">Stop ${c.order_index}</span></div>
              <h3>${esc(c.city_name)}</h3><p>${esc(c.country_name)}</p>
              <div class="city-progress-row"><div class="progress-track"><div class="progress-fill" style="width:${pg.pct}%"></div></div><strong>${pg.done}/${pg.total}</strong></div>
            </div>`;
          }).join("")}</div>` : `<div class="empty-state"><strong>No cities yet</strong><small>Add your first city, then build its must-see list.</small></div>`}
        </article>
        <div style="display:grid;gap:12px;align-content:start">
          <article class="seasonal-card">
            <span class="eyebrow light">WINTER-SMART</span>
            <h3>${city ? esc(city.city_name) : "Trip intelligence"}</h3>
            <p>${city?.notes ? esc(city.notes) : "Build the route around daylight, weather, opening hours and geographic clusters."}</p>
            <ul>
              <li>Put outdoor viewpoints in daylight.</li>
              <li>Keep museums / baths as weather-flex options.</li>
              <li>Verify holiday hours 48–72 h before each city.</li>
              <li>Group nearby sights instead of zig-zagging.</li>
            </ul>
          </article>
          <article class="panel panel-pad">
            <div class="panel-head"><div><h3>Next must-sees</h3><p>${city ? esc(city.city_name) : "Choose a city"}</p></div>${city?`<button class="travel-btn small" data-open-places>All places</button>`:""}</div>
            ${mustOpen.length ? `<div class="mini-list">${mustOpen.map(p=>`<div class="mini-list-item"><div><strong>${esc(p.name)}</strong><small>${esc(p.best_time||p.category)}</small></div><button class="travel-btn small" data-plan-place="${p.id}">Plan</button></div>`).join("")}</div>` : `<div class="empty-state"><strong>${city?"Must-sees complete or not added":"No city selected"}</strong><small>${city?"Move on to should-see and optional places.":"Add a city to start planning."}</small></div>`}
          </article>
        </div>
      </div>`;
    bindDynamic();
  }

  function renderPlaces() {
    const city = selectedCity();
    const list = state.places.filter(p => (!city || p.city_id===city.id) && (state.placeFilter==="all" || p.priority===state.placeFilter));
    const route = city ? state.places.filter(p=>p.city_id===city.id && p.priority!=="optional").sort((a,b)=>a.order_index-b.order_index).slice(0,8).map(p=>p.name).join(" → ") : "";
    $("placesTab").innerHTML = `
      <div class="city-filter">${state.cities.map(c=>`<button class="city-chip ${c.id===state.selectedCityId?"active":""}" data-select-city="${c.id}">${FLAG[c.country_code]||"📍"} ${esc(c.city_name)}</button>`).join("")}</div>
      <div class="place-toolbar">
        <div class="filter-group">${["all","must","should","optional"].map(f=>`<button class="priority-filter ${state.placeFilter===f?"active":""}" data-place-filter="${f}">${f==="all"?"All":f[0].toUpperCase()+f.slice(1)}</button>`).join("")}</div>
        <button class="travel-btn small" data-add-place>+ Custom place</button>
      </div>
      ${route ? `<div class="route-note"><strong>Compact route logic:</strong> ${esc(route)}. This is a priority sequence, not a rigid timetable; adjust for tickets, opening hours and weather.</div>` : ""}
      <div class="place-list">${list.length ? list.map(p=>placeCard(p)).join("") : `<div class="empty-state"><strong>No places in this filter</strong><small>Add a custom place or change the priority filter.</small></div>`}</div>`;
    bindDynamic();
  }

  function placeCard(p) {
    const city = state.cities.find(c=>c.id===p.city_id);
    return `<article class="place-card ${p.is_visited?"visited":""}">
      <button class="place-check ${p.is_visited?"done":""}" data-toggle-place="${p.id}" aria-label="Toggle visited"></button>
      <div class="place-copy"><h3>${esc(p.name)}</h3><p>${esc(p.notes||"")}</p>
        <div class="place-meta"><span class="badge ${p.priority}">${esc(p.priority)}</span><span class="badge">${esc(p.category)}</span>${p.estimated_minutes?`<span class="badge">≈ ${p.estimated_minutes} min</span>`:""}${p.best_time?`<span class="badge">${esc(p.best_time)}</span>`:""}${p.seasonal_note?`<span class="badge seasonal">Seasonal</span>`:""}</div>
        ${p.seasonal_note?`<p style="margin-top:9px"><strong>Seasonal note:</strong> ${esc(p.seasonal_note)}</p>`:""}
      </div>
      <div class="place-actions"><button class="travel-btn small" data-plan-place="${p.id}">+ Plan</button><a class="travel-btn small" href="${mapUrl(p,city)}" target="_blank" rel="noopener">Map ↗</a>${p.source_url?`<a class="travel-btn small" href="${esc(p.source_url)}" target="_blank" rel="noopener">Info ↗</a>`:""}</div>
    </article>`;
  }

  function suggestedDate(cityId) {
    if (!state.trip?.start_date) return "";
    const city = state.cities.find(c=>c.id===cityId);
    const d = new Date(`${state.trip.start_date}T12:00:00`);
    d.setDate(d.getDate() + Math.max(0, (Number(city?.order_index||1)-1)*2));
    return d.toISOString().slice(0,10);
  }

  function renderItinerary() {
    const grouped = state.itinerary.reduce((acc,item)=>{(acc[item.plan_date] ||= []).push(item);return acc;},{});
    const dates = Object.keys(grouped).sort();
    $("itineraryTab").innerHTML = `
      <div class="itinerary-layout">
        <div>${dates.length ? dates.map(date=>`<div class="day-group"><div class="day-head"><div><h3>${formatDate(date,{weekday:"long"})}</h3><small>${grouped[date].length} planned item${grouped[date].length===1?"":"s"}</small></div><button class="travel-btn small" data-add-itinerary-date="${date}">+ Item</button></div><div class="day-items">${grouped[date].map(item=>dayItem(item)).join("")}</div></div>`).join("") : `<div class="empty-state"><strong>Your days are still open</strong><small>Plan from a saved place or add a custom transport, meal, rest or event.</small></div>`}</div>
        <article class="panel"><form id="quickItineraryForm" class="side-form"><div class="panel-head"><div><h3>Quick day item</h3><p>Add something that is not a saved attraction.</p></div></div><label><span>Title</span><input id="quickItineraryTitle" required placeholder="Train, lunch, check-in…" /></label><label><span>Date</span><input id="quickItineraryDate" type="date" required value="${esc(state.trip.start_date||"")}" /></label><label><span>Time</span><input id="quickItineraryTime" type="time" /></label><label><span>Type</span><select id="quickItineraryType"><option value="transport">Transport</option><option value="food">Food</option><option value="rest">Rest</option><option value="shopping">Shopping</option><option value="event">Event</option><option value="custom">Custom</option></select></label><button class="travel-btn primary wide" type="submit">Add to itinerary <span>→</span></button></form></article>
      </div>`;
    bindDynamic();
  }

  function dayItem(item) {
    const place = state.places.find(p=>p.id===item.place_id);
    const city = state.cities.find(c=>c.id===item.city_id);
    return `<div class="day-item ${item.status==="done"?"done":""}"><div class="day-time">${item.start_time ? item.start_time.slice(0,5) : "—"}</div><div><strong>${esc(item.title)}</strong><small>${[city?.city_name,item.item_type,place?.best_time].filter(Boolean).map(esc).join(" · ")}</small></div><button class="travel-btn small ${item.status==="done"?"success":""}" data-toggle-itinerary="${item.id}">${item.status==="done"?"Done ✓":"Mark done"}</button></div>`;
  }

  function renderBookings() {
    const totals = state.bookings.reduce((acc,b)=>{ if (b.amount!=null && b.payment_status!=="refunded") acc[b.currency||"EUR"]=(acc[b.currency||"EUR"]||0)+Number(b.amount); return acc; },{});
    const paid = state.bookings.filter(b=>b.payment_status==="paid").length;
    const totalText = Object.entries(totals).length ? Object.entries(totals).map(([cur,val])=>`${val.toFixed(2)} ${cur}`).join(" + ") : "0";
    $("bookingsTab").innerHTML = `
      <div class="booking-summary"><div class="money-card"><strong>${esc(totalText)}</strong><small>Recorded trip cost · no FX conversion</small></div><div class="money-card"><strong>${state.bookings.length}</strong><small>Bookings / cost items</small></div><div class="money-card"><strong>${paid}/${state.bookings.length}</strong><small>Marked paid</small></div></div>
      <article class="panel panel-pad"><div class="panel-head"><div><h2>Bookings & spending</h2><p>Flights, stays, transport, attractions and other committed costs.</p></div><button class="travel-btn primary small" data-add-booking>+ Add booking</button></div>
      <div class="booking-list">${state.bookings.length ? state.bookings.map(bookingRow).join("") : `<div class="empty-state"><strong>No bookings recorded here yet</strong><small>Add only the details you want Medora to track. Avoid storing sensitive payment-card data.</small></div>`}</div></article>`;
    bindDynamic();
  }

  function bookingRow(b) {
    const city = state.cities.find(c=>c.id===b.city_id);
    return `<div class="booking-row"><div class="booking-icon">${CATEGORY_ICON[b.booking_type]||"📌"}</div><div><strong>${esc(b.title)}</strong><small>${[city?.city_name,b.provider,b.booking_date&&formatDate(b.booking_date)].filter(Boolean).map(esc).join(" · ")}</small></div><div class="booking-money">${b.amount!=null?`${Number(b.amount).toFixed(2)} ${esc(b.currency||"EUR")}`:"—"}<small>${b.reference_code?`Ref: ${esc(b.reference_code)}`:""}</small></div><span class="status-pill ${esc(b.payment_status)}">${esc(b.payment_status.replace("_"," "))}</span></div>`;
  }

  async function seedEuroTrip(button) {
    setLoading(button,true,"Building your trip…");
    const uid=state.user.id;
    const tripRes=await db.from("travel_trips").insert({...EURO_TEMPLATE.trip,user_id:uid}).select().single();
    if (tripRes.error){setLoading(button,false);toast(tripRes.error.message,"error");return;}
    const trip=tripRes.data;
    const citiesPayload=EURO_TEMPLATE.cities.map(c=>({...c,trip_id:trip.id,user_id:uid}));
    const citiesRes=await db.from("travel_cities").insert(citiesPayload).select();
    if (citiesRes.error){await db.from("travel_trips").delete().eq("id",trip.id);setLoading(button,false);toast(citiesRes.error.message,"error");return;}
    const cityMap=Object.fromEntries((citiesRes.data||[]).map(c=>[c.city_name,c.id]));
    const places=[];
    Object.entries(EURO_TEMPLATE.places).forEach(([cityName,list])=>list.forEach(p=>places.push({...p,trip_id:trip.id,city_id:cityMap[cityName],user_id:uid})));
    const placesRes=await db.from("travel_places").insert(places);
    if (placesRes.error){await db.from("travel_trips").delete().eq("id",trip.id);setLoading(button,false);toast(placesRes.error.message,"error");return;}
    setLoading(button,false);toast("EURO TRIP loaded into Medora.","success");await loadTrips(trip.id);
  }

  async function createTrip(event) {
    event.preventDefault();
    const payload={user_id:state.user.id,title:$("newTripTitle").value.trim(),start_date:$("newTripStart").value||null,end_date:$("newTripEnd").value||null,home_currency:$("newTripCurrency").value,status:"planning"};
    const {data,error}=await db.from("travel_trips").insert(payload).select().single();
    if(error){toast(error.message,"error");return;}
    $("newTripDialog").close();event.currentTarget.reset();toast("Trip created.","success");await loadTrips(data.id);
  }

  async function addCity() {
    const cityName = prompt("City name"); if(!cityName) return;
    const country = prompt("Country"); if(!country) return;
    const {data,error}=await db.from("travel_cities").insert({trip_id:state.trip.id,user_id:state.user.id,city_name:cityName.trim(),country_name:country.trim(),order_index:state.cities.length+1}).select().single();
    if(error){toast(error.message,"error");return;} state.selectedCityId=data.id;toast("City added.","success");await loadTripData();
  }

  async function addCustomPlace() {
    const city=selectedCity(); if(!city){toast("Add or select a city first.","error");return;}
    const name=prompt(`Place to add in ${city.city_name}`); if(!name) return;
    const priority=(prompt("Priority: must, should or optional","should")||"should").toLowerCase();
    const valid=["must","should","optional"].includes(priority)?priority:"should";
    const key=`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const {error}=await db.from("travel_places").insert({trip_id:state.trip.id,city_id:city.id,user_id:state.user.id,place_key:key,name:name.trim(),priority:valid,category:"custom",order_index:state.places.filter(p=>p.city_id===city.id).length+1});
    if(error){toast(error.message,"error");return;}toast("Place added.","success");await loadTripData();
  }

  async function togglePlace(id) {
    const p=state.places.find(x=>x.id===id); if(!p)return;
    const {error}=await db.from("travel_places").update({is_visited:!p.is_visited,updated_at:new Date().toISOString()}).eq("id",id);
    if(error){toast(error.message,"error");return;}p.is_visited=!p.is_visited;renderShell();
  }

  function openPlanDialog(placeId=null,dateOverride=null) {
    const place=state.places.find(p=>p.id===placeId);
    $("itineraryPlaceId").value=place?.id||"";
    $("itineraryTitle").value=place?.name||"";
    $("itineraryDate").value=dateOverride||suggestedDate(place?.city_id||state.selectedCityId)||state.trip.start_date||"";
    $("itineraryTime").value="";
    $("itineraryType").value=place?"visit":"custom";
    $("itineraryNotes").value=place?.notes||"";
    $("itineraryDialog").showModal();
  }

  async function saveItinerary(event) {
    event.preventDefault();
    const placeId=$("itineraryPlaceId").value||null;
    const place=state.places.find(p=>p.id===placeId);
    const payload={trip_id:state.trip.id,city_id:place?.city_id||state.selectedCityId||null,place_id:placeId,user_id:state.user.id,plan_date:$("itineraryDate").value,start_time:$("itineraryTime").value||null,title:$("itineraryTitle").value.trim(),item_type:$("itineraryType").value,notes:$("itineraryNotes").value.trim()||null,order_index:state.itinerary.filter(x=>x.plan_date===$("itineraryDate").value).length+1};
    const {error}=await db.from("travel_itinerary_items").insert(payload);if(error){toast(error.message,"error");return;}
    $("itineraryDialog").close();toast("Added to itinerary.","success");await loadTripData();state.activeTab="itinerary";renderActiveTab();
  }

  async function saveQuickItinerary(event) {
    event.preventDefault();
    const payload={trip_id:state.trip.id,city_id:state.selectedCityId,user_id:state.user.id,plan_date:$("quickItineraryDate").value,start_time:$("quickItineraryTime").value||null,title:$("quickItineraryTitle").value.trim(),item_type:$("quickItineraryType").value,order_index:state.itinerary.filter(x=>x.plan_date===$("quickItineraryDate").value).length+1};
    const {error}=await db.from("travel_itinerary_items").insert(payload);if(error){toast(error.message,"error");return;}toast("Itinerary item added.","success");await loadTripData();
  }

  async function toggleItinerary(id) {
    const item=state.itinerary.find(x=>x.id===id);if(!item)return;
    const status=item.status==="done"?"planned":"done";
    const {error}=await db.from("travel_itinerary_items").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error){toast(error.message,"error");return;}item.status=status;renderItinerary();
  }

  function openBookingDialog() {
    $("bookingCity").innerHTML=`<option value="">Trip-wide</option>`+state.cities.map(c=>`<option value="${c.id}">${esc(c.city_name)}</option>`).join("");
    $("bookingCity").value=state.selectedCityId||"";
    $("bookingCurrency").value=state.trip.home_currency||"EUR";
    $("bookingDialog").showModal();
  }

  async function saveBooking(event) {
    event.preventDefault();
    const amount=$("bookingAmount").value;
    const payload={trip_id:state.trip.id,city_id:$("bookingCity").value||null,user_id:state.user.id,booking_type:$("bookingType").value,title:$("bookingTitle").value.trim(),provider:$("bookingProvider").value.trim()||null,booking_date:$("bookingDate").value||null,reference_code:$("bookingReference").value.trim()||null,amount:amount===""?null:Number(amount),currency:$("bookingCurrency").value,payment_status:$("bookingStatus").value,notes:$("bookingNotes").value.trim()||null};
    const {error}=await db.from("travel_bookings").insert(payload);if(error){toast(error.message,"error");return;}
    $("bookingDialog").close();event.currentTarget.reset();toast("Booking saved.","success");await loadTripData();state.activeTab="bookings";renderActiveTab();
  }

  function bindStaticEvents() {
    $("loadEuroTemplate").addEventListener("click",e=>seedEuroTrip(e.currentTarget));
    $("showNewTrip").addEventListener("click",()=>$("newTripDialog").showModal());
    $("newTripForm").addEventListener("submit",createTrip);
    $("itineraryForm").addEventListener("submit",saveItinerary);
    $("bookingForm").addEventListener("submit",saveBooking);
    $("refreshTravel").addEventListener("click",()=>loadTrips(state.trip?.id));
    $("tripSelect").addEventListener("change",e=>loadTrips(e.target.value));
    qsa(".travel-tab").forEach(b=>b.addEventListener("click",()=>{state.activeTab=b.dataset.tab;renderActiveTab();}));
  }

  function bindDynamic() {
    qsa("[data-city-card],[data-select-city]").forEach(b=>b.onclick=()=>{state.selectedCityId=b.dataset.cityCard||b.dataset.selectCity;renderActiveTab();});
    qsa("[data-open-places]").forEach(b=>b.onclick=()=>{state.activeTab="places";renderActiveTab();});
    qsa("[data-place-filter]").forEach(b=>b.onclick=()=>{state.placeFilter=b.dataset.placeFilter;renderPlaces();});
    qsa("[data-toggle-place]").forEach(b=>b.onclick=()=>togglePlace(b.dataset.togglePlace));
    qsa("[data-plan-place]").forEach(b=>b.onclick=()=>openPlanDialog(b.dataset.planPlace));
    qsa("[data-add-itinerary-date]").forEach(b=>b.onclick=()=>openPlanDialog(null,b.dataset.addItineraryDate));
    qsa("[data-toggle-itinerary]").forEach(b=>b.onclick=()=>toggleItinerary(b.dataset.toggleItinerary));
    qsa("[data-add-city]").forEach(b=>b.onclick=addCity);
    qsa("[data-add-place]").forEach(b=>b.onclick=addCustomPlace);
    qsa("[data-add-booking]").forEach(b=>b.onclick=openBookingDialog);
    const quick=$("quickItineraryForm"); if(quick) quick.onsubmit=saveQuickItinerary;
  }

  boot().catch(err => { console.error(err); toast("Travel planner could not load.","error"); });
})();
