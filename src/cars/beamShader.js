// Volumetric headlight beam: single-scattering through haze, computed analytically per pixel.
//
// The mesh (a bounding cone, rendered BackSide so every covered pixel is shaded exactly once, even with
// the camera inside the beam) only decides WHICH pixels to shade. The look comes from the fragment
// shader, which intersects the camera ray with the beam's bounding cone (closed-form quadratic),
// clips it to the beam length and the floor plane, then integrates a soft gaussian beam profile along
// the ray with a Henyey-Greenstein phase function:
//   - no hard silhouette (gaussian fall-off in the radial direction, bounded by the cone)
//   - brightest near the lamp, inverse-square-ish fall-off along the axis
//   - forward scattering: a glare when you look INTO the lamp, subtle from the side
//   - dust-like noise modulation
//   - bounded path length, so a camera inside a beam never white-outs
//
// BEAM_CORE is shared verbatim by the harness in tools/beam_harness.mjs, which renders it in a real
// WebGL2 context to verify the maths against a brute-force march.

export const BEAM_CORE = /* glsl */`
  uniform vec3  uApex;        // lamp position (world)
  uniform vec3  uAxis;        // beam direction (world, unit)
  uniform vec3  uColor;
  uniform float uLen;         // beam length
  uniform float uCos2;        // cos^2 of the bounding cone half-angle
  uniform float uTanB;        // tan of the bounding cone half-angle (= 2.7 * uWideW)
  uniform float uD0;          // bounding-cone apex is pulled this far BEHIND the lamp (= R0 / uWideW) so it always contains the beam
  uniform float uWideW;       // tan(sigma) of the wide, soft component
  uniform float uCoreW;       // tan(sigma) of the narrow hot core
  uniform float uCoreAmt;     // core weight relative to the wide component
  uniform float uIntensity;   // overall radiance scale (animated 0..1 by the ignition)
  uniform float uG;           // Henyey-Greenstein anisotropy (0 = isotropic)
  uniform float uFloorY;      // the beam does not exist below this plane
  uniform float uMaxPath;     // cap on the length of ray inside the beam
  uniform float uNoise;       // 0..1 dust modulation
  uniform float uTime;

  const float BEAM_R0 = 0.035;   // lens radius
  const float BEAM_S0 = 2.2;     // axial "core length": flat intensity before inverse-square takes over

  float bHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bHash(i), bHash(i + vec3(1,0,0)), f.x), mix(bHash(i + vec3(0,1,0)), bHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bHash(i + vec3(0,0,1)), bHash(i + vec3(1,0,1)), f.x), mix(bHash(i + vec3(0,1,1)), bHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  // Closed-form interval [t0,t1] (t0>=0) where the ray O + tR is inside the forward bounding cone,
  // within the beam length, above the floor. Returns t1 < t0 when there is no intersection.
  vec2 beamInterval(vec3 O, vec3 R) {
    vec3 C = O - uApex;
    float m = dot(C, uAxis), n = dot(R, uAxis);
    float lo = 0.0, hi = 1.0e4;
    // axial >= 0 and axial <= L   (m + t n)
    if (abs(n) < 1.0e-6) { if (m < 0.0 || m > uLen) return vec2(1.0, -1.0); }
    else {
      float ta = -m / n, tb = (uLen - m) / n;
      lo = max(lo, min(ta, tb)); hi = min(hi, max(ta, tb));
    }
    // above the floor
    if (abs(R.y) < 1.0e-6) { if (O.y < uFloorY) return vec2(1.0, -1.0); }
    else {
      float tf = (uFloorY - O.y) / R.y;
      if (R.y > 0.0) lo = max(lo, tf); else hi = min(hi, tf);
    }
    if (hi <= lo) return vec2(1.0, -1.0);

    vec3 Cs = C + uAxis * uD0;                       // relative to the (shifted) bounding-cone apex
    float ms = m + uD0;
    float cr = dot(Cs, R), cc = dot(Cs, Cs);
    float a = n * n - uCos2;
    float b = ms * n - uCos2 * cr;
    float c = ms * ms - uCos2 * cc;
    if (abs(a) < 1.0e-7) a = (a < 0.0) ? -1.0e-7 : 1.0e-7;
    float disc = b * b - a * c;
    if (a > 0.0) {                                   // ray steeper than the cone: inside outside the two roots
      if (disc < 0.0) return vec2(lo, hi);
      float s = sqrt(disc);
      float tA = (-b - s) / a, tB = (-b + s) / a;
      vec2 i1 = vec2(lo, min(hi, tA)), i2 = vec2(max(lo, tB), hi);
      bool ok1 = i1.y > i1.x, ok2 = i2.y > i2.x;
      if (ok1 && ok2) return (i1.y - i1.x > i2.y - i2.x) ? i1 : i2;
      if (ok1) return i1;
      if (ok2) return i2;
      return vec2(1.0, -1.0);
    }
    if (disc < 0.0) return vec2(1.0, -1.0);          // a < 0: inside between the two roots
    float s = sqrt(disc);
    float tA = (-b + s) / a, tB = (-b - s) / a;
    return vec2(max(lo, tA), min(hi, tB));
  }

  float beamDensity(vec3 P, float time) {
    vec3 Q = P - uApex;
    float s = dot(Q, uAxis);
    vec3 rv = Q - s * uAxis;
    float r2 = dot(rv, rv);
    float sc = max(s, 0.0);
    float wW = uWideW * sc + BEAM_R0;
    float wC = uCoreW * sc + BEAM_R0 * 0.7;
    float rb = uTanB * (sc + uD0);                   // bounding radius here
    float wnd = 1.0 - smoothstep(0.5, 1.0, sqrt(r2) / rb);   // -> exactly 0 on the bounding cone: no visible silhouette
    float prof = (exp(-r2 / (wW * wW)) + uCoreAmt * exp(-r2 / (wC * wC))) * wnd;
    float axial = 1.0 / (1.0 + (sc * sc) / (BEAM_S0 * BEAM_S0));
    float fade = smoothstep(0.0, 0.3, s) * (1.0 - smoothstep(0.62 * uLen, uLen, s));
    float dust = mix(1.0, 0.45 + 1.1 * bNoise(P * 0.85 + vec3(0.0, time * 0.05, time * 0.035)), uNoise);
    return prof * axial * fade * dust;
  }

  // Radiance toward the camera along the ray (HDR, linear).
  vec3 beamRadiance(vec3 O, vec3 R, float jitter, int steps, float time) {
    vec2 iv = beamInterval(O, R);
    if (iv.y <= iv.x) return vec3(0.0);
    float t0 = iv.x, t1 = min(iv.y, iv.x + uMaxPath);
    float dt = (t1 - t0) / float(steps);
    float cosT = -dot(R, uAxis);                      // between propagation dir and the direction toward the camera
    float phase = (1.0 - uG * uG) / pow(1.0 + uG * uG - 2.0 * uG * cosT, 1.5);   // 4*pi * HG
    float acc = 0.0;
    for (int i = 0; i < 48; i++) {
      if (i >= steps) break;
      float t = t0 + (float(i) + jitter) * dt;
      acc += beamDensity(O + R * t, time) * dt;
    }
    vec3 col = uColor * (uIntensity * phase * acc);
    return col / (1.0 + dot(col, vec3(0.3333)) * 0.35);   // soft shoulder: a lens can never white-out the frame
  }
`;

export const BEAM_VERT = /* glsl */`
  uniform float uFloorY;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.y = max(w.y, uFloorY + 0.004);      // keep the bounding volume above the floor so the floor never hides pixels of the beam
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const BEAM_FRAG = /* glsl */`
  ${BEAM_CORE}
  uniform int uSteps;
  varying vec3 vWorld;
  void main() {
    vec3 O = cameraPosition;
    vec3 R = normalize(vWorld - O);
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) + fract(uTime * 7.31)));
    vec3 col = beamRadiance(O, R, jitter, uSteps, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;
