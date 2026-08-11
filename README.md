# Evidencija rada — Doznaka stabala za sječu

Web aplikacija za godišnju evidenciju rada u šumarstvu: doznaka stabala, vlake, teren, kiša, kancelarija, godišnji odmor, bolovanje, praznik i plaćeno odsustvo.

Aplikacija je statička (HTML/CSS/vanilla JavaScript, bez poslužitelja) i radi u potpunosti u pregledniku — svi podaci se spremaju lokalno (`localStorage`) na uređaju korisnika. Radi i kada se `index.html` otvori direktno dvoklikom (bez servera) — vidi napomenu u odjeljku "Pokretanje lokalno".

## Značajke

- **Registracija i prijava s PIN-om** putem prave numeričke tipkovnice (dodirom ili fizičkom tipkovnicom) — bez tekstualnog polja za lozinku. PIN ima fiksno 4 cifre; radnja se pokreće automatski čim je upisana zadnja cifra, bez posebnog dugmeta za potvrdu. Registracija ide u dva koraka (postavi pa potvrdi PIN), s mogućnošću povratka na prvi korak. Uz to, opcija "Zapamti me" da se ne morate prijavljivati svaki put.
- **Numerička tipkovnica na svim brojčanim poljima** — broj stabala, površina (ha), kilometraža vlaka i broj dana godišnjeg odmora otvaraju isti stil tipkovnice kao PIN prijava (polja su readonly, sistemska tastatura se ne otvara). Dodirom na polje ispod se pojavljuje panel s ciframa (i decimalnom tačkom gdje je primjenjivo); fizička tastatura na desktopu i dalje radi. Tekstualna polja (zadaci, napomena, ime/korisničko ime) i dalje koriste običnu tastaturu, jer im treba slobodan tekst.
- **Unos radnog dana** — mjesec je prikazan u vidu tabele, dan po dan u redovima (kao dnevnik), unutar skrolabilne liste sa fiksnim zaglavljem; pri otvaranju aplikacije uvijek je prikazan tekući mjesec, a prikaz se automatski pozicionira na današnji dan. Vikend dani (subota, nedjelja) posebno su označeni tamnijom nijansom sive. Klikom na red bira se vrsta dana:
  - Radni dani: **Doznaka stabala**, **Vlake**, **Teren**, **Kiša**, **Kancelarija**
  - Odsustva: **Godišnji odmor**, **Bolovanje**, **Praznik**, **Plaćeno odsustvo**
  - Kod **Doznake stabala**, **Vlaka** i **Kancelarije** dodatna polja (broj stabala i površina u ha, kilometraža vlaka, napomena) pojavljuju se **odmah** po odabiru vrste dana, bez skrolanja ili posebne potvrde. Odluka se u svakom trenutku može promijeniti — odabirom drugog tipa dana polja se ažuriraju, a modal se može zatvoriti (X, Escape ili klik izvan) bez spremanja bilo čega.
  - Kod **Doznake stabala** upisuje se *broj stabala* i *površina (ha)*.
  - Kod **Vlaka** upisuje se *kilometraža projektovanih vlaka (km)*.
  - Kod **Kancelarije** upisuje se *napomena* — šta je tog dana rađeno.
  - Uneseni učinak (broj stabala i površina, kilometraža vlaka, napomena) ispisuje se odmah uz svaki red u listi dana, i na desktopu i na uskim (mobilnim) ekranima — na mobilnom se prikazuje u drugom redu ispod vrste dana, umjesto da se izostavlja.
- **Zadaci po danu** — na svaki dan u kalendaru može se dodati lista zadataka koji se pojedinačno označavaju kao završeni ili brišu. Dan može imati samo zadatke, bez odabrane vrste dana. U listi dana prikazuje se oznaka `Zadaci 1/3`, a u godišnjem pregledu dan sa zadacima nosi sitnu tačku.
- **Kartica "Kalendar"** — poseban prostor za zadatke, termine i rokove, odvojen od evidencije radnih dana, ali automatski povezan s njom:
  - **Godišnji kalendar** — 12 mjeseci na jednom listu; pozadina dana prati zabilježenu vrstu rada (ista boja kao u "Evidencija rada"), a sitna tačka u uglu prati status zadataka (zeleno kad su svi završeni, žuto dok nešto stoji nezavršeno) — oboje se vidi odjednom, bez otvaranja dana. Klik na dan otvara modal koji na vrhu prikazuje šta je tog dana zabilježeno kao rad (vrsta dana i učinak), a ispod listu zadataka za taj dan (dodavanje, čekiranje, brisanje).
  - **Pregled po mjesecu** — hronološka lista svih dana u mjesecu koji imaju zadatke, uz bedž vrste dana i učinka pored datuma kad je taj dan evidentiran u "Evidencija rada", s brzim unosom (datum + tekst) na vrhu za dodavanje bez otvaranja godišnjeg prikaza.
  - Zadaci su isti podaci kao u "Evidencija rada" (dijele isto polje po danu) — dodavanje u jednoj kartici odmah je vidljivo u drugoj.
