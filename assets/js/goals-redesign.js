(() => {
  'use strict';

  const STORAGE_KEY = 'medora_goals_v2';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const today = () => new Date(new Date().setHours(0,0,0,0));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

  const categoryIcons = {
    Career:'↗', Learning:'◫', Health:'♡', Finance:'$', Relationships:'◌',
    Personal:'✦', Travel:'⌁', Project:'▦', Other:'•'
  };

  let goals = loadGoals();
  let currentView = 'active';

  function loadGoals(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }catch{return []}
  }

  function saveGoals(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }

  function escapeHtml(v=''){
    return String(v).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function milestoneProgress(goal){
    const ms = Array.isArray(goal.milestones) ? goal.milestones : [];
    if (!ms.length) return 0;
    return Math.round(ms.filter(m => m.done).length / ms.length * 100);
  }

  function goalStatus(goal){
    if (goal.status === 'completed') return 'Completed';
    if (goal.status === 'archived') return 'Archived';
    const d = new Date(goal.targetDate);
    const days = Math.ceil((d - today()) / 86400000);
    const p = milestoneProgress(goal);
    if (days < 0) return 'Needs attention';
    if (days <= 14 && p < 80) return 'Due soon';
    return 'On track';
  }

  function dateLabel(date){
    if(!date) return 'No date';
    return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00'));
  }

  function nextMilestone(goal){
    return (goal.milestones || []).find(m => !m.done) || null;
  }

  function filteredGoals(){
    const q = ($('#goalSearch').value || '').trim().toLowerCase();
    const category = $('#categoryFilter').value;
    return goals.filter(goal => {
      if (category !== 'all' && goal.category !== category) return false;
      if (q && !`${goal.title} ${goal.category} ${goal.why||''}`.toLowerCase().includes(q)) return false;

      if (currentView === 'active') return !['completed','archived'].includes(goal.status);
      if (currentView === 'completed') return goal.status === 'completed';
      if (currentView === 'archived') return goal.status === 'archived';
      if (currentView === 'week') return !['completed','archived'].includes(goal.status) && !!nextMilestone(goal);
      return true;
    });
  }

  function renderSummary(){
    const active = goals.filter(g => !['completed','archived'].includes(g.status));
    const onTrack = active.filter(g => goalStatus(g) === 'On track');
    const dueSoon = active.filter(g => ['Due soon','Needs attention'].includes(goalStatus(g)));
    const overall = active.length
      ? Math.round(active.reduce((s,g)=>s+milestoneProgress(g),0)/active.length)
      : 0;

    $('#activeCount').textContent = active.length;
    $('#onTrackCount').textContent = onTrack.length;
    $('#dueSoonCount').textContent = dueSoon.length;
    $('#overallProgress').textContent = `${overall}%`;
    $('#overallProgressBar').style.width = `${overall}%`;
  }

  function renderGoals(){
    const rows = filteredGoals();
    const grid = $('#goalsGrid');
    const empty = $('#emptyGoals');

    const titles = {
      active:['Active goals','Keep the important outcomes visible without turning them into noise.'],
      week:['Goals moving this week','Focus only on goals with a clear next action.'],
      completed:['Completed goals','A record of meaningful outcomes you finished.'],
      archived:['Paused / archived','Goals you intentionally put on hold.']
    };
    $('#sectionTitle').textContent = titles[currentView][0];
    $('#sectionSubtitle').textContent = titles[currentView][1];

    if(!rows.length){
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    grid.innerHTML = rows.map(goal => {
      const progress = milestoneProgress(goal);
      const status = goalStatus(goal);
      const next = nextMilestone(goal);
      const milestones = (goal.milestones || []).slice(0,3).map(m => `
        <div class="${m.done?'done':''}">
          <i>${m.done?'✓':''}</i><span>${escapeHtml(m.title)}</span>
        </div>`).join('');

      return `<article class="goal-card" data-goal-id="${goal.id}">
        <div class="goal-card-top">
          <span class="goal-category">${categoryIcons[goal.category]||'•'} ${escapeHtml(goal.category)}</span>
          <span class="goal-status">${escapeHtml(status)}</span>
        </div>
        <h3>${escapeHtml(goal.title)}</h3>
        <div class="goal-why">${escapeHtml(goal.why || 'No note added yet.')}</div>

        <div class="goal-meta">
          <span>${progress}% complete</span>
          <span>Target ${escapeHtml(dateLabel(goal.targetDate))}</span>
        </div>
        <div class="goal-progress-track"><span style="width:${progress}%"></span></div>

        <div class="milestone-preview">${milestones || '<div><i></i><span>No milestones yet</span></div>'}</div>

        <div class="goal-next">
          <strong>Next</strong>
          ${next ? escapeHtml(next.title) : (goal.status==='completed' ? 'Goal completed' : 'Add a next milestone')}
        </div>

        <div class="goal-card-actions">
          <button class="view" type="button" data-edit-goal="${goal.id}">View / edit</button>
          <button class="update" type="button" data-progress-goal="${goal.id}">
            ${next ? 'Mark next done' : 'Complete goal'}
          </button>
        </div>
      </article>`;
    }).join('');
  }

  function renderWeek(){
    const actions = goals
      .filter(g => !['completed','archived'].includes(g.status))
      .map(g => ({goal:g, milestone:nextMilestone(g)}))
      .filter(x => x.milestone)
      .slice(0,6);

    $('#weekActions').innerHTML = actions.length ? actions.map(({goal,milestone}) => `
      <label class="week-action">
        <input type="checkbox" data-week-goal="${goal.id}" data-week-milestone="${milestone.id}">
        <span><strong>${escapeHtml(milestone.title)}</strong><span>${escapeHtml(goal.title)} · ${escapeHtml(goal.category)}</span></span>
      </label>`).join('') : `
      <div class="empty-goals" style="grid-column:1/-1;padding:24px">
        <h3>No goal actions yet</h3>
        <p>Add milestones to your goals and the next actions will appear here automatically.</p>
      </div>`;
  }

  function renderAll(){
    renderSummary();
    renderGoals();
    renderWeek();
  }

  function openModal(goal=null){
    $('#goalModalBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#goalForm').reset();
    $('#goalId').value = goal?.id || '';
    $('#goalTitle').value = goal?.title || '';
    $('#goalCategory').value = goal?.category || '';
    $('#goalDate').value = goal?.targetDate || '';
    $('#goalWhy').value = goal?.why || '';
    $('#weeklyCommitment').value = String(goal?.weeklyCommitment || 3);
    $('#milestoneRows').innerHTML = '';
    (goal?.milestones || [{id:uid(),title:'',done:false}]).forEach(addMilestoneRow);
  }

  function closeModal(){
    $('#goalModalBackdrop').hidden = true;
    document.body.style.overflow = '';
  }

  function addMilestoneRow(m={id:uid(),title:'',done:false}){
    const row = document.createElement('div');
    row.className = 'milestone-row';
    row.dataset.milestoneId = m.id;
    row.dataset.done = String(!!m.done);
    row.innerHTML = `<input value="${escapeHtml(m.title)}" placeholder="Milestone"><button type="button" aria-label="Remove milestone">×</button>`;
    row.querySelector('button').onclick = () => row.remove();
    $('#milestoneRows').appendChild(row);
  }

  function breakdown(){
    const title = $('#goalTitle').value.trim();
    const category = $('#goalCategory').value;
    if(!title){ $('#goalTitle').focus(); return; }

    const templates = {
      Learning:[
        `Define the exact outcome for "${title}"`,
        'Choose the learning resources and schedule',
        'Complete the first major learning block',
        'Test or assess your current level',
        'Close the remaining gaps and finish'
      ],
      Career:[
        `Define what success for "${title}" looks like`,
        'Identify the requirements and missing skills',
        'Complete the highest-impact preparation',
        'Get feedback from a trusted person',
        'Finish and submit / launch'
      ],
      Health:[
        'Set a measurable baseline',
        'Choose the weekly routine',
        'Complete the first 2 consistent weeks',
        'Review progress and adjust',
        'Reach the target and create a maintenance plan'
      ],
      Project:[
        'Define scope and final deliverable',
        'Prepare the resources and first draft',
        'Complete the core build',
        'Review, test and refine',
        'Publish / deliver the final version'
      ],
      Travel:[
        'Define destination, dates and budget',
        'Book the major transport',
        'Secure accommodation',
        'Plan the essential itinerary',
        'Complete final travel preparation'
      ]
    };
    const items = templates[category] || [
      `Define success for "${title}"`,
      'Choose the first concrete action',
      'Complete the first meaningful milestone',
      'Review progress and adjust',
      'Finish and close the goal'
    ];
    $('#milestoneRows').innerHTML = '';
    items.forEach(t => addMilestoneRow({id:uid(),title:t,done:false}));
  }

  function collectMilestones(){
    return $$('.milestone-row').map(row => ({
      id: row.dataset.milestoneId || uid(),
      title: $('input',row).value.trim(),
      done: row.dataset.done === 'true'
    })).filter(m => m.title);
  }

  $('#goalForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = $('#goalId').value || uid();
    const existing = goals.find(g => g.id === id);
    const payload = {
      id,
      title: $('#goalTitle').value.trim(),
      category: $('#goalCategory').value,
      targetDate: $('#goalDate').value,
      why: $('#goalWhy').value.trim(),
      weeklyCommitment: Number($('#weeklyCommitment').value || 3),
      milestones: collectMilestones(),
      status: existing?.status || 'active',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    goals = existing ? goals.map(g => g.id===id ? payload : g) : [payload,...goals];
    saveGoals(); closeModal(); renderAll();
  });

  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open-goal]');
    if(open){ openModal(); return; }

    const edit = e.target.closest('[data-edit-goal]');
    if(edit){ openModal(goals.find(g=>g.id===edit.dataset.editGoal)); return; }

    const progress = e.target.closest('[data-progress-goal]');
    if(progress){
      const goal = goals.find(g=>g.id===progress.dataset.progressGoal);
      if(!goal) return;
      const next = nextMilestone(goal);
      if(next) next.done = true;
      else goal.status = 'completed';
      if((goal.milestones||[]).length && goal.milestones.every(m=>m.done)) goal.status='completed';
      goal.updatedAt = new Date().toISOString();
      saveGoals(); renderAll();
      return;
    }

    const tab = e.target.closest('[data-view]');
    if(tab){
      currentView = tab.dataset.view;
      $$('.segmented button').forEach(b=>b.classList.toggle('active',b===tab));
      renderGoals();
      return;
    }
  });

  $('#weekActions').addEventListener('change', e => {
    const input = e.target.closest('[data-week-goal]');
    if(!input) return;
    const goal = goals.find(g=>g.id===input.dataset.weekGoal);
    const m = goal?.milestones?.find(x=>x.id===input.dataset.weekMilestone);
    if(m) m.done = input.checked;
    if(goal?.milestones?.length && goal.milestones.every(x=>x.done)) goal.status='completed';
    saveGoals(); renderAll();
  });

  $('#newGoalBtn').onclick = () => openModal();
  $('#quickTaskBtn').onclick = () => location.href = 'planner.html?quick=1';
  $('#closeGoalModal').onclick = closeModal;
  $('#cancelGoalBtn').onclick = closeModal;
  $('#goalModalBackdrop').addEventListener('click', e => { if(e.target === e.currentTarget) closeModal(); });
  $('#addMilestoneBtn').onclick = () => addMilestoneRow();
  $('#breakDownBtn').onclick = breakdown;
  $('#goalSearch').addEventListener('input', renderGoals);
  $('#categoryFilter').addEventListener('change', renderGoals);
  $('#signOutBtn').onclick = () => location.href = 'signin.html';

  renderAll();
})();
