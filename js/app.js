import {
  DAY_TYPES,
  RADNI_SUBTIPOVI,
  ODSUSTVO_TIPOVI,
  registerUser,
  verifyLogin,
  setSession,
  getSession,
  clearSession,
  getCurrentUser,
  saveUser,
  setRecord,
  setRecordsBulk,
  getVacationSettings,
  saveVacationSettings,
} from './storage.js';
import { computeYearStats } from './stats.js';
import { renderForestBackdrop } from './forest.js';

const MJESECI = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];
const DANI_PUNI = ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja'];

const state = {
  user: null,
  entryYear: new Date().getFullYear(),
  entryMonth: new Date().getMonth(),
  overviewYear: new Date().getFullYear(),
  modalDateKey: null,
  modalTasks: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// Monday = 0 ... Sunday = 6
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

/* ==================== AUTH ==================== */

function showAuthError(msg) {
  const el = $('#authError');
  el.textContent = msg;
  el.hidden = !msg;
}

function initAuthScreen() {
  const tabLogin = $('#tabLogin');
  const tabRegister = $('#tabRegister');
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.hidden = false;
    registerForm.hidden = true;
    showAuthError('');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.hidden = false;
    loginForm.hidden = true;
    showAuthError('');
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const username = $('#loginUsername').value;
    const pin = $('#loginPin').value;
    const remember = $('#loginRemember').checked;
    try {
      const user = await verifyLogin(username, pin);
      setSession(user.username, remember);
      enterApp(user);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const fullName = $('#regFullName').value;
    const username = $('#regUsername').value;
    const pin = $('#regPin').value;
    const pinConfirm = $('#regPinConfirm').value;
    const remember = $('#regRemember').checked;
    if (pin !== pinConfirm) {
      showAuthError('PIN-ovi se ne podudaraju.');
      return;
    }
    try {
      const user = await registerUser({ fullName, username, pin });
      setSession(user.username, remember);
      enterApp(user);
    } catch (err) {
      showAuthError(err.message);
    }
  });
}

function enterApp(user) {
  state.user = user;
  $('#authScreen').hidden = true;
  $('#mainApp').hidden = false;
  $('#userNameLabel').textContent = user.fullName;
  $('#settingsUserLabel').textContent = `${user.fullName} (${user.username})`;
  renderLegends();
  switchView('entry');
  renderEntryView();
}

function logout() {
  clearSession();
  state.user = null;
  $('#mainApp').hidden = true;
  $('#authScreen').hidden = false;
  $('#loginForm').reset();
  $('#loginRemember').checked = true;
}

/* ==================== NAV ==================== */

