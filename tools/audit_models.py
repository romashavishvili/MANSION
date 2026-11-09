#!/usr/bin/env python3
"""Reproducible audit of the GLB files: what can honestly be animated?

    python tools/audit_models.py public/models

Reports per model: node/mesh/material counts, animation clips, skins, morph targets, quantisation, and the
car-local centre/size of every wheel-like group (applying all node transforms, incl. the BTM_ORIENT root).
Pure stdlib + numpy. Reads the glTF JSON chunk only (no geometry is decoded).
"""
import json, re, struct, sys, glob, os
import numpy as np

WHEEL = re.compile(r'^(tire|tyre|wheel)[ _]?\d$', re.I)

def load(path):
    b = open(path, 'rb').read()
    clen = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + clen])

def local_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                  [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                  [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0])
    return M

def audit(path):
    j = load(path); nodes = j['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    def world(i):
        M = local_matrix(nodes[i]); p = parent.get(i)
        return world(p) @ M if p is not None else M
    def corners(i):
        n = nodes[i]; pts = []
        if 'mesh' in n:
            W = world(i)
            for p in j['meshes'][n['mesh']]['primitives']:
                a = j['accessors'][p['attributes']['POSITION']]
                lo, hi = np.array(a['min'], float), np.array(a['max'], float)
                if a.get('normalized'):
                    d = {5122: 32767.0, 5120: 127.0, 5123: 65535.0, 5121: 255.0}[a['componentType']]
                    lo, hi = np.maximum(lo / d, -1), np.maximum(hi / d, -1)
                for cx in (lo[0], hi[0]):
                    for cy in (lo[1], hi[1]):
                        for cz in (lo[2], hi[2]):
                            pts.append((W @ np.array([cx, cy, cz, 1]))[:3])
        for c in n.get('children', []):
            pts += corners(c)
        return pts
    tri = sum(j['accessors'][p['indices']]['count'] // 3 for m in j['meshes'] for p in m['primitives'] if 'indices' in p)
    morph = sum(1 for m in j['meshes'] for p in m['primitives'] if p.get('targets'))
    print(f"== {os.path.basename(path)}")
    print(f"   nodes {len(nodes)}  meshes {len(j['meshes'])}  materials {len(j['materials'])}  triangles {tri:,}")
    print(f"   animation clips {len(j.get('animations', []))}  skins {len(j.get('skins', []))}  morph-target prims {morph}")
    print(f"   extensions {j.get('extensionsUsed')}")
    wheels = [i for i, n in enumerate(nodes) if WHEEL.match(n.get('name', '')) and 'mesh' not in n]
    if not wheels:
        print("   wheel groups: NONE identifiable by name (wheels, if present, are merged into other meshes)")
    for i in wheels:
        P = np.array(corners(i)); lo, hi = P.min(0), P.max(0)
        print(f"   wheel '{nodes[i]['name']}': centre {np.round((lo+hi)/2, 3).tolist()} size {np.round(hi-lo, 3).tolist()}")
    doors = [n.get('name') for n in nodes if re.search(r'door|hood|bonnet|trunk|boot|steer', n.get('name', ''), re.I)]
    print(f"   door/hood/trunk/steering-named nodes: {doors or 'none'}")

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/models'
    for f in sorted(glob.glob(os.path.join(root, '*.glb'))):
        audit(f)
