# Distinct Watch

Extensie Chrome pentru marketeri. Deschizi site-ul tău și apeși „Analizează site-ul meu”. Extensia găsește singură competitorii din piața ta, le citește paginile, compară mesajele și designul, apoi scrie trei recomandări cu dovezi. Competitorii găsiți pot fi urmăriți în timp, iar schimbările lor devin experimente limitate la ce poți oferi.

## Cum funcționează

```
Extensie Chrome            Server Python (8788)           Servicii externe
citește pagina ta   --->   pornește un job      --->      Claude: profil, comparație, recomandări
urmărește progresul <---   îl rulează în fundal --->      Tavily: caută candidați
afișează raportul          păstrează rezultatul --->      Playwright: deschide paginile rivalilor

Server Node (8787): magazinul demo, căutarea de pagini de produs și experimentele.
```

Pe scurt, pentru cine vede prima dată proiectul:

- **Extensia** nu are chei și nu face cercetarea. Citește pagina ta și arată rezultatul.
- **Jobul** e o analiză care durează 2-3 minute. Extensia primește un număr de job și întreabă la 2 secunde cât s-a progresat. Așa, analiza nu se pierde dacă închizi panoul.
- **Claude propune, codul decide.** Un competitor rămâne doar dacă URL-ul vine din căutare și citatul lui există pe pagina citită. O afirmație rămâne doar dacă trimite la o dovadă salvată.
- **Text extern înseamnă date.** Conținutul site-urilor intră în prompturi delimitat, ca material de analizat.

## Instalare pe Windows

