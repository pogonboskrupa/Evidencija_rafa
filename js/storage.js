// Sloj za pohranu podataka (localStorage) i autentikaciju korisnika.
// Sve se čuva lokalno u pregledniku korisnika (nema poslužitelja).

const DB_KEY = 'evidencija_rafa_db_v1';
const SESSION_KEY = 'evidencija_rafa_session_v1';

export const DAY_TYPES = {
  doznaka: { label: 'Doznaka stabala', group: 'radni', color: '#2f7a3f', icon: '🌲' },
  vlake: { label: 'Vlake', group: 'radni', color: '#8a5a34', icon: '🪵' },
  teren: { label: 'Teren', group: 'radni', color: '#6b8f3c', icon: '🥾' },
  kisa: { label: 'Kiša', group: 'radni', color: '#5b7a9c', icon: '🌧️' },
  kancelarija: { label: 'Kancelarija', group: 'radni', color: '#7d7d7d', icon: '🏢' },
  godisnji: { label: 'Godišnji odmor', group: 'odsustvo', color: '#8bc34a', icon: '🏖️' },
  bolovanje: { label: 'Bolovanje', group: 'odsustvo', color: '#e07a5f', icon: '🩺' },
  praznik: { label: 'Praznik', group: 'odsustvo', color: '#9575cd', icon: '🎉' },
  placeno: { label: 'Plaćeno odsustvo', group: 'odsustvo', color: '#26a69a', icon: '📄' },
};

export const RADNI_SUBTIPOVI = ['doznaka', 'vlake', 'teren', 'kisa', 'kancelarija'];
export const ODSUSTVO_TIPOVI = ['godisnji', 'bolovanje', 'praznik', 'placeno'];

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : { users: {} };
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(bytes = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return bufferToHex(arr.buffer);
}

async function hashPin(pin, saltHex) {
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${pin}`);
  let digest = await crypto.subtle.digest('SHA-256', data);
  // dodatna iteracija radi otežavanja brute-force pokušaja
  for (let i = 0; i < 2000; i++) {
    digest = await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(digest), ...enc.encode(saltHex)]));
  }
  return bufferToHex(digest);
}

export function usernameExists(username) {
  const db = loadDB();
  return !!db.users[username.trim().toLowerCase()];
}

export async function registerUser({ username, fullName, pin }) {
  const key = username.trim().toLowerCase();
  if (!key) throw new Error('Unesite korisničko ime.');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN mora imati 4 do 6 znamenki.');
  const db = loadDB();
  if (db.users[key]) throw new Error('Korisničko ime već postoji.');
  const salt = randomHex();
  const pinHash = await hashPin(pin, salt);
  const user = {
    username: key,
    fullName: fullName.trim() || key,
    salt,
    pinHash,
    createdAt: new Date().toISOString(),
    settings: {
      vacationByYear: {},
    },
    records: {},
  };
  db.users[key] = user;
  saveDB(db);
  return user;
}

export async function verifyLogin(username, pin) {
  const key = username.trim().toLowerCase();
  const db = loadDB();
  const user = db.users[key];
  if (!user) throw new Error('Korisnik ne postoji.');
  const hash = await hashPin(pin, user.salt);
  if (hash !== user.pinHash) throw new Error('Pogrešan PIN.');
  return user;
}

export function setSession(username, remember) {
  const payload = JSON.stringify({ username, ts: Date.now() });
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const db = loadDB();
  return db.users[session.username] || null;
}

export function saveUser(user) {
  const db = loadDB();
  db.users[user.username] = user;
  saveDB(db);
}

export function setRecord(user, dateKey, record) {
  if (record === null) {
    delete user.records[dateKey];
  } else {
    user.records[dateKey] = record;
  }
  saveUser(user);
}

export function setRecordsBulk(user, dateKeys, record) {
  dateKeys.forEach((dateKey) => {
    if (record === null) {
      delete user.records[dateKey];
    } else {
      user.records[dateKey] = record;
    }
  });
  saveUser(user);
}

export function getVacationSettings(user, year) {
  const y = String(year);
  const existing = user.settings.vacationByYear[y];
  if (existing) return existing;
  // pretpostavka: preuzmi broj dana iz prethodne godine ako postoji, inače 20
  const prevYear = user.settings.vacationByYear[String(Number(y) - 1)];
  return {
    days: prevYear ? prevYear.days : 20,
    validFrom: `${y}-01-01`,
  };
}

export function saveVacationSettings(user, year, settings) {
  user.settings.vacationByYear[String(year)] = settings;
  saveUser(user);
}
