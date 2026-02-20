/**
 * HABITLY — script.js
 * Juan Lopez Loza
 */

const { createClient } = supabase
const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')

// =============================================
// ÉTAT GLOBAL
// =============================================

let habits = [];
let logs   = {};
let editingId    = null;
let selectedDate = today();   // Date affichée (YYYY-MM-DD)
let selectedColor = '#FF6B6B';
let selectedType  = 'check';

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
// STORAGE
// =============================================

async function loadData() {
  const { data: habitsData } = await supabase.from('habits').select('*');
  if (habitsData) habits = habitsData;

  const { data: logsData } = await supabase.from('logs').select('*');

  if (logsData) {
    logs = {};
    logsData.forEach(row => {

      if (!logs[row.date]) {
        logs[row.date] = {};
      }
      logs[row.date][row.habit_id] = row.value;
    });
  }

  refreshAll();
}

// =============================================
// LOG HELPERS
// =============================================

async function setLog(habitId, value, dateStr = null) {
  const d = dateStr || today();

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return console.error('No user found');

  const { data, error } = await supabase
      .from('logs')
      .upsert({
        user_id : user.id,
        habit_id: habitId,
        date: d,
        value: value
      })

  if (error) throw error;
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
  // Current streak (depuis aujourd'hui vers passé)
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d    = offsetDate(-i);
    const val  = (logs[d] || {})[habitId];
    const done = habitType === 'check' ? val === true : (typeof val === 'number' && val >= goal);
    if (done) current++;
    else break;
  }

  // Best streak
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

/**
 * Calcule le % de complétion globale pour une date donnée.
 * Retourne { done, total, pct }
 */
function getDayProgress(dateStr) {
  if (habits.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  habits.forEach(h => { if (isHabitDoneOnDate(h, dateStr)) done++; });
  const total = habits.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

// =============================================
// TIMELINE BANNER
// =============================================

const TIMELINE_DAYS = 90; // 90 jours dans le passé

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
    if (isToday(dateStr)) pill.classList.add('today');
    if (dateStr === selectedDate) pill.classList.add('selected');
    if (prog.pct === 100) pill.classList.add('is-completed');
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

  // Scroll jusqu'au jour sélectionné
  requestAnimationFrame(() => {
    const sel = track.querySelector('.day-pill.selected');
    if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  // Met à jour les pills
  document.querySelectorAll('.day-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.date === dateStr);
  });
  updateDayHeader();
  renderHabits();
}

// =============================================
// DAY HEADER (anneau de progression)
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
    badge.textContent = 'Aujourd\'hui';
    badge.className   = 'day-mode-badge is-today';
    if (prog.pct === 100) badge.className   = 'day-mode-badge is-today is-completed';
  } else {
    const d = new Date(selectedDate + 'T00:00:00');
    badge.textContent = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    badge.className   = 'day-mode-badge is-past';
    if (prog.pct === 100) badge.className   = 'day-mode-badge is-past is-completed';
  }

  main.textContent = `${prog.done} / ${prog.total}`;
  ring.textContent  = `${prog.pct}%`;

  // Circonférence = 2π×18 ≈ 113.1
  const offset = 113.1 - (113.1 * prog.pct / 100);
  fill.style.strokeDashoffset = offset;

  // Couleur selon complétion
  if (prog.pct === 100) {
    fill.style.stroke = '#06D6A0';
  } else if (prog.pct >= 50) {
    fill.style.stroke = '#FFD166';
  } else {
    fill.style.stroke = '#FF6B6B';
  }
}

// =============================================
// RENDER HABITS
// =============================================

