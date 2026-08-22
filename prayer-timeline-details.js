(() => {
  "use strict";
  if (window.__MEDORA_PRAYER_TIMELINE_DETAILS__) return;
  window.__MEDORA_PRAYER_TIMELINE_DETAILS__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dmy = s => {
    const d = typeof s === "string" ? parseISO(s) : s;
    return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "—";
  };
  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const WEIGHTS = { prayer: 14, mosque: 3, sunnah: 2, azkar: 1 };
  const S = { user: null, plans: new Map(), routines: new Map(), checks: new Map(), busy: false, lastLoad: 0 };
  const checkKey = (routineId, date) => `${routineId}|${date}`;

  function styles() {
    if ($("#prayerTimelineDetailsStyle")) return;
    const st = document.createElement("style");
    st.id = "prayerTimelineDetailsStyle";
    st.textContent = `
      .lm-day-dot.ptd-clickable{position:relative;cursor:pointer;outline:none;transition:transform .15s ease,box-shadow .15s ease}
      .lm-day-dot.ptd-clickable:hover{transform:scale(1.12)}
      .lm-day-dot.ptd-clickable:focus-visible{box-shadow:0 0 0 4px rgba(97,113,231,.22)}
      .ptd-hint{margin-top:7px;color:#6d78c8;font-size:9px;font-weight:800}.ptd-hint::before{content:"☰ ";}
      .ptd-bg{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:16px;background:rgba(10,18,39,.56);backdrop-filter:blur(6px)}
      .ptd-modal{width:min(820px,100%);max-height:92vh;overflow:auto;border-radius:24px;background:#fff;box-shadow:0 28px 100px rgba(8,18,47,.28)}
      .ptd-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #edf0f5}
      .ptd-head span{display:block;color:#6d73d5;font-size:9px;font-weight:900;letter-spacing:.12em}.ptd-head h2{margin:5px 0 2px;font-size:24px;letter-spacing:-.03em}.ptd-head p{margin:0;color:#8791a3;font-size:10px}
      .ptd-x{width:38px;height:38px;border:0;border-radius:50%;background:#eff2f7;font-size:20px;cursor:pointer}
      .ptd-score{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:18px 22px 0;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#eefaf6,#f3f1ff)}
      .ptd-score small{display:block;color:#778295;font-size:9px;font-weight:800}.ptd-score strong{font-size:27px;letter-spacing:-.04em;color:#28354a}.ptd-score em{font-style:normal;color:#69758a;font-size:10px}
      .ptd-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:18px 22px 8px}
      .ptd-prayer{padding:12px;border:1px solid #e3e8ef;border-radius:15px;background:#fbfcfe;display:grid;gap:9px}.ptd-prayer.done{border-color:#b7dfd4;background:#f7fcfa}.ptd-prayer.mosque{box-shadow:inset 0 0 0 1px #8fd2bf}
      .ptd-prayer-head{display:flex;justify-content:space-between;gap:7px;align-items:center}.ptd-prayer-head strong{font-size:11px;color:#2f3b51}.ptd-points{font-size:9px;font-weight:900;color:#69758a}
      .ptd-row{display:flex;align-items:center;gap:6px;color:#69758a;font-size:9px;font-weight:750}.ptd-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:#f0f3f8;font-size:13px}.ptd-yes{color:#24745d}.ptd-no{color:#9aa3b1}
      .ptd-empty{padding:18px 22px;color:#8c96a7;font-size:10px}.ptd-foot{padding:10px 22px 20px;color:#8a94a5;font-size:9px;line-height:1.5}.ptd-foot b{color:#5d687c}
      @media(max-width:900px){.ptd-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.ptd-bg{padding:0;align-items:end}.ptd-modal{width:100%;max-height:94vh;border-radius:22px 22px 0 0}.ptd-grid{grid-template-columns:1fr 1fr;padding-left:16px;padding-right:16px}.ptd-head,.ptd-score,.ptd-foot{margin-left:0;margin-right:0}.ptd-head{padding-left:16px;padding-right:16px}.ptd-score{margin-left:16px;margin-right:16px}.ptd-foot{padding-left:16px;padding-right:16px}}
      @media(max-width:410px){.ptd-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function planIdForCard(card) {
    const a = card.querySelector('[data-share],[data-delete]');
    return a?.dataset.share || a?.dataset.delete || null;
  }

  function prayerRoutine(r) {
    const unit = String(r?.target_unit || "").toLowerCase();
    return unit === "prayer" || unit === "prayers" || /five daily prayers|daily prayers|fajr|dhuhr|asr|maghrib|isha/i.test(r?.title || "");
  }

  function prayerPlan(p, routines = []) {
    return p?.template_key === "prayers" || /daily prayers|five daily prayers/i.test(p?.title || "") || routines.some(prayerRoutine);
  }

  async function getUser() {
    if (S.user) return S.user;
    const { data: { user } } = await db.auth.getUser();
    S.user = user || null;
    return S.user;
  }

  async function load(force = false) {
    if (S.busy || (!force && Date.now() - S.lastLoad < 1500)) return;
    const u = await getUser();
    if (!u) return;
    const cards = $$('.lm-plan-card').filter(c => c.querySelector('.lm-plan-timeline'));
    const ids = [...new Set(cards.map(planIdForCard).filter(Boolean))];
    if (!ids.length) return;
    S.busy = true;
    try {
      const [pr, rr] = await Promise.all([
        db.from('life_plans').select('id,user_id,title,template_key,start_date,end_date').in('id', ids),
        db.from('plan_routines').select('id,plan_id,title,target_unit,target_value').in('plan_id', ids)
      ]);
      if (pr.error || rr.error) return;
      const routines = rr.data || [];
      (pr.data || []).forEach(p => S.plans.set(p.id, p));
      routines.forEach(r => S.routines.set(r.id, r));
      const prayerPlans = (pr.data || []).filter(p => prayerPlan(p, routines.filter(r => r.plan_id === p.id)));
      const routineIds = routines.filter(r => prayerPlans.some(p => p.id === r.plan_id) && prayerRoutine(r)).map(r => r.id);
      if (!routineIds.length) { S.lastLoad = Date.now(); return; }
      const since = iso(addDays(new Date(), -400));
      const cr = await db.from('plan_checkins').select('id,plan_id,routine_id,user_id,scheduled_for,status,compliance_score,details').eq('user_id', u.id).in('routine_id', routineIds).gte('scheduled_for', since);
      if (!cr.error) {
        S.checks.clear();
        (cr.data || []).forEach(c => S.checks.set(checkKey(c.routine_id, c.scheduled_for), c));
      }
      S.lastLoad = Date.now();
    } finally { S.busy = false; }
  }

  function stateFor(check) {
    const raw = check?.details?.prayer_quality;
    const legacy = Array.isArray(check?.details?.subchecks) ? check.details.subchecks : null;
    return PRAYERS.map((label, i) => {
      const item = Array.isArray(raw) ? raw[i] : raw?.[label.toLowerCase()];
      const done = typeof item?.done === 'boolean' ? item.done : (legacy ? !!legacy[i] : (check?.status === 'done'));
      return {
        label,
        done,
        location: item?.location === 'mosque' || item?.location === 'home' ? item.location : null,
        sunnah: done && !!item?.sunnah,
        azkar: done && !!item?.azkar
      };
    });
  }

  function scoreOne(x) {
    if (!x.done) return 0;
    return WEIGHTS.prayer + (x.location === 'mosque' ? WEIGHTS.mosque : 0) + (x.sunnah ? WEIGHTS.sunnah : 0) + (x.azkar ? WEIGHTS.azkar : 0);
  }

  function dayLabel(score) {
    if (score >= 100) return 'Complete day';
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Strong';
    if (score >= 45) return 'Building';
    return score ? 'Keep going' : 'No prayer details recorded';
  }

  function decorate() {
    $$('.lm-plan-card').forEach(card => {
      const pid = planIdForCard(card), p = S.plans.get(pid);
      const routines = [...S.routines.values()].filter(r => r.plan_id === pid);
      if (!prayerPlan(p, routines)) return;
      const routine = routines.find(prayerRoutine);
      const start = parseISO(p?.start_date);
      const timeline = card.querySelector('.lm-plan-timeline');
      const dots = timeline ? $$('.lm-day-dot', timeline) : [];
      if (!routine || !start || !dots.length) return;
      dots.forEach((dot, i) => {
        const date = iso(addDays(start, i));
        dot.dataset.ptdPlan = pid;
        dot.dataset.ptdRoutine = routine.id;
        dot.dataset.ptdDate = date;
        dot.classList.add('ptd-clickable');
        dot.tabIndex = 0;
        const old = (dot.title || dot.getAttribute('aria-label') || dmy(date)).replace(/ — click to view prayer details$/,'');
        dot.title = `${old} — click to view prayer details`;
      });
      const legend = card.querySelector('.lm-plan-timeline-legend');
      if (legend && !card.querySelector('.ptd-hint')) legend.insertAdjacentHTML('afterend', '<div class="ptd-hint">Click any day to see Fajr–Isha details, location, Sunnah and Azkar.</div>');
    });
  }

  function openDetails(routineId, date) {
    $('#ptdModal')?.remove();
    const check = S.checks.get(checkKey(routineId, date));
    const items = stateFor(check);
    const done = items.filter(x => x.done).length;
    const score = items.reduce((s, x) => s + scoreOne(x), 0);
    const bg = document.createElement('div');
    bg.className = 'ptd-bg';
    bg.id = 'ptdModal';
    bg.innerHTML = `<section class="ptd-modal" role="dialog" aria-modal="true" aria-label="Prayer details for ${esc(dmy(date))}">
      <div class="ptd-head"><div><span>PRAYER DAY DETAILS</span><h2>${esc(dmy(date))}</h2><p>${done}/5 prayers recorded · private habit history</p></div><button type="button" class="ptd-x" data-ptd-close aria-label="Close">×</button></div>
      <div class="ptd-score"><div><small>MEDORA PRAYER HABIT SCORE</small><strong>${score}/100</strong></div><em>${esc(dayLabel(score))}</em></div>
      ${check ? `<div class="ptd-grid">${items.map(x => {
        const pts = scoreOne(x);
        const locationIcon = x.location === 'mosque' ? '🕌' : x.location === 'home' ? '🏠' : '—';
        const locationText = x.location === 'mosque' ? 'Mosque' : x.location === 'home' ? 'Home' : 'Location not recorded';
        return `<article class="ptd-prayer ${x.done ? 'done' : ''} ${x.location === 'mosque' ? 'mosque' : ''}">
          <div class="ptd-prayer-head"><strong>${esc(x.label)}</strong><span class="ptd-points">${pts}/20</span></div>
          <div class="ptd-row ${x.done ? 'ptd-yes' : 'ptd-no'}"><span class="ptd-icon">${x.done ? '✓' : '○'}</span><span>${x.done ? 'Prayer completed' : 'Not recorded'}</span></div>
          <div class="ptd-row ${x.location ? 'ptd-yes' : 'ptd-no'}"><span class="ptd-icon">${locationIcon}</span><span>${esc(locationText)}</span></div>
          <div class="ptd-row ${x.sunnah ? 'ptd-yes' : 'ptd-no'}"><span class="ptd-icon">✦</span><span>Sunnah ${x.sunnah ? '✓' : '—'}</span></div>
          <div class="ptd-row ${x.azkar ? 'ptd-yes' : 'ptd-no'}"><span class="ptd-icon">📿</span><span>Azkar ${x.azkar ? '✓' : '—'}</span></div>
        </article>`;
      }).join('')}</div>` : `<div class="ptd-empty">No prayer details were recorded for this day yet.</div>`}
      <div class="ptd-foot"><b>Plan compliance</b> counts whether the five prayers were completed. The separate <b>Medora prayer habit score</b> adds the recorded Home/Mosque, Sunnah and Azkar details; it is a habit-tracking score, not a religious judgment.</div>
    </section>`;
    document.body.appendChild(bg);
  }

  async function scan(force = false) { styles(); await load(force); decorate(); }

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => scan(false), 120); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    const dot = e.target.closest('[data-ptd-routine][data-ptd-date]');
    if (dot) { e.preventDefault(); e.stopPropagation(); openDetails(dot.dataset.ptdRoutine, dot.dataset.ptdDate); return; }
    if (e.target.closest('[data-ptd-close]') || (e.target.id === 'ptdModal')) $('#ptdModal')?.remove();
  }, true);
  document.addEventListener('keydown', e => {
    const dot = e.target.closest?.('[data-ptd-routine][data-ptd-date]');
    if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetails(dot.dataset.ptdRoutine, dot.dataset.ptdDate); }
    if (e.key === 'Escape') $('#ptdModal')?.remove();
  }, true);
  document.addEventListener('medora:plan-checkin-updated', () => { S.lastLoad = 0; setTimeout(() => scan(true), 120); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(true), { once: true }); else scan(true);
})();
