import crypto from 'crypto';
import { Finding, FindingSeverity, LedgerEntry, ScrutinySummary } from './types';

// The rule engine: a set of small, independent, pure functions over
// LedgerEntry[] that each look for one specific anomaly pattern an auditor
// would flag during ledger scrutiny. `runScrutiny` runs all of them and
// folds the results into one report. Every rule is deterministic and
// side-effect free so it can be unit-tested against a fixed fixture ledger
// (see backend/test/audit.smoke.ts) without any external system.

export interface ScrutinyOptions {
  // Reference date scrutiny runs "as of" — defaults to now. Entries dated
  // after this are flagged as future-dated. Exposed mainly for tests.
  asOf?: Date;
  // Amounts at/just below this are checked for possible structuring
  // (splitting one transaction into several to dodge an approval limit).
  approvalThreshold?: number;
  currencyTolerance?: number; // rounding slack for the balance check
}

const DEFAULTS: Required<ScrutinyOptions> = {
  asOf: new Date(),
  approvalThreshold: 10000,
  currencyTolerance: 0.01,
};

function newFinding(
  ruleId: string,
  title: string,
  severity: FindingSeverity,
  description: string,
  entryIds: string[]
): Finding {
  return { id: `fnd-${crypto.randomUUID()}`, ruleId, title, severity, description, entryIds };
}

function amountOf(e: LedgerEntry): number {
  return e.debit > 0 ? e.debit : e.credit;
}

// --- Individual rules -------------------------------------------------

function checkBalance(entries: LedgerEntry[], tolerance: number): Finding[] {
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const imbalance = totalDebit - totalCredit;
  if (Math.abs(imbalance) <= tolerance) return [];
  return [
    newFinding(
      'unbalanced-ledger',
      'Ledger does not balance',
      'high',
      `Total debits (${totalDebit.toFixed(2)}) and total credits (${totalCredit.toFixed(2)}) differ by ` +
        `${imbalance.toFixed(2)}. A correctly posted ledger should sum to zero across all entries.`,
      []
    ),
  ];
}

function checkDuplicates(entries: LedgerEntry[]): Finding[] {
  const groups = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const key = [e.date, e.account, e.description.trim().toLowerCase(), e.debit.toFixed(2), e.credit.toFixed(2)].join('|');
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const findings: Finding[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    findings.push(
      newFinding(
        'duplicate-entry',
        'Possible duplicate posting',
        'high',
        `${group.length} entries on ${group[0].date} share the same account, description and amount ` +
          `(${amountOf(group[0]).toFixed(2)}). Could be a genuine repeat, or the same transaction posted twice.`,
        group.map((e) => e.id)
      )
    );
  }
  return findings;
}

function checkWeekendPostings(entries: LedgerEntry[]): Finding[] {
  const flagged = entries.filter((e) => {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    const day = d.getUTCDay();
    return day === 0 || day === 6;
  });
  if (!flagged.length) return [];
  return [
    newFinding(
      'weekend-posting',
      'Entries posted on a weekend',
      'low',
      `${flagged.length} entries were dated on a Saturday or Sunday. Not necessarily wrong, but worth a ` +
        `second look if the business doesn't normally trade or post journals on weekends.`,
      flagged.map((e) => e.id)
    ),
  ];
}

function checkRoundAmounts(entries: LedgerEntry[]): Finding[] {
  const withAmount = entries.filter((e) => amountOf(e) > 0);
  if (withAmount.length < 10) return [];
  const round = withAmount.filter((e) => amountOf(e) % 500 === 0);
  const ratio = round.length / withAmount.length;
  if (ratio < 0.3) return [];
  return [
    newFinding(
      'round-number-bias',
      'Unusually many round-number amounts',
      'medium',
      `${round.length} of ${withAmount.length} entries (${(ratio * 100).toFixed(0)}%) are exact multiples of 500. ` +
        `Genuine transaction amounts are rarely this round this often — can indicate estimated, fabricated or ` +
        `manually adjusted figures.`,
      round.map((e) => e.id)
    ),
  ];
}

