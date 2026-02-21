/**
 * HABITLY — script.js
 * Juan Lopez Loza
 * 19/02/2026
 */

// =============================================
// INIT SUPABASE
// =============================================

const supabaseClient = supabase.createClient(
    'https://jabkrcknmymguutdqfco.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYmtyY2tubXltZ3V1dGRxZmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzc5NTcsImV4cCI6MjA4NzExMzk1N30.2wlbxB1r2rsnGZqNBAB1mIu2JbcCVYsHW_VmO_Xle5Q'
);

// =============================================
// CATÉGORIES (hardcodées)
// =============================================

const CATEGORIES = [
  { id: 'health',    label: 'Santé',     emoji: '🏃' },
  { id: 'mental',    label: 'Mental',    emoji: '🧠' },
  { id: 'work',      label: 'Travail',   emoji: '💼' },
  { id: 'lifestyle', label: 'Lifestyle', emoji: '🌿' },
];

// =============================================
// ÉTAT GLOBAL
// =============================================

let habits        = [];
let logs          = {};
let editingId     = null;
let selectedDate  = today();
let selectedColor = '#FF6B6B';
let selectedType  = 'check';
let selectedCategory = null;
let isSignUpMode  = false;
let profileListenersInitialized = false;
let activeCategories = JSON.parse(localStorage.getItem('activeCategories') || '[]');

// =============================================
// UTILS DATE
// =============================================

function today() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isToday(dateStr) {
  return dateStr === today();
}

// =============================================
// AUTH
// =============================================

function initAuthListeners() {
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btn      = document.getElementById('authSubmitBtn');

    btn.disabled    = true;
    btn.textContent = isSignUpMode ? 'Inscription...' : 'Connexion...';

    const { error } = isSignUpMode
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

    btn.disabled    = false;
    btn.textContent = isSignUpMode ? "S'inscrire" : 'Se connecter';

    if (error) { showAuthError(error.message); return; }

    if (isSignUpMode) {
      showAuthError('Compte créé ! Vérifie ton email pour confirmer.', true);
    } else {
      await startApp();
    }
  });

  document.getElementById('switchToSignUp').addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    document.getElementById('authTitle').textContent      = isSignUpMode ? 'Inscription'      : 'Connexion';
    document.getElementById('authSubmitBtn').textContent  = isSignUpMode ? "S'inscrire"       : 'Se connecter';
    document.getElementById('toggleText').textContent     = isSignUpMode ? 'Déjà un compte ?' : 'Pas de compte ?';
    document.getElementById('switchToSignUp').textContent = isSignUpMode ? 'Se connecter'     : "S'inscrire";
    clearAuthError();
  });

  // Toggle visibilité mot de passe
  const togglePwdBtn = document.getElementById('togglePassword');
  if (togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
      const input = document.getElementById('authPassword');
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      togglePwdBtn.textContent = isHidden ? '🙈' : '👁';
    });
  }
}

function showAuthError(msg, isSuccess = false) {
  let el = document.getElementById('authError');
  if (!el) {
    el = document.createElement('p');
    el.id = 'authError';
    el.style.cssText = 'margin-top:12px;font-size:13px;text-align:center;';
    document.getElementById('authForm').appendChild(el);
  }
  el.style.color = isSuccess ? '#06D6A0' : '#FF3B30';
  el.textContent = msg;
}

function clearAuthError() {
  const el = document.getElementById('authError');
  if (el) el.textContent = '';
}

// =============================================
// PROFILE
// =============================================

function initProfileListeners() {
  if (profileListenersInitialized) return;
  profileListenersInitialized = true;

  document.getElementById('profileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('open');
  });

  document.addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.remove('open');
  });

  document.getElementById('deconnectBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  document.getElementById('deleteProfileBtn').addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement ton compte et toutes tes données ?')) return;
    await resetData();
    await supabaseClient.rpc('delete_user');
  });
}

// =============================================
// STORAGE — Supabase
// =============================================

