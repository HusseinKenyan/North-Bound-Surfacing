#!/usr/bin/env bash
# Builds everything from sections/ (the editable source, which references assets/*.webp):
#   ghl/                paste-ready files for GoHighLevel, with every image embedded (no media swapping needed)
#   landing-page.html   the full page as one self-contained file (images embedded)
#   preview.html        same page plus a mock GHL form, to test the quiz autofill locally
set -euo pipefail
cd "$(dirname "$0")"

python3 - <<'PY'
import base64, pathlib, re
root = pathlib.Path('.')
out = root / 'ghl'
out.mkdir(exist_ok=True)
for old in out.glob('*.html'):
    old.unlink()

def embed(html):
    def data_uri(m):
        path = root / m.group(2)
        mime = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}[path.suffix]
        return m.group(1) + 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode() + m.group(3)
    return re.sub(r'''(src="|url\(')(assets/[^"')]+)("|'\))''', data_uri, html)

for src in sorted((root / 'sections').glob('*.html')):
    html = embed(src.read_text())
    (out / src.name).write_text(html)
    print(f'ghl/{src.name:28s} {len(html) // 1024:4d} KB')
PY

build() {
  local out="$1" with_mock="$2"
  {
    echo '<!doctype html>'
    echo '<html lang="en-GB">'
    echo '<head>'
    echo '<meta charset="utf-8">'
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
    echo '<title>Free Driveway Quote + 10% Off | North Bound Surfacing</title>'
    echo '<meta name="description" content="Resin, tarmac, block paving, porcelain and artificial turf across Greater Manchester & Cheshire. Get your free quote in 30 seconds with 10% off.">'
    echo '<style>html,body{margin:0;padding:0;background:#0F0F0F}</style>'
    cat ghl/00-global-head.html
    echo '</head>'
    echo '<body>'
    [ "$with_mock" = 1 ] && cat dev/mock-ghl-form.html
    for f in $(ls ghl/*.html | grep -v 00-global-head | sort); do cat "$f"; echo; done
    echo '</body>'
    echo '</html>'
  } > "$out"
  echo "built $out ($(( $(wc -c < "$out") / 1024 )) KB)"
}

build landing-page.html 0
build preview.html 1
