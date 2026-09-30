#!/usr/bin/env bash
# Stitches sections/*.html into two full pages:
#   landing-page.html  complete page (for a single GHL custom-code element or hosting elsewhere)
#   preview.html       same page plus a mock GHL form, to test the quiz autofill locally
set -euo pipefail
cd "$(dirname "$0")"

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
    cat sections/00-global-head.html
    echo '</head>'
    echo '<body>'
    [ "$with_mock" = 1 ] && cat dev/mock-ghl-form.html
    for f in $(ls sections/*.html | grep -v 00-global-head | sort); do cat "$f"; echo; done
    echo '</body>'
    echo '</html>'
  } > "$out"
  echo "built $out"
}

build landing-page.html 0
build preview.html 1
