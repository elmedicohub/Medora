(() => {
  "use strict";
  if (window.__MEDORA_STICKY_TOPBAR__) return;
  window.__MEDORA_STICKY_TOPBAR__ = true;

  function install() {
    if (document.getElementById("medoraStickyTopbarStyle")) return;
    const style = document.createElement("style");
    style.id = "medoraStickyTopbarStyle";
    style.textContent = `
      .app-main { position: relative; min-width: 0; }

      .topbar {
        position: sticky !important;
        top: 0 !important;
        z-index: 500 !important;
        background: rgba(245, 247, 251, .90) !important;
        -webkit-backdrop-filter: blur(18px) saturate(1.12);
        backdrop-filter: blur(18px) saturate(1.12);
        border-bottom: 1px solid rgba(220, 226, 237, .78);
        box-shadow: 0 7px 24px rgba(30, 43, 74, .035);
      }

      /* Keep dropdowns launched from top-bar controls above page content. */
      .topbar-actions,
      .topbar-actions > * {
        position: relative;
        z-index: 1;
      }

      @media (max-width: 820px) {
        .topbar {
          top: 0 !important;
          background: rgba(245, 247, 251, .94) !important;
          -webkit-backdrop-filter: blur(16px) saturate(1.1);
          backdrop-filter: blur(16px) saturate(1.1);
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
