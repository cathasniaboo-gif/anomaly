import crypto from 'crypto';
import { LedgerEntry } from '../types';

// A small RFC4180-ish CSV parser (quoted fields, embedded commas, escaped
// "" quotes, \r\n or \n line endings). Good enough for ledger exports from
// accounting software and spreadsheets without pulling in a dependency.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      // swallow; \n (if present) closes the row
    } else {
      field += c;
    }
  }
  if (field.length || row.length) pushRow();
  return rows.filter((r) => r.some((f) => f.trim().length));
}

type Column = 'date' | 'account' | 'description' | 'reference' | 'debit' | 'credit' | 'amount' | 'type' | 'currency' | 'enteredBy';

const HEADER_ALIASES: Record<Column, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'posting date', 'entry date'],
  account: ['account', 'account name', 'gl account', 'ledger account', 'account code'],
  description: ['description', 'narration', 'memo', 'details', 'particulars', 'transaction details'],
  reference: ['reference', 'ref', 'ref no', 'ref number', 'voucher', 'voucher no', 'cheque no', 'doc no', 'document number', 'invoice no'],
  debit: ['debit', 'dr', 'debit amount'],
  credit: ['credit', 'cr', 'credit amount'],
  amount: ['amount', 'value', 'net amount'],
  type: ['type', 'dr/cr', 'debit/credit', 'entry type'],
  currency: ['currency', 'ccy'],
  enteredBy: ['entered by', 'user', 'created by', 'posted by', 'raised by'],
};

// Strips trailing punctuation report tools commonly tack onto headers
// ("Reference#", "Debit ($)") so it still matches a plain-text alias.
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[#:.]/g, '').replace(/\s+/g, ' ').trim();
}

function detectColumns(header: string[]): Partial<Record<Column, number>> {
  const map: Partial<Record<Column, number>> = {};
  const normalized = header.map(normalizeHeader);
  for (const col of Object.keys(HEADER_ALIASES) as Column[]) {
    // Exact match first ("account" == "account"); fall back to a
    // whole-word match ("account" found inside "customer account no") so
    // a header the export tool phrased slightly differently still
    // resolves. Word-boundary padding matters here — a raw substring
    // check would match the alias "cr" inside "des-cr-iption".
    let idx = normalized.findIndex((h) => HEADER_ALIASES[col].includes(h));
    if (idx < 0) {
      idx = normalized.findIndex((h) => h.length > 0 && HEADER_ALIASES[col].some((alias) => ` ${h} `.includes(` ${alias} `)));
    }
    if (idx >= 0) map[col] = idx;
  }
  return map;
}

// A column-header score for a candidate row: how many of the fields this
// app actually needs (date, account, and either debit/credit or amount)
// it would resolve to. Used to find the real header row when a report
// export prepends a title block above it (see findHeaderRow below).
function headerScore(cols: Partial<Record<Column, number>>): number {
  let score = 0;
  if (cols.date !== undefined) score += 1;
  if (cols.account !== undefined) score += 1;
  if (cols.debit !== undefined || cols.credit !== undefined || cols.amount !== undefined) score += 1;
  if (cols.description !== undefined) score += 0.5;
  if (cols.reference !== undefined) score += 0.5;
  return score;
}

// Many report exports (Zoho Books, and others) prepend a title block —
// report name, basis, date range — above the actual column-header row.
// Rather than assume row 0 is always the header, scan the first several
// rows and use whichever one actually looks like a ledger header.
const MAX_PREAMBLE_ROWS_TO_SCAN = 15;

function findHeaderRow(rows: string[][]): { index: number; cols: Partial<Record<Column, number>> } {
  let best = { index: 0, cols: detectColumns(rows[0]), score: 0 };
  best.score = headerScore(best.cols);
  const limit = Math.min(rows.length - 1, MAX_PREAMBLE_ROWS_TO_SCAN);
  for (let i = 1; i < limit; i++) {
    const cols = detectColumns(rows[i]);
    const score = headerScore(cols);
    if (score > best.score) best = { index: i, cols, score };
  }
  return best;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,$\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // dd/mm/yyyy or dd-mm-yyyy — the common non-ISO format in ledger exports.
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return trimmed; // leave as-is; checkMissingFields will flag it as invalid
}

export interface CsvImportResult {
  entries: LedgerEntry[];
  errors: string[];
  columnsDetected: Partial<Record<Column, number>>;
}

export function parseCsvLedger(csvText: string, defaultCurrency = 'AED'): CsvImportResult {
  const rows = parseCsvRows(csvText);
  const errors: string[] = [];
  if (rows.length < 2) {
    return { entries: [], errors: ['CSV needs a header row plus at least one data row.'], columnsDetected: {} };
  }
  const { index: headerIndex, cols } = findHeaderRow(rows);
  const header = rows[headerIndex];
  const dataRows = rows.slice(headerIndex + 1);

  if (cols.date === undefined) errors.push('Could not find a date column (expected one of: ' + HEADER_ALIASES.date.join(', ') + ').');
  if (cols.account === undefined) errors.push('Could not find an account column (expected one of: ' + HEADER_ALIASES.account.join(', ') + ').');
  const hasDebitCredit = cols.debit !== undefined || cols.credit !== undefined;
  const hasAmount = cols.amount !== undefined;
  if (!hasDebitCredit && !hasAmount) {
    errors.push('Could not find debit/credit columns or a single amount column.');
  }
  if (errors.length) return { entries: [], errors, columnsDetected: cols };

  const entries: LedgerEntry[] = dataRows.map((row, i) => {
    const get = (col: Column) => (cols[col] !== undefined ? (row[cols[col]!] ?? '').trim() : '');

    let debit = 0;
    let credit = 0;
    if (hasDebitCredit) {
      debit = parseAmount(get('debit'));
      credit = parseAmount(get('credit'));
    } else {
      const amount = parseAmount(get('amount'));
      const typeField = get('type').toLowerCase();
      const isCredit = typeField.startsWith('cr') || amount < 0;
      if (isCredit) credit = Math.abs(amount);
      else debit = Math.abs(amount);
    }

    const raw: Record<string, string> = {};
    header.forEach((h, idx) => (raw[h] = row[idx] ?? ''));

    return {
      id: `ent-${crypto.randomUUID()}`,
      date: parseDate(get('date')),
      account: get('account'),
      description: get('description'),
      reference: get('reference'),
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      currency: get('currency') || defaultCurrency,
      enteredBy: get('enteredBy'),
      raw,
    };
  });

  return { entries, errors: [], columnsDetected: cols };
}
