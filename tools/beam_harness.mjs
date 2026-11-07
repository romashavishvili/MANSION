// Renders the REAL beam shader (BEAM_CORE) in headless Chromium's WebGL2 and:
//   1. compares the closed-form cone interval march against a brute-force march (numeric check)
//   2. writes PNG renders of the beam from several viewpoints so the look can be judged by eye
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { BEAM_CORE } from '../src/cars/beamShader.js';
// dev-only: needs `playwright` (npm i -D playwright && npx playwright install chromium)
let chromium;
try { chromium = createRequire(import.meta.url)('playwright').chromium; }
catch { chromium = createRequire('/opt/npm-tools/node_modules/')('playwright').chromium; }

const outDir = process.argv[2] || '/tmp/beam';
fs.mkdirSync(outDir, { recursive: true });

const VERT = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = (brute) => `#version 300 es
precision highp float; precision highp int;
uniform vec3 cameraPosition; uniform vec3 uCamX, uCamY, uCamZ; uniform float uTan, uAspect; uniform int uSteps; uniform float uExposure;
${BEAM_CORE}
in vec2 uv; out vec4 fragColor;
void main(){
  vec3 R = normalize(uCamZ + uCamX * uv.x * uTan * uAspect + uCamY * uv.y * uTan);
  float jitter = 0.5;
  ${brute
    ? `// brute force: no interval maths, 900 samples over 0..40 m, density is simply zero outside the cone
    vec3 O = cameraPosition; float dt = 40.0 / 900.0; float acc = 0.0;
    float cosT = -dot(R, uAxis); float phase = (1.0 - uG*uG) / pow(1.0 + uG*uG - 2.0*uG*cosT, 1.5);
    float cb = sqrt(uCos2);
    for (int i = 0; i < 900; i++) {
      float t = (float(i) + 0.5) * dt; vec3 P = O + R * t;
      if (P.y < uFloorY) break;
      vec3 Q = P - uApex; float s = dot(Q, uAxis);
      if (s < 0.0 || s > uLen) continue;
      vec3 Qc = Q + uAxis * uD0; float sc2 = dot(Qc, uAxis);
      if (dot(Qc, Qc) * uCos2 > sc2 * sc2) continue;     // outside the (shifted) bounding cone
      float tt = t - 0.0; // path cap emulation
      acc += beamDensity(P, uTime) * dt * (t < 1.0e9 ? 1.0 : 0.0);
    }
    vec3 col = uColor * (uIntensity * phase * acc); col = col / (1.0 + dot(col, vec3(0.3333)) * 0.35);`
    : `vec3 col = beamRadiance(cameraPosition, R, jitter, uSteps, uTime);`}
  col *= uExposure;
  col = col / (1.0 + col);                       // display tone curve
  fragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
}`;

const SCENES = {
  side:       { cam: [-5.5, 0.9, 5.5],  look: [0, 0.75, 4.0] },
  threeQuart: { cam: [-3.2, 0.7, 7.0],  look: [0, 0.75, 2.0] },
  intoLamp:   { cam: [0.5, 0.9, 9.0],   look: [0, 0.75, 0.0] },
  inside:     { cam: [0.0, 0.8, 3.0],   look: [0, 0.75, 9.0] },
  high:       { cam: [-6.0, 4.5, 6.0],  look: [0, 0.2, 5.0] },
};
const PARAMS = { apex: [0, 0.75, 0], axis: [0, -0.07, 1], color: [0.88, 0.92, 1.0], len: 15, wide: 0.07, core: 0.024, coreAmt: 1.8, intensity: 0.55, g: 0.45, floorY: 0, maxPath: 9, noise: 0.5, steps: 20, exposure: 1.0 };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const result = await page.evaluate(async ({ VERT, FRAGN, FRAGB, SCENES, PARAMS }) => {
  const W = 960, H = 540;
  const c = document.createElement('canvas'); c.width = W; c.height = H; document.body.appendChild(c);
  const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
  const mk = (frag) => {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
  };
  const progN = mk(FRAGN), progB = mk(FRAGB);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const draw = (prog, sc, P) => {
    gl.useProgram(prog);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u3 = (n, v) => gl.uniform3f(gl.getUniformLocation(prog, n), ...v), u1 = (n, v) => gl.uniform1f(gl.getUniformLocation(prog, n), v);
    const z = norm(sc.look.map((v, i) => v - sc.cam[i])), x = norm(cross(z, [0, 1, 0])), y = cross(x, z);
    u3('cameraPosition', sc.cam); u3('uCamX', x); u3('uCamY', y); u3('uCamZ', z);
    u1('uTan', Math.tan(32 * Math.PI / 360)); u1('uAspect', W / H); u1('uExposure', P.exposure);
    u3('uApex', P.apex); u3('uAxis', norm(P.axis)); u3('uColor', P.color);
    u1('uLen', P.len); u1('uCos2', Math.cos(Math.atan(2.7 * P.wide)) ** 2); u1('uTanB', 2.7 * P.wide); u1('uD0', 0.035 / P.wide); u1('uWideW', P.wide); u1('uCoreW', P.core); u1('uCoreAmt', P.coreAmt);
    u1('uIntensity', P.intensity); u1('uG', P.g); u1('uFloorY', P.floorY); u1('uMaxPath', P.maxPath); u1('uNoise', P.noise); u1('uTime', 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSteps'), P.steps);
    gl.viewport(0, 0, W, H); gl.clearColor(0.01, 0.01, 0.012, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const out = {};
  for (const [name, sc] of Object.entries(SCENES)) {
    const P = { ...PARAMS, noise: 0, steps: 40 };    // noise off + many steps: compare the maths, not the dust
    draw(progN, sc, P); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a);
    draw(progB, sc, P); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
    let sum = 0, mx = 0, lit = 0, bright = 0;
    for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]); sum += d; mx = Math.max(mx, d); if (b[i] > 20) lit++; bright = Math.max(bright, b[i]); }
    out[name] = { meanAbsDiff: +(sum / (W * H)).toFixed(3), maxDiff: mx, litPixels: lit, peak: bright };
    // the real look (noise on, production step count)
    draw(progN, sc, { ...PARAMS, noise: 0.5, steps: 20 });
    out[name].png = c.toDataURL('image/png');
  }
  return out;
}, { VERT, FRAGN: FRAG(false), FRAGB: FRAG(true), SCENES, PARAMS });

for (const [name, r] of Object.entries(result)) {
  fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  console.log(name.padEnd(11), `analytic-vs-bruteforce: mean|diff|=${r.meanAbsDiff}  max=${r.maxDiff}  lit px=${r.litPixels}  peak=${r.peak}`);
}
await browser.close();
