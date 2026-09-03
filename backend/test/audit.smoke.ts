// Smoke test for the ledger scrutiny engine and the CSV importer. Runs
// entirely offline against synthetic fixtures/in-memory data — no
// accounting-software connector is exercised here (those need real OAuth
// credentials; see backend/src/audit/connectors/README.md). Run with
// `npm run smoke:audit`.

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { parseCsvLedger } from '../src/audit/importers/csv';
import { runScrutiny } from '../src/audit/scrutiny';
import { LedgerEntry } from '../src/audit/types';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

let idCounter = 0;
function mkEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  idCounter += 1;
  return {
    id: `test-${idCounter}`,
    date: '2026-03-04', // a Wednesday, clear of the weekend-posting rule
    account: `Account ${idCounter}`,
    description: `Transaction ${idCounter}`,
    reference: '',
    debit: 0,
    credit: 0,
    currency: 'AED',
    enteredBy: '',
    ...overrides,
  };
}

function hasFinding(findings: { ruleId: string }[], ruleId: string): boolean {
  return findings.some((f) => f.ruleId === ruleId);
}

// --- CSV import -----------------------------------------------------------

function testCsvImportAliasedColumns() {
  const csv = loadFixture('sample-ledger.csv');
  const { entries, errors } = parseCsvLedger(csv);
  assert.deepStrictEqual(errors, [], `expected no import errors, got ${JSON.stringify(errors)}`);
  assert.strictEqual(entries.length, 4, `expected 4 entries, got ${entries.length}`);

  const first = entries[0];
  assert.strictEqual(first.date, '2026-03-01', `expected dd/mm/yyyy "01/03/2026" parsed to 2026-03-01, got ${first.date}`);
  assert.strictEqual(first.account, 'Cash');
  assert.strictEqual(first.description, 'Sale, cash register', 'quoted embedded comma should survive CSV parsing');
  assert.strictEqual(first.reference, '1001');
  assert.strictEqual(first.debit, 1000);
  assert.strictEqual(first.credit, 0);

  const second = entries[1];
  assert.strictEqual(second.debit, 0);
  assert.strictEqual(second.credit, 1000);

  console.log('✔ CSV import: aliased headers, dd/mm/yyyy dates, quoted commas all parsed correctly');
}

function testCsvSingleAmountColumnWithParentheses() {
  const csv = 'Date,Account,Description,Amount\n2026-03-04,Bank,Deposit,500.00\n2026-03-04,Bank,Refund,(120.00)\n';
  const { entries, errors } = parseCsvLedger(csv);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(entries[0].debit, 500);
  assert.strictEqual(entries[0].credit, 0);
  assert.strictEqual(entries[1].debit, 0);
  assert.strictEqual(entries[1].credit, 120, 'a parenthesised amount should be treated as a credit (negative)');
  console.log('✔ CSV import: single signed Amount column with parentheses-as-negative handled');
}

function testCsvImportSkipsReportTitleBlockAboveHeader() {
  // Found by hand-testing against a real Zoho Books "Detailed General
  // Ledger" export: it prepends a title/basis/date-range block above the
  // actual column-header row, and puts a "#" on headers like "Reference#".
  const csv = loadFixture('sample-ledger-zoho-style.csv');
  const { entries, errors } = parseCsvLedger(csv);
  assert.deepStrictEqual(errors, [], `expected no import errors, got ${JSON.stringify(errors)}`);
  assert.strictEqual(entries.length, 4, `expected 4 entries (title block correctly skipped), got ${entries.length}`);

  const first = entries[0];
  assert.strictEqual(first.date, '2026-08-01', `expected dd/mm/yyyy "01/08/2026" parsed to 2026-08-01, got ${first.date}`);
  assert.strictEqual(first.account, 'Cash');
  assert.strictEqual(first.description, 'Client payment', '"Transaction Details" should map to description');
  assert.strictEqual(first.reference, 'REF-001', '"Reference#" should map to reference despite the trailing #');
  assert.strictEqual(first.debit, 1000);
  assert.strictEqual(first.credit, 0);

  console.log('✔ CSV import: report title block above the header row is correctly skipped');
}

