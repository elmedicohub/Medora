(() => {
  "use strict";
  if (window.__MEDORA_STUDY_CUSTOM_PLAN_STABLE_LOADER__) return;
  window.__MEDORA_STUDY_CUSTOM_PLAN_STABLE_LOADER__ = true;

  const files = [
    ['study-custom-date-plans-v3.js?v=3.1.0', '__MEDORA_STUDY_CUSTOM_DATE_PLANS_V3__'],
    ['study-day-notes.js?v=1.1.0', '__MEDORA_STUDY_DAY_NOTES__'],
    ['study-plan-calendar.js?v=1.1.0', '__MEDORA_STUDY_PLAN_CALENDAR__'],
    ['escape-close.js?v=1.0.0', '__MEDORA_ESCAPE_CLOSE__']
  ];

  const load = ([src, flag]) => new Promise(resolve => {
    if (window[flag]) return resolve();
    const existing = [...document.scripts].find(s => (s.getAttribute('src') || '').includes(src.split('?')[0]));
    if (existing) {
      if (window[flag]) return resolve();
      existing.addEventListener('load', resolve, {once:true});
      existing.addEventListener('error', resolve, {once:true});
      setTimeout(resolve, 1500);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });

  (async () => {
    for (const file of files) await load(file);
  })();
})();