import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// The floor is two layers:
//   1. a real PBR surface (dark, glossy) that is lit by the actual headlight SpotLights -> real light
//      pools, falloff and specular streaks.  Sits at y = -0.01.
//   2. a planar mirror (three's Reflector, custom blurred shader) on y = 0, ADDED on top, so the cars,
//      headlight beams and flares are reflected with distance-dependent blur and Fresnel.

const ReflectionShader = {
  name: 'BTMFloorReflection',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.85 },
    uBlur: { value: 1.0 },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    uFadeNear: { value: 9.0 },
    uFadeFar: { value: 44.0 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uStrength, uBlur, uFadeNear, uFadeFar;
    uniform vec2 uTexel;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    const vec2 TAPS[12] = vec2[12](
      vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
      vec2( 0.962, -0.195), vec2( 0.473, -0.480), vec2( 0.519,  0.767), vec2( 0.185, -0.893),
      vec2( 0.507,  0.064), vec2( 0.896,  0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
    void main() {
      #include <logdepthbuf_fragment>
      vec3 toCam = cameraPosition - vWorld;
      float dist = length(toCam);
      float cosT = clamp(toCam.y / max(dist, 1e-3), 0.0, 1.0);
      float fres = mix(0.30, 1.0, pow(1.0 - cosT, 3.0));
      vec2 uv = vUv.xy / vUv.w;
      float radius = uBlur * (1.2 + dist * 0.16);
      vec3 sum = texture2D(tDiffuse, uv).rgb;
      for (int i = 0; i < 12; i++) sum += texture2D(tDiffuse, uv + TAPS[i] * uTexel * radius).rgb;
      sum /= 13.0;
      float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, length(vWorld.xz - vec2(0.0, 2.0)));
      gl_FragColor = vec4(sum * color * uStrength * fres * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createFloor({ envTexture, tier, size }) {
  const group = new THREE.Group();
  group.name = 'floor';

  const baseGeo = new THREE.CircleGeometry(90, 96);
  baseGeo.rotateX(-Math.PI / 2);
  // Rough-ish, low-specular dielectric: the headlights make visible light POOLS on it. (A near-mirror
  // PBR floor turned every lamp pointing at the camera into a screen-filling specular streak.) The
  // crisp reflections come from the separate mirror layer below.
  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0x121217, roughness: 0.46, metalness: 0.0, specularIntensity: 0.3,
    envMap: envTexture, envMapIntensity: 0.0,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -0.01;
  base.renderOrder = 0;
  group.add(base);

  let reflector = null;
  if (tier.reflection > 0) {
    const w = Math.max(256, Math.round(size.x * tier.reflection));
    const h = Math.max(256, Math.round(size.y * tier.reflection));
    reflector = new Reflector(new THREE.PlaneGeometry(160, 160), {
      textureWidth: w, textureHeight: h, clipBias: 0.003, color: 0xffffff,
      shader: ReflectionShader, multisample: tier.msaa > 0 ? 2 : 0,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0;
    reflector.renderOrder = 2;
    const m = reflector.material;
    m.transparent = true;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    m.uniforms.uTexel.value.set(1 / w, 1 / h);
    group.add(reflector);
  }

  return {
    group, base, reflector,
    /** 0..1 - how much of the world the floor "shows" (fades up with the first headlight). */
    setReveal(v) {
      baseMat.envMapIntensity = 0.25 * v;
      if (reflector) reflector.material.uniforms.uStrength.value = 0.7 * v;
    },
    resize(w, h) {
      if (!reflector) return;
      const rw = Math.max(256, Math.round(w * tier.reflection)), rh = Math.max(256, Math.round(h * tier.reflection));
      reflector.getRenderTarget().setSize(rw, rh);
      reflector.material.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    },
  };
}
