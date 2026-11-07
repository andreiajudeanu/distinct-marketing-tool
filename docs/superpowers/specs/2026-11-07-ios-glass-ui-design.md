# Interfață iOS glassmorphic pentru Distinct Watch

## Cerințe

- **Funcțional:** același flux, aceleași reguli, aceleași etichete LIVE, CAPTURĂ și SIMULAT.
- **Non-funcțional:** WCAG AA, tastatură completă, lățime de la 320 px, fără dependențe și fără build.
- **Constrângeri:** panou lateral Chrome, CSP Manifest V3, fără fonturi Apple incluse din motive de licență.

## Structură

```
panel.html      ambient, navbar, title, notice, #app, tab bar, <dialog id="sheet">
panel.js        stare, acțiuni, I/O Chrome, randare
ui/views.js     funcții pure stare -> HTML
ui/icons.js     pictograme SVG proprii
panel.css       tokens, materiale, componente, mișcare
lib/rules.js    neschimbat
```

Datele curg într-un singur sens: acțiune, stare, `render()`, apoi HTML. Stările de interfață (`tab`, `busy`) nu se salvează.

## Decizii și compromisuri

| Decizie | Motiv | Cost |
|---|---|---|
| Fundal ambiental propriu | Panoul nu are nimic în spate, deci sticla n-ar avea ce estompa | Trei straturi animate, doar prin `transform` |
| Tab bar cu 4 ecrane | Fluxul nu mai e o singură coloană lungă | Starea curentă trebuie gestionată |
| `<dialog>` nativ pentru sheet | Capcană de focus, Esc și `inert` gratuite | Animația de închidere e limitată |
| Fără `backdrop-filter` imbricat | Un element blurat într-un părinte blurat nu vede fundalul | Rândurile din grupuri sunt plate, cu separatoare |
| Sticlă opacă cam 70% | Textul trebuie să rămână 4.5:1 | Efect mai discret decât în mockup-urile tipice |
| Fără re-randare la `change` pe text | Înlocuirea DOM-ului între mousedown și mouseup pierde clicul | Totaluri actualizate doar la bife |

## Accesibilitate și mișcare

- `prefers-reduced-transparency` și `prefers-contrast: more` înlocuiesc sticla cu suprafețe solide.
- `prefers-reduced-motion` oprește derivarea fundalului și arcurile.
- Starea nu se transmite doar prin culoare: fiecare are pictogramă și text.
- Focusul e restaurat după fiecare randare.

## De revizuit

Dacă panoul depășește cam 300 de linii în `views.js`, împărțim pe ecrane. Pe aparate slabe, reducem blur-ul din `--glass-blur`.
