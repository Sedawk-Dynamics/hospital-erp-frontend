'use client';

import { useState, useMemo } from 'react';
import {
  RotateCcw, Search, CheckCircle2, XCircle, Building2, User, Plus, ShoppingCart,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { usePharmacyRole } from '@/hooks/use-pharmacy-role';
import { usePatientSearch } from '@/hooks/use-hospital';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useReturns, useCreateReturn, useProcessReturn, useBatches, useReturnableDispenses,
  useFormulary,
  type PharmacyReturn, type ReturnableDispense, type FormularyItem,
} from '@/hooks/use-pharmacy';

const inr = (n: number | string | null | undefined) =>
  n == null ? '—' : `₹${Number(n).toFixed(2)}`;

type ReturnTab = 'all' | 'pending' | 'processed' | 'rejected';
type CreateMode = 'patient_return' | 'vendor_return' | 'counter_return';

export default function PharmacyReturnsPage() {
  const { isPharmacyAdmin } = usePharmacyRole();
  const [tab, setTab] = useState<ReturnTab>('pending');
  const [createOpen, setCreateOpen] = useState<CreateMode | null>(null);

  const { data, isLoading } = useReturns({
    status: tab === 'all' ? undefined : tab,
    limit: 50,
  });
  const records = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Pharmacy Returns</h1>
          <p className="text-xs text-muted-foreground">
            Counter returns just need the medicine + quantity (no patient). Patient returns restock & refund the original sale. Vendor returns log damaged/unsold stock.
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReturnTab)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="processed">Processed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
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
                description="Patient and vendor returns will appear here."
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
        </TabsContent>
      </Tabs>

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
  const processReturn = useProcessReturn();

  const handleProcess = async (status: 'processed' | 'rejected') => {
    try {
      const updated = await processReturn.mutateAsync({ id: record.id, status });
      if (status === 'processed') {
        const refunded = updated?.refund?.amount ?? updated?.refundAmount;
        toast.success(
          refunded != null && Number(refunded) > 0
            ? `Return processed — stock restored, ${inr(refunded)} refunded`
            : 'Return processed — stock restored',
        );
      } else {
        toast.success('Return rejected');
      }
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to process return');
    }
  };

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
      <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">
        <Building2 className="mr-1 h-3 w-3" /> Vendor
      </Badge>
    );

  const drugName =
    record.drug?.drugName ?? record.drugBatch?.drug?.drugName ?? '-';
  const batchLabel = record.drugBatch?.batchNumber ?? record.batchNumber ?? null;

  const statusBadge = {
    pending: <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Pending</Badge>,
    processed: <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Processed</Badge>,
    rejected: <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Rejected</Badge>,
  }[record.status];

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
      <TableCell className="text-center">{statusBadge}</TableCell>
      <TableCell className="text-right">
        {record.status === 'pending' ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleProcess('processed')}
              disabled={processReturn.isPending}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleProcess('rejected')}
              disabled={processReturn.isPending}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {record.processor ? `By ${record.processor.firstName} ${record.processor.lastName}` : '-'}
          </span>
        )}
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
// optional. No patient lookup, no refund — stock is restored on approval.
function CounterReturnDialog({ onClose }: { onClose: () => void }) {
  const [drugSearch, setDrugSearch] = useState('');
  const [drug, setDrug] = useState<FormularyItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [saleUnit, setSaleUnit] = useState<'pack' | 'loose'>('pack');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reason, setReason] = useState('');

  const { data: formularyData, isLoading: searchLoading } = useFormulary({
    search: drugSearch.length >= 2 ? drugSearch : undefined,
    isActive: true,
    limit: 25,
  });
  const results = formularyData?.data ?? [];

  const createReturn = useCreateReturn();

  // Only offer the loose-unit option when the medicine is sold in sub-units.
  const canSellLoose = !!drug?.packSize && drug.packSize > 1;
  const looseLabel = drug?.looseUnitLabel || 'unit';

  const handleSubmit = async () => {
    if (!drug) return toast.error('Pick the medicine being returned');
    if (quantity <= 0) return toast.error('Enter a quantity');
    try {
      await createReturn.mutateAsync({
        returnType: 'counter_return',
        drugId: drug.id,
        quantity,
        saleUnit: canSellLoose ? saleUnit : 'pack',
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: expiryDate || undefined,
        reason: reason || undefined,
      });
      toast.success('Counter return created — waiting for approval');
      onClose();
    } catch (err) {
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
                        <div className="font-medium">
                          {d.drugName}
                          {d.strength && <span className="ml-1 text-xs text-muted-foreground">{d.strength}</span>}
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
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
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
            On approval the stock is restored to the matching batch — or a new batch is created when both batch number and expiry are given.
          </p>

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
      </DialogContent>
    </Dialog>
  );
}

