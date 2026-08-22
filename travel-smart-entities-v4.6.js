(() => {
  'use strict';
  if (window.__MEDORA_TRAVEL_SMART_ENTITIES_46__) return;
  window.__MEDORA_TRAVEL_SMART_ENTITIES_46__ = true;

  const cfg=window.MEDORA_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STATE={airports:null,airportPromise:null,timer:null};
  const typeIcon={airport:'✈',airline:'✈',bus_company:'🚌',rail_company:'🚆',place:'◎',hotel:'🛏',generic:'⌕'};

  function toast(msg,type=''){const n=$('#journeyToast');if(!n)return;n.textContent=msg;n.className=`journey-toast show ${type}`.trim();clearTimeout(toast.t);toast.t=setTimeout(()=>n.className='journey-toast',2600)}
  function cleanEntityName(v=''){return String(v).replace(/^Go to\s+/i,'').replace(/^You (?:are now at|arrived at|have arrived in)\s+/i,'').replace(/\s*\([A-Z0-9]{3,4}\)\s*$/,'').trim()}
  function activeTripId(){return $('#journeyPlanSelect')?.value||localStorage.getItem('medoraTravelActiveTrip')||null}

  function closeSmart(){document.getElementById('smartEntityOverlay')?.remove()}
  function modal(html){closeSmart();const o=document.createElement('div');o.id='smartEntityOverlay';o.className='smart-entity-overlay';o.innerHTML=`<section class="smart-entity-modal">${html}</section>`;document.body.appendChild(o);o.onclick=e=>{if(e.target===o)closeSmart()};o.querySelectorAll('[data-smart-close]').forEach(b=>b.onclick=closeSmart);return o}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('smartEntityOverlay')){e.preventDefault();e.stopPropagation();closeSmart()}},true);

  async function wikiSearch(q,type='generic'){
    const suffix={airport:' airport',airline:' airline',bus_company:' bus company',rail_company:' railway company',hotel:' hotel'}[type]||'';
    const term=`${String(q||'').trim()}${suffix}`.trim();if(term.length<2)return[];
    try{const u=`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8&srsearch=${encodeURIComponent(term)}`;const r=await fetch(u);if(!r.ok)return[];const j=await r.json();return(j?.query?.search||[]).map(x=>({title:x.title,subtitle:String(x.snippet||'').replace(/<[^>]+>/g,'').replace(/&quot;/g,'"'),type}))}catch{return[]}
  }
  async function summary(title){
    const exact=cleanEntityName(title);if(!exact)return null;
    const tryTitle=async t=>{try{const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replaceAll(' ','_'))}`);if(!r.ok)return null;const j=await r.json();return{title:j.title||t,description:j.description||'',extract:j.extract||'',image:j.originalimage?.source||j.thumbnail?.source||'',url:j.content_urls?.desktop?.page||''}}catch{return null}};
    let s=await tryTitle(exact);if(s)return s;const hits=await wikiSearch(exact,'generic');if(hits[0])s=await tryTitle(hits[0].title);return s;
  }

  async function showInfo(title,type='generic',extra={}){
    const s=await summary(title);const display=s?.title||cleanEntityName(title)||'Recognized item';
    const photo=s?.image||extra.image||'';const body=s?.extract||extra.subtitle||'Medora recognized this entry, but a longer public summary was not available.';
    const o=modal(`<div class="smart-entity-head"><div><span class="smart-entity-kicker">MEDORA RECOGNIZED · ${esc(type.replaceAll('_',' '))}</span><h2>${esc(display)}</h2></div><button class="smart-close" data-smart-close type="button">×</button></div><div class="smart-entity-body"><div class="smart-entity-photo" ${photo?`style="background-image:url('${esc(photo)}')"`:''}></div><div class="smart-entity-copy"><div class="smart-entity-meta">${extra.code?`<span class="smart-entity-chip">${esc(extra.code)}</span>`:''}${extra.city?`<span class="smart-entity-chip">${esc(extra.city)}</span>`:''}${extra.country?`<span class="smart-entity-chip">${esc(extra.country)}</span>`:''}</div><p>${esc(body)}</p><div class="smart-entity-actions">${s?.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">More info ↗</a>`:''}<button type="button" data-smart-close>Close</button></div></div></div>`);return o;
  }

  function parseCSVLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out}
  async function loadAirports(){
    if(STATE.airports)return STATE.airports;if(STATE.airportPromise)return STATE.airportPromise;
    STATE.airportPromise=(async()=>{try{const r=await fetch('https://ourairports.com/data/airports.csv');if(!r.ok)throw new Error();const text=await r.text(),lines=text.split(/\r?\n/),head=parseCSVLine(lines.shift()||'');const ix=n=>head.indexOf(n),I={type:ix('type'),name:ix('name'),lat:ix('latitude_deg'),lon:ix('longitude_deg'),country:ix('iso_country'),city:ix('municipality'),iata:ix('iata_code'),gps:ix('gps_code')};const dn=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['en'],{type:'region'}):null;const arr=[];for(const line of lines){if(!line)continue;const c=parseCSVLine(line),iata=(c[I.iata]||'').trim(),name=(c[I.name]||'').trim(),type=(c[I.type]||'').trim();if(!name||(!iata&&!['large_airport','medium_airport'].includes(type)))continue;const cc=(c[I.country]||'').trim(),country=dn&&cc?dn.of(cc)||cc:cc;arr.push({name,iata,gps:(c[I.gps]||'').trim(),city:(c[I.city]||'').trim(),country,lat:Number(c[I.lat]),lon:Number(c[I.lon])})}STATE.airports=arr;return arr}catch{STATE.airports=[];return[]}})();return STATE.airportPromise;
  }
  async function airportSearch(q){const query=String(q||'').trim().toLowerCase();if(query.length<2)return[];const arr=await loadAirports();if(arr.length){const score=a=>{const n=a.name.toLowerCase(),c=(a.city||'').toLowerCase(),i=(a.iata||'').toLowerCase(),g=(a.gps||'').toLowerCase();if(i===query||g===query)return 0;if(n.startsWith(query))return 1;if(c.startsWith(query))return 2;if(n.includes(query))return 3;if(c.includes(query)||i.includes(query)||g.includes(query))return 4;return 99};return arr.map(a=>({a,s:score(a)})).filter(x=>x.s<99).sort((x,y)=>x.s-y.s||x.a.name.localeCompare(y.a.name)).slice(0,9).map(x=>({...x.a,title:x.a.iata?`${x.a.name} (${x.a.iata})`:x.a.name,subtitle:[x.a.city,x.a.country].filter(Boolean).join(', '),type:'airport'}))}return wikiSearch(q,'airport')}

  function smartTypeFor(input){
    if(input.id==='hName'){const t=$('#hType')?.value||'other';return t==='airport'?'airport':t==='bus_station'?'place':t==='train_station'?'place':'place'}
    if(input.id==='bProvider'){const m=$('#bMode')?.value||'flight';return m==='flight'?'airline':m==='bus'?'bus_company':m==='train'?'rail_company':'generic'}
    if(input.id==='bFrom'||input.id==='bTo'){return ($('#bMode')?.value||'flight')==='flight'?'airport':'place'}
    if(input.id==='pName')return'place';if(input.id==='sName')return'hotel';return'generic';
  }
  function ensureWrap(input){if(input.closest('.smart-entity-wrap'))return input.closest('.smart-entity-wrap');const w=document.createElement('div');w.className='smart-entity-wrap';input.parentNode.insertBefore(w,input);w.appendChild(input);const r=document.createElement('div');r.className='smart-results hidden';w.appendChild(r);return w}
  function fillAirport(input,item){
    input.value=item.title;input.dataset.smartChosen=item.name||cleanEntityName(item.title);
    const addr=[item.name,item.city,item.country].filter(Boolean).join(', ');
    if(input.id==='hName'){if($('#hAddress'))$('#hAddress').value=addr;if($('#hCity')&&item.city)$('#hCity').value=item.city;if($('#hCountry')&&item.country)$('#hCountry').value=item.country}
    if(input.id==='bFrom'&&$('#bFromAddress'))$('#bFromAddress').value=addr;
    if(input.id==='bTo'&&$('#bToAddress'))$('#bToAddress').value=addr;
  }
  async function choose(input,item,type){const wrap=input.closest('.smart-entity-wrap');wrap?.querySelector('.smart-results')?.classList.add('hidden');if(type==='airport'&&item.name)fillAirport(input,item);else input.value=item.title;await showInfo(item.name||item.title,type,{subtitle:item.subtitle,code:item.iata||item.gps,city:item.city,country:item.country})}
  function renderResults(input,items,type){const box=input.closest('.smart-entity-wrap')?.querySelector('.smart-results');if(!box)return;if(!items.length){box.innerHTML='<div class="smart-searching">No close match. You can still keep what you typed.</div>';box.classList.remove('hidden');return}box.innerHTML=items.map((x,i)=>`<button type="button" class="smart-result" data-i="${i}"><span class="smart-result-icon">${typeIcon[type]||'⌕'}</span><span><strong>${esc(x.title)}</strong><small>${esc(x.subtitle||'')}</small></span></button>`).join('');box.classList.remove('hidden');box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>choose(input,items[Number(b.dataset.i)],type))}
  function attachSmart(input){if(!input||input.dataset.smart46==='1')return;input.dataset.smart46='1';ensureWrap(input);let t=null;input.addEventListener('input',()=>{clearTimeout(t);const q=input.value.trim(),type=smartTypeFor(input),box=input.closest('.smart-entity-wrap')?.querySelector('.smart-results');if(q.length<2){box?.classList.add('hidden');return}if(box){box.innerHTML='<div class="smart-searching">Searching…</div>';box.classList.remove('hidden')}t=setTimeout(async()=>{const items=type==='airport'?await airportSearch(q):await wikiSearch(q,type);renderResults(input,items,type)},280)});input.addEventListener('keydown',e=>{if(e.key==='Escape')input.closest('.smart-entity-wrap')?.querySelector('.smart-results')?.classList.add('hidden')})}
  function scanForms(){['hName','bProvider','bFrom','bTo','pName','sName'].forEach(id=>attachSmart(document.getElementById(id)))}

  function cardType(card){return (card.querySelector('.step-type')?.textContent||'').trim().toLowerCase()}
  function cardTitle(card){return cleanEntityName(card.querySelector('.step-copy h3')?.textContent||'')}
  function cardInfoTitle(card){if(cardType(card)==='transport'){const p=card.querySelector('.transport-card strong')?.textContent?.split(' · ')[0]?.trim();if(p)return p}return cardTitle(card)}
  function targetFromCard(card){const tr=card.querySelector('[data-edit-transport]');if(tr)return{table:'travel_transport_segments',id:tr.dataset.editTransport,kind:'transport'};const st=card.querySelector('[data-edit-stay]');if(st)return{table:'travel_hubs',id:st.dataset.editStay,kind:'hub'};const ph=card.querySelector('[data-edit-photo]');if(ph){try{const x=JSON.parse(ph.dataset.editPhoto);if(x.table==='travel_journey_config')return null;return{table:x.table,id:x.id,kind:x.kind}}catch{}}return null}
  async function deleteTarget(target){
    if(!target)return;const trip=activeTripId();if(!trip)return;
    if(target.table==='travel_places'){await db.from('travel_route_stops').delete().eq('trip_id',trip).eq('place_id',target.id);const {error}=await db.from('travel_places').delete().eq('id',target.id);if(error)throw error}
    else if(target.table==='travel_hubs'){await db.from('travel_route_stops').delete().eq('trip_id',trip).eq('hub_id',target.id);const {error}=await db.from('travel_hubs').delete().eq('id',target.id);if(error)throw error}
    else if(target.table==='travel_route_stops'){const {error}=await db.from('travel_route_stops').delete().eq('id',target.id);if(error)throw error}
    else if(target.table==='travel_transport_segments'){const {error}=await db.from('travel_transport_segments').delete().eq('id',target.id);if(error)throw error}
  }
  function confirmRemove(card,target){const title=cardTitle(card)||'this step';const o=modal(`<div class="smart-entity-head"><div><span class="smart-entity-kicker">REMOVE JOURNEY STEP</span><h2>Remove ${esc(title)}?</h2></div><button class="smart-close" data-smart-close type="button">×</button></div><div class="smart-delete-box">This removes this saved journey item from the current travel plan. It does not delete the entire plan.</div><div class="smart-entity-actions"><button class="smart-danger" id="smartConfirmDelete" type="button">Remove step</button><button data-smart-close type="button">Cancel</button></div>`);$('#smartConfirmDelete',o).onclick=async()=>{try{await deleteTarget(target);closeSmart();toast('Step removed.','success');setTimeout(()=>location.reload(),250)}catch(e){toast(e.message||'Could not remove step.','error')}}}

  async function enhanceCard(card){if(card.dataset.smartCard46==='1')return;card.dataset.smartCard46='1';let tools=card.querySelector('.step-edit-tools');if(!tools){tools=document.createElement('div');tools.className='step-edit-tools smart-card-tools';card.querySelector('.step-top')?.appendChild(tools)}else tools.classList.add('smart-card-tools');const info=document.createElement('button');info.type='button';info.textContent='ⓘ Info';info.onclick=()=>showInfo(cardInfoTitle(card),cardType(card)||'generic');tools.appendChild(info);const target=targetFromCard(card);if(target){const rm=document.createElement('button');rm.type='button';rm.className='smart-remove';rm.textContent='✕ Remove';rm.onclick=()=>confirmRemove(card,target);tools.appendChild(rm)}
    const title=cardTitle(card);const type=cardType(card);if(/airport/i.test(title)||type==='arrival'&&/airport/i.test(card.textContent)){const photo=card.querySelector('.step-photo');if(photo){const s=await summary(title);if(s?.image)photo.style.backgroundImage=`url("${s.image.replaceAll('"','%22')}")`}}
    if(type==='transport'){const provider=cardInfoTitle(card);const photo=card.querySelector('.step-photo');if(photo&&provider){const s=await summary(provider);if(s?.image)photo.style.backgroundImage=`url("${s.image.replaceAll('"','%22')}")`}}
  }
  function scanCards(){$$('.journey-step-card').forEach(c=>enhanceCard(c))}
  function scan(){scanForms();scanCards()}
  function schedule(){clearTimeout(STATE.timer);STATE.timer=setTimeout(scan,100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})},{once:true});else{scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
  document.addEventListener('click',e=>{if(!e.target.closest('.smart-entity-wrap'))$$('.smart-results').forEach(x=>x.classList.add('hidden'));if(e.target.closest('[data-mode]')||e.target.closest('#hType'))setTimeout(scanForms,50)},true);
})();