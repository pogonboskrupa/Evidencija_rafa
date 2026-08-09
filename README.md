# Evidencija rada — Doznaka stabala za sječu

Web aplikacija za godišnju evidenciju rada u šumarstvu: doznaka stabala, vlake, teren, kiša, kancelarija, godišnji odmor, bolovanje, praznik i plaćeno odsustvo.

Aplikacija je statička (HTML/CSS/vanilla JavaScript, bez poslužitelja) i radi u potpunosti u pregledniku — svi podaci se spremaju lokalno (`localStorage`) na uređaju korisnika. Radi i kada se `index.html` otvori direktno dvoklikom (bez servera) — vidi napomenu u odjeljku "Pokretanje lokalno".

## Značajke

- **Registracija i prijava s PIN-om** putem prave numeričke tipkovnice (dodirom ili fizičkom tipkovnicom) — bez tekstualnog polja za lozinku. PIN ima fiksno 4 cifre; radnja se pokreće automatski čim je upisana zadnja cifra, bez posebnog dugmeta za potvrdu. Registracija ide u dva koraka (postavi pa potvrdi PIN), s mogućnošću povratka na prvi korak. Uz to, opcija "Zapamti me" da se ne morate prijavljivati svaki put.
- **Unos radnog dana** — mjesec je prikazan u vidu tabele, dan po dan u redovima (kao dnevnik), unutar skrolabilne liste sa fiksnim zaglavljem; pri otvaranju aplikacije uvijek je prikazan tekući mjesec, a prikaz se automatski pozicionira na današnji dan. Vikend dani (subota, nedjelja) posebno su označeni tamnijom nijansom sive. Klikom na red bira se vrsta dana:
  - Radni dani: **Doznaka stabala**, **Vlake**, **Teren**, **Kiša**, **Kancelarija**
  - Odsustva: **Godišnji odmor**, **Bolovanje**, **Praznik**, **Plaćeno odsustvo**
  - Kod **Doznake stabala** upisuje se dodatno *broj stabala* i *površina (ha)*.
  - Kod **Vlaka** upisuje se *kilometraža projektovanih vlaka (km)*.
  - Kod **Kancelarije** upisuje se *napomena* — šta je tog dana rađeno.
- **Zadaci po danu** — na svaki dan u kalendaru može se dodati lista zadataka koji se pojedinačno označavaju kao završeni ili brišu. Dan može imati samo zadatke, bez odabrane vrste dana. U listi dana prikazuje se oznaka `Zadaci 1/3`, a u godišnjem pregledu dan sa zadacima nosi sitnu tačku.
- **Postavke godišnjeg odmora** — broj dana godišnjeg odmora po godini i datum od kojeg se koristi.
- **Godišnji pregled** — cijela godina (12 mjeseci) prikazana na jednom listu, sa statistikom (ukupno radnih dana, ukupan broj stabala, površina, kilometraža vlaka, iskorišteni/preostali godišnji odmor...) i mogućnošću ispisa/PDF-a.
- **Sažetak mjeseca** ispod liste dana (radni dani, stabla, površina, kilometraža, odsustva, zadaci).
- **Instalacija kao aplikacija (PWA)** — aplikacija se može instalirati na telefon ili računar i radi bez internet konekcije.
- Nazivi mjeseci po bosanskoj jezičkoj normi (januar, februar, mart ... juni, juli, august ...).
- Moderan, svijetlo zeleni dizajn: čista tipografija, boje kategorija umjesto ikona, te suptilna slojevita silueta šume kao ambijentalna pozadina.

## Pokretanje lokalno

Aplikacija ne zahtijeva build alate niti server — datoteke su obične skripte (ne ES moduli), pa je dovoljno **dvoklikom otvoriti `index.html`** u pregledniku.

Ako ipak želite poslužiti aplikaciju preko lokalnog servera (npr. radi testiranja PWA instalacije, koja zahtijeva `http://localhost` ili HTTPS):

```bash
python3 -m http.server 8080
```

zatim otvorite `http://localhost:8080` u pregledniku.

## Objava na GitHub Pages

U repozitoriju se nalazi GitHub Actions workflow (`.github/workflows/deploy.yml`) koji automatski objavljuje aplikaciju na GitHub Pages pri svakom pushu na `main` granu.

Da bi to proradilo:

1. Otvorite **Settings → Pages** u repozitoriju.
2. Pod **Build and deployment → Source** odaberite **GitHub Actions**.
3. Nakon spajanja (merge) ove grane u `main`, workflow će automatski objaviti stranicu na `https://<korisnik>.github.io/<repo>/`.

## Instalacija na telefon ili računar

Aplikacija je PWA (Progressive Web App), pa se može instalirati kao samostalna aplikacija s vlastitom ikonom:

- **Android / Chrome / Edge:** otvorite stranicu i kliknite **Instaliraj aplikaciju** (dugme se pojavi kada preglednik ponudi instalaciju), ili odaberite *Instaliraj aplikaciju* iz menija preglednika.
- **iPhone / iPad (Safari):** otvorite **Podijeli → Dodaj na početni ekran**. iOS ne podržava automatski upit, pa aplikacija prikazuje uputu.
- **Desktop Chrome / Edge:** ikona za instalaciju pojavi se u adresnoj traci.

Nakon instalacije aplikacija radi i **bez internet konekcije** — service worker (`sw.js`) drži kopiju aplikacije, a svi podaci ionako žive lokalno na uređaju.

Strategija keširanja je "mreža prvo, keš kao rezerva": kada ste online uvijek dobijate najnoviju verziju, a offline se učitava iz keša. Pri objavi nove verzije dovoljno je podići `VERSION` u `sw.js` — stari keš se briše, a otvorena stranica se jednom osvježi.

> **Napomena:** instalacija i rad offline zahtijevaju HTTPS (ili `localhost`). GitHub Pages servira preko HTTPS-a, pa je uvjet zadovoljen.

## Napomena o podacima

Budući da je riječ o potpuno statičkoj aplikaciji bez poslužitelja, svi korisnički računi i unosi spremaju se lokalno u pregledniku (`localStorage`). Podaci nisu dijeljeni između različitih uređaja/preglednika. PIN se prije spremanja hashira (SHA-256 sa solju), no imajte na umu da ovo nije zamjena za pravu poslužiteljsku autentikaciju — prikladno je za osobnu/internu evidenciju.

> **Napomena:** PIN je standardizovan na 4 cifre. Ako je neki nalog ranije napravljen s dužim PIN-om (prije uvođenja tipkovnice), prijava putem tipkovnice za njega neće raditi jer se šalju tačno 4 cifre — u tom slučaju je potrebno obrisati stari nalog i registrovati se ponovo.
