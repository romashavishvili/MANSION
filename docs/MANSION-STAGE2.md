# MANSION — Tranche 2: Craftsmanship, real wheel motion, sound

Adds on top of Stage 1 (see MANSION-STAGE1.md). No new dependencies. **Nothing here has been run in a browser** — see "Not verified".

## What was added
- **Craftsmanship section** (`src/site/sections/craft.js`): three extreme close-ups of the Ferrari, front to rear along its left side so the camera never doubles back.
  i. *The lamp* — push-in while the headlamps dim and re-ignite (existing LED-module emission and beams).
  ii. *The line* — a long, low rake along the shoulder.
  iii. *The wheel* — settles beside the rear-left wheel while the wheels roll slowly (0.55 m/s; larger rear wheels turn slower, as they should).
- **Real wheel rotation** (`src/cars/wheels.js`, `wheelMath.js`): each `tire N` group is pivoted at its measured centre, in the car's frame. Config: `CARS.ferrari.wheels`.
- **Section `tick` hook**: any section may drive model state from its own 0..1 scroll progress (no pops outside its window).
- **Philosophy keys retimed** so the camera flows into Craftsmanship; the old long nose-arc was too fast (found by the new speed test).
- **Optional sound** (`src/audio/sound.js`): procedural drone + soft section cues, **off by default**, nothing created until the visitor presses "Sound". No engine sound (none exists; a synthesised one would be fake).
- **`tools/audit_models.py`** and `docs/MODEL-AUDIT.md`: what the models can and cannot do.

## Verified here
38 tests pass (28 earlier + 10 new): macro clearance (0.4 m in macro shots, 1.0 m elsewhere), camera speed (< 9 m per viewport of scroll), the lamp/line/wheel are centred and sized to fit the frame, wheel kinematics, sound policy (no autoplay), section interface, `tick` safety.
DOM/CSS rendered in headless Chromium at 1440x900, 768x1024 and 390x844 (no overflow). Module graph bundles.

## NOT verified (no GPU/network in the build environment)
Everything visual in 3D: whether the macro compositions look right, whether wheel pivots sit exactly on the axles, whether the lamp re-ignition reads well, scroll feel, frame rate, the actual sound (never heard), real devices.

## Please check on first run
1. Scroll past Philosophy: the camera should settle at the Ferrari's front-left headlamp ("The lamp"), the lamps dim then ignite.
2. "The line": a low pass along the left flank. 3. "The wheel": rear-left wheel framed whole, wheels turning slowly with no wobble. A wobbling or off-centre wheel means the computed pivot is wrong — tell me which.
4. Console: no red errors. 5. "Sound" toggle: silent until pressed; "On" fades in a low drone; "Off" fades out. Browsers need the click, so it must never start by itself.

## Deliberately not done yet
Depth of field (needs a depth pass I cannot tune blind), steering, opening doors (impossible), interior exploration, paint-colour/lamp controls and the 360° mode ("Presence" section), Services/Process/Gallery/Appointment, shadows and the other lighting upgrades (they need to be seen to be judged), WebGPU (the existing GLSL would need porting; no measured benefit yet).
