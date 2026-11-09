import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio/sound.js';

// Minimal fake WebAudio so the policy (never autoplay; fade; suspend) can be tested without a browser.
const created = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
class FakeCtx {
  constructor() { created.push(this); this.currentTime = 0; this.sampleRate = 8000; this.state = 'suspended'; this.destination = {}; this.started = 0; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return { gain: param(), connect() {} }; }
  createBiquadFilter() { return { type: '', frequency: param(), Q: param(), connect() {} }; }
  createOscillator() { const s = this; return { type: '', frequency: param(), connect() {}, start() { s.started++; }, stop() {} }; }
  createBuffer() { const d = new Float32Array(16000); return { getChannelData: () => d }; }
  createBufferSource() { const s = this; return { buffer: null, loop: false, connect() {}, start() { s.started++; } }; }
}

test('nothing is created, and nothing can play, until the visitor enables sound', () => {
  created.length = 0;
  const s = new Sound({ AudioCtx: FakeCtx });
  s.cue('section'); s.setProgress(0.5);
  assert.equal(created.length, 0, 'no AudioContext before user action');
  assert.equal(s.on, false);
});

test('enable() builds the graph once, turns on; disable() turns off; cues are silent when off', async () => {
  created.length = 0;
  const s = new Sound({ AudioCtx: FakeCtx });
  assert.equal(await s.enable(), true);
  assert.equal(created.length, 1);
  assert.equal(created[0].state, 'running');
  const startedOn = created[0].started;
  s.cue('beat');
  assert.ok(created[0].started > startedOn, 'cue plays while on');
  assert.equal(s.disable(), false);
  const startedOff = created[0].started;
  s.cue('beat');
  assert.equal(created[0].started, startedOff, 'cue is a no-op when off');
  await s.enable();
  assert.equal(created.length, 1, 'graph is reused, not rebuilt');
});

test('unsupported browsers degrade silently', async () => {
  const s = new Sound({ AudioCtx: null });
  s.AudioCtx = undefined; s.supported = false;
  assert.equal(await s.enable(), false);
});