function renderHabits() {
  const container = document.getElementById('habitsContainer');
  const isPast    = !isToday(selectedDate);

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

  habits.forEach(habit => {
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
    btn.addEventListener('click', () => {
      if (!isToday(selectedDate)) return; // sécurité (past-view désactive déjà visuellement)
      const cur = getLogForDate(btn.dataset.id, selectedDate);
      setLog(btn.dataset.id, cur === true ? false : true, selectedDate);
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number'
        ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      setLog(btn.dataset.id, cur + 1, selectedDate);
      refreshAll();
    });
  });

  container.querySelectorAll('.counter-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isToday(selectedDate)) return;
      const cur = typeof getLogForDate(btn.dataset.id, selectedDate) === 'number'
        ? getLogForDate(btn.dataset.id, selectedDate) : 0;
      if (cur > 0) setLog(btn.dataset.id, cur - 1, selectedDate);
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

// =============================================
// STATS (7 derniers jours — toujours depuis today)
// =============================================

function updateStats() {
  const statsSection   = document.getElementById('statsSection');
  const heatmapSection = document.getElementById('heatmapSection');
  const grid           = document.getElementById('statsGrid');

  if (habits.length === 0) {
    statsSection.style.display   = 'none';
    heatmapSection.style.display = 'none';
    return;
  }
  statsSection.style.display   = '';
  heatmapSection.style.display = '';

  grid.innerHTML = '';

  habits.forEach(habit => {
    const goal   = habit.goal || 1;
    const days   = [];
    const labels = [];

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

  const n    = data.length;
  const gap  = 4;
  const barW = (w - gap * (n - 1)) / n;
  const maxH = h - 14;

  ctx.clearRect(0, 0, w, h);

  data.forEach((val, i) => {
    const x    = i * (barW + gap);
    const barH = val ? maxH : 5;
    const y    = maxH - barH;

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
// HEATMAP
// =============================================

function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  if (habits.length === 0) return;

  const weeks = 12;
  const now   = new Date();
  const dow   = (now.getDay() + 6) % 7; // lundi = 0
  const start = new Date(now);
  start.setDate(now.getDate() - dow - (weeks - 1) * 7);

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  for (let w = 0; w < weeks; w++) {
    const col = document.createElement('div');
    col.className = 'heatmap-col';

    for (let d = 0; d < 7; d++) {
      const cell    = document.createElement('div');
      cell.className = 'heatmap-cell';

      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + w * 7 + d);
      const dateStr  = cellDate.toISOString().slice(0, 10);
      cell.title     = dateStr;

      if (logs[dateStr] && habits.length > 0) {
        const prog = getDayProgress(dateStr);
        if      (prog.pct >= 100) cell.dataset.level = '4';
        else if (prog.pct >= 75)  cell.dataset.level = '3';
        else if (prog.pct >= 50)  cell.dataset.level = '2';
        else if (prog.pct >  0)   cell.dataset.level = '1';
      }

      // Click sur heatmap → sélectionne le jour
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => selectDate(dateStr));

      col.appendChild(cell);
    }

    grid.appendChild(col);
  }

  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.innerHTML = `
    <span>Moins</span>
    <div class="heatmap-legend-cell" style="background:rgba(255,107,107,0.2)"></div>
    <div class="heatmap-legend-cell" style="background:rgba(255,107,107,0.45)"></div>
    <div class="heatmap-legend-cell" style="background:rgba(255,107,107,0.7)"></div>
    <div class="heatmap-legend-cell" style="background:rgba(255,107,107,1)"></div>
    <span>Plus</span>`;

  container.appendChild(grid);
  container.appendChild(legend);
}

// =============================================
// MODAL
// =============================================

function openModal(editId = null) {
  editingId    = editId;
  selectedColor = '#FF6B6B';
  selectedType  = 'check';

  const title   = document.getElementById('modalTitle');
  const nameInp = document.getElementById('habitName');
  const goalInp = document.getElementById('counterGoal');

  if (editId) {
    const h = habits.find(h => h.id === editId);
    if (!h) return;
    title.textContent = 'Modifier l\'habitude';
    nameInp.value     = h.name;
    selectedColor     = h.color;
    selectedType      = h.type;
    goalInp.value     = h.goal || 1;
  } else {
    title.textContent = 'Nouvelle habitude';
    nameInp.value     = '';
    goalInp.value     = 1;
  }

  syncTypeButtons();
  syncColorSwatches();
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

// =============================================
// CRUD
// =============================================

async function saveHabit(e) {
  e.preventDefault();
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;
  const goal = parseInt(document.getElementById('counterGoal').value) || 1;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user){
    showToast('Erreur', 'session expirée');
    return;
  }

  const newHabit = {name: name, goal: goal, color: selectedColor, type: selectedType, user_id: user.id};

  if (editingId) {
    await supabase.from('habits').update(newHabit).eq('id', editingId)
    showToast('Habitude modifiée ✓');
  } else {
    await supabase.from('habits').insert(newHabit)
    showToast('Habitude créée ✓');
  }

  closeModal();
  await loadData();
  refreshAll();
}

async function deleteHabit(id) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user){
    showToast('Erreur', 'session expirée');
    return;
  }

  if (!confirm('Supprimer cette habitude et toutes ses données ?')) return;
  await supabase.from('habits').delete().eq('id', id);
  await loadData();
  refreshAll();
  showToast('Habitude supprimée');
}

// =============================================
// EXPORT / IMPORT / RESET
// =============================================

function exportData() {
  const blob = new Blob([JSON.stringify({ habits, logs, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `habitly-${today()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
  showToast('Export réussi ✓');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.habits)) throw 0;
      habits = data.habits; logs = data.logs || {};
      saveData(); refreshAll();
      showToast('Import réussi ✓');
    } catch { showToast('Erreur : fichier invalide ✗'); }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm('Supprimer TOUTES les données ? Action irréversible.')) return;
  habits = []; logs = {};
  saveData(); refreshAll();
  showToast('Données réinitialisées');
}

// =============================================
// TOAST
// =============================================

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// =============================================
// HELPERS
// =============================================

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function refreshAll() {
  renderTimeline();
  updateDayHeader();
  renderHabits();
  updateStats();
  renderHeatmap();
}

// =============================================
// INIT
// =============================================

async function init() {
  await loadData();
  selectedDate = today();

  // Buttons
  document.getElementById('addHabitBtn').addEventListener('click', () => openModal());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('habitForm').addEventListener('submit', saveHabit);

  document.querySelectorAll('.type-btn').forEach(b =>
    b.addEventListener('click', () => { selectedType = b.dataset.type; syncTypeButtons(); }));

  document.querySelectorAll('.color-swatch').forEach(s =>
    s.addEventListener('click', () => { selectedColor = s.dataset.color; syncColorSwatches(); }));

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () =>
    document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    importData(e.target.files[0]); e.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', resetData);

  window.addEventListener('resize', () => updateStats());

  // Premier rendu
  refreshAll();

  // Scroll timeline vers aujourd'hui
  requestAnimationFrame(() => {
    const sel = document.querySelector('.day-pill.today');
    if (sel) sel.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  });
}

document.addEventListener('DOMContentLoaded', init);
