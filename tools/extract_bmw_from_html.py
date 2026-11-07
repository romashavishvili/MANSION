"""Pull the gzip+base64 BMW M5 GLB out of the original single-file 'M5___Beyond_the_Machine.html'
and write it as models-src/bmw_m5_2025.src.glb (still gzipped; optimize_models.py un-gzips it)."""
import re, base64, sys
html = open(sys.argv[1], encoding='utf8', errors='replace').read()
m = re.search(r'<script type="text/plain" id="glb">([A-Za-z0-9+/=\s]+)</script>', html)
open(sys.argv[2], 'wb').write(base64.b64decode(m.group(1)))
print('wrote', sys.argv[2])