async function loadData() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: habitsData, error: habitsError } = await supabaseClient
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

  if (habitsError) { console.error('Erreur habits:', habitsError); return; }
  habits = habitsData || [];

  const { data: logsData, error: logsError } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('user_id', user.id);

  if (logsError) { console.error('Erreur logs:', logsError); return; }

  logs = {};
  (logsData || []).forEach(row => {
    if (!logs[row.date]) logs[row.date] = {};
    let val = row.value;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch { /* laisse en string */ }
    }
    logs[row.date][row.habit_id] = val;
  });
}

// =============================================
// LOG HELPERS
// =============================================

async function setLog(habitId, value, dateStr = null) {
  const d = dateStr || today();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return console.error('setLog: aucun utilisateur connecté');

  if (!logs[d]) logs[d] = {};
  logs[d][habitId] = value;

  const { error } = await supabaseClient
      .from('logs')
      .upsert(
          { user_id: user.id, habit_id: habitId, date: d, value },
          { onConflict: 'user_id,habit_id,date' }
      );

  if (error) console.error('Erreur setLog:', error);
}

function getLogForDate(habitId, dateStr) {
  return (logs[dateStr] || {})[habitId];
}

function isHabitDoneOnDate(habit, dateStr) {
  const val  = getLogForDate(habit.id, dateStr);
  const goal = habit.goal || 1;
  return habit.type === 'check'
      ? val === true
      : (typeof val === 'number' && val >= goal);
}

// =============================================
// STREAK
// =============================================

function calculateStreak(habitId, habitType, goal = 1) {
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d    = offsetDate(-i);
    const val  = (logs[d] || {})[habitId];
    const done = habitType === 'check' ? val === true : (typeof val === 'number' && val >= goal);
    if (done) current++;
    else break;
  }

  let best = 0, streak = 0;
  for (let i = 364; i >= 0; i--) {
    const d    = offsetDate(-i);
    const val  = (logs[d] || {})[habitId];
    const done = habitType === 'check' ? val === true : (typeof val === 'number' && val >= goal);
    if (done) { streak++; best = Math.max(best, streak); }
    else streak = 0;
  }

  return { current, best };
}

// =============================================
// DAILY PROGRESS
// =============================================

