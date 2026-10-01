#!/usr/bin/env node
/*
 * Browser checks against the built page (run "node build.js" first; "npm test" does both).
 *
 *   1. Every image renders.
 *   2. The quiz validates bad input.
 *   3. A full quiz run fills and submits the (mock) hidden GHL form with the right values.
 *   4. The page's styles survive hostile global CSS like GHL themes inject.
 *   5. Layout follows each section's width, not the browser's (GHL's mobile preview).
 *
 * Usage: npm test   (needs the playwright package: npm install)
 */
'use strict';

const assert = require('assert/strict');
const path = require('path');
const { chromium } = require('playwright');

const url = (file) => 'file://' + path.join(__dirname, '..', file);
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };

async function run(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}\n  ${err.message}`); process.exitCode = 1; }
}

(async () => {
  const browser = await chromium.launch();
  const newPage = async () => (await browser.newContext(MOBILE)).newPage();

  await run('every image renders', async () => {
    const page = await newPage();
    await page.goto(url('preview.html'));
    for (const img of await page.$$('img')) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, img);
    }
  });

  await run('quiz rejects a bad postcode, phone and email', async () => {
    const page = await newPage();
    await page.goto(url('tests/preview-test.html'));
    await page.click('[data-value="Resin"]');
    await page.click('.nbs-step[data-step="1"] [data-next]');
    await page.click('[data-value="Not sure"]');
    await page.click('[data-value="3-6 months"]');
    await page.click('[data-value="£5,000 - £10,000"]');
    await page.fill('#nbs-postcode', 'NOTAPOSTCODE');
    await page.click('.nbs-step[data-step="5"] [data-next]');
    assert.ok(await page.isVisible('.nbs-step[data-step="5"] .nbs-err'), 'postcode error not shown');
    await page.fill('#nbs-postcode', 'SK8 1AA');
    await page.click('.nbs-step[data-step="5"] [data-next]');
    await page.fill('#nbs-name', 'A');
    await page.fill('#nbs-phone', '12345');
    await page.fill('#nbs-email', 'not-an-email');
    await page.click('#nbs-submit');
    assert.equal(await page.locator('.nbs-field.has-error').count(), 3, 'expected 3 field errors');
    assert.equal(await page.evaluate(() => window.__mockGhlSubmission), undefined, 'form submitted despite errors');
  });

  await run('quiz fills and submits the hidden GHL form', async () => {
    const page = await newPage();
    await page.goto(url('tests/preview-test.html'));
    assert.ok(await page.$eval('#mock-ghl-form', (f) => f.getBoundingClientRect().left < -1000), 'GHL form not hidden');
    await page.click('[data-value="Resin"]');
    await page.click('[data-value="Paved Edging"]');
    await page.click('.nbs-step[data-step="1"] [data-next]');
    await page.click('[data-value="Medium (3-4 cars)"]');
    await page.click('[data-value="Within 1-3 months"]');
    await page.click('[data-value="£10,000 - £20,000"]');
    await page.fill('#nbs-postcode', 'm337ab');
    await page.keyboard.press('Enter');
    await page.fill('#nbs-name', 'Test Person');
    await page.fill('#nbs-phone', '07123 456789');
    await page.fill('#nbs-email', 'test@example.com');
    await page.click('#nbs-submit');
    await page.waitForFunction(() => window.__mockGhlSubmission);
    const got = await page.evaluate(() => window.__mockGhlSubmission);
    assert.deepEqual(got, {
      xK2a9QbLs1: 'M33 7AB',                       // Where are you based?
      Pq81mZr0Tn: 'Resin, Paved Edging',           // What are you looking to have installed
      aB7cD3eF9g: 'Medium (3-4 cars)',             // Roughly how big is your area?
      Hh4Jk2Lm8N: 'Within 1-3 months',             // When would you like the work done?
      Zz5Yy6Xx7W: '£10,000 - £20,000',             // What is your budget?
      full_name: 'Test Person',
      phone: '+447123456789',
      email: 'test@example.com',
      terms_and_conditions: 'on',
    });
    await page.waitForSelector('.nbs-step[data-step="done"].is-active');
  });

  await run('styles survive hostile GHL-style global CSS', async () => {
    const page = await newPage();
    await page.goto(url('preview.html'));
    const style = (sel) => page.$eval(sel, (el) => {
      const s = getComputedStyle(el);
      return [s.color, s.fontFamily, s.textTransform, s.marginTop, s.backgroundColor, s.borderTopWidth].join('|');
    });
    const targets = ['.nbs-hero h1', '.nbs-q-hint', '.nbs-sub', '.nbs-btn', '.nbs-tile', '.nbs-back', '.nbs-ba figcaption', '.nbs-ba img', '.nbs-review p'];
    const before = await Promise.all(targets.map(style));
    await page.addStyleTag({ content: `
      body { text-align: center; font-family: serif; }
      h1, h2, h3, p, figcaption, span, label { color: red; margin: 30px; font-family: serif; text-transform: uppercase; }
      button { background: blue; color: yellow; font-family: serif; }
      a { color: green; } img { border: 5px solid lime; }` });
    const after = await Promise.all(targets.map(style));
    targets.forEach((t, i) => assert.equal(after[i], before[i], `${t} changed`));
  });

  await run('narrow section on a wide screen uses the mobile layout (GHL mobile preview)', async () => {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
    await page.goto(url('preview.html'));
    const layout = () => page.evaluate(() => ({
      gallery: getComputedStyle(document.querySelector('.nbs-gallery')).display,
      wrap: getComputedStyle(document.querySelector('.nbs-gallery')).flexWrap,
      reviews: getComputedStyle(document.querySelector('.nbs-review-list')).display,
      h1: parseFloat(getComputedStyle(document.querySelector('.nbs-hero h1')).fontSize),
      card: document.querySelector('.nbs-ba').getBoundingClientRect().width,
    }));
    const wide = await layout();
    const rows = await page.evaluate(() => {
      const g = document.querySelector('.nbs-gallery').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.nbs-ba')].map((c) => c.getBoundingClientRect());
      const lastTop = cards[cards.length - 1].top;
      const last = cards.filter((c) => Math.abs(c.top - lastTop) < 2);
      const mid = (Math.min(...last.map((c) => c.left)) + Math.max(...last.map((c) => c.right))) / 2;
      return { perRow: cards.filter((c) => Math.abs(c.top - cards[0].top) < 2).length, offCentre: Math.abs(mid - (g.left + g.right) / 2) };
    });
    assert.equal(rows.perRow, 3, 'desktop results should show 3 per row');
    assert.ok(rows.offCentre < 2, `last row of results is not centred (${rows.offCentre}px off)`);
    assert.equal(wide.gallery, 'flex', 'desktop results should be a flex row');
    await page.addStyleTag({ content: 'body { width: 390px; margin: 0 auto; overflow-x: hidden; }' });
    const narrow = await layout();
    assert.equal(wide.wrap, 'wrap', 'desktop results should wrap into rows');
    assert.equal(narrow.wrap, 'nowrap', 'narrow section should use the swipe row');
    assert.equal(narrow.reviews, 'flex', 'narrow section should use the review swipe row');
    assert.ok(narrow.h1 <= 32, `headline too big in a narrow section: ${narrow.h1}px`);
    assert.ok(narrow.card >= 300, `result photos too small in a narrow section: ${narrow.card}px wide`);
  });

  await run('quiz starts near the top on a phone', async () => {
    const page = await newPage();
    await page.goto(url('preview.html'));
    const top = await page.$eval('.nbs-quiz .nbs-tile', (el) => el.getBoundingClientRect().top);
    assert.ok(top < 844, `first quiz answer is below the fold (${Math.round(top)}px)`);
  });

  await browser.close();
})();
