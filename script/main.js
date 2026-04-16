import { supabaseClient } from "./api/supabaseClient.js";
import { CATEGORIES } from "./utils/constants.js";
import { today, offsetDate, formatDisplayDate, isToday } from "./utils/date.js";
import { escHtml, roundRect } from "./utils/helpers.js";
import { fetchHabits, fetchLogs, saveHabit, deleteHabit } from "./services/habits.js";
import { setLog } from "./services/logs.js";
import { showToast } from "./services/ui.js";
import { initAuthListeners } from "./auth/authService.js";

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
let profileListenersInitialized = false;
let activeCategories = JSON.parse(localStorage.getItem('activeCategories') || '[]');

// =============================================
// DATA LOADING
// =============================================
async function loadData() {
  habits = await fetchHabits();
  logs = await fetchLogs();
}

// =============================================
// LOGIC HELPERS
// =============================================
function getLogForDate(habitId, dateStr) {
  return (logs[dateStr] || {})[habitId];
}

function isHabitDoneOnDate(habit, dateStr) {
  const val = getLogForDate(habit.id, dateStr);
  if (habit.type === 'check') return val === true;
  return typeof val === 'number' && val >= (habit.goal || 1);
}

function calculateStreak(habitId, habitType, goal = 1) {
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d    = offsetDate(-i);
    const done = isHabitDoneOnDate({id: habitId, type: habitType, goal}, d);
    if (done) current++;
    else break;
  }

  let best = 0, streak = 0;
  for (let i = 364; i >= 0; i--) {
    const d    = offsetDate(-i);
    const done = isHabitDoneOnDate({id: habitId, type: habitType, goal}, d);
    if (done) { streak++; best = Math.max(best, streak); }
    else streak = 0;
  }
  return { current, best };
}

function getDayProgress(dateStr) {
  if (habits.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  habits.forEach(h => { if (isHabitDoneOnDate(h, dateStr)) done++; });
  const total = habits.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

// =============================================
// UI RENDERING
// =============================================

function refreshAll() {
  renderTimeline();
  updateDayHeader();
  renderCategories();
  renderHabits();
  updateStats();
}

const TIMELINE_DAYS = 90;
function renderTimeline() {
  const track = document.getElementById('timelineTrack');
  if (!track) return;
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

function updateDayHeader() {
  const prog  = getDayProgress(selectedDate);
  const label = document.getElementById('dayFullLabel');
  const badge = document.getElementById('dayModeBadge');
  const main  = document.getElementById('dayProgressMain');
  const ring  = document.getElementById('ringLabel');
  const fill  = document.getElementById('ringFill');

  if (label) label.textContent = formatDisplayDate(selectedDate);

  if (badge) {
    if (isToday(selectedDate)) {
      badge.textContent = "Aujourd'hui";
      badge.className   = `day-mode-badge is-today${prog.pct === 100 ? ' is-completed' : ''}`;
    } else {
      const d = new Date(selectedDate + 'T00:00:00');
      badge.textContent = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      badge.className   = `day-mode-badge is-past${prog.pct === 100 ? ' is-completed' : ''}`;
    }
  }

  if (main) main.textContent = `${prog.done} / ${prog.total}`;
  if (ring) ring.textContent = `${prog.pct}%`;
  if (fill) {
    const offset = 113.1 - (113.1 * prog.pct / 100);
    fill.style.strokeDashoffset = offset;
    fill.style.stroke = prog.pct === 100 ? '#06D6A0' : prog.pct >= 50 ? '#FFD166' : '#FF6B6B';
  }
}

function renderCategories() {
  const isMobile  = window.innerWidth < 960;
  const container = document.getElementById(isMobile ? 'categoriesContainerMobile' : 'categoriesContainer');
  if (!container) return;
  container.innerHTML = '';

  activeCategories.forEach(catId => {
    const cat      = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    const catHabits = habits.filter(h => h.category_id === catId);

    const block = document.createElement('div');
    block.className = 'category-block';
    const containerId = `catHabits_${isMobile ? 'mobile_' : ''}${catId}`;

    block.innerHTML = `
      <div class="category-header">
        <span class="category-emoji">${cat.emoji}</span>
        <span class="category-name">${cat.label}</span>
        <span class="category-count">${catHabits.length}</span>
        <span class="category-chevron">▾</span>
      </div>
      <div class="category-habits" id="${containerId}" data-open="true"></div>
    `;

    container.appendChild(block);
    renderHabitsInContainer(catHabits, containerId);

    block.querySelector('.category-header').addEventListener('click', () => {
      const habitsDiv = block.querySelector('.category-habits');
      const chevron   = block.querySelector('.category-chevron');
      const isOpen    = habitsDiv.dataset.open !== 'false';
      habitsDiv.dataset.open  = isOpen ? 'false' : 'true';
      chevron.textContent     = isOpen ? '▸' : '▾';
    });
  });
}

function renderHabits() {
  const isMobile  = window.innerWidth < 960;
  const container = document.getElementById(isMobile ? 'habitsContainerMobile' : 'habitsContainer');
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
      await loadData();
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-inc').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number' ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      await setLog(btn.dataset.id, cur + 1, selectedDate);
      await loadData();
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-dec').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number' ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      if (cur > 0) {
        await setLog(btn.dataset.id, cur - 1, selectedDate);
        await loadData();
        refreshAll();
      }
    });
  });

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });

  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette habitude et toutes ses données ?')) return;
      try {
        await deleteHabit(btn.dataset.id);
        showToast('Habitude supprimée');
        await loadData();
        refreshAll();
      } catch (err) {
        showToast('Erreur lors de la suppression');
      }
    });
  });
}

