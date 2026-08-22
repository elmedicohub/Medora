(() => {
  "use strict";

  const fallbackConfig = {
    SUPABASE_URL: "https://eoitruybmrgsrnbyioze.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable__ZwYly94tS9hVEXs9pjSxA_6mDYRWhl"
  };

  try {
    const parentCfg = window.parent && window.parent !== window ? window.parent.MEDORA_CONFIG : null;
    window.MEDORA_CONFIG = window.MEDORA_CONFIG || parentCfg || fallbackConfig;
  } catch (_) {
    window.MEDORA_CONFIG = window.MEDORA_CONFIG || fallbackConfig;
  }

  try {
    if (!window.supabase && window.parent && window.parent !== window && window.parent.supabase) {
      window.supabase = window.parent.supabase;
    }
  } catch (_) {}

  const showRuntimeError = (message) => {
    const loading = document.getElementById("journeyLoading");
    if (!loading || loading.classList.contains("hidden")) return;
    loading.innerHTML = `
      <div style="max-width:520px;padding:24px;text-align:center">
        <img src="assets/medora-mark.svg" alt="" style="width:48px;height:48px;margin-bottom:12px">
        <strong style="display:block;font-size:16px;color:#17213a">Travel could not start.</strong>
        <small style="display:block;margin-top:8px;color:#738097;line-height:1.5">${String(message || "Please reload Travel.")}</small>
        <button type="button" onclick="location.reload()" style="margin-top:14px;min-height:40px;padding:0 14px;border:0;border-radius:11px;background:#14213f;color:#fff;font-weight:800;cursor:pointer">Reload Travel</button>
      </div>`;
  };

  window.__MEDORA_TRAVEL_RUNTIME_ERROR__ = showRuntimeError;

  window.addEventListener("error", (event) => {
    if (event?.filename && String(event.filename).includes("travel-journey")) {
      showRuntimeError(event.message || "Journey script error.");
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason || "Journey initialization failed.");
    showRuntimeError(msg);
  });

  setTimeout(() => {
    const root = document.getElementById("journeyRoot");
    const loading = document.getElementById("journeyLoading");
    if (loading && !loading.classList.contains("hidden") && root?.classList.contains("hidden")) {
      if (!window.supabase?.createClient) showRuntimeError("Supabase did not load. Reload Travel to use the authenticated Medora session.");
      else showRuntimeError("The private journey took too long to initialize. Reload Travel once; if it persists, the app will now show the exact error instead of staying on this screen.");
    }
  }, 8000);
})();