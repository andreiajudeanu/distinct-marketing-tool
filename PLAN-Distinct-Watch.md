# Distinct Watch: plan pentru hackathonul Adobe „Marketing Reimagined”

## Context

Ideea inițială, Distinct, nu rezistă separat: un URL și un prompt bun în Claude dau mare parte din rezultat. Păstrăm descoperirea automată a rivalilor și mutăm valoarea în ce un singur prompt nu lasă în urmă: o bază de observații în timp, dovezi înainte/după și o variantă arătată direct pe pagina marketerului.

**Alegeri deja făcute de tine:** publicul sunt marketerii. Magazinul din demo e unul de test. Echipa are 2 dezvoltatori, 1 designer și 1 marketer. Alternativele explorate sunt vocea clienților și testul real în browser.

**Interpretare de confirmat:** am înțeles „nișa de marketing” astfel: produsul e pentru marketeri, nu pentru o singură categorie de produse. Utilizatorul principal e marketerul care lucrează pentru un magazin mic, intern sau freelancer. Parfumurile rămân doar categoria din demo.

## 1. Trei concepte

### A. Distinct Watch: schimbări la rivali (ales)

- **Cine:** marketer intern sau freelancer cu 1-5 magazine mici. Plătește magazinul sau freelancerul, dacă raportul intră în serviciul facturat.
- **Când:** luni dimineața, când stabilește campaniile săptămânii, sau înainte de o promoție.
- **Azi, manual:** deschide site-uri de rivali, se abonează la newslettere, folosește Google Alerts și notează în foi de calcul. Unii folosesc Visualping sau Panoramata.
- **Ce face extensia:** găsește rivali comparabili pornind de la pagina proprie, salvează oferta structurat și compară la verificarea următoare. Apoi propune un experiment limitat la ce poți oferi și îl arată pe pagina ta.
- **Avantaj față de Claude:** un prompt poate compara ce vede acum, dar nu are o bază salvată de la tine. O rutină programată se poate apropia, deci avantajul nu e absolut. Rămân: istoricul structurat, dovada legată de fiecare afirmație, regulile care blochează oferte pe care nu le poți livra și previzualizarea pe pagina reală.
- **Demo 90 s:** pagina de produs, „Urmărește piața”, rivali cu motive, două schimbări cu dovezi, experiment, variantă pe pagină, brief de măsurare.
- **Renunțăm dacă:** pe 10 pagini reale, sub 60% dintre rivalii găsiți sunt acceptați ca reali. Sau dacă Claude, cu același prompt pentru toți, egalează timpul și erorile în testul cu utilizatori.

### B. Obiecții din piață: vocea clienților

- **Cine:** același marketer, plus cine scrie paginile de produs. Plătește magazinul.
- **Când:** o dată pe lună sau înainte de rescrierea unei pagini.
- **Azi, manual:** citește recenzii, le copiază într-un document și le grupează, uneori cu ChatGPT sau Claude.
- **Ce face extensia:** colectează recenzii noi de pe paginile tale și ale rivalilor, reține ce ai văzut și semnalează obiecții noi, cu citate. Propune un bloc de pagină care răspunde obiecției.
- **Avantaj față de Claude:** doar memoria recenziilor deja văzute și preluarea din widgeturi. Analiza textului o face bine și Claude.
- **Demo 90 s:** pagina produsului, obiecție nouă despre „nu știu dacă mi se potrivește”, citate, bloc nou pe pagină.
- **Renunțăm dacă:** recenziile nu pot fi colectate fiabil pe cel puțin 7 din 10 pagini. Sau dacă magazinele mici au prea puține recenzii noi pe lună ca semnalul să conteze.

### C. Test real în browser: micro-test cu oameni reali

Limită importantă: extensia rulează doar la cine o are instalată, deci nu poate arăta variante vizitatorilor magazinului. Pentru asta e nevoie de un script pe site.

- **Cine:** marketerul care vrea o reacție înainte să ceară resurse. Plătește magazinul.
- **Când:** înainte de lansarea unei schimbări de ofertă.
- **Azi, manual:** cere păreri colegilor sau rulează un A/B test cu aplicații Shopify, dacă are trafic.
- **Ce face extensia:** creează varianta pe pagină și o transformă într-un link pentru 15-30 de clienți reali. Măsoară clicurile și un răspuns la o întrebare.
- **Avantaj față de Claude:** colectarea de reacții reale, pe care Claude nu o poate înlocui.
- **Demo 90 s:** varianta pe pagină, link, câteva răspunsuri reale, decizie.
- **Renunțăm dacă:** marketerii nu pot recruta 15 persoane într-o săptămână. Sau dacă rezultatul micro-testului nu le schimbă decizia.