function testCsvImportHandlesSnakeCaseApiStyleHeaders() {
  // Found by hand-testing against a real Zoho Books raw CSV export: unlike
  // the on-screen report (spaced, title-cased headers), the actual
  // downloaded file uses snake_case API field names — "account_name",
  // "reference_number", "net_amount" — with several irrelevant internal-id
  // columns alongside them (e.g. "reference_transaction_id", which must
  // NOT be picked over the real "reference_number" column).
  const csv = loadFixture('sample-ledger-snake-case.csv');
  const { entries, errors, columnsDetected } = parseCsvLedger(csv);
  assert.deepStrictEqual(errors, [], `expected no import errors, got ${JSON.stringify(errors)}`);
  assert.strictEqual(entries.length, 2);

  const first = entries[0];
  assert.strictEqual(first.account, 'Cash', '"account_name" should map to account');
  assert.strictEqual(first.description, 'Client payment', '"transaction_details" should map to description');
  assert.strictEqual(first.reference, 'INV-3001', '"reference_number" should win over "reference_transaction_id"');
  assert.strictEqual(first.debit, 1500);
  assert.strictEqual(first.credit, 0);
  assert.strictEqual(columnsDetected.currency, 16, '"currency_code" should map to currency');

  console.log('✔ CSV import: snake_case API-style headers (real Zoho Books export shape) resolved correctly');
}

function testCsvHeaderMatchingDoesNotFalsePositiveOnSubstrings() {
  // The short aliases "dr"/"cr" (for debit/credit) must not match inside
  // unrelated words like "Description" ("des-cr-iption") or "Currency"
  // ("cur-r-ency" has no "cr" as a whole word either) via the whole-word
  // fallback matching added for report-export header variants.
  const csv = 'Date,Account,Description,Amount\n2026-03-04,Bank,Deposit,500.00\n2026-03-04,Bank,Refund,(120.00)\n';
  const { entries, errors, columnsDetected } = parseCsvLedger(csv);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(columnsDetected.credit, undefined, '"cr" must not match inside "Description"');
  assert.strictEqual(entries[0].debit, 500, 'Amount column should still resolve debit correctly');
  assert.strictEqual(entries[1].credit, 120, 'parenthesised Amount should still resolve as a credit');
  console.log('✔ CSV import: short aliases ("dr"/"cr") do not false-positive inside unrelated header words');
}

function testCsvMissingRequiredColumns() {
  const csv = 'Foo,Bar\n1,2\n';
  const { entries, errors } = parseCsvLedger(csv);
  assert.strictEqual(entries.length, 0);
  assert.ok(errors.length > 0, 'expected import errors when no recognisable columns are present');
  console.log('✔ CSV import: missing required columns reported as errors instead of guessing');
}

// --- Scrutiny rules ---------------------------------------------------------

function testCleanBalancedLedgerHasNoFindings() {
  const entries = [
    mkEntry({ account: 'Cash', description: 'Client payment A', debit: 1372.5 }),
    mkEntry({ account: 'Revenue', description: 'Client payment A', credit: 1372.5 }),
    mkEntry({ account: 'Cash', description: 'Client payment B', debit: 289.1 }),
    mkEntry({ account: 'Revenue', description: 'Client payment B', credit: 289.1 }),
    mkEntry({ account: 'Rent Expense', description: 'March office rent', debit: 4713.2 }),
    mkEntry({ account: 'Cash', description: 'March office rent', credit: 4713.2 }),
  ];
  const { findings, summary } = runScrutiny(entries, { asOf: new Date('2026-06-01') });
  assert.deepStrictEqual(findings, [], `expected zero findings on a clean ledger, got ${JSON.stringify(findings.map((f) => f.ruleId))}`);
  assert.strictEqual(summary.balanced, true);
  console.log('✔ scrutiny: a clean, balanced, varied ledger raises zero findings');
}

function testUnbalancedLedger() {
  const entries = [mkEntry({ debit: 100 }), mkEntry({ credit: 90 })];
  const { findings, summary } = runScrutiny(entries);
  assert.strictEqual(summary.balanced, false);
  assert.ok(hasFinding(findings, 'unbalanced-ledger'));
  console.log('✔ scrutiny: unbalanced ledger detected');
}

function testDuplicateDetection() {
  const entries = [
    mkEntry({ date: '2026-03-04', account: 'Cash', description: 'Consulting fee', debit: 750 }),
    mkEntry({ date: '2026-03-04', account: 'Cash', description: 'Consulting fee', debit: 750 }),
  ];
  const { findings } = runScrutiny(entries);
  const f = findings.find((x) => x.ruleId === 'duplicate-entry');
  assert.ok(f, 'expected a duplicate-entry finding');
  assert.strictEqual(f!.entryIds.length, 2);
  console.log('✔ scrutiny: duplicate postings detected');
}

