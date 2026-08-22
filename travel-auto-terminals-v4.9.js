(() => {
  'use strict';
  if (window.__MEDORA_TRAVEL_AUTO_TERMINALS_49__) return;
  window.__MEDORA_TRAVEL_AUTO_TERMINALS_49__ = true;

  const cfg=window.MEDORA_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let timer=null,observer=null;

  const META={
    flight:{hubType:'airport',fromLabel:'Departure airport',toLabel:'Arrival airport',fromPlaceholder:'Search airport name or code (e.g. SPX)',toPlaceholder:'Search airport name or code (e.g. BUD)',buffer:120,button:'Add flight + airports',note:'Medora will create: departure airport → flight → arrival airport.'},
    bus:{hubType:'bus_station',fromLabel:'Departure bus station',toLabel:'Arrival bus station',fromPlaceholder:'Departure bus station / terminal',toPlaceholder:'Arrival bus station / terminal',buffer:30,button:'Add bus + stations',note:'Medora will create: departure bus station → bus → arrival bus station.'},
    train:{hubType:'train_station',fromLabel:'Departure train station',toLabel:'Arrival train station',fromPlaceholder:'Departure railway station',toPlaceholder:'Arrival railway station',buffer:30,button:'Add train + stations',note:'Medora will create: departure station → train → arrival station.'}
  };

  const KNOWN_TERMINALS=[
    {match:/sphinx international airport/i,name:'Sphinx International Airport (SPX)',address:'Sphinx International Airport, Giza, Egypt',city:'Giza',country:'Egypt',code:'EG',photo:'https://commons.wikimedia.org/wiki/Special:FilePath/Sphinx%20International%20Airport%2001.jpg?width=1400',credit:'Nabbegat · Wikimedia Commons'},
    {match:/budapest ferenc liszt international airport|budapest airport/i,name:'Budapest Ferenc Liszt International Airport (BUD)',address:'Budapest Ferenc Liszt International Airport, Budapest, Hungary',city:'Budapest',country:'Hungary',code:'HU',photo:'https://commons.wikimedia.org/wiki/Special:FilePath/Budapest%20Airport%2002%2025%2024%20079000.jpeg?width=1400',credit:'Robot8A · Wikimedia Commons · CC BY-SA 4.0'},
    {match:/athens international airport/i,name:'Athens International Airport (ATH)',address:'Athens International Airport, Spata, Greece',city:'Athens',country:'Greece',code:'GR',photo:null,credit:null},
    {match:/bratislava airport/i,name:'Bratislava Airport (BTS)',address:'Bratislava Airport, Bratislava, Slovakia',city:'Bratislava',country:'Slovakia',code:'SK',photo:null,credit:null},
    {match:/cairo international airport/i,name:'Cairo International Airport (CAI)',address:'Cairo International Airport, Cairo, Egypt',city:'Cairo',country:'Egypt',code:'EG',photo:null,credit:null}
  ];

  const PROVIDER_PHOTOS=[
    {match:/^wizz air$/i,url:'https://commons.wikimedia.org/wiki/Special:FilePath/DAV%202794-HA-LVW%20-%20Wizz%20Air%20Airbus%20A321%20NEO.jpg?width=1400',credit:'DavidivardiIL · Wikimedia Commons · Wizz Air Airbus A321neo'},
    {match:/^ryanair$/i,url:'https://commons.wikimedia.org/wiki/Special:FilePath/Ryanair%20Boeing%20737.jpg?width=1400',credit:'Wikimedia Commons · Ryanair aircraft'},
    {match:/^aegean airlines$|^aegean$/i,url:'https://commons.wikimedia.org/wiki/Special:FilePath/Aegean%20Airlines%20Airbus%20A321neo%20SX-NAM%20Milan%20Malpensa%202024%20%2801%29.jpg?width=1400',credit:'Bahnfrend · Wikimedia Commons · CC BY-SA 4.0'}
  ];

  function activeTripId(){return $('#journeyPlanSelect')?.value||localStorage.getItem('medoraTravelActiveTrip')||null}
  function toast(msg,type=''){const n=$('#journeyToast');if(!n)return;n.textContent=msg;n.className=`journey-toast show ${type}`.trim();clearTimeout(toast.t);toast.t=setTimeout(()=>n.className='journey-toast',3000)}
  function clean(v=''){return String(v).replace(/\s+/g,' ').trim()}
  function norm(v=''){return clean(v).toLowerCase().replace(/\([a-z0-9]{3,4}\)$/i,'').trim()}
  function providerPhoto(provider=''){return PROVIDER_PHOTOS.find(x=>x.match.test(clean(provider)))||null}
  function knownTerminal(name=''){return KNOWN_TERMINALS.find(x=>x.match.test(clean(name)))||null}
  function errBox(form,msg){const n=$('#bError',form);if(n){n.textContent=msg;n.classList.add('show')}else toast(msg,'error')}

  function dmyToIso(v){const m=String(v||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return null;const d=+m[1],mo=+m[2],y=+m[3],x=new Date(Date.UTC(y,mo-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===mo-1&&x.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null}
  function zonedIso(dmy,time,tz){const date=dmyToIso(dmy);if(!date||!time)return null;const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);let guess=Date.UTC(y,m-1,d,hh,mm,0);const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let i=0;i<2;i++){const p=f.formatToParts(new Date(guess)).reduce((a,x)=>(a[x.type]=x.value,a),{}),shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second),wanted=Date.UTC(y,m-1,d,hh,mm,0);guess+=wanted-shown}return new Date(guess).toISOString()}
  function utcParts(iso){const d=new Date(iso);return{date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)}}

  async function wikiImage(query){
    if(!query)return null;
    try{
      const sr=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(query)}`);if(!sr.ok)return null;const sj=await sr.json(),title=sj?.query?.search?.[0]?.title;if(!title)return null;
      const rr=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ','_'))}`);if(!rr.ok)return null;const j=await rr.json();return{url:j.originalimage?.source||j.thumbnail?.source||null,credit:'Wikipedia / Wikimedia Commons'};
    }catch{return null}
  }

  async function resolveTerminal(rawName,address,hubType){
    const k=knownTerminal(rawName);
    if(k)return{...k,hubType};
    const chunks=clean(address).split(',').map(x=>x.trim()).filter(Boolean);
    let city=chunks.length>=2?chunks[chunks.length-2]:null,country=chunks.length>=1?chunks[chunks.length-1]:null;
    const n=clean(rawName);if(!city){if(/zagreb/i.test(n)){city='Zagreb';country='Croatia'}else if(/bratislava/i.test(n)){city='Bratislava';country='Slovakia'}else if(/budapest/i.test(n)){city='Budapest';country='Hungary'}else if(/athens/i.test(n)){city='Athens';country='Greece'}else if(/cairo|sphinx/i.test(n)){city=/sphinx/i.test(n)?'Giza':'Cairo';country='Egypt'}}
    const img=await wikiImage(n);
    return{name:n,address:clean(address)||null,city,country:country||'Unknown',code:null,photo:img?.url||null,credit:img?.credit||null,hubType};
  }

  async function ensureCity(tripId,userId,t){
    if(!t.city)return null;
    const {data:found}=await db.from('travel_cities').select('*').eq('trip_id',tripId).ilike('city_name',t.city).limit(1);if(found?.[0])return found[0];
    const {data:last}=await db.from('travel_cities').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1);
    const {data,error}=await db.from('travel_cities').insert({trip_id:tripId,user_id:userId,city_name:t.city,country_name:t.country||'Unknown',country_code:t.code||null,order_index:(last?.[0]?.order_index||0)+1}).select().single();if(error)throw error;return data;
  }

  async function getHubs(tripId){const {data,error}=await db.from('travel_hubs').select('*').eq('trip_id',tripId);if(error)throw error;return data||[]}
  function matchingHub(hubs,t,hubType){return hubs.find(h=>h.hub_type===hubType&&(norm(h.name)===norm(t.name)||(h.address&&t.address&&norm(h.address)===norm(t.address))))||null}
  async function nextHubOrder(tripId){const {data}=await db.from('travel_hubs').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1);return(data?.[0]?.order_index||0)+1}
  async function nextSequence(tripId,cityId,date){let q=db.from('travel_route_stops').select('sequence').eq('trip_id',tripId).eq('route_date',date);q=cityId?q.eq('city_id',cityId):q.is('city_id',null);const {data}=await q.order('sequence',{ascending:false}).limit(1);return(data?.[0]?.sequence||0)+1}

  async function ensureHub({tripId,userId,t,hubType,arrivalAt,departureAt,buffer,confirmed,keyPrefix,notes,hubs}){
    let h=matchingHub(hubs,t,hubType);
    const city=await ensureCity(tripId,userId,t);
    if(h){
      const patch={};if(!h.address&&t.address)patch.address=t.address;if(!h.photo_url&&t.photo)patch.photo_url=t.photo;if(!h.photo_credit&&t.credit)patch.photo_credit=t.credit;if(!h.city_id&&city?.id)patch.city_id=city.id;if(arrivalAt&&!h.planned_arrival_at)patch.planned_arrival_at=arrivalAt;if(departureAt&&!h.planned_departure_at)patch.planned_departure_at=departureAt;if(Object.keys(patch).length){patch.updated_at=new Date().toISOString();await db.from('travel_hubs').update(patch).eq('id',h.id);Object.assign(h,patch)}return{hub:h,created:false};
    }
    const order=await nextHubOrder(tripId),stamp=Date.now()+Math.floor(Math.random()*999);
    const {data,error}=await db.from('travel_hubs').insert({trip_id:tripId,city_id:city?.id||null,user_id:userId,hub_key:`${keyPrefix}-${stamp}`,name:t.name,hub_type:hubType,address:t.address||null,planned_arrival_at:arrivalAt||null,planned_departure_at:departureAt||null,buffer_minutes:buffer||0,is_confirmed:!!confirmed,notes:notes||null,order_index:order,photo_url:t.photo||null,photo_credit:t.credit||null}).select().single();if(error)throw error;hubs.push(data);return{hub:data,created:true};
  }

  async function ensureDepartureStop({tripId,userId,hub,departAt,mode,buffer}){
    const {data:existing,error:ee}=await db.from('travel_route_stops').select('*').eq('trip_id',tripId).eq('hub_id',hub.id).limit(1);if(ee)throw ee;if(existing?.[0])return{stop:existing[0],created:false};
    const sortAt=new Date(new Date(departAt).getTime()-60000).toISOString(),sp=utcParts(sortAt),seq=await nextSequence(tripId,hub.city_id||null,sp.date);
    const {data,error}=await db.from('travel_route_stops').insert({trip_id:tripId,city_id:hub.city_id||null,user_id:userId,route_date:sp.date,sequence:seq,stop_type:'hub',hub_id:hub.id,title:hub.name,planned_start:sp.time,planned_end:sp.time,travel_mode:'other',travel_minutes:0,status:'planned',notes:`AUTO_LINKED_DEPARTURE · Be at this ${mode==='flight'?'airport':'station'} about ${buffer} minutes before departure.`,photo_query:hub.name}).select().single();if(error)throw error;return{stop:data,created:true};
  }

  async function ensureSegmentPhoto(segment){
    if(segment.photo_url)return false;
    let p=providerPhoto(segment.provider||'');if(!p&&segment.provider){const x=await wikiImage(`${segment.provider} ${segment.mode==='flight'?'aircraft':segment.mode}`);if(x?.url)p={url:x.url,credit:x.credit}}
    if(!p?.url)return false;
    const {error}=await db.from('travel_transport_segments').update({photo_url:p.url,photo_credit:p.credit||null,updated_at:new Date().toISOString()}).eq('id',segment.id);if(error)throw error;segment.photo_url=p.url;segment.photo_credit=p.credit;return true;
  }

  async function linkSegment(segment,userId,tripId,hubs){
    const meta=META[segment.mode];if(!meta||!segment.depart_at||!segment.arrive_at)return{changed:false};
    let changed=await ensureSegmentPhoto(segment);
    const depT=await resolveTerminal(segment.from_name,segment.from_address,meta.hubType),arrT=await resolveTerminal(segment.to_name,segment.to_address,meta.hubType);
    const terminalArrival=new Date(new Date(segment.depart_at).getTime()-meta.buffer*60000).toISOString();
    const dep=await ensureHub({tripId,userId,t:depT,hubType:meta.hubType,arrivalAt:terminalArrival,departureAt:segment.depart_at,buffer:meta.buffer,confirmed:segment.is_confirmed,keyPrefix:`auto-${segment.mode}-departure`,notes:`Automatically linked departure ${meta.hubType.replaceAll('_',' ')}.`,hubs});
    const arr=await ensureHub({tripId,userId,t:arrT,hubType:meta.hubType,arrivalAt:segment.arrive_at,departureAt:null,buffer:0,confirmed:segment.is_confirmed,keyPrefix:`auto-${segment.mode}-arrival`,notes:`Automatically linked arrival ${meta.hubType.replaceAll('_',' ')}.`,hubs});
    const stop=await ensureDepartureStop({tripId,userId,hub:dep.hub,departAt:segment.depart_at,mode:segment.mode,buffer:meta.buffer});
    const patch={};if(depT.name&&segment.from_name!==depT.name)patch.from_name=depT.name;if(depT.address&&!segment.from_address)patch.from_address=depT.address;if(arrT.name&&segment.to_name!==arrT.name)patch.to_name=arrT.name;if(arrT.address&&!segment.to_address)patch.to_address=arrT.address;if(Object.keys(patch).length){patch.updated_at=new Date().toISOString();await db.from('travel_transport_segments').update(patch).eq('id',segment.id);Object.assign(segment,patch);changed=true}
    return{changed:changed||dep.created||arr.created||stop.created,depHub:dep.hub,arrHub:arr.hub};
  }

  async function repairActiveTrip(){
    const {data:{user}}=await db.auth.getUser();if(!user)return;const tripId=activeTripId();if(!tripId)return;
    const [{data:segments,error:se},hubs]=await Promise.all([db.from('travel_transport_segments').select('*').eq('trip_id',tripId),getHubs(tripId)]);if(se)throw se;
    let changed=false;for(const s of segments||[]){if(!META[s.mode])continue;const r=await linkSegment(s,user.id,tripId,hubs);changed=changed||r.changed}
    if(changed){toast('Linked terminal cards repaired. Reloading…','success');setTimeout(()=>location.reload(),350)}
  }

  function labelInput(input,labelText,placeholder){if(!input)return;const label=input.closest('label');if(label){for(const node of [...label.childNodes]){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent=labelText;break}}}input.placeholder=placeholder||''}
  function enhanceForm(){
    const form=$('#builderTransport');if(!form)return;const mode=$('#bMode',form)?.value||'flight',meta=META[mode],from=$('#bFrom',form),to=$('#bTo',form),submit=form.querySelector('button[type="submit"]');let note=$('#autoTerminalNote',form);
    if(meta){labelInput(from,meta.fromLabel,meta.fromPlaceholder);labelInput(to,meta.toLabel,meta.toPlaceholder);if(submit)submit.textContent=meta.button;if(!note){note=document.createElement('div');note.id='autoTerminalNote';note.style.cssText='padding:11px 13px;border-radius:12px;background:#eef7ff;color:#47627e;font-size:12px;font-weight:750;line-height:1.45';form.querySelector('.builder-mode-grid')?.insertAdjacentElement('afterend',note)}note.textContent=meta.note}
    else{labelInput(from,'From','Starting point');labelInput(to,'To','Destination');if(submit)submit.textContent='Add '+mode;note?.remove()}
  }

  async function upload(file,userId,tripId,segmentId){if(!file)return;if(file.size>8*1024*1024)throw new Error('Photo must be smaller than 8 MB.');const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${userId}/${tripId}/transport-${segmentId}-${Date.now()}.${ext}`;const {error:up}=await db.storage.from('travel-media').upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;const {error}=await db.from('travel_transport_segments').update({photo_url:`storage://travel-media/${path}`,photo_credit:'Your uploaded photo',updated_at:new Date().toISOString()}).eq('id',segmentId);if(error)throw error}

  async function handleAutoSubmit(event,form,mode,meta){
    event.preventDefault();event.stopImmediatePropagation();const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Creating linked journey…'}
    const created={segment:null,depHub:null,arrHub:null,stop:null};
    try{
      const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Please sign in to Medora.');const tripId=activeTripId();if(!tripId)throw new Error('Choose a travel plan first.');
      const dep=zonedIso($('#bDepDate',form).value,$('#bDepTime',form).value,$('#bDepZone',form).value),arr=zonedIso($('#bArrDate',form).value,$('#bArrTime',form).value,$('#bArrZone',form).value);if(!dep||!arr)throw new Error('Use valid DD/MM/YYYY dates and times.');
      const fromRaw=clean($('#bFrom',form).value),toRaw=clean($('#bTo',form).value),fromAddress=clean($('#bFromAddress',form).value)||null,toAddress=clean($('#bToAddress',form).value)||null;if(!fromRaw||!toRaw)throw new Error(`Choose both ${meta.fromLabel.toLowerCase()} and ${meta.toLabel.toLowerCase()}.`);
      const depT=await resolveTerminal(fromRaw,fromAddress,meta.hubType),arrT=await resolveTerminal(toRaw,toAddress,meta.hubType),provider=clean($('#bProvider',form).value)||null,pp=providerPhoto(provider||'');
      const {data:last}=await db.from('travel_transport_segments').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1),stamp=Date.now();
      const {data:segment,error:se}=await db.from('travel_transport_segments').insert({trip_id:tripId,user_id:user.id,segment_key:`custom-${stamp}`,order_index:(last?.[0]?.order_index||0)+1,mode,provider,service_number:clean($('#bService',form).value)||null,from_name:depT.name,from_address:depT.address||fromAddress,to_name:arrT.name,to_address:arrT.address||toAddress,depart_at:dep,arrive_at:arr,duration_minutes:$('#bDuration',form).value?Number($('#bDuration',form).value):null,transport_detail:clean($('#bDetails',form).value)||null,is_confirmed:$('#bConfirmed',form).value==='true',photo_url:pp?.url||null,photo_credit:pp?.credit||null}).select().single();if(se)throw se;created.segment=segment;
      const hubs=await getHubs(tripId),terminalArrival=new Date(new Date(dep).getTime()-meta.buffer*60000).toISOString();
      const dh=await ensureHub({tripId,userId:user.id,t:depT,hubType:meta.hubType,arrivalAt:terminalArrival,departureAt:dep,buffer:meta.buffer,confirmed:segment.is_confirmed,keyPrefix:`auto-${mode}-departure`,notes:`Automatically linked departure ${meta.hubType.replaceAll('_',' ')}.`,hubs});if(dh.created)created.depHub=dh.hub;
      const ah=await ensureHub({tripId,userId:user.id,t:arrT,hubType:meta.hubType,arrivalAt:arr,departureAt:null,buffer:0,confirmed:segment.is_confirmed,keyPrefix:`auto-${mode}-arrival`,notes:`Automatically linked arrival ${meta.hubType.replaceAll('_',' ')}.`,hubs});if(ah.created)created.arrHub=ah.hub;
      const st=await ensureDepartureStop({tripId,userId:user.id,hub:dh.hub,departAt:dep,mode,buffer:meta.buffer});if(st.created)created.stop=st.stop;
      await ensureSegmentPhoto(segment);await upload($('#bPhoto',form).files?.[0],user.id,tripId,segment.id);
      document.getElementById('stepBuilderOverlay')?.remove();toast(`${mode==='flight'?'Airport → flight → airport':mode==='bus'?'Bus station → bus → bus station':'Station → train → station'} created.`,'success');setTimeout(()=>location.reload(),350);
    }catch(e){
      try{if(created.segment)await db.from('travel_transport_segments').delete().eq('id',created.segment.id);if(created.stop)await db.from('travel_route_stops').delete().eq('id',created.stop.id);if(created.depHub)await db.from('travel_hubs').delete().eq('id',created.depHub.id);if(created.arrHub)await db.from('travel_hubs').delete().eq('id',created.arrHub.id)}catch{}
      errBox(form,e.message||String(e));if(submit){submit.disabled=false;submit.textContent=meta.button}
    }
  }

  async function cardEnhance(){
    const tripId=activeTripId();if(!tripId)return;const {data:hubs}=await db.from('travel_hubs').select('id,hub_key,hub_type,name,photo_url').eq('trip_id',tripId);const byId=new Map((hubs||[]).map(h=>[h.id,h]));
    $$('.journey-step-card').forEach(card=>{
      const photoBtn=card.querySelector('[data-edit-photo]');let hid=null;if(photoBtn){try{const x=JSON.parse(photoBtn.dataset.editPhoto||'{}');if(x.table==='travel_hubs')hid=x.id}catch{}}
      const h=hid?byId.get(hid):null;if(h){const label=card.querySelector('.step-type');if(label){label.textContent=h.hub_type==='airport'?'AIRPORT':h.hub_type==='bus_station'?'BUS STATION':h.hub_type==='train_station'?'TRAIN STATION':label.textContent}if(/departure/i.test(h.hub_key||'')){card.querySelectorAll('.route-chip').forEach(ch=>{if(ch.textContent.includes('⏱'))ch.remove()})}}
    });
  }

  document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='builderTransport')return;const mode=$('#bMode',form)?.value||'flight',meta=META[mode];if(!meta)return;handleAutoSubmit(event,form,mode,meta)},true);
  document.addEventListener('click',e=>{if(e.target.closest('#builderTransport [data-mode]'))setTimeout(enhanceForm,0)},true);
  function scan(){enhanceForm();cardEnhance().catch(()=>{})}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,90)}
  const start=()=>{scan();repairActiveTrip().catch(e=>console.warn('Auto terminal repair',e));observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();