(() => {
  "use strict";

  const config = window.MEDORA_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif">Medora configuration is missing.</div>';
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const state = {
    session: null,
    user: null,
    profile: null,
    professional: null,
    goals: [],
    tasks: [],
    achievements: [],
    circles: [],
    notifications: [],
    currentScreen: "day"
  };

  const el = (id) => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));

  const formatDate = (value, opts = {}) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...opts
    }).format(date);
  };

  const formatTime = (value) => {
    if (!value) return "No time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No time";
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfToday = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const isDueToday = (dueAt) => {
    if (!dueAt) return false;
    const d = new Date(dueAt);
    return d >= startOfToday() && d <= endOfToday();
  };

  const initials = (name = "") => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((x) => x[0]?.toUpperCase()).join("") || "M";
  };

  let toastTimer;
  function toast(message, type = "") {
    const node = el("toast");
    if (!node) return;
    clearTimeout(toastTimer);
    node.textContent = message;
    node.className = `toast show ${type}`.trim();
    toastTimer = setTimeout(() => {
      node.className = "toast";
    }, 3200);
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.textContent = label || "Working…";
    } else {
      button.disabled = false;
      if (button.dataset.original) button.innerHTML = button.dataset.original;
    }
  }

  function showAuth(mode = "signin") {
    el("appView").classList.add("hidden");
    el("authView").classList.remove("hidden");
    switchAuth(mode);
  }

  function showApp() {
    el("authView").classList.add("hidden");
    el("appView").classList.remove("hidden");
  }

  function switchAuth(mode) {
    const signIn = mode === "signin";
    el("showSignIn").classList.toggle("active", signIn);
    el("showSignUp").classList.toggle("active", !signIn);
    el("signInForm").classList.toggle("hidden", !signIn);
    el("signUpForm").classList.toggle("hidden", signIn);
    el("authTitle").textContent = signIn ? "Welcome back" : "Create your Medora";
    el("authSubtitle").textContent = signIn
      ? "Sign in to continue your day."
      : "A calm place for your goals, time and people.";
    const message = el("authMessage");
    message.textContent = "";
    message.className = "form-message";
  }

  async function signIn(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Signing in…");

    const { error } = await db.auth.signInWithPassword({
      email: el("signInEmail").value.trim(),
      password: el("signInPassword").value
    });

    setLoading(button, false);

    if (error) {
      const message = el("authMessage");
      message.textContent = error.message;
      message.className = "form-message error";
    }
  }

  async function signUp(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Creating account…");

    const name = el("signUpName").value.trim();
    const { data, error } = await db.auth.signUp({
      email: el("signUpEmail").value.trim(),
      password: el("signUpPassword").value,
      options: {
        data: { display_name: name, full_name: name }
      }
    });

    setLoading(button, false);
    const message = el("authMessage");

    if (error) {
      message.textContent = error.message;
      message.className = "form-message error";
      return;
    }

    if (!data.session) {
      message.textContent = "Account created. Check your email to confirm your address, then return here to sign in.";
      message.className = "form-message success";
      return;
    }

    message.textContent = "Welcome to Medora.";
    message.className = "form-message success";
  }

  async function loadData() {
    if (!state.user) return;

    const uid = state.user.id;
    const [profileRes, professionalRes, goalsRes, tasksRes, achievementsRes, circlesRes, notificationsRes] =
      await Promise.all([
        db.from("profiles").select("*").eq("id", uid).maybeSingle(),
        db.from("professional_profiles").select("*").eq("user_id", uid).maybeSingle(),
        db.from("goals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        db.from("tasks").select("*").eq("user_id", uid).order("due_at", { ascending: true, nullsFirst: false }),
        db.from("achievements").select("*").eq("user_id", uid).order("achieved_on", { ascending: false }),
        db.from("circles").select("*").order("created_at", { ascending: false }),
        db.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(25)
      ]);

    const failures = [profileRes, professionalRes, goalsRes, tasksRes, achievementsRes, circlesRes, notificationsRes]
      .filter((x) => x.error);

    if (failures.length) {
      console.warn("Medora load warnings:", failures.map((x) => x.error));
    }

    state.profile = profileRes.data || null;
    state.professional = professionalRes.data || null;
    state.goals = goalsRes.data || [];
    state.tasks = tasksRes.data || [];
    state.achievements = achievementsRes.data || [];
    state.circles = circlesRes.data || [];
    state.notifications = notificationsRes.data || [];

    updateIdentityUI();

    if (state.profile && !state.profile.onboarding_completed) {
      openOnboarding();
    } else {
      closeOnboarding();
    }

    renderScreen();
  }

  function updateIdentityUI() {
    const displayName =
      state.profile?.display_name ||
      state.user?.user_metadata?.display_name ||
      state.user?.user_metadata?.full_name ||
      state.user?.email?.split("@")[0] ||
      "Medora user";

    el("avatarInitials").textContent = initials(displayName);
  }

  async function bootSession(session) {
    state.session = session;
    state.user = session?.user || null;

    if (!state.user) {
      state.profile = null;
      showAuth("signin");
      return;
    }

    showApp();
    await loadData();
  }

  function openOnboarding() {
    if (!state.profile) return;
    el("onboardName").value = state.profile.display_name || "";
    el("onboardUsername").value = state.profile.username || "";
    el("onboardCity").value = state.profile.city || "";
    el("onboardCountry").value = state.profile.country || "";
    el("onboardProfession").value = state.professional?.profession || "";
    el("onboardCareerStage").value = state.professional?.career_stage || "";
    el("onboardSpecialty").value = state.professional?.specialty || "";
    el("onboardInstitution").value = state.professional?.institution || "";
    el("onboardInterests").value = (state.professional?.interests || []).join(", ");
    showOnboardingStep(1);
    el("onboardingModal").classList.remove("hidden");
  }

  function closeOnboarding() {
    el("onboardingModal").classList.add("hidden");
  }

  function showOnboardingStep(step) {
    [1, 2, 3].forEach((n) => {
      el(`onboardingStep${n}`).classList.toggle("hidden", n !== step);
    });
    qsa(".progress-dot").forEach((dot, index) => {
      dot.classList.toggle("active", index < step);
    });
  }

  async function finishOnboarding() {
    const button = el("finishOnboarding");
    setLoading(button, true, "Saving your Medora…");

    const profilePayload = {
      display_name: el("onboardName").value.trim(),
      username: el("onboardUsername").value.trim() || null,
      city: el("onboardCity").value.trim() || null,
      country: el("onboardCountry").value.trim() || null,
      onboarding_completed: true
    };

    const interests = el("onboardInterests").value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);

    const professionalPayload = {
      user_id: state.user.id,
      profession: el("onboardProfession").value.trim() || null,
      career_stage: el("onboardCareerStage").value.trim() || null,
      specialty: el("onboardSpecialty").value.trim() || null,
      institution: el("onboardInstitution").value.trim() || null,
      interests
    };

    const profileResult = await db
      .from("profiles")
      .update(profilePayload)
      .eq("id", state.user.id)
      .select()
      .single();

    if (profileResult.error) {
      setLoading(button, false);
      toast(profileResult.error.message, "error");
      return;
    }

    const professionalResult = await db
      .from("professional_profiles")
      .upsert(professionalPayload, { onConflict: "user_id" })
      .select()
      .single();

    setLoading(button, false);

    if (professionalResult.error) {
      toast(professionalResult.error.message, "error");
      return;
    }

    state.profile = profileResult.data;
    state.professional = professionalResult.data;
    closeOnboarding();
    updateIdentityUI();
    toast("Your Medora is ready.", "success");
    renderScreen();
  }

  const screenMeta = {
    day: ["MY DAY", "Your day, clearly."],
    planner: ["PLANNER", "Make the next move obvious."],
    goals: ["GOALS", "Turn ambition into progress."],
    people: ["PEOPLE", "Grow with the right people."],
    progress: ["PROGRESS", "See how far you have come."],
    profile: ["PROFILE", "Your Medora, your way."]
  };

  function navigate(screen) {
    if (!screenMeta[screen]) return;
    state.currentScreen = screen;

    qsa(".nav-item[data-screen]").forEach((item) =>
      item.classList.toggle("active", item.dataset.screen === screen)
    );
    qsa(".mobile-nav-item[data-screen]").forEach((item) =>
      item.classList.toggle("active", item.dataset.screen === screen)
    );

    el("topbarKicker").textContent = screenMeta[screen][0];
    el("topbarTitle").textContent = screenMeta[screen][1];
    renderScreen();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderScreen() {
    const container = el("screenContainer");
    if (!container) return;

    const renderers = {
      day: renderDay,
      planner: renderPlanner,
      goals: renderGoals,
      people: renderPeople,
      progress: renderProgress,
      profile: renderProfile
    };

    container.innerHTML = renderers[state.currentScreen]?.() || renderDay();
    bindScreenEvents();
  }

  function displayName() {
    return (
      state.profile?.display_name ||
      state.user?.user_metadata?.display_name ||
      state.user?.email?.split("@")[0] ||
      "there"
    );
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function activeGoals() {
    return state.goals.filter((g) => g.status === "active");
  }

  function openTasks() {
    return state.tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  }

  function completedThisWeek() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return state.tasks.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= weekAgo).length;
  }

  function renderDay() {
    const todaysTasks = openTasks()
      .filter((t) => isDueToday(t.due_at))
      .sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0));

    const nextTask = openTasks()
      .filter((t) => !t.due_at || new Date(t.due_at) >= new Date())
      .sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at);
      })[0];

    const focusGoal = activeGoals().sort((a, b) => b.progress - a.progress)[0];

    return `
      <section class="screen">
        <div class="hero-row">
          <article class="hero-card">
            <span class="eyebrow light">${escapeHtml(greeting().toUpperCase())}</span>
            <h1>${escapeHtml(displayName())}, what matters most today?</h1>
            <p>
              ${nextTask
                ? `Your next open item is <strong>${escapeHtml(nextTask.title)}</strong>${nextTask.due_at ? ` at ${escapeHtml(formatTime(nextTask.due_at))}` : ""}.`
                : "Your day is open. Choose one meaningful next step and give it your attention."}
            </p>
            <div class="hero-actions">
              <button class="hero-action primary" data-open-quick-task>Add a task</button>
              <button class="hero-action" data-go="goals">Review goals</button>
              <button class="hero-action" data-go="people">Your people</button>
            </div>
          </article>

          <div class="stats-stack">
            <article class="stat-card">
              <div><strong>${activeGoals().length}</strong><span>Active goals</span></div>
              <div class="stat-symbol">◎</div>
            </article>
            <article class="stat-card">
              <div><strong>${todaysTasks.length}</strong><span>Due today</span></div>
              <div class="stat-symbol">▦</div>
            </article>
            <article class="stat-card">
              <div><strong>${completedThisWeek()}</strong><span>Done this week</span></div>
              <div class="stat-symbol">↗</div>
            </article>
          </div>
        </div>

        <div class="dashboard-grid">
          <article class="panel">
            <div class="panel-header">
              <div><h3>Today</h3><p>${formatDate(new Date(), { weekday: "long", year: "numeric" })}</p></div>
              <button class="link-button" data-go="planner">Open planner</button>
            </div>
            ${todaysTasks.length ? `
              <div class="task-list">
                ${todaysTasks.map(taskListItem).join("")}
              </div>
            ` : emptyState("A clear day so far", "Add a task when something deserves a place in your day.")}
          </article>

          <article class="panel">
            <div class="panel-header">
              <div><h3>Goal in focus</h3><p>Your strongest active thread.</p></div>
              <button class="link-button" data-go="goals">All goals</button>
            </div>
            ${focusGoal ? `
              <div class="focus-goal">
                <div class="focus-goal-title">
                  <div>
                    <strong>${escapeHtml(focusGoal.title)}</strong>
                    <span>${escapeHtml(focusGoal.category || "Personal goal")}</span>
                  </div>
                  <span>${focusGoal.progress}%</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width:${focusGoal.progress}%"></div></div>
                <small style="color:#8a93a4">
                  ${focusGoal.target_date ? `Target ${escapeHtml(formatDate(focusGoal.target_date))}` : "No target date — progress at your pace."}
                </small>
              </div>
            ` : emptyState("No active goal yet", "Add one clear goal and Medora will keep it visible.")}
          </article>
        </div>
      </section>
    `;
  }

  function taskListItem(task) {
    const priorityClass = task.priority >= 4 ? "critical" : task.priority >= 3 ? "high" : "";
    return `
      <div class="task-item ${task.status === "done" ? "done" : ""}">
        <button class="task-check ${task.status === "done" ? "done" : ""}" data-toggle-task="${task.id}" aria-label="Toggle task"></button>
        <div class="task-copy">
          <strong>${escapeHtml(task.title)}</strong>
          <small>${task.due_at ? `${escapeHtml(formatDate(task.due_at))} · ${escapeHtml(formatTime(task.due_at))}` : "No due time"}</small>
        </div>
        <span class="pill ${priorityClass}">${["", "Low", "Normal", "High", "Critical"][task.priority] || "Normal"}</span>
      </div>
    `;
  }

  function emptyState(title, text) {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></div>`;
  }

  function renderPlanner() {
    const sorted = [...state.tasks].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at) - new Date(b.due_at);
    });

    return `
      <section class="screen">
        <div class="screen-heading">
          <div>
            <span class="eyebrow">PLANNER</span>
            <h1>Plan what is worth doing.</h1>
            <p>Keep tasks light, specific and connected to the life you are actually living.</p>
          </div>
        </div>

        <article class="panel form-panel">
          <form id="plannerTaskForm" class="inline-form">
            <label><span>Task</span><input id="plannerTaskTitle" required maxlength="160" placeholder="Add your next action" /></label>
            <label><span>Due</span><input id="plannerTaskDue" type="datetime-local" /></label>
            <label><span>Priority</span>
              <select id="plannerTaskPriority">
                <option value="1">Low</option><option value="2" selected>Normal</option><option value="3">High</option><option value="4">Critical</option>
              </select>
            </label>
            <button class="primary-button" type="submit">Add <span>→</span></button>
          </form>
        </article>

        <div class="task-list">
          ${sorted.length ? sorted.map((task) => `
            <article class="task-card">
              <div class="card-row">
                <div>
                  <h3>${escapeHtml(task.title)}</h3>
                  <p>${task.notes ? escapeHtml(task.notes) : "A clear next action."}</p>
                  <div class="meta-row">
                    <span class="pill">${escapeHtml(task.status.replace("_", " "))}</span>
                    <span class="pill">${task.due_at ? `${escapeHtml(formatDate(task.due_at))} · ${escapeHtml(formatTime(task.due_at))}` : "No due date"}</span>
                    ${task.goal_id ? `<span class="pill">Linked to goal</span>` : ""}
                  </div>
                </div>
                <div class="card-actions">
                  <button class="ghost-button" data-toggle-task="${task.id}">${task.status === "done" ? "Reopen" : "Done"}</button>
                  <button class="danger-button" data-delete-task="${task.id}">Delete</button>
                </div>
              </div>
            </article>
          `).join("") : emptyState("Your planner is clear", "Add the next action that deserves your attention.")}
        </div>
      </section>
    `;
  }

  function renderGoals() {
    return `
      <section class="screen">
        <div class="screen-heading">
          <div>
            <span class="eyebrow">GOALS</span>
            <h1>Keep the big picture close.</h1>
            <p>Goals should guide your week, not become another source of noise.</p>
          </div>
        </div>

        <article class="panel form-panel">
          <form id="goalForm" class="inline-form goal-form">
            <label><span>Goal</span><input id="goalTitle" required maxlength="180" placeholder="What are you moving toward?" /></label>
            <label><span>Category</span><input id="goalCategory" maxlength="80" placeholder="Career, study, health..." /></label>
            <label><span>Target date</span><input id="goalTarget" type="date" /></label>
            <button class="primary-button" type="submit">Create <span>→</span></button>
          </form>
        </article>

        <div class="goal-list">
          ${state.goals.length ? state.goals.map((goal) => `
            <article class="goal-card">
              <div class="card-row">
                <div>
                  <h3>${escapeHtml(goal.title)}</h3>
                  <p>${escapeHtml(goal.description || "A goal worth keeping visible.")}</p>
                  <div class="meta-row">
                    <span class="pill ${goal.status === "completed" ? "success" : ""}">${escapeHtml(goal.status)}</span>
                    ${goal.category ? `<span class="pill">${escapeHtml(goal.category)}</span>` : ""}
                    ${goal.target_date ? `<span class="pill">Target ${escapeHtml(formatDate(goal.target_date))}</span>` : ""}
                  </div>
                </div>
                <div class="card-actions">
                  <button class="ghost-button" data-complete-goal="${goal.id}">${goal.status === "completed" ? "Reopen" : "Complete"}</button>
                  <button class="danger-button" data-delete-goal="${goal.id}">Delete</button>
                </div>
              </div>
              <div class="goal-progress-row">
                <input type="range" min="0" max="100" value="${goal.progress}" data-goal-progress="${goal.id}" aria-label="Goal progress" />
                <strong data-progress-label="${goal.id}">${goal.progress}%</strong>
              </div>
            </article>
          `).join("") : emptyState("No goals yet", "Create one goal that would make the next few months meaningfully better.")}
        </div>
      </section>
    `;
  }

  function renderPeople() {
    return `
      <section class="screen">
        <article class="people-intro">
          <span class="eyebrow light">YOUR PEOPLE</span>
          <h2>Progress is rarely a solo project.</h2>
          <p>Create circles for the people you study with, work with, learn from, or simply want to stay close to.</p>
        </article>

        <div class="dashboard-grid">
          <article class="panel">
            <div class="panel-header">
              <div><h3>Your circles</h3><p>Small groups around what matters.</p></div>
            </div>

            <form id="circleForm" class="settings-form" style="margin-bottom:18px">
              <div class="two-col">
                <label><span>Circle name</span><input id="circleName" required maxlength="100" placeholder="Research group, study partners..." /></label>
                <label><span>Description</span><input id="circleDescription" maxlength="180" placeholder="What brings this group together?" /></label>
              </div>
              <button class="primary-button" type="submit">Create circle <span>→</span></button>
            </form>

            <div class="circle-list">
              ${state.circles.length ? state.circles.map((circle) => `
                <article class="circle-card">
                  <div class="card-row">
                    <div>
                      <h3>${escapeHtml(circle.name)}</h3>
                      <p>${escapeHtml(circle.description || "Your Medora circle.")}</p>
                    </div>
                    <span class="pill">${circle.is_private ? "Private" : "Visible"}</span>
                  </div>
                </article>
              `).join("") : emptyState("No circles yet", "Create a private circle for the people who share part of your path.")}
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <div><h3>Connection layer</h3><p>Built privacy-first.</p></div>
            </div>
            <div class="empty-state">
              <strong>Discovery is intentionally not open yet</strong>
              <small>
                The foundation is ready, but Medora will only expose searchable profiles after the visibility and consent rules are completed.
              </small>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderProgress() {
    return `
      <section class="screen">
        <div class="screen-heading">
          <div>
            <span class="eyebrow">PROGRESS</span>
            <h1>Notice what you are becoming.</h1>
            <p>Progress is more than completed tasks. Save meaningful milestones so they do not disappear into the calendar.</p>
          </div>
        </div>

        <div class="split-grid">
          <article class="panel">
            <div class="panel-header"><div><h3>Add an achievement</h3><p>Something worth remembering.</p></div></div>
            <form id="achievementForm" class="settings-form">
              <label><span>Achievement</span><input id="achievementTitle" required maxlength="180" placeholder="What did you accomplish?" /></label>
              <label><span>Description</span><textarea id="achievementDescription" rows="3" maxlength="800" placeholder="Why did it matter?"></textarea></label>
              <label><span>Date</span><input id="achievementDate" type="date" /></label>
              <button class="primary-button" type="submit">Save milestone <span>→</span></button>
            </form>
          </article>

          <article class="panel">
            <div class="panel-header"><div><h3>Snapshot</h3><p>Your current Medora pulse.</p></div></div>
            <div class="stats-stack">
              <article class="stat-card"><div><strong>${state.achievements.length}</strong><span>Milestones</span></div><div class="stat-symbol">★</div></article>
              <article class="stat-card"><div><strong>${state.tasks.filter(t => t.status === "done").length}</strong><span>Tasks completed</span></div><div class="stat-symbol">✓</div></article>
              <article class="stat-card"><div><strong>${state.goals.filter(g => g.status === "completed").length}</strong><span>Goals achieved</span></div><div class="stat-symbol">◎</div></article>
            </div>
          </article>
        </div>

        <div class="achievement-list" style="margin-top:18px">
          ${state.achievements.length ? state.achievements.map((item) => `
            <article class="achievement-card">
              <div class="card-row">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.description || "A Medora milestone.")}</p>
                  <div class="meta-row"><span class="pill success">${escapeHtml(formatDate(item.achieved_on, { year: "numeric" }))}</span></div>
                </div>
                <button class="danger-button" data-delete-achievement="${item.id}">Delete</button>
              </div>
            </article>
          `).join("") : emptyState("Your milestones will live here", "Save the moments that mark genuine progress.")}
        </div>
      </section>
    `;
  }

  function renderProfile() {
    const p = state.profile || {};
    const pro = state.professional || {};

    return `
      <section class="screen">
        <div class="screen-heading">
          <div>
            <span class="eyebrow">PROFILE</span>
            <h1>${escapeHtml(displayName())}</h1>
            <p>${escapeHtml(pro.specialty || pro.profession || "Build a profile that reflects your path.")}</p>
          </div>
          <div class="screen-actions">
            <button class="ghost-button" data-signout>Sign out</button>
          </div>
        </div>

        <div class="profile-grid">
          <article class="panel">
            <div class="panel-header"><div><h3>Personal profile</h3><p>Your basic Medora identity.</p></div></div>
            <form id="profileForm" class="settings-form">
              <label><span>Display name</span><input id="profileName" value="${escapeHtml(p.display_name || "")}" maxlength="80" required /></label>
              <label><span>Username</span><input id="profileUsername" value="${escapeHtml(p.username || "")}" maxlength="30" placeholder="your_username" /></label>
              <label><span>Headline</span><input id="profileHeadline" value="${escapeHtml(p.headline || "")}" maxlength="180" placeholder="A short line about your current path" /></label>
              <label><span>Bio</span><textarea id="profileBio" rows="4" maxlength="1000">${escapeHtml(p.bio || "")}</textarea></label>
              <div class="two-col">
                <label><span>City</span><input id="profileCity" value="${escapeHtml(p.city || "")}" /></label>
                <label><span>Country</span><input id="profileCountry" value="${escapeHtml(p.country || "")}" /></label>
              </div>
              <button class="primary-button" type="submit">Save profile <span>→</span></button>
            </form>
          </article>

          <article class="panel">
            <div class="panel-header"><div><h3>Professional profile</h3><p>Your work and learning context.</p></div></div>
            <form id="professionalForm" class="settings-form">
              <div class="two-col">
                <label><span>Profession</span><input id="profileProfession" value="${escapeHtml(pro.profession || "")}" /></label>
                <label><span>Career stage</span><input id="profileCareerStage" value="${escapeHtml(pro.career_stage || "")}" /></label>
              </div>
              <label><span>Specialty</span><input id="profileSpecialty" value="${escapeHtml(pro.specialty || "")}" /></label>
              <label><span>Subspecialty</span><input id="profileSubspecialty" value="${escapeHtml(pro.subspecialty || "")}" /></label>
              <label><span>Institution</span><input id="profileInstitution" value="${escapeHtml(pro.institution || "")}" /></label>
              <label><span>Interests</span><textarea id="profileInterests" rows="4">${escapeHtml((pro.interests || []).join(", "))}</textarea><small>Separate with commas.</small></label>
              <button class="primary-button" type="submit">Save professional profile <span>→</span></button>
            </form>
          </article>
        </div>
      </section>
    `;
  }

  function bindScreenEvents() {
    qsa("[data-go]").forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.go))
    );
    qsa("[data-open-quick-task]").forEach((button) =>
      button.addEventListener("click", openQuickTask)
    );
    qsa("[data-toggle-task]").forEach((button) =>
      button.addEventListener("click", () => toggleTask(button.dataset.toggleTask))
    );
    qsa("[data-delete-task]").forEach((button) =>
      button.addEventListener("click", () => deleteTask(button.dataset.deleteTask))
    );
    qsa("[data-delete-goal]").forEach((button) =>
      button.addEventListener("click", () => deleteGoal(button.dataset.deleteGoal))
    );
    qsa("[data-complete-goal]").forEach((button) =>
      button.addEventListener("click", () => toggleGoalComplete(button.dataset.completeGoal))
    );
    qsa("[data-goal-progress]").forEach((input) => {
      input.addEventListener("input", () => {
        const label = qs(`[data-progress-label="${input.dataset.goalProgress}"]`);
        if (label) label.textContent = `${input.value}%`;
      });
      input.addEventListener("change", () =>
        saveGoalProgress(input.dataset.goalProgress, Number(input.value))
      );
    });
    qsa("[data-delete-achievement]").forEach((button) =>
      button.addEventListener("click", () => deleteAchievement(button.dataset.deleteAchievement))
    );
    qsa("[data-signout]").forEach((button) =>
      button.addEventListener("click", signOut)
    );

    el("plannerTaskForm")?.addEventListener("submit", createPlannerTask);
    el("goalForm")?.addEventListener("submit", createGoal);
    el("circleForm")?.addEventListener("submit", createCircle);
    el("achievementForm")?.addEventListener("submit", createAchievement);
    el("profileForm")?.addEventListener("submit", saveProfile);
    el("professionalForm")?.addEventListener("submit", saveProfessional);
  }

  async function createTask(payload) {
    const result = await db
      .from("tasks")
      .insert({
        user_id: state.user.id,
        title: payload.title,
        due_at: payload.due_at || null,
        priority: Number(payload.priority || 2),
        status: "todo"
      })
      .select()
      .single();

    if (result.error) {
      toast(result.error.message, "error");
      return false;
    }

    state.tasks.push(result.data);
    toast("Task added.", "success");
    return true;
  }

  async function createPlannerTask(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Adding…");

    const ok = await createTask({
      title: el("plannerTaskTitle").value.trim(),
      due_at: el("plannerTaskDue").value ? new Date(el("plannerTaskDue").value).toISOString() : null,
      priority: el("plannerTaskPriority").value
    });

    setLoading(button, false);
    if (ok) renderScreen();
  }

  function openQuickTask() {
    el("quickTaskForm").reset();
    el("quickTaskPriority").value = "2";
    el("quickTaskModal").classList.remove("hidden");
    setTimeout(() => el("quickTaskTitle").focus(), 80);
  }

  async function createQuickTask(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Adding…");

    const ok = await createTask({
      title: el("quickTaskTitle").value.trim(),
      due_at: el("quickTaskDue").value ? new Date(el("quickTaskDue").value).toISOString() : null,
      priority: el("quickTaskPriority").value
    });

    setLoading(button, false);
    if (ok) {
      el("quickTaskModal").classList.add("hidden");
      renderScreen();
    }
  }

  async function toggleTask(id) {
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return;

    const done = task.status !== "done";
    const result = await db
      .from("tasks")
      .update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null
      })
      .eq("id", id)
      .select()
      .single();

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    Object.assign(task, result.data);
    renderScreen();
  }

  async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    const result = await db.from("tasks").delete().eq("id", id);
    if (result.error) {
      toast(result.error.message, "error");
      return;
    }
    state.tasks = state.tasks.filter((x) => x.id !== id);
    toast("Task deleted.");
    renderScreen();
  }

  async function createGoal(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Creating…");

    const result = await db
      .from("goals")
      .insert({
        user_id: state.user.id,
        title: el("goalTitle").value.trim(),
        category: el("goalCategory").value.trim() || null,
        target_date: el("goalTarget").value || null,
        status: "active",
        visibility: "private"
      })
      .select()
      .single();

    setLoading(button, false);

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    state.goals.unshift(result.data);
    toast("Goal created.", "success");
    renderScreen();
  }

  async function saveGoalProgress(id, progress) {
    const result = await db
      .from("goals")
      .update({ progress })
      .eq("id", id)
      .select()
      .single();

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    const goal = state.goals.find((x) => x.id === id);
    if (goal) Object.assign(goal, result.data);
    toast("Progress updated.", "success");
  }

  async function toggleGoalComplete(id) {
    const goal = state.goals.find((x) => x.id === id);
    if (!goal) return;

    const completing = goal.status !== "completed";
    const result = await db
      .from("goals")
      .update({
        status: completing ? "completed" : "active",
        progress: completing ? 100 : Math.min(goal.progress, 99)
      })
      .eq("id", id)
      .select()
      .single();

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    Object.assign(goal, result.data);
    renderScreen();
  }

  async function deleteGoal(id) {
    if (!confirm("Delete this goal and its linked tasks?")) return;
    const result = await db.from("goals").delete().eq("id", id);
    if (result.error) {
      toast(result.error.message, "error");
      return;
    }
    state.goals = state.goals.filter((x) => x.id !== id);
    state.tasks = state.tasks.filter((x) => x.goal_id !== id);
    toast("Goal deleted.");
    renderScreen();
  }

  async function createCircle(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Creating…");

    const result = await db
      .from("circles")
      .insert({
        owner_id: state.user.id,
        name: el("circleName").value.trim(),
        description: el("circleDescription").value.trim() || null,
        is_private: true
      })
      .select()
      .single();

    setLoading(button, false);

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    state.circles.unshift(result.data);
    toast("Circle created.", "success");
    renderScreen();
  }

  async function createAchievement(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Saving…");

    const result = await db
      .from("achievements")
      .insert({
        user_id: state.user.id,
        title: el("achievementTitle").value.trim(),
        description: el("achievementDescription").value.trim() || null,
        achieved_on: el("achievementDate").value || new Date().toISOString().slice(0, 10)
      })
      .select()
      .single();

    setLoading(button, false);

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    state.achievements.unshift(result.data);
    toast("Milestone saved.", "success");
    renderScreen();
  }

  async function deleteAchievement(id) {
    if (!confirm("Delete this milestone?")) return;
    const result = await db.from("achievements").delete().eq("id", id);
    if (result.error) {
      toast(result.error.message, "error");
      return;
    }
    state.achievements = state.achievements.filter((x) => x.id !== id);
    renderScreen();
  }

  async function saveProfile(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Saving…");

    const result = await db
      .from("profiles")
      .update({
        display_name: el("profileName").value.trim(),
        username: el("profileUsername").value.trim() || null,
        headline: el("profileHeadline").value.trim() || null,
        bio: el("profileBio").value.trim() || null,
        city: el("profileCity").value.trim() || null,
        country: el("profileCountry").value.trim() || null
      })
      .eq("id", state.user.id)
      .select()
      .single();

    setLoading(button, false);

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    state.profile = result.data;
    updateIdentityUI();
    toast("Profile saved.", "success");
    renderScreen();
  }

  async function saveProfessional(event) {
    event.preventDefault();
    const button = qs('button[type="submit"]', event.currentTarget);
    setLoading(button, true, "Saving…");

    const interests = el("profileInterests").value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30);

    const result = await db
      .from("professional_profiles")
      .upsert({
        user_id: state.user.id,
        profession: el("profileProfession").value.trim() || null,
        career_stage: el("profileCareerStage").value.trim() || null,
        specialty: el("profileSpecialty").value.trim() || null,
        subspecialty: el("profileSubspecialty").value.trim() || null,
        institution: el("profileInstitution").value.trim() || null,
        interests
      }, { onConflict: "user_id" })
      .select()
      .single();

    setLoading(button, false);

    if (result.error) {
      toast(result.error.message, "error");
      return;
    }

    state.professional = result.data;
    toast("Professional profile saved.", "success");
    renderScreen();
  }

  async function signOut() {
    await db.auth.signOut();
  }

  function closeModal(id) {
    el(id)?.classList.add("hidden");
  }

  function registerStaticEvents() {
    el("showSignIn").addEventListener("click", () => switchAuth("signin"));
    el("showSignUp").addEventListener("click", () => switchAuth("signup"));
    el("signInForm").addEventListener("submit", signIn);
    el("signUpForm").addEventListener("submit", signUp);

    qsa(".nav-item[data-screen], .mobile-nav-item[data-screen]").forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.screen))
    );

    el("signOutButton").addEventListener("click", signOut);
    el("avatarButton").addEventListener("click", () => navigate("profile"));
    el("quickTaskButton").addEventListener("click", openQuickTask);
    el("quickTaskForm").addEventListener("submit", createQuickTask);

    qsa("[data-close-modal]").forEach((button) =>
      button.addEventListener("click", () => closeModal(button.dataset.closeModal))
    );

    qsa(".onboarding-next").forEach((button) =>
      button.addEventListener("click", () => showOnboardingStep(Number(button.dataset.next)))
    );
    qsa(".onboarding-back").forEach((button) =>
      button.addEventListener("click", () => showOnboardingStep(Number(button.dataset.back)))
    );
    el("finishOnboarding").addEventListener("click", finishOnboarding);

    qsa(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop && backdrop.id !== "onboardingModal") {
          backdrop.classList.add("hidden");
        }
      });
    });
  }

  async function init() {
    registerStaticEvents();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch((error) =>
          console.warn("Service worker registration failed:", error)
        );
      });
    }

    const { data } = await db.auth.getSession();
    await bootSession(data.session);

    db.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        state.session = session;
        return;
      }
      if (session?.user?.id === state.user?.id && event === "SIGNED_IN") {
        return;
      }
      bootSession(session);
    });
  }

  init().catch((error) => {
    console.error(error);
    toast("Medora could not start. Please refresh the page.", "error");
  });
})();
