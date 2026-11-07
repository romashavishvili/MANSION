#!/usr/bin/env python3
"""
BEYOND THE MACHINE 3.0 - offline model optimizer (Stage 1)

What it does (and ONLY this - geometry is never decimated):
  * drops junk meshes (e.g. invisible unit-cubes in the Maybach file)
  * removes UV sets that no material can sample (Maybach has 13 MB of them, no textures at all)
  * welds duplicate vertices, drops degenerate triangles
  * quantizes positions + normals to 16-bit (KHR_mesh_quantization), per-mesh uniform scale
    folded into the node matrix. 16 bit over a 5 m part = 0.15 mm precision; normals keep
    16 bit so clear-coat highlights do not band.
  * uint32 -> uint16 indices wherever the vertex count allows
  * bakes orientation: front -> +Z, centred on X/Z, tyres touching y = 0, pitch levelled
  * exports a *.meta.json (dimensions, headlight anchors, wheel centres)

Requires: python3 + numpy.        Usage: python tools/optimize_models.py <src_dir> <out_dir>
"""
import sys, json, struct, math, copy
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

# ---------------------------------------------------------------- GLB io
def load_glb(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'glTF'
    ln = struct.unpack('<I', d[8:12])[0]
    off, js, binc = 12, None, None
    while off < ln:
        cl, ct = struct.unpack('<II', d[off:off + 8])
        c = d[off + 8:off + 8 + cl]
        if ct == 0x4E4F534A: js = json.loads(c)
        elif ct == 0x004E4942: binc = c
        off += 8 + cl
    return js, binc

def write_glb(path, j, binary):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    binary = bytes(binary) + b'\0' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binary), 0x004E4942)); f.write(binary)

def read_acc(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', dt.itemsize * n)
    if stride == dt.itemsize * n:
        arr = np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
    else:
        arr = np.ndarray((a['count'], n), dtype=dt, buffer=b, offset=off, strides=(stride, dt.itemsize))
    return np.array(arr)

# ---------------------------------------------------------------- math
def local_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    T = np.eye(4); R = np.eye(4); S = np.eye(4)
    if 'translation' in n: T[:3, 3] = n['translation']
    if 'scale' in n: S[0, 0], S[1, 1], S[2, 2] = n['scale']
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        R[:3, :3] = [[1 - 2*(y*y+z*z), 2*(x*y - z*w), 2*(x*z + y*w)],
                     [2*(x*y + z*w), 1 - 2*(x*x+z*z), 2*(y*z - x*w)],
                     [2*(x*z - y*w), 2*(y*z + x*w), 1 - 2*(x*x+y*y)]]
    return T @ R @ S

def to_gltf_matrix(M): return [float(v) for v in M.T.reshape(16)]

def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]], dtype=np.float64)

def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]], dtype=np.float64)

def trans(v):
    T = np.eye(4); T[:3, 3] = v; return T

def world_matrices(j):
    N = j['nodes']; M = [None] * len(N)
    def rec(i, P):
        M[i] = P @ local_matrix(N[i])
        for c in N[i].get('children', []): rec(c, M[i])
    for s in j['scenes'][j.get('scene', 0)]['nodes']: rec(s, np.eye(4))
    return M

# ---------------------------------------------------------------- per-model configuration
CONFIGS_PASSTHROUGH = {
  'bmw': dict(
    src='bmw_m5_2025.src.glb', dst='bmw_m5_2025.glb',
    wheel_nodes=['bBMW_M5SedanRewardRecycled_2024_Wheel1A_3D_3DWheel2A_Material1'],
    headlight_nodes=['bBMW_M5SedanRewardRecycled_2024LightA_Material1'], headlight_min_z=1.2,
  ),
}

