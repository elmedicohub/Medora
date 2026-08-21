(() => {
  "use strict";
  if (window.__MEDORA_NAV_ORDER__) return;
  window.__MEDORA_NAV_ORDER__ = true;

  const desktopOrder = [
    '[data-screen="day"]',
    '[data-wall-link]',
    '[data-screen="goals"]',
    '[data-screen="planner"]',
    '[data-study-link]',
    '[data-activity-link]',
    '[data-screen="progress"]',
    '[data-screen="interests"]',
    '[data-screen="people"]'
  ];

  const mobileOrder = [
    '[data-screen="day"]',
    '[data-wall-link]',
    '[data-screen="goals"]',
    '[data-screen="planner"]',
    '[data-study-link]',
    '[data-activity-link]',
    '[data-screen="progress"]',
    '[data-screen="interests"]',
    '[data-screen="people"]'
  ];

  let applying = false;
  let timer = null;

  function applyOrder(container, selectors) {
    if (!container) return;
    const nodes = selectors.map(s => container.querySelector(s)).filter(Boolean);
    if (!nodes.length) return;

    const children = [...container.children];
    const currentKnown = children.filter(c => nodes.includes(c));
    const alreadyCorrect = currentKnown.length === nodes.length && currentKnown.every((n, i) => n === nodes[i]);
    if (alreadyCorrect) return;

    applying = true;
    nodes.forEach(node => container.appendChild(node));
    applying = false;
  }

  function reorder() {
    if (applying) return;
    applyOrder(document.querySelector('.main-nav'), desktopOrder);
    applyOrder(document.querySelector('.mobile-nav'), mobileOrder);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(reorder, 30);
  }

  function init() {
    reorder();
    const observer = new MutationObserver(() => {
      if (!applying) schedule();
    });
    const main = document.querySelector('.main-nav');
    const mobile = document.querySelector('.mobile-nav');
    if (main) observer.observe(main, { childList: true });
    if (mobile) observer.observe(mobile, { childList: true });

    // Activity / Study / Wall are additive modules and may appear after app boot.
    [150, 400, 900, 1800].forEach(ms => setTimeout(reorder, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
