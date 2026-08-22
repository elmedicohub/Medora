(() => {
  "use strict";
  if (window.__MEDORA_QURAN_REVISION_JOURNAL__) return;
  window.__MEDORA_QURAN_REVISION_JOURNAL__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0");
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dmy=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const parse=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};

  const S={user:null,plans:new Map(),notes:new Map(),voices:new Map(),busy:false,lastLoad:0,current:null,recorder:null,stream:null,chunks:[],recordStarted:0};
  const key=(p,d)=>`${p}|${d}`;

  function styles(){
    if($("#quranRevisionJournalStyle"))return;
    const st=document.createElement("style");st.id="quranRevisionJournalStyle";st.textContent=`
      .lm-day-dot.qj-clickable{position:relative;cursor:pointer;outline:none;transition:transform .15s ease,box-shadow .15s ease}.lm-day-dot.qj-clickable:hover{transform:scale(1.12)}
      .lm-day-dot.qj-clickable:focus-visible{box-shadow:0 0 0 4px rgba(97,113,231,.22)}
      .lm-day-dot.qj-has-note::after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;right:-2px;top:-2px;background:#7b5ce7;border:2px solid #fff;box-sizing:content-box}
      .qj-timeline-hint{margin-top:7px;color:#6c78c8;font-size:9px;font-weight:800}.qj-timeline-hint::before{content:"✎ ";}
      .qj-bg{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:16px;background:rgba(10,18,39,.56);backdrop-filter:blur(6px)}
      .qj-modal{width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:24px;background:#fff;box-shadow:0 28px 100px rgba(8,18,47,.28)}
      .qj-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #edf0f5}.qj-head span{display:block;color:#7663d9;font-size:9px;font-weight:900;letter-spacing:.12em}.qj-head h2{margin:5px 0 2px;font-size:24px;letter-spacing:-.03em}.qj-head p{margin:0;color:#8791a3;font-size:10px}.qj-x{width:38px;height:38px;border:0;border-radius:50%;background:#eff2f7;font-size:20px;cursor:pointer}
      .qj-body{display:grid;gap:15px;padding:20px 22px}.qj-field{display:grid;gap:6px}.qj-field>span{color:#4b566a;font-size:10px;font-weight:850}.qj-field small{color:#8b94a5;font-size:9px}.qj-field input,.qj-field textarea{width:100%;box-sizing:border-box;border:1px solid #dfe5ee;border-radius:13px;background:#fff;padding:11px 12px;color:#28354a;font:inherit;outline:none}.qj-field textarea{min-height:92px;resize:vertical}.qj-field input:focus,.qj-field textarea:focus{border-color:#9ba9ee;box-shadow:0 0 0 4px rgba(96,112,227,.08)}
      .qj-voice{padding:14px;border:1px solid #e5e9f0;border-radius:16px;background:#fafbfe}.qj-voice-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.qj-voice-head strong{font-size:11px}.qj-rec{min-height:38px;padding:0 12px;border:0;border-radius:10px;background:#eef1ff;color:#586bd2;font-size:9px;font-weight:900;cursor:pointer}.qj-rec.recording{background:#fff0f2;color:#bd4258}.qj-rec-status{margin:8px 0 0;color:#8a93a3;font-size:9px}.qj-list{display:grid;gap:8px;margin-top:10px}.qj-audio{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border-radius:11px;background:#fff;border:1px solid #edf0f5}.qj-audio audio{width:100%;height:34px}.qj-del{border:0;background:#fff0f2;color:#b74458;border-radius:9px;padding:8px 9px;font-size:8px;font-weight:850;cursor:pointer}.qj-empty{color:#9aa2b1;font-size:9px;padding:6px 0}
      .qj-footer{display:flex;justify-content:flex-end;gap:8px;padding:0 22px 20px}.qj-cancel,.qj-save{min-height:42px;padding:0 15px;border:0;border-radius:11px;font-size:10px;font-weight:900;cursor:pointer}.qj-cancel{background:#f0f2f6;color:#5e687a}.qj-save{background:linear-gradient(115deg,#18b6aa,#647ff0 56%,#8559e8);color:#fff}.qj-private{margin-right:auto;align-self:center;color:#8d96a6;font-size:8px}
      @media(max-width:620px){.qj-bg{padding:0;align-items:end}.qj-modal{width:100%;max-height:94vh;border-radius:22px 22px 0 0}.qj-head,.qj-body{padding-left:16px;padding-right:16px}.qj-footer{padding-left:16px;padding-right:16px}}
    `;document.head.appendChild(st);
  }

  async function user(){if(S.user)return S.user;const {data:{user}}=await db.auth.getUser();S.user=user||null;return S.user}

  function cardPlanId(card){const a=card.querySelector('[data-share],[data-delete]');return a?.dataset.share||a?.dataset.delete||null}
  function isQuranPlan(p){return p && (p.template_key==='quran'||/\bqur'?an\b/i.test(p.title||''))}

  async function loadVisible(force=false){
    if(S.busy)return; if(!force&&Date.now()-S.lastLoad<1800)return;
    const u=await user();if(!u)return;
    const cards=$$('.lm-plan-card').filter(c=>c.querySelector('.lm-plan-timeline'));
    const ids=[...new Set(cards.map(cardPlanId).filter(Boolean))];if(!ids.length)return;
    S.busy=true;
    try{
      const pr=await db.from('life_plans').select('id,user_id,title,template_key,start_date,end_date').in('id',ids);
      if(pr.error)return;
      (pr.data||[]).forEach(p=>S.plans.set(p.id,p));
      const qids=(pr.data||[]).filter(isQuranPlan).map(p=>p.id);if(!qids.length){S.lastLoad=Date.now();return;}
      const [nr,vr]=await Promise.all([
        db.from('quran_revision_days').select('*').eq('user_id',u.id).in('plan_id',qids),
        db.from('quran_voice_notes').select('*').eq('user_id',u.id).in('plan_id',qids).order('created_at',{ascending:true})
      ]);
      if(!nr.error){S.notes.clear();(nr.data||[]).forEach(n=>S.notes.set(key(n.plan_id,n.revision_date),n));}
      if(!vr.error){S.voices.clear();(vr.data||[]).forEach(v=>{const k=key(v.plan_id,v.revision_date);if(!S.voices.has(k))S.voices.set(k,[]);S.voices.get(k).push(v);});}
      S.lastLoad=Date.now();
    }finally{S.busy=false}
  }

  function hasContent(planId,date){const n=S.notes.get(key(planId,date)),v=S.voices.get(key(planId,date))||[];return !!((n?.reference_text||'').trim()||(n?.revision_notes||'').trim()||(n?.confusion_text||'').trim()||v.length)}

  function decorate(){
    $$('.lm-plan-card').forEach(card=>{
      const pid=cardPlanId(card),p=S.plans.get(pid);if(!isQuranPlan(p))return;
      const start=parse(p.start_date),dots=$$('.lm-day-dot',card.querySelector('.lm-plan-timeline'));if(!start||!dots.length)return;
      dots.forEach((dot,i)=>{
        const date=iso(addDays(start,i));dot.dataset.qjPlan=pid;dot.dataset.qjDate=date;dot.classList.add('qj-clickable');dot.classList.toggle('qj-has-note',hasContent(pid,date));dot.tabIndex=0;
        const base=(dot.getAttribute('aria-label')||dot.title||dmy(date)).replace(/ · Quran revision saved$/,'');dot.title=`${base} — click to open Quran revision`;dot.setAttribute('aria-label',`${base}${hasContent(pid,date)?' · Quran revision saved':''}`);
      });
      const legend=card.querySelector('.lm-plan-timeline-legend');if(legend&&!card.querySelector('.qj-timeline-hint'))legend.insertAdjacentHTML('afterend','<div class="qj-timeline-hint">Click any day to open its Quran revision journal.</div>');
    });
  }

  async function scan(force=false){styles();await loadVisible(force);decorate()}

  async function refreshDay(planId,date){
    const u=await user();if(!u)return;
    const [nr,vr]=await Promise.all([
      db.from('quran_revision_days').select('*').eq('user_id',u.id).eq('plan_id',planId).eq('revision_date',date).maybeSingle(),
      db.from('quran_voice_notes').select('*').eq('user_id',u.id).eq('plan_id',planId).eq('revision_date',date).order('created_at',{ascending:true})
    ]);
    if(!nr.error){if(nr.data)S.notes.set(key(planId,date),nr.data);else S.notes.delete(key(planId,date));}
    if(!vr.error)S.voices.set(key(planId,date),vr.data||[]);
  }

  async function openDay(planId,date){
    await refreshDay(planId,date);S.current={planId,date};
    const n=S.notes.get(key(planId,date))||{}, p=S.plans.get(planId)||{};
    closeModal();
    const bg=document.createElement('div');bg.className='qj-bg';bg.id='qjModal';bg.innerHTML=`<section class="qj-modal" role="dialog" aria-modal="true" aria-label="Quran revision for ${esc(dmy(date))}">
      <div class="qj-head"><div><span>QURAN REVISION JOURNAL</span><h2>Revision for ${esc(dmy(date))}</h2><p>${esc(p.title||'Quran')} · your private daily reference</p></div><button class="qj-x" data-qj-close aria-label="Close">×</button></div>
      <div class="qj-body">
        <label class="qj-field"><span>Quran reference</span><input id="qjReference" maxlength="240" placeholder="e.g. Al-Baqarah 1–20 · Juz' 2" value="${esc(n.reference_text||'')}"><small>Write the Surah, Ayat, Juz’ or any reference that helps you find this part again.</small></label>
        <label class="qj-field"><span>What I revised</span><textarea id="qjRevised" maxlength="4000" placeholder="What did you revise today?">${esc(n.revision_notes||'')}</textarea></label>
        <label class="qj-field"><span>What confused me</span><textarea id="qjConfusion" maxlength="4000" placeholder="Ayat, words, Tajweed, meaning or anything you want to revisit.">${esc(n.confusion_text||'')}</textarea></label>
        <section class="qj-voice"><div class="qj-voice-head"><strong>🎙 Voice notes about confusing parts</strong><button type="button" class="qj-rec" data-qj-record>Record note</button></div><div class="qj-rec-status" id="qjRecordStatus">Private to you. Tap record, speak, then stop.</div><div class="qj-list" id="qjVoiceList"></div></section>
      </div>
      <div class="qj-footer"><span class="qj-private">🔒 Saved privately to your Quran journal</span><button type="button" class="qj-cancel" data-qj-close>Close</button><button type="button" class="qj-save" data-qj-save>Save revision</button></div>
    </section>`;
    document.body.appendChild(bg);await renderVoices();
  }

  function closeModal(){stopRecording(false);$('#qjModal')?.remove();S.current=null}

  async function saveRevision(){
    if(!S.current)return;const u=await user();if(!u)return;
    const {planId,date}=S.current,reference=$('#qjReference')?.value.trim()||'',revision=$('#qjRevised')?.value.trim()||'',confusion=$('#qjConfusion')?.value.trim()||'';
    const btn=$('[data-qj-save]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
    try{
      if(!reference&&!revision&&!confusion){await db.from('quran_revision_days').delete().eq('user_id',u.id).eq('plan_id',planId).eq('revision_date',date);S.notes.delete(key(planId,date));}
      else{
        const r=await db.from('quran_revision_days').upsert({user_id:u.id,plan_id:planId,revision_date:date,reference_text:reference,revision_notes:revision,confusion_text:confusion,updated_at:new Date().toISOString()},{onConflict:'user_id,plan_id,revision_date'}).select().single();
        if(r.error)throw r.error;S.notes.set(key(planId,date),r.data);
      }
      decorate();if(btn){btn.textContent='Saved ✓';setTimeout(()=>{if(btn)btn.textContent='Save revision'},1200)}
    }catch(e){alert(e.message||'Could not save this Quran revision.');if(btn)btn.textContent='Save revision'}finally{if(btn)btn.disabled=false}
  }

  function bestMime(){const opts=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];return opts.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||''}
  function extFor(m){if(/mp4/i.test(m))return'm4a';if(/ogg/i.test(m))return'ogg';if(/mpeg/i.test(m))return'mp3';return'webm'}

  async function startRecording(){
    if(!S.current||S.recorder)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Voice recording is not supported by this browser.');return;}
    try{
      S.stream=await navigator.mediaDevices.getUserMedia({audio:true});S.chunks=[];const mime=bestMime();S.recorder=new MediaRecorder(S.stream,mime?{mimeType:mime}:undefined);S.recordStarted=Date.now();
      S.recorder.ondataavailable=e=>{if(e.data?.size)S.chunks.push(e.data)};
      S.recorder.onstop=async()=>{const type=S.recorder?.mimeType||mime||'audio/webm',blob=new Blob(S.chunks,{type}),seconds=Math.max(1,Math.round((Date.now()-S.recordStarted)/1000));S.stream?.getTracks().forEach(t=>t.stop());S.stream=null;S.recorder=null;S.chunks=[];await uploadVoice(blob,type,seconds)};
      S.recorder.start();const b=$('[data-qj-record]');if(b){b.textContent='■ Stop';b.classList.add('recording')}const st=$('#qjRecordStatus');if(st)st.textContent='Recording… tap Stop when you finish.';
    }catch(e){alert('Microphone permission is needed to record a voice note.');S.recorder=null;S.stream?.getTracks().forEach(t=>t.stop());S.stream=null}
  }

  function stopRecording(save=true){
    if(!S.recorder)return;
    if(save){try{S.recorder.stop()}catch{}}else{try{S.recorder.onstop=null;S.recorder.stop()}catch{}S.stream?.getTracks().forEach(t=>t.stop());S.stream=null;S.recorder=null;S.chunks=[]}
    const b=$('[data-qj-record]');if(b){b.textContent='Record note';b.classList.remove('recording')}
  }

  async function uploadVoice(blob,mime,seconds){
    if(!S.current)return;const u=await user();if(!u)return;const {planId,date}=S.current,st=$('#qjRecordStatus');if(st)st.textContent='Saving voice note…';
    const path=`${u.id}/${planId}/${date}/${crypto.randomUUID()}.${extFor(mime)}`;
    try{
      const up=await db.storage.from('quran-voice-notes').upload(path,blob,{contentType:mime,upsert:false});if(up.error)throw up.error;
      const ins=await db.from('quran_voice_notes').insert({user_id:u.id,plan_id:planId,revision_date:date,storage_path:path,duration_seconds:seconds,note_type:'confusion'}).select().single();if(ins.error){await db.storage.from('quran-voice-notes').remove([path]);throw ins.error}
      const k=key(planId,date);if(!S.voices.has(k))S.voices.set(k,[]);S.voices.get(k).push(ins.data);decorate();await renderVoices();if(st)st.textContent='Voice note saved.';
    }catch(e){if(st)st.textContent='Could not save voice note.';alert(e.message||'Could not save voice note.')}
  }

  async function renderVoices(){
    const host=$('#qjVoiceList');if(!host||!S.current)return;const list=S.voices.get(key(S.current.planId,S.current.date))||[];
    if(!list.length){host.innerHTML='<div class="qj-empty">No voice notes for this day yet.</div>';return}
    host.innerHTML=list.map(v=>`<div class="qj-audio" data-qj-voice="${v.id}"><div>Loading recording…</div><button type="button" class="qj-del" data-qj-delete-voice="${v.id}">Delete</button></div>`).join('');
    await Promise.all(list.map(async v=>{const row=host.querySelector(`[data-qj-voice="${v.id}"]`);if(!row)return;const s=await db.storage.from('quran-voice-notes').createSignedUrl(v.storage_path,3600);const box=row.firstElementChild;if(s.error){box.textContent='Recording unavailable';return}box.innerHTML=`<audio controls preload="metadata" src="${esc(s.data.signedUrl)}"></audio><small style="display:block;color:#8a93a3;font-size:8px;margin-top:2px">${v.duration_seconds||'—'} sec</small>`;}));
  }

  async function deleteVoice(id){
    if(!S.current)return;const list=S.voices.get(key(S.current.planId,S.current.date))||[],v=list.find(x=>x.id===id);if(!v)return;
    const r=await db.from('quran_voice_notes').delete().eq('id',id);if(r.error){alert(r.error.message);return}await db.storage.from('quran-voice-notes').remove([v.storage_path]);S.voices.set(key(S.current.planId,S.current.date),list.filter(x=>x.id!==id));decorate();await renderVoices();
  }

  function bind(){
    document.addEventListener('click',e=>{
      const dot=e.target.closest('[data-qj-plan][data-qj-date]');if(dot){e.preventDefault();e.stopPropagation();openDay(dot.dataset.qjPlan,dot.dataset.qjDate);return}
      if(e.target.closest('[data-qj-close]')){closeModal();return}
      if(e.target.closest('[data-qj-save]')){saveRevision();return}
      if(e.target.closest('[data-qj-record]')){S.recorder?stopRecording(true):startRecording();return}
      const del=e.target.closest('[data-qj-delete-voice]');if(del){deleteVoice(del.dataset.qjDeleteVoice);return}
      if(e.target.classList.contains('qj-bg'))closeModal();
    },true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#qjModal')){e.preventDefault();closeModal()}else if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-qj-plan][data-qj-date]')){e.preventDefault();openDay(e.target.dataset.qjPlan,e.target.dataset.qjDate)}},true);
    let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>scan(false),180)}).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('medora:plan-range-updated',()=>setTimeout(()=>scan(true),180));
  }

  function init(){styles();bind();scan(true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();