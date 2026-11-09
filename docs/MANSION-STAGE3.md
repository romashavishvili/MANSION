# MANSION - Stage 3: surface lab, vehicle rooms, enquiry

Evolution of the existing project (nothing rebuilt; the three GLBs, the rail, the opening and the Stage 1-2 systems are untouched apart from the hooks listed below).

## Art direction
The site is one continuous camera move through a dark hall with three cars. Stage 3 adds two ideas to that:
- **The surface is the subject.** Services are not cards: the Ferrari's own paint is the demonstration surface (Surface lab).
- **Each car is a room with its own grammar.** Entering one is a slat-wipe cut; the other two cars leave the hall; the camera becomes yours.
  - **I Precision (BMW M5)**: a technical bench. Live recolour + finish (gloss/metallic/satin/matte) on the real materials, lighting scenes, six inspection views, projected hotspots, live azimuth/elevation, dimensions measured from the model.
  - **II Sculpture (Ferrari)**: a cinematic exhibition. Letterbox, seven chapters on a choreographed camera that arcs around the car, lamp ignition, rolling real wheels, and one key light you swing round the car with a dial (azimuth) and a slider (height).
  - **III Exclusivity (Maybach)**: architectural calm. Five slow stations, curated paints, gloss/satin, three evening-light scenes, a drifting camera that yields to the visitor.
- Navigation: scroll-driven chapter index, full-screen menu (unchanged), custom cursor that names its action, Esc leaves a room.

## What is real, what is an illustration
| Feature | Status |
|---|---|
| Paint colour / finish (BMW, Maybach) | Real material parameters on the real model. BMW's textured shell is a colour atlas: only its body-colour cells recolour (shader mask), trim keeps the original grade. |
| Paint-correction demo | **Illustration.** Same Ferrari model on both sides of a plane; the "before" marring is procedurally generated. Labelled in the UI. Not a photo, not a measured result. |
| PPF coverage | **Illustration** of *area* in the model's coordinates, not panels. Labelled. |
| Ceramic tab | A real light moving over the real paint, labelled as an inspection aid, **not** a before/after of a coating. |
| Detailing, Surface protection | Explained (stepper, layer diagram "not to scale"); not simulated. |
| Hotspots / wheel / lamp / grille anchors | Measured from the GLBs (config.js `ANCHORS`). |
| Interior (Maybach) | **Not offered**: the model has no separable cabin. The UI says so. |
| Doors, per-wheel articulation on BMW/Maybach | Not offered: no separable geometry (BMW wheels are one fused mesh). |
| Enquiry form | Validates and prepares the message. **No contact details exist**, so `CONTACT` in `src/config.js` is empty and the form says plainly that nothing was sent and offers Copy. Fill any channel in and the matching button appears. |
| Service copy | Marked `DRAFT COPY` in index.html: placeholder brand voice, no prices, durations or warranties. Needs client approval. |

## WebGPU decision
Not adopted. The car lamps, beams, floor and the Stage 3 shaders are GLSL patches on three.js's WebGL materials (`onBeforeCompile`); a WebGPU path would mean rewriting them in TSL for no visual gain we could measure. The WebGL2 pipeline stays the single renderer; the existing quality tiers keep the GPU workload bounded. The Stage 3 effects add one texture (1024px, procedural) and uniform-gated branches that are skipped at rest.

## Where it lives
- `src/exhibit/` - `Exhibit.js` (transition, camera arcs, light state, cleanup), `paint.js`, `shots.js` (pure, tested), `rooms/{bmw,ferrari,maybach,base}.js`
- `src/cars/labShader.js` - surface-lab shader (clear-coat swirl normals, coverage zones)
- `src/lab/labController.js`, `src/site/sections/{lab,rooms,enquire}.js`, `src/site/{enquiry,cursor,chapters}.js`
- `src/styles/stage3.css`
- Hooks into existing files: `Car` (paint registry, body-colour mask, lab patch), `Site` (exhibit gate, lab, chapters, cursor), `main.js` (exhibit in the loop), craft's last key moved to the lab's first key (identical pose).

## Verification performed
- `node --test`: 50 tests pass (camera clearance/speed for all six sections on desktop and mobile; room shots keep the camera outside the car; anchors lie inside each car's box; enquiry logic; a11y pairing of tabs/panels; no invented contact details).
- Ran in headless Chromium (WebGL2 via software rendering) and exercised: lab correction slider, PPF zones, ceramic light, protection tab, BMW room (paint, wheel view), Ferrari room (exhibition, chapter jump, leave -> rail resumes), Maybach room (paint, station), enquiry validation and prepared message, mobile viewport (390x780). No console errors.
- **Not verified:** frame rate and thermal behaviour on real GPUs (software rendering cannot measure them), Safari/Firefox, touch gestures on a physical phone, screen readers. Reduced-motion paths are implemented (instant cuts, no auto-orbit, no cursor) but only exercised by code review.
