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
  getVacationSettings,
  saveVacationSettings,
} from './storage.js';
import { computeYearStats } from './stats.js';
import { renderForestStrips } from './forest.js';

const MJESECI = [
  'siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
  'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac',
];
const DANI = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

const state = {
  user: null,
  entryYear: new Date().getFullYear(),
  entryMonth: new Date().getMonth(),
  overviewYear: new Date().getFullYear(),
  modalDateKey: null,
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
      (t) => `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.icon} ${t.label}</span>`
    )
    .join('');
}

function renderLegends() {
  $('#entryLegend').innerHTML = buildLegendHTML();
  $('#overviewLegend').innerHTML = buildLegendHTML();
}

/* ==================== UNOS DANA (MJESEČNI KALENDAR) ==================== */

function renderEntryView() {
  const { entryYear, entryMonth } = state;
  $('#monthLabel').textContent = `${MJESECI[entryMonth]} ${entryYear}`;

  const grid = $('#calendarGrid');
  grid.innerHTML = '';
  DANI.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = mondayIndex(new Date(entryYear, entryMonth, 1).getDay());
  const totalDays = daysInMonth(entryYear, entryMonth);
  const todayKey = toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day-cell empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= totalDays; day++) {
    const key = toKey(entryYear, entryMonth, day);
    const jsDay = new Date(entryYear, entryMonth, day).getDay();
    const isWeekend = jsDay === 0 || jsDay === 6;
    const rec = state.user.records[key];

    const cell = document.createElement('div');
    cell.className = 'day-cell' + (isWeekend ? ' weekend' : '') + (key === todayKey ? ' today' : '');
    cell.dataset.key = key;

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = day;
    cell.appendChild(num);

    if (rec && rec.type && DAY_TYPES[rec.type]) {
      const type = DAY_TYPES[rec.type];
      const badge = document.createElement('div');
      badge.className = 'day-badge';
      badge.style.background = type.color;
      badge.textContent = `${type.icon} ${type.label}`;
      cell.appendChild(badge);

      if (rec.type === 'doznaka' && (rec.trees || rec.area)) {
        const extra = document.createElement('div');
        extra.className = 'day-extra';
        extra.textContent = `${rec.trees ? rec.trees + ' stabala' : ''}${rec.trees && rec.area ? ' · ' : ''}${rec.area ? rec.area + ' ha' : ''}`;
        cell.appendChild(extra);
      }
      if (rec.type === 'vlake' && rec.km) {
        const extra = document.createElement('div');
        extra.className = 'day-extra';
        extra.textContent = `${rec.km} km vlaka`;
        cell.appendChild(extra);
      }
    }

    cell.addEventListener('click', () => openDayModal(key));
    grid.appendChild(cell);
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
    <span>${t.icon} ${t.label}</span>
  </label>`;
}

function renderExtraFields(selectedType, rec) {
  const container = $('#extraFields');
  if (selectedType === 'doznaka') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="treesInput">Broj stabala</label>
          <input id="treesInput" type="number" min="0" value="${rec?.trees ?? ''}" />
        </div>
        <div class="field">
          <label for="areaInput">Površina (ha)</label>
          <input id="areaInput" type="number" min="0" step="0.01" value="${rec?.area ?? ''}" />
        </div>
      </div>`;
  } else if (selectedType === 'vlake') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="kmInput">Kilometraža vlaka (km)</label>
          <input id="kmInput" type="number" min="0" step="0.01" value="${rec?.km ?? ''}" />
        </div>
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

function openDayModal(key) {
  state.modalDateKey = key;
  const rec = state.user.records[key];
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
  const selected = $('#dayModalOverlay input[type=radio]:checked');
  if (!selected) {
    closeDayModal();
    return;
  }
  const type = selected.value;
  const record = { type };
  if (type === 'doznaka') {
    const trees = $('#treesInput')?.value;
    const area = $('#areaInput')?.value;
    if (trees !== '' && trees != null) record.trees = Number(trees);
    if (area !== '' && area != null) record.area = Number(area);
  } else if (type === 'vlake') {
    const km = $('#kmInput')?.value;
    if (km !== '' && km != null) record.km = Number(km);
  }
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
}

/* ==================== GODIŠNJI PREGLED ==================== */

function renderOverviewView() {
  const year = state.overviewYear;
  $('#yearLabel').textContent = String(year);
  const stats = computeYearStats(state.user, year);

  const statCards = [
    { label: 'Radnih dana ukupno', value: stats.radniDani },
    { label: 'Doznaka — broj stabala', value: stats.trees },
    { label: 'Doznaka — površina (ha)', value: stats.area.toFixed(2) },
    { label: 'Vlake — km', value: stats.km.toFixed(2) },
    { label: 'Godišnji odmor iskorišten', value: `${stats.vacationUsed} / ${stats.vacationSettings.days}` },
    { label: 'Preostalo godišnjeg odmora', value: stats.vacationRemaining },
    { label: 'Bolovanje (dana)', value: stats.counts.bolovanje || 0 },
    { label: 'Praznik (dana)', value: stats.counts.praznik || 0 },
    { label: 'Plaćeno odsustvo (dana)', value: stats.counts.placeno || 0 },
  ];
  $('#statsGrid').innerHTML = statCards
    .map((c) => `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`)
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
    const rec = state.user.records[key];
    const el = document.createElement('div');
    el.className = 'mini-day';
    el.textContent = day;
    if (rec && rec.type && DAY_TYPES[rec.type]) {
      el.classList.add('filled');
      el.style.background = DAY_TYPES[rec.type].color;
      el.title = DAY_TYPES[rec.type].label;
    }
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
  renderForestStrips();
  initAuthScreen();
  initNav();
  initEntryNav();
  initModal();
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