- **Kartica "Raspored pločica"** — raspored markirnih pločica po odjelima:
  - Otvaranjem kartice prikazuje se **lista odjela** (kartice s nazivom i zbirom radnika/pločica) — dodavanje pločica i pregled rade se tek nakon klika na odjel, koji otvara njegove detalje (s dugmetom "‹ Svi odjeli" za povratak).
  - Unutar odjela dodaju se projektanti (radnici) kojima je dodijeljen raspon pločica: ime, te ili **broj pločica** direktno ili **broj paketa** (1 paket = 30 pločica, automatski preračunato), kao i **datum zaduženja** (podrazumijevano današnji dan, može se promijeniti za naknadni/stariji unos).
  - Početna pločica se **automatski predlaže** kao nastavak posljednjeg radnika u odjelu (npr. nakon 10 paketa od pločice 1, sljedeća se sama predloži kao 301) — a po potrebi se može ručno promijeniti.
  - Radnici se prikazuju poredani po rasponu pločica, od niže ka višoj, s ukupnim brojem i rasponom (od-do) po svakom. Ako se raspon dva radnika ne nastavlja bez praznine, ili se preklapa (dupliranje, koje ne smije postojati), prikazuje se upozorenje s tačnim brojevima — praznina je dozvoljena, dupliranje nije. Odjeli s upozorenjem imaju vidljivu oznaku i u samoj listi odjela, bez potrebe da se u njih uđe.
  - Nakon unosa broja paketa/pločica, klik na **"Gotovo"** na tastaturi (ili fizička tipka Enter) odmah dodaje radnika — nije potreban dodatni klik na "Dodaj radnika". Forma se nakon toga prazni i sprema za sljedeći unos, sa automatski predloženom sljedećom pločicom.
  - Svi brojevi pločica prikazuju se s tačkom kao razdjelnikom hiljada (npr. `12.000`) — jedan odjel realno zna imati i preko 10.000 zaduženih pločica ukupno. Ispis (vidi ispod) tabelu radnika lomi preko više stranica po potrebi, s zaglavljem koje se ponavlja na svakoj, umjesto da forsira cijeli odjel u jedan neprekinut blok.
  - Odjeli i radnici se pojedinačno brišu; klik na ✎ pored radnika otvara formu s popunjenim postojećim podacima za izmjenu (umjesto brisanja i ponovnog unosa), s mogućnošću otkazivanja izmjene. Brisanje odjela traži potvrdu.
  - **Ispis / PDF** — ispisuje sve odjele s punim tabelama radnika odjednom (uključujući upozorenja), bez obzira na to je li ekran trenutno na listi ili unutar jednog odjela.
- **Postavke godišnjeg odmora** — broj dana godišnjeg odmora po godini i datum od kojeg se koristi.
- **Sigurnosna kopija** (Postavke) — "Izvezi podatke" preuzima JSON sa svim podacima trenutnog korisnika (unosi, postavke, raspored pločica); "Uvezi podatke" učitava takvu datoteku nazad — ako korisničko ime već postoji na uređaju, traži potvrdu prije prepisivanja. Jedini način da se podaci sačuvaju izvan ovog preglednika/uređaja, pošto se inače čuvaju isključivo lokalno.
- **Podsjetnici** (Postavke) — uz dozvolu preglednika (Notification API), aplikacija prikazuje obavijest o broju nezavršenih zadataka i rokova (uključujući prošle, nezavršene dane) kad je otvorena, najviše jednom dnevno po korisniku. Radi samo dok je aplikacija otvorena u pregledniku (nema pozadinskog push servera).
- **Godišnji pregled** — cijela godina (12 mjeseci) prikazana na jednom listu, sa statistikom (ukupno radnih dana, ukupan broj stabala, površina, kilometraža vlaka, iskorišteni/preostali godišnji odmor...) i mogućnošću ispisa/PDF-a.
- **Sažetak mjeseca** ispod liste dana (radni dani, stabla, površina, kilometraža, odsustva, zadaci).
- **Instalacija kao aplikacija (PWA)** — aplikacija se može instalirati na telefon ili računar i radi bez internet konekcije.
- Nazivi mjeseci po bosanskoj jezičkoj normi (januar, februar, mart ... juni, juli, august ...).
- Moderan, svijetlo zeleni dizajn: gradijentni akcenti na logu, dugmadima i aktivnim elementima, boje kategorija za vrste dana, ikone u glavnoj navigaciji, suptilne animacije (prelazak između kartica, hover/press stanja) te slojevita silueta šume kao ambijentalna pozadina.

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
