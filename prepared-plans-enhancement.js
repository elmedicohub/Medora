(() => {
  "use strict";
  if (window.__MEDORA_PREPARED_PLANS__) return;
  window.__MEDORA_PREPARED_PLANS__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function addStyles() {
    if ($("#medoraPreparedPlansStyle")) return;
    const style = document.createElement("style");
    style.id = "medoraPreparedPlansStyle";
    style.textContent = `
      .lm-template[data-template="prayers"]{position:relative;border-color:#b9a9f5!important;background:linear-gradient(145deg,#ffffff 0%,#f6f3ff 100%)!important;box-shadow:0 14px 34px rgba(84,69,176,.10)!important}
      .lm-template[data-template="prayers"]::before{content:"FEATURED PREPARED PLAN";position:absolute;top:10px;right:10px;padding:4px 7px;border-radius:999px;background:#eee9ff;color:#6553c7;font-size:7px;font-weight:900;letter-spacing:.08em}
      .lm-template[data-template="prayers"] > span:first-child{font-size:28px!important}
      .lm-template[data-template="prayers"] strong{padding-right:76px}
      .lm-template[data-template="prayers"] small{line-height:1.45}
      .mpp-note{display:inline-flex;align-items:center;gap:6px;margin-top:7px;padding:6px 9px;border-radius:999px;background:#f1f4ff;color:#6672cb;font-size:8px;font-weight:850}
      @media(max-width:620px){.lm-template[data-template="prayers"]::before{position:static;display:inline-flex;width:max-content;margin:0 0 8px}.lm-template[data-template="prayers"] strong{padding-right:0}}
    `;
    document.head.appendChild(style);
  }

  function enhance() {
    addStyles();

    // The existing Explore templates ARE the prepared-plan library. Give it the
    // correct product language instead of creating a second duplicate system.
    $$('.lm-tabs [data-tab="explore"]').forEach(btn => {
      if (btn.textContent.trim() !== "Prepared plans") btn.textContent = "Prepared plans";
    });

    const prayer = $('.lm-template[data-template="prayers"]');
    if (!prayer) return;

    const grid = prayer.parentElement;
    if (grid && grid.firstElementChild !== prayer) grid.prepend(prayer);

    const title = prayer.querySelector('strong');
    const subtitle = prayer.querySelector('small');
    const action = prayer.querySelector('em');
    if (title) title.textContent = 'Five daily prayers';
    if (subtitle) subtitle.textContent = '5 prayers every day · home or mosque · Sunnah · Azkar · daily prayer habit score.';
    if (action) action.textContent = 'Use this prepared plan →';

    const section = prayer.closest('.lm-section');
    const head = section?.querySelector('.lm-section-head > div');
    if (head) {
      const h2 = head.querySelector('h2');
      const p = head.querySelector('p');
      if (h2) h2.textContent = 'Prepared plans';
      if (p) p.textContent = 'Choose a ready-made plan, then personalize the duration, start date, schedule and privacy.';
      if (!head.querySelector('.mpp-note')) {
        const note = document.createElement('span');
        note.className = 'mpp-note';
        note.textContent = '✓ Ready-made routines — no need to build from zero';
        head.appendChild(note);
      }
    }

    // Keep the same language across all ready-made cards.
    $$('.lm-template[data-template]').forEach(card => {
      const em = card.querySelector('em');
      if (em && card !== prayer && /Build this plan/i.test(em.textContent)) em.textContent = 'Use prepared plan →';
    });
  }

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(enhance, 60);
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-screen="planner"], [data-tab="explore"], [data-start-plan]')) schedule();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
  else enhance();
})();
