// Sloj za pohranu podataka (localStorage) i autentikaciju korisnika.
// Sve se čuva lokalno u pregledniku korisnika (nema poslužitelja).
//
// Obična skripta (bez ES modula) — namjerno, da bi aplikacija radila i kada
// se index.html otvori direktno dvoklikom (file://), gdje preglednici
// blokiraju učitavanje modula (type="module") CORS pravilima.

window.Storage = (function () {
  const DB_KEY = 'evidencija_rafa_db_v1';
  const SESSION_KEY = 'evidencija_rafa_session_v1';

  const DAY_TYPES = {
    doznaka: { label: 'Doznaka stabala', group: 'radni', color: '#2f7d4f' },
    vlake: { label: 'Vlake', group: 'radni', color: '#a06a33' },
    teren: { label: 'Teren', group: 'radni', color: '#7aa63c' },
    kisa: { label: 'Kiša', group: 'radni', color: '#4d7fa6' },
    kancelarija: { label: 'Kancelarija', group: 'radni', color: '#6a7480' },
    godisnji: { label: 'Godišnji odmor', group: 'odsustvo', color: '#dd9a2c' },
    bolovanje: { label: 'Bolovanje', group: 'odsustvo', color: '#c85f56' },
    praznik: { label: 'Praznik', group: 'odsustvo', color: '#8b6bb1' },
    placeno: { label: 'Plaćeno odsustvo', group: 'odsustvo', color: '#2a9d8f' },
  };

  const RADNI_SUBTIPOVI = ['doznaka', 'vlake', 'teren', 'kisa', 'kancelarija'];
  const ODSUSTVO_TIPOVI = ['godisnji', 'bolovanje', 'praznik', 'placeno'];

  // "Raspored pločica": 1 paket markirnih pločica = 30 komada.
  const PLOCICE_PAKET_SIZE = 30;

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

  function usernameExists(username) {
    const db = loadDB();
    return !!db.users[username.trim().toLowerCase()];
  }

  async function registerUser({ username, fullName, pin }) {
    const key = username.trim().toLowerCase();
    if (!key) throw new Error('Unesite korisničko ime.');
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN mora imati 4 znamenke.');
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

  async function verifyLogin(username, pin) {
    const key = username.trim().toLowerCase();
    const db = loadDB();
    const user = db.users[key];
    if (!user) throw new Error('Korisnik ne postoji.');
    const hash = await hashPin(pin, user.salt);
    if (hash !== user.pinHash) throw new Error('Pogrešan PIN.');
    return user;
  }

  function setSession(username, remember) {
    const payload = JSON.stringify({ username, ts: Date.now() });
    if (remember) {
      localStorage.setItem(SESSION_KEY, payload);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, payload);
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const db = loadDB();
    return db.users[session.username] || null;
  }

  function saveUser(user) {
    const db = loadDB();
    db.users[user.username] = user;
    saveDB(db);
  }

  function setRecord(user, dateKey, record) {
    if (record === null) {
      delete user.records[dateKey];
    } else {
      user.records[dateKey] = record;
    }
    saveUser(user);
  }

  function deleteUser(username) {
    const db = loadDB();
    delete db.users[username];
    saveDB(db);
  }

  // Mijenja SAMO listu zadataka za dan, čuvajući ostatak zapisa (vrstu dana,
  // broj stabala, napomenu...) nepromijenjenim — za razliku od setRecord, koji
  // zapis potpuno zamjenjuje. Prazna lista briše polje tasks; ako dan poslije
  // toga nema ni vrstu ni zadatke, cijeli zapis se briše.
  function setDayTasks(user, dateKey, tasks) {
    const existing = user.records[dateKey];
    if (!tasks.length) {
      if (existing) {
        const rest = { ...existing };
        delete rest.tasks;
        if (rest.type) {
          user.records[dateKey] = rest;
        } else {
          delete user.records[dateKey];
        }
      }
    } else {
      user.records[dateKey] = { ...(existing || {}), tasks };
    }
    saveUser(user);
  }

  function getVacationSettings(user, year) {
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

  function saveVacationSettings(user, year, settings) {
    user.settings.vacationByYear[String(year)] = settings;
    saveUser(user);
  }

  function getNotificationsEnabled(user) {
    return !!user.settings.notifications;
  }

  function setNotificationsEnabled(user, enabled) {
    user.settings.notifications = !!enabled;
    saveUser(user);
  }

  /* ==================== SIGURNOSNA KOPIJA (izvoz/uvoz) ====================
     Cijeli korisnički zapis (uključujući salt/pinHash — bez toga se PIN nakon
     uvoza ne bi mogao provjeriti) izvozi se kao JSON. Uvoz upisuje isti zapis
     natrag u bazu; ako korisničko ime već postoji, poziv se mora eksplicitno
     ponoviti sa overwrite:true (UI to traži potvrdom od korisnika). */

  function exportUserData(user) {
    // Strukturalni klon (JSON round-trip) — izvezena kopija ne smije dijeliti
    // reference s objektom koji ostaje u memoriji/bazi.
    return JSON.parse(JSON.stringify(user));
  }

  function importUserData(raw, { overwrite = false } = {}) {
    if (!raw || typeof raw !== 'object') throw new Error('Datoteka nije validna sigurnosna kopija.');
    const username = typeof raw.username === 'string' ? raw.username.trim().toLowerCase() : '';
    if (!username || typeof raw.salt !== 'string' || typeof raw.pinHash !== 'string' || typeof raw.records !== 'object') {
      throw new Error('Datoteka nije validna sigurnosna kopija.');
    }

    const db = loadDB();
    if (db.users[username] && !overwrite) {
      const err = new Error('Korisnik s tim imenom već postoji na ovom uređaju.');
      err.code = 'exists';
      throw err;
    }

    const user = {
      username,
      fullName: typeof raw.fullName === 'string' && raw.fullName.trim() ? raw.fullName.trim() : username,
      salt: raw.salt,
      pinHash: raw.pinHash,
      createdAt: raw.createdAt || new Date().toISOString(),
      settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : { vacationByYear: {} },
      records: raw.records && typeof raw.records === 'object' ? raw.records : {},
      plocice: raw.plocice && typeof raw.plocice === 'object' ? raw.plocice : { odjeli: [] },
    };
    if (!user.settings.vacationByYear) user.settings.vacationByYear = {};

    db.users[username] = user;
    saveDB(db);
    return user;
  }

  /* ==================== RASPORED PLOČICA ====================
     Raspored po odjelima: svaki odjel ima listu radnika (projektanata) kojima
     je dodijeljen raspon markirnih pločica (od-do), unesen direktno kao broj
     pločica ili kao broj paketa (1 paket = PLOCICE_PAKET_SIZE pločica). Nalozi
     napravljeni prije uvođenja ove kartice nemaju `plocice` polje — ensurePlocice
     ga lijeno dodaje pri prvom pristupu. */

  function ensurePlocice(user) {
    if (!user.plocice) user.plocice = { odjeli: [] };
    return user.plocice;
  }

  function getOdjeli(user) {
    return ensurePlocice(user).odjeli;
  }

  function addOdjel(user, name) {
    const odjel = { id: randomHex(6), name: name.trim(), radnici: [] };
    ensurePlocice(user).odjeli.push(odjel);
    saveUser(user);
    return odjel;
  }

  function deleteOdjel(user, odjelId) {
    const plocice = ensurePlocice(user);
    plocice.odjeli = plocice.odjeli.filter((o) => o.id !== odjelId);
    saveUser(user);
  }

  // { ime, pocetna, kolicina, brojPaketa, datum } — brojPaketa je null kad je
  // unos bio direktno u pločicama (ne preko paketa); datum (YYYY-MM-DD) je dan
  // zaduženja, null ako nije unesen (npr. stariji zapisi).
  function addRadnikToOdjel(user, odjelId, { ime, pocetna, kolicina, brojPaketa, datum }) {
    const odjel = getOdjeli(user).find((o) => o.id === odjelId);
    if (!odjel) return null;
    const radnik = {
      id: randomHex(6),
      ime: ime.trim(),
      pocetna,
      kolicina,
      krajnja: pocetna + kolicina - 1,
      brojPaketa: brojPaketa || null,
      datum: datum || null,
    };
    odjel.radnici.push(radnik);
    saveUser(user);
    return radnik;
  }

  function deleteRadnikFromOdjel(user, odjelId, radnikId) {
    const odjel = getOdjeli(user).find((o) => o.id === odjelId);
    if (!odjel) return;
    odjel.radnici = odjel.radnici.filter((r) => r.id !== radnikId);
    saveUser(user);
  }

  // Izmjena postojećeg unosa (isti oblik podataka kao addRadnikToOdjel) — id i
  // odjel ostaju nepromijenjeni, ostala polja se zamjenjuju u cijelosti.
  function updateRadnikInOdjel(user, odjelId, radnikId, { ime, pocetna, kolicina, brojPaketa, datum }) {
    const odjel = getOdjeli(user).find((o) => o.id === odjelId);
    if (!odjel) return null;
    const radnik = odjel.radnici.find((r) => r.id === radnikId);
    if (!radnik) return null;
    radnik.ime = ime.trim();
    radnik.pocetna = pocetna;
    radnik.kolicina = kolicina;
    radnik.krajnja = pocetna + kolicina - 1;
    radnik.brojPaketa = brojPaketa || null;
    radnik.datum = datum || null;
    saveUser(user);
    return radnik;
  }

  return {
    DAY_TYPES,
    RADNI_SUBTIPOVI,
    ODSUSTVO_TIPOVI,
    usernameExists,
    registerUser,
    verifyLogin,
    setSession,
    getSession,
    clearSession,
    getCurrentUser,
    saveUser,
    setRecord,
    setDayTasks,
    deleteUser,
    getVacationSettings,
    saveVacationSettings,
    getNotificationsEnabled,
    setNotificationsEnabled,
    exportUserData,
    importUserData,
    PLOCICE_PAKET_SIZE,
    getOdjeli,
    addOdjel,
    deleteOdjel,
    addRadnikToOdjel,
    updateRadnikInOdjel,
    deleteRadnikFromOdjel,
  };
})();
