#!/usr/bin/env node
/*
 * Builds the files in sections/ (what gets pasted into GHL) from the working files in src/.
 *
 *   src/styles/main.css  →  sections/styles.css
 *   src/html/*.html      →  sections/*.html   (scripts and images inlined, so each file is one paste)
 *   everything           →  preview.html      (the whole page, to open in a browser)
 *
 * Usage: node build.js   (no dependencies)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'sections');

const FONT = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">',
].join('\n');

// Output file → [label at the top of the file, extra code to put first]
const FILES = {
  'styles.css': ['STYLES · paste into GHL: Settings → Custom CSS', ''],
  '1-hero.html': ['SECTION 1 · HERO · paste into a GHL Custom Code element', FONT],
  '2-quiz.html': ['SECTION 2 · QUIZ · paste into a GHL Custom Code element', ''],
  '3-results.html': ['SECTION 3 · RESULTS · paste into a GHL Custom Code element', ''],
  '4-reviews.html': ['SECTION 4 · REVIEWS · paste into a GHL Custom Code element', ''],
};

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const read = (p) => fs.readFileSync(p, 'utf8');

// <script src="scripts/x.js"></script> → inline <script>; images/x.webp → base64 data URI
function inline(html) {
  return html
    .replace(/<script src="(scripts\/[^"]+)"><\/script>/g,
      (_, file) => `<script>\n${read(path.join(SRC, file)).trimEnd()}\n</script>`)
    .replace(/(src="|url\(')(images\/[^"')]+)("|'\))/g, (_, open, file, close) => {
      const abs = path.join(SRC, file);
      const mime = MIME[path.extname(abs)];
      if (!mime) throw new Error(`Unsupported image type: ${file}`);
      return `${open}data:${mime};base64,${fs.readFileSync(abs).toString('base64')}${close}`;
    });
}

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log(`${path.relative(ROOT, file).padEnd(28)} ${String(Math.round(content.length / 1024)).padStart(4)} KB`);
}

function page(css, sections, extraBody = '') {
  return [
    '<!doctype html>',
    '<html lang="en-GB">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Free Driveway Quote + 10% Off | North Bound Surfacing</title>',
    '<style>html,body{margin:0;padding:0;background:#0F0F0F}</style>',
    `<style>\n${css}</style>`,
    '</head>',
    '<body>',
    extraBody,
    ...sections,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

fs.mkdirSync(OUT, { recursive: true });
for (const old of fs.readdirSync(OUT)) {
  if (FILES[old]) fs.rmSync(path.join(OUT, old));
}

const css = `/* ${FILES['styles.css'][0]} */\n` + read(path.join(SRC, 'styles/main.css'));
write(path.join(OUT, 'styles.css'), css);

const sections = [];
for (const name of fs.readdirSync(path.join(SRC, 'html')).sort()) {
  if (!FILES[name]) throw new Error(`Add ${name} to FILES in build.js`);
  const [label, prefix] = FILES[name];
  const html = `<!-- ${label} -->\n` + (prefix ? prefix + '\n' : '') + inline(read(path.join(SRC, 'html', name)));
  write(path.join(OUT, name), html);
  sections.push(html);
}

write(path.join(ROOT, 'preview.html'), page(css, sections));
// Same page plus a stand-in for the hidden GHL form, used by the tests (not committed).
fs.writeFileSync(path.join(ROOT, 'tests/preview-test.html'),
  page(css, sections, read(path.join(ROOT, 'tests/fixtures/mock-ghl-form.html'))));
