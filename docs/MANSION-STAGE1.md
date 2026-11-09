# MANSION — Stage 1: architecture, intro hand-off, hero, philosophy

Built on the existing *Beyond the Machine* foundation. **Nothing in the opening was replaced**: the master-clock
`Opening`, `Headlight`/`beamShader`, `Stage` (mirror floor, dust, post), the three car models and the camera
spline system are all unchanged in behaviour. See "Changes to existing files" for the exact touch points.

## Run it
```
npm install        # NEW dependencies: gsap, lenis (three unchanged)
npm run dev        # http://localhost:5173
npm test           # 28 tests (16 existing + 12 new)
```
Useful URLs: `/?site` (skip the opening, land on the hero) · `/?debug` (H panel, as before) · `/?t=38&pause` (a frozen intro frame).

## Architecture
```
src/main.js            boot (unchanged flow) + creates Site, sets opening.handoff
src/site/Site.js       Lenis smooth scroll, ScrollTrigger, nav, hand-off, replay, resize/profile
src/site/rail.js       PURE: buildRail() (section camera keys -> Hermite tracks), railTimeAt() (scroll -> rail time)
src/site/sections/     one module per section: cam() keys, prepare(), init() (scroll behaviour), enter()
  index.js             THE REGISTRY. Order = page order = camera-rail order. Menu, scroll lengths, tests read it.
src/site/nav.js        header + full-screen index, generated from the registry (no dead links, ever)
src/camera/aspect.js   PURE: aspect-aware fov, mobile/desktop profile
src/camera/rig.js      + 'rail' mode, applyTracks(), frame shift (view offset)
```
Hand-off: `Opening` finishes -> `Site.handoff()` -> page unlocks, `rig.enterRail(rail)`. The rail's first key *is*
the opening's last camera pose (`heroPose`), so there is no cut. After that: scroll -> `railTimeAt()` -> `rig.applyRail()`.

**Adding a section later** = add `src/site/sections/<id>.js` (+ its markup in `index.html`) and append it to
`sections/index.js`. Rail, menu, scroll length and tests pick it up. Each section supplies `cam()` keys in a car's
local frame, so camera choreography stays authored the same way as the opening.

**Frame shift**: sections can slide the picture inside the viewport (`shift: [x, y]`, fractions of the screen) via the
camera's view offset, so the car sits beside the type (right of centre on landscape, upper half on portrait).

## Changes to existing files
| File | Change |
|---|---|
| `src/sequence/opening.js` | optional `handoff` hook replaces the free-orbit hand-over (default path unchanged); `scrub()` leaves any non-script mode |
| `src/camera/rig.js` | `applyScript` now delegates to `applyTracks`; added `enterRail/applyRail`, frame shift, aspect-aware fov |
| `src/ui/hud.js` | wordmark/descriptor from `BRAND`; captions use `caption` overrides; new `'site'` phase |
| `src/config.js` | `BRAND`; per-car `caption` (service names on screen instead of marque names) |
| `src/main.js` | creates `Site`; `?site` deep link; `ScrollDirector` no longer used |
| `src/styles/main.css` | identity tokens, fonts (Jost + Instrument Serif), page now scrolls (`.is-locked` during the opening), wordmark restyled |
| `index.html` | site DOM, fonts, title/description, credits note (now truthful: development build) |

## What was verified, and what was NOT
Verified here: all 28 unit tests pass; the whole module graph bundles (esbuild, `three`/`gsap`/`lenis` external);
the DOM/CSS layer was rendered in headless Chromium at 1440x900, 1024x768, 768x1024 and 390x844 (hero, philosophy
in two scroll states, menu) — no horizontal overflow, no overlaps, two real bugs found and fixed.

**NOT verified (no network / no GPU in the build sandbox):** `npm install`, the Vite dev server and build, anything
involving `three`, `gsap` or `lenis` at runtime, the 3D scene, the camera rail as seen on screen, the frame-shift
direction (reasoned from three.js's `updateProjectionMatrix`, never seen), scroll feel, GSAP timings, web-font
rendering (Jost / Instrument Serif were unavailable offline; the renders used fallback fonts), real device behaviour,
performance. Treat every one of those as unconfirmed until you run it.

## Review checklist for your first run
1. Intro plays as before; title now reads MANSION; captions read service names.
2. At the end the hero type rises and the page becomes scrollable — **no camera jump** at the hand-off.
3. Scroll: camera pushes toward the Ferrari; the Ferrari sits on the **right**, type on the left. If it is on the
   wrong side, flip the sign of `shift` in `sections/philosophy.js`.
4. Philosophy lines resolve, the red underline draws under "the truth.", three tenets arrive, red meter fills.
5. Menu opens/closes (button, Esc), links scroll smoothly; "Replay opening" restarts the intro cleanly.
6. Phone/portrait: car in the upper half, type below; check the iOS toolbar resize (known issue, Stage 7).

## Known limits / next
Mobile framing is interim (fov compensation only); the dedicated mobile re-cut and iOS viewport handling are Stage 7.
Web fonts still load from Google (self-host before launch). Draft copy (marked `DRAFT COPY` in `index.html`) needs
client approval. The BMW/Ferrari/Maybach models remain **placeholders**: do not deploy publicly (see Stage 0 notes).
