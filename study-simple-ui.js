(() => {
  "use strict";
  if (window.__MEDORA_STUDY_SIMPLE_UI__) return;
  window.__MEDORA_STUDY_SIMPLE_UI__ = true;

  let mode = "today";
  let applying = false;
  let scheduled = null;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const norm = v => String(v || "").trim().toLowerCase();
  const studyOpen = () => !!document.querySelector('[data-study-link].active');

  function addStyles(){
    if ($("#studySimpleUiStyle")) return;
    const s = document.createElement("style");
    s.id = "studySimpleUiStyle";
    s.textContent = `
      .sh-root.ss-simple{gap:12px!important}
      .sh-root.ss-simple .sh-tabs{display:none!important}
      .ss-study-tabs{display:flex;align-items:center;gap:5px;width:max-content;max-width:100%;padding:5px;border-radius:14px;background:#e9eff7;overflow:auto}
      .ss-study-tabs button{flex:0 0 auto;min-height:39px;padding:0 15px;border:0;border-radius:10px;background:transparent;color:#68748a;font-size:11px;font-weight:850;cursor:pointer}
      .ss-study-tabs button.active{background:#fff;color:#253047;box-shadow:0 5px 15px #1d284612}

      .sh-root.ss-simple.ss-mode-today [data-ss-core="1"]{display:none!important}
      .sh-root.ss-simple:not(.ss-mode-today) #shpPanel,
      .sh-root.ss-simple:not(.ss-mode-today) #shxPanel{display:none!important}
      .sh-root.ss-simple.ss-mode-today #shxPanel{display:none!important}

      .sh-root.ss-simple.ss-mode-today #shpPanel{display:grid!important;gap:10px!important}
      .sh-root.ss-simple.ss-mode-today .shp-live{grid-template-columns:1fr!important;gap:8px!important}
      .sh-root.ss-simple.ss-mode-today .shp-live>.shp-box:first-child{padding:18px!important;border-radius:18px!important}
      .sh-root.ss-simple.ss-mode-today .shp-live>.shp-box:first-child h3{font-size:20px!important;letter-spacing:-.02em}
      .sh-root.ss-simple.ss-mode-today .shp-live>.shp-box:first-child p{max-width:650px}
      .sh-root.ss-simple.ss-mode-today .shp-live>.shp-box:nth-child(2){display:none!important}
      .sh-root.ss-simple.ss-mode-today .shp-live.ss-has-partners>.shp-box:nth-child(2){display:block!important;padding:12px 15px!important;border-radius:14px!important;background:#f8fafc!important}
      .sh-root.ss-simple.ss-mode-today .shp-live.ss-has-partners>.shp-box:nth-child(2) h3{font-size:12px!important}
      .sh-root.ss-simple.ss-mode-today .shp-live.ss-has-partners>.shp-box:nth-child(2)>p{display:none!important}
      .sh-root.ss-simple.ss-mode-today .shp-live.ss-has-partners .shp-presence-list{display:flex!important;gap:6px!important;overflow:auto!important;margin-top:8px!important}
      .sh-root.ss-simple.ss-mode-today .shp-live.ss-has-partners .shp-person{min-width:220px!important}

      .ss-today-label{padding:2px 1px 0}
      .ss-today-label span{display:block;color:#6571dc;font-size:9px;font-weight:900;letter-spacing:.11em}
      .ss-today-label h2{margin:4px 0 0;font-size:24px;letter-spacing:-.035em}
      .ss-today-label p{margin:4px 0 0;color:#808a9b;font-size:10px}

      .sh-root.ss-simple.ss-mode-today .shp-tools{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      .sh-root.ss-simple.ss-mode-today .shp-tool{display:none!important;min-height:92px!important;padding:13px!important;border-radius:15px!important}
      .sh-root.ss-simple.ss-mode-today .shp-tool.ss-quick-tool{display:grid!important}
      .sh-root.ss-simple.ss-mode-today .shp-tool.ss-quick-tool small{display:none!important}
      .sh-root.ss-simple.ss-mode-today .shp-tool.ss-quick-tool span{font-size:20px!important}
      .ss-quiz-quick{display:grid;gap:7px;min-height:92px;padding:13px;border:1px solid #e1e6ef;border-radius:15px;background:#fff;text-align:left;cursor:pointer;transition:.14s}
      .ss-quiz-quick:hover{transform:translateY(-1px);box-shadow:0 10px 24px #26314f10}
      .ss-quiz-quick span{font-size:20px}.ss-quiz-quick strong{font-size:12px}.ss-quiz-quick small{display:none}
      .ss-quick-heading{grid-column:1/-1;display:flex;align-items:end;justify-content:space-between;gap:10px;padding-top:2px}
      .ss-quick-heading h3{margin:0;font-size:15px}.ss-quick-heading small{color:#8992a3;font-size:9px}

      .sh-root.ss-simple.ss-mode-today .shp-strip{grid-template-columns:1fr!important;gap:8px!important}
      .sh-root.ss-simple.ss-mode-today .shp-mission{padding:16px!important;border-radius:17px!important}
      .sh-root.ss-simple.ss-mode-today .shp-coach{padding:12px 15px!important;border-radius:14px!important;background:#fffaf3!important}
      .sh-root.ss-simple.ss-mode-today .shp-coach h3{font-size:12px!important}
      .sh-root.ss-simple.ss-mode-today .shp-coach p{margin:4px 0 0!important;font-size:9px!important;line-height:1.45!important}
      .sh-root.ss-simple.ss-mode-today .shp-coach .shp-chiprow{display:none!important}

      .ss-more-bg{position:fixed;z-index:780;inset:0;display:grid;place-items:center;padding:18px;background:#0c15287b;backdrop-filter:blur(6px)}
      .ss-more{width:min(660px,100%);max-height:86vh;overflow:auto;padding:21px;border-radius:22px;background:#fff;box-shadow:0 30px 90px #111a3430}
      .ss-more-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ss-more-head h2{margin:3px 0 4px;font-size:24px}.ss-more-head p{margin:0;color:#7f899b;font-size:10px}
      .ss-more-x{width:37px;height:37px;border:0;border-radius:50%;background:#f0f3f7;font-size:20px;cursor:pointer}
      .ss-more-section{margin-top:17px}.ss-more-section>strong{display:block;margin-bottom:8px;color:#7e8798;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
      .ss-more-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .ss-more-item{display:flex;align-items:center;gap:10px;min-height:58px;padding:11px;border:1px solid #e2e7ef;border-radius:13px;background:#fff;text-align:left;cursor:pointer}
      .ss-more-item:hover{background:#f8faff}.ss-more-item>span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f2f5fb;font-size:18px}.ss-more-item b,.ss-more-item small{display:block}.ss-more-item b{font-size:11px}.ss-more-item small{margin-top:2px;color:#8991a1;font-size:8px}
      .ss-more-note{margin-top:14px;padding:10px 12px;border-radius:11px;background:#f7f9fc;color:#7c8698;font-size:9px;line-height:1.5}

      @media(max-width:700px){
        .ss-study-tabs{width:100%;display:grid;grid-template-columns:repeat(4,1fr)}
        .ss-study-tabs button{padding:0 5px;font-size:10px}
        .sh-root.ss-simple.ss-mode-today .shp-tools{grid-template-columns:repeat(3,1fr)!important}
        .sh-root.ss-simple.ss-mode-today .shp-tool,.ss-quiz-quick{min-height:82px!important;padding:10px!important}
        .ss-more-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  function originalTab(label){
    return $$(".sh-tabs button").find(b => norm(b.textContent).includes(norm(label)));
  }

  function clickOriginal(label){
    const b = originalTab(label);
    if (b) b.click();
  }

  function markCore(root){
    const keep = new Set();
    const hero = root.querySelector(":scope > .sh-hero");
    const tabs = root.querySelector(":scope > .sh-tabs");
    const simpleTabs = root.querySelector(":scope > .ss-study-tabs");
    const pro = root.querySelector(":scope > #shpPanel");
    const insights = root.querySelector(":scope > #shxPanel");
    [hero,tabs,simpleTabs,pro,insights].filter(Boolean).forEach(x=>keep.add(x));
    [...root.children].forEach(ch => {
      if (keep.has(ch)) ch.removeAttribute("data-ss-core");
      else ch.setAttribute("data-ss-core","1");
    });
  }

  function setMode(next, sourceLabel){
    const root = $(".sh-root");
    if (!root) return;
    mode = next;
    root.classList.toggle("ss-mode-today", next === "today");
    $$(".ss-study-tabs button", root).forEach(b=>b.classList.toggle("active", b.dataset.ssMode === next));
    if (sourceLabel) clickOriginal(sourceLabel);
    markCore(root);
  }

  function makeTabs(root){
    let bar = root.querySelector(":scope > .ss-study-tabs");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "ss-study-tabs";
    bar.innerHTML = `
      <button type="button" data-ss-mode="today">Today</button>
      <button type="button" data-ss-mode="rooms">Rooms</button>
      <button type="button" data-ss-mode="quiz">Quiz</button>
      <button type="button" data-ss-mode="more">More</button>
    `;
    const old = root.querySelector(":scope > .sh-tabs");
    if (old) old.after(bar); else root.prepend(bar);
    bar.addEventListener("click", e=>{
      const b = e.target.closest("button[data-ss-mode]");
      if (!b) return;
      const m = b.dataset.ssMode;
      if (m === "today") setMode("today");
      if (m === "rooms") setMode("rooms", "Rooms");
      if (m === "quiz") setMode("quiz", "Quiz race");
      if (m === "more") openMore();
    });
    return bar;
  }

  function quickToolByName(name){
    return $$("#shpPanel .shp-tool").find(b=>norm(b.textContent).includes(norm(name)));
  }

  function simplifyPro(){
    const p = $("#shpPanel");
    if (!p) return;

    if (!p.querySelector(":scope > .ss-today-label")) {
      const h = document.createElement("div");
      h.className = "ss-today-label";
      h.innerHTML = `<span>TODAY</span><h2>What are you studying now?</h2><p>Start with one topic. Medora will keep the rest out of the way.</p>`;
      p.prepend(h);
    }

    const live = p.querySelector(".shp-live");
    if (live) {
      const second = live.children[1];
      const hasPeople = !!second && !!second.querySelector(".shp-person");
      live.classList.toggle("ss-has-partners", hasPeople);
      const firstTitle = live.querySelector(".shp-box:first-child h3");
      const firstDesc = live.querySelector(".shp-box:first-child p");
      if (firstTitle) firstTitle.textContent = "Study now";
      if (firstDesc) firstDesc.textContent = "Choose the topic and start. That is enough for now.";
    }

    const tools = p.querySelector(".shp-tools");
    if (tools) {
      $$(".shp-tool", tools).forEach(x=>x.classList.remove("ss-quick-tool"));
      const focus = quickToolByName("Focus Room");
      const flash = quickToolByName("Flashcards");
      [focus,flash].filter(Boolean).forEach(x=>x.classList.add("ss-quick-tool"));

      let head = tools.querySelector(":scope > .ss-quick-heading");
      if (!head) {
        head = document.createElement("div");
        head.className = "ss-quick-heading";
        head.innerHTML = `<h3>Quick actions</h3><small>Only the essentials</small>`;
        tools.prepend(head);
      }

      let quiz = tools.querySelector(":scope > .ss-quiz-quick");
      if (!quiz) {
        quiz = document.createElement("button");
        quiz.type = "button";
        quiz.className = "ss-quiz-quick";
        quiz.innerHTML = `<span>⚡</span><strong>Quiz</strong><small>Quick race</small>`;
        quiz.addEventListener("click",()=>setMode("quiz","Quiz race"));
        tools.appendChild(quiz);
      }
    }

    const mission = p.querySelector(".shp-mission h3");
    if (mission) mission.textContent = "Today's mission";
    const coach = p.querySelector(".shp-coach h3");
    if (coach) coach.textContent = "Medora suggests";
  }

  function advancedTool(label){
    const t = quickToolByName(label);
    if (t) { closeMore(); t.click(); }
  }

  function openInsights(){
    closeMore();
    const root = $(".sh-root");
    const x = $("#shxPanel");
    if (!root || !x) return;
    mode = "insights";
    root.classList.remove("ss-mode-today");
    $$(".ss-study-tabs button",root).forEach(b=>b.classList.remove("active"));
    $$("[data-ss-core='1']",root).forEach(n=>n.style.display="none");
    const p = $("#shpPanel"); if(p)p.style.display="none";
    x.style.display="grid";
    x.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function closeMore(){ $("#ssStudyMore")?.remove(); }

  function openMore(){
    closeMore();
    const bg = document.createElement("div");
    bg.id = "ssStudyMore";
    bg.className = "ss-more-bg";
    bg.innerHTML = `
      <section class="ss-more" role="dialog" aria-modal="true" aria-label="More study tools">
        <div class="ss-more-head"><div><span class="sh-ey" style="color:#6571dc">MORE TOOLS</span><h2>Use them when you need them.</h2><p>The Study home stays simple; nothing has been removed.</p></div><button class="ss-more-x" type="button" aria-label="Close">×</button></div>
        <div class="ss-more-section"><strong>Plan & compete</strong><div class="ss-more-grid">
          <button class="ss-more-item" data-core="Schedule"><span>🗓️</span><div><b>Schedule</b><small>Shared study sessions</small></div></button>
          <button class="ss-more-item" data-core="Checklist race"><span>🏁</span><div><b>Checklist race</b><small>Finish tasks together</small></div></button>
        </div></div>
        <div class="ss-more-section"><strong>Learn & review</strong><div class="ss-more-grid">
          <button class="ss-more-item" data-tool="Weakness Map"><span>🗺️</span><div><b>Weakness map</b><small>Find topics needing work</small></div></button>
          <button class="ss-more-item" data-tool="Exam / Target"><span>🎯</span><div><b>Exam / target</b><small>Countdown and readiness</small></div></button>
          <button class="ss-more-item" data-tool="Notes & Resources"><span>📚</span><div><b>Notes & resources</b><small>Keep room knowledge together</small></div></button>
          <button class="ss-more-item" data-tool="Teach the Room"><span>🧑‍🏫</span><div><b>Teach the room</b><small>Explain and get feedback</small></div></button>
          <button class="ss-more-item" data-tool="Study Recap"><span>📊</span><div><b>Study recap</b><small>Review your week</small></div></button>
          <button class="ss-more-item" data-tool="What should I study now"><span>✨</span><div><b>What should I study?</b><small>Get the next recommendation</small></div></button>
          <button class="ss-more-item" data-insights="1"><span>◫</span><div><b>Advanced insights</b><small>Patterns, consistency and review queue</small></div></button>
        </div></div>
        <div class="ss-more-note">Medora keeps advanced tools available, but your default Study screen should answer only one question: <b>what should I do next?</b></div>
      </section>`;
    bg.addEventListener("click",e=>{
      if(e.target===bg || e.target.closest(".ss-more-x")){closeMore();return}
      const core=e.target.closest("[data-core]");
      if(core){closeMore();setMode("advanced",core.dataset.core);return}
      const tool=e.target.closest("[data-tool]");
      if(tool){advancedTool(tool.dataset.tool);return}
      if(e.target.closest("[data-insights]")){openInsights();return}
    });
    document.body.appendChild(bg);
  }

  function restoreInlineOverrides(){
    const root=$(".sh-root"); if(!root)return;
    if(mode!=="insights"){
      $$("[data-ss-core='1']",root).forEach(n=>n.style.removeProperty("display"));
      $("#shpPanel")?.style.removeProperty("display");
      $("#shxPanel")?.style.removeProperty("display");
    }
  }

  function apply(){
    if(applying || !studyOpen()) return;
    const root=$(".sh-root");
    const pro=$("#shpPanel");
    if(!root || !pro) return;
    applying=true;
    addStyles();
    root.classList.add("ss-simple");
    makeTabs(root);
    simplifyPro();
    markCore(root);
    if(mode!=="insights"){
      restoreInlineOverrides();
      root.classList.toggle("ss-mode-today",mode==="today");
      $$(".ss-study-tabs button",root).forEach(b=>b.classList.toggle("active",b.dataset.ssMode===mode));
    }
    applying=false;
  }

  function schedule(){ clearTimeout(scheduled); scheduled=setTimeout(apply,80); }

  function init(){
    addStyles();
    document.addEventListener("click",e=>{
      if(e.target.closest("[data-study-link]")){mode="today";setTimeout(schedule,80)}
      if(e.target.closest(".sh-tabs button") && !e.isTrusted) return;
    },true);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMore()});
    new MutationObserver(()=>{if(!applying)schedule()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    [150,350,700,1200,1800].forEach(ms=>setTimeout(schedule,ms));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();