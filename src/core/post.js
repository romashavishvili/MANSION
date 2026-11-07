import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Final grade runs AFTER tone-mapping (display space): vignette, subtle chromatic fringe, film grain.
const GradeShader = {
  name: 'BTMGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.62 },
    uFringe: { value: 0.0011 },
    uFade: { value: 0.0 },        // 0..1 fade-to-black (used by the loader hand-off)
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uFringe, uFade;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uFringe * 6.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // vignette: keeps the edges of the frame deep black
      col *= 1.0 - uVignette * smoothstep(0.18, 0.95, r2 * 2.2);
      // luminance-weighted film grain (stronger in mid-tones, nearly none in pure black)
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float g = hash(vUv * uResolution + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (0.25 + smoothstep(0.0, 0.5, l) * 0.75) * smoothstep(0.0, 0.02, l + 0.02);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// Soft highlight limiter (HDR, before bloom). A mirror-like clear-coat reflecting a point light can
// reach values of 1000+, which UnrealBloom turns into huge blocky white squares. Compress anything
// above `knee` toward `max` - lamp cores stay hot enough to bloom, fireflies stay small.
const LimitShader = {
  name: 'BTMLimit',
  uniforms: { tDiffuse: { value: null }, uKnee: { value: 6.0 }, uMax: { value: 16.0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uKnee, uMax;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = max(c.r, max(c.g, c.b));
      if (l > uKnee) {
        float k = uKnee + (uMax - uKnee) * (1.0 - exp(-(l - uKnee) / (uMax - uKnee)));
        c.rgb *= k / l;
      }
      gl_FragColor = c;
    }
  `,
};

export function createComposer(renderer, scene, camera, tier) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
    type: THREE.HalfFloatType,
    samples: tier.msaa,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  composer.addPass(new ShaderPass(LimitShader));

  let bloom = null;
  if (tier.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.6, 1.0);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());          // tone mapping (ACES) + sRGB encode

  const grade = new ShaderPass(GradeShader);
  if (!tier.grain) grade.uniforms.uGrain.value = 0;
  composer.addPass(grade);

  return {
    composer, bloom, grade,
    setSize(w, h) {
      composer.setSize(w, h);
      grade.uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
  };
}
