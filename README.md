# North Bound Surfacing: Facebook Ads Landing Page

A fast, mobile-first quiz funnel for GoHighLevel (GHL). Visitors answer a styled 5-step quiz (the "fake form");
on submit, a script fills in and submits a **hidden native GHL form** on the same page, so GHL workflows,
pipelines and redirects run as normal.

## Project layout

```
src/                        ← EDIT HERE (the source of truth)
├── head.html               font links + stylesheet link
├── styles/main.css         ALL the CSS (brand colours in :root at the top)
├── scripts/quiz.js         quiz logic + GHL bridge (NBS_CONFIG field mapping at the top)
├── scripts/page.js         smooth scroll, sticky mobile CTA, footer year
├── sections/               one HTML file per page section (markup only)
│   ├── 01-hero.html
│   ├── 02-quiz.html
│   ├── 03-before-after.html
│   └── 04-reviews.html
└── images/                 compressed WebP images used by the page

dist/                       ← GENERATED: never edit, copy from here
├── ghl/                    paste-ready GHL files (CSS, JS and images inlined)
│   ├── 00-head.html        → Settings → Tracking Code → Header
│   ├── 01-hero.html        → Section 1 Custom Code element
│   ├── 02-quiz.html        → Section 2 Custom Code element
│   ├── 03-before-after.html→ Section 3 Custom Code element
│   └── 04-reviews.html     → Section 4 Custom Code element
├── landing-page.html       whole page as one self-contained file
└── preview.html            same + a mock GHL form, for testing locally

build.js                    builds src/ → dist/ (no dependencies)
tests/e2e.js                browser tests (images, validation, GHL autofill, style isolation)
tests/fixtures/             mock GHL form used by preview.html and the tests
brand/                      full-size logo files
source-photos/              original job photos + review screenshots (not used by the page)
```

**Rule of thumb:** change things in `src/`, run the build, paste from `dist/ghl/`.
`dist/` is committed on purpose so the paste-ready files are always available on GitHub.

## Commands

```bash
node build.js     # or: npm run build   (rebuilds dist/)
npm install       # once, installs Playwright for the tests
npm test          # builds, then runs the browser tests
```

## Page sections

| # | Section | Contents | Background |
|---|---|---|---|
| 1 | Hero | Logo + Google rating · "10% OFF – Limited Time Only" bar · headline with **10% OFF** · services line · hero photo with LIMITED TIME tag · scrolling proof ticker | Dark |
| 2 | Quiz | Services (multi-select) → area size → timeframe → postcode → name/phone/email · progress bar | Dark |
| 3 | Before & after | 6 before/after pairs (swipe on mobile, 3 × 2 on desktop) · CTA button | White |
| 4 | Reviews | Google 5.0 + Checkatrade 10/10 cards · 6 real Google reviews · CTA button · footer · sticky mobile CTA | Light grey |

## Putting it into GHL

1. Paste `dist/ghl/00-head.html` into the funnel step's **Settings → Tracking Code → Header**.
2. Add 4 full-width sections, each with one **Custom Code** element, and paste `dist/ghl/01`–`04` in order.
   Set every section, row and column to **0 padding and 0 margin** so the sections sit edge to edge.
3. Add the native GHL **Form** element in a 5th section at the very bottom (see below). The script hides it.

Images are embedded in the files, so there's nothing to upload. `03-before-after.html` is ~300KB (six photos),
so GHL's code editor may be slow to open it. That's expected.

## Hidden GHL form

1. Build the native form in GHL (Full Name, Phone, Email, Postal Code, plus any custom fields).
   Turn **off** captcha. Set the on-submit action (a thank-you page redirect is recommended).
2. Use the native **Form** element, not an iframe embed code.
3. Open the live page with `?nbsdebug=1` on the URL. The form becomes visible and the browser console lists
   every field `name`. Put those names in `NBS_CONFIG.fields` at the top of `src/scripts/quiz.js`, then rebuild.
4. For checkbox, radio or dropdown fields, make the GHL option labels match the quiz values (matching ignores
   case and punctuation): `Resin`, `Tarmac`, `Block Paving / Porcelain`, `Paved Edging`, `Artificial Turf`,
   `Small (1-2 cars)`, `Medium (3-4 cars)`, `Large (5+ cars)`, `Not sure`, `As soon as possible`,
   `Within 1-3 months`, `3-6 months`, `Just getting prices`.

On submit the bridge validates UK postcode/phone/email, converts the phone to `+44…`, splits the full name,
fills the mapped GHL fields, ticks GHL's consent box (the quiz shows the consent wording) and clicks GHL's own
submit button. Fire the Facebook Lead event on the thank-you page (or set `fireFacebookLead: true`).

## Performance

- One web font (Montserrat 700/800/900) for headings; the phone's system font for body text.
- Compressed WebP images embedded in the page (hero 65KB, before/after pairs ~37KB each, ~300KB total).
- On a throttled slow-4G connection (1.6 Mbps, uncompressed): hero and quiz visible at ~1.0s, full page at ~2.4s.
- No frameworks or libraries.

## Still to do

- [ ] Map the GHL field names in `NBS_CONFIG` (`src/scripts/quiz.js`)
