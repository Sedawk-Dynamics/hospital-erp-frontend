'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { toast } from 'sonner';
import { Search, BedDouble, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { useWards } from '@/hooks/use-clinical';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useWardStock,
  useWardLedger,
  useTransferToWard,
  useDispenseFromWard,
  useCreditStatus,
  useBatches,
  type WardStockItem,
} from '@/hooks/use-pharmacy';

const inr = (n: number | null | undefined) => (n == null ? '—' : `₹${Number(n).toFixed(2)}`);

function TransferDialog({ wardId, onDone }: { wardId: string; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const { data: batchesResp } = useBatches({ search: search || undefined, availableOnly: true, limit: 20 } as any);
  const batches = (batchesResp?.data ?? []).filter((b: any) => b.quantityInStock > 0);
  const transfer = useTransferToWard();

  async function submit() {
    const q = parseInt(qty, 10);
    if (!batchId) return toast.error('Pick a batch');
    if (!q || q <= 0) return toast.error('Enter a quantity');
    try {
      await transfer.mutateAsync({ wardId, drugBatchId: batchId, quantity: q });
      toast.success('Stock transferred to ward');
      setBatchId(null); setQty(''); setSearch('');
      onDone();
    } catch (err) {
      toast.error((err as Error).message ?? 'Transfer failed');
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Transfer from central pharmacy</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search drug / batch" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      {batches.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {batches.map((b: any) => (
            <button
              key={b.id}
              onClick={() => setBatchId(b.id)}
              className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted', batchId === b.id && 'bg-primary/10')}
            >
              <span><span className="font-medium">{b.drug?.drugName}</span> <span className="font-mono text-xs text-muted-foreground">{b.batchNumber}</span></span>
              <span className="text-xs text-muted-foreground">Stock {b.quantityInStock} · exp {b.expiryDate ? formatDate(b.expiryDate) : '—'}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="w-28" />
        <Button onClick={submit} disabled={transfer.isPending || !batchId}>
          {transfer.isPending ? 'Transferring…' : 'Transfer'}
        </Button>
      </div>
    </div>
  );
}

function DispenseDialog({ wardId, stock, onDone }: { wardId: string; stock: WardStockItem[]; onDone: () => void }) {
  const [drugBatchId, setDrugBatchId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [override, setOverride] = useState(false);
  const { data: patientResults } = usePatientSearch(patientSearch);
  const { data: credit } = useCreditStatus(patient?.id ?? null);
  const dispense = useDispenseFromWard();
  const picked = stock.find((s) => s.drugBatchId === drugBatchId);
  const blocked = !!credit?.requiresClearance && !override;

  async function submit() {
    const q = parseInt(qty, 10);
    if (!drugBatchId) return toast.error('Pick a ward drug');
    if (!patient) return toast.error('Pick a patient');
    if (!q || q <= 0) return toast.error('Enter a quantity');
    if (picked && q > picked.quantityInStock) return toast.error('Not enough ward stock');
    if (blocked) return toast.error('Credit limit exceeded — tick "Clearance given" or collect a top-up deposit');
    try {
      const r = await dispense.mutateAsync({ wardId, drugBatchId, patientId: patient.id, quantity: q, override });
      toast.success(`Dispensed — ${inr(r.charged)} posted to bill ${r.billNumber}`);
      setDrugBatchId(null); setQty(''); setPatient(null); setPatientSearch(''); setOverride(false);
      onDone();
    } catch (err) {
      toast.error((err as Error).message ?? 'Dispense failed');
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Dispense to patient (billed to IP bill)</p>
      <div>
        <label className="text-xs font-medium">Ward drug</label>
        <select
          value={drugBatchId ?? ''}
          onChange={(e) => setDrugBatchId(e.target.value || null)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Select from ward stock…</option>
          {stock.map((s) => (
            <option key={s.drugBatchId} value={s.drugBatchId}>
              {s.drugName} · {s.batchNumber} · {s.quantityInStock} on hand
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium">Patient</label>
        {patient ? (
          <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
            <b>{patient.name}</b>
            <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change</Button>
          </div>
        ) : (
          <>
            <Input placeholder="Search patient (name/MRN)" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
            {(patientResults?.length ?? 0) > 0 && (
              <div className="mt-1 max-h-36 overflow-y-auto rounded-md border">
                {patientResults!.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatient({ id: p.id, name: `${p.firstName} ${p.lastName ?? ''}`.trim() })}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {p.firstName} {p.lastName} {p.mrn && <span className="font-mono text-xs text-muted-foreground">{p.mrn}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* IP credit & clearance check (cash patient over deposit) */}
      {patient && credit?.hasAdmission && (
        credit.requiresClearance ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-red-600">
              <ShieldAlert className="h-4 w-4" /> Credit Limit Exceeded — Clearance Required
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Running bill {inr(credit.billed)} exceeds deposit {inr(credit.deposit)} (over by {inr(Math.abs(credit.available))}).
              Collect a top-up deposit, or dispense with clearance below. Life-saving drugs bypass this automatically.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Clearance given — dispense anyway
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            {credit.category === 'cash'
              ? `Within deposit — ${inr(credit.available)} available of ${inr(credit.deposit)}`
              : `${credit.category[0].toUpperCase()}${credit.category.slice(1)} patient — billed to advance/TPA, no counter payment`}
          </div>
        )
      )}

      <div className="flex gap-2">
        <Input type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="w-28" />
        <Button onClick={submit} disabled={dispense.isPending || !drugBatchId || !patient || blocked}>
          {dispense.isPending ? 'Dispensing…' : 'Dispense & bill'}
        </Button>
      </div>
    </div>
  );
}

function WardStockInner() {
  const { data: wards } = useWards();
  const [wardId, setWardId] = useState<string>('');
  const { data: stock = [], isLoading } = useWardStock(wardId || null);
  const { data: ledger = [] } = useWardLedger({ wardId: wardId || null });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Ward Stock</h1>
        <p className="text-xs text-muted-foreground">
          Stock held at each ward (transferred from central pharmacy), dispensed to patients and billed to their IP bill.
        </p>
      </div>

      <select
        value={wardId}
        onChange={(e) => setWardId(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Select a ward…</option>
        {(wards ?? []).map((w: any) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>

      {!wardId ? (
        <EmptyState icon={BedDouble} title="Pick a ward" description="Select a ward to manage its stock." />
      ) : (
        <Tabs defaultValue="stock">
          <TabsList variant="line">
            <TabsTrigger value="stock">Current Stock</TabsTrigger>
            <TabsTrigger value="move">Transfer / Dispense</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : stock.length === 0 ? (
              <EmptyState icon={BedDouble} title="No ward stock" description="Transfer stock from the central pharmacy first." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug / Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.drugName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{s.batchNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm">{s.expiryDate ? formatDate(s.expiryDate) : '—'}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline">{s.quantityInStock}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{inr(s.sellingPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="move">
            <div className="grid gap-4 md:grid-cols-2">
              <TransferDialog wardId={wardId} onDone={() => {}} />
              <DispenseDialog wardId={wardId} stock={stock} onDone={() => {}} />
            </div>
          </TabsContent>

          <TabsContent value="ledger">
            {ledger.length === 0 ? (
              <EmptyState icon={BedDouble} title="No movements" description="No ward stock movements yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Drug / Batch</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Patient</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.date)}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          l.movementType === 'received' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-sky-500/10 text-sky-600 border-sky-500/20',
                        )}>
                          {l.movementType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{l.drugName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{l.batchNumber}</div>
                      </TableCell>
                      <TableCell className="text-right">{l.quantity}</TableCell>
                      <TableCell className="text-sm">{l.patient ?? '—'}{l.patientMrn ? ` (${l.patientMrn})` : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function WardStockPage() {
  return (
    <PharmacyAdminGuard>
      <WardStockInner />
    </PharmacyAdminGuard>
  );
}