Ai nevoie de [Python 3.15](https://www.python.org/downloads/), [Node 24](https://nodejs.org/) și Chrome. Comenzile sunt pentru PowerShell, din folderul proiectului.

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m playwright install chromium-headless-shell
Copy-Item .env.example .env
```

Deschide `.env` și completează:

- `ANTHROPIC_API_KEY`, de pe [platform.claude.com](https://platform.claude.com/)
- `TAVILY_API_KEY`, de pe [app.tavily.com](https://app.tavily.com/)

Cheile stau doar în `.env`. Fișierul e ignorat de Git. Nu le pune în `.env.example` și nu le lipi în chat. Dacă o cheie a ajuns într-un commit sau într-un mesaj, revoc-o și creează alta.

## Pornire

Ai nevoie de două terminale.

```powershell
# Terminalul 1: analiza site-urilor
.\.venv\Scripts\python.exe backend\run.py

# Terminalul 2: magazinul demo și experimentele
npm start
```

Încarcă extensia:

1. Deschide `chrome://extensions`.
2. Activează Developer mode.
3. Apasă Load unpacked și alege folderul `extension`.

După schimbări în cod, repornește serverele și apasă reîncărcarea extensiei din `chrome://extensions`.

Verifică serverul Python la `http://localhost:8788/api/health`. Trebuie să vezi `anthropic_configured` și `tavily_configured` cu valoarea `true`.

## Demo pentru prezentare

**Analiză reală (3 minute, consumă credite):**

1. Deschide site-ul public ales.
2. Apasă iconița extensiei, apoi „Analizează site-ul meu”, și acceptă permisiunea pentru acel site.
3. Raportul se deschide într-o filă nouă și se completează pe măsură ce avansează.
4. Arată piața detectată, competitorii cu linkuri, comparația și cele trei recomandări.
5. Apasă un `e12` ca să arăți dovada din spatele unei afirmații.
6. Corectează țara și apasă butonul rotund de jos ca să reiei căutarea.

**Rezervă fără rețea sau credite (20 de secunde):** deschide `http://localhost:8787/demo/shop` și apasă același buton. Pe `localhost`, raportul vine din `backend/fixtures/demo_result.json` și are eticheta SIMULAT.

**Urmărirea în timp:**

1. După analiză, în fila Piață, apasă „Citește paginile” și „Urmărește selecția”.
2. Deschide `http://localhost:8787/demo/control` și apasă „După”.
3. Apasă „Verifică acum” de două ori. A doua observație confirmă schimbarea.
4. Apasă „Propune experiment”, „Arată pe pagina mea” și „Aprobă”.

Pentru a arăta raportul fără rețea pe orice pagină, pune `ANALYSIS_MODE=mock` în `.env` și repornește serverul Python.

## API

| Metodă | Rută | Rol |
|---|---|---|
| GET | `/api/health` | Starea serverului. Nu expune cheile. |
| POST | `/api/analyses` | Pornește un job din `page` sau din `rerun_of` cu `market_override`. |
| GET | `/api/analyses/{job_id}` | Progres și rezultat parțial. `?screenshots=true` include capturile. |

Documentația interactivă e la `http://localhost:8788/docs`.

## Teste

```powershell
npm test
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

Testele Python nu ating servicii plătite: Claude și Tavily sunt simulate. `test_fetcher.py` rulează Chromium real pe servere locale.

## Structură

- `extension/`: panoul lateral, pagina de raport, citirea paginilor, previzualizarea.
- `extension/lib/extract-site.js`: citește un site. Îl folosesc atât panoul, cât și Playwright.
- `extension/lib/rules.js`: regulile fără AI pentru urmărire.
- `backend/app/`: un modul pe etapă:
  - `profile.py`: profilul afacerii.
  - `market.py`: piața țintă.
  - `discovery.py`: căutare și filtrare.
  - `fetcher.py` și `url_safety.py`: deschiderea sigură a paginilor.
  - `analysis.py`: verificare și comparație.
  - `recommendations.py`: cele trei recomandări.
  - `pipeline.py`: ordinea etapelor. `jobs.py`: joburile. `llm.py`: apelurile Claude.
- `server/`: serverul Node, cu demo și experimente.
- `test/`, `backend/tests/`: testele.

## Decizii de implementare

- **Python lângă Node.** Serverul Node funcționa și are demo-ul. Analiza nouă stă separat, deci nimic nu a fost rescris.
- **Fără scoruri.** Asemănarea apare ca observații cu dovezi, iar relevanța ca „direct”, „indirect” sau „referință vizuală”.
- **Piața nu vine din limbă sau domeniu.** Acestea sunt semnale slabe. Fără livrare, adresă, monedă locală sau text explicit, apare „Piață neconfirmată”.
- **Redirecționările sunt urmate manual.** Chromium nu le trece prin filtrul Playwright, așa că fiecare pas e verificat înainte de cerere.
- **Fără mod ascuns.** Dacă o cheie lipsește sau căutarea eșuează, vezi eroarea. Datele fictive apar doar pe `localhost` sau cu `ANALYSIS_MODE=mock`, marcate SIMULAT.

## Limite cunoscute

- Joburile stau în memorie 30 de minute. Repornirea serverului Python le pierde. Ultimul raport terminat rămâne salvat în extensie.
- Pot rula 3 joburi simultan, doar local. O analiză face în jur de 6 apeluri Claude și 4 căutări Tavily.
- Multe magazine mari refuză browsere automate. Apar ca „Blocată”, iar numărul de competitori poate scădea sub 3.
- Bannerele de cookie nu sunt închise. Pot apărea în capturi și pot influența observațiile vizuale.
- Pagina analizată e cea deschisă, de obicei prima pagină a competitorului. Nu parcurgem tot site-ul.
- Verificarea URL-urilor are două goluri mici: un domeniu care își schimbă DNS-ul între verificare și încărcare, și resurse (imagini, scripturi) care redirecționează spre o adresă privată. În al doilea caz, cererea pleacă, dar pagina e respinsă. Riscul e redus cât serverul e local. Înainte de găzduire public, rulează browserul izolat de rețeaua internă.
- Cu Chrome închis nu rulează verificarea schimbărilor. Reverificarea la 7 zile e doar o dată afișată.
- Adobe Express Embed SDK nu e integrat. „Vizual” descarcă un PNG și deschide Adobe Express.

## Probleme frecvente

| Mesaj | Ce faci |
|---|---|
| „Backendul de analiză nu răspunde” | Pornește `backend\run.py`. |
| „Lipsește din .env: …” | Completează cheia în `.env`, nu în `.env.example`, apoi repornește. |
| „Lipsește browserul” | Rulează `python -m playwright install chromium-headless-shell` din `.venv`. |
| Panoul arată `AI: SIMULAT`, deși ai cheie | Serverul Node a pornit înainte de `.env`. Oprește-l și rulează din nou `npm start`. |
| `EADDRINUSE` la `npm start` | Un server vechi ține portul 8787. Oprește-l. |
| „Captură necitită” la site-ul tău | Chrome a refuzat captura, iar serverul nu a putut deschide pagina. Restul raportului rămâne valid. |