// Patient return: anchored to the original counter sale so the refund is
// computed from what was billed and bounded by what was dispensed.
function PatientReturnDialog({ onClose }: { onClose: () => void }) {
  const [patientSearch, setPatientSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [selectedLine, setSelectedLine] = useState<ReturnableDispense | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');

  const { data: patientResults } = usePatientSearch(patientSearch);
  const { data: lines, isLoading: linesLoading } = useReturnableDispenses(patient?.id ?? null);
  const createReturn = useCreateReturn();

  const maxQty = selectedLine?.remaining ?? 1;
  const refundPreview =
    selectedLine?.unitPrice != null ? selectedLine.unitPrice * quantity : null;

  const handleSubmit = async () => {
    if (!selectedLine) return toast.error('Pick the original sale line to return against');
    if (quantity <= 0 || quantity > maxQty) {
      return toast.error(`Quantity must be between 1 and ${maxQty}`);
    }
    try {
      const created = await createReturn.mutateAsync({
        returnType: 'patient_return',
        dispensingRecordId: selectedLine.id,
        quantity,
        reason: reason || undefined,
      });
      toast.success(
        created?.refundAmount != null
          ? `Return created — ${inr(created.refundAmount)} refund pending approval`
          : 'Return created — waiting for approval',
      );
      onClose();
    } catch (err) {
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
          {/* 1. Pick the patient */}
          {!patient ? (
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
          )}

          {/* 2. Pick the sale line to return against */}
          {patient && (
            <div>
              <label className="text-xs font-medium">Returnable items (last 120 days)</label>
              {linesLoading ? (
                <Skeleton className="mt-1 h-16 w-full" />
              ) : (lines?.length ?? 0) === 0 ? (
                <p className="mt-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No returnable counter sales found for this patient.
                </p>
              ) : (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-md border">
                  {lines!.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setSelectedLine(l); setQuantity(Math.min(1, l.remaining) || 1); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                        selectedLine?.id === l.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{l.drugName}</span>
                        <span className="text-xs text-muted-foreground">{inr(l.unitPrice)}/{l.saleUnit === 'loose' ? (l.looseUnitLabel || 'unit') : 'pack'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.billNumber && <span className="font-mono">{l.billNumber}</span>}
                        {l.batchNumber && <span className="font-mono"> · {l.batchNumber}</span>}
                        <span> · {l.remaining} of {l.quantityDispensed} returnable</span>
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
                <Input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2 text-sm">
                <span className="text-muted-foreground">Refund (at billed price)</span>
                <span className="font-semibold text-emerald-700 font-mono">{inr(refundPreview)}</span>
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
      </DialogContent>
    </Dialog>
  );
}

// Vendor return: damaged/unsold stock back to the supplier (no refund).
function VendorReturnDialog({ onClose }: { onClose: () => void }) {
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const { data: batchesResp } = useBatches({ search: batchSearch || undefined, limit: 25 });
  const batches = batchesResp?.data ?? [];

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId),
    [batches, selectedBatchId],
  );

  const createReturn = useCreateReturn();

  const handleSubmit = async () => {
    if (!selectedBatchId) return toast.error('Pick a batch');
    if (quantity <= 0) return toast.error('Enter a quantity');
    try {
      await createReturn.mutateAsync({
        returnType: 'vendor_return',
        drugBatchId: selectedBatchId,
        supplierId: supplierId || selectedBatch?.supplier?.id,
        quantity,
        reason: reason || undefined,
      });
      toast.success('Return created — waiting for approval');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to create return');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Vendor Return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Search batch</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Drug name or batch number"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {batches.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-md border">
              {batches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                    selectedBatchId === b.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{b.drug?.drugName}</span>
                    <span className="text-xs text-muted-foreground">Stock: {b.quantityInStock}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">Batch {b.batchNumber}</div>
                </button>
              ))}
            </div>
          )}

          {selectedBatch && (
            <div className="bg-muted/40 rounded-md p-2 text-xs">
              Selected: <b>{selectedBatch.drug?.drugName}</b> · batch{' '}
              <span className="font-mono">{selectedBatch.batchNumber}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Quantity</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div>
            <label className="text-xs font-medium">Supplier ID (optional)</label>
            <Input
              placeholder={selectedBatch?.supplier?.id ?? 'Defaults to batch supplier'}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            />
          </div>

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
          <Button onClick={handleSubmit} disabled={createReturn.isPending}>
            {createReturn.isPending ? 'Saving…' : 'Create Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
