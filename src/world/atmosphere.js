import * as THREE from 'three';

export const MAX_BEAMS = 6;

// Floating dust. It is almost invisible in the dark and lights up ONLY inside the headlight cones
// (each particle tests itself against all 6 beams in the vertex shader) - the cheap, convincing
// "light scattering through the atmosphere".
export class Dust {
  constructor(count) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() * 2 - 1) * 20;
      pos[i * 3 + 1] = 0.05 + Math.pow(Math.random(), 1.6) * 8;
      pos[i * 3 + 2] = -12 + Math.random() * 40;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const arr3 = () => Array.from({ length: MAX_BEAMS }, () => new THREE.Vector3());
    this.uniforms = {
      uTime: { value: 0 },
      uScale: { value: 800 },
      uSize: { value: 0.034 },
      uBeamPos: { value: arr3() },
      uBeamDir: { value: arr3() },
      uBeamCol: { value: arr3() },
      uBeamLevel: { value: new Array(MAX_BEAMS).fill(0) },
      uBeamCos: { value: Math.cos(0.15) },
      uAmbient: { value: 0.0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uScale, uSize, uBeamCos, uAmbient;
        uniform vec3 uBeamPos[${MAX_BEAMS}];
        uniform vec3 uBeamDir[${MAX_BEAMS}];
        uniform vec3 uBeamCol[${MAX_BEAMS}];
        uniform float uBeamLevel[${MAX_BEAMS}];
        attribute float aSeed;
        varying vec3 vColor;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.07 + aSeed * 40.0) * 0.9;
          p.y += sin(uTime * 0.05 + aSeed * 17.0) * 0.5;
          p.z += cos(uTime * 0.06 + aSeed * 23.0) * 0.9;
          vec3 col = vec3(0.0);
          for (int i = 0; i < ${MAX_BEAMS}; i++) {
            vec3 d = p - uBeamPos[i];
            float dist = max(length(d), 1e-3);
            float c = dot(d / dist, uBeamDir[i]);
            float inside = smoothstep(uBeamCos - 0.05, uBeamCos + 0.03, c);
            col += uBeamCol[i] * uBeamLevel[i] * inside * exp(-dist * 0.075);
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 60.0);
          vColor = (col * 2.2 + vec3(0.010, 0.011, 0.014) * uAmbient) * tw;
          gl_PointSize = clamp(uSize * (0.7 + aSeed * 1.2) * uScale / max(-mv.z, 0.1), 1.0, 14.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setBeams(beams) {
    const u = this.uniforms;
    for (let i = 0; i < MAX_BEAMS; i++) {
      const b = beams[i];
      if (!b) { u.uBeamLevel.value[i] = 0; continue; }
      u.uBeamPos.value[i].copy(b.pos);
      u.uBeamDir.value[i].copy(b.dir);
      u.uBeamCol.value[i].set(b.color.r, b.color.g, b.color.b);
      u.uBeamLevel.value[i] = b.level;
    }
  }

  update(time, camera, renderHeightPx) {
    this.uniforms.uTime.value = time;
    this.uniforms.uScale.value = renderHeightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}