function switchView(view) {
  ['entry', 'overview', 'settings'].forEach((v) => {
    $(`#view-${v}`).hidden = v !== view;
  });
  $$('.nav-tabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'overview') renderOverviewView();
  if (view === 'settings') renderSettingsView();
}

function initNav() {
  $$('.nav-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  $('#logoutBtn').addEventListener('click', logout);
}

/* ==================== LEGEND ==================== */

function buildLegendHTML() {
  return Object.values(DAY_TYPES)
    .map(
      (t) => `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.label}</span>`
    )
    .join('');
}

function renderLegends() {
  $('#entryLegend').innerHTML = buildLegendHTML();
  $('#overviewLegend').innerHTML = buildLegendHTML();
}

/* ==================== UNOS DANA (DANI U REDOVIMA) ==================== */

function extraText(rec) {
  if (!rec) return '';
  if (rec.type === 'doznaka' && (rec.trees || rec.area)) {
    return `${rec.trees ? rec.trees + ' stabala' : ''}${rec.trees && rec.area ? ' · ' : ''}${rec.area ? rec.area + ' ha' : ''}`;
  }
  if (rec.type === 'vlake' && rec.km) {
    return `${rec.km} km vlaka`;
  }
  if (rec.type === 'kancelarija' && rec.note) {
    return rec.note;
  }
  return '';
}

function taskCounts(rec) {
  const tasks = rec?.tasks || [];
  return { total: tasks.length, done: tasks.filter((t) => t.done).length };
}

function renderMonthSummary(year, month) {
  const counts = {};
  let trees = 0;
  let area = 0;
  let km = 0;
  let tasksTotal = 0;
  let tasksDone = 0;
  const total = daysInMonth(year, month);

  for (let day = 1; day <= total; day++) {
    const rec = state.user.records[toKey(year, month, day)];
    if (!rec) continue;

    // zadaci se broje i na danima bez odabrane vrste dana
    const tc = taskCounts(rec);
    tasksTotal += tc.total;
    tasksDone += tc.done;

    if (!rec.type) continue;
    counts[rec.type] = (counts[rec.type] || 0) + 1;
    if (rec.type === 'doznaka') {
      trees += Number(rec.trees) || 0;
      area += Number(rec.area) || 0;
    }
    if (rec.type === 'vlake') km += Number(rec.km) || 0;
  }

  const radni = Object.entries(counts)
    .filter(([t]) => DAY_TYPES[t]?.group === 'radni')
    .reduce((sum, [, n]) => sum + n, 0);

  const parts = [`Radnih dana: <strong>${radni}</strong>`];
  if (trees) parts.push(`Stabala: <strong>${trees}</strong>`);
  if (area) parts.push(`Površina: <strong>${area.toFixed(2)} ha</strong>`);
  if (km) parts.push(`Vlake: <strong>${km.toFixed(2)} km</strong>`);
  if (counts.godisnji) parts.push(`Godišnji odmor: <strong>${counts.godisnji}</strong>`);
  if (counts.bolovanje) parts.push(`Bolovanje: <strong>${counts.bolovanje}</strong>`);
  if (counts.praznik) parts.push(`Praznik: <strong>${counts.praznik}</strong>`);
  if (counts.placeno) parts.push(`Plaćeno odsustvo: <strong>${counts.placeno}</strong>`);
  if (tasksTotal) parts.push(`Zadaci: <strong>${tasksDone}/${tasksTotal}</strong>`);

  $('#monthSummary').innerHTML = parts.map((p) => `<span>${p}</span>`).join('');
}

function renderEntryView() {
  const { entryYear, entryMonth } = state;
  $('#monthLabel').textContent = `${MJESECI[entryMonth]} ${entryYear}`;

  const body = $('#dayListBody');
  body.innerHTML = '';

  const totalDays = daysInMonth(entryYear, entryMonth);
  const todayKey = toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  let todayRow = null;

  for (let day = 1; day <= totalDays; day++) {
    const key = toKey(entryYear, entryMonth, day);
    const jsDay = new Date(entryYear, entryMonth, day).getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    const isToday = key === todayKey;
    const rec = state.user.records[key];

    const row = document.createElement('div');
    row.className = 'day-row' + (isWeekend ? ' weekend' : '') + (isToday ? ' today' : '');
    row.dataset.key = key;

    const dateCol = document.createElement('div');
    dateCol.className = 'col-date';
    dateCol.innerHTML = `<span class="dnum">${day}.</span> ${MJESECI[entryMonth].slice(0, 3)}`;
    row.appendChild(dateCol);

    const dayCol = document.createElement('div');
    dayCol.className = 'col-day';
    dayCol.textContent = DANI_PUNI[mondayIndex(jsDay)];
    row.appendChild(dayCol);

    const typeCol = document.createElement('div');
    typeCol.className = 'col-type';
    if (rec && rec.type && DAY_TYPES[rec.type]) {
      const type = DAY_TYPES[rec.type];
      typeCol.innerHTML = `<span class="day-badge" style="background:${type.color}">${type.label}</span>`;
    } else {
      typeCol.innerHTML = `<span class="day-badge empty-badge">+ Dodaj unos</span>`;
    }
    row.appendChild(typeCol);

    const extraCol = document.createElement('div');
    extraCol.className = 'col-extra';

    const detail = extraText(rec);
    if (detail) {
      const detailEl = document.createElement('span');
      detailEl.className = 'extra-detail';
      detailEl.textContent = detail;
      detailEl.title = detail;
      extraCol.appendChild(detailEl);
    }

    const { total, done } = taskCounts(rec);
    if (total) {
      const chip = document.createElement('span');
      chip.className = 'task-chip' + (done === total ? ' all-done' : '');
      chip.textContent = `Zadaci ${done}/${total}`;
      chip.title = rec.tasks.map((t) => `${t.done ? '✓' : '•'} ${t.text}`).join('\n');
      extraCol.appendChild(chip);
    }

    row.appendChild(extraCol);

    const chevron = document.createElement('div');
    chevron.className = 'col-chevron';
    chevron.textContent = '›';
    row.appendChild(chevron);

    row.addEventListener('click', () => openDayModal(key));
    body.appendChild(row);
    if (isToday) todayRow = row;
  }

  renderMonthSummary(entryYear, entryMonth);

  // Kada je prikazan tekući mjesec, pomjeri prikaz na današnji dan. Skrol se
  // poravnava na visinu reda kako nijedan red ne bi ostao presječen.
  if (todayRow) {
    const rowH = todayRow.offsetHeight || 46;
    const context = Math.max(1, Math.floor(body.clientHeight / rowH / 2) - 1);
    body.scrollTop = Math.max(0, todayRow.offsetTop - context * rowH);
  } else {
    body.scrollTop = 0;
  }
}

function initEntryNav() {
  $('#prevMonth').addEventListener('click', () => {
    state.entryMonth -= 1;
    if (state.entryMonth < 0) {
      state.entryMonth = 11;
      state.entryYear -= 1;
    }
    renderEntryView();
  });
  $('#nextMonth').addEventListener('click', () => {
    state.entryMonth += 1;
    if (state.entryMonth > 11) {
      state.entryMonth = 0;
      state.entryYear += 1;
    }
    renderEntryView();
  });
  $('#todayBtn').addEventListener('click', () => {
    const now = new Date();
    state.entryYear = now.getFullYear();
    state.entryMonth = now.getMonth();
    renderEntryView();
  });
}

/* ==================== MODAL ==================== */

function typeOptionHTML(key) {
  const t = DAY_TYPES[key];
  return `<label class="type-option" data-key="${key}">
    <input type="radio" name="dayType" value="${key}" />
    <span class="legend-dot" style="background:${t.color}"></span>
    <span>${t.label}</span>
  </label>`;
}

function renderExtraFields(selectedType, rec) {
  const container = $('#extraFields');

  if (selectedType === 'doznaka') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="treesInput">Broj stabala</label>
          <input id="treesInput" type="number" min="0" />
        </div>
        <div class="field">
          <label for="areaInput">Površina (ha)</label>
          <input id="areaInput" type="number" min="0" step="0.01" />
        </div>
      </div>`;
    $('#treesInput').value = rec?.trees ?? '';
    $('#areaInput').value = rec?.area ?? '';
  } else if (selectedType === 'vlake') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="kmInput">Kilometraža vlaka (km)</label>
          <input id="kmInput" type="number" min="0" step="0.01" />
        </div>
      </div>`;
    $('#kmInput').value = rec?.km ?? '';
  } else if (selectedType === 'kancelarija') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="noteInput">Napomena</label>
          <textarea id="noteInput" rows="3" maxlength="600" placeholder="Šta je rađeno u kancelariji…"></textarea>
        </div>
      </div>`;
    $('#noteInput').value = rec?.note ?? '';
  } else {
    container.innerHTML = '';
  }
}

/* --- Zadaci unutar dana --- */

function renderTaskList() {
  const list = $('#taskList');
  list.innerHTML = '';

  if (!state.modalTasks.length) {
    const empty = document.createElement('p');
    empty.className = 'task-empty';
    empty.textContent = 'Nema zadataka za ovaj dan.';
    list.appendChild(empty);
    return;
  }

  state.modalTasks.forEach((task, index) => {
    const item = document.createElement('label');
    item.className = 'task-item' + (task.done ? ' done' : '');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!task.done;
    check.addEventListener('change', () => {
      state.modalTasks[index].done = check.checked;
      renderTaskList();
    });

    // textContent (a ne innerHTML) — tekst zadatka je korisnički unos
    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-del';
    del.title = 'Obriši zadatak';
    del.setAttribute('aria-label', 'Obriši zadatak');
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.preventDefault();
      state.modalTasks.splice(index, 1);
      renderTaskList();
    });

    item.append(check, text, del);
    list.appendChild(item);
  });
}

function addTaskFromInput() {
  const input = $('#taskInput');
  const text = input.value.trim();
  if (!text) return;
  state.modalTasks.push({ text, done: false });
  input.value = '';
  renderTaskList();
  input.focus();
}

function openDayModal(key) {
  state.modalDateKey = key;
  const rec = state.user.records[key];
  state.modalTasks = (rec?.tasks || []).map((t) => ({ text: t.text, done: !!t.done }));
  $('#taskInput').value = '';
  renderTaskList();
  const [y, m, d] = key.split('-').map(Number);
  $('#modalDateLabel').textContent = `${d}. ${MJESECI[m - 1]} ${y}.`;

  $('#radniOptions').innerHTML = RADNI_SUBTIPOVI.map(typeOptionHTML).join('');
  $('#odsustvoOptions').innerHTML = ODSUSTVO_TIPOVI.map(typeOptionHTML).join('');

  const radios = $$('#dayModalOverlay input[type=radio]');
  radios.forEach((r) => {
    r.checked = rec && rec.type === r.value;
    r.addEventListener('change', () => {
      $$('.type-option').forEach((opt) => opt.classList.toggle('selected', opt.dataset.key === r.value));
      renderExtraFields(r.value, rec && rec.type === r.value ? rec : null);
    });
  });
  $$('.type-option').forEach((opt) => opt.classList.toggle('selected', rec && rec.type === opt.dataset.key));

  renderExtraFields(rec?.type, rec);

  $('#dayModalOverlay').hidden = false;
}

function closeDayModal() {
  $('#dayModalOverlay').hidden = true;
  state.modalDateKey = null;
}

function saveDayModal() {
  const selected = $('#dayModalOverlay input[name=dayType]:checked');

  // Zadatak upisan u polje, a nije potvrđen dugmetom "Dodaj", ipak se čuva.
  const pending = $('#taskInput').value.trim();
  if (pending) {
    state.modalTasks.push({ text: pending, done: false });
    $('#taskInput').value = '';
  }

  const tasks = state.modalTasks
    .filter((t) => t.text.trim())
    .map((t) => ({ text: t.text.trim(), done: !!t.done }));

  // Ni vrsta dana ni zadaci — dan ostaje prazan.
  if (!selected && !tasks.length) {
    setRecord(state.user, state.modalDateKey, null);
    closeDayModal();
    renderEntryView();
    return;
  }

  const record = {};

  if (selected) {
    const type = selected.value;
    record.type = type;
    if (type === 'doznaka') {
      const trees = $('#treesInput')?.value;
      const area = $('#areaInput')?.value;
      if (trees !== '' && trees != null) record.trees = Number(trees);
      if (area !== '' && area != null) record.area = Number(area);
    } else if (type === 'vlake') {
      const km = $('#kmInput')?.value;
      if (km !== '' && km != null) record.km = Number(km);
    } else if (type === 'kancelarija') {
      const note = $('#noteInput')?.value.trim();
      if (note) record.note = note;
    }
  }

  if (tasks.length) record.tasks = tasks;

  setRecord(state.user, state.modalDateKey, record);
  closeDayModal();
  renderEntryView();
}

function clearDayModal() {
  setRecord(state.user, state.modalDateKey, null);
  closeDayModal();
  renderEntryView();
}

function initModal() {
  $('#modalCloseBtn').addEventListener('click', closeDayModal);
  $('#dayModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'dayModalOverlay') closeDayModal();
  });
  $('#saveDayBtn').addEventListener('click', saveDayModal);
  $('#clearDayBtn').addEventListener('click', clearDayModal);

  $('#taskAddBtn').addEventListener('click', addTaskFromInput);
  $('#taskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTaskFromInput();
    }
  });
}

/* ==================== MODAL: RASPON DANA (npr. godišnji odmor od-do) ==================== */

function openRangeModal() {
  const today = toKey(state.entryYear, state.entryMonth, 1);
  $('#rangeFrom').value = today;
  $('#rangeTo').value = today;
  $('#rangeSkipWeekends').checked = true;
  $('#rangeOptions').innerHTML = ODSUSTVO_TIPOVI.map(typeOptionHTML)
    .join('')
    .replaceAll('name="dayType"', 'name="rangeType"');

  const radios = $$('#rangeOptions input[type=radio]');
  radios.forEach((r) => {
    r.addEventListener('change', () => {
      $$('#rangeOptions .type-option').forEach((opt) => opt.classList.toggle('selected', opt.dataset.key === r.value));
    });
  });
  if (radios[0]) {
    radios[0].checked = true;
    radios[0].closest('.type-option').classList.add('selected');
  }

  $('#rangeModalOverlay').hidden = false;
}

function closeRangeModal() {
  $('#rangeModalOverlay').hidden = true;
}

function saveRangeModal() {
  const fromVal = $('#rangeFrom').value;
  const toVal = $('#rangeTo').value;
  const selected = $('#rangeOptions input[type=radio]:checked');
  if (!fromVal || !toVal || !selected) {
    closeRangeModal();
    return;
  }
  const skipWeekends = $('#rangeSkipWeekends').checked;
  const type = selected.value;

  const start = new Date(`${fromVal}T00:00:00`);
  const end = new Date(`${toVal}T00:00:00`);
  if (start > end) {
    alert('Datum "od" mora biti prije ili jednak datumu "do".');
    return;
  }

  const keys = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
    if (!skipWeekends || !isWeekend) {
      keys.push(toKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  setRecordsBulk(state.user, keys, { type });
  closeRangeModal();
  renderEntryView();
}

function initRangeModal() {
  $('#rangeBtn').addEventListener('click', openRangeModal);
  $('#rangeModalCloseBtn').addEventListener('click', closeRangeModal);
  $('#rangeCancelBtn').addEventListener('click', closeRangeModal);
  $('#rangeModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'rangeModalOverlay') closeRangeModal();
  });
  $('#rangeSaveBtn').addEventListener('click', saveRangeModal);
}

/* ==================== GODIŠNJI PREGLED ==================== */

function renderOverviewView() {
  const year = state.overviewYear;
  $('#yearLabel').textContent = String(year);
  const stats = computeYearStats(state.user, year);

  const C = DAY_TYPES;
  const statCards = [
    { accent: C.teren.color, label: 'Radnih dana ukupno', value: stats.radniDani },
    { accent: C.doznaka.color, label: 'Doznaka — broj stabala', value: stats.trees },
    { accent: C.doznaka.color, label: 'Doznaka — površina', value: `${stats.area.toFixed(2)} ha` },
    { accent: C.vlake.color, label: 'Vlake — projektovano', value: `${stats.km.toFixed(2)} km` },
    { accent: C.godisnji.color, label: 'Godišnji odmor iskorišten', value: `${stats.vacationUsed} / ${stats.vacationSettings.days}` },
    { accent: C.godisnji.color, label: 'Preostalo godišnjeg odmora', value: stats.vacationRemaining },
    { accent: C.bolovanje.color, label: 'Bolovanje (dana)', value: stats.counts.bolovanje || 0 },
    { accent: C.praznik.color, label: 'Praznik (dana)', value: stats.counts.praznik || 0 },
    { accent: C.placeno.color, label: 'Plaćeno odsustvo (dana)', value: stats.counts.placeno || 0 },
    { accent: C.kancelarija.color, label: 'Zadaci (završeni / ukupno)', value: `${stats.tasksDone} / ${stats.tasksTotal}` },
  ];
  $('#statsGrid').innerHTML = statCards
    .map(
      (c) => `<div class="stat-card" style="--accent-color:${c.accent}"><div class="stat-body"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div></div>`
    )
    .join('');

  const yearGrid = $('#yearGrid');
  yearGrid.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    yearGrid.appendChild(renderMiniMonth(year, m));
  }
}

function renderMiniMonth(year, month) {
  const wrap = document.createElement('div');
  wrap.className = 'mini-month';

  const title = document.createElement('h4');
  title.textContent = `${MJESECI[month]} ${year}`;
  wrap.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'mini-grid';
  ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'mw';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = mondayIndex(new Date(year, month, 1).getDay());
  const total = daysInMonth(year, month);

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'mini-day empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= total; day++) {
    const key = toKey(year, month, day);
    const jsDay = new Date(year, month, day).getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    const rec = state.user.records[key];
    const el = document.createElement('div');
    el.className = 'mini-day' + (isWeekend ? ' weekend' : '');
    el.textContent = day;

    const titleParts = [];
    if (rec && rec.type && DAY_TYPES[rec.type]) {
      el.classList.add('filled');
      el.style.background = DAY_TYPES[rec.type].color;
      titleParts.push(DAY_TYPES[rec.type].label);
    }

    const tc = taskCounts(rec);
    if (tc.total) {
      el.classList.add('has-tasks');
      titleParts.push(`Zadaci ${tc.done}/${tc.total}`);
    }

    if (titleParts.length) el.title = titleParts.join(' · ');
    grid.appendChild(el);
  }

  wrap.appendChild(grid);
  return wrap;
}

function initOverviewNav() {
  $('#prevYear').addEventListener('click', () => {
    state.overviewYear -= 1;
    renderOverviewView();
  });
  $('#nextYear').addEventListener('click', () => {
    state.overviewYear += 1;
    renderOverviewView();
  });
  $('#printBtn').addEventListener('click', () => window.print());
}

/* ==================== POSTAVKE ==================== */

function populateSettingsYears() {
  const select = $('#settingsYear');
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - 1; y <= current + 2; y++) years.push(y);
  select.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  select.value = String(state.overviewYear || current);
}

function loadSettingsForYear() {
  const year = Number($('#settingsYear').value);
  const settings = getVacationSettings(state.user, year);
  $('#vacationDays').value = settings.days;
  $('#vacationFrom').value = settings.validFrom;
  $('#settingsSaved').hidden = true;
}

function renderSettingsView() {
  populateSettingsYears();
  loadSettingsForYear();
}

function initSettings() {
  $('#settingsYear').addEventListener('change', loadSettingsForYear);
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const year = Number($('#settingsYear').value);
    const days = Number($('#vacationDays').value);
    const validFrom = $('#vacationFrom').value;
    saveVacationSettings(state.user, year, { days, validFrom });
    $('#settingsSaved').hidden = false;
  });

  $('#deleteAccountBtn').addEventListener('click', () => {
    if (!confirm('Sigurno želite obrisati svoj račun i sve podatke? Ova radnja se ne može poništiti.')) return;
    const db = JSON.parse(localStorage.getItem('evidencija_rafa_db_v1') || '{"users":{}}');
    delete db.users[state.user.username];
    localStorage.setItem('evidencija_rafa_db_v1', JSON.stringify(db));
    logout();
  });
}

/* ==================== INIT ==================== */

function init() {
  renderForestBackdrop();
  initAuthScreen();
  initNav();
  initEntryNav();
  initModal();
  initRangeModal();
  initOverviewNav();
  initSettings();

  const session = getSession();
  if (session) {
    const user = getCurrentUser();
    if (user) {
      enterApp(user);
      return;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
