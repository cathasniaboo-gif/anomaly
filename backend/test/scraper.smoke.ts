// Smoke test for parseListing.ts against synthetic fixtures — NOT the real
// FTA/MoF site (unreachable from the environment this was built in; see
// scraper/sources.ts for the calibration procedure needed before trusting
// this against production markup). Run with `npm run smoke:scraper`.

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { parseListing } from '../src/scraper/parseListing';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

function testTableListing() {
  const html = loadFixture('sample-listing-table.html');
  const result = parseListing(html, 'https://tax.gov.ae');

  assert.strictEqual(result.items.length, 4, `expected 4 items, got ${result.items.length}. diagnostics: ${result.diagnostics}`);

  const titles = result.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('virtual asset transfers')), 'missing VATP045 row');
  assert.ok(titles.some((t) => t.includes('substance test examples')), 'missing CTP012 row');

  const withDates = result.items.filter((i) => i.dateIso);
  assert.strictEqual(withDates.length, 4, `expected all 4 rows to have a parsed date, got ${withDates.length}`);

  const byTitle = Object.fromEntries(result.items.map((i) => [i.title, i]));
  const vatp045 = byTitle['VAT treatment of virtual asset transfers'];
  assert.strictEqual(vatp045.dateIso, '2026-05-12', `expected DD/MM/YYYY parsed correctly, got ${vatp045.dateIso}`);
  assert.strictEqual(vatp045.href, 'https://tax.gov.ae/en/clarifications/VATP045.aspx', 'href not resolved to absolute URL');

  const ctp011 = byTitle['Small Business Relief: revenue threshold clarified'];
  assert.strictEqual(ctp011.dateIso, '2026-01-21', `expected "21 January 2026" parsed correctly, got ${ctp011.dateIso}`);

  console.log('✔ table listing fixture: extracted', result.items.length, 'items via selector', JSON.stringify(result.selectorUsed));
}

function testCardListing() {
  const html = loadFixture('sample-listing-cards.html');
  const result = parseListing(html, 'https://mof.gov.ae');

  assert.strictEqual(result.items.length, 3, `expected 3 items, got ${result.items.length}. diagnostics: ${result.diagnostics}`);
  const byTitle = Object.fromEntries(result.items.map((i) => [i.title, i]));

  const d142 = byTitle['Cabinet Decision No. 142 of 2024 on the Domestic Minimum Top-up Tax'];
  assert.ok(d142, 'missing decision 142 row');
  assert.strictEqual(d142.dateIso, '2026-05-12', `expected "May 12, 2026" parsed correctly, got ${d142.dateIso}`);
  assert.strictEqual(d142.href, 'https://mof.gov.ae/en/legislation/decision-142-2024');

  console.log('✔ card listing fixture: extracted', result.items.length, 'items via selector', JSON.stringify(result.selectorUsed));
}

function testEmptyPageDoesNotFalsePositive() {
  const html = '<html><body><nav><a href="/a">A</a><a href="/b">B</a></nav><footer><a href="/c">C</a></footer></body></html>';
  const result = parseListing(html, 'https://example.com');
  assert.strictEqual(result.items.length, 0, 'a page with no listing content should not fabricate items');
  console.log('✔ non-listing page correctly yields zero items');
}

testTableListing();
testCardListing();
testEmptyPageDoesNotFalsePositive();
console.log('\nAll scraper smoke tests passed.');
