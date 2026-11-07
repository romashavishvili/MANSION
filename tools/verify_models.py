"""Independent structural + fidelity check of optimized GLBs (numpy only)."""
import sys, json, math, numpy as np
sys.path.insert(0, __file__.rsplit('/',1)[0] if '/' in __file__ else '.')
from optimize_models import load_glb, read_acc, world_matrices

def decode(j, b, i):
    a = j['accessors'][i]; arr = read_acc(j, b, i).astype(np.float64)
    if a.get('normalized'): arr = np.maximum(arr / {5120:127,5121:255,5122:32767,5123:65535}[a['componentType']], -1)
    return arr

def world_tris(j, b, skip=()):
    M = world_matrices(j); P=[]; 
    for i, n in enumerate(j['nodes']):
        if 'mesh' not in n or n.get('name') in skip: continue
        for pr in j['meshes'][n['mesh']]['primitives']:
            p = decode(j,b,pr['attributes']['POSITION']); idx = read_acc(j,b,pr['indices']).reshape(-1,3)
            assert idx.max() < len(p), 'index out of range'
            w = (M[i][:3,:3] @ p.T).T + M[i][:3,3]; P.append((i, w, idx))
    return P

def area_and_bbox(tris):
    A=0; allp=[]
    for _, w, idx in tris:
        a,b_,c = w[idx[:,0]], w[idx[:,1]], w[idx[:,2]]
        A += np.linalg.norm(np.cross(b_-a, c-a),axis=1).sum()/2; allp.append(w)
    allp=np.vstack(allp); return A, allp.min(0), allp.max(0)

def structural(j, b, label):
    ok=True
    for k,a in enumerate(j['accessors']):
        bv=j['bufferViews'][a['bufferView']]
        esz=np.dtype({5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}[a['componentType']]).itemsize
        if (bv.get('byteOffset',0)+a.get('byteOffset',0)) % min(esz,4) or (a.get('byteOffset',0) % 4 and 'byteStride' in bv):
            print(' MISALIGNED accessor',k); ok=False
        if 'byteStride' in bv and bv['byteStride']%4: print(' bad stride',k); ok=False
        end = bv.get('byteOffset',0)+bv['byteLength']
        if end > len(b): print(' bufferView beyond buffer',k); ok=False
    for bi,bv in enumerate(j['bufferViews']):
        if bv.get('byteOffset',0)%4: print(' bufferView offset not 4-aligned',bi); ok=False
    print(f' [{label}] structure OK' if ok else f' [{label}] STRUCTURE PROBLEMS')
    return ok

if __name__=='__main__':
    S, O = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ('models-src', 'public/models')
    pairs=[('ferrari',f'{S}/ferrari_laferrari.glb',f'{O}/ferrari_laferrari.glb',()),
           ('maybach',f'{S}/mercedes-benz_maybach_2022.glb',f'{O}/mercedes_maybach_2022.glb',('Object_6','Object_7'))]
    for name,o,n,skip in pairs:
        print('==',name)
        jo,bo=load_glb(o); jn,bn=load_glb(n)
        structural(jn,bn,name)
        print(' ext required:',jn['extensionsRequired'],' buffer MB',round(len(bn)/1e6,2))
        Ao,mo,xo=area_and_bbox(world_tris(jo,bo,skip)); An,mn,xn=area_and_bbox(world_tris(jn,bn))
        print(f' surface area  orig {Ao:.3f} m2  new {An:.3f} m2  diff {abs(An-Ao)/Ao*100:.4f}%')
        print(' new bbox min',mn.round(3),'max',xn.round(3),'size',(xn-mn).round(3))
        meta=json.load(open(f'{O}/{name}.meta.json'))
        print(' headlight px',meta['headlights']['px']['center'],' nx',meta['headlights']['nx']['center'])
        for k,v in meta['wheels'].items(): print('  wheel',k,v)
