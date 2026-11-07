# Referințe vizuale Distinct Watch

Interfața reproduce limbajul vizual din `examples/Screenshot 2026-11-07 142804.png`: aceleași culori, proporții, compoziții și bare. Aplicația pornește în Light. Dark se alege din Settings.

Din poză preluăm compoziția și culorile. **Nu preluăm personajele, ilustrațiile, mărcile sau textele ei.** În locul lor folosim mascota și obiectele noastre, redate din cod.

Celelalte două imagini din `examples/` nu mai sunt referințe active.

## Cele trei modele

Fiecare ecran urmează unul dintre telefoanele din poză, prin `data-look` pe `.phone`.

| Model | Cum arată | Unde |
|---|---|---|
| `left` | Ecran alb, hero lila cu obiect care iese din bloc, nori, carduri albe decalate, bară violet, buton rotund aqua | Home după analiză, Changes, raport Competitors |
| `violet` | Ecran violet, mascota iese prin partea de sus, pătrățele plutitoare, card aqua cu lupă, text alb | Home înainte și în timpul analizei, raport Overview |
| `right` | Ecran alb, titlu mare pe două rânduri, căutare, chip-uri, carduri violet și aqua decalate, bară albă, buton rotund violet | Market, Tests, raport Actions |

Pe ecran lat, raportul arată cele trei telefoane alăturate și decalate pe verticală, ca în poză. Sub 1180 px rămâne unul singur, iar chip-urile schimbă secțiunea.

## Reguli

1. **Butonul rotund analizează site-ul din fila curentă.** Excepții: pe Market urmărește selecția, pe Changes verifică rivalii, iar în timpul unei analize deschide progresul. Nu e niciodată inactiv. Raportul se deschide din pătratul din stânga sus, pe Home.
2. **Ecranele folosesc cartonașe, nu pagini de text.** Detaliile se deschid într-un sheet.
3. **Bara de jos are doar pictograme**, cu `aria-label` și tooltip.
4. **Decorul stă pe stage și hero:** mascotă, pătrățele, nori, plusuri. E marcat `aria-hidden`.
5. **Chip-urile și căutarea sunt reale.** Filtrează. Nu adăuga controale doar de aspect.
6. **Culorile vin din tokeni.** Fără hex în componente. Excepție: elementele injectate în pagina magazinului.

## Culori măsurate pe poză

| Rol | Valoare |
|---|---|
| Fundal pagină | `#D3DFFF` |
| Ecran | `#FBFBFB` |
| Hero lila | `#A98EF4` la `#9A7BF2` |
| Bară violet | `#9977FE` la `#8E68FE` |
| Ecran violet | `#9A7AF2`, jos `#7C5DCD` |
| Buton rotund pe violet | `#C8FCF6`, inel alb |
| Buton rotund pe alb | `#926EF7` |
| Chip aqua | `#8FE3EF` la `#36EAD9` |
| Chip roz | `#FAA8FE` la `#F463F9` |
| Chip portocaliu | `#FFA945` |
| Card violet | `#8E68FC` la `#7652E6` |
| Card aqua mic | `#7EF0E4` la `#52DBCE` |
| Pătrățele | `#FFA760`, `#4A66D4`, `#FFECAC`, `#E2BFFE` |

**Abateri deliberate pentru contrast:**

- În poză, textul alb pe aqua, roz și portocaliu are sub 2:1. Pe chip-uri și pe cardul aqua mic textul e închis.
- Cardul aqua mare păstrează titlul alb, deci partea stângă e `#2F9DBF`, nu `#8FD0EC`.
- Ecranul violet se închide spre `#7C5DCD`, iar cardul violet spre `#7652E6`, ca textul alb să treacă 4.5:1.

Dark e negru iOS: fundal `#000000`, carduri `#1C1C1E`. Violetul și aqua rămân.

## Tipografie

Lexend, local în `extension/assets/fonts/`.

| Rol | Mărime | Greutate |
|---|---|---|
| Titlu mare | 30 px | 600 |
| Titlu ecran | 24 px | 700 |
| Titlu card aqua | 23 px | 700 |
| Corp | 15 px | 400 |
| Card | 14 px | 600 |
| Notă | 13 px | 500 |

## Forme

- Telefon: rază 34 px, margine 6 px pe fundal lavandă.
- Card: 22 px. Hero: 26 px. Pătrate de sus: 44 px, rază 12 px. Chip: 12 px.
- Bară: 70 px. Buton rotund: 64 px, inel de 5 px, ridicat 34 px.
- Rândurile și butoanele au minimum 44 px.

## Mișcare

- Obiectele plutesc lent, norii se deplasează, cardurile urcă decalat, butonul rotund pulsează când așteaptă o acțiune.
- Sheet-ul urcă cu arc.
- `prefers-reduced-motion` oprește tot.

## Obiecte 3D

Redate cu Three.js din `tools/render-3d/`. Pentru regenerare: `npm install` în acel folder, `node serve.mjs`, apoi deschizi `http://localhost:8791/` într-un browser cu WebGL.

| Fișier | Folosire |
|---|---|
| `mascot.webp` | Scena violet |
| `rocket.webp`, `cloud.webp` | Hero lila |
| `bell.webp` | Hero Changes |
| `lens.webp` | Iese din cardul aqua |
| `bot.webp` | Stări goale |
| `tile-*.webp` | Carduri și decor |

## Listă de verificare

Pentru fiecare schimbare vizuală, în Light și Dark, la 320 și 380 px, iar raportul și la 1280 px:

- [ ] Ecranul urmează unul dintre cele trei modele.
- [ ] Butonul rotund are o acțiune reală și nu e dublată.
- [ ] Rândurile și butoanele au minimum 44 px.
- [ ] Culorile vin din tokeni.
- [ ] Textul trece 4.5:1, iar titlurile mari 3:1.
- [ ] Starea are text sau pictogramă, nu doar culoare.
- [ ] Etichetele LIVE și SIMULATED sunt vizibile lângă date.
- [ ] Nimic nu e tăiat și nu există scroll orizontal.
- [ ] Nu apare nicio marcă, ilustrație sau personaj din poză.
