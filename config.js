// Medora public frontend configuration.
// IMPORTANT: This is a publishable Supabase key, which is safe to use in browser code.
// Never place a Supabase service_role key or secret key in this file.
window.MEDORA_CONFIG = {
  SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
};

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
    load('data-medora-study-hierarchy-collab', 'study-hierarchy-collab.js?v=1.0.0');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEnhancements, { once: true });
  else bootEnhancements();
})();
