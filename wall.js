(() => {
  "use strict";

  const cfg = window.MOTIVEA_WALL_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseKey || !window.supabase?.createClient) {
    document.body.innerHTML = "<p style='padding:32px;font-family:sans-serif'>Wall configuration could not be loaded.</p>";
    return;
  }

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  const state = {
    user: null,
    profile: null,
    filter: "all",
    posts: [],
    connectedIds: new Set(),
    profileMap: new Map(),
    goals: [],
    achievements: [],
    circles: [],
    reactions: [],
    comments: [],
    activeCommentPostId: null
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const els = {
    myAvatar: $("#myAvatar"),
    composerAvatar: $("#composerAvatar"),
    myName: $("#myName"),
    myHeadline: $("#myHeadline"),
    composerForm: $("#composerForm"),
    openComposer: $("#openComposer"),
    cancelComposer: $("#cancelComposer"),
    postContent: $("#postContent"),
    postType: $("#postType"),
    postVisibility: $("#postVisibility"),
    circlePickerWrap: $("#circlePickerWrap"),
    circlePicker: $("#circlePicker"),
    goalPickerWrap: $("#goalPickerWrap"),
    goalPicker: $("#goalPicker"),
    achievementPickerWrap: $("#achievementPickerWrap"),
    achievementPicker: $("#achievementPicker"),
    publishPost: $("#publishPost"),
    composerStatus: $("#composerStatus"),
    feed: $("#feed"),
    feedTitle: $("#feedTitle"),
    feedSubtitle: $("#feedSubtitle"),
    postCount: $("#postCount"),
    refreshWall: $("#refreshWall"),
    signOutButton: $("#signOutButton"),
    commentsDialog: $("#commentsDialog"),
    commentsList: $("#commentsList"),
    commentsPostLabel: $("#commentsPostLabel"),
    closeComments: $("#closeComments"),
    commentForm: $("#commentForm"),
    commentInput: $("#commentInput"),
    toast: $("#toast")
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function initials(name) {
    const clean = String(name || "M").trim();
    return clean.split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase() || "M";
  }

  function avatarHtml(profile, sizeClass = "") {
    const name = profile?.display_name || profile?.username || "Motivea user";
    if (profile?.avatar_url) {
      return `<div class="avatar ${sizeClass}"><img src="${escapeHtml(profile.avatar_url)}" alt=""></div>`;
    }
    return `<div class="avatar ${sizeClass}">${escapeHtml(initials(name))}</div>`;
  }

  function setAvatar(el, profile) {
    const name = profile?.display_name || profile?.username || "Motivea user";
    el.innerHTML = profile?.avatar_url
      ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">`
      : escapeHtml(initials(name));
  }

  function relativeTime(value) {
    const ms = Date.now() - new Date(value).getTime();
    const sec = Math.max(1, Math.floor(ms / 1000));
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
  }

  function visibilityLabel(post) {
    return {
      public: "Motivea community",
      connections: "Connections",
      circle: "Circle",
      private: "Only me"
    }[post.visibility] || "Visible";
  }

  function typeLabel(type) {
    return {
      update: "Update",
      goal: "Goal progress",
      achievement: "Achievement",
      question: "Question"
    }[type] || "Update";
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { els.toast.hidden = true; }, 3200);
  }

  function setBusy(button, busy, busyText = "Working…") {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.label;
  }

  async function requireSession() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error) throw error;
    if (!user) {
      location.href = "index.html";
      return false;
    }
    state.user = user;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,display_name,username,avatar_url,headline")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    state.profile = profile;
    return true;
  }

  async function loadSupportData() {
    const uid = state.user.id;

    const [connectionsRes, circlesRes, goalsRes, achievementsRes] = await Promise.all([
      db.from("connections")
        .select("requester_id,addressee_id,status")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      db.from("circles")
        .select("id,name,owner_id")
        .order("name"),
      db.from("goals")
        .select("id,title,progress,status")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false }),
      db.from("achievements")
        .select("id,title,achieved_on")
        .eq("user_id", uid)
        .order("achieved_on", { ascending: false })
    ]);

    for (const result of [connectionsRes, circlesRes, goalsRes, achievementsRes]) {
      if (result.error) throw result.error;
    }

    state.connectedIds.clear();
    for (const c of connectionsRes.data || []) {
      if (String(c.status) !== "accepted") continue;
      const other = c.requester_id === uid ? c.addressee_id : c.requester_id;
      if (other) state.connectedIds.add(other);
    }

    state.circles = circlesRes.data || [];
    state.goals = goalsRes.data || [];
    state.achievements = achievementsRes.data || [];

    els.circlePicker.innerHTML = state.circles.length
      ? state.circles.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
      : `<option value="">No circle available</option>`;

    els.goalPicker.innerHTML = [
      `<option value="">Choose a goal (optional)</option>`,
      ...state.goals.map(g => `<option value="${g.id}">${escapeHtml(g.title)} · ${Number(g.progress || 0)}%</option>`)
    ].join("");

    els.achievementPicker.innerHTML = [
      `<option value="">Choose an achievement (optional)</option>`,
      ...state.achievements.map(a => `<option value="${a.id}">${escapeHtml(a.title)}</option>`)
    ].join("");
  }

  async function loadFeed() {
    els.feed.innerHTML = `<div class="feed-loading">Loading your Wall…</div>`;

    const { data: posts, error } = await db
      .from("wall_posts")
      .select("id,user_id,content,post_type,visibility,circle_id,goal_id,achievement_id,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (error.code === "42P01") {
        els.feed.innerHTML = `<div class="empty-feed"><strong>Wall database setup is still missing.</strong><br>Run <code>supabase-wall-setup.sql</code> once, then refresh.</div>`;
        return;
      }
      throw error;
    }

    state.posts = posts || [];
    const postIds = state.posts.map(p => p.id);
    const authorIds = [...new Set(state.posts.map(p => p.user_id))];

    const profilePromise = authorIds.length
      ? db.from("public_profiles")
          .select("user_id,display_name,username,avatar_url,headline,profession,specialty,institution")
          .in("user_id", authorIds)
      : Promise.resolve({ data: [], error: null });

    const reactionsPromise = postIds.length
      ? db.from("wall_reactions").select("post_id,user_id,reaction").in("post_id", postIds)
      : Promise.resolve({ data: [], error: null });

    const commentsPromise = postIds.length
      ? db.from("wall_comments").select("id,post_id,user_id,body,created_at").in("post_id", postIds)
      : Promise.resolve({ data: [], error: null });

    const [profilesRes, reactionsRes, commentsRes] = await Promise.all([
      profilePromise, reactionsPromise, commentsPromise
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (reactionsRes.error) throw reactionsRes.error;
    if (commentsRes.error) throw commentsRes.error;

    state.profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    state.profileMap.set(state.user.id, {
      user_id: state.profile.id,
      display_name: state.profile.display_name,
      username: state.profile.username,
      avatar_url: state.profile.avatar_url,
      headline: state.profile.headline
    });
    state.reactions = reactionsRes.data || [];
    state.comments = commentsRes.data || [];

    renderFeed();
  }

  function filteredPosts() {
    if (state.filter === "mine") {
      return state.posts.filter(p => p.user_id === state.user.id);
    }
    if (state.filter === "connections") {
      return state.posts.filter(p => p.user_id === state.user.id || state.connectedIds.has(p.user_id));
    }
    return state.posts;
  }

  function linkedCard(post) {
    if (post.goal_id) {
      const goal = state.goals.find(g => g.id === post.goal_id);
      if (goal) {
        return `<div class="post-link-card"><small>Linked goal</small><strong>🎯 ${escapeHtml(goal.title)} · ${Number(goal.progress || 0)}%</strong></div>`;
      }
    }
    if (post.achievement_id) {
      const achievement = state.achievements.find(a => a.id === post.achievement_id);
      if (achievement) {
        return `<div class="post-link-card"><small>Linked achievement</small><strong>🏆 ${escapeHtml(achievement.title)}</strong></div>`;
      }
    }
    return "";
  }

  function renderFeed() {
    const posts = filteredPosts();
    const headings = {
      all: ["For you", "Updates from your visible Motivea network."],
      connections: ["Connections", "Progress and conversations from people you are connected with."],
      mine: ["My posts", "Everything you have shared on the Wall."]
    };
    [els.feedTitle.textContent, els.feedSubtitle.textContent] = headings[state.filter];
    els.postCount.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"}`;

    if (!posts.length) {
      els.feed.innerHTML = `<div class="card empty-feed"><strong>No posts here yet.</strong><br>Share the first purposeful update.</div>`;
      return;
    }

    els.feed.innerHTML = posts.map(post => {
      const profile = state.profileMap.get(post.user_id) || {
        display_name: post.user_id === state.user.id ? state.profile.display_name : "Motivea member"
      };
      const reactions = state.reactions.filter(r => r.post_id === post.id);
      const comments = state.comments.filter(c => c.post_id === post.id);
      const reacted = reactions.some(r => r.user_id === state.user.id);
      const own = post.user_id === state.user.id;
      const subtitle = [profile.headline || [profile.profession, profile.specialty].filter(Boolean).join(" · "), profile.institution]
        .filter(Boolean).join(" · ");

      return `
        <article class="card post-card" data-post-id="${post.id}">
          <div class="post-head">
            ${avatarHtml(profile)}
            <div class="post-author">
              <strong>${escapeHtml(profile.display_name || profile.username || "Motivea member")}</strong>
              <small>${escapeHtml(subtitle || visibilityLabel(post))}</small>
            </div>
            <div class="post-menu">
              ${own ? `<button class="mini-btn" data-delete-post="${post.id}" title="Delete post">Delete</button>` : ""}
            </div>
          </div>

          <div class="post-type">${escapeHtml(typeLabel(post.post_type))}</div>
          <div class="post-body">${escapeHtml(post.content)}</div>
          ${linkedCard(post)}

          <div class="post-meta">
            <span>${escapeHtml(visibilityLabel(post))} · ${relativeTime(post.created_at)}</span>
            <span>${reactions.length} support · ${comments.length} comment${comments.length === 1 ? "" : "s"}</span>
          </div>

          <div class="post-actions">
            <button class="action-btn ${reacted ? "active" : ""}" data-react="${post.id}" type="button">
              ${reacted ? "💙 Supported" : "♡ Support"}
            </button>
            <button class="action-btn" data-comments="${post.id}" type="button">💬 Comment</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function syncComposerOptions() {
    const type = els.postType.value;
    const visibility = els.postVisibility.value;
    els.goalPickerWrap.hidden = type !== "goal";
    els.achievementPickerWrap.hidden = type !== "achievement";
    els.circlePickerWrap.hidden = visibility !== "circle";
  }

  function resetComposer() {
    els.composerForm.reset();
    els.composerForm.hidden = true;
    els.openComposer.hidden = false;
    els.composerStatus.textContent = "";
    syncComposerOptions();
  }

  async function createPost(event) {
    event.preventDefault();
    const content = els.postContent.value.trim();
    if (!content) return;

    const visibility = els.postVisibility.value;
    if (visibility === "circle" && !els.circlePicker.value) {
      els.composerStatus.textContent = "Choose a circle first.";
      return;
    }

    const payload = {
      user_id: state.user.id,
      content,
      post_type: els.postType.value,
      visibility,
      circle_id: visibility === "circle" ? els.circlePicker.value : null,
      goal_id: els.postType.value === "goal" && els.goalPicker.value ? els.goalPicker.value : null,
      achievement_id: els.postType.value === "achievement" && els.achievementPicker.value ? els.achievementPicker.value : null
    };

    setBusy(els.publishPost, true, "Posting…");
    els.composerStatus.textContent = "";

    const { error } = await db.from("wall_posts").insert(payload);
    setBusy(els.publishPost, false);

    if (error) {
      console.error(error);
      els.composerStatus.textContent = error.message || "Could not publish.";
      return;
    }

    resetComposer();
    toast("Posted to your Wall.");
    await loadFeed();
  }

  async function toggleReaction(postId) {
    const existing = state.reactions.find(r => r.post_id === postId && r.user_id === state.user.id);

    if (existing) {
      const { error } = await db.from("wall_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", state.user.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("wall_reactions").insert({
        post_id: postId,
        user_id: state.user.id,
        reaction: "support"
      });
      if (error) throw error;
    }

    await loadFeed();
  }

  async function deletePost(postId) {
    if (!confirm("Delete this Wall post?")) return;
    const { error } = await db.from("wall_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", state.user.id);
    if (error) throw error;
    toast("Post deleted.");
    await loadFeed();
  }

  async function openComments(postId) {
    state.activeCommentPostId = postId;
    const post = state.posts.find(p => p.id === postId);
    const profile = state.profileMap.get(post?.user_id);
    els.commentsPostLabel.textContent = profile?.display_name ? `Post by ${profile.display_name}` : "";
    await renderComments(postId);
    els.commentsDialog.showModal();
    setTimeout(() => els.commentInput.focus(), 60);
  }

  async function renderComments(postId) {
    const comments = state.comments
      .filter(c => c.post_id === postId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const authorIds = [...new Set(comments.map(c => c.user_id))];
    if (authorIds.length) {
      const missing = authorIds.filter(id => !state.profileMap.has(id));
      if (missing.length) {
        const { data } = await db.from("public_profiles")
          .select("user_id,display_name,username,avatar_url,headline")
          .in("user_id", missing);
        (data || []).forEach(p => state.profileMap.set(p.user_id, p));
      }
    }

    els.commentsList.innerHTML = comments.length ? comments.map(comment => {
      const profile = state.profileMap.get(comment.user_id) || { display_name: "Motivea member" };
      return `
        <div class="comment">
          ${avatarHtml(profile)}
          <div class="comment-bubble">
            <strong>${escapeHtml(profile.display_name || profile.username || "Motivea member")}</strong>
            <p>${escapeHtml(comment.body)}</p>
            <small>${relativeTime(comment.created_at)}</small>
          </div>
        </div>
      `;
    }).join("") : `<div class="empty-feed">No comments yet. Start the conversation.</div>`;
  }

  async function addComment(event) {
    event.preventDefault();
    const body = els.commentInput.value.trim();
    if (!body || !state.activeCommentPostId) return;

    const button = els.commentForm.querySelector("button");
    setBusy(button, true, "Sending…");

    const { error } = await db.from("wall_comments").insert({
      post_id: state.activeCommentPostId,
      user_id: state.user.id,
      body
    });

    setBusy(button, false);
    if (error) {
      console.error(error);
      toast(error.message || "Comment could not be sent.");
      return;
    }

    els.commentInput.value = "";
    await loadFeed();
    await renderComments(state.activeCommentPostId);
  }

  function bindEvents() {
    els.openComposer.addEventListener("click", () => {
      els.openComposer.hidden = true;
      els.composerForm.hidden = false;
      els.postContent.focus();
    });
    els.cancelComposer.addEventListener("click", resetComposer);
    els.postType.addEventListener("change", syncComposerOptions);
    els.postVisibility.addEventListener("change", syncComposerOptions);
    els.composerForm.addEventListener("submit", createPost);

    $$(".wall-filter").forEach(btn => btn.addEventListener("click", () => {
      $$(".wall-filter").forEach(b => b.classList.toggle("active", b === btn));
      state.filter = btn.dataset.filter;
      renderFeed();
    }));

    els.feed.addEventListener("click", async (event) => {
      const react = event.target.closest("[data-react]");
      const comments = event.target.closest("[data-comments]");
      const del = event.target.closest("[data-delete-post]");
      try {
        if (react) await toggleReaction(react.dataset.react);
        if (comments) await openComments(comments.dataset.comments);
        if (del) await deletePost(del.dataset.deletePost);
      } catch (error) {
        console.error(error);
        toast(error.message || "Something went wrong.");
      }
    });

    els.refreshWall.addEventListener("click", async () => {
      els.refreshWall.disabled = true;
      try {
        await Promise.all([loadSupportData(), loadFeed()]);
        toast("Wall refreshed.");
      } catch (e) {
        console.error(e);
        toast(e.message || "Refresh failed.");
      } finally {
        els.refreshWall.disabled = false;
      }
    });

    els.signOutButton.addEventListener("click", async () => {
      await db.auth.signOut();
      location.href = "index.html";
    });

    els.closeComments.addEventListener("click", () => els.commentsDialog.close());
    els.commentForm.addEventListener("submit", addComment);
  }

  async function init() {
    try {
      if (!await requireSession()) return;

      els.myName.textContent = state.profile.display_name || state.profile.username || "Motivea member";
      els.myHeadline.textContent = state.profile.headline || "Your Motivea profile";
      setAvatar(els.myAvatar, state.profile);
      setAvatar(els.composerAvatar, state.profile);

      bindEvents();
      syncComposerOptions();
      await loadSupportData();
      await loadFeed();
    } catch (error) {
      console.error(error);
      els.feed.innerHTML = `<div class="card empty-feed"><strong>Wall could not load.</strong><br>${escapeHtml(error.message || "Unknown error")}</div>`;
    }
  }

  init();
})();
