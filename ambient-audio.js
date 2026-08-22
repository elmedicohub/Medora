(() => {
  "use strict";
  if (window.__MEDORA_AMBIENT_AUDIO__) return;
  window.__MEDORA_AMBIENT_AUDIO__ = true;

  const KEY_MODE = "medora.ambient.mode";
  const KEY_VOLUME = "medora.ambient.volume";
  const KEY_ENABLED = "medora.ambient.enabled";

  function safeGet(k, f = "") { try { return localStorage.getItem(k) ?? f; } catch { return f; } }
  function safeSet(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }

  const storedMode = safeGet(KEY_MODE, "calm");
  const normalizedMode = storedMode === "rain" ? "keys" : storedMode === "focus" ? "dream" : storedMode;
  if (normalizedMode !== storedMode) safeSet(KEY_MODE, normalizedMode);

  const A = {
    ctx: null,
    master: null,
    nodes: [],
    timers: [],
    mode: ["calm","keys","dream","off"].includes(normalizedMode) ? normalizedMode : "calm",
    volume: Math.max(0, Math.min(1, Number(safeGet(KEY_VOLUME, "0.22")) || 0.22)),
    wanted: safeGet(KEY_ENABLED, "false") === "true",
    playing: false,
    resumeAfterRecording: false,
    panelOpen: false
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function appVisible() {
    const app = $("#appView");
    return !!app && !app.classList.contains("hidden");
  }

  function addStyles() {
    if ($("#medoraAmbientStyle")) return;
    const s = document.createElement("style");
    s.id = "medoraAmbientStyle";
    s.textContent = `
      .ma-wrap{position:relative}.ma-btn{width:40px;height:40px;border:0;border-radius:11px;background:#eef2f8;color:#445069;cursor:pointer;font-size:17px;display:grid;place-items:center}.ma-btn.on{background:#e9f7f4;color:#177a6d}.ma-btn:hover{background:#e7edf7}.ma-panel{position:absolute;z-index:760;right:0;top:48px;width:min(330px,calc(100vw - 28px));padding:16px;border:1px solid #e0e6ef;border-radius:18px;background:#fff;box-shadow:0 22px 60px #17213a26}.ma-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.ma-head strong,.ma-head small{display:block}.ma-head small{margin-top:3px;color:#8791a2;font-size:9px;line-height:1.4}.ma-close{width:30px;height:30px;border:0;border-radius:9px;background:#f1f4f8;color:#657086;cursor:pointer}.ma-presets{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.ma-preset{min-height:58px;padding:9px 10px;border:1px solid #e1e6ef;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.ma-preset.active{border-color:#a8b7ee;background:#f6f8ff}.ma-preset span,.ma-preset strong,.ma-preset small{display:block}.ma-preset span{font-size:17px}.ma-preset strong{margin-top:3px;font-size:10px}.ma-preset small{margin-top:2px;color:#8791a2;font-size:8px;line-height:1.3}.ma-volume{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;margin-top:14px;padding-top:13px;border-top:1px solid #edf0f4}.ma-volume label,.ma-volume output{font-size:9px;font-weight:850;color:#68748a}.ma-volume input{width:100%}.ma-status{margin-top:10px;padding:9px 10px;border-radius:10px;background:#f7f9fc;color:#6f7a8e;font-size:9px;line-height:1.45}.ma-toggle{width:100%;min-height:39px;margin-top:10px;border:0;border-radius:11px;color:#fff;background:linear-gradient(115deg,#18b8aa,#667ff2 55%,#8558e9);font-size:10px;font-weight:850;cursor:pointer}.ma-toggle.off{background:#eef2f7;color:#5d687c}
      @media(max-width:700px){.ma-panel{position:fixed;right:14px;top:72px}.ma-btn{width:38px;height:38px}}
    `;
    document.head.appendChild(s);
  }

  function ensureControl() {
    const actions = $(".topbar-actions");
    if (!actions || $("#medoraAmbientWrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "medoraAmbientWrap";
    wrap.className = "ma-wrap";
    wrap.innerHTML = `<button id="medoraAmbientButton" class="ma-btn ${A.playing ? "on" : ""}" type="button" title="Relaxing ambience" aria-label="Relaxing ambience">🎧</button><div id="medoraAmbientPanel"></div>`;
    const avatar = $("#avatarButton", actions);
    if (avatar) actions.insertBefore(wrap, avatar); else actions.appendChild(wrap);
    $("#medoraAmbientButton", wrap)?.addEventListener("click", e => {
      e.stopPropagation();
      A.panelOpen = !A.panelOpen;
      renderPanel();
    });
  }

  function panelHtml() {
    const presets = [
      ["calm","🌙","Calm Pad","Soft sustained ambient chords"],
      ["keys","🎹","Soft Keys","Sparse gentle piano-like notes"],
      ["dream","✨","Dreamscape","Floating warm tones and soft shimmer"],
      ["off","○","Off","Silence"]
    ];
    return `<div class="ma-panel" role="dialog" aria-label="Ambient sound">
      <div class="ma-head"><div><strong>Medora ambience</strong><small>Quiet soundscapes for planning, studying and writing.</small></div><button class="ma-close" type="button" data-ma-close>×</button></div>
      <div class="ma-presets">${presets.map(([key,icon,title,sub]) => `<button class="ma-preset ${A.mode===key?"active":""}" type="button" data-ma-mode="${key}"><span>${icon}</span><strong>${title}</strong><small>${sub}</small></button>`).join("")}</div>
      <div class="ma-volume"><label>Volume</label><input id="maVolume" type="range" min="0" max="100" step="1" value="${Math.round(A.volume*100)}"><output id="maVolumeOut">${Math.round(A.volume*100)}%</output></div>
      <div class="ma-status">${A.playing ? `Playing ${labelFor(A.mode)} quietly in the background.` : A.wanted && A.mode!=="off" ? "Tap Resume ambience to start. Browsers require a user gesture before audio can play." : "Ambience is off."}</div>
      <button class="ma-toggle ${A.playing?"off":""}" type="button" data-ma-toggle>${A.playing ? "Pause ambience" : "Resume ambience"}</button>
    </div>`;
  }

  function renderPanel() {
    const host = $("#medoraAmbientPanel");
    if (!host) return;
    host.innerHTML = A.panelOpen ? panelHtml() : "";
    if (!A.panelOpen) return;

    $("[data-ma-close]", host)?.addEventListener("click", () => { A.panelOpen=false; renderPanel(); });
    $$('[data-ma-mode]', host).forEach(b => b.addEventListener("click", async () => {
      const mode = b.dataset.maMode;
      A.mode = mode;
      safeSet(KEY_MODE, mode);
      if (mode === "off") {
        A.wanted=false;
        safeSet(KEY_ENABLED,"false");
        stopAudio();
      } else {
        A.wanted=true;
        safeSet(KEY_ENABLED,"true");
        await startAudio();
      }
      renderPanel();
    }));

    const slider = $("#maVolume", host);
    slider?.addEventListener("input", () => {
      A.volume = Number(slider.value)/100;
      safeSet(KEY_VOLUME, A.volume);
      setMasterVolume();
      const out=$("#maVolumeOut",host);
      if(out) out.textContent=`${slider.value}%`;
    });

    $("[data-ma-toggle]", host)?.addEventListener("click", async () => {
      if (A.playing) {
        A.wanted=false;
        safeSet(KEY_ENABLED,"false");
        stopAudio();
      } else if (A.mode !== "off") {
        A.wanted=true;
        safeSet(KEY_ENABLED,"true");
        await startAudio();
      } else {
        A.mode="calm";
        A.wanted=true;
        safeSet(KEY_MODE,A.mode);
        safeSet(KEY_ENABLED,"true");
        await startAudio();
      }
      renderPanel();
    });
  }

  function labelFor(mode) {
    return ({calm:"Calm Pad",keys:"Soft Keys",dream:"Dreamscape"})[mode] || "ambience";
  }

  function connectNode(node) { A.nodes.push(node); return node; }
  function keepTimer(id) { A.timers.push(id); return id; }

  function addPad(ctx, master, freqs, level=0.04, cutoff=780) {
    const bus = connectNode(ctx.createGain());
    bus.gain.value = level;
    const filter = connectNode(ctx.createBiquadFilter());
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    bus.connect(filter);
    filter.connect(master);

    freqs.forEach((f,i) => {
      const osc = connectNode(ctx.createOscillator());
      const g = connectNode(ctx.createGain());
      osc.type = i % 2 ? "sine" : "triangle";
      osc.frequency.value = f;
      osc.detune.value = (i-1.5)*2.5;
      g.gain.value = 0.18 / freqs.length;
      osc.connect(g);
      g.connect(bus);
      osc.start();
    });

    const lfo = connectNode(ctx.createOscillator());
    const lfoGain = connectNode(ctx.createGain());
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = level * 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(bus.gain);
    lfo.start();
  }

  function playSoftKey(ctx, destination, frequency, delay=0) {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.value = frequency;
    overtone.type = "sine";
    overtone.frequency.value = frequency * 2.01;
    overtoneGain.gain.value = 0.08;
    filter.type = "lowpass";
    filter.frequency.value = 1500;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.022, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(filter);
    filter.connect(destination);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 4.1);
    overtone.stop(now + 4.1);
  }

  function addSoftKeys(ctx, master) {
    const bus = connectNode(ctx.createGain());
    bus.gain.value = 0.72;
    const reverbLike = connectNode(ctx.createDelay(1.2));
    const echoGain = connectNode(ctx.createGain());
    reverbLike.delayTime.value = 0.31;
    echoGain.gain.value = 0.12;
    bus.connect(master);
    bus.connect(reverbLike);
    reverbLike.connect(echoGain);
    echoGain.connect(master);

    const scale = [130.81,146.83,164.81,196.00,220.00,261.63,293.66,329.63,392.00];
    let index = 0;
    const phrase = () => {
      if (!A.playing || A.mode !== "keys" || A.ctx !== ctx) return;
      const base = scale[(index * 2 + Math.floor(Math.random()*3)) % scale.length];
      playSoftKey(ctx,bus,base,0);
      if (Math.random() > 0.55) playSoftKey(ctx,bus,base * 1.5,0.16);
      index++;
      const next = 4200 + Math.random()*3600;
      keepTimer(setTimeout(phrase,next));
    };
    phrase();
  }

  function playShimmer(ctx, destination, frequency) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001,now);
    g.gain.exponentialRampToValueAtTime(0.018,now+0.8);
    g.gain.exponentialRampToValueAtTime(0.0001,now+6.5);
    osc.connect(g);
    g.connect(filter);
    filter.connect(destination);
    osc.start(now);
    osc.stop(now+6.8);
  }

  function addDreamscape(ctx, master) {
    addPad(ctx, master, [98.00,146.83,196.00,246.94], 0.042, 620);
    const airy = connectNode(ctx.createGain());
    airy.gain.value = 0.7;
    airy.connect(master);
    const tones = [392.00,440.00,493.88,523.25,587.33,659.25];
    const shimmer = () => {
      if (!A.playing || A.mode !== "dream" || A.ctx !== ctx) return;
      playShimmer(ctx,airy,tones[Math.floor(Math.random()*tones.length)]);
      keepTimer(setTimeout(shimmer,7000 + Math.random()*7000));
    };
    keepTimer(setTimeout(shimmer,1800));
  }

  function setMasterVolume() {
    if (!A.master || !A.ctx) return;
    const target = Math.max(0, Math.min(0.55, A.volume));
    try { A.master.gain.setTargetAtTime(target, A.ctx.currentTime, 0.08); }
    catch { A.master.gain.value = target; }
  }

  async function startAudio() {
    if (!appVisible() || !A.wanted || A.mode === "off") return;
    stopAudio(false);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { alert("Background ambience is not supported by this browser."); return; }

    try {
      A.ctx = new Ctx();
      await A.ctx.resume();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0;
      A.master.connect(A.ctx.destination);
      A.playing = true;

      if (A.mode === "calm") addPad(A.ctx,A.master,[130.81,196.00,261.63,329.63],0.055,780);
      if (A.mode === "keys") addSoftKeys(A.ctx,A.master);
      if (A.mode === "dream") addDreamscape(A.ctx,A.master);

      setMasterVolume();
      updateButton();
    } catch (e) {
      console.warn("Medora ambience could not start", e);
      A.playing = false;
      updateButton();
    }
  }

  function stopAudio(close=true) {
    const old = A.ctx;
    A.playing = false;
    A.timers.forEach(id => clearTimeout(id));
    A.timers = [];
    A.nodes.forEach(n => {
      try { n.stop?.(); } catch {}
      try { n.disconnect?.(); } catch {}
    });
    A.nodes = [];
    try { A.master?.disconnect(); } catch {}
    A.master = null;
    A.ctx = null;
    if (old) { try { old.close(); } catch {} }
    updateButton();
    if (close && A.panelOpen) renderPanel();
  }

  function updateButton() {
    const b=$("#medoraAmbientButton");
    if (!b) return;
    b.classList.toggle("on",A.playing);
    b.textContent = A.playing ? "♫" : "🎧";
    b.title = A.playing ? `${labelFor(A.mode)} playing` : "Relaxing ambience";
  }

  function bindVoiceNoteProtection() {
    document.addEventListener("click", e => {
      if (e.target.closest("#nhStartRec")) {
        A.resumeAfterRecording = A.playing || A.wanted;
        if (A.playing) stopAudio(false);
        return;
      }
      if (e.target.closest("#nhStopRec") || e.target.closest("#nhResetRec") || e.target.closest("[data-nh-close]")) {
        if (A.resumeAfterRecording && A.wanted && A.mode!=="off") {
          setTimeout(() => { if (!A.playing && appVisible()) startAudio(); }, 700);
        }
        A.resumeAfterRecording = false;
      }
    }, true);
  }

  function bindGlobal() {
    document.addEventListener("click", e => {
      if (A.panelOpen && !e.target.closest("#medoraAmbientWrap")) {
        A.panelOpen=false;
        renderPanel();
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key==="Escape" && A.panelOpen) {
        A.panelOpen=false;
        renderPanel();
      }
    });

    const resumeOnce = async () => {
      if (A.wanted && !A.playing && A.mode!=="off" && appVisible()) await startAudio();
      document.removeEventListener("pointerdown", resumeOnce, true);
    };
    document.addEventListener("pointerdown", resumeOnce, true);

    const app=$("#appView");
    if (app) new MutationObserver(() => {
      if (app.classList.contains("hidden") && A.playing) stopAudio(false);
    }).observe(app,{attributes:true,attributeFilter:["class"]});
  }

  function init() {
    addStyles();
    ensureControl();
    bindVoiceNoteProtection();
    bindGlobal();
    new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
