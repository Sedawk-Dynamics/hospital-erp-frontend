'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  RotateCcw, Search, Building2, User, ShoppingCart, Receipt, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockTypeBadge } from '@/components/shared/stock-type-badge';
import { DrugStockLabel } from '@/components/shared/drug-stock-label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { usePharmacyRole } from '@/hooks/use-pharmacy-role';
import { ReturnReceiptDialog } from '@/components/pharmacy/return-receipt-dialog';
import { usePatientSearch } from '@/hooks/use-hospital';
import { useUsersList } from '@/hooks/use-users';
import { useAuthStore } from '@/stores/auth-store';
import { WitnessCosignDialog } from '@/components/pharmacy/witness-cosign-dialog';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useReturns, useCreateReturn, useCreateVendorReturnBatch, useBatches, useReturnableDispenses,
  useFormulary,
  type PharmacyReturn, type ReturnableDispense, type FormularyItem,
} from '@/hooks/use-pharmacy';
import { useSuppliers } from '@/hooks/use-inventory';

const inr = (n: number | string | null | undefined) =>
  n == null ? '—' : `₹${Number(n).toFixed(2)}`;


/**
 * Re-run a return once a witness has co-signed.
 *
 * Rather than duplicating the controlled-drug policy on the client, the server
 * is asked first and its refusal is the trigger: if it says a witness is
 * required, the co-sign dialog opens and the same request is retried with the
 * witness attached. The client never has to know which drugs are vaulted.
 */
function needsWitnessCosign(err: unknown): boolean {
  const m = err instanceof Error ? err.message : '';
  return /witness/i.test(m);
}


type CosignRetry = (w?: { witnessedById: string; witnessPassword: string }) => Promise<unknown>;

/**
 * Holds a return that the server refused for want of a witness, so it can be
 * retried unchanged once someone has co-signed.
 */
function useWitnessCosign(onDone: () => void) {
  const [pending, setPending] = useState<CosignRetry | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: users } = useUsersList(pending ? { isActive: 'true', limit: 200 } : undefined);
  const currentUserId = useAuthStore((st) => st.user?.id) ?? null;

  const options = useMemo(
    () =>
      (users?.data ?? [])
        // A witness who is the person accepting the return is not a witness.
        .filter((u) => u.id !== currentUserId)
        .map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
          role: u.userRoles?.[0]?.role?.name ?? null,
        })),
    [users, currentUserId],
  );

  const confirm = async (witnessedById: string, witnessPassword: string) => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending({ witnessedById, witnessPassword });
      setPending(null);
      toast.success('Return recorded — the stock is held, not put back on the shelf.');
      onDone();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not record the return');
    } finally {
      setBusy(false);
    }
  };

  return { pending, setPending, busy, options, confirm, close: () => setPending(null) };
}

type CreateMode = 'patient_return' | 'vendor_return' | 'counter_return';

export default function PharmacyReturnsPage() {
  const { isPharmacyAdmin } = usePharmacyRole();
  const [createOpen, setCreateOpen] = useState<CreateMode | null>(null);

  // Returns apply immediately now — there's no pending/approve workflow, so we
  // just list every return.
  const { data, isLoading } = useReturns({ limit: 50 });
  const records = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Pharmacy Returns</h1>
          <p className="text-xs text-muted-foreground">
            Returns are applied immediately. Patient returns restock the medicine and refund the money you enter against the original bill. Counter returns just restock; vendor returns send damaged/unsold stock back to the supplier.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateOpen('counter_return')}>
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            Counter Return
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen('patient_return')}>
            <User className="mr-1.5 h-4 w-4" />
            Patient Return
          </Button>
          {isPharmacyAdmin && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen('vendor_return')}>
              <Building2 className="mr-1.5 h-4 w-4" />
              Vendor Return
            </Button>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No returns"
            description="Patient, counter and vendor returns will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Drug · Batch</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <ReturnRow key={r.id} record={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {createOpen && (
        <CreateReturnDialog
          mode={createOpen}
          onClose={() => setCreateOpen(null)}
        />
      )}
    </div>
  );
}

