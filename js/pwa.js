// Registracija service workera i upravljanje instalacijom aplikacije.

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

let deferredPrompt = null;

function installButtons() {
  return Array.from(document.querySelectorAll('[data-install-btn]'));
}

function showInstallUI(visible) {
  installButtons().forEach((btn) => {
    btn.hidden = !visible;
  });
}

function showIOSHint() {
  const hint = document.querySelector('#iosInstallHint');
  if (hint) hint.hidden = false;
}

async function onInstallClick() {
  if (!deferredPrompt) return;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  showInstallUI(false);
  prompt.prompt();
  await prompt.userChoice.catch(() => {});
}

function initInstall() {
  installButtons().forEach((btn) => btn.addEventListener('click', onInstallClick));

  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome/Edge/Android: preuzmi kontrolu nad trenutkom prikaza upita.
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone()) showInstallUI(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstallUI(false);
  });

  // iOS Safari ne podržava beforeinstallprompt — ponudi upute.
  if (isIOS() && !isStandalone()) showIOSHint();
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Pri prvoj posjeti kontrolera još nema; tada preuzimanje kontrole nije
  // ažuriranje i stranicu ne treba osvježavati.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // Nova verzija je aktivirana — osvježi jednom da se ne pomiješaju
    // stara i nova verzija datoteka.
    reloading = true;
    window.location.reload();
  });

  // Relativna putanja: aplikacija radi i iz poddirektorija na GitHub Pages.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

export function initPWA() {
  initInstall();
  initServiceWorker();
}
