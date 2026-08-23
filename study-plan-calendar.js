(() => {
  "use strict";
  if (window.__MEDORA_STUDY_PLAN_CALENDAR__) return;
  window.__MEDORA_STUDY_PLAN_CALENDAR__ = true;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW=["Sat","Sun","Mon","Tue","Wed","Thu","Fri"];
  const state={mode:localStorage.getItem('medora.studyPlanView')||'normal',month:null,observer:null,list:null};

  function addStyles(){
    if($('#studyPlanCalendarStyle')) return;
    const s=document.createElement('style');
    s.id='studyPlanCalendarStyle';
    s.textContent=`
      #scp3Section .spc-headrow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .spc-toggle{display:flex;gap:4px;padding:4px;border:1px solid #dfe5ee;border-radius:12px;background:#f1f4f9}
      .spc-toggle button{min-height:34px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:#68758a;font-size:12px;font-weight:850;cursor:pointer}
      .spc-toggle button.active{background:#fff;color:#25334a;box-shadow:0 2px 8px rgba(26,42,72,.08)}
      .spc-calendar{display:none;margin-top:14px}.spc-calendar.show{display:block}
      .spc-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .spc-toolbar strong{font-size:17px;color:#263449}.spc-toolbar span{display:flex;gap:6px}
      .spc-toolbar button{width:36px;height:36px;border:1px solid #dfe5ee;border-radius:10px;background:#fff;color:#536076;font-size:18px;cursor:pointer}.spc-toolbar button:hover{background:#f7f9fd}
      .spc-weekdays,.spc-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
      .spc-weekdays div{text-align:center;color:#8791a2;font-size:11px;font-weight:850;padding:6px 0}
      .spc-cell{min-height:112px;padding:8px;border:1px solid #e5eaf1;border-radius:12px;background:#fff;overflow:hidden}
      .spc-cell.empty{background:#fafbfd;border-style:dashed}.spc-cell.today{border-color:#90a1ee;box-shadow:0 0 0 3px rgba(100,124,230,.08)}
      .spc-daynum{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;color:#627087;font-size:12px;font-weight:900}
      .spc-todaytag{padding:2px 5px;border-radius:999px;background:#edf1ff;color:#6273d6;font-size:8px}
      .spc-items{display:grid;gap:5px}.spc-item{width:100%;border:0;border-radius:8px;padding:6px 7px;text-align:left;background:#f3f6fb;color:#334158;cursor:pointer;overflow:hidden}
      .spc-item:hover{background:#eaf0fb}.spc-item.done{background:#e9f8f1;color:#236954}.spc-item.rest{background:#f5f5f6;color:#7a8492}
      .spc-item b{display:block;font-size:10px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.spc-item small{display:block;margin-top:2px;font-size:8px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:900px){.spc-cell{min-height:94px;padding:6px}.spc-item b{font-size:9px}.spc-item small{display:none}}
      @media(max-width:620px){.spc-calendar{overflow-x:auto;padding-bottom:4px}.spc-weekdays,.spc-grid{min-width:720px}.spc-cell{min-height:100px}}
    `;
    document.head.appendChild(s);
  }

  function parseDMY(v){const m=String(v||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return null;const d=new Date(+m[3],+m[2]-1,+m[1]);return isNaN(d)?null:d}
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function collect(){
    const out=[];
    $$('#scp3Section .scp3-card').forEach(card=>{
      const planId=card.dataset.plan||'';
      const planTitle=$('.scp3-head strong',card)?.textContent?.trim()||'Study plan';
      $$('.scp3-day',card).forEach(row=>{
        const date=parseDMY($('.scp3-date',row)?.textContent?.trim());
        if(!date)return;
        const topic=row.querySelector('strong')?.textContent?.trim()||'Study';
        const dates=$$('.scp3-date',row);
        const time=dates.length>1?dates[dates.length-1].textContent.trim():'';
        const note=row.querySelector('small')?.textContent?.trim()||'';
        const done=row.querySelector('.scp3-check')?.classList.contains('done')||false;
        const rest=row.classList.contains('rest');
        out.push({date,planId,planTitle,topic,time,note,done,rest});
      });
    });
    return out;
  }

  function defaultMonth(items){
    if(state.month)return;
    const now=new Date(), nowKey=now.getFullYear()*12+now.getMonth();
    const months=items.map(x=>x.date.getFullYear()*12+x.date.getMonth());
    const chosen=months.includes(nowKey)?nowKey:(months.sort((a,b)=>a-b)[0]??nowKey);
    state.month=new Date(Math.floor(chosen/12),chosen%12,1);
  }

  function ensure(){
    const section=$('#scp3Section'); if(!section)return false;
    addStyles();
    let header=$('.ms2-section-head',section);
    if(header&&!$('.spc-headrow',section)){
      const wrap=document.createElement('div');wrap.className='spc-headrow';
      const text=document.createElement('div');
      while(header.firstChild)text.appendChild(header.firstChild);
      const toggle=document.createElement('div');toggle.className='spc-toggle';toggle.innerHTML='<button type="button" data-spc-view="normal">Normal</button><button type="button" data-spc-view="calendar">Calendar</button>';
      wrap.append(text,toggle);header.appendChild(wrap);
    }
    if(!$('#spcCalendar',section)){
      const cal=document.createElement('div');cal.id='spcCalendar';cal.className='spc-calendar';cal.innerHTML='<div class="spc-toolbar"><strong id="spcMonthLabel"></strong><span><button type="button" data-spc-prev aria-label="Previous month">‹</button><button type="button" data-spc-next aria-label="Next month">›</button></span></div><div class="spc-weekdays">'+DOW.map(d=>`<div>${d}</div>`).join('')+'</div><div id="spcGrid" class="spc-grid"></div>';
      section.appendChild(cal);
    }
    const list=$('#scp3List',section);
    if(list!==state.list){state.list=list;if(state.observer)state.observer.disconnect();if(list){state.observer=new MutationObserver(()=>{if(state.mode==='calendar')renderCalendar()});state.observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}}
    applyMode();
    return true;
  }

  function applyMode(){
    const section=$('#scp3Section');if(!section)return;
    const list=$('#scp3List',section),cal=$('#spcCalendar',section);
    $$('[data-spc-view]',section).forEach(b=>b.classList.toggle('active',b.dataset.spcView===state.mode));
    if(list)list.style.display=state.mode==='calendar'?'none':'';
    if(cal)cal.classList.toggle('show',state.mode==='calendar');
    if(state.mode==='calendar')renderCalendar();
  }

  function renderCalendar(){
    const section=$('#scp3Section');if(!section)return;
    const items=collect();defaultMonth(items);
    const m=state.month||new Date();
    const label=$('#spcMonthLabel',section),grid=$('#spcGrid',section);if(!label||!grid)return;
    label.textContent=`${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
    const first=new Date(m.getFullYear(),m.getMonth(),1), last=new Date(m.getFullYear(),m.getMonth()+1,0);
    const leading=(first.getDay()+1)%7;
    const by={};items.forEach(x=>{const k=key(x.date);(by[k]||(by[k]=[])).push(x)});
    const today=key(new Date());
    let html='';
    for(let i=0;i<leading;i++)html+='<div class="spc-cell empty"></div>';
    for(let d=1;d<=last.getDate();d++){
      const date=new Date(m.getFullYear(),m.getMonth(),d),k=key(date),arr=by[k]||[];
      html+=`<div class="spc-cell ${k===today?'today':''}"><div class="spc-daynum"><span>${d}</span>${k===today?'<span class="spc-todaytag">Today</span>':''}</div><div class="spc-items">${arr.map(x=>`<button type="button" class="spc-item ${x.done?'done':''} ${x.rest?'rest':''}" data-spc-plan="${esc(x.planId)}" data-spc-date="${esc(k)}"><b>${x.done?'✓ ':''}${esc(x.topic)}</b><small>${esc(x.planTitle)}${x.time?' · '+esc(x.time):''}${x.note?' · 📝':''}</small></button>`).join('')}</div></div>`;
    }
    const total=leading+last.getDate(),trail=(7-(total%7))%7;for(let i=0;i<trail;i++)html+='<div class="spc-cell empty"></div>';
    grid.innerHTML=html;
  }

  document.addEventListener('click',e=>{
    const view=e.target.closest('[data-spc-view]');if(view&&$('#scp3Section')?.contains(view)){state.mode=view.dataset.spcView;localStorage.setItem('medora.studyPlanView',state.mode);applyMode();return;}
    if(e.target.closest('[data-spc-prev]')){if(!state.month)return;state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);renderCalendar();return;}
    if(e.target.closest('[data-spc-next]')){if(!state.month)return;state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);renderCalendar();return;}
    const item=e.target.closest('[data-spc-plan]');if(item){
      state.mode='normal';localStorage.setItem('medora.studyPlanView','normal');applyMode();
      const card=document.querySelector(`#scp3Section .scp3-card[data-plan="${CSS.escape(item.dataset.spcPlan)}"]`);if(card){card.classList.add('open');setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),30)}
    }
  },true);

  const screen=$('#screenContainer');if(screen)new MutationObserver(()=>ensure()).observe(screen,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,80),{once:true});else setTimeout(ensure,80);
})();