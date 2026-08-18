'use client';

// Ward Inventory — the nurse's view of their own ward's medicine shelf.
//
// The only ward-stock screen used to live inside the Pharmacy module, behind a
// pharmacy-admin guard, so a nurse could never reach it even though the shelf
// is theirs to work. This page is the nursing half of that: see what is on the
// ward, give a dose off it, and send unused or short-dated packs back to the
// central pharmacy.
//
// Deliberately NOT here: pushing new stock out to a ward and correcting a
// ward's count. Both are stock control and stay with the pharmacy — the server
// gates them the same way.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BedDouble,
  PillBottle,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { useWards } from '@/hooks/use-clinical';
import {
  useWardStock,
  useWardLedger,
  useDispenseFromWard,
  useReturnWardStock,
  type WardStockItem,
} from '@/hooks/use-pharmacy';
import { usePatientSearch } from '@/hooks/use-hospital';

/** Days until expiry; negative when already past. Null when no date on file. */
function daysToExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function ExpiryCell({ expiryDate }: { expiryDate: string | null }) {
  const days = daysToExpiry(expiryDate);
  if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col">
      <span className="text-sm">{formatDate(expiryDate!)}</span>
      {days < 0 ? (
        <span className="text-[11px] font-semibold text-error">Expired</span>
      ) : days <= 30 ? (
        <span className="text-[11px] font-semibold text-amber-600">{days}d left</span>
      ) : null}
    </div>
  );
}

// ── give a dose off the ward shelf ──────────────────────────────────────────

