#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p Offline/ripasso
cp ../travel.js ../travel-ui.js ../tokens.css viaggi.html Offline/
cp ../ripasso/{index.html,app.js,core.js,gen.js,bank.js,ripasso.css} Offline/ripasso/
# La vista locale usa soltanto risorse incluse nel bundle.
python3 - <<'PY'
from pathlib import Path
p = Path("Offline/ripasso/index.html")
s = p.read_text()
s = s.replace("<head>", """<head><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'"><style>.rp-back{display:none!important}</style>""")
p.write_text(s)
PY
