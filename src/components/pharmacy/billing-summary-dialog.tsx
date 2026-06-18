'use client';

import { FileText, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useIpBillingSummary, type IpBillingSummary } from '@/hooks/use-pharmacy';

const money = (n: number | string) => `₹${Number(n).toFixed(2)}`;

const CATEGORY_BADGE: Record<string, string> = {
  insurance: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  corporate: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  package: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cash: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

// Print the summary in a TPA-friendly layout in a new window.
function printSummary(s: IpBillingSummary) {
  const name = `${s.patient.firstName} ${s.patient.lastName ?? ''}`.trim();
  const header = s.isTpa
    ? `<p class="muted">Insurer: ${s.insurance?.insurer ?? '-'}${s.insurance?.tpa ? ` · TPA: ${s.insurance.tpa}` : ''} · Policy: ${s.insurance?.policyNumber ?? '-'}</p>`
    : '';
  const cats = s.categoryTotals
    .map((c) => `<tr><td style="text-transform:capitalize">${c.category}</td><td style="text-align:right">${money(c.amount)}</td></tr>`)
    .join('');
  const billRows = s.bills
    .map(
      (b) =>
        `<tr><td>${b.billNumber}</td><td>${formatDate(b.billDate)}</td><td style="text-align:right">${money(b.totalAmount)}</td><td style="text-align:right">${money(b.amountPaid)}</td><td style="text-align:right">${money(b.balanceDue)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><title>Billing Summary — ${name}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 2px}.muted{color:#555;font-size:12px;margin:2px 0}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}
    .tot{font-weight:600}</style></head><body>
      <h1>${s.isTpa ? 'TPA Billing Summary' : 'Billing Summary'}</h1>
      <p class="muted">${name} · MRN ${s.patient.mrn} · Category: ${s.category}${
        s.admission ? ` · Admitted ${formatDate(s.admission.admissionDate)}` : ''
      }</p>
      ${header}
      <h3 style="font-size:13px;margin:14px 0 4px">Charges by service</h3>
      <table><thead><tr><th>Service</th><th style="text-align:right">Amount</th></tr></thead><tbody>${cats || '<tr><td colspan=2>No charges</td></tr>'}</tbody></table>
      <h3 style="font-size:13px;margin:14px 0 4px">Bills</h3>
      <table><thead><tr><th>Bill</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead>
      <tbody>${billRows}</tbody>
      <tfoot><tr class="tot"><td colspan=2>Total</td><td style="text-align:right">${money(s.totals.totalBilled)}</td><td style="text-align:right">${money(s.totals.totalPaid)}</td><td style="text-align:right">${money(s.totals.balanceDue)}</td></tr></tfoot></table>
      ${s.admission ? `<p class="muted">Advance deposit: ${money(s.totals.deposit)} · Available: ${money(s.totals.available)}</p>` : ''}
    </body></html>`;
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return toast.error('Allow pop-ups to print');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function BillingSummaryDialog({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: s, isLoading } = useIpBillingSummary(open ? patientId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {s?.isTpa ? 'TPA Billing Summary' : 'Billing Summary'}
          </DialogTitle>
          <DialogDescription>
            {s
              ? `${s.patient.firstName} ${s.patient.lastName ?? ''} · MRN ${s.patient.mrn}`
              : 'Consolidated bills + service records for this patient.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading || !s ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category + insurer header */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className={cn('capitalize', CATEGORY_BADGE[s.category])}>
                  {s.category}
                </Badge>
                {s.admission && (
                  <span className="text-xs text-muted-foreground">
                    Admitted {formatDate(s.admission.admissionDate)}
                  </span>
                )}
              </div>
              {s.isTpa && (
                <div className="rounded-lg border bg-blue-500/5 px-3 py-2 text-sm">
                  <p className="font-medium">For TPA submission</p>
                  <p className="text-xs text-muted-foreground">
                    Insurer: {s.insurance?.insurer ?? '—'}
                    {s.insurance?.tpa ? ` · TPA: ${s.insurance.tpa}` : ''} · Policy:{' '}
                    {s.insurance?.policyNumber ?? '—'}
                    {s.insurance?.planName ? ` · ${s.insurance.planName}` : ''}
                  </p>
                </div>
              )}

              {/* Charges by service category */}
              {s.categoryTotals.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Charges by service
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {s.categoryTotals.map((c) => (
                      <div key={c.category} className="rounded-md border px-3 py-1.5 text-sm">
                        <span className="capitalize text-muted-foreground">{c.category}: </span>
                        <span className="font-medium">{money(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bills */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bills ({s.bills.length})
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                        <th>Bill</th>
                        <th>Date</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.bills.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs">{b.billNumber}</td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{formatDate(b.billDate)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{money(b.totalAmount)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{money(b.amountPaid)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-amber-700">{money(b.balanceDue)}</td>
                        </tr>
                      ))}
                      {s.bills.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-foreground">No bills yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
                <span>Billed: <span className="font-semibold">{money(s.totals.totalBilled)}</span></span>
                <span>Paid: <span className="font-semibold text-emerald-700">{money(s.totals.totalPaid)}</span></span>
                <span>Balance: <span className="font-semibold text-amber-700">{money(s.totals.balanceDue)}</span></span>
                {s.admission && (
                  <span>Advance avail.: <span className="font-semibold">{money(s.totals.available)}</span></span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => s && printSummary(s)} disabled={!s}>
            {isLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
            Print {s?.isTpa ? 'TPA summary' : 'summary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
