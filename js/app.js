// Obična skripta (bez ES modula) — vidi napomenu u storage.js. Skripte se
// učitavaju redom (storage, stats, forest, pwa, keypad, pa app), pa su ovi
// namespace objekti već dostupni na window kad se ovaj kod izvrši. Sve je
// omotano u IIFE da desetine internih imena (state, $, $$, ...) ne završe
// kao globalne varijable na window.
(function () {
const {
  DAY_TYPES,
  RADNI_SUBTIPOVI,
  ODSUSTVO_TIPOVI,
  registerUser,
  verifyLogin,
  usernameExists,
  setSession,
  getSession,
  clearSession,
  getCurrentUser,
  setRecord,
  setDayTasks,
  deleteUser,
  getVacationSettings,
  saveVacationSettings,
  PLOCICE_PAKET_SIZE,
  getOdjeli,
  addOdjel,
  deleteOdjel,
  addRadnikToOdjel,
  deleteRadnikFromOdjel,
} = window.Storage;
const { computeYearStats } = window.Stats;
const { renderForestBackdrop } = window.Forest;
const { initPWA } = window.PWA;
const { createPinController, attachNumberField } = window.Keypad;

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
  renderedMonthKey: null,
  calendarView: 'year', // 'year' | 'month'
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  taskModalDateKey: null,
  plociceOpenOdjelId: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// "YYYY-MM-DD" -> "d.m.yyyy." (kompaktan format za uske kolone tabela).
function formatDateShort(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d}.${m}.${y}.`;
}

// Monday = 0 ... Sunday = 6
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

/* ==================== AUTH ==================== */

// Postavljeno u initAuthScreen(); poziva logout() da vrati ekran prijave na
// karticu "Prijava" i PIN tipkovnice u početno stanje.
let resetAuthUI = () => {};

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

  // ---------- PIN tipkovnica: prijava ----------
  const loginPin = createPinController({
    dotsEl: $('#loginPinDots'),
    keypadEl: $('#loginKeypad'),
    statusEl: $('#loginPinStatus'),
    onComplete: async (pin, ctl) => {
      showAuthError('');
      ctl.setLocked(true);
      ctl.setStatus('Provjera…');
      try {
        const user = await verifyLogin($('#loginUsername').value, pin);
        setSession(user.username, $('#loginRemember').checked);
        enterApp(user);
      } catch (err) {
        ctl.shake();
        ctl.setStatus(err.message, true);
        ctl.clearDigits();
        ctl.setLocked(false);
      }
    },
  });

  // ---------- PIN tipkovnica: registracija (postavi pa potvrdi) ----------
  let regStep = 'enter'; // 'enter' | 'confirm'
  let regFirstPin = '';

  function regUsernameTaken() {
    const username = $('#regUsername').value.trim();
    return !!username && usernameExists(username);
  }

  function updateRegGate() {
    $('#regUsernameError').hidden = !regUsernameTaken();
    const filled = $('#regFullName').value.trim() && $('#regUsername').value.trim() && !regUsernameTaken();
    regPin.setLocked(!filled);
  }

  function setRegStepUI() {
    $('#regPinLabel').textContent = regStep === 'enter' ? 'Postavite PIN' : 'Potvrdite PIN';
    $('#regPinBack').hidden = regStep !== 'confirm';
  }

  function resetRegPin() {
    regStep = 'enter';
    regFirstPin = '';
    setRegStepUI();
    regPin.reset();
    updateRegGate();
  }

  const regPin = createPinController({
    dotsEl: $('#regPinDots'),
    keypadEl: $('#regKeypad'),
    statusEl: $('#regPinStatus'),
    onComplete: async (pin, ctl) => {
      if (regStep === 'enter') {
        regFirstPin = pin;
        regStep = 'confirm';
        setRegStepUI();
        ctl.reset();
        return;
      }

      // regStep === 'confirm'
      if (pin !== regFirstPin) {
        ctl.shake();
        ctl.setStatus('PIN-ovi se ne podudaraju, pokušajte ponovo.', true);
        ctl.clearDigits();
        return;
      }

      showAuthError('');
      ctl.setLocked(true);
      ctl.setStatus('Registracija…');
      try {
        const user = await registerUser({
          fullName: $('#regFullName').value,
          username: $('#regUsername').value,
          pin,
        });
        setSession(user.username, $('#regRemember').checked);
        enterApp(user);
      } catch (err) {
        showAuthError(err.message);
        resetRegPin();
      }
    },
  });

  $('#regFullName').addEventListener('input', updateRegGate);
  $('#regUsername').addEventListener('input', updateRegGate);
  $('#regPinBack').addEventListener('click', resetRegPin);
  updateRegGate();

  // Tipkovnica za prijavu ostaje zaključana dok korisničko ime nije upisano
  // (bez toga nema submit dugmeta/forme koja bi to inače provjerila).
  $('#loginUsername').addEventListener('input', () => {
    loginPin.setLocked(!$('#loginUsername').value.trim());
  });
  loginPin.setLocked(true);

  // ---------- Prebacivanje kartica ----------
  function resetAuthForms() {
    loginForm.reset();
    registerForm.reset();
    loginPin.reset();
    loginPin.setLocked(!$('#loginUsername').value.trim());
    resetRegPin();
    showAuthError('');
  }

  // Odjava uvijek vraća na karticu "Prijava" (ne ostaje na "Registracija"
  // ako je korisnik odjavljen dok je ona bila aktivna).
  resetAuthUI = () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.hidden = false;
    registerForm.hidden = true;
    resetAuthForms();
  };

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.hidden = false;
    registerForm.hidden = true;
    resetAuthForms();
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.hidden = false;
    loginForm.hidden = true;
    resetAuthForms();
  });

  // ---------- Fizička tipkovnica kao alternativa dodiru ----------
  document.addEventListener('keydown', (e) => {
    if ($('#authScreen').hidden) return;
    // Ne presresti unos dok korisnik kuca u tekstualno polje (npr. ime).
    if (document.activeElement?.tagName === 'INPUT') return;

    const active = tabLogin.classList.contains('active') ? loginPin : regPin;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      active.pressDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      active.pressBackspace();
    }
  });
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function enterApp(user) {
  state.user = user;
  $('#authScreen').hidden = true;
  $('#mainApp').hidden = false;
  $('#settingsAvatar').textContent = initials(user.fullName);
  $('#settingsUserName').textContent = user.fullName;
  $('#settingsUserLabel').textContent = `@${user.username}`;
  renderLegends();
  switchView('entry');
  renderEntryView();
}

function logout() {
  clearSession();
  const now = new Date();
  state.user = null;
  state.entryYear = now.getFullYear();
  state.entryMonth = now.getMonth();
  state.overviewYear = now.getFullYear();
  state.renderedMonthKey = null;
  state.modalTasks = [];
  $('#mainApp').hidden = true;
  $('#authScreen').hidden = false;
  resetAuthUI();
  $('#loginRemember').checked = true;
}

/* ==================== NAV ==================== */

function switchView(view) {
  ['entry', 'calendar', 'plocice', 'overview', 'settings'].forEach((v) => {
    $(`#view-${v}`).hidden = v !== view;
  });
  $$('.nav-tabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  // Osvježi svaki put pri ulasku u karticu — npr. zadaci dodani u Kalendaru
  // moraju se odmah odraziti u "Evidencija rada" i obrnuto.
  if (view === 'entry') renderEntryView();
  if (view === 'calendar') renderCalendarView();
  if (view === 'plocice') renderPlociceView();
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
// Legenda vrsta dana ostaje samo u godišnjem pregledu (mini-mjeseci
// prikazuju samo boju, bez teksta) — u "Evidencija rada" je uklonjena jer je
// redundantna, svaki red već ispisuje naziv vrste dana.

function buildLegendHTML() {
  return Object.values(DAY_TYPES)
    .map(
      (t) => `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.label}</span>`
    )
    .join('');
}

function renderLegends() {
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

  // Pri ponovnom iscrtavanju istog mjeseca (npr. nakon spremanja dana) skrol
  // ostaje gdje jeste; skače na današnji dan samo kada se mjesec promijeni.
  const monthKey = `${entryYear}-${entryMonth}`;
  const sameMonth = state.renderedMonthKey === monthKey;
  const keptScroll = sameMonth ? body.scrollTop : 0;
  state.renderedMonthKey = monthKey;

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

  if (sameMonth) {
    body.scrollTop = keptScroll;
  } else if (todayRow) {
    // Novi mjesec je tekući: pomjeri prikaz na današnji dan, poravnato na
    // visinu reda kako nijedan red ne bi ostao presječen.
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
          <input id="treesInput" type="text" inputmode="numeric" autocomplete="off" />
        </div>
        <div class="field">
          <label for="areaInput">Površina (ha)</label>
          <input id="areaInput" type="text" inputmode="decimal" autocomplete="off" />
        </div>
      </div>
      <div class="num-keypad-host" id="numKeypadHost"></div>`;
    $('#treesInput').value = rec?.trees ?? '';
    $('#areaInput').value = rec?.area ?? '';
    attachNumberField($('#treesInput'), { hostEl: $('#numKeypadHost'), label: 'Broj stabala' });
    attachNumberField($('#areaInput'), { hostEl: $('#numKeypadHost'), decimal: true, label: 'Površina (ha)' });
  } else if (selectedType === 'vlake') {
    container.innerHTML = `
      <div class="extra-fields">
        <div class="field">
          <label for="kmInput">Kilometraža vlaka (km)</label>
          <input id="kmInput" type="text" inputmode="decimal" autocomplete="off" />
        </div>
      </div>
      <div class="num-keypad-host" id="numKeypadHost"></div>`;
    $('#kmInput').value = rec?.km ?? '';
    attachNumberField($('#kmInput'), { hostEl: $('#numKeypadHost'), decimal: true, label: 'Kilometraža vlaka (km)' });
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

/* --- Zadaci: dijeljeni prikaz retka (koristi ga i modal dana i Kalendar tab) --- */

// task: {text, done}. onToggle(done) i onDelete() dobijaju samo notifikaciju
// o namjeri — pozivalac odlučuje kako i gdje se promjena upisuje (u staged
// niz unutar modala dana, ili odmah u localStorage za Kalendar tab).
function createTaskRow(task, { onToggle, onDelete }) {
  const item = document.createElement('label');
  item.className = 'task-item' + (task.done ? ' done' : '');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = !!task.done;
  check.addEventListener('change', () => onToggle(check.checked));

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
    onDelete();
  });

  item.append(check, text, del);
  return item;
}

function renderTaskEmptyState(container, message) {
  container.innerHTML = '';
  const empty = document.createElement('p');
  empty.className = 'task-empty';
  empty.textContent = message;
  container.appendChild(empty);
}

/* --- Zadaci unutar dana (modal "Evidencija rada") --- */

function renderTaskList() {
  const list = $('#taskList');
  list.innerHTML = '';

  if (!state.modalTasks.length) {
    renderTaskEmptyState(list, 'Nema zadataka za ovaj dan.');
    return;
  }

  state.modalTasks.forEach((task, index) => {
    const row = createTaskRow(task, {
      onToggle: (done) => {
        state.modalTasks[index].done = done;
        renderTaskList();
      },
      onDelete: () => {
        state.modalTasks.splice(index, 1);
        renderTaskList();
      },
    });
    list.appendChild(row);
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

  // Selektori su ograničeni na ovaj modal (.type-option se koristi samo ovdje).
  const radios = $$('#dayModalOverlay input[name=dayType]');
  radios.forEach((r) => {
    r.checked = rec && rec.type === r.value;
    r.addEventListener('change', () => {
      $$('#dayModalOverlay .type-option').forEach((opt) =>
        opt.classList.toggle('selected', opt.dataset.key === r.value)
      );
      renderExtraFields(r.value, rec && rec.type === r.value ? rec : null);
    });
  });
  $$('#dayModalOverlay .type-option').forEach((opt) =>
    opt.classList.toggle('selected', rec && rec.type === opt.dataset.key)
  );

  renderExtraFields(rec?.type, rec);

  $('#dayModalOverlay').hidden = false;
}

function closeDayModal() {
  $('#dayModalOverlay').hidden = true;
  state.modalDateKey = null;
}

// Prazno polje -> null (ne upisuje se); nevaljan ili negativan unos -> 0.
function toNonNegative(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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
      const trees = toNonNegative($('#treesInput')?.value);
      const area = toNonNegative($('#areaInput')?.value);
      if (trees !== null) record.trees = trees;
      if (area !== null) record.area = area;
    } else if (type === 'vlake') {
      const km = toNonNegative($('#kmInput')?.value);
      if (km !== null) record.km = km;
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

  // Escape zatvara otvoreni modal.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#dayModalOverlay').hidden) closeDayModal();
  });
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

// Zajednička logika za bojenje ćelije dana u mini-mjesecu (koristi je i
// "Godišnji pregled" i "Kalendar"): pozadina prema vrsti zabilježenog dana
// (šta je rađeno), plus tačka u uglu koja prati status zadataka (zeleno kad
// su svi završeni, žuto dok nešto stoji nezavršeno) — oba podatka odjednom.
function styleMiniDayCell(el, rec) {
  const titleParts = [];
  if (rec && rec.type && DAY_TYPES[rec.type]) {
    el.classList.add('filled');
    el.style.background = DAY_TYPES[rec.type].color;
    const detail = extraText(rec);
    titleParts.push(DAY_TYPES[rec.type].label + (detail ? ` — ${detail}` : ''));
  }

  const tc = taskCounts(rec);
  if (tc.total) {
    el.classList.add('has-tasks', tc.done === tc.total ? 'tasks-done' : 'tasks-pending');
    titleParts.push(`Zadaci ${tc.done}/${tc.total}`);
  }

  if (titleParts.length) el.title = titleParts.join(' · ');
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
    styleMiniDayCell(el, rec);
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

/* ==================== KALENDAR (zadaci, termini, rokovi) ==================== */
// Koristi isto polje rec.tasks kao modal "Evidencija rada", ali kroz setDayTasks
// (ne setRecord) — tako se mijenja samo lista zadataka, a vrsta dana i njena
// dodatna polja (stabla, površina, km, napomena) ostaju netaknuti.

function renderCalendarView() {
  $('#calYearPanel').hidden = state.calendarView !== 'year';
  $('#calMonthPanel').hidden = state.calendarView !== 'month';
  $$('#calSubtabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.calview === state.calendarView);
  });
  if (state.calendarView === 'year') renderCalendarYear();
  else renderCalendarMonthList();
}

function renderCalendarYear() {
  const year = state.calendarYear;
  $('#calYearLabel').textContent = String(year);

  const stats = computeYearStats(state.user, year);
  const remaining = stats.tasksTotal - stats.tasksDone;
  const cards = [
    { accent: '#2f7d4f', label: 'Ukupno zadataka', value: stats.tasksTotal },
    { accent: '#2f7d4f', label: 'Završeno', value: stats.tasksDone },
    { accent: '#dd9a2c', label: 'Preostalo', value: remaining },
  ];
  $('#calYearStats').innerHTML = cards
    .map(
      (c) => `<div class="stat-card" style="--accent-color:${c.accent}"><div class="stat-body"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div></div>`
    )
    .join('');

  const grid = $('#calYearGrid');
  grid.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    grid.appendChild(renderCalendarMiniMonth(year, m));
  }
}

// Isto bojenje kao u Godišnjem pregledu (styleMiniDayCell) — pozadina prati
// zabilježenu vrstu dana, a tačka u uglu status zadataka — tako se u Kalendaru
// odjednom vidi i šta je tog dana rađeno i da li su zadaci završeni.
function renderCalendarMiniMonth(year, month) {
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
    styleMiniDayCell(el, rec);

    el.addEventListener('click', () => openTaskDayModal(key));
    grid.appendChild(el);
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderCalendarMonthList() {
  const { calendarYear, calendarMonth } = state;
  $('#calMonthLabel').textContent = `${MJESECI[calendarMonth]} ${calendarYear}`;
  $('#quickTaskDate').value = toKey(calendarYear, calendarMonth, 1);

  const total = daysInMonth(calendarYear, calendarMonth);
  const container = $('#monthTaskList');
  container.innerHTML = '';
  let anyTasks = false;

  for (let day = 1; day <= total; day++) {
    const key = toKey(calendarYear, calendarMonth, day);
    const rec = state.user.records[key];
    const tasks = rec?.tasks || [];
    if (!tasks.length) continue;
    anyTasks = true;

    const jsDay = new Date(calendarYear, calendarMonth, day).getDay();

    const group = document.createElement('div');
    group.className = 'month-task-group';

    const heading = document.createElement('div');
    heading.className = 'month-task-date';
    heading.textContent = `${day}. ${MJESECI[calendarMonth]}`;
    const weekdayTag = document.createElement('span');
    weekdayTag.className = 'weekday-tag';
    weekdayTag.textContent = DANI_PUNI[mondayIndex(jsDay)];
    heading.appendChild(weekdayTag);

    // Vrsta zabilježenog dana (šta je rađeno) prikazana odmah uz datum, uporedo sa zadacima ispod.
    if (rec.type && DAY_TYPES[rec.type]) {
      const type = DAY_TYPES[rec.type];
      const badge = document.createElement('span');
      badge.className = 'day-badge';
      badge.style.background = type.color;
      badge.textContent = type.label;
      heading.appendChild(badge);

      const detail = extraText(rec);
      if (detail) {
        const detailEl = document.createElement('span');
        detailEl.className = 'work-info-detail';
        detailEl.textContent = detail;
        heading.appendChild(detailEl);
      }
    }

    group.appendChild(heading);

    const rows = document.createElement('div');
    rows.className = 'month-task-rows';
    tasks.forEach((task, index) => {
      const row = createTaskRow(task, {
        onToggle: (done) => {
          const updated = tasks.map((t, i) => (i === index ? { ...t, done } : t));
          setDayTasks(state.user, key, updated);
          renderCalendarMonthList();
        },
        onDelete: () => {
          const updated = tasks.filter((_, i) => i !== index);
          setDayTasks(state.user, key, updated);
          renderCalendarMonthList();
        },
      });
      rows.appendChild(row);
    });
    group.appendChild(rows);

    container.appendChild(group);
  }

  if (!anyTasks) renderTaskEmptyState(container, 'Nema zadataka za ovaj mjesec.');
}

/* --- Modal: zadaci za jedan dan (otvara se klikom u godišnjem kalendaru) --- */

function renderTaskDayList(dateKey) {
  const rec = state.user.records[dateKey];
  const tasks = rec?.tasks || [];
  const list = $('#taskDayList');
  list.innerHTML = '';

  if (!tasks.length) {
    renderTaskEmptyState(list, 'Nema zadataka za ovaj dan.');
    return;
  }

  tasks.forEach((task, index) => {
    const row = createTaskRow(task, {
      onToggle: (done) => {
        const updated = tasks.map((t, i) => (i === index ? { ...t, done } : t));
        setDayTasks(state.user, dateKey, updated);
        renderTaskDayList(dateKey);
      },
      onDelete: () => {
        const updated = tasks.filter((_, i) => i !== index);
        setDayTasks(state.user, dateKey, updated);
        renderTaskDayList(dateKey);
      },
    });
    list.appendChild(row);
  });
}

// Prikazuje šta je tog dana zabilježeno u "Evidencija rada" (vrsta dana + učinak),
// odmah iznad liste zadataka — tako se u Kalendaru vidi oboje na jednom mjestu.
function renderTaskDayWorkInfo(dateKey) {
  const rec = state.user.records[dateKey];
  const box = $('#taskDayWorkInfo');
  box.innerHTML = '';

  if (!(rec && rec.type && DAY_TYPES[rec.type])) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  const type = DAY_TYPES[rec.type];
  const badge = document.createElement('span');
  badge.className = 'day-badge';
  badge.style.background = type.color;
  badge.textContent = type.label;
  box.appendChild(badge);

  const detail = extraText(rec);
  if (detail) {
    const detailEl = document.createElement('span');
    detailEl.className = 'work-info-detail';
    detailEl.textContent = detail;
    box.appendChild(detailEl);
  }
}

function openTaskDayModal(dateKey) {
  state.taskModalDateKey = dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  $('#taskDayModalLabel').textContent = `${d}. ${MJESECI[m - 1]} ${y}.`;
  $('#taskDayInput').value = '';
  renderTaskDayWorkInfo(dateKey);
  renderTaskDayList(dateKey);
  $('#taskDayModalOverlay').hidden = false;
}

function closeTaskDayModal() {
  $('#taskDayModalOverlay').hidden = true;
  state.taskModalDateKey = null;
  // Mini-mjeseci u pozadini se ne osvježavaju uživo dok je modal otvoren —
  // učini to jednom, ovdje, umjesto pri svakoj izmjeni unutar modala.
  if (state.calendarView === 'year') renderCalendarYear();
}

function addTaskDayFromInput() {
  const input = $('#taskDayInput');
  const text = input.value.trim();
  if (!text || !state.taskModalDateKey) return;
  const dateKey = state.taskModalDateKey;
  const rec = state.user.records[dateKey];
  const tasks = [...(rec?.tasks || []), { text, done: false }];
  setDayTasks(state.user, dateKey, tasks);
  input.value = '';
  renderTaskDayList(dateKey);
}

function initCalendarNav() {
  $$('#calSubtabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.calendarView = btn.dataset.calview;
      renderCalendarView();
    });
  });

  $('#calPrevYear').addEventListener('click', () => {
    state.calendarYear -= 1;
    renderCalendarYear();
  });
  $('#calNextYear').addEventListener('click', () => {
    state.calendarYear += 1;
    renderCalendarYear();
  });

  $('#calPrevMonth').addEventListener('click', () => {
    state.calendarMonth -= 1;
    if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear -= 1;
    }
    renderCalendarMonthList();
  });
  $('#calNextMonth').addEventListener('click', () => {
    state.calendarMonth += 1;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear += 1;
    }
    renderCalendarMonthList();
  });

  function addQuickTask() {
    const dateVal = $('#quickTaskDate').value;
    const text = $('#quickTaskText').value.trim();
    if (!dateVal || !text) return;
    const rec = state.user.records[dateVal];
    const tasks = [...(rec?.tasks || []), { text, done: false }];
    setDayTasks(state.user, dateVal, tasks);
    $('#quickTaskText').value = '';
    renderCalendarMonthList();
  }
  $('#quickTaskAddBtn').addEventListener('click', addQuickTask);
  $('#quickTaskText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addQuickTask();
    }
  });

  $('#taskDayModalCloseBtn').addEventListener('click', closeTaskDayModal);
  $('#taskDayModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'taskDayModalOverlay') closeTaskDayModal();
  });
  $('#taskDayAddBtn').addEventListener('click', addTaskDayFromInput);
  $('#taskDayInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTaskDayFromInput();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#taskDayModalOverlay').hidden) closeTaskDayModal();
  });
}

/* ==================== RASPORED PLOČICA ==================== */
// Raspored po odjelima: svaki odjel sadrži listu radnika (projektanata) i
// raspon markirnih pločica koje su zadužili (unos direktno u pločicama ili u
// paketima, 1 paket = PLOCICE_PAKET_SIZE pločica). Redoslijed treba biti bez
// praznina — svaki sljedeći raspon nastavlja se od kraja prethodnog; ako
// postoji praznina ili preklapanje, prikazuje se upozorenje.

function computeSuggestedStart(odjel) {
  if (!odjel.radnici.length) return 1;
  const maxKrajnja = odjel.radnici.reduce((max, r) => Math.max(max, r.krajnja), 0);
  return maxKrajnja + 1;
}

// Radnici poredani po redoslijedu pločica (ne po redoslijedu unosa) — tako se
// praznine/preklapanja vide u prirodnom nizu, plus lista poruka upozorenja
// (dijeljeno između kartice odjela i detaljnog prikaza).
function computeOdjelIssues(odjel) {
  const sorted = [...odjel.radnici].sort((a, b) => a.pocetna - b.pocetna);
  const issues = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.pocetna > prev.krajnja + 1) {
      issues.push({ id: cur.id, msg: `Praznina: pločice ${prev.krajnja + 1}–${cur.pocetna - 1} nisu dodijeljene nijednom radniku (prije "${cur.ime}").` });
    } else if (cur.pocetna <= prev.krajnja) {
      issues.push({ id: cur.id, msg: `Preklapanje: "${prev.ime}" (${prev.pocetna}–${prev.krajnja}) i "${cur.ime}" (${cur.pocetna}–${cur.krajnja}) dijele iste pločice.` });
    }
  }
  return { sorted, issues };
}

function renderPlociceView() {
  const odjeli = getOdjeli(state.user);
  const openOdjel = state.plociceOpenOdjelId ? odjeli.find((o) => o.id === state.plociceOpenOdjelId) : null;

  $('#plociceListView').hidden = !!openOdjel;
  $('#plociceDetailView').hidden = !openOdjel;

  if (openOdjel) {
    renderOdjelDetail(openOdjel);
  } else {
    state.plociceOpenOdjelId = null; // odjel je u međuvremenu obrisan — vrati se na listu
    renderOdjeliCards(odjeli);
  }
}

function renderOdjeliCards(odjeli) {
  const container = $('#odjeliList');
  container.innerHTML = '';

  if (!odjeli.length) {
    renderTaskEmptyState(container, 'Nema dodanih odjela. Dodajte prvi odjel iznad.');
    return;
  }

  odjeli.forEach((odjel) => {
    const totalPlocica = odjel.radnici.reduce((sum, r) => sum + r.kolicina, 0);
    const { issues } = computeOdjelIssues(odjel);

    const card = document.createElement('div');
    card.className = 'odjel-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const main = document.createElement('div');
    main.className = 'odjel-card-main';

    const name = document.createElement('div');
    name.className = 'odjel-card-name';
    name.textContent = odjel.name;
    if (issues.length) {
      const warnIcon = document.createElement('span');
      warnIcon.className = 'row-warn-icon';
      warnIcon.textContent = '⚠️';
      warnIcon.title = issues.map((i) => i.msg).join('\n');
      name.appendChild(warnIcon);
    }
    main.appendChild(name);

    const summary = document.createElement('div');
    summary.className = 'odjel-card-summary';
    summary.textContent = `${odjel.radnici.length} ${odjel.radnici.length === 1 ? 'radnik' : 'radnika'} · ${totalPlocica} pločica`;
    main.appendChild(summary);

    card.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'odjel-card-actions';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'task-del';
    delBtn.title = 'Obriši odjel';
    delBtn.setAttribute('aria-label', 'Obriši odjel');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Obrisati odjel "${odjel.name}" i sve unose u njemu?`)) return;
      deleteOdjel(state.user, odjel.id);
      renderPlociceView();
    });
    actions.appendChild(delBtn);

    const chevron = document.createElement('span');
    chevron.className = 'odjel-card-chevron';
    chevron.textContent = '›';
    actions.appendChild(chevron);

    card.appendChild(actions);

    function open() {
      state.plociceOpenOdjelId = odjel.id;
      renderPlociceView();
    }
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    container.appendChild(card);
  });
}

