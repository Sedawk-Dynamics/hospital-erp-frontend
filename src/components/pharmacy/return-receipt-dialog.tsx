'use client';

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/date-utils';
import { useReturnDetail } from '@/hooks/use-pharmacy';

const num = (n: number | string | null | undefined): number =>
  n == null ? 0 : typeof n === 'string' ? Number(n) : n;
const inr = (n: number | string | null | undefined) =>
  `₹${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const printStyles = `
  <style>
    * { font-family: 'Courier New', monospace; font-size: 12px; }
    .center { text-align: center; }
    .muted { color: #555; }
    .row { display: flex; justify-content: space-between; }
    .rule { border-top: 1px dashed #999; margin: 6px 0; }
    h2 { margin: 0; font-size: 15px; }
    .xs { font-size: 11px; }
    .b { font-weight: bold; }
  </style>
`;

/**
 * G3: printable return-acknowledgement receipt. Mirrors the sale receipt so the
 * customer gets a slip even though current paper workflows don't always issue
 * one (future compliance may require it).
 */
export function ReturnReceiptDialog({
  returnId,
  open,
  onOpenChange,
}: {
  returnId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useReturnDetail(open ? returnId : null);

  const r = data?.return;
  const hospital = data?.hospital;
  const drugName = r?.drug?.drugName ?? r?.drugBatch?.drug?.drugName ?? 'Medication';
  const batch = r?.batchNumber ?? r?.drugBatch?.batchNumber ?? null;
  const patientName = r?.patient
    ? `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim()
    : null;

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const win = window.open('', '_blank', 'width=380,height=700');
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>Return ${r?.id ?? ''}</title>${printStyles}</head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[92vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b bg-surface-container-low px-4 py-2 sticky top-0 z-10">
          <p className="text-sm font-medium">Return Receipt</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} disabled={!r}>
              <Printer className="size-3.5" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading || !r ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="p-4">
            <div ref={printRef}>
              <div className="center">
                <h2 className="b">{hospital?.name ?? 'Pharmacy'}</h2>
                {hospital?.address && <p className="xs muted">{hospital.address}</p>}
                {(hospital?.city || hospital?.state) && (
                  <p className="xs muted">{[hospital?.city, hospital?.state].filter(Boolean).join(', ')}</p>
                )}
                {hospital?.phone && <p className="xs muted">Ph: {hospital.phone}</p>}
              </div>
              <div className="rule" />
              <p className="center b">RETURN ACKNOWLEDGEMENT</p>
              <div className="rule" />
              <div className="row"><span className="muted">Return ID</span><span className="font-mono">{r.id.slice(0, 8).toUpperCase()}</span></div>
              <div className="row"><span className="muted">Date</span><span>{formatDateTime(r.createdAt)}</span></div>
              {data?.billNumber && (
                <div className="row"><span className="muted">Against Bill</span><span className="font-mono">{data.billNumber}</span></div>
              )}
              <div className="row"><span className="muted">Type</span><span className="capitalize">{r.returnType.replace('_', ' ')}</span></div>
              {patientName && (
                <div className="row"><span className="muted">Patient</span><span>{patientName}</span></div>
              )}
              <div className="rule" />
              <div className="row"><span className="b">{drugName}</span></div>
              {batch && <div className="row xs"><span className="muted">Batch</span><span className="font-mono">{batch}</span></div>}
              <div className="row"><span className="muted">Qty returned</span><span className="b">{r.quantity}</span></div>
              {r.refundAmount != null && Number(r.refundAmount) > 0 && (
                <>
                  <div className="rule" />
                  <div className="row"><span className="b">Refund</span><span className="b">{inr(r.refundAmount)}</span></div>
                  {r.refund && (
                    <div className="row xs"><span className="muted">Status</span><span className="capitalize">{r.refund.status}</span></div>
                  )}
                </>
              )}
              {r.reason && (
                <>
                  <div className="rule" />
                  <p className="xs muted">Reason: {r.reason}</p>
                </>
              )}
              <div className="rule" />
              <p className="center xs muted">Keep this slip as proof of return.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
