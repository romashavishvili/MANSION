import * as THREE from 'three';

// Procedural studio-style HDR environments. Cars reflect these, so each car gets reflections that
// carry its own identity (red strips for BMW, deep-red for Ferrari, warm softboxes for Maybach).
// They are generated once with PMREM and used via explicit material.envMap (not scene.environment),
// which lets every car's reflection strength be animated independently.

function softbox(scene, rgb, size, pos) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide }),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.lookAt(0, 0.6, 0);
  scene.add(m);
}

const RECIPES = {
  bmw(s) {                                  // power: hard white overhead strip + two blood-red verticals
    softbox(s, [9, 9, 10], [16, 1.4], [0, 8.5, 0]);
    softbox(s, [11, 0.5, 0.7], [1.1, 7], [-9.5, 3, 1.5]);
    softbox(s, [11, 0.5, 0.7], [1.1, 7], [9.5, 3, 1.5]);
    softbox(s, [1.4, 1.6, 3.2], [10, 2.5], [0, 2.0, -11]);
    softbox(s, [3.0, 0.2, 0.25], [14, 0.5], [0, 0.4, 10]);
  },
  ferrari(s) {                              // performance: thin white + deep red sides, low red glow
    softbox(s, [8, 8, 8.5], [14, 0.7], [0, 8.5, -1]);
    softbox(s, [10, 0.35, 0.3], [1.5, 6], [-9.5, 2.5, 2]);
    softbox(s, [10, 0.35, 0.3], [1.5, 6], [9.5, 2.5, 2]);
    softbox(s, [6, 0.15, 0.1], [16, 0.7], [0, 0.7, -10]);
    softbox(s, [2.0, 2.0, 2.4], [8, 1.2], [0, 5, 10]);
  },
  maybach(s) {                              // luxury: wide warm champagne softboxes, tall side panels
    softbox(s, [7.5, 5.6, 3.4], [12, 6], [0, 9, 0]);
    softbox(s, [4.5, 3.3, 1.9], [1.6, 8], [-9.5, 3.5, 0]);
    softbox(s, [4.5, 3.3, 1.9], [1.6, 8], [9.5, 3.5, 0]);
    softbox(s, [1.2, 1.0, 0.8], [16, 3], [0, 2, -11]);
    softbox(s, [2.2, 1.9, 1.4], [14, 1.0], [0, 0.6, 11]);
  },
  floor(s) {                                // very faint sheen for the floor itself
    softbox(s, [1.6, 1.6, 1.8], [18, 1.5], [0, 9, 0]);
  },
};

export function buildEnvironments(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const out = {};
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    recipe(scene);
    out[name] = pmrem.fromScene(scene, 0.035).texture;
    scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  pmrem.dispose();
  return out;
}