### Comparație (note de la 1 la 5, estimări proprii)

| Criteriu | Pondere | A. Rivali | B. Vocea clienților | C. Test real |
|---|---:|---:|---:|---:|
| Problemă reală | 25% | 4 | 4 | 3 |
| AI esențial | 25% | 4 | 4,5 | 2,5 |
| Implementare și fiabilitate | 25% | 3,5 | 3 | 2,5 |
| Integrări utile | 15% | 3 | 2,5 | 3,5 |
| Experiență și demo | 10% | 5 | 3,5 | 4 |
| **Total ponderat** | | **3,83** | **3,60** | **2,93** |
| Bonus cost vs. valoare | | Bun: AI doar pe schimbări | Mediu: mult text la fiecare rulare | Mediu: necesită găzduire și recrutare |

**Alegerea: A.** Are cel mai bun demo vizual, se poate termina într-o zi și păstrează descoperirea rivalilor. Rezolvă și un punct slab al testelor clasice: la trafic mic, un A/B test durează prea mult, deci un experiment bine ales contează mai mult.

**Riscul lui A:** monitorizarea în sine există deja. Diferența noastră trebuie să fie pasul de după: de la schimbare la un experiment pe care magazinul îl poate face. B rămâne prima direcție de pivot, fiindcă folosește aceeași bază de observații.

### Ce am verificat și ce rămâne ipoteză

