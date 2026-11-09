import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { asset } from '../config.js';

/**
 * Streams a file with real byte-level progress. The expected size comes from the config
 * (content-length is unreliable when a server compresses on the fly).
 */
export async function fetchBuffer(url, expectedBytes, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer();
    onProgress?.(1, buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(Math.min(0.999, loaded / expectedBytes), loaded);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  onProgress?.(1, loaded);
  return out.buffer;
}

export async function fetchJSON(path) {
  const res = await fetch(asset(path));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();
    // Meshopt support means a meshopt-compressed variant of any model can be dropped in unchanged.
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
  }

  /** Downloads + parses one car GLB. Returns the glTF scene (Group). */
  async loadCarModel(cfg, onProgress) {
    const buf = await fetchBuffer(asset(cfg.file), cfg.bytes, onProgress);
    const base = asset(cfg.file).replace(/[^/]+$/, '');
    const gltf = await this.gltf.parseAsync(buf, base);
    return gltf.scene;
  }
}
