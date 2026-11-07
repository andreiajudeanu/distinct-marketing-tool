# Referințe vizuale Distinct Watch

Acest fișier descrie cele trei exemple din `examples/` și le transformă în reguli pentru interfață. Exemplele sunt sursa de adevăr pentru stil. Când un ecran nu e acoperit aici, alege soluția care ar fi putut apărea într-unul dintre exemple.

Culorile marcate „măsurat” au fost citite direct din pixelii imaginilor, în benzi de 6 unități pe canal. Pot varia cu câteva unități față de originalul din care provine captura. Toate celelalte valori (raze, dimensiuni, spațieri) sunt estimate vizual și convertite la un panou lat de 380 px.

## Ce preluăm și ce nu

Preluăm limbajul vizual: compoziția, proporțiile, paleta, tipografia, materialele și ritmul ecranelor.

Nu preluăm mărcile, personajele, ilustrațiile sau textele din exemple. „Conceptzilla”, „ToyCad”, broasca țestoasă, bărbatul cu barbă și personajul VR rămân ale autorilor lor. Distinct Watch își folosește propriile obiecte 3D, redate din cod și păstrate în `extension/assets/3d/`.

## ADN comun

Aceste șapte reguli apar în toate cele trei exemple. Un ecran care încalcă trei sau mai multe nu respectă referințele.

1. **Un obiect 3D domină ecranul.** Ocupă 35-50% din lățime și e cel mai saturat element din cadru.
2. **Obiectul iese din container.** Depășește marginea cardului cu 15-30% din înălțimea lui. Nu stă niciodată cuminte într-un dreptunghi.
3. **Blocuri mari de culoare plină.** Culoarea vine din suprafețe întregi, nu din borduri subțiri sau etichete mici.
4. **Raze foarte mari.** Cardurile au 24-32 px. Controalele sunt capsule complete.
5. **Tipografie grea și strânsă.** Titlurile sunt la 600-800, cu spațiere negativă și rânduri scurte, pe 2-3 linii.
6. **Dock flotant cu buton central rotund.** Butonul central e mai mare, mai luminos și iese din bară.
7. **Text puțin.** Un titlu, o propoziție și o singură acțiune principală pe ecran.

## Exemplul 1: lila și aqua

Fișier: `examples/Screenshot 2026-11-07 142804.png`. Trei ecrane de aplicație pentru ilustrații, pe fundal lavandă deschis. Stil 3D blând, tip argilă.

**Paletă (măsurat)**

| Rol | Hex |
|---|---|
| Fundal pagină | `#d3dfff` |
| Lila hero | `#9678f0` până la `#a88af0` |
| Violet dock și card | `#8a66fc` |
| Violet închis în umbră | `#7c5dcd` |
| Aqua card | `#60e4d8` până la `#7ef0e4` |
| Aqua card secundar | `#60ded2` |
| Roz chip | `#f696fc` |
| Portocaliu chip | `#fca842` |
| Galben avatar | `#fcde90` |
| Suprafață albă | `#fbfbfb` |

**Compoziție**

- Hero violet rotunjit, cu obiectul 3D care zboară în afara lui, sus și dreapta.
- Ecranul central e un singur fundal violet în degrade vertical, cu un card aqua suprapus peste jumătatea inferioară.
- Un obiect subțire (mâna albastră) iese din cardul aqua pe partea dreaptă.
- Pictogramele 3D mici plutesc în jurul obiectului principal, la unghiuri diferite.
- Plus-uri mici (`+`) sunt presărate ca decor.

**Componente**

- **Bară de sus:** pătrat alb de 34 px cu raza 10, pentru înapoi și meniu, cu titlul centrat.
- **Titlu mare:** două rânduri, greutate 600, gri-violet închis.
- **Căutare:** capsulă albă, umbră foarte moale.
- **Chips:** capsule pline de 80 × 32 px, cu text alb. Aqua, roz, portocaliu, fiecare cu degrade propriu.
- **Carduri de conținut:** coloane decalate pe verticală. Obiectul iese din card sus. Titlu pe două rânduri, centrat, urmat de un preț.
- **Dock:** bară violet lipită jos, cu colțurile de jos rotunjite ca telefonul. Buton rotund aqua sau violet, cu inel alb, centrat și ridicat cu jumătate din diametru.
- **Umbre:** colorate, în nuanța suprafeței, foarte difuze. Nu există umbre gri.

**Mapare:** tema light a extensiei.

## Exemplul 2: negru și roz neon

Fișier: `examples/Screenshot 2026-11-07 142844.png`. Ecran de onboarding pe telefon, într-o scenă întunecată cu podium.

