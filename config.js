// Medora public frontend configuration.
// IMPORTANT: This is a publishable Supabase key, which is safe to use in browser code.
// Never place a Supabase service_role key or secret key in this file.
window.MEDORA_CONFIG = {
  SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
};

// Compatibility guard for an older Study observer option. This runs before the
// Study hierarchy script so the final Study UI can initialize instead of
// stopping at the loading state.
(() => {
  if (window.__MEDORA_MUTATION_OBSERVER_COMPAT__) return;
  window.__MEDORA_MUTATION_OBSERVER_COMPAT__ = true;
  const nativeObserve = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function(target, options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'classList')) {
      const fixed = { ...options };
      delete fixed.classList;
      fixed.attributes = true;
      fixed.attributeFilter = Array.from(new Set([...(fixed.attributeFilter || []), 'class']));
      return nativeObserve.call(this, target, fixed);
    }
    return nativeObserve.call(this, target, options);
  };
})();

// Make Study navigation state immediate, even while Study modules initialize.
(() => {
  const setStudyTopbar = () => {
    const kicker = document.getElementById('topbarKicker');
    const title = document.getElementById('topbarTitle');
    if (kicker) kicker.textContent = 'STUDY';
    if (title) title.textContent = 'Learn together. Finish stronger.';
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-study-link]')) setStudyTopbar();
  }, true);
})();

// Study boot guard: never paint the legacy Study screen before the final
// simplified hierarchy/collaboration layer is ready. If an enhancement fails,
// fall back to the core Study UI after a few seconds so Study remains usable.
(() => {
  if (document.getElementById('medoraStudyBootGuardStyle')) return;
  const style = document.createElement('style');
  style.id = 'medoraStudyBootGuardStyle';
  style.textContent = `
    .sh-root:not(.medora-study-final-ready){
      position:relative;
      min-height:220px;
    }
    .sh-root:not(.medora-study-final-ready) > *{
      visibility:hidden!important;
    }
    .sh-root:not(.medora-study-final-ready)::before{
      content:'Opening Study…';
      position:absolute;
      inset:0 auto auto 0;
      width:100%;
      min-height:150px;
      display:grid;
      place-items:center;
      border:1px solid #e1e7f0;
      border-radius:20px;
      background:linear-gradient(145deg,#ffffff,#f7f9fd);
      color:#7b8799;
      font-size:12px;
      font-weight:800;
      letter-spacing:.01em;
    }
    .sh-root.medora-study-final-ready{
      animation:medoraStudyReady .16s ease both;
    }
    @keyframes medoraStudyReady{
      from{opacity:.45;transform:translateY(2px)}
      to{opacity:1;transform:none}
    }
  `;
  document.head.appendChild(style);

  const fallbackTimers = new WeakMap();
  let scheduled = false;

  const inspect = () => {
    scheduled = false;
    document.querySelectorAll('.sh-root').forEach(root => {
      if (root.classList.contains('medora-study-final-ready')) return;
      if (root.querySelector('.mh-study-card')) {
        root.classList.add('medora-study-final-ready');
        const timer = fallbackTimers.get(root);
        if (timer) clearTimeout(timer);
        fallbackTimers.delete(root);
        return;
      }
      if (!fallbackTimers.has(root)) {
        const timer = setTimeout(() => {
          if (document.documentElement.contains(root) && !root.classList.contains('medora-study-final-ready')) {
            console.warn('Study enhancement did not finish in time; showing core Study UI.');
            root.classList.add('medora-study-final-ready');
          }
          fallbackTimers.delete(root);
        }, 4000);
        fallbackTimers.set(root, timer);
      }
    });
  };

  const scheduleInspect = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(inspect);
  };

  const observer = new MutationObserver(scheduleInspect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleInspect();
})();

// Small post-boot helpers. The core app remains independent so an optional
// enhancement can never prevent authentication or the main Medora UI loading.
(() => {
  const load = (attr, src) => {
    if (document.querySelector(`script[${attr}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, 'true');
    document.head.appendChild(script);
  };
  const bootEnhancements = () => {
    load('data-medora-auth-redesign', 'auth-redesign.js?v=1.0.0');
    load('data-medora-nav-order', 'nav-order.js?v=1.2.0');
    load('data-medora-brain', 'medora-brain.js?v=1.0.0');
    load('data-medora-progress-intelligence', 'progress-intelligence.js?v=1.0.0');
    load('data-medora-ambient-audio', 'ambient-audio.js?v=1.2.0');
    load('data-medora-planner-edit', 'planner-edit-enhancement.js?v=1.0.0');
    load('data-medora-sticky-topbar', 'sticky-topbar.js?v=1.0.0');
    load('data-medora-goal-card-accordion', 'goal-card-accordion.js?v=1.0.0');
    load('data-medora-plan-accountability', 'plan-accountability.js?v=1.0.0');
    load('data-medora-plan-card-links-v2', 'plan-card-accordion-links-v2.js?v=2.0.0');
    load('data-medora-plan-update-reflection-v3', 'plan-update-reflection-v3.js?v=3.0.0');
    load('data-medora-hobby-cards', 'hobby-cards.js?v=1.0.0');
    load('data-medora-study-simple-ui', 'study-simple-ui.js?v=1.0.0');
    load('data-medora-study-hierarchy-collab', 'study-hierarchy-collab.js?v=1.0.1');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEnhancements, { once: true });
  else bootEnhancements();
})();
