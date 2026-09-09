'use client';

import { DailyLiabilityView, Gstr9View, Gstr9cView } from '@/components/hospital/gst/gst-report-views-annual';
import { useMemo, useState, type ComponentType } from 'react';
import { FileSpreadsheet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { useGstProfile } from '@/hooks/use-gst-profile';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
import { Provenance } from '@/components/hospital/gst/gst-report-shell';
import {
  AdvancesView, B2bRegisterView, B2cSummaryView, CreditNoteView, ExemptTurnoverView,
  Gstr1View, Gstr3bView, HsnSummaryView, RateSummaryView, SalesRegisterView,
} from '@/components/hospital/gst/gst-report-views';
import {
  CancelledInvoicesView, DailyCollectionView, DepartmentGstView, ItcReversalView,
  ItcSummaryView, PurchaseRegisterView, PurchaseReturnsView, RateChangeImpactView,
  RateOverridesView,
  RevenueMixView, SeriesContinuityView, SupplierGstinView, UnmappedItemsView,
} from '@/components/hospital/gst/gst-report-views-bc';
import { FiledPeriodsView } from '@/components/hospital/gst/gst-filed-periods';
import { Gstr2bReconciliationView } from '@/components/hospital/gst/gst-2b-reconciliation';
import {
  EInvoiceRegisterView, EwayBillView, FailedIrnView,
} from '@/components/hospital/gst/gst-report-views-d';

// ============================================================
// GST Reports.
//
// Four groups: A is what the accountant files from, B is how the hospital
// claims money back, C is how it keeps itself out of trouble day to day, and D
// is the e-invoice side — which applies when the hospital's own settings say it
// does, never when a turnover figure written into the code says so.
//
// The period is chosen ONCE and every report reads it. That is not a
// convenience — a screen where each report carried its own dates is a screen
// where two of them can be showing different months while claiming to agree.
// ============================================================

interface ReportDef {
  ref: string;
  label: string;
  what: string;
  View: ComponentType<{ q: GstReportQuery }>;
  /** The report ignores the period — it is a whole-year question. */
  wholeYear?: boolean;
}

const GROUPS: Array<{ group: string; caption: string; reports: ReportDef[] }> = [
  {
    group: 'A · Filing',
    caption: 'What the accountant files from. Every report here folds the sales register.',
    reports: [
      { ref: 'A-1', label: 'Sales Register', what: 'Every invoice line issued in the period', View: SalesRegisterView },
      { ref: 'A-2', label: 'Rate-wise Summary', what: 'How much tax is payable, by rate', View: RateSummaryView },
      { ref: 'A-3', label: 'HSN / SAC Summary', what: 'Quantity and value per code — GSTR-1 Table 12', View: HsnSummaryView },
      { ref: 'A-4', label: 'B2B Register', what: 'Invoice-wise, for recipients with a GSTIN', View: B2bRegisterView },
      { ref: 'A-5', label: 'B2C Summary', what: 'Ordinary patients, by state and rate', View: B2cSummaryView },
      { ref: 'A-6', label: 'Credit Notes', what: 'Every note, with the invoice it reverses', View: CreditNoteView },
      { ref: 'A-7', label: 'Exempt Turnover', what: 'Exempt, nil-rated and non-GST income', View: ExemptTurnoverView },
      { ref: 'A-8', label: 'GSTR-1', what: 'Every table, ready to check, with the JSON', View: Gstr1View },
      { ref: 'A-9', label: 'GSTR-3B', what: 'Liability, credit, and the net payable', View: Gstr3bView },
      { ref: 'A-10', label: 'Advances', what: 'Tax due on advances, and what has been adjusted', View: AdvancesView },
      { ref: 'A-11', label: 'GSTR-9 Annual Return', what: 'The whole year, in the form’s own table order', View: Gstr9View, wholeYear: true },
      { ref: 'A-12', label: 'GSTR-9C Reconciliation', what: 'Books against returns — the data the accountant needs', View: Gstr9cView, wholeYear: true },
    ],
  },
  {
    group: 'B · Input tax credit',
    caption: 'What the hospital can claim back — and how much of it has to go straight out again.',
    reports: [
      { ref: 'B-1', label: 'Purchase Register', what: 'Every purchase with its supplier, rate and tax', View: PurchaseRegisterView },
      { ref: 'B-2', label: 'Input Tax Credit', what: 'Credit available, rate-wise and supplier-wise', View: ItcSummaryView },
      { ref: 'B-3', label: 'Rule 42 / 43 Reversal', what: 'How much credit the hospital actually keeps', View: ItcReversalView },
      { ref: 'B-4', label: 'Supplier GSTIN Exceptions', what: 'Purchases where the credit is at risk', View: SupplierGstinView },
      { ref: 'B-5', label: 'GSTR-2B Reconciliation', what: 'Our purchases against what suppliers actually filed', View: Gstr2bReconciliationView },
      { ref: 'B-6', label: 'Returns & Write-offs', what: 'Credit that has to go back', View: PurchaseReturnsView },
    ],
  },
  {
    group: 'C · Control',
    caption: 'Catch a problem during the month rather than on the day of filing.',
    reports: [
      { ref: 'C-1', label: 'Daily Billing / Liability', what: 'What the hospital CHARGED — the liability that arose', View: DailyLiabilityView },
      { ref: 'C-1b', label: 'GST Collected', what: 'What actually came in, by counter, cashier and mode', View: DailyCollectionView },
      { ref: 'C-2', label: 'Revenue Mix', what: 'Taxable share of income, trended by month', View: RevenueMixView },
      { ref: 'C-3', label: 'Unmapped Items', what: 'Everything billed without a code or a treatment', View: UnmappedItemsView },
      { ref: 'C-4', label: 'Series Continuity', what: 'Any gap or duplicate in a document series', View: SeriesContinuityView, wholeYear: true },
      { ref: 'C-5', label: 'Rate Override Log', what: 'Every line where somebody typed the tax', View: RateOverridesView },
      { ref: 'C-6', label: 'Filed Periods', what: 'A frozen copy of what actually went in', View: FiledPeriodsView },
      { ref: 'C-7', label: 'Department-wise GST', what: 'Tax by pharmacy, lab, radiology, OT, room', View: DepartmentGstView },
      { ref: 'C-8', label: 'Rate Change Impact', what: 'What moved on a tax master, and what it touched', View: RateChangeImpactView },
      { ref: 'C-9', label: 'Cancelled Invoices', what: 'Invoices cancelled after issue, and what reversed them', View: CancelledInvoicesView },
    ],
  },
  {
    group: 'D · E-invoice',
    // Correction 14: never "only above ₹5 crore". Whether these apply is the
    // hospital's own setting for the period, and each report says so itself
    // rather than being hidden — "it does not apply to us" is a thing an
    // auditor asks the hospital to demonstrate, not to assert.
    caption:
      'Applicable where e-invoicing and e-way bill requirements apply to the hospital for the period. ' +
      'Each report states the hospital’s current position.',
    reports: [
      { ref: 'D-1', label: 'E-invoice Register', what: 'Every B2B document, its IRN, acknowledgement and date', View: EInvoiceRegisterView },
      { ref: 'D-2', label: 'Failed IRN', what: 'Refused by the portal, or never sent — and how long is left', View: FailedIrnView },
      { ref: 'D-3', label: 'E-way Bill Register', what: 'Goods that physically left, above the consignment threshold', View: EwayBillView },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.reports);

/** The month just gone — the one being filed, which is what these are opened for. */
function defaultPeriod() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const last = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function shiftMonth(from: string, months: number) {
  const d = new Date(`${from}T00:00:00Z`);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export default function GstReportsPage() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [selected, setSelected] = useState(ALL[0].ref);
  const [sixDigit, setSixDigit] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useGstProfile();

  const report = ALL.find((r) => r.ref === selected) ?? ALL[0];
  const q: GstReportQuery = useMemo(
    () =>
      report.wholeYear
        ? { sixDigit }
        : { from: period.from, to: period.to, sixDigit },
    [report.wholeYear, period.from, period.to, sixDigit],
  );

  const runBy = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : null;
  const View = report.View;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">GST Reports</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.registered
              ? `Filed as ${profile.gstin} · ${profile.stateName ?? 'state not resolved'}`
              : 'This hospital is not registered under GST — every document is a Bill of Supply and there is nothing to file.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input
              id="from"
              type="date"
              className="h-9 w-[150px]"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input
              id="to"
              type="date"
              className="h-9 w-[150px]"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
          {/* The return period shortcut — these reports are opened to file a
              month, so moving a month at a time is the common action. */}
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftMonth(p.from, -1))}>
            ← Previous month
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(defaultPeriod())}>
            This month
          </Button>
          <Button
            variant={sixDigit ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSixDigit((v) => !v)}
            title="6-digit HSN is required above ₹5 crore aggregate turnover"
          >
            {sixDigit ? '6-digit HSN' : '4-digit HSN'}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.group}
              </p>
              <p className="px-1 pb-1 text-[11px] leading-tight text-muted-foreground">{g.caption}</p>
              <ul className="space-y-0.5">
                {g.reports.map((r) => (
                  <li key={r.ref}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.ref)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition ${
                        r.ref === selected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{r.ref}</span>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <section className="min-w-0 space-y-3">
          <div className="flex items-start gap-2 rounded-md border bg-card p-3">
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">
                <span className="mr-1.5 font-mono text-xs text-muted-foreground">{report.ref}</span>
                {report.label}
              </h2>
              <p className="text-xs text-muted-foreground">{report.what}</p>
            </div>
          </div>

          {!profile?.registered ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                These reports still run, and the money in them is real. But with no GSTIN on file
                there is no tax on anything and no return to file. Enter the hospital&apos;s
                registration under Settings → GST first.
              </p>
            </div>
          ) : null}

          <View q={q} />

          <Provenance runBy={runBy} from={report.wholeYear ? undefined : period.from} to={report.wholeYear ? undefined : period.to} />
        </section>
      </div>
    </div>
  );
}