**Paletă (măsurat)**

| Rol | Hex |
|---|---|
| Fundal scenă | `#0b0d15` |
| Fundal ecran | `#120c12` |
| Roz neon | `#f62a66` |
| Teal personaj | `#24c6c0` |
| Text corp | gri deschis, opacitate 70% |
| Text titlu | alb pur |

**Compoziție**

- Sus, o singură formă roz mare, cu marginea de jos curbată în arc. Ocupă 40-45% din ecran.
- Personajul e centrat peste arc, iar piciorul depășește forma în jos.
- Obiecte mici (scrisoare, bec, cană, telefon) plutesc în jurul personajului.
- Titlu centrat, 28 px, greutate 700, urmat de trei rânduri de text centrat.

**Componente**

- **Buton inel:** cerc roz plin de 64 px, cu chevron alb, într-un inel roz neînchis, deschis în partea de sus-dreapta. Are o strălucire roz în jur.
- **Skip:** text mic, gri, aliniat la stânga, pe același rând cu butonul.
- **Glow:** roz difuz sub formă și sub buton, pe fundal negru.

**Mapare:** forma în arc pentru hero-urile din tema dark, inelul pentru acțiunea principală, rozul pentru alerte și insigne.

## Exemplul 3: negru și lime

Fișier: `examples/Screenshot 2026-11-07 142948.png`. Trei ecrane de aplicație pentru modelare de jucării. Contrast foarte mare, carduri negre și un singur accent lime.

**Paletă (măsurat)**

| Rol | Hex |
|---|---|
| Ecran negru | `#0c0c0c` |
| Card negru | `#181818` |
| Control închis | `#242424` |
| Lime CTA | `#c6d806` |
| Lime verde | `#9cd218` |
| Lime palid | `#defca8` |
| Mentă segment | `#d2e4d8` |
| Roșu reducere | `#fc4818` |
| Alb card | `#fafdf5` |

**Compoziție**

- Grile de 2 coloane, carduri cu rază 22-24 px, separate prin 6-8 px.
- Fiecare card are data sus, titlul mare și obiectul 3D jos, care umple cardul.
- Card alb uriaș cu titlu de 3 rânduri, greutate 800, spațiere strânsă.
- Listă de beneficii cu bife lime în cerc.

**Componente**

- **Segment:** capsulă neagră, cu două jumătăți. Cea activă e mentă, cu text negru.
- **CTA lime:** capsulă, text negru bold, pictogramă în stânga.
- **Dock:** capsulă închisă, flotantă, cu pictograme gri și un buton central alb, rotund, cu `+`.
- **Panou de unelte:** rând de butoane pătrate cu etichete mici sub ele.
- **Selecție:** contur subțire punctat cu mânere rotunde albe în colțuri.
- **Etichete tehnice:** capsule mici, gri închis, cu text alb, de exemplu `120MM`.
- **Card de preț:** alb sau lime palid, cu etichetă roșie de reducere.

**Mapare:** tema dark, grila de carduri, dock-ul și mânerele de selecție pentru previzualizare.

## Sistem Distinct Watch

### Teme

| Token | Light (Exemplul 1) | Dark (Exemplele 2 și 3) |
|---|---|---|
| Fundal | `#d3dfff` | `#0c0c0c` |
| Suprafață | `#fbfbfb` | `#181818` |
| Control | `#efebfb` | `#242424` |
| Hero | `#8a66fc` la `#a88af0` | `#f62a66` |
| Accent CTA | `#6a45e8` | `#c6d806` |
| Text pe accent | `#ffffff` | `#0c0c0c` |
| Secundar | `#60e4d8` | `#24c6c0` |
| Semnal | `#fca842` | `#defca8` |
| Alertă | `#e8245f` | `#fc4818` |

`#6a45e8` e un violet mai închis decât cel din exemplu. E necesar pentru contrast 4.5:1 cu text alb. Violetul exact `#8a66fc` rămâne pentru suprafețe mari și text bold de peste 18 px.

### Tipografie

- Font: Lexend variabil, inclus local în `extension/assets/fonts/`. Are diacritice românești.
- Titlu ecran: 32 px, greutate 700, spațiere -0.03em.
- Titlu card: 18 px, greutate 700.
- Corp: 14 px, greutate 400.
- Etichetă: 11.5 px, greutate 600.

### Forme

- Card: rază 28 px. Hero: rază 32 px. Control mic: rază 14 px. CTA, chip, dock: capsulă.
- Marginile ecranului: 16 px. Distanța între carduri: 10 px.
- Dock: 68 px înălțime. Buton central: 64 px, ridicat 18 px.