function getDayProgress(dateStr) {
  if (habits.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  habits.forEach(h => { if (isHabitDoneOnDate(h, dateStr)) done++; });
  const total = habits.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

// =============================================
// TIMELINE
// =============================================

const TIMELINE_DAYS = 90;

function renderTimeline() {
  const track = document.getElementById('timelineTrack');
  track.innerHTML = '';

  for (let i = TIMELINE_DAYS - 1; i >= 0; i--) {
    const dateStr = offsetDate(-i);
    const d       = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2);
    const dayNum  = d.getDate();
    const prog    = getDayProgress(dateStr);

    const pill = document.createElement('button');
    pill.className = 'day-pill';
    if (isToday(dateStr))         pill.classList.add('today');
    if (dateStr === selectedDate) pill.classList.add('selected');
    if (prog.pct === 100)         pill.classList.add('is-completed');
    pill.dataset.date = dateStr;
    pill.title = formatDisplayDate(dateStr);

    pill.innerHTML = `
      <span class="day-pill-name">${dayName}</span>
      <span class="day-pill-num">${dayNum}</span>
      <div class="day-pill-arc">
        <div class="day-pill-arc-fill ${prog.pct === 100 ? 'is-completed' : ''}" style="width:${prog.pct}%"></div>
      </div>`;

    pill.addEventListener('click', () => selectDate(dateStr));
    track.appendChild(pill);
  }

  requestAnimationFrame(() => {
    const sel = track.querySelector('.day-pill.selected');
    if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  document.querySelectorAll('.day-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.date === dateStr);
  });
  updateDayHeader();
  renderCategories();
  renderHabits();
}

// =============================================
// DAY HEADER
// =============================================

function updateDayHeader() {
  const prog  = getDayProgress(selectedDate);
  const label = document.getElementById('dayFullLabel');
  const badge = document.getElementById('dayModeBadge');
  const main  = document.getElementById('dayProgressMain');
  const ring  = document.getElementById('ringLabel');
  const fill  = document.getElementById('ringFill');

  label.textContent = formatDisplayDate(selectedDate);

  if (isToday(selectedDate)) {
    badge.textContent = "Aujourd'hui";
    badge.className   = `day-mode-badge is-today${prog.pct === 100 ? ' is-completed' : ''}`;
  } else {
    const d = new Date(selectedDate + 'T00:00:00');
    badge.textContent = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    badge.className   = `day-mode-badge is-past${prog.pct === 100 ? ' is-completed' : ''}`;
  }

  main.textContent = `${prog.done} / ${prog.total}`;
  ring.textContent = `${prog.pct}%`;

  const offset = 113.1 - (113.1 * prog.pct / 100);
  fill.style.strokeDashoffset = offset;
  fill.style.stroke = prog.pct === 100 ? '#06D6A0' : prog.pct >= 50 ? '#FFD166' : '#FF6B6B';
}

// =============================================
// CATÉGORIES — MODAL
// =============================================

function openCategoryModal() {
  const picker = document.getElementById('categoryPicker');
  picker.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const isActive = activeCategories.includes(cat.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `category-pick-btn${isActive ? ' active' : ''}`;
    btn.dataset.id = cat.id;
    btn.innerHTML = `<span class="cat-emoji">${cat.emoji}</span><span class="cat-label">${cat.label}</span>`;

    btn.addEventListener('click', () => {
      if (activeCategories.includes(cat.id)) {
        activeCategories = activeCategories.filter(id => id !== cat.id);
      } else {
        activeCategories.push(cat.id);
      }
      localStorage.setItem('activeCategories', JSON.stringify(activeCategories));
      btn.classList.toggle('active');
      renderCategories();
    });

    picker.appendChild(btn);
  });

  document.getElementById('categoryModalOverlay').classList.add('open');
}

function closeCategoryModal() {
  document.getElementById('categoryModalOverlay').classList.remove('open');
}

// =============================================
// CATÉGORIES — RENDER
// =============================================

function renderCategories() {
  const isMobile  = window.innerWidth < 960;
  const container = document.getElementById(
      isMobile ? 'categoriesContainerMobile' : 'categoriesContainer'
  );
  if (!container) return;
  container.innerHTML = '';

  activeCategories.forEach(catId => {
    const cat      = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    const catHabits = habits.filter(h => h.category_id === catId);

    const block = document.createElement('div');
    block.className = 'category-block';

    block.innerHTML = `
      <div class="category-header">
        <span class="category-emoji">${cat.emoji}</span>
        <span class="category-name">${cat.label}</span>
        <span class="category-count">${catHabits.length}</span>
        <span class="category-chevron">▾</span>
      </div>
      <div class="category-habits" id="catHabits_${isMobile ? 'mobile_' : ''}${catId}" data-open="true"></div>
    `;

    container.appendChild(block);

    // Remplir les habitudes de cette catégorie
    renderHabitsInContainer(catHabits, `catHabits_${isMobile ? 'mobile_' : ''}${catId}`);

    // Toggle open/close
    block.querySelector('.category-header').addEventListener('click', () => {
      const habitsDiv = block.querySelector('.category-habits');
      const chevron   = block.querySelector('.category-chevron');
      const isOpen    = habitsDiv.dataset.open !== 'false';
      habitsDiv.dataset.open  = isOpen ? 'false' : 'true';
      chevron.textContent     = isOpen ? '▸' : '▾';
    });
  });
}

// =============================================
// HABITS — RENDER (cards partagées)
// =============================================

function renderHabitsInContainer(habitsList, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const isPast = !isToday(selectedDate);
  container.innerHTML = '';

  if (habitsList.length === 0) {
    container.innerHTML = `<p class="category-empty">Aucune habitude dans cette catégorie</p>`;
    return;
  }

  habitsList.forEach(habit => {
    const val  = getLogForDate(habit.id, selectedDate);
    const goal = habit.goal || 1;
    const done = isHabitDoneOnDate(habit, selectedDate);
    const { current, best } = calculateStreak(habit.id, habit.type, goal);

    const streakLabel = current > 0
        ? `🔥 ${current}j${best !== current ? ` · max ${best}j` : ''}`
        : (best > 0 ? `max ${best}j` : '');

    const card = document.createElement('div');
    card.className = `habit-card${done ? ' completed' : ''}${isPast ? ' past-view' : ''}`;
    card.style.setProperty('--habit-color', habit.color);

    if (habit.type === 'check') {
      card.innerHTML = `
        <div class="habit-info">
          <div class="habit-name">${escHtml(habit.name)}</div>
          <div class="habit-meta">
            <span class="streak-badge ${current > 2 ? 'hot' : ''}">${streakLabel}</span>
          </div>
        </div>
        <div class="habit-actions">
          ${!isPast ? `
            <button class="edit-btn" data-id="${habit.id}" title="Modifier">✎</button>
            <button class="del-btn"  data-id="${habit.id}" title="Supprimer">🗑</button>
          ` : ''}
          <button class="check-btn ${done ? 'done' : ''}" data-id="${habit.id}"
            style="border-color:${habit.color};${done ? `background:${habit.color}` : ''}">
            ${done ? '✓' : ''}
          </button>
        </div>`;
    } else {
      const count = typeof val === 'number' ? val : 0;
      card.innerHTML = `
        <div class="habit-info">
          <div class="habit-name">${escHtml(habit.name)}</div>
          <div class="habit-meta">
            <span class="streak-badge ${current > 2 ? 'hot' : ''}">${streakLabel}</span>
          </div>
        </div>
        <div class="habit-actions">
          ${!isPast ? `
            <button class="edit-btn" data-id="${habit.id}" title="Modifier">✎</button>
            <button class="del-btn"  data-id="${habit.id}" title="Supprimer">🗑</button>
          ` : ''}
          <div class="counter-wrap">
            <button class="counter-btn counter-dec" data-id="${habit.id}">−</button>
            <span class="counter-val ${done ? 'goal-met' : ''}" style="${done ? `color:${habit.color}` : ''}">${count}/${goal}</span>
            <button class="counter-btn counter-inc" data-id="${habit.id}">+</button>
          </div>
        </div>`;
    }

    container.appendChild(card);
  });

  // Events
  container.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isToday(selectedDate)) return;
      const cur = getLogForDate(btn.dataset.id, selectedDate);
      await setLog(btn.dataset.id, cur === true ? false : true, selectedDate);
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-inc').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number'
          ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      await setLog(btn.dataset.id, cur + 1, selectedDate);
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-dec').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number'
          ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      if (cur > 0) await setLog(btn.dataset.id, cur - 1, selectedDate);
      refreshAll();
    });
  });

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteHabit(btn.dataset.id));
  });
}