CONFIGS = {
  'ferrari': dict(
    src='ferrari_laferrari.glb', dst='ferrari_laferrari.glb', yaw_deg=180.0, level=True,
    drop_nodes=[], keep_uv_only_if_textured=True,
    wheel_nodes=['tire 1_tread.001_0', 'tire 2_tread.002_0', 'tire 3_tread.003_0', 'tire 4_tread.004_0'],
    headlight_nodes=['LaFerrari_Front headlights.001_0'],
  ),
  'maybach': dict(
    src='mercedes-benz_maybach_2022.glb', dst='mercedes_maybach_2022.glb', yaw_deg=90.0, level=False,
    drop_nodes=['Object_6', 'Object_7'],          # two invisible (alpha 0) unit cubes
    keep_uv_only_if_textured=True,                 # file has no textures -> all UVs dropped
    wheel_nodes=['Object_37', 'Object_38'],        # front / rear tyre pairs
    headlight_nodes=['Object_3'],                  # emissive white LED strip
  ),
}

def decode_pos(j, b, i):
    a = j['accessors'][i]; arr = read_acc(j, b, i).astype(np.float64)
    if a.get('normalized'):
        arr = np.maximum(arr / {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[a['componentType']], -1.0)
    return arr

def passthrough(cfg, src_dir, out_dir):
    """File is already quantized + correctly oriented (front +Z, centred, on the floor): copy it
    (un-gzipping if needed) and derive the manifest from its decoded geometry."""
    import gzip
    raw = open(f"{src_dir}/{cfg['src']}", 'rb').read()
    if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
    open(f"{out_dir}/{cfg['dst']}", 'wb').write(raw)
    j, b = load_glb(f"{out_dir}/{cfg['dst']}")
    N = j['nodes']; M = world_matrices(j); idx = {n.get('name'): i for i, n in enumerate(N)}
    def wp(i):
        out = []
        for pr in j['meshes'][N[i]['mesh']]['primitives']:
            p = decode_pos(j, b, pr['attributes']['POSITION']); out.append((M[i][:3, :3] @ p.T).T + M[i][:3, 3])
        return np.vstack(out)
    allp = np.vstack([wp(i) for i, n in enumerate(N) if 'mesh' in n]); mn, mx = allp.min(0), allp.max(0)
    hp = np.vstack([wp(idx[n]) for n in cfg['headlight_nodes']]); hp = hp[hp[:, 2] > cfg['headlight_min_z']]
    hl = {}
    for key, sel in (('px', hp[:, 0] > 0), ('nx', hp[:, 0] < 0)):
        q = hp[sel]; hl[key] = dict(center=((q.min(0) + q.max(0)) / 2).round(4).tolist(), min=q.min(0).round(4).tolist(), max=q.max(0).round(4).tolist())
    wpts = np.vstack([wp(idx[n]) for n in cfg['wheel_nodes']]); zmid = (wpts[:, 2].min() + wpts[:, 2].max()) / 2
    wheels = {}
    for lab, sel in (('front_px', (wpts[:, 0] > 0) & (wpts[:, 2] > zmid)), ('front_nx', (wpts[:, 0] < 0) & (wpts[:, 2] > zmid)),
                     ('rear_px', (wpts[:, 0] > 0) & (wpts[:, 2] < zmid)), ('rear_nx', (wpts[:, 0] < 0) & (wpts[:, 2] < zmid))):
        q = wpts[sel]; wheels[lab] = dict(center=((q.min(0) + q.max(0)) / 2).round(4).tolist(), radius=round(float((q[:, 1].max() - q[:, 1].min()) / 2), 4))
    return dict(source=cfg['src'], optimized=cfg['dst'], asset=j['asset'].get('extras', {}),
                size=[round(float(v), 4) for v in (mx - mn)], min=mn.round(4).tolist(), max=mx.round(4).tolist(),
                headlights=hl, wheels=wheels, pitch_correction_deg=0.0), len(raw)

# ---------------------------------------------------------------- core
def optimize(cfg, src_dir, out_dir, report):
    j, b = load_glb(f"{src_dir}/{cfg['src']}")
    N = j['nodes']
    name_to_idx = {n.get('name'): i for i, n in enumerate(N)}
    for nm in cfg['drop_nodes']:
        N[name_to_idx[nm]].pop('mesh', None)

    M = world_matrices(j)
    mesh_nodes = [i for i, n in enumerate(N) if 'mesh' in n]
    textured_mats = set()
    for mi, m in enumerate(j.get('materials', [])):
        s = json.dumps(m)
        if '"index"' in s and 'Texture' in s: textured_mats.add(mi)

    # decode everything once
    orig = {}
    for i in mesh_nodes:
        pr = j['meshes'][N[i]['mesh']]['primitives']
        assert len(pr) == 1, 'multi-primitive meshes not supported by this tool'
        pr = pr[0]; at = pr['attributes']
        orig[i] = dict(
            pos=read_acc(j, b, at['POSITION']).astype(np.float64),
            nrm=read_acc(j, b, at['NORMAL']).astype(np.float64),
            uv=read_acc(j, b, at['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in at else None,
            idx=read_acc(j, b, pr['indices']).reshape(-1).astype(np.uint32),
            mat=pr.get('material'))

    def world_pts(i, T=np.eye(4)):
        W = T @ M[i]; return (W[:3, :3] @ orig[i]['pos'].T).T + W[:3, 3]

    # ---- orientation: yaw -> optional level -> centre/ground
    R = rot_y(math.radians(cfg['yaw_deg']))
    wheel_ids = [name_to_idx[n] for n in cfg['wheel_nodes']]
    pitch = 0.0
    if cfg['level']:
        low = []
        for i in wheel_ids:
            p = world_pts(i, R); k = np.argmin(p[:, 1]); low.append((p[k, 2], p[k, 1]))
        zs = np.array([l[0] for l in low]); ys = np.array([l[1] for l in low])
        slope = np.polyfit(zs, ys, 1)[0]           # dy/dz of tyre contact points
        pitch = math.atan(slope)
        # rot_x(a): y' = y cos a + z sin a  -> choose a so that contact points share y
        R = rot_x(pitch) @ R
        report.append(f"  levelled pitch {math.degrees(pitch):+.3f} deg (tyre contact slope {slope:+.5f})")
    allp = np.vstack([world_pts(i, R) for i in mesh_nodes])
    mn, mx = allp.min(0), allp.max(0)
    ground = min(world_pts(i, R)[:, 1].min() for i in wheel_ids)
    shift = np.array([-(mn[0] + mx[0]) / 2, -ground, -(mn[2] + mx[2]) / 2])
    ORIENT = trans(shift) @ R
    final = np.vstack([world_pts(i, ORIENT) for i in mesh_nodes])
    fmn, fmx = final.min(0), final.max(0)

    # ---- anchors in final frame
    def side_boxes(ids):
        pts = np.vstack([world_pts(i, ORIENT) for i in ids]); out = {}
        for key, sel in (('px', pts[:, 0] > 0), ('nx', pts[:, 0] < 0)):
            q = pts[sel]; out[key] = dict(center=((q.min(0) + q.max(0)) / 2).round(4).tolist(),
                                          min=q.min(0).round(4).tolist(), max=q.max(0).round(4).tolist())
        return out
    hl = side_boxes([name_to_idx[n] for n in cfg['headlight_nodes']])
    wheels = {}
    wp = np.vstack([world_pts(i, ORIENT) for i in wheel_ids]); zmid = (wp[:, 2].min() + wp[:, 2].max()) / 2
    for lab, sel in (('front_px', (wp[:, 0] > 0) & (wp[:, 2] > zmid)), ('front_nx', (wp[:, 0] < 0) & (wp[:, 2] > zmid)),
                     ('rear_px', (wp[:, 0] > 0) & (wp[:, 2] < zmid)), ('rear_nx', (wp[:, 0] < 0) & (wp[:, 2] < zmid))):
        q = wp[sel]; wheels[lab] = dict(center=((q.min(0) + q.max(0)) / 2).round(4).tolist(), radius=round(float((q[:, 1].max() - q[:, 1].min()) / 2), 4))

    # ---- rebuild geometry
    out_bin = bytearray()
    def align(n=4):
        while len(out_bin) % n: out_bin.append(0)
    new_bv, new_acc, new_meshes = [], [], []
    # copy image bufferViews first
    img_bv_map = {}
    for im in j.get('images', []):
        bv = j['bufferViews'][im['bufferView']]
        align(); start = len(out_bin)
        out_bin += b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        new_bv.append(dict(buffer=0, byteOffset=start, byteLength=bv['byteLength']))
        im['bufferView'] = len(new_bv) - 1

    stats = dict(v_in=0, v_out=0, t_in=0, t_out=0)
    for i in mesh_nodes:
        o = orig[i]; pos, nrm, uv, idx = o['pos'], o['nrm'], o['uv'], o['idx']
        keep_uv = uv is not None and (o['mat'] in textured_mats)
        # uniform quantization frame
        c = (pos.min(0) + pos.max(0)) / 2
        s = float(max((pos.max(0) - pos.min(0)).max() / 2, 1e-6))
        qp = np.clip(np.rint((pos - c) / s * 32767.0), -32767, 32767).astype(np.int16)
        nl = np.linalg.norm(nrm, axis=1, keepdims=True); nl[nl == 0] = 1
        qn = np.clip(np.rint(nrm / nl * 32767.0), -32767, 32767).astype(np.int16)
        cols = [qp.astype(np.int32), qn.astype(np.int32)]
        if keep_uv: cols.append(uv.view(np.int32).reshape(-1, 2))
        key = np.hstack(cols)
        uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        tri = inv[idx].reshape(-1, 3)
        good = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
        tri = tri[good]
        # compact vertex set to those still referenced, preserve first-use order for cache friendliness
        used, newidx = np.unique(tri.reshape(-1), return_inverse=True)
        tri = newidx.reshape(-1, 3).astype(np.uint32)
        sel = first[used]
        vp, vn = qp[sel], qn[sel]
        nv = len(sel)
        stride = 24 if keep_uv else 16
        vb = np.zeros((nv, 8), dtype=np.int16)  # pos(3)+pad, normal(3)+pad as int16 words
        vb[:, 0:3] = vp; vb[:, 4:7] = vn
        raw = vb.tobytes()
        if keep_uv:
            buf = np.zeros((nv, stride), dtype=np.uint8)
            buf[:, 0:16] = np.frombuffer(vb[:, 0:8].tobytes(), dtype=np.uint8).reshape(nv, 16)
            buf[:, 16:24] = np.frombuffer(uv[sel].astype('<f4').tobytes(), dtype=np.uint8).reshape(nv, 8)
            raw = buf.tobytes()
        align(); vstart = len(out_bin); out_bin += raw
        new_bv.append(dict(buffer=0, byteOffset=vstart, byteLength=len(raw), byteStride=stride, target=34962))
        vbi = len(new_bv) - 1
        new_acc.append(dict(bufferView=vbi, byteOffset=0, componentType=5122, normalized=True, count=nv, type='VEC3',
                            min=vp.min(0).astype(int).tolist(), max=vp.max(0).astype(int).tolist()))
        pa = len(new_acc) - 1
        new_acc.append(dict(bufferView=vbi, byteOffset=8, componentType=5122, normalized=True, count=nv, type='VEC3'))
        na = len(new_acc) - 1
        attrs = dict(POSITION=pa, NORMAL=na)
        if keep_uv:
            new_acc.append(dict(bufferView=vbi, byteOffset=16, componentType=5126, count=nv, type='VEC2'))
            attrs['TEXCOORD_0'] = len(new_acc) - 1
        if nv <= 65535: it, ict = np.uint16, 5123
        else: it, ict = np.uint32, 5125
        ib = tri.reshape(-1).astype(it).tobytes()
        align(); istart = len(out_bin); out_bin += ib
        new_bv.append(dict(buffer=0, byteOffset=istart, byteLength=len(ib), target=34963))
        new_acc.append(dict(bufferView=len(new_bv) - 1, byteOffset=0, componentType=ict, count=tri.size, type='SCALAR'))
        prim = dict(attributes=attrs, indices=len(new_acc) - 1, mode=4)
        if o['mat'] is not None: prim['material'] = o['mat']
        new_meshes.append(dict(name=j['meshes'][N[i]['mesh']].get('name', f'mesh{i}'), primitives=[prim]))
        N[i]['mesh'] = len(new_meshes) - 1
        # fold dequantization into the node's local matrix
        Q = trans(c) @ np.diag([s, s, s, 1.0])
        L = local_matrix(N[i]) @ Q
        for k in ('translation', 'rotation', 'scale', 'matrix'): N[i].pop(k, None)
        N[i]['matrix'] = to_gltf_matrix(L)
        stats['v_in'] += len(pos); stats['v_out'] += nv; stats['t_in'] += len(idx) // 3; stats['t_out'] += len(tri)

    # nodes that lost their mesh (dropped): make sure no stale mesh index remains
    for nm in cfg['drop_nodes']: N[name_to_idx[nm]].pop('mesh', None)

    # wrapper node carrying the orientation
    roots = j['scenes'][j.get('scene', 0)]['nodes']
    N.append(dict(name='BTM_ORIENT', matrix=to_gltf_matrix(ORIENT), children=list(roots)))
    j['scenes'][j.get('scene', 0)]['nodes'] = [len(N) - 1]

    j['meshes'], j['accessors'], j['bufferViews'] = new_meshes, new_acc, new_bv
    j['buffers'] = [dict(byteLength=len(out_bin))]
    ext_used = set(j.get('extensionsUsed', [])); ext_used.add('KHR_mesh_quantization')
    ext_req = set(j.get('extensionsRequired', [])); ext_req.add('KHR_mesh_quantization')
    j['extensionsUsed'], j['extensionsRequired'] = sorted(ext_used), sorted(ext_req)
    for k in ('animations', 'skins'): j.pop(k, None)
    ex = j.setdefault('asset', {}).setdefault('extras', {})
    ex['modifications'] = ('Beyond the Machine 3.0: vertex welding, 16-bit quantization, removal of unused UV sets and '
                           'invisible helper meshes, re-orientation/levelling. No geometry decimation.')
    write_glb(f"{out_dir}/{cfg['dst']}", j, out_bin)

    meta = dict(source=cfg['src'], optimized=cfg['dst'], asset=j['asset'].get('extras', {}),
                size=[round(float(v), 4) for v in (fmx - fmn)], min=fmn.round(4).tolist(), max=fmx.round(4).tolist(),
                headlights=hl, wheels=wheels, pitch_correction_deg=round(math.degrees(pitch), 4))
    return meta, stats

if __name__ == '__main__':
    src_dir, out_dir = sys.argv[1], sys.argv[2]
    metas = {}
    for name, cfg in CONFIGS_PASSTHROUGH.items():
        meta, n = passthrough(cfg, src_dir, out_dir)
        print(f"[{name}] passthrough (already optimized), {n/1e6:.1f} MB")
        json.dump(meta, open(f"{out_dir}/{name}.meta.json", 'w'), indent=2)
    for name, cfg in CONFIGS.items():
        rep = [f"[{name}]"]
        meta, st = optimize(cfg, src_dir, out_dir, rep)
        rep.append(f"  verts {st['v_in']:,} -> {st['v_out']:,}   tris {st['t_in']:,} -> {st['t_out']:,}")
        print('\n'.join(rep))
        json.dump(meta, open(f"{out_dir}/{name}.meta.json", 'w'), indent=2)