### Umbre

Umbra e colorată, în nuanța suprafeței: `0 16px 36px` cu opacitate 30-40%. Pe dark, în locul umbrei folosim strălucire din accent.

### Sticlă

Sticla rămâne doar pe dock, bara de sus și panoul de jos. Cardurile sunt suprafețe pline, ca în exemple.

### Formă cilindrică

Cerință de produs: extensia trebuie să pară un cilindru. Fereastra panoului lateral rămâne dreptunghiulară, fiindcă o impune Chrome, așa că forma trăiește în interior.

- **Carcasă capsulă:** tot conținutul stă în `.shell`, cu rază de 46 px și margine de 8 px, peste fundalul ambiental.
- **Umbrire de tub:** tokenii `--tube` și `--tube-soft` întunecă marginile și pun o lumină la o treime din lățime. Se aplică pe hero, CTA, suprafețe, dock și carcasă.
- **Tambur între ecrane:** schimbarea filei rotește `#app` pe axa Y, cu axa în spatele panoului.
- **Tambur la scroll:** cardurile se curbează pe axa X când intră și ies din cadru, prin `animation-timeline: view()`.
- **Hero 3D:** cardul se înclină după cursor, cu maximum 10 grade, iar obiectul se mișcă separat, cu maximum 16 px.
- **Dock și panou de jos:** ambele sunt capsule flotante, nu bare lipite de margine.

### Mișcare

- Obiectele 3D plutesc lent, 4-6 s, cu 6-8 px pe verticală.
- Tamburul dintre ecrane durează 0.62 s.
- Apăsarea reduce la 0.96.
- `prefers-reduced-motion` oprește tot, mai puțin schimbările de stare.

## Obiecte 3D

Toate sunt redate din cod cu Three.js, sursa e în `tools/render-3d/`. Pentru regenerare: `npm install` în acel folder, `node serve.mjs`, apoi deschizi `http://localhost:8791/` într-un browser cu WebGL.

| Fișier | Obiect | Ecran |
|---|---|---|
| `bag.webp` | Sacoșă de cumpărături | Produs |
| `lens.webp` | Lupă cu mâner | Piață |
| `bell.webp` | Clopoțel de alertă | Schimbări |
| `flask.webp` | Eprubetă cu lichid și bule | Experimente |
| `bot.webp` | Mascota Distinct, robot-ochi | Stări goale și sigla |
| `spark.webp` | Sferă și inel decorative | Decor plutitor |

Material comun: plastic mat cu lac subțire (`MeshPhysicalMaterial`, rugozitate 0.36, clearcoat 0.55), `NeutralToneMapping` ca să păstreze saturația, lumină de mediu 0.42, fără umbră în imagine. Fundalul e transparent, iar imaginile au 840 × 840 px.

## Mapare pe ecrane

| Ecran | Hero | Inspirație |
|---|---|---|
| Produs | Bloc lila sau roz, sacoșă care iese sus-dreapta, titlu pe două rânduri | Exemplul 1, stânga |
| Piață | Bloc cu lupă, rivali în grilă de 2 coloane cu pill-uri | Exemplul 3, stânga |
| Schimbări | Formă în arc cu clopoțel, buton inel pentru „Verifică acum”, carduri înainte/după | Exemplul 2 |
| Experimente | Card alb uriaș cu titlu mare și listă cu bife | Exemplul 3, dreapta |
| Panou experiment | Card aqua sau lime suprapus, cu mânere de selecție pe variantă | Exemplele 1 și 3 |
| Stări goale | Mascota mare, titlu scurt, o singură acțiune | Exemplul 2 |

## Listă de verificare

- [ ] Fiecare ecran are un obiect 3D care iese din container.
- [ ] Există o singură acțiune principală vizibilă.
- [ ] Dock-ul are butonul central rotund, ridicat.
- [ ] Conținutul stă în carcasa capsulă, iar suprafețele mari au umbrire de tub.
- [ ] Niciun card nu are rază sub 24 px.
- [ ] Culorile vin din tokeni, nu din valori scrise direct.
- [ ] Textul trece 4.5:1, iar pe blocuri colorate e bold de minimum 18 px sau pe suprafață cu contrast verificat.
- [ ] Starea are și text sau pictogramă, nu doar culoare.
- [ ] Etichetele LIVE, CAPTURĂ și SIMULAT sunt vizibile.
- [ ] Nu apare nicio marcă, ilustrație sau personaj din exemple.
