(() => {
  "use strict";
  const cfg=window.MEDORA_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const S={user:null,trip:null,config:null,cities:[],places:[],hubs:[],stops:[],segments:[],steps:[],photoCache:new Map()};
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const city=id=>S.cities.find(x=>x.id===id),place=id=>S.places.find(x=>x.id===id),hub=id=>S.hubs.find(x=>x.id===id);
  const ICON={origin:"⌂",place:"◎",hub:"⌖",stay:"🛏",transport:"→",break:"☕",arrival:"✓",walk:"🚶",metro:"Ⓜ",tram:"🚋",bus:"🚌",taxi:"🚕",car:"🚗",train:"🚆",flight:"✈",airport_transfer:"⇄",other:"→"};
  const TZ=[[/Alexandria|Cairo|Sphinx/i,'Africa/Cairo'],[/Budapest/i,'Europe/Budapest'],[/Zagreb/i,'Europe/Zagreb'],[/Bratislava|Most SNP/i,'Europe/Bratislava'],[/Athens/i,'Europe/Athens']];
  const PHOTO={
    'bud-basilica':"St. Stephen's Basilica, Budapest",'bud-parliament':'Hungarian Parliament Building','bud-shoes':'Shoes on the Danube Bank','bud-chain':'Széchenyi Chain Bridge','bud-buda':'Buda Castle','bud-fisher':"Fisherman's Bastion",'bud-matthias':'Matthias Church','bud-heroes':"Heroes' Square (Budapest)",'bud-szechenyi':'Széchenyi thermal bath','bud-market':'Great Market Hall (Budapest)',
    'zag-ban':'Ban Jelačić Square','zag-dolac':'Dolac Market','zag-cathedral':'Zagreb Cathedral','zag-tkalca':'Tkalčićeva Street','zag-stone':'Stone Gate (Zagreb)','zag-mark':"St. Mark's Church, Zagreb",'zag-broken':'Museum of Broken Relationships','zag-lotrscak':'Lotrščak Tower','zag-funicular':'Zagreb Funicular','zag-zrinjevac':'Zrinjevac','zag-advent':'Zagreb',
    'bra-blue':'Blue Church (Bratislava)','bra-main':'Old Town, Bratislava','bra-primate':"Primate's Palace",'bra-michael':"Michael's Gate",'bra-martin':"St Martin's Cathedral, Bratislava",'bra-castle':'Bratislava Castle','bra-ufo':'Most SNP','bra-hviez':'Hviezdoslav Square',
    'ath-acropolis':'Acropolis of Athens','ath-museum':'Acropolis Museum','ath-plaka':'Plaka','ath-agora':'Ancient Agora of Athens','ath-monast':'Monastiraki','ath-syntagma':'Syntagma Square'
  };

  function toast(msg,type=""){const n=$('#journeyToast');if(!n)return;n.textContent=msg;n.className=`journey-toast show ${type}`.trim();clearTimeout(toast.t);toast.t=setTimeout(()=>n.className='journey-toast',2600)}
  function tzFor(name=''){return TZ.find(([r])=>r.test(name))?.[1]||undefined}
  function fmtDT(v,name=''){if(!v)return'Not stored';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:tzFor(name)}).format(d)}
  function fmtDate(v){if(!v)return'';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(d)}
  function time(v){return v?String(v).slice(0,5):'—'}
  function durationBetween(a,b){if(!a||!b)return null;const [ah,am]=String(a).split(':').map(Number),[bh,bm]=String(b).split(':').map(Number);let n=(bh*60+bm)-(ah*60+am);if(n<0)n+=1440;return n}
  function mapSearch(name,address){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address||name||'')}`}
  function mapDir(from,to,mode=''){if(!from||!to)return mapSearch(to,'');const travelmode=mode==='walk'?'walking':['bus','metro','tram','train'].includes(mode)?'transit':'driving';return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=${travelmode}`}
  function locationOf(step){return step?.toAddress||step?.address||step?.toName||step?.title||''}

  async function load(){
    const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sign in to Medora first.');S.user=user;
    const {data:trips,error:te}=await db.from('travel_trips').select('*').eq('user_id',user.id).order('start_date',{ascending:true});if(te)throw te;if(!trips?.length)throw new Error('No travel trip found.');S.trip=trips[0];
    const id=S.trip.id;
    const [config,cities,places,hubs,stops,segments]=await Promise.all([
      db.from('travel_journey_config').select('*').eq('trip_id',id).maybeSingle(),
      db.from('travel_cities').select('*').eq('trip_id',id).order('order_index'),
      db.from('travel_places').select('*').eq('trip_id',id).order('order_index'),
      db.from('travel_hubs').select('*').eq('trip_id',id).order('order_index'),
      db.from('travel_route_stops').select('*').eq('trip_id',id).order('route_date').order('sequence'),
      db.from('travel_transport_segments').select('*').eq('trip_id',id).order('order_index')
    ]);
    const bad=[config,cities,places,hubs,stops,segments].find(x=>x.error);if(bad)throw bad.error;
    S.config=config.data||{trip_id:id,user_id:user.id,origin_name:'Your starting point',origin_address:null,current_step_key:null};S.cities=cities.data||[];S.places=places.data||[];S.hubs=hubs.data||[];S.stops=stops.data||[];S.segments=segments.data||[];
    S.steps=buildSteps();
  }

  function segment(key){return S.segments.find(x=>x.segment_key===key)}
  function stop(cityName,date,seq){const cid=S.cities.find(c=>c.city_name===cityName)?.id;return S.stops.find(s=>s.city_id===cid&&s.route_date===date&&s.sequence===seq)}
  function stopRange(cityName,date,from,to){const cid=S.cities.find(c=>c.city_name===cityName)?.id;return S.stops.filter(s=>s.city_id===cid&&s.route_date===date&&s.sequence>=from&&s.sequence<=to).sort((a,b)=>a.sequence-b.sequence)}

  function originStep(){return{key:'origin-alexandria',type:'origin',title:S.config.origin_name||'Your starting point',address:S.config.origin_address||S.config.origin_name,subtitle:'Your journey starts here.',photoQuery:S.config.origin_name||'Alexandria Egypt',notes:'When the trip begins, Medora will guide you one move at a time.'}}
  function segmentStep(s){if(!s)return null;return{key:`segment:${s.segment_key}`,type:'transport',title:`Go to ${s.to_name}`,subtitle:[s.provider,s.service_number].filter(Boolean).join(' · ')||'Travel segment',fromName:s.from_name,fromAddress:s.from_address,toName:s.to_name,toAddress:s.to_address,mode:s.mode,duration:s.duration_minutes,departAt:s.depart_at,arriveAt:s.arrive_at,transportDetail:s.transport_detail,notes:s.notes,confirmed:s.is_confirmed,photoQuery:s.provider||s.to_name,segment:s}}
  function syntheticArrival(key,s,label){if(!s)return null;return{key,type:'arrival',title:label||`You arrived at ${s.to_name}`,subtitle:'Arrival point',address:s.to_address||s.to_name,photoQuery:s.to_name,notes:'You are here now. Continue to the next card when ready.'}}
  function hubArrival(key,hubKey,title,subtitle){const h=S.hubs.find(x=>x.hub_key===hubKey);if(!h)return null;const c=city(h.city_id);return{key,type:['hostel','hotel'].includes(h.hub_type)?'stay':'arrival',title:title||h.name,subtitle:subtitle||`${c?.city_name||''} · ${h.hub_type.replaceAll('_',' ')}`,address:h.address||h.name,photoQuery:['hostel','hotel'].includes(h.hub_type)?(c?.city_name||h.name):h.name,hub:h,notes:h.notes}}
  function routeStep(s){if(!s)return null;const p=place(s.place_id),h=hub(s.hub_id),c=city(s.city_id);let type=s.stop_type;if(type==='hub'&&h&&['hostel','hotel'].includes(h.hub_type))type='stay';if(type==='hub'&&s.travel_minutes===0)type='arrival';const target=p?.address||h?.address||(p?.name||h?.name||s.title);const name=p?.name||h?.name||s.title;const visitMins=durationBetween(s.planned_start,s.planned_end);return{key:`route:${s.id}`,type,title:type==='hub'&&h?`Go to ${h.name}`:name,subtitle:`${c?.city_name||''} · ${fmtDate(s.route_date)}`,address:target,toName:name,toAddress:target,mode:s.travel_mode,duration:s.travel_minutes,visitDuration:visitMins,start:s.planned_start,end:s.planned_end,transportDetail:s.transport_detail,notes:s.notes,hard:s.is_hard_deadline,place:p,hub:h,photoQuery:p?PHOTO[p.place_key]||s.photo_query||p.name:(h&&['hostel','hotel'].includes(h.hub_type)?c?.city_name:h?.name)||s.photo_query||s.title,route:s}}

  function buildSteps(){
    const a=[];const push=x=>{if(x)a.push(x)};
    push(originStep());push(segmentStep(segment('egypt-road-to-spx')));push(hubArrival('spx-arrival',null,'Sphinx International Airport (SPX)','Egypt · airport'));
    const spx=segment('spx-bud-flight');push(segmentStep(spx));push(syntheticArrival('bud-arrived',spx,'You have arrived in Budapest'));
    push(segmentStep(segment('bud-airport-hostel')));push(hubArrival('bud-hostel-arrived','bud-hostel','You are now at Maverick Athenaeum','Budapest · hostel'));
    stopRange('Budapest','2026-12-28',2,12).forEach(x=>push(routeStep(x)));stopRange('Budapest','2026-12-29',1,4).forEach(x=>push(routeStep(x)));push(segmentStep(segment('bud-zag-bus')));
    const zagBus=stop('Zagreb','2026-12-29',1);push(routeStep(zagBus));push(segmentStep(segment('zag-bus-hostel')));push(hubArrival('zag-hostel-arrived','zag-hostel','You are now at Funk Lounge Hostel','Zagreb · hostel'));stopRange('Zagreb','2026-12-29',3,6).forEach(x=>push(routeStep(x)));stopRange('Zagreb','2026-12-30',1,12).forEach(x=>push(routeStep(x)));push(segmentStep(segment('zag-bra-bus')));
    push(routeStep(stop('Bratislava','2026-12-31',1)));push(segmentStep(segment('bra-stop-hostel')));push(hubArrival('bra-hostel-arrived','bra-hostel','You are now at Zen Zone Hostel','Bratislava · hostel'));stopRange('Bratislava','2026-12-31',3,12).forEach(x=>push(routeStep(x)));stopRange('Bratislava','2027-01-01',1,5).forEach(x=>push(routeStep(x)));push(segmentStep(segment('bra-ath-flight')));
    push(routeStep(stop('Athens','2027-01-01',1)));push(segmentStep(segment('ath-airport-stay')));push(hubArrival('ath-stay-arrived','ath-stay','You are now at your Athens stay','Athens · stay'));stopRange('Athens','2027-01-01',3,3).forEach(x=>push(routeStep(x)));stopRange('Athens','2027-01-02',1,11).forEach(x=>push(routeStep(x)));push(segmentStep(segment('ath-cai-flight')));push({key:'trip-finish',type:'arrival',title:'Back in Cairo',subtitle:'Journey complete',address:'Cairo International Airport, Cairo, Egypt',photoQuery:'Cairo International Airport',notes:'Your EURO journey is complete.'});
    return a.filter(Boolean).map((x,i)=>({...x,index:i}));
  }

  function currentIndex(){const k=S.config.current_step_key||S.steps[0]?.key;const i=S.steps.findIndex(x=>x.key===k);return i>=0?i:0}
  function statusClass(i,cur){return i<cur?'done':i===cur?'current':'future'}
  function prevLocation(i){for(let n=i-1;n>=0;n--){const l=locationOf(S.steps[n]);if(l)return l}return S.config.origin_address||S.config.origin_name||''}
  function mapFor(step,i){if(step.type==='transport'){if(step.mode==='flight')return mapSearch(step.toName,step.toAddress);return mapDir(step.fromAddress||step.fromName,step.toAddress||step.toName,step.mode)}return mapDir(prevLocation(i),step.address||step.toAddress||step.title,step.mode||'walk')}
  function stepMeta(step){const chips=[];if(step.duration)chips.push(`${ICON[step.mode]||'→'} ${step.duration} min`);if(step.start)chips.push(`⏱ ${time(step.start)}${step.end&&step.end!==step.start?`–${time(step.end)}`:''}`);if(step.visitDuration&&step.type==='place')chips.push(`Visit ≈ ${step.visitDuration} min`);if(step.hard)chips.push('HARD TIME');if(step.confirmed)chips.push('CONFIRMED');return chips}
  function transportCard(step){if(step.type!=='transport')return'';return `<div class="transport-card"><div class="transport-logo">${ICON[step.mode]||'→'}</div><div><strong>${esc([step.provider,step.service_number].filter(Boolean).join(' · ')||step.mode.replaceAll('_',' '))}</strong><small>${esc(step.fromName)} → ${esc(step.toName)}</small><div class="transport-times"><span>Depart: ${esc(fmtDT(step.departAt,step.fromName))}</span><span>Arrive: ${esc(fmtDT(step.arriveAt,step.toName))}</span>${step.duration?`<span>${step.duration} min</span>`:''}</div></div></div>`}
  function placeExtra(step){const p=step.place;if(!p)return'';const blocks=[];if(p.why_visit||p.notes)blocks.push(`<div class="transport-detail"><strong>Why this stop:</strong> ${esc(p.why_visit||p.notes)}</div>`);if(p.opening_hours_text)blocks.push(`<div class="transport-detail"><strong>Opening:</strong> ${esc(p.opening_hours_text)}</div>`);if(p.entry_fee_note)blocks.push(`<div class="transport-detail"><strong>Ticket:</strong> ${esc(p.entry_fee_note)}</div>`);return blocks.join('')}
  function stepCard(step,i,cur){const st=statusClass(i,cur),meta=stepMeta(step);return `<article class="journey-step ${st}" data-step-key="${esc(step.key)}"><div class="journey-node">${i+1}</div><div class="journey-step-card"><div class="step-grid"><div class="step-photo photo-skeleton" data-photo-query="${esc(step.photoQuery||step.title)}"></div><div class="step-copy"><div class="step-top"><div><span class="step-type">${esc(step.type)}</span><h3>${esc(step.title)}</h3></div>${st==='done'?'<span class="route-chip done">DONE</span>':st==='current'?'<span class="route-chip time">YOU ARE HERE</span>':''}</div><p>${esc(step.subtitle||step.notes||'')}</p><div class="step-route">${meta.map(x=>`<span class="route-chip ${x==='HARD TIME'?'hard':''}">${esc(x)}</span>`).join('')}</div>${step.transportDetail?`<div class="transport-detail"><strong>How to go:</strong> ${esc(step.transportDetail)}</div>`:''}${transportCard(step)}${placeExtra(step)}<div class="step-actions"><a class="jbtn small dark" href="${mapFor(step,i)}" target="_blank" rel="noopener">Map ↗</a>${st==='current'?`<button class="jbtn small primary" type="button" data-arrived="${esc(step.key)}">${step.type==='place'?'✓ I visited this':'✓ I am here / done'}</button>`:''}${step.place?.source_url?`<a class="jbtn small" href="${esc(step.place.source_url)}" target="_blank" rel="noopener">Info ↗</a>`:''}</div></div></div></div></article>`}

  function render(){
    const root=$('#journeyRoot');if(!root)return;const cur=currentIndex(),current=S.steps[cur],next=S.steps[cur+1],pct=Math.round((cur/Math.max(1,S.steps.length-1))*100);
    root.innerHTML=`<header class="journey-top"><div class="journey-brand"><img src="assets/medora-mark.svg" alt=""><div><strong>Medora Travel</strong><small>Virtual Journey</small></div></div><span class="journey-private">🔒 Private to your account</span></header><section class="journey-hero"><span class="journey-eyebrow">VIRTUAL PATHWAY · ${esc(S.trip.title||'YOUR TRIP')}</span><h1>One step at a time.</h1><p>Medora always tells you where you are, where to go next, how to get there, how long it should take, and gives you a map button for every move.</p><div class="journey-hero-meta"><span class="journey-pill">${esc(S.trip.start_date||'')} → ${esc(S.trip.end_date||'')}</span><span class="journey-pill">Step ${cur+1} / ${S.steps.length}</span><span class="journey-pill">${pct}% pathway</span></div><div class="journey-progress"><span style="width:${pct}%"></span></div></section><section class="current-wrap"><article class="current-card"><div class="current-photo photo-skeleton" data-photo-query="${esc(current?.photoQuery||current?.title||'Travel')}"><div class="current-photo-copy"><span>YOU ARE NOW HERE</span><h2>${esc(current?.title||'Journey')}</h2><p>${esc(current?.subtitle||current?.notes||'')}</p></div></div><div class="current-body"><div class="current-actions"><a class="jbtn dark" href="${current?mapFor(current,cur):'#'}" target="_blank" rel="noopener">Open Map ↗</a>${current?`<button class="jbtn primary" type="button" data-arrived="${esc(current.key)}">${current.type==='place'?'✓ I visited this place':'✓ I am here / done'}</button>`:''}</div></div></article><aside class="next-card"><span class="label">GO NEXT</span><h3>${esc(next?.title||'Journey complete')}</h3>${next?`<div class="next-route"><div class="next-icon">${ICON[next.mode]||ICON[next.type]||'→'}</div><div><strong>${next.duration?`${next.duration} min · `:''}${esc((next.mode||next.type||'next').replaceAll('_',' '))}</strong><small>${esc(next.transportDetail||next.subtitle||next.notes||'Follow the next card.')}</small></div></div>${next.type==='transport'?transportCard(next):''}<div class="card-actions"><a class="jbtn dark" href="${mapFor(next,cur+1)}" target="_blank" rel="noopener">Map next ↗</a></div>`:'<div class="journey-warning">You have reached the final step.</div>'}<div class="journey-warning">Live traffic, platform, gate and holiday opening changes should always be checked from the Map / official link at the time of travel.</div></aside></section><section class="journey-section"><div class="journey-section-head"><div><h2>Your complete pathway</h2><p>Past steps stay checked. The current step is highlighted; future steps remain ready below.</p></div></div><div class="journey-timeline">${S.steps.map((x,i)=>stepCard(x,i,cur)).join('')}</div></section>`;
    bind();loadPhotos();
    setTimeout(()=>document.querySelector('.journey-step.current')?.scrollIntoView({block:'center',behavior:'smooth'}),250);
  }

  async function advance(key){
    const i=S.steps.findIndex(x=>x.key===key);if(i<0)return;const step=S.steps[i],next=S.steps[Math.min(i+1,S.steps.length-1)];
    if(step.place){const now=new Date().toISOString();await db.from('travel_places').update({visit_status:'visited',is_visited:true,found_at:step.place.found_at||now,visited_at:now,updated_at:now}).eq('id',step.place.id);if(step.route)await db.from('travel_route_stops').update({status:'visited',updated_at:now}).eq('id',step.route.id)}else if(step.route){await db.from('travel_route_stops').update({status:'done',updated_at:new Date().toISOString()}).eq('id',step.route.id)}
    const payload={trip_id:S.trip.id,user_id:S.user.id,current_step_key:next.key,started_at:S.config.started_at||new Date().toISOString(),updated_at:new Date().toISOString()};const {data,error}=await db.from('travel_journey_config').upsert(payload,{onConflict:'trip_id'}).select().single();if(error)return toast(error.message,'error');S.config={...S.config,...data};toast('Journey advanced.','success');render();
  }

  function bind(){$$('[data-arrived]').forEach(b=>b.onclick=()=>advance(b.dataset.arrived))}
  async function wikiPhoto(query){
    const key=String(query||'').trim();if(!key)return null;if(S.photoCache.has(key))return S.photoCache.get(key);const cached=localStorage.getItem(`medoraPhoto:${key}`);if(cached){S.photoCache.set(key,cached);return cached}
    try{const title=key.replaceAll(' ','_');const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('no image');const j=await r.json();const url=j.originalimage?.source||j.thumbnail?.source||null;if(url){S.photoCache.set(key,url);localStorage.setItem(`medoraPhoto:${key}`,url)}return url}catch{return null}
  }
  async function loadPhotos(){
    const nodes=$$('[data-photo-query]');for(const n of nodes){if(n.dataset.photoDone)continue;n.dataset.photoDone='1';const q=n.dataset.photoQuery;const url=await wikiPhoto(q);if(url){n.style.backgroundImage=`url("${url.replaceAll('"','%22')}")`}else{n.style.backgroundImage='linear-gradient(135deg,#dce6ef,#c9d5e6)'}n.classList.remove('photo-skeleton')}
  }

  async function boot(){try{await load();$('#journeyLoading')?.classList.add('hidden');$('#journeyRoot')?.classList.remove('hidden');render()}catch(e){console.error(e);const l=$('#journeyLoading');if(l)l.innerHTML=`<div><strong>Travel journey could not load.</strong><small style="display:block;margin-top:6px">${esc(e.message||'Unknown error')}</small></div>`}}
  boot();
})();