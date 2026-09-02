import { RegUpdate } from '../types';

// Seed feed of regulatory updates. Each entry mirrors a real legislative
// instrument already covered in the knowledge base, rewritten as a
// notification-style card with a plain-English summary.
//
// This is a static seed, not a live feed — see src/services/updatesFeed.ts
// and README.md ("Wiring a real FTA feed") for how to replace it with a
// scheduled fetch against an actual FTA/MoF publications source.
export const UPDATES: RegUpdate[] = [
  {
    id: 'upd-2026-08',
    authority: 'FTA',
    kind: 'Decision',
    title: 'Unified penalty framework takes effect for Corporate Tax, VAT and Excise Tax',
    date: '2026-04-14',
    summary: 'One penalty table now applies across all three federal taxes — late filing, late registration and late payment are penalised the same way regardless of which tax is involved.',
    detail: 'Cabinet Decision No. 129 of 2025 replaces the separate penalty schedules that used to apply to Corporate Tax, VAT and Excise Tax with a single unified framework, effective 14 April 2026. In practice this means: an AED 10,000 penalty for a late return is now consistent across taxes, late-payment interest of roughly 1% per month applies uniformly, and registration penalties are charged even where the eventual tax liability turns out to be zero. Businesses that file multiple tax types no longer need to track different penalty logic for each.',
    relatedCats: ['Corporate Tax', 'VAT & Tax Procedures'],
    sourceLabel: 'Cabinet Decision No. 129 of 2025',
    sourceUrl: 'https://tax.gov.ae',
  },
  {
    id: 'upd-2026-07',
    authority: 'MoF',
    kind: 'Decision',
    title: 'Qualifying Activities list refreshed for Free Zone Persons',
    date: '2025-12-02',
    summary: 'The list of activities that can earn the 0% QFZP rate has been updated and applied retroactively to 1 June 2023 — worth rechecking if your free zone company\'s activity was previously excluded.',
    detail: 'Ministerial Decision No. 229 of 2025 revises the Qualifying Activities list used to test Qualifying Free Zone Person (QFZP) status. The refreshed list still centres on manufacturing, holding of shares and securities, regulated fund and wealth management, headquarter services to related parties, treasury and financing to related parties, aircraft financing/leasing, and qualifying distribution from a Designated Zone — but definitions and boundaries were clarified. Because the change applies retroactively to 1 June 2023, free zone groups should re-run their QFZP analysis for open tax periods rather than assuming last year\'s classification still holds.',
    relatedCats: ['Free Zone vs Mainland'],
    sourceLabel: 'Ministerial Decision No. 229 of 2025',
    sourceUrl: 'https://mof.gov.ae',
  },
  {
    id: 'upd-2026-06',
    authority: 'FTA',
    kind: 'Notification',
    title: 'VAT law amendments in force from 1 January 2026',
    date: '2026-01-01',
    summary: 'A refreshed VAT law adjusts registration, supply and compliance mechanics. If your business relies on an older FTA public clarification, check whether it still holds under the amended law.',
    detail: 'Federal Decree-Law No. 16 of 2025 amends the original 2017 VAT law. The changes are mechanical rather than a rate change — the standard rate stays at 5% — but they touch registration triggers, how certain supplies are characterised, and compliance timelines. Any public clarification issued under the old law should be re-checked against the amended provisions before being relied on for a live transaction.',
    relatedCats: ['VAT & Tax Procedures'],
    sourceLabel: 'Federal Decree-Law No. 16 of 2025',
    sourceUrl: 'https://tax.gov.ae',
  },
  {
    id: 'upd-2026-05',
    authority: 'MoF',
    kind: 'Guideline',
    title: 'R&D tax credit and High-Value Employment incentive detailed',
    date: '2026-02-10',
    summary: 'New incentives can offset Corporate Tax and, for large groups, interact with the 15% DMTT top-up calculation — worth modelling together rather than separately.',
    detail: 'Ministerial Decision No. 24 of 2026 sets out mechanics for a non-refundable R&D tax credit (up to 50% of eligible expenditure, capped at AED 5 million) and a refundable High-Value Employment incentive. For groups in scope of the Domestic Minimum Top-up Tax, both incentives interact with the Pillar Two effective-tax-rate calculation, so they should be modelled alongside DMTT exposure rather than in isolation.',
    relatedCats: ['Global Minimum Tax', 'Corporate Tax'],
    sourceLabel: 'Ministerial Decision No. 24 of 2026',
    sourceUrl: 'https://mof.gov.ae',
  },
  {
    id: 'upd-2026-04',
    authority: 'FTA',
    kind: 'Public Clarification',
    title: 'Tax Procedures Law amendment standardises assessment and disclosure rules',
    date: '2025-11-18',
    summary: 'Limitation periods, voluntary disclosure and tax-credit treatment are now handled consistently across Corporate Tax, VAT and Excise Tax.',
    detail: 'Federal Decree-Law No. 17 of 2025 amends the Tax Procedures Law to standardise limitation periods for assessments, streamline the voluntary disclosure process, and clarify how tax credits are treated — applying uniformly across Corporate Tax, VAT and Excise Tax rather than each tax having its own procedural quirks.',
    relatedCats: ['VAT & Tax Procedures', 'Corporate Tax'],
    sourceLabel: 'Federal Decree-Law No. 17 of 2025',
    sourceUrl: 'https://tax.gov.ae',
  },
  {
    id: 'upd-2025-12',
    authority: 'IASB/ISSB',
    kind: 'Guideline',
    title: 'IFRS 18 mandatory effective date approaching (1 Jan 2027)',
    date: '2026-01-20',
    summary: 'IFRS 18 replaces IAS 1 with mandatory operating/investing/financing categories and new subtotal disclosures. Early adoption is allowed if you disclose it.',
    detail: 'IFRS 18, Presentation and Disclosure in Financial Statements, becomes mandatory for annual periods beginning on or after 1 January 2027, though early adoption is permitted with disclosure. It introduces required category structure in the income statement (operating, investing, financing), mandates disclosure of any management-defined performance measures, and sets new aggregation and disaggregation principles for line items. Entities preparing under IFRS — including all DIFC and ADGM entities — should start scoping the transition now, since it changes statement structure rather than just a note disclosure.',
    relatedCats: ['IFRS / IAS'],
    sourceLabel: 'IFRS Foundation, IFRS 18',
    sourceUrl: 'https://www.ifrs.org',
  },
  {
    id: 'upd-2025-11',
    authority: 'FTA',
    kind: 'Decision',
    title: 'DMTT filing penalty relief confirmed for early Top-up Tax periods',
    date: '2025-09-05',
    summary: 'No penalty for a late Top-up Tax Return or GIR on early periods, as long as you made a reasonable effort to comply — but this does not excuse late payment of tax actually owed.',
    detail: 'Under Cabinet Decision No. 142 of 2024, no penalties apply for a late Top-up Tax Return or GloBE Information Return (GIR) filing for tax periods beginning on or before 31 December 2026 (provided the period does not end after 30 June 2028), as long as the taxpayer took reasonable measures to comply. This relief covers filing only — late payment of Top-up Tax actually due is still penalised in the normal way.',
    relatedCats: ['Global Minimum Tax'],
    sourceLabel: 'Cabinet Decision No. 142 of 2024',
    sourceUrl: 'https://tax.gov.ae',
  },
  {
    id: 'upd-2025-06',
    authority: 'MoF',
    kind: 'Decision',
    title: 'Economic Substance Regulations reporting discontinued',
    date: '2024-08-01',
    summary: 'ESR notifications and reports are no longer required for financial years ending after 31 December 2022 — related penalties were cancelled, and any already paid are refundable.',
    detail: 'Cabinet Decision No. 98 of 2024 discontinues the ESR notification and report filing obligation for financial years ending after 31 December 2022. Penalties issued under ESR for those periods are cancelled, and penalties already paid become refundable. ESR obligations for financial years 2019–2022 remain unaffected and are unchanged by this decision. The substance concept itself hasn\'t disappeared — it now lives on as one of the ongoing conditions inside the Corporate Tax QFZP test for free zone companies.',
    relatedCats: ['Compliance & Registers', 'Free Zone vs Mainland'],
    sourceLabel: 'Cabinet Decision No. 98 of 2024',
    sourceUrl: 'https://mof.gov.ae',
  },
  {
    id: 'upd-2025-04',
    authority: 'ICP/GDRFA',
    kind: 'Notification',
    title: 'Golden Visa categories expanded (content creators, educators, senior nurses)',
    date: '2025-10-12',
    summary: 'A handful of new professional categories were added to the skilled-talent route for the 10-year Golden Visa alongside the existing investor and entrepreneur tracks.',
    detail: 'The Federal Authority for Identity, Citizenship, Customs & Port Security expanded Golden Visa eligibility to include additional categories such as content creators, educators and long-serving nurses, on top of the existing real estate investor, public/capital investor, entrepreneur, skilled professional and outstanding student routes. Salary and qualification benchmarks for the skilled-professional route are reviewed periodically — always confirm current figures with ICP/GDRFA directly before applying.',
    relatedCats: ['Immigration & Visas'],
    sourceLabel: 'ICP Golden Residency rules',
    sourceUrl: 'https://icp.gov.ae',
  },
];

export function sortedUpdates(): RegUpdate[] {
  return [...UPDATES].sort((a, b) => (a.date < b.date ? 1 : -1));
}