// Habitudes sans catégorie
function renderHabits() {
  const isMobile  = window.innerWidth < 960;
  const container = document.getElementById(
      isMobile ? 'habitsContainerMobile' : 'habitsContainer'
  );
  if (!container) return;

  const uncategorized = habits.filter(h => !h.category_id);

  if (habits.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <p>Aucune habitude pour l'instant.</p>
        <p style="margin-top:4px;color:#555;font-size:12px">Ajoutez votre première habitude</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  renderHabitsInContainer(uncategorized, container.id);
}

// =============================================
// STATS
// =============================================

function updateStats() {
  const isMobile       = window.innerWidth < 960;
  const statsSection   = document.getElementById(isMobile ? 'statsSectionMobile'   : 'statsSection');
  const grid           = document.getElementById(isMobile ? 'statsGridMobile'       : 'statsGrid');

  if (habits.length === 0) {
    statsSection.style.display   = 'none';
    return;
  }
  statsSection.style.display   = '';
  grid.innerHTML = '';

  habits.forEach(habit => {
    const days = [], labels = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = offsetDate(-i);
      days.push(isHabitDoneOnDate(habit, dateStr) ? 1 : 0);
      const d = new Date(dateStr + 'T00:00:00');
      labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2));
    }

    const pct  = Math.round((days.filter(Boolean).length / 7) * 100);
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.setProperty('--habit-color', habit.color);
    card.innerHTML = `
      <div class="stat-card-header">
        <div class="stat-name">${escHtml(habit.name)}</div>
        <div class="stat-pct">${pct}%</div>
      </div>
      <div class="stat-bar-bg">
        <div class="stat-bar-fill" style="width:${pct}%;background:${habit.color}"></div>
      </div>
      <canvas class="stat-mini-canvas" id="canvas_${habit.id}" height="40"></canvas>`;
    grid.appendChild(card);

    requestAnimationFrame(() => {
      drawMiniChart(document.getElementById(`canvas_${habit.id}`), days, labels, habit.color);
    });
  });
}