function testWeekendPosting() {
  const entries = [mkEntry({ date: '2026-03-07', debit: 42 })]; // a Saturday
  const { findings } = runScrutiny(entries);
  assert.ok(hasFinding(findings, 'weekend-posting'));
  console.log('✔ scrutiny: weekend posting detected');
}

function testRoundNumberBias() {
  const entries = Array.from({ length: 12 }, (_, i) => mkEntry({ debit: (i + 1) * 500 }));
  const { findings } = runScrutiny(entries);
  assert.ok(hasFinding(findings, 'round-number-bias'));
  console.log('✔ scrutiny: round-number bias detected');
}

function testBenfordsLawDeviation() {
  // 60 amounts all starting with the digit 9 — a naturally occurring set
  // would have roughly 4.6% of amounts leading with 9, not 100%.
  const entries = Array.from({ length: 60 }, (_, i) => mkEntry({ debit: 900 + i }));
  const { findings } = runScrutiny(entries);
  assert.ok(hasFinding(findings, 'benford-deviation'));
  console.log("✔ scrutiny: Benford's Law deviation detected");
}

function testReferenceSequenceGap() {
  const refs = ['2001', '2002', '2004', '2005', '2006', '2007'];
  const entries = refs.map((r) => mkEntry({ reference: r, debit: 10 }));
  const { findings } = runScrutiny(entries);
  const f = findings.find((x) => x.ruleId === 'reference-sequence-gap');
  assert.ok(f, 'expected a reference-sequence-gap finding');
  assert.ok(f!.description.includes('2003'), `expected the gap to name 2003, got: ${f!.description}`);
  console.log('✔ scrutiny: reference number sequence gap detected');
}

function testStatisticalOutlier() {
  const amounts = [95, 98, 100, 102, 99, 101, 97, 103, 100, 101, 5000];
  const entries = amounts.map((a) => mkEntry({ account: 'Consulting Fees', debit: a }));
  const { findings } = runScrutiny(entries);
  const f = findings.find((x) => x.ruleId === 'statistical-outlier');
  assert.ok(f, 'expected a statistical-outlier finding');
  assert.strictEqual(f!.entryIds.length, 1);
  console.log('✔ scrutiny: statistical outlier within an account detected');
}

function testMissingFields() {
  const entries = [
    mkEntry({ account: '', debit: 10 }),
    mkEntry({ debit: 10, credit: 10 }),
    mkEntry({ date: 'not-a-date', debit: 10 }),
  ];
  const { findings } = runScrutiny(entries);
  const f = findings.find((x) => x.ruleId === 'incomplete-entry');
  assert.ok(f, 'expected an incomplete-entry finding');
  assert.strictEqual(f!.entryIds.length, 3);
  console.log('✔ scrutiny: incomplete/invalid entries detected');
}

function testPossibleStructuring() {
  const entries = [9200, 9400, 9600, 9800].map((a) => mkEntry({ debit: a }));
  const { findings } = runScrutiny(entries, { approvalThreshold: 10000 });
  assert.ok(hasFinding(findings, 'possible-structuring'));
  console.log('✔ scrutiny: possible structuring just under the approval threshold detected');
}

function testFutureDatedEntry() {
  const entries = [mkEntry({ date: '2026-12-25', debit: 10 })];
  const { findings } = runScrutiny(entries, { asOf: new Date('2026-06-01') });
  assert.ok(hasFinding(findings, 'future-dated-entry'));
  console.log('✔ scrutiny: future-dated entry detected');
}

testCsvImportAliasedColumns();
testCsvSingleAmountColumnWithParentheses();
testCsvImportSkipsReportTitleBlockAboveHeader();
testCsvImportHandlesSnakeCaseApiStyleHeaders();
testCsvHeaderMatchingDoesNotFalsePositiveOnSubstrings();
testCsvMissingRequiredColumns();
testCleanBalancedLedgerHasNoFindings();
testUnbalancedLedger();
testDuplicateDetection();
testWeekendPosting();
testRoundNumberBias();
testBenfordsLawDeviation();
testReferenceSequenceGap();
testStatisticalOutlier();
testMissingFields();
testPossibleStructuring();
testFutureDatedEntry();
console.log('\nAll audit smoke tests passed.');
