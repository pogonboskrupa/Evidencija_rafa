# Evidencija rada — Doznaka stabala za sječu

Web aplikacija za godišnju evidenciju rada u šumarstvu: doznaka stabala, vlake, teren, kiša, kancelarija, godišnji odmor, bolovanje, praznik i plaćeno odsustvo.

Aplikacija je statička (HTML/CSS/vanilla JavaScript, bez poslužitelja) i radi u potpunosti u pregledniku — svi podaci se spremaju lokalno (`localStorage`) na uređaju korisnika.

## Značajke

- **Registracija i prijava s PIN-om** (4–6 znamenki), uz opciju "Zapamti me" da se ne morate prijavljivati svaki put.
- **Unos radnog dana** — mjesec je prikazan u vidu tabele, dan po dan u redovima (kao dnevnik), s vikend danima (subota, nedjelja) posebno označenim tamnijom nijansom sive. Klikom na red bira se vrsta dana:
  - Radni dani: **Doznaka stabala**, **Vlake**, **Teren**, **Kiša**, **Kancelarija**
  - Odsustva: **Godišnji odmor**, **Bolovanje**, **Praznik**, **Plaćeno odsustvo**
  - Kod **Doznake stabala** upisuje se dodatno *broj stabala* i *površina (ha)*.
  - Kod **Vlaka** upisuje se *kilometraža projektovanih vlaka (km)*.
- **Unos za raspon dana** — godišnji odmor (ili bolovanje/praznik/plaćeno odsustvo) moguće je unijeti odjednom za period od–do datuma, uz opciju preskakanja vikend dana.
- **Postavke godišnjeg odmora** — broj dana godišnjeg odmora po godini i datum od kojeg se koristi.
- **Godišnji pregled** — cijela godina (12 mjeseci) prikazana na jednom listu, sa statistikom (ukupno radnih dana, ukupan broj stabala, površina, kilometraža vlaka, iskorišteni/preostali godišnji odmor...) i mogućnošću ispisa/PDF-a.
- Nazivi mjeseci po bosanskoj jezičkoj normi (januar, februar, mart ... juni, juli, august ...).
- Moderan, svijetlo zeleni dizajn s motivima obrisa šume.

## Pokretanje lokalno

Aplikacija ne zahtijeva build alate. Dovoljno je poslužiti datoteke statičkim serverom, npr.:

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

## Napomena o podacima

Budući da je riječ o potpuno statičkoj aplikaciji bez poslužitelja, svi korisnički računi i unosi spremaju se lokalno u pregledniku (`localStorage`). Podaci nisu dijeljeni između različitih uređaja/preglednika. PIN se prije spremanja hashira (SHA-256 sa solju), no imajte na umu da ovo nije zamjena za pravu poslužiteljsku autentikaciju — prikladno je za osobnu/internu evidenciju.
