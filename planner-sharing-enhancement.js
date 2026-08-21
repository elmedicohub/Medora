(() => {
  "use strict";

  if (window.__MEDORA_PLANNER_SHARING_ENHANCEMENT__) return;
  window.__MEDORA_PLANNER_SHARING_ENHANCEMENT__ = true;

  const cfg = window.MEDORA_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let cachedPeople = null;
  let pendingAutoShare = null;
  let scanTimer = null;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function addStyles() {
    if ($("#plannerSharingEnhancementStyle")) return;
    const style = document.createElement("style");
    style.id = "plannerSharingEnhancementStyle";
    style.textContent = `
      .lm-days button.active{
        border-color:#79cba9!important;
        background:#e9f8f1!important;
        color:#157653!important;
        box-shadow:0 0 0 3px rgba(45,167,117,.07)!important;
      }
      .lm-share-picker{display:grid;gap:9px;padding:12px;border:1px solid #dfe7e3;border-radius:14px;background:#fbfdfc}
      .lm-share-picker.hidden{display:none!important}
      .lm-share-picker-title{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .lm-share-picker-title strong{font-size:11px;color:#445266}
      .lm-share-picker-title small{color:#7e8998;font-size:9px;font-weight:600}
      .lm-share-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .lm-share-person{display:flex!important;grid-template-columns:none!important;align-items:center;gap:9px!important;min-height:48px;padding:9px 10px;border:1px solid #e2e8e5;border-radius:12px;background:#fff;cursor:pointer}
      .lm-share-person input{width:17px!important;min-height:17px!important;height:17px!important;padding:0!important;accent-color:#2fa875;box-shadow:none!important}
      .lm-share-person span{display:grid;gap:2px;min-width:0}
      .lm-share-person b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#354357;font-size:11px}
      .lm-share-person small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#84909f;font-size:9px;font-weight:500}
      .lm-share-person:has(input:checked){border-color:#82cfae;background:#eef9f4}
      .lm-share-none{padding:10px;border:1px dashed #dfe6e2;border-radius:11px;color:#798695;font-size:10px;text-align:center}
      .lm-share-summary{background:#eef9f4!important;color:#267759!important}
      .lm-share-modal-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .lm-share-mode-card{position:relative;display:block!important;padding:13px!important;border:1px solid #e0e6ee;border-radius:13px;background:#fff;cursor:pointer}
      .lm-share-mode-card input{position:absolute;opacity:0;pointer-events:none}
      .lm-share-mode-card b,.lm-share-mode-card small{display:block}
      .lm-share-mode-card b{color:#3e4c60;font-size:11px}
      .lm-share-mode-card small{margin-top:4px;color:#7f8998;font-size:9px;font-weight:500;line-height:1.4}
      .lm-share-mode-card:has(input:checked){border-color:#82cfae;background:#eef9f4;box-shadow:0 0 0 3px rgba(47,168,117,.06)}
      @media(max-width:620px){.lm-share-people,.lm-share-modal-mode{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function getPeople() {
    if (cachedPeople) return cachedPeople;
    const { data: { user } } = await db.auth.getUser();
    if (!user) return [];

    const { data: connections, error: cErr } = await db
      .from("connections")
      .select("requester_id,addressee_id,status")
      .eq("status", "accepted");
    if (cErr) return [];

    const ids = [...new Set((connections || []).map(c =>
      c.requester_id === user.id ? c.addressee_id : c.requester_id
    ).filter(Boolean).filter(id => id !== user.id))];

    if (!ids.length) {
      cachedPeople = [];
      return cachedPeople;
    }

    const { data: profiles } = await db
      .from("public_profiles")
      .select("user_id,display_name,username,headline,is_visible")
      .in("user_id", ids);

    cachedPeople = ids.map(id => {
      const p = (profiles || []).find(x => x.user_id === id) || {};
      return {
        id,
        name: p.display_name || p.username || "Medora connection",
        username: p.username || "",
        headline: p.headline || ""
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return cachedPeople;
  }

  function reorderDays(form) {
    const row = $(".lm-days", form);
    if (!row || row.dataset.satFirst === "1") return;
    row.dataset.satFirst = "1";
    const order = [6, 0, 1, 2, 3, 4, 5];
    const map = new Map($$("[data-day]", row).map(b => [Number(b.dataset.day), b]));
    order.forEach(day => {
      const button = map.get(day);
      if (button) row.appendChild(button);
    });
  }

  function setModeLabels(select) {
    if (!select || select.dataset.enhancedLabels === "1") return;
    select.dataset.enhancedLabels = "1";
    const labels = {
      private: "Private — only me",
      accountability: "Share progress — choose people",
      together: "Do it together — choose people"
    };
    [...select.options].forEach(o => {
      if (labels[o.value]) o.textContent = labels[o.value];
    });
    const label = select.closest("label");
    if (label?.childNodes?.length && label.childNodes[0].nodeType === Node.TEXT_NODE) {
      label.childNodes[0].nodeValue = "Plan mode\n            ";
    }
  }

  function peopleMarkup(people, selected = []) {
    if (!people.length) {
      return `<div class="lm-share-none">No accepted connections yet. Add people from the People page first.</div>`;
    }
    const set = new Set(selected);
    return `<div class="lm-share-people">${people.map(p => `
      <label class="lm-share-person">
        <input type="checkbox" value="${p.id}" ${set.has(p.id) ? "checked" : ""}>
        <span><b>${esc(p.name)}</b><small>${esc(p.headline || (p.username ? "@" + p.username : "Medora connection"))}</small></span>
      </label>
    `).join("")}</div>`;
  }

  async function addCreationPeoplePicker(form) {
    const select = $("#lmVisibility", form);
    if (!select || form.dataset.multiShareEnhanced === "1") return;
    form.dataset.multiShareEnhanced = "1";
    setModeLabels(select);
    reorderDays(form);

    const label = select.closest("label");
    const picker = document.createElement("div");
    picker.className = "lm-share-picker hidden";
    picker.innerHTML = `
      <div class="lm-share-picker-title"><strong>Choose people</strong><small>You can select more than one</small></div>
      <div class="lm-share-none">Loading your connections…</div>
    `;
    label?.insertAdjacentElement("afterend", picker);

    const people = await getPeople();
    picker.innerHTML = `
      <div class="lm-share-picker-title"><strong>Choose people</strong><small>Select one or several</small></div>
      ${peopleMarkup(people)}
    `;

    const sync = () => picker.classList.toggle("hidden", select.value === "private");
    sync();
    select.addEventListener("change", sync);

    form.addEventListener("submit", e => {
      const mode = select.value;
      if (mode === "private") return;
      const selected = $$('input[type="checkbox"]:checked', picker).map(x => x.value);
      if (!selected.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert(mode === "together" ? "Choose at least one person to do this plan together." : "Choose at least one person to share this plan with.");
        return;
      }

      pendingAutoShare = {
        mode,
        userIds: selected,
        title: $("#lmPlanTitle", form)?.value.trim() || "",
        stamp: Date.now(),
        expires: Date.now() + 12000
      };
      setTimeout(syncNewPlanParticipants, 250);
    }, true);
  }

  async function syncNewPlanParticipants() {
    const pending = pendingAutoShare;
    if (!pending || !pending.title) return;
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;

    for (let i = 0; i < 22; i++) {
      if (!pendingAutoShare || Date.now() > pending.expires) break;
      await new Promise(r => setTimeout(r, 250));
      const q = await db.from("life_plans")
        .select("id,title,created_at,visibility")
        .eq("user_id", user.id)
        .eq("title", pending.title)
        .order("created_at", { ascending: false })
        .limit(3);
      if (q.error) continue;

      const plan = (q.data || []).find(p => new Date(p.created_at).getTime() >= pending.stamp - 2500);
      if (!plan) continue;

      const rows = pending.userIds.map(userId => ({
        plan_id: plan.id,
        user_id: userId,
        role: "partner",
        share_level: pending.mode === "together" ? "detailed" : "progress"
      }));

      const { error } = await db.from("plan_participants").upsert(rows, { onConflict: "plan_id,user_id" });
      if (!error) {
        if (plan.visibility !== pending.mode) {
          await db.from("life_plans").update({ visibility: pending.mode }).eq("id", plan.id).eq("user_id", user.id);
        }
        pendingAutoShare = null;
        setTimeout(decoratePlanCards, 120);
        return;
      }
    }
  }

  async function openMultiShareModal(planId) {
    const host = $("#lmModal");
    if (!host) return;

    const [people, existingQ, planQ] = await Promise.all([
      getPeople(),
      db.from("plan_participants").select("user_id,share_level,role").eq("plan_id", planId),
      db.from("life_plans").select("id,title,visibility,user_id").eq("id", planId).single()
    ]);

    const plan = planQ.data;
    if (!plan) return;
    const existing = (existingQ.data || []).map(x => x.user_id);
    const mode = plan.visibility === "together" ? "together" : "accountability";

    host.innerHTML = `<div class="lm-modal-backdrop">
      <section class="lm-modal-card">
        <div class="lm-modal-head">
          <div><span>SHARE PLAN</span><h2>${esc(plan.title)}</h2></div>
          <button type="button" data-multi-close>×</button>
        </div>
        <form id="lmMultiShareForm" class="lm-form">
          <label>How do you want to involve them?</label>
          <div class="lm-share-modal-mode">
            <label class="lm-share-mode-card"><input type="radio" name="lmShareModeMulti" value="accountability" ${mode === "accountability" ? "checked" : ""}><b>Share progress</b><small>They can follow your compliance and encourage you.</small></label>
            <label class="lm-share-mode-card"><input type="radio" name="lmShareModeMulti" value="together" ${mode === "together" ? "checked" : ""}><b>Do it together</b><small>Everyone completes the same plan and compares progress.</small></label>
          </div>
          <div class="lm-share-picker">
            <div class="lm-share-picker-title"><strong>Choose people</strong><small>Select one or several</small></div>
            ${peopleMarkup(people, existing)}
          </div>
          <div class="lm-modal-actions">
            <button type="button" class="lm-cancel" data-multi-close>Cancel</button>
            <button class="lm-save" type="submit">Save sharing →</button>
          </div>
        </form>
      </section>
    </div>`;

    $$('[data-multi-close]', host).forEach(b => b.addEventListener("click", () => host.innerHTML = ""));
    $("#lmMultiShareForm", host)?.addEventListener("submit", async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const selected = $$('input[type="checkbox"]:checked', form).map(x => x.value);
      const shareMode = $('input[name="lmShareModeMulti"]:checked', form)?.value || "accountability";
      if (!selected.length) {
        alert(shareMode === "together" ? "Choose at least one person to do this plan together." : "Choose at least one person to share this plan with.");
        return;
      }

      const save = $(".lm-save", form);
      if (save) { save.disabled = true; save.textContent = "Saving…"; }

      const removed = existing.filter(id => !selected.includes(id));
      if (removed.length) {
        const del = await db.from("plan_participants").delete().eq("plan_id", planId).in("user_id", removed);
        if (del.error) { alert(del.error.message); if(save){save.disabled=false;save.textContent="Save sharing →";} return; }
      }

      const rows = selected.map(userId => ({
        plan_id: planId,
        user_id: userId,
        role: "partner",
        share_level: shareMode === "together" ? "detailed" : "progress"
      }));
      const up = await db.from("plan_participants").upsert(rows, { onConflict: "plan_id,user_id" });
      if (up.error) { alert(up.error.message); if(save){save.disabled=false;save.textContent="Save sharing →";} return; }

      const upd = await db.from("life_plans").update({ visibility: shareMode }).eq("id", planId).eq("user_id", plan.user_id);
      if (upd.error) { alert(upd.error.message); if(save){save.disabled=false;save.textContent="Save sharing →";} return; }

      host.innerHTML = "";
      setTimeout(decoratePlanCards, 100);
    });
  }

  async function decoratePlanCards() {
    const cards = $$(".lm-plan-card").filter(c => c.querySelector("[data-share]"));
    if (!cards.length) return;
    const ids = cards.map(c => c.querySelector("[data-share]")?.dataset.share).filter(Boolean);
    if (!ids.length) return;

    const [plansQ, participantsQ] = await Promise.all([
      db.from("life_plans").select("id,visibility").in("id", ids),
      db.from("plan_participants").select("plan_id,user_id").in("plan_id", ids)
    ]);
    if (plansQ.error || participantsQ.error) return;

    cards.forEach(card => {
      const id = card.querySelector("[data-share]")?.dataset.share;
      const button = card.querySelector("[data-share]");
      if (button) button.textContent = "Share / do together";
      const meta = $(".lm-meta", card);
      if (!id || !meta) return;
      const count = (participantsQ.data || []).filter(p => p.plan_id === id).length;
      const plan = (plansQ.data || []).find(p => p.id === id);
      let chip = $(".lm-share-summary", meta);
      if (!count) {
        chip?.remove();
        return;
      }
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "lm-share-summary";
        meta.appendChild(chip);
      }
      chip.textContent = plan?.visibility === "together"
        ? `Together with ${count}`
        : `Shared with ${count}`;
    });
  }

  function suppressLegacyAutoShareModal() {
    if (!pendingAutoShare) return false;
    if (Date.now() > pendingAutoShare.expires) {
      pendingAutoShare = null;
      return false;
    }
    const legacy = $("#lmShareForm");
    const host = $("#lmModal");
    if (legacy && host) {
      host.innerHTML = "";
      return true;
    }
    return false;
  }

  async function scan() {
    addStyles();
    const form = $("#lmPlanForm");
    if (form) {
      reorderDays(form);
      await addCreationPeoplePicker(form);
    }
    suppressLegacyAutoShareModal();
    decoratePlanCards();
  }

  document.addEventListener("click", e => {
    const share = e.target.closest("[data-share]");
    if (!share) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openMultiShareModal(share.dataset.share);
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 20);
  });

  function init() {
    addStyles();
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();