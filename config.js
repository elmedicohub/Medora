// Medora public frontend configuration.
// IMPORTANT: This is a publishable Supabase key, which is safe to use in browser code.
// Never place a Supabase service_role key or secret key in this file.
window.MEDORA_CONFIG = {
  SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
};

// Deterministic startup guard.
// 1) Prevents the sign-in page flashing for users who already have a stored session.
// 2) If the last screen was Study, prevents My Day from ever becoming visible during boot.
//    The lock is released only when the real Study V2 root is actually present.
(() => {
  const root = document.documentElement;
  const projectRef = 'eoitruybmrgsrnbyioze';
  const lastScreenKey = 'medora.lastScreen';
  let guardStyle = null;
  let lastStudyKick = 0;
  let startTime = Date.now();

  const hasStoredAuth = (() => {
    try {
      return Object.keys(localStorage).some(k => k.includes(projectRef) && k.includes('auth-token'));
    } catch (_) {
      return false;
    }
  })();

  const wantsStudy = () => {
    try { return localStorage.getItem(lastScreenKey) === 'study'; }
    catch (_) { return false; }
  };

  const ensureStyle = () => {
    if (guardStyle?.isConnected) return;
    guardStyle = document.createElement('style');
    guardStyle.id = 'medoraStartupGuardStyle';
    guardStyle.textContent = `
      html.medora-session-restoring #authView { visibility:hidden!important; }
      html.medora-study-restoring #screenContainer,
      html.medora-study-restoring .topbar > div:first-child { visibility:hidden!important; }
    `;
    document.head.appendChild(guardStyle);
  };

  ensureStyle();
  if (hasStoredAuth) root.classList.add('medora-session-restoring');
  if (wantsStudy()) root.classList.add('medora-study-restoring');

  const isVisibleApp = () => {
    const app = document.getElementById('appView');
    return !!app && !app.classList.contains('hidden');
  };
  const isVisibleAuth = () => {
    const auth = document.getElementById('authView');
    return !!auth && !auth.classList.contains('hidden');
  };

  const kickStudy = () => {
    if (!wantsStudy() || !isVisibleApp()) return;
    const studyRoot = document.getElementById('medoraStudyV2');
    if (studyRoot) {
      root.classList.remove('medora-study-restoring', 'medora-restore-study');
      return;
    }

    root.classList.add('medora-study-restoring');
    const now = Date.now();
    if (now - lastStudyKick < 220) return;
    const button = document.querySelector('[data-study-link]');
    if (button) {
      lastStudyKick = now;
      button.click();
    }
  };

  const tick = () => {
    if (isVisibleApp()) {
      root.classList.remove('medora-session-restoring');
    } else if (!hasStoredAuth && isVisibleAuth()) {
      root.classList.remove('medora-session-restoring');
    } else if (hasStoredAuth && isVisibleAuth() && Date.now() - startTime > 6000) {
      // Safety fallback for a genuinely expired/broken stored session.
      root.classList.remove('medora-session-restoring');
    }

    if (wantsStudy()) {
      kickStudy();
    } else {
      root.classList.remove('medora-study-restoring', 'medora-restore-study');
    }
  };

  // Persist core navigation so a user who leaves Study does not get restored back to it.
  document.addEventListener('click', (event) => {
    const core = event.target.closest('[data-screen]');
    if (core?.dataset.screen) {
      try { localStorage.setItem(lastScreenKey, core.dataset.screen); } catch (_) {}
      root.classList.remove('medora-study-restoring', 'medora-restore-study');
      return;
    }
    if (event.target.closest('[data-study-link]')) {
      try { localStorage.setItem(lastScreenKey, 'study'); } catch (_) {}
      root.classList.add('medora-study-restoring');
    }
  }, true);

  const begin = () => {
    tick();
    const body = document.body;
    if (!body) return;
    const observer = new MutationObserver(tick);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // Keep a lightweight fallback pulse during startup for async auth/data races.
    let n = 0;
    const timer = setInterval(() => {
      tick();
      n += 1;
      if (n >= 60 && !wantsStudy()) clearInterval(timer);
    }, 150);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
})();

// Small post-boot helpers. Study V2 and the stable custom Study planner chain
// are loaded statically from index.html/study-custom-date-plans.js.
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
    load('data-medora-plan-accountability-v2', 'plan-accountability-v2.js?v=2.0.0');
    load('data-medora-prepared-plans', 'prepared-plans-enhancement.js?v=1.0.0');
    load('data-medora-planner-indefinite', 'planner-indefinite.js?v=1.0.0');
    load('data-medora-planner-tab-focus', 'planner-tab-focus.js?v=1.0.0');
    load('data-medora-quran-revision-journal-v2', 'quran-revision-journal-v2.js?v=2.0.0');
    load('data-medora-prayer-timeline-details', 'prayer-timeline-details.js?v=1.0.0');
    load('data-medora-plan-card-links-v2', 'plan-card-accordion-links-v2.js?v=2.0.0');
    load('data-medora-plan-update-reflection-v3', 'plan-update-reflection-v3.js?v=3.0.0');
    load('data-medora-hobby-cards', 'hobby-cards.js?v=1.0.0');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEnhancements, { once: true });
  else bootEnhancements();
})();
