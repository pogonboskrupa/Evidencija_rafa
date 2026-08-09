// Numerička tipkovnica za unos PIN-a — dodirom (touch/klik) ili fizičkom
// tipkovnicom. Aplikacija koristi fiksnu dužinu PIN-a (kao kod stvarnih
// aplikacija — otključavanje telefona, bankovne aplikacije), pa se radnja
// (prijava, prelazak na sljedeći korak, poređenje) pokreće automatski čim je
// upisana zadnja cifra — bez posebnog dugmeta za potvrdu.

export const PIN_LENGTH = 4;

const KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function createKeypad(container, { onDigit, onBackspace }) {
  container.innerHTML = '';

  KEY_LABELS.forEach((label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'keypad-key';

    if (label === '') {
      btn.classList.add('empty');
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
    } else if (label === '⌫') {
      btn.classList.add('backspace');
      btn.textContent = label;
      btn.setAttribute('aria-label', 'Obriši zadnju cifru');
      btn.addEventListener('click', onBackspace);
    } else {
      btn.textContent = label;
      btn.setAttribute('aria-label', `Cifra ${label}`);
      btn.addEventListener('click', () => onDigit(label));
    }
    container.appendChild(btn);
  });

  return {
    setEnabled(enabled) {
      container.classList.toggle('is-disabled', !enabled);
    },
  };
}

export function renderDots(container, filledCount, max) {
  container.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const dot = document.createElement('span');
    dot.className = 'pin-dot' + (i < filledCount ? ' filled' : '');
    container.appendChild(dot);
  }
}

export function shakeDots(container) {
  container.classList.remove('shake');
  void container.offsetWidth; // restart animacije
  container.classList.add('shake');
}

// Upravlja jednim PIN poljem (tačkice + tipkovnica + status poruka). Kada je
// upisano onoliko cifara koliko traži maxLength, poziva se onComplete(pin,
// controller) — controller nudi reset/setLocked/setStatus/shake, te
// pressDigit/pressBackspace za povezivanje s fizičkom tipkovnicom.
export function createPinController({ dotsEl, keypadEl, statusEl, maxLength = PIN_LENGTH, onComplete }) {
  let digits = [];

  function render() {
    renderDots(dotsEl, digits.length, maxLength);
  }

  function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('error', !!isError);
  }

  function setLocked(locked) {
    keypad.setEnabled(!locked);
  }

  function shake() {
    shakeDots(dotsEl);
  }

  // Briše samo upisane cifre — status poruka (npr. greška) ostaje vidljiva.
  function clearDigits() {
    digits = [];
    render();
  }

  // Puni reset: cifre i status poruka. Koristi se kod prebacivanja
  // kartica/koraka, ne kod prikazivanja greške korisniku.
  function reset() {
    clearDigits();
    setStatus('');
  }

  function handleDigit(d) {
    if (keypadEl.classList.contains('is-disabled') || digits.length >= maxLength) return;
    digits.push(d);
    render();
    if (digits.length === maxLength) {
      onComplete(digits.join(''), api);
    }
  }

  function handleBackspace() {
    if (keypadEl.classList.contains('is-disabled') || !digits.length) return;
    digits.pop();
    render();
  }

  const keypad = createKeypad(keypadEl, { onDigit: handleDigit, onBackspace: handleBackspace });

  const api = {
    reset,
    clearDigits,
    setStatus,
    setLocked,
    shake,
    pressDigit: handleDigit,
    pressBackspace: handleBackspace,
  };

  render();
  return api;
}
