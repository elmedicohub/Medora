(() => {
  "use strict";
  if (window.__MEDORA_NOTE_HUB__) return;
  window.__MEDORA_NOTE_HUB__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const STORE_SCREEN = "medora.lastScreen";
  const state = {
    user: null,
    notes: [],
    filter: "all",
    search: "",
    loaded: false,
    recorder: null,
    recorderStream: null,
    chunks: [],
    recordingStartedAt: 0,
    recordingTimer: null,
    pendingBlob: null,
    pendingDuration: 0
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad = n => String(n).padStart(2, "0");
  const dmy = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  };
  const hm = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const durationText = sec => {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m}:${pad(s)}` : `0:${pad(s)}`;
  };
  const notesActive = () => !!document.querySelector('[data-notes-link].active');

  function safeSet(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  function safeGet(k, f = "") { try { return localStorage.getItem(k) || f; } catch { return f; } }

  function addStyles() {
    if ($("#medoraNotesStyle")) return;
    const s = document.createElement("style");
    s.id = "medoraNotesStyle";
    s.textContent = `
      .nh-root{display:grid;gap:16px}.nh-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:18px;padding:28px;border-radius:27px;color:#fff;background:radial-gradient(circle at 94% 8%,rgba(139,89,235,.42),transparent 30%),radial-gradient(circle at 0 100%,rgba(26,187,171,.28),transparent 36%),linear-gradient(135deg,#0c1832,#1b2d60 68%,#2c245e)}
      .nh-ey{font-size:10px;font-weight:850;letter-spacing:.12em;color:#ffffff9d}.nh-hero h1{margin:7px 0 9px;font-size:clamp(35px,4.2vw,52px);line-height:1.03;letter-spacing:-.05em}.nh-hero p{margin:0;max-width:760px;color:#ffffffaa;line-height:1.6}.nh-capture{display:grid;gap:9px;align-content:center;padding:19px;border:1px solid #ffffff20;border-radius:19px;background:#ffffff0c}.nh-capture strong{font-size:18px}.nh-capture small{color:#ffffff9c;line-height:1.45}.nh-capture-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nh-capture button{min-height:43px;border:0;border-radius:11px;font-weight:850;cursor:pointer}.nh-write{background:#fff;color:#17213a}.nh-record{background:#ffedf1;color:#a53850}.nh-record:before{content:'●';margin-right:7px;color:#df3d5d}
      .nh-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 15px;border:1px solid #e1e6ef;border-radius:17px;background:#fff}.nh-tabs{display:flex;gap:5px;flex-wrap:wrap}.nh-tabs button{min-height:36px;padding:0 12px;border:0;border-radius:10px;background:#f0f3f8;color:#667188;font-size:10px;font-weight:850;cursor:pointer}.nh-tabs button.active{background:#eaf0ff;color:#5268d6}.nh-search{min-width:min(330px,100%);min-height:39px;padding:0 12px;border:1px solid #dfe5ee;border-radius:11px;background:#fbfcfe}
      .nh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.nh-note{position:relative;display:grid;gap:11px;min-height:205px;padding:17px;border:1px solid #e1e6ef;border-radius:18px;background:#fff;box-shadow:0 8px 26px rgba(36,48,78,.035)}.nh-note.pinned{border-color:#c8d1ff;background:linear-gradient(150deg,#fff,#fbfaff)}.nh-note-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}.nh-note-kind{display:flex;align-items:center;gap:7px;color:#667188;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.nh-note-kind span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(135deg,#eefaf7,#f0edff);font-size:16px}.nh-pin{width:32px;height:32px;border:0;border-radius:9px;background:#f3f5f9;color:#7b8495;cursor:pointer}.nh-pin.on{background:#fff2c9;color:#8a6800}.nh-note h3{margin:0;font-size:17px;line-height:1.25}.nh-body{color:#657086;font-size:11px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}.nh-tags{display:flex;gap:5px;flex-wrap:wrap}.nh-tag{padding:4px 7px;border-radius:999px;background:#f1f4f8;color:#6f798d;font-size:8px;font-weight:800}.nh-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;color:#8a92a2;font-size:9px}.nh-actions{display:flex;gap:6px}.nh-actions button{min-height:31px;padding:0 9px;border:0;border-radius:9px;background:#f1f4f8;color:#657086;font-size:9px;font-weight:800;cursor:pointer}.nh-actions button.danger{background:#fff0f3;color:#a54255}.nh-audio{width:100%;height:38px}.nh-voice-shell{display:grid;gap:8px;padding:10px;border-radius:12px;background:#f7f9fc}.nh-voice-line{display:flex;align-items:center;gap:8px;color:#5d687e;font-size:10px;font-weight:800}.nh-dot{width:8px;height:8px;border-radius:50%;background:#d6415d}.nh-empty{padding:42px 20px;border:1px dashed #dce3ec;border-radius:18px;text-align:center;color:#7e8798}.nh-empty strong,.nh-empty span{display:block}.nh-empty strong{color:#46536c}.nh-empty span{margin-top:6px;font-size:11px}
      .nh-modal-bg{position:fixed;z-index:610;inset:0;display:grid;place-items:center;padding:18px;background:#0c15287c;backdrop-filter:blur(5px)}.nh-modal{width:min(790px,100%);max-height:90vh;overflow:auto;padding:24px;border-radius:23px;background:#fff;box-shadow:0 30px 90px #111a3430}.nh-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.nh-modal-head span{color:#707a90;font-size:9px;font-weight:850;letter-spacing:.1em}.nh-modal-head h2{margin:5px 0 0;font-size:27px}.nh-x{width:38px;height:38px;border:0;border-radius:50%;background:#f0f3f7;color:#5f697b;font-size:21px;cursor:pointer}.nh-form{display:grid;gap:12px;margin-top:18px}.nh-form label{display:grid;gap:6px;color:#4e596d;font-size:10px;font-weight:850}.nh-form input,.nh-form textarea{width:100%;border:1px solid #dfe4ed;border-radius:11px;background:#fff;color:#273247;outline:none}.nh-title-input{min-height:48px;padding:0 13px;font-size:18px;font-weight:750}.nh-paper{min-height:300px;padding:18px;resize:vertical;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;background:repeating-linear-gradient(to bottom,#fff 0,#fff 31px,#eef1f6 32px)}.nh-editor-tools{display:flex;gap:6px;flex-wrap:wrap}.nh-editor-tools button{min-height:34px;padding:0 10px;border:0;border-radius:9px;background:#f0f3f8;color:#647087;font-size:9px;font-weight:850;cursor:pointer}.nh-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:5px}.nh-cancel,.nh-save{min-height:42px;padding:0 14px;border:0;border-radius:11px;font-weight:850;cursor:pointer}.nh-cancel{background:#eef2f7;color:#596478}.nh-save{color:#fff;background:linear-gradient(115deg,#19b8aa,#667ff2 52%,#8558ea)}
      .nh-recorder{display:grid;gap:14px;margin-top:18px}.nh-recorder-stage{display:grid;place-items:center;gap:10px;padding:28px;border:1px solid #e5e8ef;border-radius:20px;background:linear-gradient(145deg,#fbfdff,#f7f4ff)}.nh-mic{width:74px;height:74px;display:grid;place-items:center;border-radius:50%;background:#fff0f3;font-size:31px;box-shadow:0 14px 30px #9d3f5618}.nh-rec-time{font-size:34px;font-weight:850;letter-spacing:-.04em}.nh-rec-status{color:#7c8698;font-size:11px}.nh-rec-buttons{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.nh-rec-buttons button{min-height:42px;padding:0 14px;border:0;border-radius:11px;font-weight:850;cursor:pointer}.nh-start{background:#edf8f2;color:#187458}.nh-stop{background:#fff0f3;color:#a33f54}.nh-reset{background:#eef2f7;color:#5e687b}.nh-preview{width:min(560px,100%)}
      @media(max-width:1050px){.nh-hero{grid-template-columns:1fr}.nh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.nh-grid{grid-template-columns:1fr}.nh-toolbar{align-items:stretch;flex-direction:column}.nh-search{width:100%;min-width:0}.nh-capture-actions{grid-template-columns:1fr 1fr}.nh-paper{min-height:250px}}
    `;
    document.head.appendChild(s);
  }

  function ensureNav() {
    const main = $(".main-nav");
    if (main && !main.querySelector("[data-notes-link]")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nav-item";
      b.dataset.notesLink = "true";
      b.innerHTML = '<span class="nav-icon">✎</span><span>Notes</span>';
      main.appendChild(b);
    }
    const mobile = $(".mobile-nav");
    if (mobile && !mobile.querySelector("[data-notes-link]")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mobile-nav-item";
      b.dataset.notesLink = "true";
      b.innerHTML = '<span>✎</span><small>Notes</small>';
      mobile.appendChild(b);
    }
  }

  function setActive() {
    $$(".nav-item.active,.mobile-nav-item.active,[data-wall-link].active,[data-study-link].active,[data-activity-link].active").forEach(x => x.classList.remove("active"));
    $$('[data-notes-link]').forEach(x => x.classList.add("active"));
  }
  function clearActive() { $$('[data-notes-link]').forEach(x => x.classList.remove("active")); }

  async function load() {
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return false;
    state.user = user;
    const { data, error } = await db.from("medora_notes").select("*").eq("user_id", user.id).order("is_pinned", { ascending:false }).order("updated_at", { ascending:false });
    if (error) { console.warn("Notes load failed", error); return false; }
    state.notes = data || [];
    state.loaded = true;
    return true;
  }

  function filteredNotes() {
    const q = state.search.trim().toLowerCase();
    return state.notes.filter(n => {
      if (state.filter === "written" && n.note_type === "voice") return false;
      if (state.filter === "voice" && !["voice","mixed"].includes(n.note_type)) return false;
      if (state.filter === "pinned" && !n.is_pinned) return false;
      if (!q) return true;
      const hay = [n.title, n.content, ...(n.tags || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function noteCard(n) {
    const isVoice = ["voice","mixed"].includes(n.note_type) && n.voice_path;
    const kind = n.note_type === "voice" ? "Voice note" : n.note_type === "mixed" ? "Voice + writing" : "Written note";
    const icon = n.note_type === "voice" ? "🎙️" : n.note_type === "mixed" ? "🎧" : "✍️";
    return `<article class="nh-note ${n.is_pinned ? "pinned" : ""}" data-note-id="${n.id}">
      <div class="nh-note-top">
        <div class="nh-note-kind"><span>${icon}</span>${kind}</div>
        <button class="nh-pin ${n.is_pinned ? "on" : ""}" type="button" data-pin-note="${n.id}" title="${n.is_pinned ? "Unpin" : "Pin"}">★</button>
      </div>
      <h3>${esc(n.title || (isVoice ? "Voice note" : "Untitled note"))}</h3>
      ${isVoice ? `<div class="nh-voice-shell"><div class="nh-voice-line"><span class="nh-dot"></span>${durationText(n.voice_duration_seconds)} voice note</div><audio class="nh-audio" controls preload="none" data-voice-path="${esc(n.voice_path)}"></audio></div>` : ""}
      ${n.content ? `<div class="nh-body">${esc(n.content)}</div>` : ""}
      ${(n.tags || []).length ? `<div class="nh-tags">${n.tags.map(t => `<span class="nh-tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="nh-meta">
        <span>${dmy(n.updated_at)} · ${hm(n.updated_at)}</span>
        <div class="nh-actions"><button type="button" data-edit-note="${n.id}">Edit</button><button type="button" class="danger" data-delete-note="${n.id}">Delete</button></div>
      </div>
    </article>`;
  }

  function render() {
    if (!notesActive()) return;
    const root = $("#screenContainer");
    if (!root) return;
    const kicker = $("#topbarKicker"), title = $("#topbarTitle");
    if (kicker) kicker.textContent = "NOTES";
    if (title) title.textContent = "Capture it before it disappears.";

    const notes = filteredNotes();
    root.innerHTML = `<section class="screen nh-root">
      <section class="nh-hero">
        <div><span class="nh-ey">MEDORA NOTES</span><h1>Write it. Say it. Find it later.</h1><p>Keep ideas, reflections, study points and quick voice notes in one private place. Search them, tag them and pin what matters.</p></div>
        <aside class="nh-capture"><strong>Capture an idea</strong><small>Use writing when you want structure. Use voice when typing would slow you down.</small><div class="nh-capture-actions"><button class="nh-write" type="button" data-new-written>✍️ Write</button><button class="nh-record" type="button" data-new-voice>Record</button></div></aside>
      </section>
      <div class="nh-toolbar">
        <div class="nh-tabs">${[["all","All"],["written","Writing"],["voice","Voice"],["pinned","Pinned"]].map(([k,l]) => `<button type="button" data-note-filter="${k}" class="${state.filter===k?"active":""}">${l}</button>`).join("")}</div>
        <input class="nh-search" id="nhSearch" type="search" placeholder="Search notes or tags…" value="${esc(state.search)}" />
      </div>
      ${notes.length ? `<div class="nh-grid">${notes.map(noteCard).join("")}</div>` : `<div class="nh-empty"><strong>No notes here yet.</strong><span>Write something or record a quick voice note.</span></div>`}
      <div id="nhModal"></div>
    </section>`;

    bindRendered();
    hydrateVoiceUrls();
  }

  async function hydrateVoiceUrls() {
    const audios = $$('audio[data-voice-path]');
    for (const audio of audios) {
      const path = audio.dataset.voicePath;
      if (!path || audio.dataset.ready) continue;
      const { data, error } = await db.storage.from("medora-voice-notes").createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) { audio.src = data.signedUrl; audio.dataset.ready = "1"; }
    }
  }

  function bindRendered() {
    $$('[data-note-filter]').forEach(b => b.addEventListener("click", () => { state.filter = b.dataset.noteFilter; render(); }));
    $("#nhSearch")?.addEventListener("input", e => { state.search = e.target.value; render(); const input=$("#nhSearch"); if(input){input.focus(); input.setSelectionRange(input.value.length,input.value.length);} });
    $("[data-new-written]")?.addEventListener("click", () => openWriteModal());
    $("[data-new-voice]")?.addEventListener("click", () => openVoiceModal());
    $$('[data-pin-note]').forEach(b => b.addEventListener("click", () => togglePin(b.dataset.pinNote)));
    $$('[data-edit-note]').forEach(b => b.addEventListener("click", () => openWriteModal(b.dataset.editNote)));
    $$('[data-delete-note]').forEach(b => b.addEventListener("click", () => deleteNote(b.dataset.deleteNote)));
  }

  function parseTags(raw) {
    return [...new Set(String(raw || "").split(",").map(x => x.trim().replace(/^#/,"")).filter(Boolean))].slice(0,12);
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = textarea.value.slice(0,start) + text + textarea.value.slice(end);
    textarea.focus();
    const pos = start + text.length;
    textarea.setSelectionRange(pos,pos);
  }

  function openWriteModal(noteId = null) {
    const note = noteId ? state.notes.find(n => n.id === noteId) : null;
    const host = $("#nhModal"); if (!host) return;
    host.innerHTML = `<div class="nh-modal-bg"><section class="nh-modal">
      <div class="nh-modal-head"><div><span>${note ? "EDIT NOTE" : "NEW NOTE"}</span><h2>${note?.voice_path ? "Voice note + writing" : "Write freely"}</h2></div><button class="nh-x" type="button" data-nh-close>×</button></div>
      <form class="nh-form" id="nhWriteForm">
        <input class="nh-title-input" id="nhTitle" maxlength="180" placeholder="Title" value="${esc(note?.title || "")}" />
        <div class="nh-editor-tools"><button type="button" data-insert="• ">• Bullet</button><button type="button" data-insert="☐ ">☐ Checklist</button><button type="button" data-insert="\n— ">— Section</button><button type="button" data-insert="${dmy(new Date())} ">Date</button></div>
        <textarea class="nh-paper" id="nhContent" placeholder="Start writing…">${esc(note?.content || "")}</textarea>
        <label>Tags <input id="nhTags" placeholder="study, idea, work" value="${esc((note?.tags || []).join(", "))}" /></label>
        <div class="nh-modal-actions"><button class="nh-cancel" type="button" data-nh-close>Cancel</button><button class="nh-save" type="submit">Save note</button></div>
      </form>
    </section></div>`;
    $$('[data-nh-close]',host).forEach(b => b.addEventListener("click", closeModal));
    $$('[data-insert]',host).forEach(b => b.addEventListener("click", () => insertAtCursor($("#nhContent",host), b.dataset.insert)));
    $("#nhWriteForm",host).addEventListener("submit", e => saveWritten(e, note));
    setTimeout(() => $("#nhTitle",host)?.focus(), 20);
  }

  async function saveWritten(e, existing) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = $("#nhTitle",form).value.trim();
    const content = $("#nhContent",form).value.trim();
    if (!title && !content && !existing?.voice_path) { alert("Write something first."); return; }
    const payload = {
      user_id: state.user.id,
      title: title || (existing?.voice_path ? "Voice note" : "Untitled note"),
      content,
      tags: parseTags($("#nhTags",form).value),
      note_type: existing?.voice_path ? "mixed" : "written",
      updated_at: new Date().toISOString()
    };
    const save = $(".nh-save",form); save.disabled=true; save.textContent="Saving…";
    let res;
    if (existing) res = await db.from("medora_notes").update(payload).eq("id", existing.id).eq("user_id", state.user.id).select().single();
    else res = await db.from("medora_notes").insert(payload).select().single();
    if (res.error) { alert(res.error.message); save.disabled=false; save.textContent="Save note"; return; }
    if (existing) state.notes = state.notes.map(n => n.id===existing.id ? res.data : n); else state.notes.unshift(res.data);
    sortNotes(); closeModal(); render();
  }

  function bestMime() {
    if (!window.MediaRecorder) return "";
    const choices = ["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg"];
    return choices.find(x => MediaRecorder.isTypeSupported?.(x)) || "";
  }

  function openVoiceModal(existingId = null) {
    const existing = existingId ? state.notes.find(n => n.id === existingId) : null;
    resetRecorderState();
    const host = $("#nhModal"); if (!host) return;
    host.innerHTML = `<div class="nh-modal-bg"><section class="nh-modal">
      <div class="nh-modal-head"><div><span>VOICE NOTE</span><h2>Say it while it is fresh.</h2></div><button class="nh-x" type="button" data-nh-close>×</button></div>
      <div class="nh-recorder">
        <div class="nh-recorder-stage"><div class="nh-mic">🎙️</div><div class="nh-rec-time" id="nhRecTime">0:00</div><div class="nh-rec-status" id="nhRecStatus">Ready to record</div><div class="nh-rec-buttons"><button class="nh-start" type="button" id="nhStartRec">● Start recording</button><button class="nh-stop" type="button" id="nhStopRec" disabled>■ Stop</button><button class="nh-reset" type="button" id="nhResetRec" disabled>↺ Reset</button></div><audio id="nhPreview" class="nh-preview hidden" controls></audio></div>
        <form class="nh-form" id="nhVoiceForm">
          <input class="nh-title-input" id="nhVoiceTitle" maxlength="180" placeholder="Voice note title" value="${esc(existing?.title || "")}" />
          <textarea id="nhVoiceText" rows="4" placeholder="Optional written note under the recording…">${esc(existing?.content || "")}</textarea>
          <label>Tags <input id="nhVoiceTags" placeholder="idea, reminder, study" value="${esc((existing?.tags || []).join(", "))}" /></label>
          <div class="nh-modal-actions"><button class="nh-cancel" type="button" data-nh-close>Cancel</button><button class="nh-save" id="nhVoiceSave" type="submit" ${existing?.voice_path ? "" : "disabled"}>Save voice note</button></div>
        </form>
      </div>
    </section></div>`;
    $$('[data-nh-close]',host).forEach(b => b.addEventListener("click", closeModal));
    $("#nhStartRec",host).addEventListener("click", startRecording);
    $("#nhStopRec",host).addEventListener("click", stopRecording);
    $("#nhResetRec",host).addEventListener("click", resetRecordingUI);
    $("#nhVoiceForm",host).addEventListener("submit", e => saveVoice(e, existing));
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Voice recording is not supported by this browser."); return;
    }
    try {
      state.recorderStream = await navigator.mediaDevices.getUserMedia({ audio:true });
      state.chunks = [];
      const mime = bestMime();
      state.recorder = mime ? new MediaRecorder(state.recorderStream, { mimeType:mime }) : new MediaRecorder(state.recorderStream);
      state.recorder.ondataavailable = e => { if (e.data?.size) state.chunks.push(e.data); };
      state.recorder.onstop = finishRecording;
      state.recordingStartedAt = Date.now();
      state.recorder.start(250);
      $("#nhStartRec").disabled = true; $("#nhStopRec").disabled = false; $("#nhResetRec").disabled = true;
      $("#nhRecStatus").textContent = "Recording…";
      clearInterval(state.recordingTimer);
      state.recordingTimer = setInterval(() => {
        const sec = Math.floor((Date.now()-state.recordingStartedAt)/1000);
        const el=$("#nhRecTime"); if(el) el.textContent=durationText(sec);
      },250);
    } catch (err) {
      console.warn(err); alert("Microphone permission is required to record a voice note.");
    }
  }

  function stopRecording() {
    if (state.recorder?.state === "recording") state.recorder.stop();
  }

  function finishRecording() {
    clearInterval(state.recordingTimer); state.recordingTimer=null;
    state.pendingDuration = Math.max(1, Math.round((Date.now()-state.recordingStartedAt)/1000));
    const type = state.recorder?.mimeType || state.chunks[0]?.type || "audio/webm";
    state.pendingBlob = new Blob(state.chunks, { type });
    stopStream();
    const preview = $("#nhPreview");
    if (preview) { preview.src = URL.createObjectURL(state.pendingBlob); preview.classList.remove("hidden"); }
    const time=$("#nhRecTime"); if(time) time.textContent=durationText(state.pendingDuration);
    const status=$("#nhRecStatus"); if(status) status.textContent="Recording ready";
    const start=$("#nhStartRec"), stop=$("#nhStopRec"), reset=$("#nhResetRec"), save=$("#nhVoiceSave");
    if(start) start.disabled=true; if(stop) stop.disabled=true; if(reset) reset.disabled=false; if(save) save.disabled=false;
  }

  function resetRecordingUI() {
    resetRecorderState();
    const preview=$("#nhPreview"); if(preview){preview.pause();preview.removeAttribute("src");preview.load();preview.classList.add("hidden");}
    const time=$("#nhRecTime"), status=$("#nhRecStatus"), start=$("#nhStartRec"), stop=$("#nhStopRec"), reset=$("#nhResetRec"), save=$("#nhVoiceSave");
    if(time) time.textContent="0:00"; if(status) status.textContent="Ready to record"; if(start) start.disabled=false; if(stop) stop.disabled=true; if(reset) reset.disabled=true; if(save) save.disabled=true;
  }

  function extensionFor(type) {
    type=String(type||"").toLowerCase();
    if(type.includes("mp4")) return "m4a";
    if(type.includes("ogg")) return "ogg";
    if(type.includes("mpeg")) return "mp3";
    if(type.includes("wav")) return "wav";
    return "webm";
  }

  async function saveVoice(e, existing) {
    e.preventDefault();
    const form=e.currentTarget;
    const save=$("#nhVoiceSave",form); save.disabled=true; save.textContent="Saving…";
    let voicePath = existing?.voice_path || null;
    let duration = existing?.voice_duration_seconds || null;
    if (state.pendingBlob) {
      const id = existing?.id || crypto.randomUUID();
      const ext = extensionFor(state.pendingBlob.type);
      voicePath = `${state.user.id}/${id}/${Date.now()}.${ext}`;
      const up = await db.storage.from("medora-voice-notes").upload(voicePath, state.pendingBlob, { contentType:state.pendingBlob.type || "audio/webm", upsert:false });
      if (up.error) { alert(up.error.message); save.disabled=false; save.textContent="Save voice note"; return; }
      duration = state.pendingDuration;
      if (existing?.voice_path && existing.voice_path !== voicePath) await db.storage.from("medora-voice-notes").remove([existing.voice_path]);
    }
    if (!voicePath) { alert("Record something first."); save.disabled=false; save.textContent="Save voice note"; return; }
    const text=$("#nhVoiceText",form).value.trim();
    const payload={
      user_id:state.user.id,
      title:$("#nhVoiceTitle",form).value.trim() || "Voice note",
      content:text,
      tags:parseTags($("#nhVoiceTags",form).value),
      note_type:text ? "mixed" : "voice",
      voice_path:voicePath,
      voice_duration_seconds:duration,
      updated_at:new Date().toISOString()
    };
    let res;
    if(existing) res=await db.from("medora_notes").update(payload).eq("id",existing.id).eq("user_id",state.user.id).select().single();
    else {
      const id = voicePath.split("/")[1];
      res=await db.from("medora_notes").insert({id,...payload}).select().single();
    }
    if(res.error){ if(!existing && voicePath) await db.storage.from("medora-voice-notes").remove([voicePath]); alert(res.error.message); save.disabled=false; save.textContent="Save voice note"; return; }
    if(existing) state.notes=state.notes.map(n=>n.id===existing.id?res.data:n); else state.notes.unshift(res.data);
    sortNotes(); resetRecorderState(); closeModal(); render();
  }

  async function togglePin(id) {
    const note=state.notes.find(n=>n.id===id); if(!note) return;
    const {data,error}=await db.from("medora_notes").update({is_pinned:!note.is_pinned,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",state.user.id).select().single();
    if(error){alert(error.message);return;} state.notes=state.notes.map(n=>n.id===id?data:n); sortNotes(); render();
  }

  async function deleteNote(id) {
    const note=state.notes.find(n=>n.id===id); if(!note) return;
    if(!confirm("Delete this note?")) return;
    const {error}=await db.from("medora_notes").delete().eq("id",id).eq("user_id",state.user.id);
    if(error){alert(error.message);return;}
    if(note.voice_path) await db.storage.from("medora-voice-notes").remove([note.voice_path]);
    state.notes=state.notes.filter(n=>n.id!==id); render();
  }

  function sortNotes() {
    state.notes.sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned) || new Date(b.updated_at)-new Date(a.updated_at));
  }

  function stopStream() {
    state.recorderStream?.getTracks?.().forEach(t=>t.stop()); state.recorderStream=null;
  }
  function resetRecorderState() {
    clearInterval(state.recordingTimer); state.recordingTimer=null;
    try { if(state.recorder?.state==="recording") state.recorder.stop(); } catch {}
    stopStream(); state.recorder=null; state.chunks=[]; state.recordingStartedAt=0; state.pendingBlob=null; state.pendingDuration=0;
  }
  function closeModal() { resetRecorderState(); const host=$("#nhModal"); if(host) host.innerHTML=""; }

  async function activate() {
    ensureNav(); setActive(); safeSet(STORE_SCREEN,"notes");
    const root=$("#screenContainer"); if(root) root.innerHTML='<section class="screen nh-root"><div class="nh-empty"><strong>Loading Notes…</strong></div></section>';
    if(!state.loaded){const ok=await load(); if(!ok){if(root)root.innerHTML='<section class="screen nh-root"><div class="nh-empty"><strong>Notes could not load.</strong><span>Please refresh once.</span></div></section>';return;}}
    render();
  }

  function maybeRestore() {
    if(safeGet(STORE_SCREEN)!=="notes") return;
    let tries=0;
    const t=setInterval(()=>{tries++;const app=$("#appView"),btn=$("[data-notes-link]");if(app&&!app.classList.contains("hidden")&&btn){clearInterval(t);btn.click();}else if(tries>40)clearInterval(t);},150);
  }

  function init() {
    addStyles(); ensureNav();
    document.addEventListener("click", e => {
      const notes=e.target.closest("[data-notes-link]");
      if(notes){e.preventDefault();activate();return;}
      if(e.target.closest("[data-screen]")||e.target.closest("[data-wall-link]")||e.target.closest("[data-study-link]")||e.target.closest("[data-activity-link]")||e.target.closest("#avatarButton")) clearActive();
    },true);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&notesActive()&&$("#nhModal")?.children.length)closeModal();});
    maybeRestore();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
