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
    load('data-medora-nav-order', 'nav-order.js?v=1.1.0');
    load('data-medora-brain', 'medora-brain.js?v=1.0.0');
    load('data-medora-progress-intelligence', 'progress-intelligence.js?v=1.0.0');
    load('data-medora-ambient-audio', 'ambient-audio.js?v=1.0.0');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEnhancements, { once: true });
  else bootEnhancements();
})();
