(() => {
  "use strict";
  if (window.__MEDORA_STUDY_CUSTOM_DATE_PLANS__) return;
  window.__MEDORA_STUDY_CUSTOM_DATE_PLANS__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0");
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dmy=v=>{const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:""};
  const parseDMY=s=>{const m=String(s||"").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);if(!m)return null;const d=+m[1],mo=+m[2],y=+m[3],x=new Date(y,mo-1,d);return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===d?x:null};
  const maskDMY=v=>{const x=String(v||"").replace(/\D/g,"").slice(0,8);if(x.length<=2)return x;if(x.length<=4)return `${x.slice(0,2)}/${x.slice(2)}`;return `${x.slice(0,2)}/${x.slice(2,4)}/${x.slice(4)}`};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const S={user:null,plans:[],days:[],loading:false};

  function styles(){
    if($("#studyCustomPlansStyle"))return;
    const s=document.createElement("style");s.id="studyCustomPlansStyle";s.textContent=`
      .scp-btn{min-height:43px;padding:0 15px;border:1px solid #dce4ee;border-radius:11px;background:#fff;color:#4c5b73;font-size:10px;font-weight:900;cursor:pointer}.scp-btn:hover{background:#f7f9fd}.scp-btn strong{color:#6376df}
      .scp-section{margin-top:0}.scp-list{display:grid;gap:8px;margin-top:12px}.scp-card{border:1px solid #e1e7ef;border-radius:15px;background:#fbfcfe;overflow:hidden}.scp-card-head{width:100%;border:0;background:transparent;padding:13px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;cursor:pointer}.scp-card-head:hover{background:#f7f9fd}.scp-card-head strong,.scp-card-head small{display:block}.scp-card-head strong{font-size:11px;color:#29364a}.scp-card-head small{margin-top:3px;color:#8791a2;font-size:8px}.scp-pill{padding:5px 8px;border-radius:999px;background:#edf1ff;color:#6072d7;font-size:8px;font-weight:900}.scp-body{display:none;padding:0 14px 14px}.scp-card.open .scp-body{display:block}.scp-progress{height:5px;border-radius:999px;background:#e8edf4;overflow:hidden;margin-bottom:10px}.scp-progress span{display:block;height:100%;background:linear-gradient(90deg,#18b6aa,#667ff0,#8559e8)}.scp-days{display:grid;gap:6px}.scp-day{display:grid;grid-template-columns:92px 24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #e8ecf2;border-radius:11px;background:#fff}.scp-day.rest{background:#fafbfc;color:#8a93a1}.scp-day-date{font-size:8px;font-weight:900;color:#68758a}.scp-day-topic strong{display:block;font-size:9px}.scp-day-topic small{display:block;margin-top:2px;font-size:8px;color:#8a93a2}.scp-check{width:22px;height:22px;border:1px solid #ced6e2;border-radius:7px;background:#fff;color:transparent;cursor:pointer}.scp-check.done{background:#1fab82;border-color:#1fab82;color:#fff}.scp-card-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.scp-card-actions button{min-height:35px;padding:0 10px;border:0;border-radius:9px;background:#eff2f7;color:#536076;font-size:8px;font-weight:900;cursor:pointer}.scp-card-actions button.danger{background:#fff0f2;color:#b7485c}
      .scp-bg{position:fixed;z-index:1050;inset:0;display:grid;place-items:center;padding:16px;background:#0b142994;backdrop-filter:blur(6px)}.scp-modal{width:min(980px,100%);max-height:94vh;overflow:auto;border-radius:23px;background:#fff;box-shadow:0 32px 110px #0a143250}.scp-head{display:flex;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #edf0f5}.scp-head h2{margin:4px 0 2px;font-size:23px}.scp-head p{margin:0;color:#8490a1;font-size:9px}.scp-x{width:37px;height:37px;border:0;border-radius:50%;background:#eff2f6;font-size:20px;cursor:pointer}.scp-form{padding:18px 20px}.scp-top{display:grid;grid-template-columns:1.4fr .8fr .8fr auto;gap:9px;align-items:end}.scp-field{display:grid;gap:5px}.scp-field span{font-size:9px;font-weight:850;color:#5f6b7f}.scp-field input{min-height:43px;padding:0 11px;border:1px solid #dce3ed;border-radius:11px;font:inherit;color:#29364a;outline:none}.scp-field input:focus{border-color:#9caaed;box-shadow:0 0 0 4px rgba(96,112,227,.08)}.scp-generate{min-height:43px;padding:0 13px;border:0;border-radius:11px;background:#eef1ff;color:#5d70d7;font-size:9px;font-weight:900;cursor:pointer}.scp-grid{display:grid;gap:7px;margin-top:16px}.scp-edit-row{display:grid;grid-template-columns:105px minmax(180px,1fr) 110px minmax(150px,.8fr) auto;gap:7px;align-items:center;padding:8px;border:1px solid #e6ebf1;border-radius:12px;background:#fbfcfe}.scp-edit-date{font-size:8px;font-weight:900;color:#637087}.scp-edit-row input[type="text"],.scp-edit-row input[type="time"]{width:100%;min-height:38px;padding:0 9px;border:1px solid #dfe5ed;border-radius:9px;background:#fff;font:inherit;font-size:9px;box-sizing:border-box}.scp-rest{display:flex;align-items:center;gap:4px;font-size:8px;font-weight:850;color:#778296;white-space:nowrap}.scp-rest input{accent-color:#6c7ee0}.scp-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.scp-foot button{min-height:41px;padding:0 14px;border:0;border-radius:10px;font-size:9px;font-weight:900;cursor:pointer}.scp-cancel{background:#eff2f6;color:#566176}.scp-save{background:linear-gradient(115deg,#18b6aa,#657ff1 55%,#8659e9);color:#fff}.scp-empty{padding:16px;border:1px dashed #dce3ec;border-radius:12px;text-align:center;color:#8b94a3;font-size:9px}
      @media(max-width:760px){.scp-top{grid-template-columns:1fr 1fr}.scp-top .scp-field:first-child{grid-column:1/-1}.scp-generate{grid-column:1/-1}.scp-edit-row{grid-template-columns:86px 1fr 86px}.scp-edit-row .scp-note{grid-column:2/-1}.scp-rest{grid-column:2/-1}.scp-day{grid-template-columns:76px 24px 1fr}.scp-day>span:last-child{grid-column:3}}
      @media(max-width:520px){.scp-bg{padding:0;align-items:end}.scp-modal{width:100%;max-height:94vh;border-radius:22px 22px 0 0}.scp-form,.scp-head{padding-left:14px;padding-right:14px}.scp-top{grid-template-columns:1fr}.scp-top .scp-field:first-child,.scp-generate{grid-column:auto}.scp-edit-row{grid-template-columns:1fr}.scp-edit-row .scp-note,.scp-rest{grid-column:auto}.scp-edit-date{font-size:9px}.scp-day{grid-template-columns:72px 22px 1fr}}
    `;document.head.appendChild(s);
  }

  async function user(){if(S.user)return S.user;const {data:{user}}=await db.auth.getUser();S.user=user||null;return S.user}
  function isStudy(){return !!$("#medoraStudyV2")}
  function daysFor(id){return S.days.filter(d=>d.plan_id===id).sort((a,b)=>a.study_date.localeCompare(b.study_date))}
  function doneMetrics(plan){const rows=daysFor(plan.id).filter(d=>!d.is_rest_day&&String(d.topic||"").trim());const done=rows.filter(d=>d.is_done).length;return{done,total:rows.length,pct:rows.length?Math.round(done/rows.length*100):0}}

  async function load(){if(S.loading)return;const u=await user();if(!u)return;S.loading=true;try{const [p,d]=await Promise.all([db.from("study_custom_plans").select("*").eq("user_id",u.id).neq("status","archived").order("start_date",{ascending:true}),db.from("study_custom_plan_days").select("*").eq("user_id",u.id).order("study_date",{ascending:true})]);if(!p.error)S.plans=p.data||[];if(!d.error)S.days=d.data||[]}finally{S.loading=false}}

  function currentPath(){return{field:$("#ms2Field")?.value||"",specialty:$("#ms2Specialty")?.value||"",topic:$("#ms2Subtopic")?.value||$("#ms2Custom")?.value.trim()||$("#ms2Topic")?.value||""}}

  function inject(){
    if(!isStudy())return;
    styles();
    const actions=$("#medoraStudyV2 .ms2-actions");
    if(actions&&!$("#scpNewPlan")){
      const b=document.createElement("button");b.id="scpNewPlan";b.type="button";b.className="scp-btn";b.innerHTML="<strong>＋</strong> Custom date plan";b.onclick=()=>openEditor();
      const note=actions.querySelector('.ms2-note');actions.insertBefore(b,note||null);
    }
    if(!$("#scpSection")){
      const shared=$$("#medoraStudyV2 > .ms2-card").find(x=>/Your shared plans/i.test(x.textContent||""));
      const sec=document.createElement("section");sec.id="scpSection";sec.className="ms2-card scp-section";sec.innerHTML=`<div class="ms2-section-head"><h2>Your date-by-date plans</h2><p>Choose exact dates and decide what topic belongs to each day.</p></div><div id="scpList"></div>`;
      if(shared)shared.insertAdjacentElement("beforebegin",sec);else $("#medoraStudyV2").appendChild(sec);
    }
    renderList();
  }

  function renderList(){const host=$("#scpList");if(!host)return;if(!S.plans.length){host.innerHTML='<div class="scp-empty">No custom study plan yet. Tap <b>Custom date plan</b> above.</div>';return}host.innerHTML=`<div class="scp-list">${S.plans.map(p=>{const m=doneMetrics(p);return`<article class="scp-card" data-scp-card="${p.id}"><button class="scp-card-head" type="button"><span><strong>${esc(p.title)}</strong><small>${esc(dmy(p.start_date))} → ${esc(dmy(p.end_date))}${p.specialty?` · ${esc(p.specialty)}`:""}</small></span><span class="scp-pill">${m.done}/${m.total} done</span></button><div class="scp-body"><div class="scp-progress"><span style="width:${m.pct}%"></span></div><div class="scp-days">${daysFor(p.id).map(d=>`<div class="scp-day ${d.is_rest_day?'rest':''}"><span class="scp-day-date">${esc(dmy(d.study_date))}</span><button type="button" class="scp-check ${d.is_done?'done':''}" data-scp-done="${d.id}" ${d.is_rest_day?'disabled':''}>✓</button><span class="scp-day-topic"><strong>${d.is_rest_day?'Rest / catch-up':esc(d.topic||'Topic not set')}</strong>${d.notes?`<small>${esc(d.notes)}</small>`:""}</span><span class="scp-day-date">${d.study_time?esc(String(d.study_time).slice(0,5)):''}</span></div>`).join("")}</div><div class="scp-card-actions"><button type="button" data-scp-edit="${p.id}">Edit plan</button><button type="button" class="danger" data-scp-delete="${p.id}">Delete</button></div></div></article>`}).join("")}</div>`;
    $$('.scp-card-head',host).forEach(b=>b.onclick=()=>b.closest('.scp-card').classList.toggle('open'));
    $$('[data-scp-edit]',host).forEach(b=>b.onclick=e=>{e.stopPropagation();openEditor(b.dataset.scpEdit)});
    $$('[data-scp-delete]',host).forEach(b=>b.onclick=e=>{e.stopPropagation();deletePlan(b.dataset.scpDelete)});
    $$('[data-scp-done]',host).forEach(b=>b.onclick=e=>{e.stopPropagation();toggleDone(b.dataset.scpDone)});
  }

  function defaultDates(){const a=new Date(),b=addDays(a,6);return{from:a,to:b}}
  function generateRows(from,to,existing=[],seed=""){
    const rows=[];for(let d=new Date(from),guard=0;d<=to&&guard<120;d=addDays(d,1),guard++){const date=iso(d),old=existing.find(x=>x.study_date===date);rows.push({study_date:date,topic:old?.topic||(rows.length===0?seed:""),study_time:old?.study_time?String(old.study_time).slice(0,5):"",notes:old?.notes||"",is_rest_day:!!old?.is_rest_day,is_done:!!old?.is_done});}return rows;
  }

  function openEditor(planId=null){
    const p=planId?S.plans.find(x=>x.id===planId):null,existing=p?daysFor(p.id):[],path=currentPath(),def=defaultDates();
    const from=p?dmy(p.start_date):dmy(iso(def.from)),to=p?dmy(p.end_date):dmy(iso(def.to));
    const bg=document.createElement("div");bg.className="scp-bg";bg.id="scpModal";bg.innerHTML=`<section class="scp-modal" role="dialog" aria-modal="true"><div class="scp-head"><div><span class="ms2-ey">CUSTOM STUDY PLAN</span><h2>${p?'Edit':'Build'} date-by-date plan</h2><p>Every date gets its own topic. You can leave a day for rest or catch-up.</p></div><button class="scp-x" type="button">×</button></div><div class="scp-form"><div class="scp-top"><label class="scp-field"><span>Plan name</span><input id="scpTitle" maxlength="160" value="${esc(p?.title||((path.specialty||'Study')+' plan'))}"></label><label class="scp-field"><span>From</span><input id="scpFrom" inputmode="numeric" maxlength="10" value="${esc(from)}"></label><label class="scp-field"><span>To</span><input id="scpTo" inputmode="numeric" maxlength="10" value="${esc(to)}"></label><button class="scp-generate" id="scpGenerate" type="button">Generate days</button></div><div id="scpRows" class="scp-grid"></div><div class="scp-foot"><button class="scp-cancel" type="button">Cancel</button><button class="scp-save" id="scpSave" type="button">Save plan</button></div></div></section>`;
    document.body.appendChild(bg);
    ['scpFrom','scpTo'].forEach(id=>{$(`#${id}`,bg).oninput=e=>{e.target.value=maskDMY(e.target.value)}});
    bg.querySelector('.scp-x').onclick=()=>bg.remove();bg.querySelector('.scp-cancel').onclick=()=>bg.remove();bg.onclick=e=>{if(e.target===bg)bg.remove()};
    const initialFrom=parseDMY(from),initialTo=parseDMY(to);renderEditRows(bg,generateRows(initialFrom,initialTo,existing,p?"":path.topic));
    $('#scpGenerate',bg).onclick=()=>{const a=parseDMY($('#scpFrom',bg).value),b=parseDMY($('#scpTo',bg).value);if(!a||!b||b<a){alert('Enter valid From and To dates as DD/MM/YYYY.');return}const span=Math.floor((b-a)/86400000)+1;if(span>120){alert('Custom Study plans can contain up to 120 days.');return}const current=collectRows(bg,false);renderEditRows(bg,generateRows(a,b,current,path.topic))};
    $('#scpSave',bg).onclick=()=>savePlan(bg,p,path);
  }

  function renderEditRows(bg,rows){const host=$('#scpRows',bg);host.innerHTML=rows.map((r,i)=>`<div class="scp-edit-row" data-scp-date="${r.study_date}" data-scp-done-old="${r.is_done?'1':'0'}"><span class="scp-edit-date">${esc(dmy(r.study_date))}</span><input type="text" class="scp-topic" maxlength="220" placeholder="Topic for this day" value="${esc(r.topic)}"><input type="time" class="scp-time" value="${esc(r.study_time)}"><input type="text" class="scp-note" maxlength="500" placeholder="Optional note" value="${esc(r.notes)}"><label class="scp-rest"><input type="checkbox" class="scp-rest-check" ${r.is_rest_day?'checked':''}> Rest</label></div>`).join('');$$('.scp-rest-check',host).forEach(c=>c.onchange=()=>{const row=c.closest('.scp-edit-row'),topic=$('.scp-topic',row);topic.disabled=c.checked;topic.placeholder=c.checked?'Rest / catch-up':'Topic for this day'})}
  }
  function collectRows(bg,requireTopics=true){return $$('.scp-edit-row',bg).map(row=>({study_date:row.dataset.scpDate,topic:$('.scp-topic',row).value.trim(),study_time:$('.scp-time',row).value||null,notes:$('.scp-note',row).value.trim()||null,is_rest_day:$('.scp-rest-check',row).checked,is_done:row.dataset.scpDoneOld==='1'})).filter(r=>!requireTopics||r.is_rest_day||r.topic)}

  async function savePlan(bg,existing,path){
    const u=await user();if(!u)return;const title=$('#scpTitle',bg).value.trim(),from=parseDMY($('#scpFrom',bg).value),to=parseDMY($('#scpTo',bg).value);if(!title){alert('Give this Study plan a name.');return}if(!from||!to||to<from){alert('Enter valid From and To dates as DD/MM/YYYY.');return}const all=collectRows(bg,false),missing=all.find(r=>!r.is_rest_day&&!r.topic);if(missing){alert(`Add a topic for ${dmy(missing.study_date)} or mark it as Rest.`);return}const btn=$('#scpSave',bg);btn.disabled=true;btn.textContent='Saving…';try{
      let plan=existing;if(existing){const r=await db.from('study_custom_plans').update({title,field:path.field||existing.field||null,specialty:path.specialty||existing.specialty||null,start_date:iso(from),end_date:iso(to),updated_at:new Date().toISOString()}).eq('id',existing.id).eq('user_id',u.id).select().single();if(r.error)throw r.error;plan=r.data}else{const r=await db.from('study_custom_plans').insert({user_id:u.id,title,field:path.field||null,specialty:path.specialty||null,start_date:iso(from),end_date:iso(to)}).select().single();if(r.error)throw r.error;plan=r.data}
      const keep=all.map(x=>x.study_date);const del=await db.from('study_custom_plan_days').delete().eq('plan_id',plan.id).eq('user_id',u.id).not('study_date','in',`(${keep.join(',')})`);if(del.error&&all.length)console.warn(del.error);
      const payload=all.map(r=>({plan_id:plan.id,user_id:u.id,study_date:r.study_date,topic:r.topic,study_time:r.study_time,notes:r.notes,is_rest_day:r.is_rest_day,is_done:r.is_done,updated_at:new Date().toISOString()}));if(payload.length){const r=await db.from('study_custom_plan_days').upsert(payload,{onConflict:'plan_id,study_date'});if(r.error)throw r.error}
      bg.remove();await load();inject();
    }catch(e){console.warn(e);alert(e.message||'Could not save the custom Study plan.')}finally{if(btn){btn.disabled=false;btn.textContent='Save plan'}}
  }

  async function toggleDone(id){const u=await user(),row=S.days.find(x=>x.id===id);if(!u||!row)return;const next=!row.is_done,{error}=await db.from('study_custom_plan_days').update({is_done:next,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',u.id);if(error){alert(error.message);return}row.is_done=next;renderList()}
  async function deletePlan(id){const u=await user();if(!u||!confirm('Delete this custom Study plan?'))return;const {error}=await db.from('study_custom_plans').delete().eq('id',id).eq('user_id',u.id);if(error){alert(error.message);return}S.plans=S.plans.filter(x=>x.id!==id);S.days=S.days.filter(x=>x.plan_id!==id);renderList()}

  let timer=null;
  async function scan(){if(!isStudy())return;await load();inject()}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,100)}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-screen="study"]'))setTimeout(scan,120)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
