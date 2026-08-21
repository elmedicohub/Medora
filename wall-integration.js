(() => {
  "use strict";

  const DESKTOP_ICON = "◉";
  const MOBILE_ICON = "◉";

  function addWallButtons() {
    const mainNav = document.querySelector(".main-nav");
    if (mainNav && !mainNav.querySelector("[data-wall-link]")) {
      const progress = mainNav.querySelector('[data-screen="progress"]');
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.dataset.wallLink = "true";
      button.innerHTML = `<span class="nav-icon">${DESKTOP_ICON}</span><span>Wall</span>`;
      mainNav.insertBefore(button, progress || null);
    }

    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav && !mobileNav.querySelector("[data-wall-link]")) {
      const profileMore = mobileNav.querySelector('[data-screen="profile"]');
      if (profileMore) {
        profileMore.removeAttribute("data-screen");
        profileMore.dataset.wallLink = "true";
        profileMore.innerHTML = `<span>${MOBILE_ICON}</span><small>Wall</small>`;
      }
    }
  }

  function clearWallActive() {
    document.querySelectorAll("[data-wall-link]").forEach((button) => {
      button.classList.remove("active");
    });
  }

  function setWallActive() {
    document
      .querySelectorAll(".nav-item[data-screen], .mobile-nav-item[data-screen]")
      .forEach((button) => button.classList.remove("active"));

    document
      .querySelectorAll("[data-wall-link]")
      .forEach((button) => button.classList.add("active"));
  }

  function styleEmbeddedWall(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;

      const style = doc.createElement("style");
      style.textContent = `
        .wall-topbar,.wall-left{display:none!important}
        body{background:transparent!important}
        .wall-layout{
          width:100%!important;
          max-width:none!important;
          margin:0!important;
          grid-template-columns:minmax(0,1fr) 270px!important;
          gap:18px!important
        }
        .wall-right{position:static!important;top:auto!important}
        @media(max-width:1050px){
          .wall-layout{grid-template-columns:1fr!important}
          .wall-right{display:none!important}
        }
        @media(max-width:760px){
          .wall-layout{width:100%!important;margin:0!important}
        }
      `;
      doc.head.appendChild(style);
    } catch (error) {
      console.warn("Wall embed styling skipped:", error);
    }
  }

  function openWall(event) {
    event?.preventDefault();
    setWallActive();

    const kicker = document.getElementById("topbarKicker");
    const title = document.getElementById("topbarTitle");
    const container = document.getElementById("screenContainer");

    if (kicker) kicker.textContent = "WALL";
    if (title) title.textContent = "Share progress. Grow together.";
    if (!container) return;

    container.innerHTML = `
      <section class="screen" aria-label="Medora Wall">
        <iframe
          id="medoraWallFrame"
          title="Medora Wall"
          src="wall.html?embedded=1"
          style="width:100%;height:calc(100vh - 128px);min-height:650px;border:0;border-radius:22px;background:transparent;display:block;"
        ></iframe>
      </section>
    `;

    const frame = document.getElementById("medoraWallFrame");
    frame?.addEventListener("load", () => styleEmbeddedWall(frame), { once: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bind() {
    addWallButtons();

    document.addEventListener(
      "click",
      (event) => {
        const wallButton = event.target.closest("[data-wall-link]");
        if (wallButton) {
          openWall(event);
          return;
        }

        if (event.target.closest("[data-screen]") || event.target.closest("#avatarButton")) {
          clearWallActive();
        }
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
