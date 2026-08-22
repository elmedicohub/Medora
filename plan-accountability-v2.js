(() => {
  "use strict";
  if (window.__MEDORA_PLAN_ACCOUNTABILITY__) return;
  window.__MEDORA_PLAN_ACCOUNTABILITY__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const CHECK_TIME = "23:00";
  const PRAYER_WEIGHTS = Object.freeze({ prayer: 14, mosque: 3, sunnah: 2, azkar: 1 });
  const S = { user: null, plans: [], routines: [], checkins: [], loading: false, loadedAt: 0 };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const safeText = v => String(v || "").replace(/[&<>]/g, "");

  function addStyles() {
    if ($("#planAccountabilityStyle")) return;
    const st = document.createElement("style");
    st.id = "planAccountabilityStyle";
    st.textContent = `
      .pa-checkin-note{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:5px 8px;border-radius:999px;background:#f0f4ff;color:#5c6fd0;font-size:9px;font-weight:800}
      .pa-checkin-note::before{content:"◷";font-size:12px}
      .pa-multi{min-width:min(520px,100%);display:grid;gap:8px}
      .pa-multi-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#7c8799;font-size:9px;font-weight:800}
      .pa-multi-head strong{color:#344057;font-size:10px}
      .pa-chips{display:flex;gap:6px;flex-wrap:wrap}
      .pa-chip{min-height:35px;display:inline-flex;align-items:center;gap:6px;padding:0 9px;border:1px solid #dfe5ee;border-radius:10px;background:#fff;color:#606b80;font-size:9px;font-weight:800;cursor:pointer;transition:.16s ease}
      .pa-chip:hover{border-color:#b8c4ee;background:#f8f9ff}
      .pa-chip .pa-box{width:18px;height:18px;display:grid;place-items:center;border:1.5px solid #cbd3df;border-radius:6px;background:#fff;color:transparent;font-size:10px;transition:.16s ease}
      .pa-chip.done{border-color:#a8ddcf;background:#f1fbf7;color:#28745e}
      .pa-chip.done .pa-box{border-color:#22a982;background:#22a982;color:#fff}
      .pa-multi-summary{height:4px;overflow:hidden;border-radius:999px;background:#e9edf3}
      .pa-multi-summary span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#18b8aa,#647ff0,#8459e8);transition:width .2s ease}
      .pa-saving{opacity:.58;pointer-events:none}

      .pa-prayer{min-width:min(980px,100%);display:grid;gap:9px}
      .pa-prayer-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .pa-prayer-head-left{display:grid;gap:2px}.pa-prayer-head-left span{color:#7c8799;font-size:9px;font-weight:800}.pa-prayer-head-left strong{color:#27344a;font-size:11px}
      .pa-prayer-score{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:linear-gradient(135deg,#f0fbf7,#f2f2ff);color:#4f5d74}
      .pa-prayer-score span{font-size:8px;font-weight:800}.pa-prayer-score strong{font-size:15px;color:#27344a;letter-spacing:-.03em}
      .pa-prayer-grid{display:grid;grid-template-columns:repeat(5,minmax(135px,1fr));gap:7px}
      .pa-prayer-card{padding:9px;border:1px solid #e1e7ef;border-radius:13px;background:#fff;display:grid;gap:7px;transition:.16s ease}
      .pa-prayer-card.done{border-color:#b6dfd4;background:#f8fcfa}.pa-prayer-card.mosque{box-shadow:inset 0 0 0 1px #8cd3be}
      .pa-prayer-title{display:flex;align-items:center;justify-content:space-between;gap:6px}
      .pa-prayer-done{display:flex;align-items:center;gap:6px;border:0;background:transparent;padding:0;color:#5c687c;font-size:9px;font-weight:900;cursor:pointer;text-align:left}
      .pa-prayer-check{width:20px;height:20px;display:grid;place-items:center;border:1.5px solid #cad3df;border-radius:7px;background:#fff;color:transparent;font-size:11px}
      .pa-prayer-card.done .pa-prayer-check{background:#20a77f;border-color:#20a77f;color:#fff}
      .pa-prayer-points{font-size:8px;font-weight:900;color:#8a93a3}
      .pa-prayer-row{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      .pa-prayer-option{min-height:31px;display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid #e0e6ee;border-radius:9px;background:#f9fafc;color:#6d788b;font-size:8px;font-weight:850;cursor:pointer;transition:.14s ease}
      .pa-prayer-option:hover{background:#f2f5fb}.pa-prayer-option.active{border-color:#a8dacc;background:#edf9f5;color:#26715d}
      .pa-prayer-option.mosque.active{border-color:#8fd0be;background:#e8f8f2;color:#176b51}.pa-prayer-option.extra.active{border-color:#c8bef5;background:#f4f1ff;color:#6957bd}
      .pa-prayer-option:disabled{opacity:.42;cursor:not-allowed;background:#fafbfc}
      .pa-prayer-bars{display:grid;grid-template-columns:1fr;gap:4px}
      .pa-prayer-quality-line{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#8892a3;font-size:8px}
      .pa-prayer-quality-line b{color:#536077}.pa-prayer-quality-line .pa-info{cursor:help;color:#7d6bd6;font-weight:900}
      .pa-prayer-quality-bar{height:5px;overflow:hidden;border-radius:999px;background:#e8edf3}.pa-prayer-quality-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#19b6aa,#667ff0,#8758e8);transition:width .2s ease}
      .pa-prayer-compliance-bar{height:3px;overflow:hidden;border-radius:999px;background:#edf1f5}.pa-prayer-compliance-bar span{display:block;height:100%;background:#22a77f;transition:width .2s ease}

      @media(max-width:1050px){.pa-prayer-grid{grid-template-columns:repeat(3,minmax(135px,1fr))}}
      @media(max-width:720px){.pa-multi{min-width:100%}.pa-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.pa-chip{justify-content:center;padding:0 6px}.lm-today-card{align-items:flex-start}.pa-prayer{min-width:100%}.pa-prayer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pa-prayer-head{align-items:flex-start}.pa-prayer-score{padding:6px 8px}}
      @media(max-width:430px){.pa-chips{grid-template-columns:repeat(2,minmax(0,1fr))}.pa-prayer-grid{grid-template-columns:1fr}.pa-prayer-card{padding:10px}.pa-prayer-row{grid-template-columns:repeat(4,minmax(0,1fr))}.pa-prayer-option{min-width:0}.pa-prayer-option span:last-child{display:none}}
    `;
    document.head.appendChild(st);
  }

  function plannerActive() {
    return !!$('.nav-item[data-screen="planner"].active,.mobile-nav-item[data-screen="planner"].active');
  }

  function scheduled(r, d) {
    if (r.is_active === false) return false;
    const days = Array.isArray(r.days_of_week) ? r.days_of_week.map(Number) : [];
    return r.schedule_type === "daily" || days.includes(d.getDay());
  }

  function expected(plan, routine) {
    const start = parseDate(plan.start_date);
    if (!start) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pe = parseDate(plan.end_date);
    const end = pe && pe < now ? pe : now;
    if (end < start) return 0;
    let n = 0;
    for (let d = new Date(start), g = 0; d <= end && g < 1000; d = addDays(d, 1), g++) {
      if (scheduled(routine, d)) n++;
    }
    return n;
  }

  function repeatInfo(routine, plan) {
    const meta = routine.metadata || {};
    let count = Number(meta.daily_check_count || 0);
    const unit = String(routine.target_unit || "").trim().toLowerCase();
    const target = Number(routine.target_value || 0);
    const discrete = new Set(["prayer","prayers","time","times","dose","doses","session","sessions","set","sets","rep","reps","repetition","repetitions","meal","meals","glass","glasses","pill","pills","medication","medications","act","acts"]);
    const prayer = meta.template_key === "prayers" || plan?.template_key === "prayers" || unit === "prayer" || unit === "prayers" || /five daily prayers|daily prayers|fajr|dhuhr|asr|maghrib|isha/i.test(routine.title || "");
    if (prayer) count = 5;
    else if (!count && Number.isInteger(target) && target >= 2 && target <= 12 && discrete.has(unit)) count = target;
    if (!count || count < 2 || count > 12) return null;
    let labels = Array.isArray(meta.check_labels) ? meta.check_labels.slice(0, count) : [];
    if (prayer) labels = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    while (labels.length < count) labels.push(String(labels.length + 1));
    return { count, labels, prayer };
  }

  async function load(force = false) {
    if (S.loading) return false;
    if (!force && S.user && Date.now() - S.loadedAt < 1500) return true;
    S.loading = true;
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return false;
      S.user = user;
      const since = iso(addDays(new Date(), -400));
      const q = await Promise.all([
        db.from("life_plans").select("*").order("created_at", { ascending: false }),
        db.from("plan_routines").select("*").order("created_at", { ascending: true }),
        db.from("plan_checkins").select("*").eq("user_id", user.id).gte("scheduled_for", since)
      ]);
      if (q.some(x => x.error)) {
        console.warn("Plan accountability load skipped", q.find(x => x.error)?.error);
        return false;
      }
      [S.plans, S.routines, S.checkins] = q.map(x => x.data || []);
      S.loadedAt = Date.now();
      return true;
    } finally {
      S.loading = false;
    }
  }

  function stateFor(check, info) {
    const raw = check?.details?.subchecks;
    if (Array.isArray(raw) && raw.length === info.count) return raw.map(Boolean);
    if (check?.status === "done") return Array(info.count).fill(true);
    if (check?.status === "partial") {
      const n = Math.max(1, Math.round(info.count * Number(check.compliance_score || .5)));
      return Array.from({ length: info.count }, (_, i) => i < n);
    }
    return Array(info.count).fill(false);
  }

  function prayerStateFor(check, info) {
    const legacy = stateFor(check, info);
    const raw = check?.details?.prayer_quality;
    return info.labels.map((label, i) => {
      const item = Array.isArray(raw) ? raw[i] : raw?.[String(label).toLowerCase()];
      const done = typeof item?.done === "boolean" ? item.done : legacy[i];
      return {
        done,
        location: item?.location === "mosque" || item?.location === "home" ? item.location : null,
        sunnah: done && !!item?.sunnah,
        azkar: done && !!item?.azkar
      };
    });
  }

  function prayerItemScore(item) {
    if (!item?.done) return 0;
    return PRAYER_WEIGHTS.prayer +
      (item.location === "mosque" ? PRAYER_WEIGHTS.mosque : 0) +
      (item.sunnah ? PRAYER_WEIGHTS.sunnah : 0) +
      (item.azkar ? PRAYER_WEIGHTS.azkar : 0);
  }

  function prayerScore(items) {
    return Math.max(0, Math.min(100, items.reduce((sum, item) => sum + prayerItemScore(item), 0)));
  }

  function prayerLabel(score) {
    if (score >= 100) return "Complete day";
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Strong";
    if (score >= 45) return "Building";
    return "Keep going";
  }

  function genericMultiHtml(plan, routine, check, info) {
    const vals = stateFor(check, info);
    const done = vals.filter(Boolean).length;
    const pct = Math.round(done / info.count * 100);
    return `<div class="pa-multi" data-pa-plan="${plan.id}" data-pa-routine="${routine.id}">
      <div class="pa-multi-head"><span>Today’s repetitions</span><strong>${done}/${info.count} · ${pct}%</strong></div>
      <div class="pa-chips">${info.labels.map((label, i) => `<button type="button" class="pa-chip ${vals[i] ? "done" : ""}" data-pa-index="${i}" aria-pressed="${vals[i] ? "true" : "false"}"><span class="pa-box">✓</span><span>${safeText(label)}</span></button>`).join("")}</div>
      <div class="pa-multi-summary"><span style="width:${pct}%"></span></div>
    </div>`;
  }

  function prayerHtml(plan, routine, check, info) {
    const items = prayerStateFor(check, info);
    const done = items.filter(x => x.done).length;
    const compliancePct = Math.round(done / info.count * 100);
    const quality = prayerScore(items);
    const scoreTitle = `Medora habit score per prayer: prayer ${PRAYER_WEIGHTS.prayer}, mosque +${PRAYER_WEIGHTS.mosque}, Sunnah +${PRAYER_WEIGHTS.sunnah}, Azkar +${PRAYER_WEIGHTS.azkar}. Plan compliance is calculated separately from prayer completion.`;

    return `<div class="pa-prayer" data-pa-plan="${plan.id}" data-pa-routine="${routine.id}">
      <div class="pa-prayer-head">
        <div class="pa-prayer-head-left"><span>Today’s prayers</span><strong>${done}/5 prayers · ${compliancePct}% compliance</strong></div>
        <div class="pa-prayer-score" title="${scoreTitle}"><span>${prayerLabel(quality)}<br>habit score</span><strong>${quality}/100</strong></div>
      </div>
      <div class="pa-prayer-grid">
        ${info.labels.map((label, i) => {
          const item = items[i];
          const pts = prayerItemScore(item);
          const disabled = item.done ? "" : "disabled";
          return `<article class="pa-prayer-card ${item.done ? "done" : ""} ${item.location === "mosque" ? "mosque" : ""}">
            <div class="pa-prayer-title">
              <button type="button" class="pa-prayer-done" data-pa-prayer-index="${i}" data-pa-prayer-action="done" aria-pressed="${item.done ? "true" : "false"}">
                <span class="pa-prayer-check">✓</span><span>${safeText(label)}</span>
              </button>
              <span class="pa-prayer-points">${pts}/20</span>
            </div>
            <div class="pa-prayer-row">
              <button type="button" class="pa-prayer-option ${item.location === "home" ? "active" : ""}" data-pa-prayer-index="${i}" data-pa-prayer-action="home" aria-pressed="${item.location === "home" ? "true" : "false"}" title="Prayed at home"><span>🏠</span><span>Home</span></button>
              <button type="button" class="pa-prayer-option mosque ${item.location === "mosque" ? "active" : ""}" data-pa-prayer-index="${i}" data-pa-prayer-action="mosque" aria-pressed="${item.location === "mosque" ? "true" : "false"}" title="Prayed in mosque"><span>🕌</span><span>Mosque</span></button>
            </div>
            <div class="pa-prayer-row">
              <button type="button" class="pa-prayer-option extra ${item.sunnah ? "active" : ""}" data-pa-prayer-index="${i}" data-pa-prayer-action="sunnah" aria-pressed="${item.sunnah ? "true" : "false"}" ${disabled} title="Sunnah"><span>✦</span><span>Sunnah</span></button>
              <button type="button" class="pa-prayer-option extra ${item.azkar ? "active" : ""}" data-pa-prayer-index="${i}" data-pa-prayer-action="azkar" aria-pressed="${item.azkar ? "true" : "false"}" ${disabled} title="Azkar"><span>📿</span><span>Azkar</span></button>
            </div>
          </article>`;
        }).join("")}
      </div>
      <div class="pa-prayer-bars">
        <div class="pa-prayer-quality-line"><span>Daily prayer habit mark</span><span><b>${quality}/100</b> <span class="pa-info" title="${scoreTitle}">ⓘ</span></span></div>
        <div class="pa-prayer-quality-bar"><span style="width:${quality}%"></span></div>
        <div class="pa-prayer-compliance-bar" title="Prayer-plan compliance: ${compliancePct}%"><span style="width:${compliancePct}%"></span></div>
      </div>
    </div>`;
  }

  function multiHtml(plan, routine, check, info) {
    return info.prayer ? prayerHtml(plan, routine, check, info) : genericMultiHtml(plan, routine, check, info);
  }

  function enhanceToday() {
    if (!plannerActive()) return;
    const cards = $$(".lm-today-card");
    const today = iso(new Date());
    cards.forEach(card => {
      const old = card.querySelector(".lm-checks");
      if (!old) return;
      const source = old.querySelector("[data-routine][data-plan]");
      if (!source) return;
      const rid = source.dataset.routine;
      const pid = source.dataset.plan;
      const routine = S.routines.find(r => r.id === rid);
      const plan = S.plans.find(p => p.id === pid);
      if (!routine || !plan) return;
      const info = repeatInfo(routine, plan);
      if (!info) return;
      const check = S.checkins.find(c => c.routine_id === rid && c.user_id === S.user.id && c.scheduled_for === today);
      const holder = document.createElement("div");
      holder.innerHTML = multiHtml(plan, routine, check, info);
      old.replaceWith(holder.firstElementChild);
    });
    const head = $(".lm-section-head p");
    if (head && !$(".pa-checkin-note")) {
      head.insertAdjacentHTML("afterend", `<span class="pa-checkin-note">I’ll check on you every day at ${CHECK_TIME}</span>`);
    }
  }

  function compliance(plan) {
    let due = 0;
    let earned = 0;
    S.routines.filter(r => r.plan_id === plan.id && r.is_active !== false).forEach(r => {
      due += expected(plan, r);
      earned += S.checkins.filter(c => c.routine_id === r.id && c.user_id === S.user.id).reduce((s, c) => s + Number(c.compliance_score || 0), 0);
    });
    return due ? Math.min(100, Math.round(earned / due * 100)) : 0;
  }

  function enhancePlanScores() {
    $$(".lm-plan-card").forEach(card => {
      const a = card.querySelector("[data-share],[data-delete]");
      const id = a?.dataset.share || a?.dataset.delete;
      if (!id) return;
      const plan = S.plans.find(p => p.id === id);
      if (!plan) return;
      const v = compliance(plan);
      const strong = card.querySelector(".lm-score strong");
      const bar = card.querySelector(".lm-progress span");
      if (strong) strong.textContent = `${v}%`;
      if (bar) bar.style.width = `${v}%`;
    });
  }

  function patchBrain() {
    const p = $("#medoraBrainDay .mb-hero > div > p");
    if (p && /^This is due from\b/i.test(p.textContent.trim())) p.textContent = `I’ll check on you every day at ${CHECK_TIME}.`;
    if (!$("#medoraBrainDay")) return;
    const today = iso(new Date());
    const pending = S.plans.filter(p => p.status === "active").flatMap(plan =>
      S.routines.filter(r => r.plan_id === plan.id && r.is_active !== false && scheduled(r, new Date())).map(r => ({
        plan,
        r,
        check: S.checkins.find(c => c.routine_id === r.id && c.scheduled_for === today && c.user_id === S.user.id)
      }))
    ).filter(x => !x.check || Number(x.check.compliance_score || 0) < 1);
    if (!pending.length) return;
    const first = pending[0];
    const info = repeatInfo(first.r, first.plan);
    const hero = $("#medoraBrainDay .mb-hero > div");
    if (hero && info) {
      const title = hero.querySelector("h1");
      const text = hero.querySelector("p");
      const done = first.check ? Math.round(Number(first.check.compliance_score || 0) * info.count) : 0;
      if (title) title.textContent = `${first.plan.icon || "✓"} ${first.r.title}`;
      if (text) text.textContent = `You’re at ${done}/${info.count} today. I’ll check on you every day at ${CHECK_TIME}.`;
    }
  }

  async function saveGeneric(button) {
    const box = button.closest(".pa-multi");
    if (!box || box.classList.contains("pa-saving")) return;
    const pid = box.dataset.paPlan;
    const rid = box.dataset.paRoutine;
    const idx = Number(button.dataset.paIndex);
    const plan = S.plans.find(p => p.id === pid);
    const routine = S.routines.find(r => r.id === rid);
    const info = repeatInfo(routine, plan);
    if (!plan || !routine || !info) return;
    const day = iso(new Date());
    let check = S.checkins.find(c => c.routine_id === rid && c.user_id === S.user.id && c.scheduled_for === day);
    const vals = stateFor(check, info);
    vals[idx] = !vals[idx];
    const done = vals.filter(Boolean).length;
    const score = done / info.count;
    box.classList.add("pa-saving");
    try {
      if (done === 0) {
        if (check) {
          const del = await db.from("plan_checkins").delete().eq("id", check.id).eq("user_id", S.user.id);
          if (del.error) throw del.error;
          S.checkins = S.checkins.filter(c => c.id !== check.id);
          check = null;
        }
      } else {
        const details = { ...(check?.details || {}), multi_check: true, subchecks: vals, subcheck_count: info.count, check_labels: info.labels };
        const payload = {
          plan_id: pid,
          routine_id: rid,
          user_id: S.user.id,
          scheduled_for: day,
          status: done === info.count ? "done" : "partial",
          compliance_score: score,
          points: Number(routine.base_points || 1) * score,
          details,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const res = await db.from("plan_checkins").upsert(payload, { onConflict: "routine_id,user_id,scheduled_for" }).select().single();
        if (res.error) throw res.error;
        S.checkins = S.checkins.filter(c => !(c.routine_id === rid && c.user_id === S.user.id && c.scheduled_for === day));
        S.checkins.push(res.data);
        check = res.data;
      }
      box.outerHTML = genericMultiHtml(plan, routine, check, info);
      enhancePlanScores();
      patchBrain();
      document.dispatchEvent(new CustomEvent("medora:plan-checkin-updated", { detail: { planId: pid, routineId: rid, score } }));
    } catch (e) {
      console.warn(e);
      alert(e.message || "Could not save this check.");
      box.classList.remove("pa-saving");
    }
  }

  async function savePrayer(button) {
    const box = button.closest(".pa-prayer");
    if (!box || box.classList.contains("pa-saving")) return;
    const pid = box.dataset.paPlan;
    const rid = box.dataset.paRoutine;
    const idx = Number(button.dataset.paPrayerIndex);
    const action = button.dataset.paPrayerAction;
    const plan = S.plans.find(p => p.id === pid);
    const routine = S.routines.find(r => r.id === rid);
    const info = repeatInfo(routine, plan);
    if (!plan || !routine || !info?.prayer || !Number.isInteger(idx) || idx < 0 || idx >= 5) return;

    const day = iso(new Date());
    let check = S.checkins.find(c => c.routine_id === rid && c.user_id === S.user.id && c.scheduled_for === day);
    const items = prayerStateFor(check, info);
    const item = items[idx];

    if (action === "done") {
      item.done = !item.done;
      if (!item.done) {
        item.location = null;
        item.sunnah = false;
        item.azkar = false;
      }
    } else if (action === "home" || action === "mosque") {
      item.done = true;
      item.location = item.location === action ? null : action;
    } else if (action === "sunnah" && item.done) {
      item.sunnah = !item.sunnah;
    } else if (action === "azkar" && item.done) {
      item.azkar = !item.azkar;
    } else {
      return;
    }

    const done = items.filter(x => x.done).length;
    const complianceScore = done / 5;
    const qualityScore = prayerScore(items);
    box.classList.add("pa-saving");

    try {
      if (done === 0) {
        if (check) {
          const del = await db.from("plan_checkins").delete().eq("id", check.id).eq("user_id", S.user.id);
          if (del.error) throw del.error;
          S.checkins = S.checkins.filter(c => c.id !== check.id);
          check = null;
        }
      } else {
        const details = {
          ...(check?.details || {}),
          multi_check: true,
          subchecks: items.map(x => x.done),
          subcheck_count: 5,
          check_labels: info.labels,
          prayer_quality_version: 1,
          prayer_quality: items,
          prayer_habit_score: qualityScore,
          prayer_score_model: PRAYER_WEIGHTS
        };
        const payload = {
          plan_id: pid,
          routine_id: rid,
          user_id: S.user.id,
          scheduled_for: day,
          status: done === 5 ? "done" : "partial",
          compliance_score: complianceScore,
          points: Number(routine.base_points || 1) * complianceScore,
          details,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const res = await db.from("plan_checkins").upsert(payload, { onConflict: "routine_id,user_id,scheduled_for" }).select().single();
        if (res.error) throw res.error;
        S.checkins = S.checkins.filter(c => !(c.routine_id === rid && c.user_id === S.user.id && c.scheduled_for === day));
        S.checkins.push(res.data);
        check = res.data;
      }

      box.outerHTML = prayerHtml(plan, routine, check, info);
      enhancePlanScores();
      patchBrain();
      document.dispatchEvent(new CustomEvent("medora:plan-checkin-updated", {
        detail: { planId: pid, routineId: rid, score: complianceScore, prayerHabitScore: qualityScore }
      }));
    } catch (e) {
      console.warn(e);
      alert(e.message || "Could not save this prayer check.");
      box.classList.remove("pa-saving");
    }
  }

  function todayPrayerSummary() {
    if (!S.user) return null;
    const day = iso(new Date());
    const now = new Date();
    for (const plan of S.plans.filter(p => p.status === "active")) {
      for (const routine of S.routines.filter(r => r.plan_id === plan.id && r.is_active !== false && scheduled(r, now))) {
        const info = repeatInfo(routine, plan);
        if (!info?.prayer) continue;
        const check = S.checkins.find(c => c.routine_id === routine.id && c.user_id === S.user.id && c.scheduled_for === day);
        const items = prayerStateFor(check, info);
        return { done: items.filter(x => x.done).length, score: prayerScore(items), plan, routine };
      }
    }
    return null;
  }

  async function enhance(force = false) {
    const ok = await load(force);
    if (!ok) return;
    enhanceToday();
    enhancePlanScores();
    patchBrain();
  }

  async function maybeElevenPmPrompt() {
    const now = new Date();
    if (now.getHours() < 23) return;
    await load(false);
    const key = `medora.11pmCheck.${iso(now)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}

    const prayer = todayPrayerSummary();
    const pending = S.plans.filter(p => p.status === "active").some(plan =>
      S.routines.some(r => r.plan_id === plan.id && r.is_active !== false && scheduled(r, now) && !S.checkins.find(c => c.routine_id === r.id && c.user_id === S.user?.id && c.scheduled_for === iso(now) && Number(c.compliance_score || 0) >= 1))
    );
    if (!prayer && !pending) return;

    let message = prayer ? `Prayer habit score today: ${prayer.score}/100 · ${prayer.done}/5 prayers.` : "11 PM check-in: how did your plans go today?";
    if (pending && prayer) message += " Check your remaining plans too.";

    const toast = $("#toast");
    if (toast) {
      toast.textContent = message;
      toast.className = "toast show";
      setTimeout(() => {
        if (toast.textContent === message) toast.className = "toast";
      }, 9000);
    }
    if (window.Notification?.permission === "granted") {
      try { new Notification("Medora 11 PM check-in", { body: message }); } catch {}
    }
  }

  function init() {
    addStyles();

    document.addEventListener("click", e => {
      const prayerButton = e.target.closest("[data-pa-prayer-action]");
      if (prayerButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        savePrayer(prayerButton);
        return;
      }
      const genericButton = e.target.closest("[data-pa-index]");
      if (genericButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        saveGeneric(genericButton);
      }
    }, true);

    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => enhance(false), 140);
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener("medora:planner-opened", () => enhance(true));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        enhance(false);
        maybeElevenPmPrompt();
      }
    });

    [250, 700, 1400, 2600].forEach(ms => setTimeout(() => enhance(ms > 1000), ms));
    setInterval(() => maybeElevenPmPrompt(), 60 * 1000);
    setTimeout(() => maybeElevenPmPrompt(), 2200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
