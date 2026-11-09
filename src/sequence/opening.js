import { CAR_ORDER } from '../config.js';
import { T, GATES, lampLevel, revealLevel } from './schedule.js';
import { smoothstep } from './curves.js';

/**
 * The opening sequence controller.
 *
 * Every visual state is a pure function of the master clock `t` (see apply()), so the sequence can be
 * scrubbed, paused, fast-forwarded and replayed exactly. The only stateful logic is the clock itself:
 * it advances in update(), and is HELD at a gate if the next car has not finished loading yet.
 */
export class Opening {
  /**
   * @param {{cars:Object<string,import('../cars/car.js').Car>, stage:any, rig:any, hud:any}} deps
   */
  constructor({ cars, stage, rig, hud }) {
    this.cars = cars;
    this.stage = stage;
    this.rig = rig;
    this.hud = hud;
    this.t = 0;
    this.playing = false;
    this.speed = 1;
    this.finished = false;
    this.waitingFor = null;
    this.onFinish = null;
    this.handoff = null;     // MANSION: when set, replaces the free-orbit hand-over (the site takes over)
  }

  start() { this.t = 0; this.finished = false; this.playing = true; this.speed = 1; this.rig.leaveOrbit(); this.hud.setPhase('intro'); }
  /** Reduced-motion / deep-link: show the finished hero state immediately. */
  jumpToEnd(time) {
    this.t = T.end; this.finished = true; this.playing = false;
    this.rig.applyScript(T.end, time, 0.016);
    if (this.handoff) { this.handoff(); return; }
    this.hud.setPhase('free');
    this.rig.enterOrbit(this.rig.script.look.evaluate(T.end));
  }
  pause() { this.playing = false; }
  resume() { this.playing = true; }
  skip() { if (!this.finished) this.speed = 7; }
  scrub(t) { this.t = Math.max(0, Math.min(T.end, t)); this.finished = false; if (this.rig.mode !== 'script') this.rig.leaveOrbit(); }

  update(dt) {
    if (!this.playing || this.finished) return;
    let next = this.t + dt * this.speed;

    // load gates: never let the story overtake a car that is still downloading
    this.waitingFor = null;
    for (const g of GATES) {
      if (this.t < g.t && next >= g.t && !this.cars[g.car].ready) {
        next = g.t - 1e-4;
        this.waitingFor = g.car;
        break;
      }
    }
    this.t = Math.min(next, T.end);

    if (this.t >= T.end) {
      this.finished = true;
      this.speed = 1;
      if (this.handoff) this.handoff();
      else {
        this.hud.setPhase('free');
        this.rig.enterOrbit(this.rig.script.look.evaluate(T.end));
      }
      this.onFinish?.();
    }
  }

  /** Apply the full visual state for master time t. `time` = real clock seconds (for ambient motion). */
  apply(time, dt) {
    const t = this.t;
    const stage = this.stage;

    for (const id of CAR_ORDER) {
      const car = this.cars[id];
      car.setLamps(lampLevel(id, 'L', t), lampLevel(id, 'R', t));
      car.setReveal(revealLevel(id, t));
    }

    // finale: all headlights ease into a slow outward sway while the sweep light crosses the scene
    const swayAmt = smoothstep(T.sweep.start - 1.5, T.sweep.start + 2.5, t);
    const sway = Math.sin(time * 0.55) * 0.045 * swayAmt;
    for (const id of CAR_ORDER) this.cars[id].setSway(sway);
    stage.setSweep(smoothstep(T.sweep.start, T.sweep.end, t));

    // typography
    this.hud.setTitle(t >= T.title.in);
    this.hud.setSubtitle(t >= T.title.subtitle);
    this.hud.setCaption(this._captionAt(t));

    if (this.rig.mode === 'script') this.rig.applyScript(t, time, dt);
  }

  _captionAt(t) {
    if (t >= T.bmw.start + 1.6 && t < T.gateFerrari + 1.4) return 'bmw';
    if (t >= T.ferrari.start + 2.0 && t < T.gateMaybach + 1.4) return 'ferrari';
    if (t >= T.maybach.start + 2.4 && t < T.sweep.start + 1.0) return 'maybach';
    return null;
  }
}
