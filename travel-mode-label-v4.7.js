(() => {
  'use strict';
  if (window.__MEDORA_TRAVEL_MODE_LABEL_47__) return;
  window.__MEDORA_TRAVEL_MODE_LABEL_47__ = true;

  const ICON_LABEL = new Map([
    ['✈','FLIGHT'],
    ['🚌','BUS'],
    ['🚗','CAR'],
    ['🚶','WALK'],
    ['Ⓜ','METRO'],
    ['🚋','TRAM'],
    ['🚆','TRAIN'],
    ['🚕','TAXI'],
    ['⇄','AIRPORT TRANSFER']
  ]);

  function updateCard(card){
    if (!(card instanceof Element)) return;
    const type = card.querySelector('.step-type');
    if (!type || type.textContent.trim().toUpperCase() !== 'TRANSPORT') return;
    const logo = card.querySelector('.transport-logo');
    const icon = logo?.textContent?.trim() || '';
    const label = ICON_LABEL.get(icon) || 'TRANSFER';
    type.textContent = label;
    type.dataset.actualMode = label.toLowerCase().replaceAll(' ','_');
  }

  function scan(root=document){
    if (root.matches?.('.journey-step-card')) updateCard(root);
    root.querySelectorAll?.('.journey-step-card').forEach(updateCard);
  }

  function start(){
    scan(document);
    const root=document.getElementById('journeyRoot')||document.body;
    new MutationObserver(records=>{
      for (const r of records) {
        for (const n of r.addedNodes) if (n instanceof Element) scan(n);
      }
    }).observe(root,{childList:true,subtree:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();