// Benford's Law: in naturally occurring transaction amounts the leading
// digit 1 appears ~30% of the time, 2 ~17.6%, ... 9 ~4.6%. A ledger padded
// with fabricated or manually adjusted figures tends to deviate from this.
// We use a chi-square goodness-of-fit test against the expected distribution.
const BENFORD_EXPECTED = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => Math.log10(1 + 1 / d));
// Chi-square critical value for 8 degrees of freedom at p = 0.01.
const CHI_SQUARE_CRITICAL_8DF_P01 = 20.09;

function checkBenfordsLaw(entries: LedgerEntry[]): Finding[] {
  const amounts = entries.map(amountOf).filter((a) => a > 0);
  if (amounts.length < 50) return []; // too few observations for the test to mean anything
  const counts = new Array(9).fill(0);
  for (const a of amounts) {
    const leading = Number(a.toExponential().charAt(0));
    if (leading >= 1 && leading <= 9) counts[leading - 1] += 1;
  }
  const n = amounts.length;
  let chiSquare = 0;
  for (let i = 0; i < 9; i++) {
    const expected = BENFORD_EXPECTED[i] * n;
    chiSquare += (counts[i] - expected) ** 2 / expected;
  }
  if (chiSquare <= CHI_SQUARE_CRITICAL_8DF_P01) return [];
  return [
    newFinding(
      "benford-deviation",
      "Amounts deviate from Benford's Law",
      'medium',
      `The distribution of leading digits across ${n} amounts departs from the pattern naturally occurring ` +
        `transaction amounts follow (chi-square = ${chiSquare.toFixed(1)}, threshold ${CHI_SQUARE_CRITICAL_8DF_P01}). ` +
        `A statistical signal only, not proof — but a common first-pass fraud/estimation screen.`,
      []
    ),
  ];
}

function checkSequenceGaps(entries: LedgerEntry[]): Finding[] {
  const numbered = entries
    .map((e) => ({ e, n: Number(e.reference) }))
    .filter((x) => x.e.reference && Number.isInteger(x.n));
  if (numbered.length < 5) return [];
  numbered.sort((a, b) => a.n - b.n);
  const missing: number[] = [];
  for (let i = 1; i < numbered.length; i++) {
    const gap = numbered[i].n - numbered[i - 1].n;
    if (gap > 1 && gap <= 1000) {
      for (let m = numbered[i - 1].n + 1; m < numbered[i].n; m++) missing.push(m);
    }
  }
  if (!missing.length) return [];
  const shown = missing.slice(0, 20).join(', ') + (missing.length > 20 ? ', …' : '');
  return [
    newFinding(
      'reference-sequence-gap',
      'Gaps in reference/voucher numbering',
      'medium',
      `${missing.length} reference numbers are missing from an otherwise sequential range: ${shown}. ` +
        `Could be void/cancelled documents, or postings that never made it into this ledger.`,
      []
    ),
  ];
}

function checkOutliers(entries: LedgerEntry[]): Finding[] {
  const byAccount = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (amountOf(e) <= 0) continue;
    const list = byAccount.get(e.account) ?? [];
    list.push(e);
    byAccount.set(e.account, list);
  }
  const findings: Finding[] = [];
  for (const [account, list] of byAccount) {
    if (list.length < 5) continue;
    const amounts = list.map(amountOf);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) continue;
    const outliers = list.filter((e) => Math.abs(amountOf(e) - mean) / stddev > 3);
    if (!outliers.length) continue;
    findings.push(
      newFinding(
        'statistical-outlier',
        `Unusual amount(s) in "${account}"`,
        'medium',
        `${outliers.length} entries in "${account}" sit more than 3 standard deviations from that account's ` +
          `average amount (mean ${mean.toFixed(2)}, stddev ${stddev.toFixed(2)}).`,
        outliers.map((e) => e.id)
      )
    );
  }
  return findings;
}

function checkMissingFields(entries: LedgerEntry[]): Finding[] {
  const bad = entries.filter((e) => {
    const noAccount = !e.account.trim();
    const noDescription = !e.description.trim();
    const noAmount = e.debit === 0 && e.credit === 0;
    const bothSides = e.debit > 0 && e.credit > 0;
    const badDate = isNaN(new Date(e.date).getTime());
    return noAccount || noDescription || noAmount || bothSides || badDate;
  });
  if (!bad.length) return [];
  return [
    newFinding(
      'incomplete-entry',
      'Entries with missing or invalid fields',
      'high',
      `${bad.length} entries are missing an account, description or amount, have both a debit and a credit ` +
        `on the same line, or carry an unparseable date. These should be corrected before relying on this ledger.`,
      bad.map((e) => e.id)
    ),
  ];
}