function drawMiniChart(canvas, data, labels, color) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.offsetWidth;
  const h   = 40;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const n = data.length, gap = 4;
  const barW = (w - gap * (n - 1)) / n;
  const maxH = h - 14;
  ctx.clearRect(0, 0, w, h);

  data.forEach((val, i) => {
    const x = i * (barW + gap), barH = val ? maxH : 5, y = maxH - barH;
    ctx.fillStyle = val ? color : 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `9px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, h - 2);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// =============================================
// MODAL HABITUDE
// =============================================

function openModal(editId = null) {
  editingId        = editId;
  selectedColor    = '#FF6B6B';
  selectedType     = 'check';
  selectedCategory = null;

  const title   = document.getElementById('modalTitle');
  const nameInp = document.getElementById('habitName');
  const goalInp = document.getElementById('counterGoal');

  if (editId) {
    const h = habits.find(h => h.id === editId);
    if (!h) return;
    title.textContent = "Modifier l'habitude";
    nameInp.value     = h.name;
    selectedColor     = h.color;
    selectedType      = h.type;
    selectedCategory  = h.category_id || null;
    goalInp.value     = h.goal || 1;
  } else {
    title.textContent = 'Nouvelle habitude';
    nameInp.value     = '';
    goalInp.value     = 1;
  }

  syncTypeButtons();
  syncColorSwatches();
  syncCategoryPicker();
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => nameInp.focus(), 300);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function syncTypeButtons() {
  document.querySelectorAll('.type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === selectedType));
  document.getElementById('counterGoalGroup').style.display =
      selectedType === 'counter' ? '' : 'none';
}

function syncColorSwatches() {
  document.querySelectorAll('.color-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === selectedColor));
}

function syncCategoryPicker() {
  const picker = document.getElementById('habitCategoryPicker');
  if (!picker) return;
  picker.innerHTML = '';

  // Option "Aucune"
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = `habit-cat-btn${!selectedCategory ? ' active' : ''}`;
  noneBtn.innerHTML = `<span>—</span><span>Aucune</span>`;
  noneBtn.addEventListener('click', () => {
    selectedCategory = null;
    syncCategoryPicker();
  });
  picker.appendChild(noneBtn);

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `habit-cat-btn${selectedCategory === cat.id ? ' active' : ''}`;
    btn.innerHTML = `<span>${cat.emoji}</span><span>${cat.label}</span>`;
    btn.addEventListener('click', () => {
      selectedCategory = cat.id;
      syncCategoryPicker();
    });
    picker.appendChild(btn);
  });
}

// =============================================
// CRUD HABITS
// =============================================

async function saveHabit(e) {
  e.preventDefault();
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;
  const goal = parseInt(document.getElementById('counterGoal').value) || 1;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { showToast('Session expirée, reconnecte-toi'); return; }

  const payload = {
    name,
    goal,
    color:       selectedColor,
    type:        selectedType,
    category_id: selectedCategory || null,
    user_id:     user.id
  };

  if (editingId) {
    const { error } = await supabaseClient.from('habits').update(payload).eq('id', editingId);
    if (error) { showToast('Erreur lors de la modification ✗'); return; }
    showToast('Habitude modifiée ✓');
  } else {
    const { error } = await supabaseClient.from('habits').insert(payload);
    if (error) { showToast('Erreur lors de la création ✗'); return; }
    showToast('Habitude créée ✓');
  }

  closeModal();
  await loadData();
  refreshAll();
}

async function deleteHabit(id) {
  if (!confirm('Supprimer cette habitude et toutes ses données ?')) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { showToast('Session expirée, reconnecte-toi'); return; }

  await supabaseClient.from('logs').delete().eq('habit_id', id).eq('user_id', user.id);
  const { error } = await supabaseClient.from('habits').delete().eq('id', id);
  if (error) { showToast('Erreur lors de la suppression ✗'); return; }

  showToast('Habitude supprimée');
  await loadData();
  refreshAll();
}

// =============================================
// EXPORT / IMPORT / RESET
// =============================================

function exportData() {
  const blob = new Blob(
      [JSON.stringify({ habits, logs, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
  );
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `habitly-${today()}.json`
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Export réussi ✓');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.habits)) throw new Error('Format invalide');
      habits = data.habits;
      logs   = data.logs || {};
      refreshAll();
      showToast('Import réussi ✓');
    } catch {
      showToast('Erreur : fichier invalide ✗');
    }
  };
  reader.readAsText(file);
}

async function resetData() {
  if (!confirm('Supprimer TOUTES les données ? Action irréversible.')) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  await supabaseClient.from('logs').delete().eq('user_id', user.id);
  await supabaseClient.from('habits').delete().eq('user_id', user.id);
  habits = []; logs = {};
  refreshAll();
  showToast('Données réinitialisées');
}

// =============================================
// TOAST
// =============================================

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// =============================================
// HELPERS
// =============================================

function escHtml(s) {
  return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

function refreshAll() {
  renderTimeline();
  updateDayHeader();
  renderCategories();
  renderHabits();
  updateStats();
}

// =============================================
// MOBILE NAV
// =============================================

function initMobileNav() {
  const navHabits  = document.getElementById('navHabits');
  const navStats   = document.getElementById('navStats');
  const viewHabits = document.getElementById('mobileHabitsView');
  const viewStats  = document.getElementById('mobileStatsView');

  navHabits.addEventListener('click', () => {
    viewHabits.style.display = 'flex';
    viewStats.style.display  = 'none';
    navHabits.classList.add('active');
    navStats.classList.remove('active');
  });

  navStats.addEventListener('click', () => {
    viewStats.style.display  = 'flex';
    viewHabits.style.display = 'none';
    navStats.classList.add('active');
    navHabits.classList.remove('active');
  });
}

// =============================================
// START APP
// =============================================

async function startApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display  = 'block';

  selectedDate = today();
  await loadData();

  // Initiales profil
  const { data: { user } } = await supabaseClient.auth.getUser();
  const parts = user.email.split('@')[0].split('.');
  const initials = parts.length >= 2
      ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  document.getElementById('profileBtn').textContent = initials;

  initProfileListeners();

  // Boutons habitudes
  document.getElementById('addHabitBtn').addEventListener('click', () => openModal());
  document.getElementById('addHabitBtnMobile').addEventListener('click', () => openModal());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('habitForm').addEventListener('submit', saveHabit);

  document.querySelectorAll('.type-btn').forEach(b =>
      b.addEventListener('click', () => { selectedType = b.dataset.type; syncTypeButtons(); }));
  document.querySelectorAll('.color-swatch').forEach(s =>
      s.addEventListener('click', () => { selectedColor = s.dataset.color; syncColorSwatches(); }));

  // Boutons catégories
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('addCategoryBtnMobile').addEventListener('click', () => openCategoryModal());
  document.getElementById('categoryModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCategoryModal();
  });
  document.getElementById('cancelCategoryBtn').addEventListener('click', closeCategoryModal);

  // Export / Import / Reset
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () =>
      document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', resetData);

  window.addEventListener('resize', () => { updateStats(); renderCategories(); renderHabits(); });

  initMobileNav();
  refreshAll();

  requestAnimationFrame(() => {
    const sel = document.querySelector('.day-pill.today');
    if (sel) sel.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  });
}

// =============================================
// INIT
// =============================================

async function init() {
  initAuthListeners();

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    await startApp();
  } else {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('appSection').style.display  = 'none';
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      profileListenersInitialized = false;
      document.getElementById('authSection').style.display = 'flex';
      document.getElementById('appSection').style.display  = 'none';
      habits = []; logs = [];
      location.reload();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);