function ReturnRow({ record }: { record: PharmacyReturn }) {
  const [receiptOpen, setReceiptOpen] = useState(false);

  const typeBadge =
    record.returnType === 'patient_return' ? (
      <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
        <User className="mr-1 h-3 w-3" /> Patient
      </Badge>
    ) : record.returnType === 'counter_return' ? (
      <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/20">
        <ShoppingCart className="mr-1 h-3 w-3" /> Counter
      </Badge>
    ) : (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">
          <Building2 className="mr-1 h-3 w-3" /> Vendor
        </Badge>
        {/* A multi-medicine return is several rows sharing one return number.
            Showing it is what makes them read as the one transaction they are,
            and it is the reference the vendor's credit note quotes. */}
        {record.returnNumber && (
          <span className="font-mono text-[10px] text-muted-foreground">{record.returnNumber}</span>
        )}
      </div>
    );

  const drugName =
    record.drug?.drugName ?? record.drugBatch?.drug?.drugName ?? '-';
  const batchLabel = record.drugBatch?.batchNumber ?? record.batchNumber ?? null;

  return (
    <TableRow>
      <TableCell>{typeBadge}</TableCell>
      <TableCell>
        <div className="font-medium">{drugName}</div>
        {batchLabel && (
          <div className="text-xs text-muted-foreground font-mono">{batchLabel}</div>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {record.returnType === 'patient_return'
          ? record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : '-'
          : record.returnType === 'counter_return'
          ? <span className="text-muted-foreground">Walk-in / counter</span>
          : record.supplier?.name ?? '-'}
      </TableCell>
      <TableCell className="text-right">{record.quantity}</TableCell>
      <TableCell className="text-right">
        {record.refundAmount != null ? (
          <div className="flex flex-col items-end">
            <span className="font-medium font-mono">{inr(record.refundAmount)}</span>
            {record.refund && (
              <Badge className="mt-0.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px] capitalize">
                {record.refund.status}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
        {record.reason || '-'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDateTimeAmPm(record.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setReceiptOpen(true)} title="Print return receipt">
            <Receipt className="mr-1 h-3.5 w-3.5" /> Receipt
          </Button>
          {record.processor && (
            <span className="text-xs text-muted-foreground">
              By {record.processor.firstName} {record.processor.lastName}
            </span>
          )}
        </div>
        <ReturnReceiptDialog returnId={record.id} open={receiptOpen} onOpenChange={setReceiptOpen} />
      </TableCell>
    </TableRow>
  );
}

function CreateReturnDialog({ mode, onClose }: { mode: CreateMode; onClose: () => void }) {
  if (mode === 'counter_return') {
    return <CounterReturnDialog onClose={onClose} />;
  }
  if (mode === 'patient_return') {
    return <PatientReturnDialog onClose={onClose} />;
  }
  return <VendorReturnDialog onClose={onClose} />;
}

// Counter return: a walk-in / over-the-counter return that is NOT tied to a
// patient or a bill. Just capture the medicine + quantity, with batch & expiry
// optional. Stock is restored immediately. An optional refund amount (money
// given to the walk-in customer) can be recorded — it shows on the return receipt.
function CounterReturnDialog({ onClose }: { onClose: () => void }) {
  const [drugSearch, setDrugSearch] = useState('');
  const [drug, setDrug] = useState<FormularyItem | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [saleUnit, setSaleUnit] = useState<'pack' | 'loose'>('pack');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reason, setReason] = useState('');
  const [refundInput, setRefundInput] = useState('');

  const { data: formularyData, isLoading: searchLoading } = useFormulary({
    search: drugSearch.length >= 2 ? drugSearch : undefined,
    isActive: true,
    limit: 25,
  });
  const results = formularyData?.data ?? [];

  const createReturn = useCreateReturn();
  const cosign = useWitnessCosign(onClose);

  // Only offer the loose-unit option when the medicine is sold in sub-units.
  const canSellLoose = !!drug?.packSize && drug.packSize > 1;
  const looseLabel = drug?.looseUnitLabel || 'unit';

  const handleSubmit = async () => {
    if (!drug) return toast.error('Pick the medicine being returned');
    if (quantity <= 0) return toast.error('Enter a quantity');
    const refundAmount = refundInput.trim() === '' ? undefined : Number(refundInput);
    if (refundAmount != null && (isNaN(refundAmount) || refundAmount < 0)) {
      return toast.error('Enter a valid refund amount');
    }
    const submit = async (witness?: { witnessedById: string; witnessPassword: string }) =>
      createReturn.mutateAsync({
        returnType: 'counter_return',
        drugId: drug.id,
        quantity,
        saleUnit: canSellLoose ? saleUnit : 'pack',
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: expiryDate || undefined,
        reason: reason || undefined,
        refundAmount,
        ...witness,
      });
    try {
      await submit();
      toast.success(
        refundAmount != null && refundAmount > 0
          ? `Counter return recorded — stock restored, ${inr(refundAmount)} refunded`
          : 'Counter return recorded — stock restored',
      );
      onClose();
    } catch (err) {
      if (needsWitnessCosign(err)) {
        cosign.setPending(() => submit);
        return;
      }
      toast.error((err as Error).message ?? 'Failed to create return');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Counter Return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 1. Pick the medicine */}
          {!drug ? (
            <div>
              <label className="text-xs font-medium">Medicine</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search medicine by name (min 2 chars)"
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {drugSearch.length >= 2 && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-md border">
                  {searchLoading ? (
                    <div className="p-3"><Skeleton className="h-10 w-full" /></div>
                  ) : results.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      No matching medicine in the formulary.
                    </p>
                  ) : (
                    results.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setDrug(d);
                          setSaleUnit(d.packSize && d.packSize > 1 ? 'loose' : 'pack');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <div className="flex items-center gap-1.5 font-medium">
                          {d.drugName}
                          {d.strength && <span className="ml-1 text-xs text-muted-foreground">{d.strength}</span>}
                          <StockTypeBadge category={d.category} />
                          <DrugStockLabel stock={d.totalStock} className="ml-auto" />
                        </div>
                        {d.genericName && (
                          <div className="text-xs text-muted-foreground">{d.genericName}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
              <span>
                <ShoppingCart className="mr-1 inline h-3.5 w-3.5" />
                <b>{drug.drugName}</b>
                {drug.strength && <span className="ml-1 text-xs text-muted-foreground">{drug.strength}</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setDrug(null)}>Change</Button>
            </div>
          )}

          {/* 2. Quantity + unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Quantity</label>
              <NumberInput
                min={0}
                value={quantity}
                onValueChange={setQuantity}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Unit</label>
              <Select
                value={saleUnit}
                onValueChange={(v) => v && setSaleUnit(v as 'pack' | 'loose')}
                disabled={!canSellLoose}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pack">Pack / Strip</SelectItem>
                  {canSellLoose && (
                    <SelectItem value="loose">{looseLabel} (loose)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3. Optional batch + expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Batch number (optional)</label>
              <Input
                placeholder="e.g. B12345"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Expiry (optional)</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Stock is restored immediately to the matching batch — or a new batch is created when both batch number and expiry are given.
          </p>

          {/* 4. Optional refund / price given to the customer */}
          <div>
            <label className="text-xs font-medium">Refund amount — price given (optional) (₹)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={refundInput}
              onChange={(e) => setRefundInput(e.target.value)}
              placeholder="0.00"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Money handed back to the customer. Recorded on the return and shown on its receipt.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">Reason (optional)</label>
            <Textarea
              placeholder="e.g. unused, wrong medicine, customer changed mind..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createReturn.isPending || !drug}>
            {createReturn.isPending ? 'Saving…' : 'Create Return'}
          </Button>
        </DialogFooter>

      {/* The server asked for a co-sign; the witness confirms with their own
          password and the same return is retried. */}
      <WitnessCosignDialog
        open={!!cosign.pending}
        onOpenChange={(o) => !o && cosign.close()}
        title="Controlled return — witness required"
        description="This medicine is a controlled narcotic. A second authorised person must witness the return. It will be held for destruction rather than put back on the shelf."
        witnessOptions={cosign.options}
        busy={cosign.busy}
        onConfirm={cosign.confirm}
      />
      </DialogContent>
    </Dialog>
  );
}

// Patient return: anchored to the original counter sale so the refund is
// computed from what was billed and bounded by what was dispensed.
function PatientReturnDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'patient' | 'bill'>('patient');
  const [patientSearch, setPatientSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [billInput, setBillInput] = useState('');
  const [submittedBill, setSubmittedBill] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<ReturnableDispense | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState('');
  // Money actually handed back to the customer (prefilled from the billed price,
  // but the pharmacist can edit it). This is what gets refunded on the bill.
  const [refundInput, setRefundInput] = useState('');

  const { data: patientResults } = usePatientSearch(patientSearch);
  const {
    data: returnable,
    isLoading: linesLoading,
    error: returnableError,
  } = useReturnableDispenses({
    patientId: mode === 'patient' ? patient?.id ?? null : null,
    billNumber: mode === 'bill' ? submittedBill : null,
  });
  const lines = returnable?.items ?? [];
  const billPatientName = returnable?.patient
    ? `${returnable.patient.firstName} ${returnable.patient.lastName ?? ''}`.trim()
    : null;
  const showLines = (mode === 'patient' && !!patient) || (mode === 'bill' && !!submittedBill);
  const createReturn = useCreateReturn();
  const cosign = useWitnessCosign(onClose);

  const maxQty = selectedLine?.remaining ?? 1;
  const refundPreview =
    selectedLine?.unitPrice != null ? selectedLine.unitPrice * quantity : null;

  // Prefill the refund with the billed price whenever the line / qty changes.
  useEffect(() => {
    setRefundInput(refundPreview != null ? refundPreview.toFixed(2) : '');
  }, [selectedLine?.id, quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!selectedLine) return toast.error('Pick the original sale line to return against');
    if (quantity <= 0 || quantity > maxQty) {
      return toast.error(`Quantity must be between 1 and ${maxQty}`);
    }
    const refundAmount = refundInput.trim() === '' ? undefined : Number(refundInput);
    if (refundAmount != null && (isNaN(refundAmount) || refundAmount < 0)) {
      return toast.error('Enter a valid refund amount');
    }
    const submit = async (witness?: { witnessedById: string; witnessPassword: string }) =>
      createReturn.mutateAsync({
        returnType: 'patient_return',
        dispensingRecordId: selectedLine.id,
        quantity,
        reason: reason || undefined,
        refundAmount,
        ...witness,
      });
    try {
      const created = await submit();
      const refunded = created?.refundAmount;
      toast.success(
        refunded != null && Number(refunded) > 0
          ? `Return done — ${inr(refunded)} refunded to the bill`
          : 'Return done — stock restored',
      );
      onClose();
    } catch (err) {
      // The server decides whether this drug needs a co-sign; when it does, ask
      // for one and retry the very same request.
      if (needsWitnessCosign(err)) {
        cosign.setPending(() => submit);
        return;
      }
      toast.error((err as Error).message ?? 'Failed to create return');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Patient Return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Mode: look up by patient, or by presenting the physical bill */}
          <div className="flex items-center gap-1.5">
            {(['patient', 'bill'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => {
                  setMode(m);
                  setSelectedLine(null);
                }}
              >
                {m === 'patient' ? 'By patient' : 'By bill no.'}
              </Button>
            ))}
          </div>

          {/* 1a. Find patient */}
          {mode === 'patient' &&
            (!patient ? (
              <div>
                <label className="text-xs font-medium">Find patient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Name, MRN or phone (min 2 chars)"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(patientResults?.length ?? 0) > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                    {patientResults!.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setPatient({ id: p.id, name: `${p.firstName} ${p.lastName ?? ''}`.trim() })
                        }
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                        {p.mrn && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.mrn}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
                <span><User className="mr-1 inline h-3.5 w-3.5" /><b>{patient.name}</b></span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPatient(null); setSelectedLine(null); }}
                >
                  Change
                </Button>
              </div>
            ))}

          {/* 1b. Look up by bill number (physical bill presented) */}
          {mode === 'bill' && (
            <div>
              <label className="text-xs font-medium">Bill number</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. PH-20260616-0007"
                  value={billInput}
                  onChange={(e) => setBillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSubmittedBill(billInput.trim() || null);
                      setSelectedLine(null);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmittedBill(billInput.trim() || null);
                    setSelectedLine(null);
                  }}
                >
                  Find
                </Button>
              </div>
              {submittedBill && billPatientName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <User className="mr-1 inline h-3.5 w-3.5" />
                  {billPatientName}
                </p>
              )}
              {returnableError && (
                <p className="mt-1 text-xs text-red-600">
                  {(returnableError as Error).message ?? 'Bill not found'}
                </p>
              )}
            </div>
          )}

          {/* 2. Pick the sale line to return against */}
          {showLines && (
            <div>
              <label className="text-xs font-medium">Returnable items (last 120 days)</label>
              {linesLoading ? (
                <Skeleton className="mt-1 h-16 w-full" />
              ) : lines.length === 0 ? (
                <p className="mt-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No returnable counter sales found.
                </p>
              ) : (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-md border">
                  {lines.map((l) => (
                    <button
                      key={l.id}
                      disabled={l.nonReturnable}
                      onClick={() => { setSelectedLine(l); setQuantity(Math.min(1, l.remaining) || 1); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent ${
                        selectedLine?.id === l.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {l.drugName}
                          {l.nonReturnable && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Non-returnable</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{inr(l.unitPrice)}/{l.saleUnit === 'loose' ? (l.looseUnitLabel || 'unit') : 'pack'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.billNumber && <span className="font-mono">{l.billNumber}</span>}
                        {l.batchNumber && <span className="font-mono"> · {l.batchNumber}</span>}
                        <span> · {l.nonReturnable ? 'marked non-returnable on the bill' : `${l.remaining} of ${l.quantityDispensed} returnable`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Quantity + refund preview */}
          {selectedLine && (
            <>
              <div>
                <label className="text-xs font-medium">
                  Return quantity (max {maxQty})
                </label>
                <NumberInput
                  min={0}
                  max={maxQty}
                  integer
                  value={quantity}
                  onValueChange={setQuantity}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Refund amount — money given to customer (₹)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={refundInput}
                  onChange={(e) => setRefundInput(e.target.value)}
                  placeholder={refundPreview != null ? refundPreview.toFixed(2) : '0.00'}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Prefilled from the billed price ({inr(refundPreview)}). Edit it to the amount you actually refund — it is credited against the original bill.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium">Reason</label>
            <Textarea
              placeholder="e.g. unused, allergic reaction, wrong dispense..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createReturn.isPending || !selectedLine}>
            {createReturn.isPending ? 'Saving…' : 'Create Return'}
          </Button>
        </DialogFooter>

      {/* The server asked for a co-sign; the witness confirms with their own
          password and the same return is retried. */}
      <WitnessCosignDialog
        open={!!cosign.pending}
        onOpenChange={(o) => !o && cosign.close()}
        title="Controlled return — witness required"
        description="This medicine is a controlled narcotic. A second authorised person must witness the return. It will be held for destruction rather than put back on the shelf."
        witnessOptions={cosign.options}
        busy={cosign.busy}
        onConfirm={cosign.confirm}
      />
      </DialogContent>
    </Dialog>
  );
}

// Vendor return: damaged/unsold stock back to the supplier (no refund).
//
// One return covers MANY medicines. Sending expired stock back is a stock-take
// job — the pharmacist pulls a crate of short-dated packs off the shelf and the
// distributor issues ONE credit note for the lot. Doing that one medicine at a
// time produced one return, one stock movement and one credit-note row per
// pack, none of which matched the document the vendor actually sent.
//
// One supplier per return, because that is what a credit note is raised
// against. Batches from a second vendor are a second return.

/** How far ahead the picker looks when filtering for stock worth returning. */
const EXPIRY_WINDOWS = [
  { value: '0', label: 'Expired only' },
  { value: '30', label: 'Expiring ≤ 30 days' },
  { value: '90', label: 'Expiring ≤ 90 days' },
  { value: 'all', label: 'All stock' },
] as const;
type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number]['value'];

interface ReturnLine {
  batchId: string;
  drugName: string;
  batchNumber: string;
  expiryDate: string | null;
  inStock: number;
  purchasePrice: number | null;
  quantity: number;
}

/** Days until expiry; negative when already past. Null when no date on file. */
function daysToExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  const days = daysToExpiry(expiryDate);
  if (days === null) return <span className="text-[11px] text-muted-foreground">No expiry on file</span>;
  if (days < 0) {
    return (
      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
        Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days <= 90) {
    return (
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
        {days}d left
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">{days}d left</span>;
}

function VendorReturnDialog({ onClose }: { onClose: () => void }) {
  const [batchSearch, setBatchSearch] = useState('');
  // Expiry is the usual reason for a vendor return, so the picker leads with
  // the stock that needs sending back rather than the whole shelf.
  const [expiryWindow, setExpiryWindow] = useState<ExpiryWindow>('90');
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const { data: batchesResp } = useBatches({
    search: batchSearch || undefined,
    limit: 25,
    // "expired" is expiringInDays: 0 — a real date comparison rather than the
    // stored isExpired flag, which only flips when the nightly job runs.
    ...(expiryWindow === 'all' ? {} : { expiringInDays: Number(expiryWindow) }),
  });
  const batches = batchesResp?.data ?? [];

  // The server requires a real vendor id (you cannot send stock back to
  // nobody), so it has to be PICKED, not typed.
  const { data: suppliersResp } = useSuppliers({ isActive: true, limit: 200 });
  const suppliers = suppliersResp?.data ?? [];

  const createBatch = useCreateVendorReturnBatch();

  const inBasket = useMemo(() => new Set(lines.map((l) => l.batchId)), [lines]);

  // Default the vendor to whoever supplied the first batch added, so the common
  // case (a crate from one distributor) needs no extra click.
  function addLine(b: (typeof batches)[number]) {
    if (inBasket.has(b.id)) return;
    setLines((prev) => [
      ...prev,
      {
        batchId: b.id,
        drugName: b.drug?.drugName ?? 'Medicine',
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate ?? null,
        inStock: Number(b.quantityInStock ?? 0),
        purchasePrice: b.purchasePrice != null ? Number(b.purchasePrice) : null,
        quantity: Number(b.quantityInStock ?? 0),
      },
    ]);
    if (!supplierId && b.supplier?.id) setSupplierId(b.supplier.id);
  }

  function patchLine(batchId: string, patch: Partial<ReturnLine>) {
    setLines((prev) => prev.map((l) => (l.batchId === batchId ? { ...l, ...patch } : l)));
  }

  function removeLine(batchId: string) {
    setLines((prev) => prev.filter((l) => l.batchId !== batchId));
  }

  // Credit defaults to what the distributor should give back: qty x purchase
  // price across every line. Overridable, because the credit note is theirs.
  const autoCredit = useMemo(
    () => lines.reduce((sum, l) => sum + (l.purchasePrice ?? 0) * l.quantity, 0),
    [lines],
  );
  const overQty = lines.filter((l) => l.quantity > l.inStock || l.quantity <= 0);
  const canSubmit = lines.length > 0 && overQty.length === 0 && !!supplierId;

  const handleSubmit = async () => {
    if (lines.length === 0) return toast.error('Add at least one medicine');
    if (overQty.length > 0) {
      return toast.error(`Check the quantity on ${overQty[0].drugName} — it exceeds what the batch holds`);
    }
    if (!supplierId) return toast.error('Pick the supplier this stock goes back to');
    try {
      const result = await createBatch.mutateAsync({
        supplierId,
        reason: reason || undefined,
        creditNoteNumber: creditNoteNumber.trim() || undefined,
        creditAmount: creditAmount ? Number(creditAmount) : undefined,
        lines: lines.map((l) => ({ drugBatchId: l.batchId, quantity: l.quantity })),
      });
      toast.success(
        `Vendor return ${result?.returnNumber ?? ''} recorded — ${lines.length} medicine(s), stock reduced`,
      );
      onClose();
    } catch (err) {
      // The server says exactly what is wrong (missing supplier, quantity above
      // stock, expired batch…). An AxiosError's own message is only "Request
      // failed with status code 400", which is what the pharmacist used to see.
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message;
      toast.error(msg || 'Failed to create return');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Vendor Return</DialogTitle>
          <DialogDescription>
            Add every medicine going back to this vendor. They are recorded as one return
            against one credit note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── picker ─────────────────────────────────────────────── */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search drug name or batch number"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={expiryWindow}
                onValueChange={(v) => setExpiryWindow((v as ExpiryWindow) ?? '90')}
              >
                <SelectTrigger className="sm:w-52">
                  <SelectValue>
                    {(val) =>
                      EXPIRY_WINDOWS.find((w) => w.value === val)?.label ?? 'Expiring ≤ 90 days'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_WINDOWS.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {batches.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No batches match. Widen the expiry filter or search by name.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-md border">
                {batches.map((b) => {
                  const added = inBasket.has(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={added}
                      onClick={() => addLine(b)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50 ${
                        added ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{b.drug?.drugName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Stock: {b.quantityInStock}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          Batch {b.batchNumber}
                        </span>
                        <ExpiryBadge expiryDate={b.expiryDate} />
                        {added && <span className="text-[10px] text-primary">Added</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── basket ─────────────────────────────────────────────── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium">
                Medicines in this return {lines.length > 0 && `(${lines.length})`}
              </label>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLines([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                Pick medicines above to build the return.
              </p>
            ) : (
              <div className="space-y-1.5">
                {lines.map((l) => (
                  <div
                    key={l.batchId}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.drugName}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {l.batchNumber}
                        </span>
                        <ExpiryBadge expiryDate={l.expiryDate} />
                        <span className="text-[11px] text-muted-foreground">
                          in stock {l.inStock}
                        </span>
                      </div>
                    </div>
                    <div className="w-24">
                      <NumberInput
                        min={0}
                        max={l.inStock}
                        integer
                        value={l.quantity}
                        onValueChange={(v) => patchLine(l.batchId, { quantity: v })}
                      />
                    </div>
                    <span className="w-20 text-right text-xs text-muted-foreground">
                      {l.purchasePrice != null ? inr(l.purchasePrice * l.quantity) : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(l.batchId)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${l.drugName}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {l.quantity > l.inStock && (
                      <p className="w-full text-[11px] text-error">
                        Only {l.inStock} in stock for this batch.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── vendor + credit note ───────────────────────────────── */}
          <div>
            <label className="text-xs font-medium">Supplier *</label>
            <Select value={supplierId || null} onValueChange={(v) => setSupplierId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select the vendor this stock goes back to">
                  {(value) =>
                    value
                      ? (suppliers.find((s) => s.id === value)?.name ?? 'Selected supplier')
                      : 'Select the vendor this stock goes back to'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No active vendors yet — add one under Inventory → Vendors.
                  </div>
                ) : (
                  suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              One vendor per return — a credit note is raised against a single supplier.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Credit note no.</label>
              <Input
                placeholder="Supplier CN ref"
                value={creditNoteNumber}
                onChange={(e) => setCreditNoteNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Credit amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                placeholder={autoCredit > 0 ? autoCredit.toFixed(2) : '0.00'}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
          </div>
          {autoCredit > 0 && !creditAmount && (
            <p className="text-[11px] text-muted-foreground">
              Defaults to {inr(autoCredit)} across {lines.length} line(s) — quantity × purchase
              price — if left blank.
            </p>
          )}

          <div>
            <label className="text-xs font-medium">Reason</label>
            <Textarea
              placeholder="e.g. damaged on receipt, expired, recall..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createBatch.isPending}>
            {createBatch.isPending
              ? 'Saving…'
              : `Create Return${lines.length > 0 ? ` (${lines.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
