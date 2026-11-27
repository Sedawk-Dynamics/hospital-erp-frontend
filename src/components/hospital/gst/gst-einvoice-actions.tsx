'use client';

// ============================================================
// G-5 (gap #266): Generate / Retry / Cancel an IRN — for an invoice or a
// credit / debit note against a B2B invoice — and Generate / Retry / Cancel an
// e-way bill, from the Group D registers.
//
// Offered only when the integration is READY (the report says so in
// `integration`) and only to the roles the server lets do it. A failure comes
// back in the portal's own words and stays on the row — D-2's "Why" column,
// D-3's status — with Retry beside it.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Ban, ExternalLink, Info, Loader2, RefreshCw, Send, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/utils';
import {
  EINVOICE_SANDBOX_LABEL,
  EWAY_CANCEL_REASONS,
  IRN_CANCEL_REASONS,
  useCanManageGst,
  useCancelEwayBill,
  useCancelIrn,
  useGenerateEwayBill,
  useGenerateIrn,
  type EwayBillInput,
  type IrnDocKind,
  type PortalIntegration,
} from '@/hooks/use-gst-portal';
import type { EwayRow } from '@/hooks/use-gst-reports';

/** Whether generation works here, said before the table — and SANDBOX said loudly. */
export function IntegrationBanner({ integration, what }: { integration?: PortalIntegration; what: string }) {
  if (!integration) return null;
  if (!integration.ready) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{what} generation is not available.</p>
          <p className="text-xs">{integration.reason}</p>
          <Link
            href="/hospital/settings/gst"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            GST settings <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }
  if (integration.sandbox) {
    return (
      <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
        {EINVOICE_SANDBOX_LABEL}. Anything generated from this screen is fake and for testing only.
      </p>
    );
  }
  return null;
}

interface IrnRowLike {
  id: string;
  kind: string;
  documentNumber: string;
  status: string;
  ackDate: string | null;
}

const DOC_WORD: Record<string, string> = { invoice: 'invoice', credit_note: 'credit note', debit_note: 'debit note' };

const istTime = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

/** The actions one IRN row allows — the same for an invoice and a note. */
export function IrnRowActions({ row, integration }: { row: IrnRowLike; integration?: PortalIntegration }) {
  const canManage = useCanManageGst();
  const generate = useGenerateIrn();
  const [cancelOpen, setCancelOpen] = useState(false);
  // Read once per mount: "is the cancel window still open" is a question about
  // the moment the screen was drawn, and the server re-checks it anyway.
  const [now] = useState(() => Date.now());

  const kind = (row.kind in DOC_WORD ? row.kind : 'invoice') as IrnDocKind;
  if (!integration?.ready || !canManage) return null;
  const word = DOC_WORD[kind];

  const onSend = async (retry: boolean) => {
    try {
      const out = await generate.mutateAsync({ billId: row.id, retry, kind });
      if (out.status === 'registered') {
        toast.success(
          out.alreadyRegistered
            ? `${row.documentNumber} already has an IRN.`
            : `IRN generated for ${row.documentNumber}${out.sandbox ? ` — ${EINVOICE_SANDBOX_LABEL}` : ''}.`,
        );
      } else {
        toast.error(`IRN not generated for ${row.documentNumber}: ${out.error ?? out.status}`);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, `Could not send the ${word} for an IRN.`));
    }
  };

  if (row.status === 'not_sent') {
    return (
      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={generate.isPending} onClick={() => onSend(false)}>
        {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        Generate IRN
      </Button>
    );
  }
  if (row.status === 'failed' || row.status === 'pending') {
    return (
      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={generate.isPending} onClick={() => onSend(true)}>
        {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Retry
      </Button>
    );
  }
  if (row.status === 'registered') {
    const closesAt = row.ackDate ? new Date(row.ackDate).getTime() + integration.cancelWindowHours * 3_600_000 : 0;
    if (closesAt <= now) {
      return (
        <span className="text-[11px] text-muted-foreground">
          {integration.cancelWindowHours}-hour cancel window closed —{' '}
          {kind === 'invoice' ? 'raise a credit note' : 'issue a fresh note'}
        </span>
      );
    }
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-red-700"
          title={`Cancellable until ${istTime(closesAt)} IST`}
          onClick={() => setCancelOpen(true)}
        >
          <Ban className="h-3 w-3" /> Cancel IRN
        </Button>
        {cancelOpen ? (
          <CancelIrnDialog
            docId={row.id}
            kind={kind}
            documentNumber={row.documentNumber}
            hours={integration.cancelWindowHours}
            onClose={() => setCancelOpen(false)}
          />
        ) : null}
      </>
    );
  }
  return null;
}

