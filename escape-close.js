(() => {
  "use strict";
  if (window.__MEDORA_ESCAPE_CLOSE__) return;
  window.__MEDORA_ESCAPE_CLOSE__ = true;

  const visible=el=>{
    if(!el||!el.isConnected)return false;
    const s=getComputedStyle(el);
    return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.getClientRects().length>0&&!el.classList.contains('hidden');
  };
  const overlayFor=el=>{
    if(!el)return null;
    let n=el;
    while(n&&n!==document.body){
      const s=getComputedStyle(n);
      if(n.classList.contains('modal-backdrop')||s.position==='fixed')return n;
      n=n.parentElement;
    }
    return el;
  };
  const z=el=>{const n=parseInt(getComputedStyle(el).zIndex,10);return Number.isFinite(n)?n:0};

  function topWindow(){
    const candidates=[];
    document.querySelectorAll('[role="dialog"]').forEach(d=>{if(visible(d)){const o=overlayFor(d);if(o&&visible(o))candidates.push(o)}});
    document.querySelectorAll('.modal-backdrop:not(.hidden),.ms2-modal-bg,.scp3-bg,.scp2-bg,.scp-bg,.sdn-bg,.qrj-bg,.ptd-bg,.qj-bg').forEach(o=>{if(visible(o))candidates.push(o)});
    const unique=[...new Set(candidates)];
    unique.sort((a,b)=>z(a)-z(b)||([...document.querySelectorAll('*')].indexOf(a)-[...document.querySelectorAll('*')].indexOf(b)));
    return unique.at(-1)||null;
  }

  function closeWindow(overlay){
    if(!overlay)return false;
    const close=overlay.querySelector('[data-close-modal],.modal-close,.ms2-x,.scp3-x,.scp2-x,.scp-x,.sdn-close,[aria-label="Close"],button[class$="-x"]');
    if(close&&visible(close)){close.click();return true;}
    if(overlay.classList.contains('modal-backdrop')){overlay.classList.add('hidden');return true;}
    if(overlay.parentNode){overlay.remove();return true;}
    return false;
  }

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const overlay=topWindow();
    if(!overlay)return;
    if(closeWindow(overlay)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  },true);
})();