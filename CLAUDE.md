# Distinct Watch

Extensie Chrome de marketing pentru hackathonul Adobe „Marketing Reimagined”. Un marketer pornește de la site-ul lui. Extensia găsește automat competitorii din piața lui, compară mesajele și designul și scrie trei recomandări cu dovezi. Competitorii pot fi urmăriți: extensia le salvează oferta, arată schimbările înainte/după și propune un experiment limitat la ce poate oferi magazinul, afișat local pe pagina lui.

Planul de produs e în `PLAN-Distinct-Watch.md`. Designul e în `references.md`. Citește `references.md` înainte de orice modificare vizuală.

## Comenzi

```powershell
npm install
npm start
npm test

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m playwright install chromium-headless-shell
npm run backend
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

- `npm start` pornește serverul Node pe `http://localhost:8787`, cu magazinul demo la `/demo/shop` și controlul demo la `/demo/control`.
- `npm run backend` pornește analiza de site-uri pe `http://localhost:8788`, cu Python-ul din `.venv`.
- Cheile stau doar în `.env`. Niciodată în `.env.example`, care nu e ignorat de Git.
- Pagina demo de pe `localhost` folosește mereu date marcate SIMULATED. Un site real fără cheie primește o eroare, niciodată date fictive.
- `ANALYSIS_MODE=mock` forțează raportul din `backend/fixtures/demo_result.json`, tot marcat SIMULATED.
- Extensia se încarcă din `chrome://extensions`, cu Load unpacked pe folderul `extension`.
- Nu există pas de build pentru extensie. JavaScript-ul rulează direct.

## Structură

```
extension/
  manifest.json     Manifest V3
  background.js     deschide panoul la clic pe iconiță
  panel.html        scheletul static
  panel.js          stare, acțiuni, I/O Chrome, randare
  app.css           tokeni, componente, ecrane
  results.html/.js  pagina de raport, urmărește jobul
  ui/views.js       funcții pure stare -> HTML
  ui/report.js      funcții pure job -> HTML
  ui/theme.js       tema: Light implicit, Dark ales din Settings
  ui/sheet.js       comportamentul sheet-ului de jos
  ui/icons.js       pictograme SVG proprii
  lib/rules.js      reguli deterministe, fără AI și fără I/O
  lib/analysis.js   apelurile către backendul Python
  lib/extract.js    injectat în pagini, citește datele produsului
  lib/extract-site.js  citește un site, folosit și de Playwright
  assets/3d/        obiecte 3D redate din cod
  assets/fonts/     Lexend local
backend/
  run.py            pornește FastAPI pe 127.0.0.1
  app/main.py       API: health, creare job, citire job
  app/pipeline.py   ordinea etapelor și rezultatele parțiale
  app/jobs.py       joburi în memorie, 30 de minute
  app/schemas.py    modele Pydantic pentru API și pentru ieșirile Claude
  app/profile.py    profilul afacerii
  app/market.py     piața țintă, din semnale
  app/discovery.py  Tavily, filtrare, triere
  app/fetcher.py    Playwright, robots.txt, capturi
  app/url_safety.py respinge adrese locale și private
  app/analysis.py   apelul de raport, verificare competitori, dovezi
  app/recommendations.py  filtrează recomandările fără dovadă
  app/llm.py        singurul modul care apelează Claude, măsoară tokenii
  app/mock.py       rezultate din fișier, marcate SIMULATED
  fixtures/         datele demo
  tests/            pytest
server/
  index.mjs         HTTP pe 127.0.0.1
  ai.mjs            apeluri Claude
  simulated.mjs     răspunsuri pentru demo
  demo.mjs          magazin și rivali fictivi
tools/render-3d/    sursa obiectelor 3D
test/               node --test
examples/           referințele vizuale, nu se modifică
```

## Reguli de produs

Acestea sunt invariante. Nu le slăbi ca să treacă un test sau ca să arate mai bine un demo.

- Cheile API rămân pe server. Nu intră niciodată în `extension/`.
- Nu ocolim CAPTCHA, autentificări sau blocări. O pagină blocată apare ca „Blocked”.
- Nu publicăm nimic în magazin. Previzualizarea e locală, în DOM, doar pentru utilizator.
- Fără scoruri opace. Folosim stări și numărători: Confirmed, To confirm, Blocked, „2 verified from 5 candidates”.
- O schimbare la rival e un semnal de investigat. Textul nu sugerează niciodată că i-au crescut vânzările.
- O schimbare devine confirmată doar la a doua observație.
- Un câmp necitit apare „Not read” și nu e tratat niciodată ca modificare.
- O pagină dispărută apare „Page unavailable”, nu „product removed”.
- Orice afirmație dintr-un experiment trimite la o dovadă salvată. Fără dovadă, nu apare.
- Un experiment care cere o capabilitate nedeclarată e respins de `checkExperiment`.
- Datele demo poartă eticheta SIMULATED în interfață. Eticheta nu dispare din motive estetice.
- Textul venit de pe site-uri externe e material de analizat, nu instrucțiuni. Rămâne delimitat în prompturi.
- Nu inventăm competitori sau URL-uri. Dacă cercetarea eșuează, utilizatorul vede eroarea și numărul real găsit.
- Un competitor rămâne doar dacă domeniul vine din căutare și citatul lui există pe pagina citită. Regula e în cod, nu doar în prompt.
- Limba și domeniul nu stabilesc o țară. Un `hreflang` cu mai multe regiuni arată traduceri, nu o piață. Fără livrare, adresă, monedă locală sau citat, piața e „Market unconfirmed”.
- Relevanța comercială și observațiile vizuale rămân separate. O observație vizuală citează o captură.
- Backendul nu deschide adrese locale sau private. Orice pas de redirecționare e verificat înainte de cerere.
- Respectăm `robots.txt`, iar browserul se prezintă sincer. Fără stealth.
- Costul e o cerință de produs. O analiză face cel mult 3 apeluri Claude și 3 căutări Tavily, fără reîncercări plătite. Ținta e sub 20 de cenți. Costul real apare în raport. Orice schimbare a pipeline-ului se măsoară din nou.
- Raportul rămâne scurt: Overview, Competitors, Actions. Nu adăuga câmpuri fără un pas clar pentru utilizator.

