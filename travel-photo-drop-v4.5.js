(() => {
  "use strict";
  if (window.__MEDORA_TRAVEL_PHOTO_DROP_45__) return;
  window.__MEDORA_TRAVEL_PHOTO_DROP_45__ = true;

  const MAX = 8 * 1024 * 1024;
  const urls = new WeakMap();
  const $all=(s,r=document)=>[...r.querySelectorAll(s)];

  function toast(msg,type=''){
    const n=document.getElementById('journeyToast');
    if(!n)return;
    n.textContent=msg;
    n.className=`journey-toast show ${type}`.trim();
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>n.className='journey-toast',2500);
  }

  function valid(file){
    if(!file)return 'No image found.';
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type))return 'Use JPEG, PNG or WebP.';
    if(file.size>MAX)return 'Image must be 8 MB or smaller.';
    return '';
  }

  function assignFile(input,file){
    const err=valid(file);if(err){toast(err,'error');return false}
    try{
      const dt=new DataTransfer();
      dt.items.add(file);
      input.files=dt.files;
    }catch(e){console.warn('Travel photo drop assignment',e);return false}
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }

  function preview(zone,input,file){
    const old=urls.get(input);if(old)URL.revokeObjectURL(old);
    if(!file)return;
    const url=URL.createObjectURL(file);urls.set(input,url);
    zone.classList.add('has-file');
    const name=zone.querySelector('.travel-drop-file');if(name)name.textContent=file.name;
    let p=zone.parentElement?.querySelector(':scope > .travel-drop-mini-preview');
    const native=zone.closest('.jm-form')?.querySelector('#phPreview');
    if(native){native.style.backgroundImage=`url("${url.replaceAll('"','%22')}")`;return}
    if(!p){p=document.createElement('div');p.className='travel-drop-mini-preview';zone.insertAdjacentElement('afterend',p)}
    p.style.backgroundImage=`url("${url.replaceAll('"','%22')}")`;p.classList.add('show');
  }

  function enhance(zone){
    if(!zone||zone.dataset.travelDrop==='1')return;
    const input=zone.querySelector('input[type="file"][accept*="image"]');if(!input)return;
    zone.dataset.travelDrop='1';zone.classList.add('travel-drop-zone');zone.tabIndex=0;zone.setAttribute('role','button');zone.setAttribute('aria-label','Drop a travel photo here or choose a photo');
    zone.insertAdjacentHTML('beforeend',`<div class="travel-drop-icon">▧</div><div class="travel-drop-title">Drag & drop photo here</div><div class="travel-drop-sub">JPEG, PNG or WebP · maximum 8 MB</div><span class="travel-drop-browse">Choose photo</span><span class="travel-drop-file"></span>`);

    const choose=()=>input.click();
    zone.addEventListener('click',e=>{if(e.target===input||e.target.closest('label'))return;choose()});
    zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});
    ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();zone.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='copy'}));
    ['dragleave','dragend'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();if(type==='dragleave'&&!zone.contains(e.relatedTarget))zone.classList.remove('drag-over');if(type==='dragend')zone.classList.remove('drag-over')}));
    zone.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();zone.classList.remove('drag-over');
      const file=[...(e.dataTransfer?.files||[])].find(f=>f.type?.startsWith('image/'))||e.dataTransfer?.files?.[0];
      if(assignFile(input,file))preview(zone,input,file);
    });
    input.addEventListener('change',()=>{const f=input.files?.[0];const err=f?valid(f):'';if(err){toast(err,'error');input.value='';return}if(f)preview(zone,input,f)});
  }

  function scan(root=document){
    if(root.matches?.('.jm-file,.builder-photo'))enhance(root);
    $all('.jm-file,.builder-photo',root).forEach(enhance);
  }

  function boot(){
    scan();
    new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof Element)scan(n)}))).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();