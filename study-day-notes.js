(() => {
  "use strict";
  if (window.__MEDORA_STUDY_DAY_NOTES__) return;
  window.__MEDORA_STUDY_DAY_NOTES__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function addStyles(){
    if ($('#studyDayNotesStyle')) return;
    const s=document.createElement('style');
    s.id='studyDayNotesStyle';
    s.textContent=`
      /* Readability overrides for custom date study plans */
      #scp3Section .ms2-section-head h2{font-size:24px!important;line-height:1.2!important}
      #scp3Section .ms2-section-head p{font-size:13px!important;line-height:1.45!important;margin-top:5px!important}
      #scp3Section .scp3-head{padding:16px 17px!important}
      #scp3Section .scp3-head strong{font-size:17px!important;line-height:1.25!important;color:#1f2b3e!important}
      #scp3Section .scp3-head small{font-size:12px!important;line-height:1.4!important;margin-top:5px!important}
      #scp3Section .scp3-pill{font-size:11px!important;padding:7px 10px!important}
      #scp3Section .scp3-day{grid-template-columns:112px 34px minmax(0,1fr) 70px auto!important;gap:11px!important;padding:12px 13px!important;min-height:58px!important}
      #scp3Section .scp3-date{font-size:12px!important;line-height:1.3!important}
      #scp3Section .scp3-day strong{font-size:14px!important;line-height:1.35!important;color:#263449!important}
      #scp3Section .scp3-day small{font-size:12px!important;line-height:1.4!important;margin-top:4px!important;color:#778399!important}
      #scp3Section .scp3-check{width:30px!important;height:30px!important;font-size:14px!important}
      #scp3Section .scp3-actions button{font-size:12px!important;min-height:39px!important;padding:0 13px!important}
      .sdn-note-button{min-height:34px;padding:0 11px;border:1px solid #dce4ee;border-radius:9px;background:#f5f7ff;color:#5368c9;font-size:11px;font-weight:850;cursor:pointer;white-space:nowrap}
      .sdn-note-button:hover{background:#edf1ff}
      .sdn-note-button.has-note{background:#edf8f4;border-color:#c7eadc;color:#26705c}
      .sdn-bg{position:fixed;z-index:1300;inset:0;display:grid;place-items:center;padding:16px;background:#0b142994;backdrop-filter:blur(6px)}
      .sdn-modal{width:min(600px,100%);border-radius:20px;background:#fff;box-shadow:0 28px 90px #0a143250;overflow:hidden}
      .sdn-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #edf0f5}
      .sdn-head small{display:block;color:#707ce0;font-size:10px;font-weight:900;letter-spacing:.1em}
      .sdn-head h3{margin:5px 0 0;font-size:21px;color:#1f2b3e}
      .sdn-close{width:36px;height:36px;border:0;border-radius:50%;background:#eff2f6;font-size:20px;cursor:pointer}
      .sdn-body{padding:18px 20px}
      .sdn-body label{display:grid;gap:7px;color:#5f6b7f;font-size:12px;font-weight:800}
      .sdn-body textarea{width:100%;min-height:150px;resize:vertical;padding:12px 13px;border:1px solid #dce3ed;border-radius:12px;font:inherit;font-size:14px;line-height:1.5;box-sizing:border-box;outline:none}
      .sdn-body textarea:focus{border-color:#9ca9ed;box-shadow:0 0 0 4px rgba(96,112,227,.08)}
      .sdn-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      .sdn-foot button{min-height:40px;padding:0 14px;border:0;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer}
      .sdn-cancel{background:#eff2f6;color:#586479}.sdn-save{background:linear-gradient(115deg,#18b6aa,#657ff1 55%,#8659e9);color:#fff}
      @media(max-width:760px){
        #scp3Section .scp3-day{grid-template-columns:86px 32px minmax(0,1fr) auto!important}
        #scp3Section .scp3-day>.scp3-date:last-of-type{grid-column:3!important}
        #scp3Section .sdn-note-button{grid-column:4;grid-row:1/3}
      }
      @media(max-width:520px){
        #scp3Section .scp3-head strong{font-size:16px!important}
        #scp3Section .scp3-day{grid-template-columns:76px 30px minmax(0,1fr)!important}
        #scp3Section .scp3-date{font-size:11px!important}
        #scp3Section .scp3-day strong{font-size:13px!important}
        #scp3Section .scp3-day small{font-size:11px!important}
        #scp3Section .sdn-note-button{grid-column:3!important;grid-row:auto!important;justify-self:start;margin-top:4px}
      }
    `;
    document.head.appendChild(s);
  }

  function decorate(){
    addStyles();
    $$('#scp3Section .scp3-day').forEach(row=>{
      if (row.querySelector('.sdn-note-button')) return;
      const done=row.querySelector('[data-done]');
      if (!done?.dataset.done) return;
      const existingNote=row.querySelector('small')?.textContent?.trim() || '';
      const b=document.createElement('button');
      b.type='button';
      b.className='sdn-note-button'+(existingNote?' has-note':'');
      b.dataset.studyDayNote=done.dataset.done;
      b.textContent=existingNote?'📝 Notes ✓':'📝 Notes';
      b.title='Open notes for this study day';
      row.appendChild(b);
    });
  }

  async function openNote(dayId){
    const {data:{user}}=await db.auth.getUser();
    if(!user) return;
    const {data,error}=await db.from('study_custom_plan_days')
      .select('id,study_date,topic,notes')
      .eq('id',dayId).eq('user_id',user.id).single();
    if(error){console.warn(error);alert('Could not open this day note.');return;}
    const bg=document.createElement('div');
    bg.className='sdn-bg';
    bg.innerHTML=`<section class="sdn-modal" role="dialog" aria-modal="true">
      <div class="sdn-head"><div><small>STUDY DAY NOTE</small><h3>${esc(data.study_date)} · ${esc(data.topic||'Study day')}</h3></div><button class="sdn-close" type="button">×</button></div>
      <div class="sdn-body"><label>Notes for this day<textarea id="sdnText" maxlength="3000" placeholder="Key points, what confused you, what to revise, questions to return to…">${esc(data.notes||'')}</textarea></label>
      <div class="sdn-foot"><button class="sdn-cancel" type="button">Cancel</button><button class="sdn-save" type="button">Save notes</button></div></div>
    </section>`;
    document.body.appendChild(bg);
    const close=()=>bg.remove();
    $('.sdn-close',bg).onclick=close;$('.sdn-cancel',bg).onclick=close;
    bg.onclick=e=>{if(e.target===bg)close()};
    $('.sdn-save',bg).onclick=async()=>{
      const btn=$('.sdn-save',bg),notes=$('#sdnText',bg).value.trim();
      btn.disabled=true;btn.textContent='Saving…';
      const {error}=await db.from('study_custom_plan_days').update({notes,updated_at:new Date().toISOString()}).eq('id',dayId).eq('user_id',user.id);
      if(error){btn.disabled=false;btn.textContent='Save notes';alert(error.message);return;}
      const row=document.querySelector(`#scp3Section [data-done="${CSS.escape(dayId)}"]`)?.closest('.scp3-day');
      if(row){
        const topicWrap=row.querySelector('.scp3-check')?.nextElementSibling;
        let small=topicWrap?.querySelector('small');
        if(notes){if(!small&&topicWrap){small=document.createElement('small');topicWrap.appendChild(small)}if(small)small.textContent=notes;}
        else if(small)small.remove();
        const noteBtn=row.querySelector('.sdn-note-button');
        if(noteBtn){noteBtn.classList.toggle('has-note',!!notes);noteBtn.textContent=notes?'📝 Notes ✓':'📝 Notes';}
      }
      close();
    };
    setTimeout(()=>$('#sdnText',bg)?.focus(),30);
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-study-day-note]');
    if(!b) return;
    e.preventDefault();e.stopPropagation();
    openNote(b.dataset.studyDayNote);
  },true);

  const screen=document.querySelector('#screenContainer');
  if(screen)new MutationObserver(()=>decorate()).observe(screen,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(decorate,80),{once:true});
  else setTimeout(decorate,80);
})();