# North Bound Surfacing: Facebook Ads Landing Page

A mobile-first quiz funnel for resin, tarmac, block paving/porcelain, paved edging and artificial turf.
It uses a styled multi-step quiz (the "fake form") that fills in and submits a **hidden native GHL form**.

## Files

| Path | What it is |
|---|---|
| `sections/00-global-head.html` | The font and all CSS. Paste into **Page Settings → Tracking Code → Header**. |
| `sections/01-hero.html` | Section 1: header, offer bar, headline, hero photo, proof ticker |
| `sections/02-quiz.html` | Section 2: the quiz (fake form) and the GHL bridge script. Edit `NBS_CONFIG` at the top of its `<script>`. |
| `sections/03-recent-installs.html` | Section 3: swipeable job photos and a call-to-action button |
| `sections/04-reviews.html` | Section 4: Google/Checkatrade ratings, reviews, call-to-action button, footer line, sticky mobile CTA |
| `landing-page.html` | All 4 sections joined into one page |
| `preview.html` | Same page plus a mock GHL form, to test the quiz autofill locally |
| `assets/` | Page images, sized for speed (~300KB total; ~100KB above the fold). `assets/brand/` holds full-size logos. |
| `build.sh` | Rebuilds `landing-page.html` and `preview.html` after you edit a section |

Each section file goes into its own GHL **Custom Code** element, in order.

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

- [ ] Replace the placeholder `assets/job-bungalow.webp` with the real bungalow resin photo (same filename)
- [ ] Paste 3 real Google reviews into `04-reviews.html`
- [ ] Add the Privacy Policy links (`02-quiz.html`, `04-reviews.html`)
- [ ] Upload the `assets/` images to GHL Media and swap each `src`
- [ ] Map the GHL field names in `NBS_CONFIG`

## Local preview

```bash
./build.sh
open preview.html   # fill in the quiz; the mock GHL form prints what it received
```