function checkStructuring(entries: LedgerEntry[], threshold: number): Finding[] {
  const lower = threshold * 0.9;
  const near = entries.filter((e) => {
    const a = amountOf(e);
    return a >= lower && a < threshold;
  });
  if (near.length < 3) return [];
  return [
    newFinding(
      'possible-structuring',
      'Multiple entries just under the approval threshold',
      'high',
      `${near.length} entries fall between ${lower.toFixed(2)} and ${threshold.toFixed(2)} — just under the ` +
        `${threshold.toFixed(2)} threshold. Could indicate transactions deliberately split to avoid an approval ` +
        `or reporting requirement ("structuring").`,
      near.map((e) => e.id)
    ),
  ];
}

function checkFutureDated(entries: LedgerEntry[], asOf: Date): Finding[] {
  const future = entries.filter((e) => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d.getTime() > asOf.getTime();
  });
  if (!future.length) return [];
  return [
    newFinding(
      'future-dated-entry',
      'Entries dated in the future',
      'medium',
      `${future.length} entries are dated after ${asOf.toISOString().slice(0, 10)}. Legitimate for planned/recurring ` +
        `postings, but worth confirming they weren't meant for the current period.`,
      future.map((e) => e.id)
    ),
  ];
}

// Static metadata for every rule above, independent of any particular
// ledger — the UI uses this to explain what each rule checks for before
// (or without) any findings existing yet.
export const RULES: { id: string; title: string; defaultSeverity: FindingSeverity; description: string }[] = [
  { id: 'unbalanced-ledger', title: 'Ledger balance', defaultSeverity: 'high', description: 'Total debits must equal total credits.' },
  { id: 'duplicate-entry', title: 'Duplicate postings', defaultSeverity: 'high', description: 'Same date, account, description and amount posted more than once.' },
  { id: 'incomplete-entry', title: 'Incomplete entries', defaultSeverity: 'high', description: 'Missing account/description/amount, both debit and credit set, or an unparseable date.' },
  { id: 'possible-structuring', title: 'Possible structuring', defaultSeverity: 'high', description: 'Several entries clustered just under an approval threshold.' },
  { id: 'round-number-bias', title: 'Round-number bias', defaultSeverity: 'medium', description: 'An unusually high share of amounts are exact round numbers.' },
  { id: 'benford-deviation', title: "Benford's Law deviation", defaultSeverity: 'medium', description: "Leading-digit distribution of amounts departs from Benford's Law." },
  { id: 'reference-sequence-gap', title: 'Reference number gaps', defaultSeverity: 'medium', description: 'Gaps in an otherwise sequential voucher/reference numbering.' },
  { id: 'statistical-outlier', title: 'Statistical outliers', defaultSeverity: 'medium', description: 'Amounts more than 3 standard deviations from their account average.' },
  { id: 'future-dated-entry', title: 'Future-dated entries', defaultSeverity: 'medium', description: 'Entries dated after the scrutiny run date.' },
  { id: 'weekend-posting', title: 'Weekend postings', defaultSeverity: 'low', description: 'Entries dated on a Saturday or Sunday.' },
];

// --- Runner -------------------------------------------------------------

export function runScrutiny(entries: LedgerEntry[], options: ScrutinyOptions = {}): { findings: Finding[]; summary: ScrutinySummary } {
  const opts = { ...DEFAULTS, ...options };

  const findings = [
    ...checkBalance(entries, opts.currencyTolerance),
    ...checkDuplicates(entries),
    ...checkWeekendPostings(entries),
    ...checkRoundAmounts(entries),
    ...checkBenfordsLaw(entries),
    ...checkSequenceGaps(entries),
    ...checkOutliers(entries),
    ...checkMissingFields(entries),
    ...checkStructuring(entries, opts.approvalThreshold),
    ...checkFutureDated(entries, opts.asOf),
  ];

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const findingCounts: Record<FindingSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) findingCounts[f.severity] += 1;

  const summary: ScrutinySummary = {
    entryCount: entries.length,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) <= opts.currencyTolerance,
    imbalance: totalDebit - totalCredit,
    findingCounts,
  };

  return { findings, summary };
}