function DispenseDialog({
  wardId,
  item,
  onClose,
}: {
  wardId: string;
  item: WardStockItem;
  onClose: () => void;
}) {
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  const { data: patients } = usePatientSearch(patientSearch);
  const dispense = useDispenseFromWard();

  const options = useMemo(
    () =>
      (patients ?? []).map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName ?? ''}`.trim(),
        hint: p.mrn ?? undefined,
      })),
    [patients],
  );

  const tooMany = quantity > item.quantityInStock;

  async function submit() {
    if (!patientId) return toast.error('Pick the patient this is for');
    if (quantity <= 0) return toast.error('Enter a quantity');
    if (tooMany) return toast.error(`Only ${item.quantityInStock} on the ward`);
    try {
      await dispense.mutateAsync({
        wardId,
        drugBatchId: item.drugBatchId,
        patientId,
        quantity,
        reason: reason.trim() || undefined,
      });
      toast.success(`${quantity} × ${item.drugName} given — charged to the patient`);
      onClose();
    } catch (err) {
      // The server explains exactly what is wrong (credit gate, stock, expiry).
      // An AxiosError's own message is only "Request failed with status code 400".
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message;
      toast.error(msg || 'Could not record it');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Give from ward stock</DialogTitle>
          <DialogDescription>
            {item.drugName}
            {item.batchNumber ? ` · batch ${item.batchNumber}` : ''} — {item.quantityInStock} on the
            ward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            <Input
              placeholder="Search by name or MRN"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
            <SearchableSelect
              options={options}
              value={patientId}
              onChange={setPatientId}
              placeholder={patientSearch ? 'Pick the patient' : 'Type a name above first'}
              searchPlaceholder="Filter results…"
              emptyText="No patient matches."
              clearable
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quantity *</Label>
            <NumberInput
              min={0}
              max={item.quantityInStock}
              integer
              value={quantity}
              onValueChange={setQuantity}
            />
            {tooMany && (
              <p className="text-[11px] text-error">
                Only {item.quantityInStock} on the ward for this batch.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. STAT dose on doctor's verbal order"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <p className="rounded-lg bg-surface-container-low px-3 py-2 text-[11px] text-muted-foreground">
            This posts the charge to the patient&rsquo;s bill and takes the units off the ward
            shelf.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={dispense.isPending || tooMany || !patientId}>
            {dispense.isPending ? 'Recording…' : 'Give dose'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── send stock back to the central pharmacy ─────────────────────────────────

function ReturnDialog({
  wardId,
  item,
  onClose,
}: {
  wardId: string;
  item: WardStockItem;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(item.quantityInStock);
  const [reason, setReason] = useState('');
  const ret = useReturnWardStock();
  const tooMany = quantity > item.quantityInStock;

  async function submit() {
    if (quantity <= 0) return toast.error('Enter a quantity');
    if (tooMany) return toast.error(`Only ${item.quantityInStock} on the ward`);
    try {
      await ret.mutateAsync({
        wardId,
        drugBatchId: item.drugBatchId,
        quantity,
        reason: reason.trim() || undefined,
      });
      toast.success(`${quantity} × ${item.drugName} sent back to pharmacy`);
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message;
      toast.error(msg || 'Could not return it');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return to pharmacy</DialogTitle>
          <DialogDescription>
            {item.drugName}
            {item.batchNumber ? ` · batch ${item.batchNumber}` : ''} — {item.quantityInStock} on the
            ward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Quantity *</Label>
            <NumberInput
              min={0}
              max={item.quantityInStock}
              integer
              value={quantity}
              onValueChange={setQuantity}
            />
            {tooMany && (
              <p className="text-[11px] text-error">
                Only {item.quantityInStock} on the ward for this batch.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. near expiry, patient discharged, over-stocked"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={ret.isPending || tooMany}>
            {ret.isPending ? 'Sending…' : 'Send back'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default function NurseWardStockPage() {
  const { data: wards, isLoading: wardsLoading } = useWards();
  const [wardId, setWardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dispensing, setDispensing] = useState<WardStockItem | null>(null);
  const [returning, setReturning] = useState<WardStockItem | null>(null);

  // Default to the first ward so the page is useful on arrival rather than
  // asking for a selection before showing anything.
  const wardList = useMemo(() => wards ?? [], [wards]);
  const activeWardId = wardId ?? wardList[0]?.id ?? null;

  const { data: stock, isLoading } = useWardStock(activeWardId);
  const { data: ledger } = useWardLedger({ wardId: activeWardId });

  const rows = useMemo(() => {
    const list = stock ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.drugName.toLowerCase().includes(q) ||
        (i.batchNumber ?? '').toLowerCase().includes(q),
    );
  }, [stock, search]);

  const expiringSoon = useMemo(
    () =>
      (stock ?? []).filter((i) => {
        const d = daysToExpiry(i.expiryDate);
        return d !== null && d <= 30;
      }).length,
    [stock],
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Ward Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Medicines held on the ward. Give a dose off the shelf, or send stock back to pharmacy.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={wardList.map((w) => ({ value: w.id, label: w.name }))}
            value={activeWardId}
            onChange={setWardId}
            placeholder={wardsLoading ? 'Loading wards…' : 'Pick a ward'}
            searchPlaceholder="Search wards…"
            emptyText="No wards set up."
          />
        </div>
      </div>

      {expiringSoon > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {expiringSoon} item{expiringSoon === 1 ? '' : 's'} on this ward expire within 30 days —
          send them back rather than letting them lapse on the shelf.
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">
            <PillBottle className="mr-1.5 size-3.5" /> On the ward
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <RotateCcw className="mr-1.5 size-3.5" /> Movement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search medicine or batch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !activeWardId ? (
            <EmptyState
              icon={BedDouble}
              title="Pick a ward"
              description="Choose a ward to see what is on its shelf."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={PillBottle}
              title={search ? 'Nothing matches' : 'No stock on this ward'}
              description={
                search
                  ? 'Try a different medicine or batch number.'
                  : 'The pharmacy has not transferred any medicines to this ward yet.'
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">On ward</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-medium">{i.drugName}</div>
                        {i.looseUnitLabel && (
                          <div className="text-[11px] text-muted-foreground">{i.looseUnitLabel}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.batchNumber ?? '—'}</TableCell>
                      <TableCell>
                        <ExpiryCell expiryDate={i.expiryDate} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {i.quantityInStock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={i.quantityInStock <= 0}
                            onClick={() => setDispensing(i)}
                          >
                            Give
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={i.quantityInStock <= 0}
                            onClick={() => setReturning(i)}
                          >
                            Return
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ledger">
          {(ledger ?? []).length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title="No movement yet"
              description="Transfers in, doses given and returns to pharmacy will show here."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ledger ?? []).map((row: Record<string, unknown>, idx: number) => (
                    <TableRow key={(row.id as string) ?? idx}>
                      <TableCell className="text-xs">
                        {row.createdAt ? formatDateTime(String(row.createdAt)) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(row.drugName as string) ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {String(row.movementType ?? row.type ?? '—').replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {String(row.quantity ?? '—')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(row.reason as string) ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {dispensing && activeWardId && (
        <DispenseDialog
          wardId={activeWardId}
          item={dispensing}
          onClose={() => setDispensing(null)}
        />
      )}
      {returning && activeWardId && (
        <ReturnDialog
          wardId={activeWardId}
          item={returning}
          onClose={() => setReturning(null)}
        />
      )}
    </div>
  );
}
