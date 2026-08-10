// Numerička tipkovnica za unos PIN-a — dodirom (touch/klik) ili fizičkom
// tipkovnicom. Aplikacija koristi fiksnu dužinu PIN-a (kao kod stvarnih
// aplikacija — otključavanje telefona, bankovne aplikacije), pa se radnja
// (prijava, prelazak na sljedeći korak, poređenje) pokreće automatski čim je
// upisana zadnja cifra — bez posebnog dugmeta za potvrdu.
//
// Obična skripta (bez ES modula) — vidi napomenu u storage.js.

window.Keypad = (function () {
  const PIN_LENGTH = 4;

  const KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  function createKeypad(container, { onDigit, onBackspace }) {
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

  function renderDots(container, filledCount, max) {
    container.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const dot = document.createElement('span');
      dot.className = 'pin-dot' + (i < filledCount ? ' filled' : '');
      container.appendChild(dot);
    }
  }

  function shakeDots(container) {
    container.classList.remove('shake');
    void container.offsetWidth; // restart animacije
    container.classList.add('shake');
  }

  // Upravlja jednim PIN poljem (tačkice + tipkovnica + status poruka). Kada je
  // upisano onoliko cifara koliko traži maxLength, poziva se onComplete(pin,
  // controller) — controller nudi reset/setLocked/setStatus/shake, te
  // pressDigit/pressBackspace za povezivanje s fizičkom tipkovnicom.
  function createPinController({ dotsEl, keypadEl, statusEl, maxLength = PIN_LENGTH, onComplete }) {
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

  // ==================== Numerička polja (broj stabala, površina, km, ...) ====================
  // Isti princip kao PIN tipkovnica, ali za slobodan (ne fiksne dužine) unos
  // brojeva bilo gdje u aplikaciji. Polje se postavlja na readOnly +
  // inputmode="none" da se na dodirnim uređajima ne otvori sistemska
  // tastatura pored naše — dodirom na polje otvara se panel s ciframa ispod
  // njega. Fizička tastatura i dalje radi (cifre, tačka, Backspace) radi
  // udobnosti na desktopu.

  const NUMERIC_KEYS_INT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  const NUMERIC_KEYS_DEC = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  // Samo jedan panel je otvoren u datom trenutku (globalno, kroz sva polja).
  let activeInput = null;
  let activeHost = null;

  function closeActivePanel() {
    if (activeHost) {
      activeHost.innerHTML = '';
      activeHost.classList.remove('open');
    }
    activeInput = null;
    activeHost = null;
  }

  // Jedan document-level listener za sva polja (ne po polju) — izbjegava
  // gomilanje listenera pri svakom ponovnom iscrtavanju modala.
  document.addEventListener('click', (e) => {
    if (!activeHost) return;
    if (activeHost.contains(e.target) || e.target === activeInput) return;
    closeActivePanel();
  });

  function appendValue(input, ch) {
    input.value += ch;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function backspaceValue(input) {
    input.value = input.value.slice(0, -1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function appendDecimalPoint(input) {
    if (input.value.includes('.')) return;
    input.value = (input.value || '0') + '.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // input: <input readonly> koje treba povezati s tastaturom.
  // hostEl: prazan <div> u koji se panel iscrtava (obično odmah ispod polja
  //   ili grupe polja); više polja može dijeliti isti hostEl.
  // decimal: dozvoljava tačku (npr. površina, km); broj stabala je cio broj.
  // label: kratak naziv polja prikazan iznad panela (npr. "Površina (ha)").
  function attachNumberField(input, { hostEl, decimal = false, label = '' }) {
    input.readOnly = true;
    input.setAttribute('inputmode', 'none');
    input.classList.add('num-field');

    function renderPanel() {
      hostEl.innerHTML = '';
      hostEl.classList.add('open');

      if (label) {
        const tag = document.createElement('div');
        tag.className = 'num-keypad-label';
        tag.textContent = label;
        hostEl.appendChild(tag);
      }

      const grid = document.createElement('div');
      grid.className = 'keypad';
      (decimal ? NUMERIC_KEYS_DEC : NUMERIC_KEYS_INT).forEach((k) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'keypad-key';
        if (k === '') {
          btn.classList.add('empty');
          btn.tabIndex = -1;
          btn.setAttribute('aria-hidden', 'true');
        } else if (k === '⌫') {
          btn.classList.add('backspace');
          btn.textContent = k;
          btn.setAttribute('aria-label', 'Obriši zadnju cifru');
          btn.addEventListener('click', () => backspaceValue(input));
        } else {
          btn.textContent = k;
          btn.setAttribute('aria-label', k === '.' ? 'Decimalni zarez' : `Cifra ${k}`);
          btn.addEventListener('click', () => (k === '.' ? appendDecimalPoint(input) : appendValue(input, k)));
        }
        grid.appendChild(btn);
      });
      hostEl.appendChild(grid);

      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'btn btn-secondary num-keypad-done';
      done.textContent = 'Gotovo';
      done.addEventListener('click', closeActivePanel);
      hostEl.appendChild(done);
    }

    function openPanel() {
      if (activeHost && activeHost !== hostEl) closeActivePanel();
      activeInput = input;
      activeHost = hostEl;
      renderPanel();
    }

    input.addEventListener('focus', openPanel);
    input.addEventListener('click', openPanel);

    // Fizička tastatura (desktop): cifre, tačka (ako decimal), Backspace.
    // Sve ostalo se blokira jer je polje readOnly/numeričko po namjeni.
    input.addEventListener('keydown', (e) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendValue(input, e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspaceValue(input);
      } else if (decimal && e.key === '.') {
        e.preventDefault();
        appendDecimalPoint(input);
      } else if (e.key === 'Tab' || e.key === 'Escape') {
        // dozvoli standardnu navigaciju/zatvaranje modala
      } else {
        e.preventDefault();
      }
    });
  }

  return { PIN_LENGTH, createKeypad, renderDots, shakeDots, createPinController, attachNumberField };
})();