function renderOdjelDetail(odjel) {
  $('#odjelDetailName').textContent = odjel.name;

  const totalPlocica = odjel.radnici.reduce((sum, r) => sum + r.kolicina, 0);
  $('#odjelDetailSummary').textContent = `${odjel.radnici.length} ${odjel.radnici.length === 1 ? 'radnik' : 'radnika'} · ${totalPlocica} pločica`;

  const { sorted, issues } = computeOdjelIssues(odjel);
  const rowWarnings = new Map(issues.map((i) => [i.id, i.msg]));

  const warnHost = $('#odjelDetailWarnings');
  warnHost.innerHTML = '';
  if (issues.length) {
    const warnBox = document.createElement('div');
    warnBox.className = 'plocice-warning';
    const icon = document.createElement('span');
    icon.textContent = '⚠️';
    warnBox.appendChild(icon);
    const textWrap = document.createElement('div');
    issues.forEach(({ msg }) => {
      const line = document.createElement('div');
      line.textContent = msg;
      textWrap.appendChild(line);
    });
    warnBox.appendChild(textWrap);
    warnHost.appendChild(warnBox);
  }

  const listHost = $('#odjelDetailList');
  listHost.innerHTML = '';
  if (sorted.length) {
    const list = document.createElement('div');
    list.className = 'plocice-list';

    const listHeader = document.createElement('div');
    listHeader.className = 'plocice-list-header';
    listHeader.innerHTML = `
      <span class="col-radnik">Radnik</span>
      <span class="col-raspon">Raspon pločica</span>
      <span class="col-kolicina">Broj pločica</span>
      <span class="col-paketi">Paketi</span>
      <span class="col-datum">Datum</span>
      <span class="col-del"></span>`;
    list.appendChild(listHeader);

    sorted.forEach((radnik) => {
      const warning = rowWarnings.get(radnik.id);
      const row = document.createElement('div');
      row.className = 'plocice-row' + (warning ? ' has-gap' : '');

      const radnikCol = document.createElement('span');
      radnikCol.className = 'col-radnik';
      radnikCol.textContent = radnik.ime;
      if (warning) {
        const warnIcon = document.createElement('span');
        warnIcon.className = 'row-warn-icon';
        warnIcon.textContent = '⚠️';
        warnIcon.title = warning;
        radnikCol.appendChild(warnIcon);
      }
      row.appendChild(radnikCol);

      const rasponCol = document.createElement('span');
      rasponCol.className = 'col-raspon';
      rasponCol.textContent = `${radnik.pocetna}–${radnik.krajnja}`;
      row.appendChild(rasponCol);

      const kolicinaCol = document.createElement('span');
      kolicinaCol.className = 'col-kolicina';
      kolicinaCol.textContent = `${radnik.kolicina} kom.`;
      row.appendChild(kolicinaCol);

      const paketiCol = document.createElement('span');
      paketiCol.className = 'col-paketi';
      paketiCol.textContent = radnik.brojPaketa ? `${radnik.brojPaketa} pak.` : '—';
      row.appendChild(paketiCol);

      const datumCol = document.createElement('span');
      datumCol.className = 'col-datum';
      datumCol.textContent = radnik.datum ? formatDateShort(radnik.datum) : '—';
      row.appendChild(datumCol);

      const delCol = document.createElement('span');
      delCol.className = 'col-del';
      const delRadnikBtn = document.createElement('button');
      delRadnikBtn.type = 'button';
      delRadnikBtn.className = 'task-del';
      delRadnikBtn.title = 'Obriši radnika';
      delRadnikBtn.setAttribute('aria-label', 'Obriši radnika');
      delRadnikBtn.textContent = '×';
      delRadnikBtn.addEventListener('click', () => {
        deleteRadnikFromOdjel(state.user, odjel.id, radnik.id);
        renderPlociceView();
      });
      delCol.appendChild(delRadnikBtn);
      row.appendChild(delCol);

      list.appendChild(row);
    });

    listHost.appendChild(list);
  }

  const formHost = $('#odjelDetailFormHost');
  formHost.innerHTML = '';
  formHost.appendChild(renderAddRadnikForm(odjel));

  $('#odjelDetailDeleteBtn').onclick = () => {
    if (!confirm(`Obrisati odjel "${odjel.name}" i sve unose u njemu?`)) return;
    deleteOdjel(state.user, odjel.id);
    state.plociceOpenOdjelId = null;
    renderPlociceView();
  };
}