**Verificat în surse oficiale:**
- [Visualping](https://visualping.io/blog/visualping-ai): rezumate AI și alerte importante pe bază de prompt, inclusiv pe planul gratuit (5 pagini, 150 verificări pe lună). Planurile plătite încep de la $10/lună, facturat anual. Rapoartele AI combinate sunt în planul Business, $100/lună, facturat anual.
- [Panoramata](https://www.panoramata.co/pricing): urmărește reclame, emailuri, pagini de destinație și schimbări de site, cu MCP inclus în toate planurile, deci merge deja cu Claude. Planurile sunt $99, $179 și $399/lună. Din pagina de prețuri reiese că urmărirea catalogului apare la planul de $399, dar acest detaliu vine dintr-o extragere automată și merită recitit.
- [Chrome `alarms`](https://developer.chrome.com/docs/extensions/reference/api/alarms): alarmele continuă cât dispozitivul doarme, dar nu îl trezesc. Alarmele pierdute se declanșează la trezire, iar cele repetate o singură dată.
- [Adobe Express Embed SDK](https://developer.adobe.com/express/embed-sdk/docs/guides/quickstart/): cheia se obține singur din Developer Console. Accepți maximum cinci domenii, `localhost` e permis, conexiunea trebuie să fie HTTPS.
- [Express APIs](https://developer.adobe.com/express/): pagina oficială le leagă de clienții Firefly Services cu acces acordat de administrator.
- [Adobe Visual Editing Helper](https://chromewebstore.google.com/detail/adobe-experience-cloud-vi/kgmjjkfjacffaebgpkpcllakjifppnca?hl=pt-br): e pentru utilizatorii Experience Cloud care au Target sau Journey Optimizer.

**Verificat parțial:**
- **Practicieni:** Reddit nu a putut fi deschis integral, deci am citit doar fragmente din rezultate. Un [comentariu din r/ecommerce](https://www.reddit.com/r/ecommerce/comments/1rfldnq/should_i_track_competitor_offer_changes_or_just/) recomandă o listă de rivali, newslettere, Google Alerts și 10 minute pe săptămână. Asta poate însemna că durerea e mică și e un risc real pentru A. Un [alt fir](https://www.reddit.com/r/ecommerce/comments/1vlh071/how_are_you_keeping_track_of_competitor_prices/) spune că verificarea manuală consumă mult timp peste câteva produse, iar foile de calcul ajută doar parțial. Sunt opinii individuale, nu dovezi de piață.
- **Trafic pentru A/B:** [Charle Agency](https://www.charleagency.com/articles/best-AB-testing-tools-shopify/), sursă secundară, estimează aproximativ 8.400 vizitatori pe variantă la conversie de 3% și creștere detectabilă de 25%. Aceeași sursă recomandă altă abordare dacă testul depășește șase săptămâni.

**Neverificat:**
- Pagina oficială a hackathonului nu a apărut în căutări. Grila și ponderile sunt cele din mesajul tău, deci verificați regulile înainte de start.
- Dacă Embed SDK are nevoie de plan plătit nu reiese din pagina citită.
- Toate cele de mai jos sunt ipoteze până la test: rata de rivali corecți, frecvența schimbărilor utile, prețul și pragurile.

## 2. Planul pentru Distinct Watch

### Fluxul utilizatorului

1. **La început ai nevoie de:** extensia instalată, pagina unui produs din magazinul tău și un formular de un minut: ce poți oferi (mostre, pachete, prag de livrare, reducere maximă), piața țintă, plus opțional sesiuni și conversie pe lună.
2. **Intri pe pagina produsului** și deschizi panoul lateral. Extensia arată ce a citit: produs, categorie, preț, monedă, țară și ofertă. Poți corecta câmpurile greșite.
3. **Apeși „Urmărește piața”.** Primești până la 10 candidați. Fiecare are motive verificabile: același tip de produs, atribute comune, preț apropiat, aceeași monedă, livrare în țara ta. Ca dovadă, vezi pagina și fragmentul citit.
4. **Alegi** rivalii de urmărit. Extensia cere permisiune pentru fiecare domeniu, deschide paginile și salvează prima captură.
5. **La verificarea următoare** apeși „Verifică acum” sau primești insignă pe iconiță. Vezi doar schimbările relevante, fiecare cu sursă, dată și înainte/după.
6. **Alegi o schimbare** și ceri experimentul. Vezi varianta pe pagina ta, apoi aprobi, respingi sau modifici.
7. **După aprobare** salvezi experimentul, exportezi brieful și blocul de pagină. Extensia programează o reverificare peste 7 zile, ca să vezi dacă oferta rivalului mai există.

**Cazuri speciale:**
- **Marketplace (eMAG, Amazon):** e detectat după listă de domenii și după semne de vânzători multipli. Apare separat, „Reper de piață”, nu ca rival, și e exclus implicit din urmărire.
- **Magazin din altă țară:** dacă moneda, limba sau livrarea diferă, apare ca „Altă piață” și nu e urmărit fără confirmare. Dacă informația lipsește, statusul e „Piață neconfirmată”.
- **Comparabilitate:** reguli pe date, explicate în text, nu scor. Dacă un criteriu nu se poate verifica, apare ca neverificat.

### Date, decizie, execuție

**Colectăm:**
- Doar date publice sau din pagina deschisă: JSON-LD `Product`/`Offer`, meta, text vizibil în jurul prețului și al butonului, blocuri de ofertă, livrare, retur.
- Pentru fiecare observație: URL, oră, fragment exact și captură de ecran.
- Nu ocolim CAPTCHA, autentificări sau blocări.

**Reguli (fără AI):**
- Normalizare de preț și monedă, hash pe câmpuri, diff.
- Detectare marketplace, verificare monedă și țară.
- Filtrare de zgomot: cookie, footer, dată, bannere care se rotesc.
- O schimbare devine „confirmată” după două observații. Până atunci e „de confirmat”.
- Verificarea experimentului: orice ofertă propusă trebuie să apară în lista ta de capabilități, altfel e respinsă.
- Calcul de durată a testului, din datele tale de trafic. Dacă depășește șase săptămâni, extensia spune asta și propune o schimbare mai mare sau un test înainte/după, cu limitele lui.

**AI, doar unde e necesar:**
- Extrage atribute din text nestructurat.
- Încadrează o schimbare într-o listă fixă: preț, reducere, pachet/mostră, livrare, retur/garanție, stoc, mesaj principal, produs nou.
- Explică pe scurt de ce merită investigată și formulează ipoteza.
- Propune 1-2 experimente și textul variantei.
- Orice afirmație trebuie să trimită la un fragment salvat. Dacă nu are dovadă, nu e afișată.

**Fără scoruri opace.** Folosim stări și numărători: confirmat, de confirmat sau blocat; „2 din 5 rivali urmăriți”. Textul spune clar că o schimbare la rival e un semnal de investigat și nu arată că i-au crescut vânzările.

**Acțiune după aprobare:**
- Injectează varianta local în pagina ta, vizibilă doar pentru tine.
- Salvează experimentul și sursele.
- Exportă brieful: ipoteză, schimbare, metrică principală, metrică de control, durată, condiție de oprire.
- Exportă blocul de pagină și programează reverificarea.
- Nu publică nimic în magazin.

Exemplu de metrici: rata de adăugare în coș a setului de mostre, cu valoarea medie a comenzii ca metrică de control.

### MVP

**Funcția principală:** de la pagina de produs la o schimbare dovedită la rivali și un experiment arătat pe pagina ta.

**Ce rulează unde:**
- **Extensie (Manifest V3):** panou lateral, citire pagină, capturi din file deschise de extensie, stocare locală, diff și reguli, previzualizare locală.
- **Backend minim, funcții serverless:** păstrează cheile, apelează modelul AI și căutarea web pentru descoperire. Cheile nu ajung niciodată în extensie.
- **Stocare:** locală în MVP. Fără conturi.

**Cu Chrome închis nu rulează nimic din extensie.** `chrome.alarms` nu ajută atunci. Monitorizarea în acel caz cere un job programat în cloud (de exemplu Cloudflare Cron sau GitHub Actions) și o bază de date, plus o verificare de pe server, nu din browserul utilizatorului. În MVP nu construim asta. Verificarea rulează cu Chrome deschis sau la cerere, iar produsul spune data ultimei verificări.

**Echipa:**

| Persoană | Construiește |
|---|---|
| Dev 1 | Extensie, citirea paginii, captura rivalilor, stocare, diff, reguli, previzualizare |
| Dev 2 | Backend, descoperire rivali, extragere, comparabilitate, generare experiment, Adobe |
| Designer | Panou, cardurile de dovezi, stările de eroare, magazinul de test, varianta vizuală |
| Marketer | Conținutul magazinului, lista de schimbări, surse istorice, prompturile de experiment, scenariul, prezentarea |

**Ordinea (presupun 10 ore):**
1. **Ora 0-1:** schema comună a datelor și fixarea scenariului. Toată echipa lucrează pe aceleași date de test.
2. **Ora 1-3:** Dev 1 citește pagina proprie și salvează capturi. Dev 2 face descoperirea. Designerul și marketerul fac magazinul și paginile de test.
3. **Ora 3-5:** diff și reguli, comparabilitate, carduri de dovezi.
4. **Ora 5-7:** generare experiment, verificare capabilități, previzualizare pe pagină, brief.
5. **Ora 7-8:** stări de eroare și, dacă e timp, Adobe.
6. **Ora 8:** înghețăm funcțiile.
7. **Ora 8-10:** repetăm demo-ul, înregistrăm varianta de rezervă, finalizăm prezentarea.

**Ce tăiem, în ordine:**
1. Monitorizarea în cloud (deja tăiată).
2. Integrarea Embed, înlocuită cu descărcare și deschidere în Adobe Express.
3. Alarmele automate, rămâne „Verifică acum”.
4. Reverificarea la 7 zile.
5. A doua variantă de experiment.
6. Numărul de rivali scade la 3.

**Nu tăiem:** descoperirea cu motive, dovezile înainte/după, verificarea capabilităților, previzualizarea.

### Integrări

**Demo fără API-uri private.** Nu folosim Meta, YouTube sau Adobe Target. Magazinul de test e o pagină găzduită pe HTTPS cu JSON-LD corect, ori un magazin Shopify de dezvoltare dacă îl aveți deja. Pentru descoperire folosim pagini publice reale.

**Adobe, cu o sarcină clară:** experimentul are uneori nevoie de un vizual, de exemplu bannerul pentru setul de mostre. După aprobare, marketerul apasă „Editează vizualul”.

- **Putem conecta acum:**
  - Adobe Express Embed SDK într-o pagină HTTPS găzduită de noi, cu domeniu permis. Extensia deschide pagina, iar vizualul se întoarce în previzualizare. Faceți un test de 30 de minute înainte de hackathon: cheie, rulare pe domeniu, editor deschis, exportul înapoi.
  - Rezervă: PNG descărcat și deschis manual în Adobe Express.
- **Cere acces ulterior:**
  - Export de experiment spre Adobe Target sau Journey Optimizer: cere licență Experience Cloud.
  - Firefly Services și Express APIs: cer provizionare de către administrator.
  - Publicare în magazin: cere autorizarea magazinului.

**Cum arată blocările și datele incomplete:**

| Situație | Ce vede utilizatorul |
|---|---|
| Pagină blocată sau CAPTCHA | Status „Blocată”, data ultimei observații reușite, buton „Deschide și verifică manual”. Fără încercări de ocolire |
| Preț lipsă sau câmp necitit | „Necitit”, niciodată tratat ca modificare |
| Pagină dispărută | „Pagină indisponibilă”, nu „produs retras” |
| Structură schimbată | „De confirmat”, cu cerere de verificare manuală |
| Rezultate puține | „Am găsit 2 rivali comparabili” și opțiunea de a adăuga URL manual |
| AI nu răspunde | Dovezile rămân vizibile, doar experimentul e indisponibil |

### Demo de 90 de secunde

**De pregătit:**
- Magazin de test de parfumuri, cu două pagini de rival controlate de noi.
- Căutarea rulată și testată pe 3-4 pagini reale, cu rezultatul salvat ca rezervă.
- O schimbare reală găsită în Wayback Machine, dacă există. E mai credibilă decât una inventată.
- Formularul de capabilități completat.
- Înregistrare video de rezervă.

Etichetele LIVE, CAPTURĂ și SIMULAT apar în interfață, nu doar în discurs.

| Timp | Pe ecran | Tipul datelor |
|---|---|---|
| 0-10 s | Pagina de produs din magazinul de test. „Luni dimineața, ce s-a schimbat în piață?” | Pagină de test |
| 10-25 s | „Urmărește piața”. Apar rivali cu motive, un marketplace separat și un magazin din altă țară exclus | LIVE, cu rezervă CAPTURĂ |
| 25-45 s | „Verifică acum”. Doi rivali au introdus pachete de mostre. Înainte/după, sursă, dată | CAPTURĂ sau SIMULAT, marcat |
| 45-50 s | Un rival blocat apare „Blocată”. Produsul nu inventează | SIMULAT |
| 50-65 s | Experiment: set de 3 mostre, verificat cu ce poți oferi. Text: semnal, nu dovadă de vânzări | LIVE, generat de AI |
| 65-80 s | Varianta apare pe pagina ta, doar local. Vizual editat în Adobe Express sau deja pregătit | LIVE, vizual marcat dacă e pregătit |
| 80-90 s | Aprobare. Brief cu metrică, durată și condiție de oprire | LIVE |

### Valoare și validare

**Test propus:** 6 marketeri din e-commerce, câte 60 de minute. Fiecare rezolvă aceeași sarcină pe trei produse comparabile, câte unul pentru fiecare metodă: procesul lor actual, un prompt fix în Claude cu acces la web și browser, extensia.

Ordinea metodelor se rotește. Sarcina: „Ce schimbare din piață merită un experiment săptămâna asta și ce experiment ai rula?” Pregătim dinainte o listă de referință cu schimbările reale, ca să putem număra erorile.

**Măsurăm:**
- Timpul până la o decizie pe care ar pune-o în practică.
- Câte surse sunt greșite, inventate sau irelevante.
- Câtă muncă se reface: minute și procent din rezultat rescris.
- Dacă ar aplica decizia în 7 zile: da sau nu.
- Costul pe sarcină, ca estimare.

**Praguri propuse, de ajustat:**

| Rezultat | Decizie |
|---|---|
| Cel puțin 4 din 6 ar aplica decizia, timp cu cel puțin 30% mai mic decât Claude sau cu cel puțin 50% mai puține surse greșite, muncă refăcută sub 25% | Continuăm |
| Egal cu Claude la timp și erori, dar marketerii preferă istoricul | Reducem produsul la jurnal de dovezi, fără experimente generate |
| Sub 3 din 6 găsesc un semnal util sau rata de rivali corecți rămâne sub 60% | Trecem la conceptul B |
| Toți spun că 10 minute pe săptămână le ajung | Oprim ideea în această formă |

**Cost și valoare (estimări):**
- AI rulează doar pe câmpuri schimbate, deci o verificare fără schimbări are cost AI zero.
- Presupun câțiva cenți pe verificare cu schimbări, de măsurat în hackathon.
- Preț de testat: €19-29/lună pentru un freelancer. Trebuie validat. Ca reper, Visualping începe de la $10/lună și Panoramata de la $99/lună.

## Verificare înainte de predare

- Trecem fluxul complet de 5 ori la rând, pe un profil Chrome curat.
- Testăm descoperirea pe 10 pagini reale și notăm câți rivali sunt corecți, câți sunt marketplace-uri sau din altă țară.
- Testăm fiecare stare din tabelul de blocări.
- Verificăm că fiecare afirmație din experiment are sursă și că nicio cheie nu e în pachetul extensiei.
- Rulăm demo-ul cronometrat fără rețea stabilă, cu rezervele pregătite.

## Decizii luate de mine, de verificat

- Numele de lucru „Distinct Watch”.
- Parfumurile rămân categoria demo-ului.
- Mecanismul din C e un micro-test prin link, fiindcă extensia nu ajunge la vizitatori.
- Stocare locală, fără conturi în MVP.
- Publicarea reală în magazin rămâne în afara hackathonului.
