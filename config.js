// Medora public frontend configuration.
// IMPORTANT: This is a publishable Supabase key, which is safe to use in browser code.
// Never place a Supabase service_role key or secret key in this file.
window.MEDORA_CONFIG = {
  SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
};

// If the user refreshed while on Study, keep the default My Day render hidden
// until the single Study V2 owner restores the Study screen. This avoids a
// homepage flash without showing a fake loading page.
(() => {
  try {
    if (localStorage.getItem('medora.lastScreen') !== 'study') return;
    document.documentElement.classList.add('medora-restore-study');
    const style = document.createElement('style');
    style.id = 'medoraStudyRestoreStyle';
    style.textContent = `
      html.medora-restore-study #screenContainer,
      html.medora-restore-study .topbar > div:first-child { visibility:hidden!important; }
    `;
    document.head.appendChild(style);
  } catch (_) {}
})();

// Small post-boot helpers. Study V2 is intentionally loaded statically in
// index.html before app.js so it has one deterministic owner and load order.
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
    load('data-medora-plan-card-links-v2', 'plan-card-accordion-links-v2.js?v=2.0.0');
    load('data-medora-plan-update-reflection-v3', 'plan-update-reflection-v3.js?v=3.0.0');
    load('data-medora-hobby-cards', 'hobby-cards.js?v=1.0.0');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEnhancements, { once: true });
  else bootEnhancements();
})();