function renderAddRadnikForm(odjel) {
  const form = document.createElement('form');
  form.className = 'plocice-add-form';

  const modeName = `plocice-mode-${odjel.id}`;
  form.innerHTML = `
    <div class="field">
      <label>Ime radnika</label>
      <input type="text" class="radnik-ime-input" maxlength="80" placeholder="Ime i prezime" required />
    </div>
    <div class="field">
      <label>Način unosa</label>
      <div class="plocice-mode-toggle">
        <label><input type="radio" name="${modeName}" value="paketi" checked /> Broj paketa</label>
        <label><input type="radio" name="${modeName}" value="plocice" /> Broj pločica</label>
      </div>
    </div>
    <div class="field">
      <label>Početna pločica</label>
      <input type="text" inputmode="numeric" class="radnik-pocetna-input" autocomplete="off" />
    </div>
    <div class="field">
      <label class="radnik-kolicina-label">Broj paketa</label>
      <input type="text" inputmode="numeric" class="radnik-kolicina-input" autocomplete="off" placeholder="npr. 10" />
    </div>
    <div class="field">
      <label>Datum zaduženja</label>
      <input type="date" class="radnik-datum-input" />
    </div>
    <div class="num-keypad-host plocice-keypad-host"></div>
    <div class="plocice-preview"></div>
    <div><button type="submit" class="btn btn-secondary">Dodaj radnika</button></div>
  `;

  const imeInput = form.querySelector('.radnik-ime-input');
  const pocetnaInput = form.querySelector('.radnik-pocetna-input');
  const kolicinaInput = form.querySelector('.radnik-kolicina-input');
  const kolicinaLabel = form.querySelector('.radnik-kolicina-label');
  const datumInput = form.querySelector('.radnik-datum-input');
  const preview = form.querySelector('.plocice-preview');
  const keypadHost = form.querySelector('.plocice-keypad-host');
  const modeRadios = form.querySelectorAll(`input[name="${modeName}"]`);

  pocetnaInput.value = String(computeSuggestedStart(odjel));
  const today = new Date();
  datumInput.value = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  attachNumberField(pocetnaInput, { hostEl: keypadHost, label: 'Početna pločica' });
  // "Gotovo" na broju paketa/pločica je posljednji korak unosa — odmah
  // potvrđuje formu (isto kao klik na "Dodaj radnika"), umjesto da korisnik
  // mora zatvoriti tastaturu pa dodatno kliknuti dugme za potvrdu.
  attachNumberField(kolicinaInput, { hostEl: keypadHost, label: 'Broj paketa', onDone: () => form.requestSubmit() });

  function currentMode() {
    return [...modeRadios].find((r) => r.checked)?.value || 'paketi';
  }

  function updatePreview() {
    const mode = currentMode();
    kolicinaLabel.textContent = mode === 'paketi' ? 'Broj paketa' : 'Broj pločica';
    kolicinaInput.placeholder = mode === 'paketi' ? 'npr. 10' : 'npr. 300';

    const pocetna = Number(pocetnaInput.value);
    const rawKolicina = Number(kolicinaInput.value);
    if (!pocetna || !rawKolicina) {
      preview.textContent = '';
      return;
    }
    const kolicina = mode === 'paketi' ? rawKolicina * PLOCICE_PAKET_SIZE : rawKolicina;
    const krajnja = pocetna + kolicina - 1;
    const paketiText = mode === 'paketi' ? ` (${rawKolicina} paketa)` : '';
    preview.textContent = `Raspon: ${pocetna}–${krajnja} · ${kolicina} pločica${paketiText}`;
  }

  modeRadios.forEach((r) => r.addEventListener('change', updatePreview));
  pocetnaInput.addEventListener('input', updatePreview);
  kolicinaInput.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ime = imeInput.value.trim();
    const pocetna = Number(pocetnaInput.value);
    const rawKolicina = Number(kolicinaInput.value);
    if (!ime || !pocetna || !rawKolicina || rawKolicina <= 0) return;
    const mode = currentMode();
    const kolicina = mode === 'paketi' ? rawKolicina * PLOCICE_PAKET_SIZE : rawKolicina;
    addRadnikToOdjel(state.user, odjel.id, {
      ime,
      pocetna,
      kolicina,
      brojPaketa: mode === 'paketi' ? rawKolicina : null,
      datum: datumInput.value || null,
    });
    renderPlociceView();
  });

  return form;
}

