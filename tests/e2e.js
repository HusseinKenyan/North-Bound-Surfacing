#!/usr/bin/env node
/*
 * End-to-end checks against the built page (run "node build.js" first).
 *
 *   1. Every image renders.
 *   2. The quiz validates bad input.
 *   3. A full quiz run fills and submits the (mock) hidden GHL form with the right values.
 *   4. The page's styles survive hostile global CSS like GHL themes inject.
 *
 * Usage: npm test   (needs the playwright package: npm install)
 */
'use strict';

const assert = require('assert/strict');
const path = require('path');
const { chromium } = require('playwright');

const url = (file) => 'file://' + path.join(__dirname, '..', 'dist', file);
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
    await page.goto(url('landing-page.html'));
    for (const img of await page.$$('img')) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, img);
    }
  });

  await run('quiz rejects a bad postcode, phone and email', async () => {
    const page = await newPage();
    await page.goto(url('preview.html'));
    await page.click('[data-value="Resin"]');
    await page.click('.nbs-step[data-step="1"] [data-next]');
    await page.click('[data-value="Not sure"]');
    await page.click('[data-value="3-6 months"]');
    await page.fill('#nbs-postcode', 'NOTAPOSTCODE');
    await page.click('.nbs-step[data-step="4"] [data-next]');
    assert.ok(await page.isVisible('.nbs-step[data-step="4"] .nbs-err'), 'postcode error not shown');
    await page.fill('#nbs-postcode', 'SK8 1AA');
    await page.click('.nbs-step[data-step="4"] [data-next]');
    await page.fill('#nbs-name', 'A');
    await page.fill('#nbs-phone', '12345');
    await page.fill('#nbs-email', 'not-an-email');
    await page.click('#nbs-submit');
    assert.equal(await page.locator('.nbs-field.has-error').count(), 3, 'expected 3 field errors');
    assert.equal(await page.evaluate(() => window.__mockGhlSubmission), undefined, 'form submitted despite errors');
  });

  await run('quiz fills and submits the hidden GHL form', async () => {
    const page = await newPage();
    await page.goto(url('preview.html'));
    assert.ok(await page.$eval('#mock-ghl-form', (f) => f.getBoundingClientRect().left < -1000), 'GHL form not hidden');
    await page.click('[data-value="Resin"]');
    await page.click('[data-value="Paved Edging"]');
    await page.click('.nbs-step[data-step="1"] [data-next]');
    await page.click('[data-value="Medium (3-4 cars)"]');
    await page.click('[data-value="Within 1-3 months"]');
    await page.fill('#nbs-postcode', 'm337ab');
    await page.click('.nbs-step[data-step="4"] [data-next]');
    await page.fill('#nbs-name', 'Test Person');
    await page.fill('#nbs-phone', '07123 456789');
    await page.fill('#nbs-email', 'test@example.com');
    await page.click('#nbs-submit');
    await page.waitForFunction(() => window.__mockGhlSubmission);
    const got = await page.evaluate(() => window.__mockGhlSubmission);
    assert.deepEqual(got, {
      full_name: 'Test Person',
      phone: '+447123456789',
      email: 'test@example.com',
      postal_code: 'M33 7AB',
      surface_type: ['Resin', 'Paved Edging'],
      driveway_size: 'Medium (3-4 cars)',
      project_timeframe: 'Within 1-3 months',
      quiz_answers: 'Services: Resin, Paved Edging\nArea size: Medium (3-4 cars)\nTimeframe: Within 1-3 months\nPostcode: M33 7AB\nOffer: 10% OFF (limited time)',
      terms_and_conditions: 'on',
    });
    await page.waitForSelector('.nbs-step[data-step="done"].is-active');
  });

  await run('styles survive hostile GHL-style global CSS', async () => {
    const page = await newPage();
    await page.goto(url('landing-page.html'));
    const style = (sel) => page.$eval(sel, (el) => {
      const s = getComputedStyle(el);
      return [s.color, s.fontFamily, s.textTransform, s.marginTop, s.backgroundColor, s.borderTopWidth].join('|');
    });
    const targets = ['.nbs-hero h1', '.nbs-q-hint', '.nbs-sub', '.nbs-btn', '.nbs-tile', '.nbs-back', '.nbs-ba figcaption', '.nbs-hero-media img', '.nbs-review p'];
    const before = await Promise.all(targets.map(style));
    await page.addStyleTag({ content: `
      body { text-align: center; font-family: serif; }
      h1, h2, h3, p, figcaption, span, label { color: red; margin: 30px; font-family: serif; text-transform: uppercase; }
      button { background: blue; color: yellow; font-family: serif; }
      a { color: green; } img { border: 5px solid lime; }` });
    const after = await Promise.all(targets.map(style));
    targets.forEach((t, i) => assert.equal(after[i], before[i], `${t} changed`));
  });

  await browser.close();
})();
