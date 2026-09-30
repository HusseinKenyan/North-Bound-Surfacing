# North Bound Surfacing: Landing Page

## `sections/`: everything you paste into GHL

| File | Where it goes in GHL |
|---|---|
| `styles.css` | Funnel step → **Settings → Custom CSS** |
| `1-hero.html` | Section 1 → **Custom Code** element |
| `2-quiz.html` | Section 2 → **Custom Code** element |
| `3-results.html` | Section 3 → **Custom Code** element |
| `4-reviews.html` | Section 4 → **Custom Code** element |
| *form: coming next* | |

- Set every GHL section, row and column to **full width, 0 padding, 0 margin** so the sections sit edge to edge.
- Images are built into the files, so there's nothing to upload. `3-results.html` is large (~300KB of photos),
  so GHL's editor may be slow to open it. That's normal.
- Open `preview.html` in a browser to see the whole page.
- The layout adapts to each section's own width, so GHL's mobile preview shows the real mobile layout.

## What's on the page

1. **Hero:** logo and Google rating, "10% OFF – Limited Time Only" bar, headline over a darkened driveway photo.
2. **Quiz:** straight after the headline, so it shows on the first screen on a phone: services → area size → timeframe → postcode → name, phone and email. Scrolling ratings strip underneath.
3. **Real results:** 5 before/after pairs plus tarmac and artificial turf installs, and a quote button.
4. **Reviews:** Google 5.0 and Checkatrade 10/10, 6 real Google reviews, quote button, footer, sticky mobile button.

## Other folders

- `src/`: working files the sections are built from (`node build.js` rebuilds `sections/` and `preview.html`).
- `tests/`: automated browser checks (`npm install` once, then `npm test`).
- `brand/`: full-size logos. `source-photos/`: original job photos and review screenshots.