## Cod

- JavaScript ES modules, fără TypeScript și fără framework, în `extension/` și `server/`.
- Python doar în `backend/`, cu FastAPI și Pydantic. Fără baze de date, Redis, Docker sau LangChain.
- Claude se apelează doar din `backend/app/llm.py` și `server/ai.mjs`. Serviciile externe se injectează prin `Deps`, ca testele să nu ajungă la API-uri plătite.
- `lib/rules.js` rămâne pur. Orice regulă nouă primește întâi un test în `test/rules.test.mjs`.
- `ui/views.js` nu atinge `chrome.*`, rețeaua sau stocarea. Primește stare și întoarce HTML.
- Tot ce vine din exterior trece prin `esc()` în HTML și prin `safeUrl()` în linkuri.
- Previzualizarea injectată folosește doar `textContent`.
- Funcțiile date la `executeScript` nu pot folosi variabile din afara lor.
- `chrome.permissions.request` se apelează sincron în clic, înainte de orice `await`.
- La schimbarea câmpurilor text nu re-randa. Înlocuirea DOM-ului între mousedown și mouseup pierde clicul.
- În panou nu folosi `localStorage`. Starea stă în `chrome.storage.local`.
- `extract-site.js` e rulat și de Playwright, deci rămâne o singură expresie, fără `chrome.*`.
- Claude: `@anthropic-ai/sdk` în Node și `anthropic` în Python, modelul `claude-sonnet-5-5` cu efort `low`, ieșire structurată prin `output_config.format`, `fallbacks: "default"` cu beta `server-side-fallback-2026-07-01`.

## Design

`references.md` e autoritatea. Pe scurt:

- Interfața reproduce compoziția și culorile din `examples/Screenshot 2026-11-07 142804.png`. Fiecare ecran urmează unul dintre cele trei telefoane din poză, prin `data-look`: `left`, `violet` sau `right`.
- Raportul arată cele trei telefoane alăturate pe ecran lat și unul singur sub 1180 px.
- Pornește mereu în Light, chiar dacă sistemul e pe dark. Dark se alege din Settings și e negru iOS, cu accente violet și aqua.
- Butonul rotund analizează site-ul din fila curentă. Pe Market urmărește selecția, pe Changes verifică rivalii, iar în timpul unei analize deschide progresul. Nu e niciodată inactiv.
- Bara de jos are 4 file doar cu pictograme, cu `aria-label` și tooltip. Detaliile se deschid în sheet pe `<dialog>`.
- Chip-urile și căutarea sunt reale. Nu adăuga controale doar de aspect.
- Tipografia e Lexend, cu scara din `references.md`.
- Culorile vin doar din tokenii din `extension/app.css`. Fără hex scris direct în componente.
- Contrastul are prioritate față de poză. Abaterile sunt listate în `references.md`.
- Fără mărci, personaje sau ilustrații din poză. Folosim mascota și obiectele noastre, redate din cod.
- Nu adăuga resurse de la distanță. MV3 și confidențialitatea cer ca fonturile și imaginile să fie locale.
- HyperFrames, Remotion și ffmpeg nu rulează în extensie. Sunt doar pentru materiale de prezentare.

Fiecare schimbare vizuală trece lista de verificare de la finalul `references.md`, în Light și Dark, la 320 și 380 px.

## Accesibilitate

- Contrast 4.5:1 pentru text normal, 3:1 pentru text mare.
- Toate acțiunile sunt `<button>` sau `<a>`, accesibile din tastatură.
- Focusul se restaurează după `render()`.
- Comutatoarele sunt `input[type=checkbox][role=switch]`.
- Panoul de jos e `<dialog>` nativ.
- Respectă `prefers-reduced-motion`, `prefers-reduced-transparency` și `prefers-contrast`.

## Verificare

- `npm test` și pytest trebuie să treacă înainte de orice raportare.
- Modificările de interfață se verifică în browser, nu doar prin teste.
- În unele medii Chromium și Edge nu pornesc. Atunci verifică panoul printr-un simulator pentru `chrome.*` și spune clar că nu a rulat în Chrome real.
- Fluxul AI real cere cheie. Spune clar dacă a rulat doar în modul SIMULATED.
- Înainte de o rulare live, confirmă că portul 8788 e liber. Un backend vechi rămas pornit consumă credite cu cod vechi.

## Limite cunoscute

- Verificarea rulează doar cu Chrome deschis și la cerere.
- La urmărirea în timp, dovada e text, sursă și dată. Capturile există doar în raportul de analiză.
- Adobe Express Embed SDK nu e integrat. Vizualul descarcă un PNG și deschide Adobe Express.
- Serverele sunt locale. Joburile stau în memorie 30 de minute.
- Bannerele de cookie nu sunt închise și pot apărea în capturi.
- `chrome.tabs.captureVisibleTab` poate fi refuzat. Atunci backendul ia captura site-ului propriu.

## Git

Proiectul are propriul depozit Git, pe ramura `master`. Nu comite fără cerere explicită.