function updateStats() {
  const isMobile       = window.innerWidth < 960;
  const statsSection   = document.getElementById(isMobile ? 'statsSectionMobile'   : 'statsSection');
  const grid           = document.getElementById(isMobile ? 'statsGridMobile'       : 'statsGrid');

  if (!statsSection || habits.length === 0) {
    if (statsSection) statsSection.style.display = 'none';
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

// =============================================
// MODALS
// =============================================
function openModal(editId = null) {
  editingId        = editId;
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
    selectedColor     = '#FF6B6B';
    selectedType      = 'check';
    selectedCategory  = null;
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

function openCategoryModal() {
  const picker = document.getElementById('categoryPicker');
  if (!picker) return;
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
// ACTIONS
// =============================================
async function onHabitSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;
  const goal = parseInt(document.getElementById('counterGoal').value) || 1;

  try {
    await saveHabit({
      name,
      goal,
      color: selectedColor,
      type: selectedType,
      category_id: selectedCategory
    }, editingId);

    showToast(editingId ? 'Habitude modifiée ✓' : 'Habitude créée ✓');
    closeModal();
    await loadData();
    refreshAll();
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement');
  }
}

// =============================================
// INITIALIZATION
// =============================================
function initProfileListeners() {
  if (profileListenersInitialized) return;
  profileListenersInitialized = true;

  const profileBtn = document.getElementById('profileBtn');
  const dropdown = document.getElementById('profileDropdown');

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
  }

  document.addEventListener('click', () => {
    if (dropdown) dropdown.classList.remove('open');
  });

  document.getElementById('deconnectBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  document.getElementById('deleteProfileBtn')?.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement ton compte et toutes tes données ?')) return;
    await supabaseClient.rpc('delete_user');
  });
}

function initMobileNav() {
  const navHabits  = document.getElementById('navHabits');
  const navStats   = document.getElementById('navStats');
  const viewHabits = document.getElementById('mobileHabitsView');
  const viewStats  = document.getElementById('mobileStatsView');

  if (navHabits && navStats) {
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
}

async function startApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display  = 'block';

  selectedDate = today();
  await loadData();

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    const parts = user.email.split('@')[0].split('.');
    const initials = parts.length >= 2
        ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    const pBtn = document.getElementById('profileBtn');
    if (pBtn) pBtn.textContent = initials;
  }

  initProfileListeners();
  initMobileNav();

  document.getElementById('addHabitBtn')?.addEventListener('click', () => openModal());
  document.getElementById('addHabitBtnMobile')?.addEventListener('click', () => openModal());
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('habitForm')?.addEventListener('submit', onHabitSubmit);

  document.querySelectorAll('.type-btn').forEach(b =>
    b.addEventListener('click', () => { selectedType = b.dataset.type; syncTypeButtons(); }));
  document.querySelectorAll('.color-swatch').forEach(s =>
    s.addEventListener('click', () => { selectedColor = s.dataset.color; syncColorSwatches(); }));

  document.getElementById('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('addCategoryBtnMobile')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('categoryModalOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCategoryModal();
  });
  document.getElementById('cancelCategoryBtn')?.addEventListener('click', closeCategoryModal);

  window.addEventListener('resize', () => { updateStats(); renderCategories(); renderHabits(); });

  refreshAll();

  requestAnimationFrame(() => {
    const sel = document.querySelector('.day-pill.today');
    if (sel) sel.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  });
}

async function init() {
  initAuthListeners(startApp);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await startApp();
  } else {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('appSection').style.display  = 'none';
  }

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      profileListenersInitialized = false;
      location.reload();
    } else if (event === 'SIGNED_IN') {
      startApp();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