function initPlocice() {
  $('#addOdjelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#newOdjelName');
    const name = input.value.trim();
    if (!name) return;
    addOdjel(state.user, name);
    input.value = '';
    renderPlociceView();
  });

  $('#odjelBackBtn').addEventListener('click', () => {
    state.plociceOpenOdjelId = null;
    renderPlociceView();
  });
}

/* ==================== POSTAVKE ==================== */

function populateSettingsYears() {
  const select = $('#settingsYear');
  const current = new Date().getFullYear();

  // Ponuđene godine: tekući prozor, sve godine u kojima postoje unosi ili
  // spremljene postavke, te godina koja je otvorena u godišnjem pregledu —
  // inače izbor ostane prazan kada se pregled odvede izvan prozora.
  const years = new Set();
  for (let y = current - 1; y <= current + 2; y++) years.add(y);
  Object.keys(state.user.records).forEach((key) => years.add(Number(key.slice(0, 4))));
  Object.keys(state.user.settings.vacationByYear).forEach((y) => years.add(Number(y)));
  years.add(state.overviewYear);

  const sorted = [...years].filter((y) => Number.isFinite(y) && y > 1970).sort((a, b) => a - b);
  select.innerHTML = sorted.map((y) => `<option value="${y}">${y}</option>`).join('');
  select.value = String(sorted.includes(state.overviewYear) ? state.overviewYear : current);
}

function loadSettingsForYear() {
  const year = Number($('#settingsYear').value) || new Date().getFullYear();
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
  attachNumberField($('#vacationDays'), { hostEl: $('#vacationDaysKeypadHost'), label: 'Broj dana godišnjeg odmora' });

  $('#settingsYear').addEventListener('change', loadSettingsForYear);
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const year = Number($('#settingsYear').value) || new Date().getFullYear();
    const days = Math.min(60, Math.max(0, Number($('#vacationDays').value) || 0));
    const validFrom = $('#vacationFrom').value || `${year}-01-01`;
    saveVacationSettings(state.user, year, { days, validFrom });
    $('#settingsSaved').hidden = false;
  });

  $('#deleteAccountBtn').addEventListener('click', () => {
    if (!confirm('Sigurno želite obrisati svoj račun i sve podatke? Ova radnja se ne može poništiti.')) return;
    deleteUser(state.user.username);
    logout();
  });
}

/* ==================== INIT ==================== */

function init() {
  renderForestBackdrop();
  initPWA();
  initAuthScreen();
  initNav();
  initEntryNav();
  initModal();
  initOverviewNav();
  initCalendarNav();
  initPlocice();
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
})();
