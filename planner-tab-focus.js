(() => {
  "use strict";
  if (window.__MEDORA_PLANNER_TAB_FOCUS__) return;
  window.__MEDORA_PLANNER_TAB_FOCUS__ = true;

  const TOP_GAP = 14;

  function plannerTabButton(target) {
    return target?.closest?.('.lm-tabs [data-tab]') || null;
  }

  function selectedSection() {
    const root = document.querySelector('#screenContainer .lm-root');
    if (!root) return null;
    return root.querySelector(':scope > .lm-section');
  }

  function stickyOffset() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return 18;
    const style = getComputedStyle(topbar);
    if (style.position !== 'sticky' && style.position !== 'fixed') return 18;
    return Math.max(18, topbar.getBoundingClientRect().height + TOP_GAP);
  }

  function focusSection(behavior = 'smooth') {
    const section = selectedSection();
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const top = Math.max(0, window.scrollY + rect.top - stickyOffset());
    window.scrollTo({ top, behavior });
  }

  function afterRenderFocus() {
    // Planner render() replaces the tab + section synchronously in the click
    // handler. Two animation frames ensure layout and sticky header geometry are
    // settled before calculating the final position.
    requestAnimationFrame(() => requestAnimationFrame(() => focusSection('smooth')));
  }

  document.addEventListener('click', event => {
    const button = plannerTabButton(event.target);
    if (!button) return;
    afterRenderFocus();
  }, true);
})();
