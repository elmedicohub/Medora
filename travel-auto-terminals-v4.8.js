(() => {
  'use strict';
  if (window.__MEDORA_TRAVEL_AUTO_TERMINALS_48__) return;
  window.__MEDORA_TRAVEL_AUTO_TERMINALS_48__ = true;

  const cfg=window.MEDORA_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  let observer=null,timer=null;

  const META={
    flight:{hubType:'airport',fromLabel:'Departure airport',toLabel:'Arrival airport',fromPlaceholder:'Search airport name or code (e.g. SPX)',toPlaceholder:'Search airport name or code (e.g. BUD)',buffer:120,button:'Add flight + 2 airports',note:'Medora will automatically create: departure airport → flight → arrival airport.'},
    bus:{hubType:'bus_station',fromLabel:'Departure bus station',toLabel:'Arrival bus station',fromPlaceholder:'Bus station / terminal',toPlaceholder:'Bus station / terminal',buffer:30,button:'Add bus + 2 bus stations',note:'Medora will automatically create: departure bus station → bus → arrival bus station.'},
    train:{hubType:'train_station',fromLabel:'Departure train station',toLabel:'Arrival train station',fromPlaceholder:'Railway station',toPlaceholder:'Railway station',buffer:30,button:'Add train + 2 stations',note:'Medora will automatically create: departure station → train → arrival station.'}
  };

  function activeTripId(){return $('#journeyPlanSelect')?.value||localStorage.getItem('medoraTravelActiveTrip')||null}
  function toast(msg,type=''){const n=$('#journeyToast');if(!n)return;n.textContent=msg;n.className=`journey-toast show ${type}`.trim();clearTimeout(toast.t);toast.t=setTimeout(()=>n.className='journey-toast',3000)}
  function errBox(form,msg){let n=$('#bError',form);if(!n)return toast(msg,'error');n.textContent=msg;n.classList.add('show')}
  function dmyToIso(v){const m=String(v||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return null;const d=+m[1],mo=+m[2],y=+m[3],x=new Date(Date.UTC(y,mo-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===mo-1&&x.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null}
  function zonedIso(dmy,time,tz){const date=dmyToIso(dmy);if(!date||!time)return null;const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);let guess=Date.UTC(y,m-1,d,hh,mm,0);const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let i=0;i<2;i++){const p=f.formatToParts(new Date(guess)).reduce((a,x)=>(a[x.type]=x.value,a),{}),shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second),wanted=Date.UTC(y,m-1,d,hh,mm,0);guess+=wanted-shown}return new Date(guess).toISOString()}
  function localParts(iso,tz){const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).reduce((a,x)=>(a[x.type]=x.value,a),{});return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}}
  function inferredCityAddress(addr,name){const chunks=String(addr||'').split(',').map(x=>x.trim()).filter(Boolean);if(chunks.length>=3)return{city:chunks[chunks.length-2],country:chunks[chunks.length-1]};const n=String(name||'');const hints=[['Sphinx','Giza','Egypt'],['Cairo','Cairo','Egypt'],['Budapest','Budapest','Hungary'],['Zagreb','Zagreb','Croatia'],['Bratislava','Bratislava','Slovakia'],['Athens','Athens','Greece']];for(const [q,c,k] of hints)if(n.toLowerCase().includes(q.toLowerCase()))return{city:c,country:k};return{city:null,country:null}}
  function norm(v=''){return String(v).toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim()}

  function labelInput(input,labelText,placeholder){if(!input)return;const label=input.closest('label');if(label){for(const node of [...label.childNodes]){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent=labelText;break}}}input.placeholder=placeholder||''}
  function enhanceForm(){
    const form=$('#builderTransport');if(!form)return;
    const mode=$('#bMode',form)?.value||'flight',meta=META[mode];
    const from=$('#bFrom',form),to=$('#bTo',form),submit=form.querySelector('button[type="submit"]');
    let note=$('#autoTerminalNote',form);
    if(meta){
      labelInput(from,meta.fromLabel,meta.fromPlaceholder);labelInput(to,meta.toLabel,meta.toPlaceholder);
      if(submit)submit.textContent=meta.button;
      if(!note){note=document.createElement('div');note.id='autoTerminalNote';note.style.cssText='padding:11px 13px;border-radius:12px;background:#eef7ff;color:#47627e;font-size:12px;font-weight:750;line-height:1.45';const modeGrid=form.querySelector('.builder-mode-grid');modeGrid?.insertAdjacentElement('afterend',note)}
      note.textContent=meta.note;
    }else{
      labelInput(from,'From','Starting point');labelInput(to,'To','Destination');if(submit)submit.textContent='Add '+mode;note?.remove();
    }
  }

  function enhanceTerminalCards(){
    $$('.journey-step-card').forEach(card=>{
      const type=card.querySelector('.step-type'),title=card.querySelector('.step-copy h3')?.textContent||'',text=card.textContent||'';
      if(!type)return;
      if(/airport/i.test(title)||/\b[A-Z]{3}\b/.test(title)&&/airport/i.test(text))type.textContent='AIRPORT';
      else if(/bus station|bus terminal|coach station/i.test(title))type.textContent='BUS STATION';
      else if(/train station|railway station|rail station/i.test(title))type.textContent='TRAIN STATION';
    });
    const next=$('.next-card');if(next){const title=next.querySelector('h3')?.textContent||'',strong=next.querySelector('.next-route strong');if(strong){if(/airport/i.test(title))strong.textContent='Airport';else if(/bus station|bus terminal|coach station/i.test(title))strong.textContent='Bus station';else if(/train station|railway station|rail station/i.test(title))strong.textContent='Train station'}}
  }

  async function ensureCity(tripId,userId,name,address){
    const x=inferredCityAddress(address,name);if(!x.city)return null;
    const {data:found}=await db.from('travel_cities').select('*').eq('trip_id',tripId).ilike('city_name',x.city).limit(1);if(found?.[0])return found[0];
    const {data:last}=await db.from('travel_cities').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1);
    const {data,error}=await db.from('travel_cities').insert({trip_id:tripId,user_id:userId,city_name:x.city,country_name:x.country||'Unknown',order_index:(last?.[0]?.order_index||0)+1}).select().single();if(error)throw error;return data;
  }
  async function nextHubOrder(tripId){const {data}=await db.from('travel_hubs').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1);return(data?.[0]?.order_index||0)+1}
  async function nextSequence(tripId,cityId,date){let q=db.from('travel_route_stops').select('sequence').eq('trip_id',tripId).eq('route_date',date);q=cityId?q.eq('city_id',cityId):q.is('city_id',null);const {data}=await q.order('sequence',{ascending:false}).limit(1);return(data?.[0]?.sequence||0)+1}
  async function upload(file,userId,tripId,segmentId){if(!file)return;if(file.size>8*1024*1024)throw new Error('Photo must be smaller than 8 MB.');const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${userId}/${tripId}/transport-${segmentId}-${Date.now()}.${ext}`;const {error:up}=await db.storage.from('travel-media').upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;const {error}=await db.from('travel_transport_segments').update({photo_url:`storage://travel-media/${path}`,photo_credit:'Your uploaded photo',updated_at:new Date().toISOString()}).eq('id',segmentId);if(error)throw error}

  async function findExistingTerminal(tripId,name,hubType){const {data}=await db.from('travel_hubs').select('*').eq('trip_id',tripId).eq('hub_type',hubType);const n=norm(name);return(data||[]).find(h=>norm(h.name)===n)||null}
  async function createTerminal({tripId,userId,cityId,name,address,hubType,arrivalAt,departureAt,buffer,confirmed,key,notes}){
    const existing=await findExistingTerminal(tripId,name,hubType);if(existing){const {data,error}=await db.from('travel_hubs').update({city_id:existing.city_id||cityId||null,address:existing.address||address||null,planned_arrival_at:arrivalAt||existing.planned_arrival_at,planned_departure_at:departureAt||existing.planned_departure_at,buffer_minutes:Math.max(Number(existing.buffer_minutes||0),Number(buffer||0)),is_confirmed:existing.is_confirmed||!!confirmed,updated_at:new Date().toISOString()}).eq('id',existing.id).select().single();if(error)throw error;return{...data,_reused:true}}
    const order=await nextHubOrder(tripId);const {data,error}=await db.from('travel_hubs').insert({trip_id:tripId,city_id:cityId||null,user_id:userId,hub_key:key,name,hub_type:hubType,address:address||null,planned_arrival_at:arrivalAt||null,planned_departure_at:departureAt||null,buffer_minutes:buffer||0,is_confirmed:!!confirmed,notes:notes||null,order_index:order}).select().single();if(error)throw error;return{...data,_reused:false};
  }
  async function ensureDepartureRoute({tripId,userId,hub,cityId,date,time,departureTime,buffer,name}){
    const {data:existing}=await db.from('travel_route_stops').select('*').eq('trip_id',tripId).eq('hub_id',hub.id).eq('route_date',date).limit(1);if(existing?.[0])return{...existing[0],_reused:true};
    const seq=await nextSequence(tripId,cityId||null,date);const {data,error}=await db.from('travel_route_stops').insert({trip_id:tripId,city_id:cityId||null,user_id:userId,route_date:date,sequence:seq,stop_type:'hub',hub_id:hub.id,title:name,planned_start:time,planned_end:departureTime,travel_mode:'other',travel_minutes:0,status:'planned',notes:`Be at ${name} about ${buffer} minutes before departure.`,photo_query:name}).select().single();if(error)throw error;return{...data,_reused:false}
  }

  async function handleAutoSubmit(event,form,mode,meta){
    event.preventDefault();event.stopImmediatePropagation();
    const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Creating linked steps…'}
    const created={segment:null,departureHub:null,arrivalHub:null,route:null};
    try{
      const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Please sign in to Medora.');const tripId=activeTripId();if(!tripId)throw new Error('Choose a travel plan first.');
      const dep=zonedIso($('#bDepDate',form).value,$('#bDepTime',form).value,$('#bDepZone',form).value),arr=zonedIso($('#bArrDate',form).value,$('#bArrTime',form).value,$('#bArrZone',form).value);if(!dep||!arr)throw new Error('Use valid DD/MM/YYYY dates and times.');
      const fromName=$('#bFrom',form).value.trim(),toName=$('#bTo',form).value.trim(),fromAddress=$('#bFromAddress',form).value.trim()||null,toAddress=$('#bToAddress',form).value.trim()||null;if(!fromName||!toName)throw new Error(`Choose both ${meta.fromLabel.toLowerCase()} and ${meta.toLabel.toLowerCase()}.`);
      const depCity=await ensureCity(tripId,user.id,fromName,fromAddress),arrCity=await ensureCity(tripId,user.id,toName,toAddress),terminalArrival=new Date(new Date(dep).getTime()-meta.buffer*60000).toISOString(),stamp=Date.now(),confirmed=$('#bConfirmed',form).value==='true';
      created.departureHub=await createTerminal({tripId,userId:user.id,cityId:depCity?.id,name:fromName,address:fromAddress,hubType:meta.hubType,arrivalAt:terminalArrival,departureAt:dep,buffer:meta.buffer,confirmed,key:`auto-${mode}-departure-${stamp}`,notes:`Automatically created departure ${meta.hubType.replaceAll('_',' ')} for this ${mode}.`});
      created.arrivalHub=await createTerminal({tripId,userId:user.id,cityId:arrCity?.id,name:toName,address:toAddress,hubType:meta.hubType,arrivalAt:arr,departureAt:null,buffer:0,confirmed,key:`auto-${mode}-arrival-${stamp}`,notes:`Automatically created arrival ${meta.hubType.replaceAll('_',' ')} for this ${mode}.`});
      const depLocal=localParts(terminalArrival,$('#bDepZone',form).value);created.route=await ensureDepartureRoute({tripId,userId:user.id,hub:created.departureHub,cityId:depCity?.id||null,date:depLocal.date,time:depLocal.time,departureTime:$('#bDepTime',form).value,buffer:meta.buffer,name:fromName});
      const {data:last}=await db.from('travel_transport_segments').select('order_index').eq('trip_id',tripId).order('order_index',{ascending:false}).limit(1);const payload={trip_id:tripId,user_id:user.id,segment_key:`custom-${stamp}`,order_index:(last?.[0]?.order_index||0)+1,mode,provider:$('#bProvider',form).value.trim()||null,service_number:$('#bService',form).value.trim()||null,from_name:fromName,from_address:fromAddress,to_name:toName,to_address:toAddress,depart_at:dep,arrive_at:arr,duration_minutes:$('#bDuration',form).value?Number($('#bDuration',form).value):null,transport_detail:$('#bDetails',form).value.trim()||null,is_confirmed:confirmed};
      const {data:segment,error:se}=await db.from('travel_transport_segments').insert(payload).select().single();if(se)throw se;created.segment=segment;await upload($('#bPhoto',form).files?.[0],user.id,tripId,segment.id);
      document.getElementById('stepBuilderOverlay')?.remove();toast(`${mode==='flight'?'Flight + airports':mode==='bus'?'Bus + stations':'Train + stations'} added automatically.`,'success');setTimeout(()=>location.reload(),350);
    }catch(e){
      try{if(created.segment)await db.from('travel_transport_segments').delete().eq('id',created.segment.id);if(created.route&&!created.route._reused)await db.from('travel_route_stops').delete().eq('id',created.route.id);if(created.departureHub&&!created.departureHub._reused)await db.from('travel_hubs').delete().eq('id',created.departureHub.id);if(created.arrivalHub&&!created.arrivalHub._reused)await db.from('travel_hubs').delete().eq('id',created.arrivalHub.id)}catch{}
      errBox(form,e.message||String(e));if(submit){submit.disabled=false;submit.textContent=meta.button}
    }
  }

  document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='builderTransport')return;const mode=$('#bMode',form)?.value||'flight',meta=META[mode];if(!meta)return;handleAutoSubmit(event,form,mode,meta)},true);
  document.addEventListener('click',e=>{if(e.target.closest('#builderTransport [data-mode]'))setTimeout(enhanceForm,0)},true);
  function scan(){enhanceForm();enhanceTerminalCards()}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,60)}
  const start=()=>{scan();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();