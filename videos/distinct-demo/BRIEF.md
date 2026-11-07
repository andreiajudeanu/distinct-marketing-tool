---
workflow: general-video
flow: automation
storyboard: no
message: "Distinct finds your real competitors, compares them with evidence and shows you how to stand out"
destination: hackathon-demo
aspect: 1920x1080
language: en
length: 60s
angle: product-demo
---

## Intent

Demo film for the Adobe "Marketing Reimagined" hackathon. One minute exactly. It states the problem,
shows the logo, runs the extension on a live store in a Chrome window, shows the report, the tracking
loop and who the product is for.

Tone: plain and exact. No voice, no music. Sound effects only when something happens on screen.

## Assets

- footage/clips/ — real captures of the extension on evomag.ro, take of 7 Nov 2026, plus the logo sting.
- footage/take3/report.json — the report behind the footage, 30.9 s and $0.0565.
- assets/3d/ — the extension's own 3D objects.
- assets/brand/ — the Distinct logo.
- ../distinct-logo/ — the Remotion source of the logo sting.
- assets/sfx/ — sound effects from the HyperFrames library, Pixabay Content License. See CREDITS.md.
- assets/audio/distinct-sfx.wav — the film's sound track. Built by scripts/build-sfx.mjs, which lists every cue.

## Customizations

- Chrome frame is drawn. Page, panel and report inside it are real captures.
- Analysis runs at 3x and says so on screen.
- Tracking sequence uses the demo shop and carries the SIMULATED label.

## Notes

- altex.ro and emag.ro refused the automated browser, so the film uses evomag.ro. No block was bypassed.
- Text stays factual. No "revolutionize", no "unlock", no "AI-powered".
- A rival change is a signal to investigate. Nothing in the film suggests a rival's sales grew.
- Cuts land on even seconds where possible, so a 120 BPM track can be added later.
- Design truth: ../../references.md and the tokens in ../../extension/app.css. Concept: one calm window
  where the market becomes readable. Font: Lexend only, as in the product. Focal element: the Chrome
  window. Edge anchors: caption pill below, status pill top right, legal note bottom left. Background:
  the product's lavender with slow soft colour blobs.