function CancelIrnDialog({
  docId,
  kind,
  documentNumber,
  hours,
  onClose,
}: {
  docId: string;
  kind: IrnDocKind;
  documentNumber: string;
  hours: number;
  onClose: () => void;
}) {
  const cancel = useCancelIrn();
  const [reasonCode, setReasonCode] = useState<string>('2');
  const [remark, setRemark] = useState('');
  const word = DOC_WORD[kind];

  const onConfirm = async () => {
    try {
      await cancel.mutateAsync({ billId: docId, kind, reasonCode, remark: remark.trim() });
      toast.success(`IRN for ${documentNumber} cancelled.`);
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'The IRN was not cancelled.'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel the IRN for {documentNumber}</DialogTitle>
          <DialogDescription>
            The portal allows cancellation only within {hours} hours of the acknowledgement. The {word} is then no
            longer an e-invoice and its printed copy says so.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Reason</Label>
            <Select value={reasonCode} onValueChange={(v: string | null) => setReasonCode(v ?? '2')}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {IRN_CANCEL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Remark (sent to the portal)</Label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={100} placeholder="e.g. Wrong buyer GSTIN" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={cancel.isPending || remark.trim().length < 3} className="gap-1.5">
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Cancel IRN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TRANS_MODES: { value: EwayBillInput['transMode']; label: string }[] = [
  { value: '1', label: 'Road' },
  { value: '2', label: 'Rail' },
  { value: '3', label: 'Air' },
  { value: '4', label: 'Ship' },
];

/** The e-way state of a D-3 row, for rows written before the server sent one. */
export function ewayStatusOf(row: Pick<EwayRow, 'ewayStatus' | 'ewayBillNumber'>): string {
  return row.ewayStatus ?? (row.ewayBillNumber ? 'generated' : 'not_generated');
}

/** Generate, Retry or Cancel the e-way bill of a vendor return. */
export function EwayRowAction({ row, integration }: { row: EwayRow; integration?: PortalIntegration }) {
  const canManage = useCanManageGst();
  const [open, setOpen] = useState<'generate' | 'retry' | 'cancel' | null>(null);
  const [now] = useState(() => Date.now());
  if (!integration?.ready || !canManage) return null;
  const status = ewayStatusOf(row);
  const close = () => setOpen(null);

  if (status === 'not_generated' || status === 'failed' || status === 'pending' || status === 'cancelled') {
    const retry = status === 'failed' || status === 'pending';
    // #266: the cancelled number stays in the history; this raises a new one.
    const again = status === 'cancelled';
    return (
      <>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen(retry ? 'retry' : 'generate')}>
          {retry ? <RefreshCw className="h-3 w-3" /> : <Truck className="h-3 w-3" />} {retry ? 'Retry' : again ? 'Generate new' : 'Generate e-way bill'}
        </Button>
        {open === 'generate' || open === 'retry' ? (
          <EwayDialog row={row} retry={open === 'retry'} onClose={close} />
        ) : null}
      </>
    );
  }
  if (status === 'generated' && row.ewayBillDate) {
    const closesAt = new Date(row.ewayBillDate).getTime() + integration.cancelWindowHours * 3_600_000;
    if (closesAt <= now) {
      return <span className="text-[11px] text-muted-foreground">{integration.cancelWindowHours}-hour cancel window closed</span>;
    }
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-red-700"
          title={`Cancellable until ${istTime(closesAt)} IST`}
          onClick={() => setOpen('cancel')}
        >
          <Ban className="h-3 w-3" /> Cancel
        </Button>
        {open === 'cancel' ? <CancelEwayDialog row={row} hours={integration.cancelWindowHours} onClose={close} /> : null}
      </>
    );
  }
  return null;
}

function EwayDialog({ row, retry, onClose }: { row: EwayRow; retry: boolean; onClose: () => void }) {
  const gen = useGenerateEwayBill();
  // Retry — and a new one after a cancellation — offers what was sent last time,
  // so it is corrected rather than retyped.
  const replaces = ewayStatusOf(row) === 'cancelled' ? row.ewayBillNumber : null;
  const last = retry || replaces ? row.ewayTransport ?? null : null;
  const [transMode, setTransMode] = useState<EwayBillInput['transMode']>(
    (last?.transMode as EwayBillInput['transMode'] | undefined) ?? '1',
  );
  const [distance, setDistance] = useState(last?.distanceKm != null ? String(last.distanceKm) : '');
  const [vehicleNo, setVehicleNo] = useState(last?.vehicleNo ?? '');
  const [transporterId, setTransporterId] = useState(last?.transporterId ?? '');
  const [transporterName, setTransporterName] = useState(last?.transporterName ?? '');
  const documentNumber = row.documentNumber;

  const km = Number(distance);
  const valid = Number.isInteger(km) && km >= 1 && km <= 4000 && (transMode !== '1' || !!vehicleNo.trim() || !!transporterId.trim());

  const onConfirm = async () => {
    try {
      const out = await gen.mutateAsync({
        returnId: row.returnId,
        retry,
        input: {
          transMode,
          distanceKm: km,
          ...(vehicleNo.trim() ? { vehicleNo: vehicleNo.trim() } : {}),
          ...(transporterId.trim() ? { transporterId: transporterId.trim() } : {}),
          ...(transporterName.trim() ? { transporterName: transporterName.trim() } : {}),
        },
      });
      if (out.status === 'failed') {
        // Stored on the return — D-3 shows it with Retry once this closes.
        toast.error(`E-way bill not generated for ${documentNumber}: ${out.error ?? 'refused by the portal'}`);
      } else {
        toast.success(
          out.alreadyGenerated
            ? `${documentNumber} already has e-way bill ${out.ewayBillNumber}.`
            : `E-way bill ${out.ewayBillNumber} generated${out.sandbox ? ` — ${EINVOICE_SANDBOX_LABEL}` : ''}.`,
        );
      }
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'The e-way bill was not generated.'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {retry ? 'Retry the e-way bill' : replaces ? 'New e-way bill' : 'E-way bill'} for return {documentNumber || '—'}
          </DialogTitle>
          <DialogDescription>
            One e-way bill covers every medicine on this return. Give the transport details as they will be on the road.
            {replaces ? ` E-way bill ${replaces} was cancelled; it stays in this return's history.` : ''}
          </DialogDescription>
        </DialogHeader>
        {retry && row.ewayError ? (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
            Last attempt: {row.ewayError}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Mode</Label>
            <Select value={transMode} onValueChange={(v: string | null) => setTransMode((v as EwayBillInput['transMode']) ?? '1')}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {TRANS_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Distance (km)</Label>
            <Input type="number" min={1} max={4000} value={distance} onChange={(e) => setDistance(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Vehicle number</Label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="TN01AB1234" maxLength={15} />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Transporter ID (GSTIN / TRANSIN)</Label>
            <Input value={transporterId} onChange={(e) => setTransporterId(e.target.value.toUpperCase())} maxLength={15} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">Transporter name</Label>
            <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} maxLength={100} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onConfirm} disabled={gen.isPending || !valid} className="gap-1.5">
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : retry ? <RefreshCw className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            {retry ? 'Retry' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelEwayDialog({ row, hours, onClose }: { row: EwayRow; hours: number; onClose: () => void }) {
  const cancel = useCancelEwayBill();
  const [reasonCode, setReasonCode] = useState<string>('2');
  const [remark, setRemark] = useState('');

  const onConfirm = async () => {
    try {
      await cancel.mutateAsync({ returnId: row.returnId, reasonCode, remark: remark.trim() });
      toast.success(`E-way bill ${row.ewayBillNumber} cancelled.`);
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'The e-way bill was not cancelled.'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel e-way bill {row.ewayBillNumber}</DialogTitle>
          <DialogDescription>
            The portal allows cancellation only within {hours} hours of generation. It covers every line of return{' '}
            {row.documentNumber || '—'}. The number stays in the history, and a new e-way bill can be generated afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Reason</Label>
            <Select value={reasonCode} onValueChange={(v: string | null) => setReasonCode(v ?? '2')}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {EWAY_CANCEL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Remark (sent to the portal)</Label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={100} placeholder="e.g. Supplier refused the goods" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={cancel.isPending || remark.trim().length < 3} className="gap-1.5">
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Cancel e-way bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
