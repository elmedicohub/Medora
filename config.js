// Medora public frontend configuration.
// IMPORTANT: This is a publishable Supabase key, which is safe to use in browser code.
// Never place a Supabase service_role key or secret key in this file.
window.MEDORA_CONFIG = {
  SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
};

// Keep the final Medora navigation order stable even when additive modules
// (Wall, Activity and Study) are injected after the core app boots.
(() => {
  const loadNavOrder = () => {
    if (document.querySelector('script[data-medora-nav-order]')) return;
    const script = document.createElement('script');
    script.src = 'nav-order.js?v=1.0.0';
    script.defer = true;
    script.dataset.medoraNavOrder = 'true';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNavOrder, { once: true });
  else loadNavOrder();
})();
