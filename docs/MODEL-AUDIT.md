# Model audit — what can honestly be animated

Reproduce with `python tools/audit_models.py public/models` (reads the glTF JSON; no rendering needed).

| | BMW M5 | Ferrari LaFerrari | Mercedes-Maybach |
|---|---|---|---|
| Triangles / nodes | 330k / 26 | 587k / 98 | 2.37M / 61 |
| Animation clips, skins, morph targets | none | none | none |
| Wheels | **fused**: all four in one mesh (42,940 tris) | **4 separate groups** (`tire 1-4`: tread, disc, rim, screws) | not identifiable: meshes are merged *by material* (`Object_N`) |
| Brake calipers | 2 meshes (not per wheel) | 4 separate nodes (do not belong to the wheel groups) | not identifiable |
| Doors / hood / trunk | merged into body meshes | merged into body meshes | merged by material |
| Steering wheel | merged into interior | only the buttons are a separate mesh | not identifiable |
| Headlamps | lamp meshes + `Light_emis`, driven by the existing lamp system | lens/housing meshes, driven by the existing lamp system | `Red_car_lights_glass` (rear only) + lamp system |
| Paint materials | named (Paint, Coloured) - recolourable through `config.paint` | `Body` - recolourable | `Car_Paint*`, flakes - recolourable |

Ferrari wheel geometry (car-local metres, measured): front-left (0.794, 0.316, 1.097) r 0.313 · front-right (-0.789, 0.313, 1.098) r 0.313 ·
rear-left (0.787, 0.333, -1.418) r 0.330 · rear-right (-0.782, 0.330, -1.418) r 0.330 · width 0.29 / 0.30.

## Consequences (the honest alternative is stated for each)
- **Rotating wheels — built, Ferrari only** (`src/cars/wheels.js`). BMW/Maybach cannot be done without splitting their geometry into wheel islands (an offline mesh-processing job); that would be real work on real geometry, not a fake, and is on the list.
- **Steering — not built.** The front tyre groups can yaw, but the calipers are not attached to them, so a steered wheel would visibly detach from its brake. It needs the caliper nodes mapped to wheels first.
- **Opening doors / hood / trunk — impossible with these models.** The panels are not separate objects. Doing it would mean re-modelling the cars. No fake is offered.
- **Animated headlights — built** as an ignition replay in the lamp macro shot, using the existing lamp emission and beams.
- **Interior exploration — not offered.** The Ferrari and BMW contain interiors, but the cabins sit behind alpha-blended glass and have not been checked for presentable quality; the Maybach has no verifiable interior.
- **Real-time paint colour — feasible (material colour), not built yet**; planned for the interactive "Presence" section.
