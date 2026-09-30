# North Bound Surfacing: Facebook Ads Landing Page

A mobile-first quiz funnel for resin, tarmac, block paving/porcelain, paved edging and artificial turf.
It uses a styled multi-step quiz (the "fake form") that fills in and submits a **hidden native GHL form**.

## Files

| Path | What it is |
|---|---|
| `sections/00-global-head.html` | The font and all CSS. Paste into **Page Settings → Tracking Code → Header**. |
| `sections/01-hero.html` | Section 1: header, offer bar, headline, hero photo, proof ticker |
| `sections/02-quiz.html` | Section 2: the quiz (fake form) and the GHL bridge script. Edit `NBS_CONFIG` at the top of its `<script>`. |
| `sections/03-recent-installs.html` | Section 3: 6 before & after pairs (swipe row on mobile, 3 x 2 grid on desktop) and a call-to-action button |
| `sections/04-reviews.html` | Section 4: Google/Checkatrade ratings, 6 real Google reviews (swipe row), call-to-action button, footer line, sticky mobile CTA |
| `landing-page.html` | All 4 sections joined into one page |
| `preview.html` | Same page plus a mock GHL form, to test the quiz autofill locally |
| `assets/` | Page images, sized for speed (~100KB above the fold; gallery lazy-loads). `assets/brand/` holds full-size logos. |
| `build.sh` | Rebuilds `landing-page.html` and `preview.html` after you edit a section |

Each section file goes into its own GHL **Custom Code** element, in order.

## Page sections

| # | File | What's in it | Background |
|---|---|---|---|
| — | `00-global-head.html` | Montserrat font + all CSS (brand colours in `:root`) | — |
| 1 | `01-hero.html` | Logo + Google rating bar · orange "10% OFF – Limited Time Only" bar · stars kicker · headline with **10% OFF** · services line · "Free quote in 30 seconds" · hero photo with LIMITED TIME tag · scrolling proof ticker | Dark |
| 2 | `02-quiz.html` | 5-step quiz: services (multi-select) → area size → timeframe → postcode → name/phone/email · progress bar · GHL bridge script | Dark |
| 3 | `03-recent-installs.html` | "Real Before & After Results": 6 before/after pairs (swipe on mobile, 3 × 2 on desktop) · "Yes! I Want A Free Quote" button | White |
| 4 | `04-reviews.html` | Google 5.0 / Checkatrade 10/10 cards · 6 real Google reviews (swipe on mobile, 3 × 2 on desktop) · "Claim My 10% Off Quote" button · footer line with Privacy Policy · sticky mobile CTA | Light grey |

### Pasting into GHL

1. **Header code:** paste all of `00-global-head.html` into the funnel step's **Settings → Tracking Code → Header**.
2. **Sections:** add 4 full-width GHL sections, each with one **Custom Code** element, and paste files 01–04 in order.
   Set each section/row/column to **full width with 0 padding and 0 margin** so the sections sit edge to edge.
3. **Hidden form:** add the native GHL **Form** element in a 5th section at the very bottom (see *GHL setup*).
4. **Images:** upload `assets/*.webp` to GHL Media and replace each `src="assets/…"` with its media URL
   (`01-hero.html`: logo + hero; `03-recent-installs.html`: 6 before/after images).

The CSS is scoped to `.nbs` and hardened against GHL's global styles (tested by injecting hostile heading, paragraph,
button, link and image rules: no visual change).

## Speed

- One web font (Montserrat, 3 weights) for headings; body text uses the phone's system font.
- Hero image ~89KB WebP loaded with high priority; gallery images lazy-load as the visitor scrolls.
- No libraries or frameworks. The only JavaScript is the quiz and the smooth scroll/sticky button.

## GHL setup

1. **Build the native form in GHL** with the fields you want to capture, e.g. Full Name, Phone, Email, Postal Code,
   plus optional custom fields for Surface Type, Driveway Size, Timeframe and a multi-line "Quiz Answers" field.
   Turn **off** captcha on this form. Set its on-submit action (redirect to a thank-you page is recommended).
2. **Add the form to the page** using the native **Form** element, not an iframe embed code. Put it in its own
   section at the bottom of the page. The script moves it off-screen automatically, so you don't need to hide it
   with GHL's visibility toggles.
3. **Paste the sections** into Custom Code elements in the order above. Set each GHL section/row to
   full width with zero padding so the sections sit edge to edge.
4. **Map the fields.** Open the page with `?nbsdebug=1` on the end of the URL. The hidden form becomes visible
   and the browser console prints a table of every field `name`. Put those names in `NBS_CONFIG.fields`
   in `03-quiz.html`:

   ```js
   fields: {
     full_name:  ['full_name'],
     first_name: ['first_name'],
     last_name:  ['last_name'],
     phone:      ['phone'],
     email:      ['email'],
     postcode:   ['postal_code'],
     services:   ['surface_type'],      // checkbox, multi-select dropdown or text field
     size:       ['driveway_size'],
     timeframe:  ['project_timeframe'],
     summary:    ['quiz_answers']       // every answer as one block of text
   }
   ```

   Fields that aren't on your form are skipped. For checkbox, radio or dropdown custom fields, make the GHL option
   labels match the quiz values (`Resin`, `Tarmac`, `Block Paving / Porcelain`, `Paved Edging`, `Artificial Turf`,
   `Small (1-2 cars)`, `Medium (3-4 cars)`, `Large (5+ cars)`, `Not sure`, `As soon as possible`,
   `Within 1-3 months`, `3-6 months`, `Just getting prices`). Matching ignores case and punctuation.
5. **Test** a submission with `?nbsdebug=1` and check the contact appears in GHL with every field filled.

### What the bridge does on submit

- Validates UK postcode, phone and email in the quiz.
- Converts the phone number to `+44…` format (set `phoneFormat: 'raw'` to turn this off).
- Splits the full name into first and last name.
- Writes each answer into the mapped GHL fields, firing the input/change events GHL's form listens for.
- Ticks GHL's consent/terms checkbox (the quiz shows the consent wording above its submit button).
- Clicks GHL's own submit button, so workflows, pipelines, tags and the redirect all run as normal.
- If GHL hasn't redirected within 7 seconds, it shows its own thank-you message, or goes to `redirectUrl` if you set one.

Facebook Lead event: fire it on the thank-you page (recommended), or set `fireFacebookLead: true`.

## Still to do before launch

- [ ] Upload the `assets/` images to GHL Media and swap each `src`
- [ ] Map the GHL field names in `NBS_CONFIG`

Original photos (`source-photos/jobs/`) and review screenshots (`source-photos/reviews/`) are kept for reference; the page does not load them.

## Local preview

```bash
./build.sh
open preview.html   # fill in the quiz; the mock GHL form prints what it received
```
