(() => {
  "use strict";
  if (window.__MEDORA_GOAL_CARD_ACCORDION__) return;
  window.__MEDORA_GOAL_CARD_ACCORDION__ = true;

  const STORE_OPEN = "medora.goalAccordion.open";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let busy = false;
  let timer = null;

  function safeGet(k, fallback = "") {
    try { return localStorage.getItem(k) || fallback; } catch { return fallback; }
  }
  function safeSet(k, v) {
    try {
      if (v) localStorage.setItem(k, String(v));
      else localStorage.removeItem(k);
    } catch {}
  }

  function goalsActive() {
    return !!document.querySelector(
      '.nav-item[data-screen="goals"].active,.mobile-nav-item[data-screen="goals"].active'
    );
  }

  function addStyles() {
    if ($("#medoraGoalAccordionStyle")) return;
    const style = document.createElement("style");
    style.id = "medoraGoalAccordionStyle";
    style.textContent = `
      .gpb-list.gca-list{gap:10px}
      .gpb-card.gca-card{
        --gca-accent:#687ff0;
        --gca-soft:#f1f3ff;
        position:relative;
        overflow:hidden;
        padding:0;
        border-color:#e0e6ef;
        border-radius:18px;
        box-shadow:0 5px 20px rgba(34,47,78,.035);
        transition:border-color .22s ease,box-shadow .22s ease,transform .22s ease,background .22s ease;
      }
      .gpb-card.gca-card::before{
        content:"";
        position:absolute;
        left:0;top:0;bottom:0;
        width:4px;
        background:var(--gca-accent);
        opacity:.78;
        transition:opacity .2s ease,width .2s ease;
      }
      .gpb-card.gca-card:hover{border-color:#d2d9e7;box-shadow:0 10px 28px rgba(34,47,78,.065)}
      .gpb-card.gca-card.is-open{border-color:color-mix(in srgb,var(--gca-accent) 28%,#dfe5ef);box-shadow:0 14px 34px rgba(34,47,78,.08)}
      .gpb-card.gca-card.is-open::before{width:5px;opacity:1}
      .gca-card.gca-faith{--gca-accent:#8059e6;--gca-soft:#f5f1ff}
      .gca-card.gca-learning{--gca-accent:#5879ea;--gca-soft:#f0f4ff}
      .gca-card.gca-health,.gca-card.gca-fitness{--gca-accent:#1ca887;--gca-soft:#eefaf6}
      .gca-card.gca-career,.gca-card.gca-work{--gca-accent:#c68732;--gca-soft:#fff7ea}
      .gca-card.gca-family{--gca-accent:#d26c89;--gca-soft:#fff2f6}
      .gca-card.gca-personal{--gca-accent:#4c9da8;--gca-soft:#eff9fa}

      .gca-card .gpb-top{
        position:relative;
        align-items:center;
        min-height:86px;
        padding:15px 17px 15px 20px;
        cursor:pointer;
        user-select:none;
        background:linear-gradient(100deg,var(--gca-soft),#fff 34%,#fff);
        transition:background .22s ease,border-color .22s ease;
      }
      .gca-card.is-open .gpb-top{border-bottom:1px solid #edf0f5;background:linear-gradient(100deg,var(--gca-soft),#fff 42%,#fff)}
      .gca-card .gpb-title{min-width:0;align-items:center;flex:1}
      .gca-card .gpb-icon{
        flex:0 0 auto;
        width:47px;height:47px;
        color:var(--gca-accent);
        background:var(--gca-soft);
        border:1px solid color-mix(in srgb,var(--gca-accent) 12%,#e9edf4);
      }
      .gca-card .gpb-title>div{min-width:0;flex:1}
      .gca-card .gpb-title h3{
        overflow:hidden;
        margin:0 0 4px;
        color:#172139;
        font-size:17px;
        line-height:1.25;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .gca-card .gpb-title small{font-size:10px}
      .gca-card .gpb-pill{margin-left:8px;flex:0 0 auto}
      .gca-card .gca-toggle{
        flex:0 0 auto;
        width:34px;height:34px;
        display:grid;place-items:center;
        margin-left:8px;
        border:0;border-radius:10px;
        color:#6f7a90;
        background:#f3f5f9;
        font-size:18px;
        cursor:pointer;
        transition:transform .22s ease,background .22s ease,color .22s ease;
      }
      .gca-card.is-open .gca-toggle{transform:rotate(180deg);background:var(--gca-soft);color:var(--gca-accent)}

      .gca-mini-metrics{
        display:flex;
        align-items:center;
        gap:6px;
        margin-top:7px;
        flex-wrap:wrap;
      }
      .gca-mini{
        min-width:78px;
        display:grid;
        grid-template-columns:auto auto;
        column-gap:6px;
        row-gap:3px;
        align-items:center;
        padding:5px 7px;
        border:1px solid #e9edf4;
        border-radius:9px;
        background:rgba(255,255,255,.72);
      }
      .gca-mini span{overflow:hidden;color:#818b9c;font-size:7.5px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
      .gca-mini b{justify-self:end;color:#344057;font-size:8px}
      .gca-mini-track{grid-column:1/-1;height:3px;overflow:hidden;border-radius:999px;background:#e9edf3}
      .gca-mini-track i{display:block;height:100%;border-radius:inherit;background:var(--gca-accent)}

      .gca-details{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .28s ease,opacity .2s ease}
      .gca-details-inner{min-height:0;overflow:hidden;padding:0 18px}
      .gca-card.is-open .gca-details{grid-template-rows:1fr;opacity:1}
      .gca-card.is-open .gca-details-inner{padding:0 18px 18px}
      .gca-details .gpb-why{margin-top:13px}
      .gca-details .gpb-success{margin-top:10px}
      .gca-details .gpb-metrics{margin-top:12px}
      .gca-details .gpb-plans{margin-top:12px}
      .gca-details .gpb-row-actions{padding-top:1px}

      .gca-hint{display:inline-flex;align-items:center;gap:6px;margin-top:6px;color:#8a93a4;font-size:9px;font-weight:700}
      .gca-hint::before{content:"⌄";width:18px;height:18px;display:grid;place-items:center;border-radius:6px;background:#f0f3f8;color:#6f7a90}

      @media(max-width:850px){
        .gca-card .gpb-top{min-height:82px;padding:13px 14px 13px 17px}
        .gca-mini{min-width:70px}
      }
      @media(max-width:620px){
        .gca-card .gpb-top{align-items:flex-start}
        .gca-card .gpb-title{align-items:flex-start}
        .gca-card .gpb-icon{width:42px;height:42px}
        .gca-card .gpb-title h3{font-size:15px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .gca-card .gpb-pill{display:none}
        .gca-mini-metrics{gap:4px}
        .gca-mini{min-width:0;flex:1;padding:5px 6px}
        .gca-mini span{font-size:7px}
        .gca-details-inner,.gca-card.is-open .gca-details-inner{padding-left:14px;padding-right:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function goalId(card) {
    const btn = card.querySelector("[data-gpb-edit],[data-gpb-create-plan],[data-gpb-progress],[data-gpb-link]");
    return btn?.dataset.gpbEdit || btn?.dataset.gpbCreatePlan || btn?.dataset.gpbProgress || btn?.dataset.gpbLink || "";
  }

  function categoryClass(card) {
    const meta = card.querySelector(".gpb-title small")?.textContent?.toLowerCase() || "";
    if (meta.includes("faith") || meta.includes("religion")) return "gca-faith";
    if (meta.includes("learn") || meta.includes("study") || meta.includes("education")) return "gca-learning";
    if (meta.includes("health")) return "gca-health";
    if (meta.includes("fitness") || meta.includes("sport")) return "gca-fitness";
    if (meta.includes("career")) return "gca-career";
    if (meta.includes("work")) return "gca-work";
    if (meta.includes("family")) return "gca-family";
    return "gca-personal";
  }

  function metricSummary(card) {
    const metrics = $$(".gpb-metric", card);
    return metrics.slice(0, 3).map(metric => {
      const label = metric.querySelector("span")?.textContent?.trim() || "Progress";
      const value = metric.querySelector("b")?.textContent?.trim() || "0%";
      const n = Math.max(0, Math.min(100, Number(value.replace(/[^0-9.]/g, "")) || 0));
      let short = label;
      if (/outcome/i.test(label)) short = "Outcome";
      else if (/target/i.test(label)) short = "Target";
      else if (/compliance/i.test(label)) short = "Compliance";
      else if (/goal/i.test(label)) short = "Goal";
      return `<div class="gca-mini" title="${label.replace(/"/g,"&quot;")}"><span>${short}</span><b>${value}</b><div class="gca-mini-track"><i style="width:${n}%"></i></div></div>`;
    }).join("");
  }

  function updateMini(card) {
    const host = card.querySelector(".gca-mini-metrics");
    if (!host) return;
    const html = metricSummary(card);
    if (html && host.innerHTML !== html) host.innerHTML = html;
  }

  function setOpen(card, open, persist = true) {
    if (!card) return;
    const id = goalId(card);
    card.classList.toggle("is-open", open);
    const top = card.querySelector(".gpb-top");
    const toggle = card.querySelector(".gca-toggle");
    top?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("title", open ? "Collapse goal" : "Open goal details");
    if (persist) safeSet(STORE_OPEN, open ? id : "");
  }

  function closeOthers(except) {
    $$(".gpb-card.gca-card.is-open").forEach(card => {
      if (card !== except) setOpen(card, false, false);
    });
  }

  function toggleCard(card) {
    const willOpen = !card.classList.contains("is-open");
    closeOthers(willOpen ? card : null);
    setOpen(card, willOpen, true);
    if (willOpen) {
      setTimeout(() => {
        const top = card.querySelector(".gpb-top");
        const sticky = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
        const y = card.getBoundingClientRect().top + window.scrollY - sticky - 12;
        if (top && card.getBoundingClientRect().top < sticky + 5) window.scrollTo({top:y,behavior:"smooth"});
      }, 80);
    }
  }

  function wrapDetails(card) {
    if (card.querySelector(":scope > .gca-details")) return;
    const top = card.querySelector(":scope > .gpb-top");
    if (!top) return;
    const detailNodes = [...card.children].filter(n => n !== top && !n.classList.contains("gca-details"));
    const details = document.createElement("div");
    details.className = "gca-details";
    const inner = document.createElement("div");
    inner.className = "gca-details-inner";
    detailNodes.forEach(n => inner.appendChild(n));
    details.appendChild(inner);
    card.appendChild(details);
  }

  function enhanceCard(card) {
    if (!card) return;
    if (!card.classList.contains("gca-card")) {
      card.classList.add("gca-card", categoryClass(card));
      const top = card.querySelector(":scope > .gpb-top");
      if (!top) return;
      top.setAttribute("role", "button");
      top.setAttribute("tabindex", "0");
      top.setAttribute("aria-expanded", "false");

      const titleBox = card.querySelector(".gpb-title > div");
      if (titleBox && !titleBox.querySelector(".gca-mini-metrics")) {
        const mini = document.createElement("div");
        mini.className = "gca-mini-metrics";
        titleBox.appendChild(mini);
      }

      if (!top.querySelector(".gca-toggle")) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "gca-toggle";
        toggle.innerHTML = "⌄";
        toggle.setAttribute("aria-label", "Open goal details");
        top.appendChild(toggle);
      }

      wrapDetails(card);
      top.addEventListener("click", e => {
        if (e.target.closest(".gca-toggle")) e.preventDefault();
        toggleCard(card);
      });
      top.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCard(card);
        }
      });
    }
    updateMini(card);
  }

  function enhance() {
    if (busy || !goalsActive()) return;
    const root = $("#screenContainer .gpb");
    if (!root) return;
    const cards = $$(".gpb-card", root);
    if (!cards.length) return;
    busy = true;
    try {
      root.querySelector(".gpb-list")?.classList.add("gca-list");
      cards.forEach(enhanceCard);

      const headText = root.querySelector(".gpb-head > div");
      if (headText && !headText.querySelector(".gca-hint")) {
        const hint = document.createElement("div");
        hint.className = "gca-hint";
        hint.textContent = "Open a goal to see its plans, progress and actions";
        headText.appendChild(hint);
      }

      const wanted = safeGet(STORE_OPEN, "");
      let restored = false;
      cards.forEach(card => {
        const open = !!wanted && goalId(card) === wanted;
        setOpen(card, open, false);
        if (open) restored = true;
      });
      if (wanted && !restored) safeSet(STORE_OPEN, "");
    } finally {
      busy = false;
    }
  }

  function schedule(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(enhance, delay);
  }

  function init() {
    addStyles();
    new MutationObserver(mutations => {
      if (busy || !goalsActive()) return;
      const relevant = mutations.some(m =>
        [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.(".gpb,.gpb-card,.gpb-metric,.pgp-goal-auto") || n.querySelector?.(".gpb-card,.gpb-metric")))
      );
      if (relevant) schedule(90);
      else {
        const card = mutations[0]?.target?.closest?.(".gca-card");
        if (card) schedule(160);
      }
    }).observe(document.body, {childList:true,subtree:true,characterData:true});

    document.addEventListener("click", e => {
      if (e.target.closest('[data-screen="goals"]')) schedule(220);
      if (e.target.closest('[data-gpb-progress],[data-gpb-edit],[data-gpb-link],[data-gpb-create-plan]')) schedule(350);
    }, true);
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
