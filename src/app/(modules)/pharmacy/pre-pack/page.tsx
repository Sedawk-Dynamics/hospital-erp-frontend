'use client';

import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { useState } from 'react';
import { PackagePlus, Search, X, Boxes, PackageCheck, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { formatDateTime, formatDate } from '@/lib/date-utils';
import {
  useFormulary, useBatchesByDrug, type FormularyItem, type DrugBatch,
  useStockHolds, usePrePackHold, useCollectHold, useReleaseHold,
} from '@/hooks/use-pharmacy';
import { usePatientSearch } from '@/hooks/use-hospital';

const STATUS_BADGE: Record<string, string> = {
  held: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  collected: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  released: 'bg-muted',
};
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type HoldLine = { drugBatchId: string; quantity: number; label: string };

// Pick a drug → its FEFO batch → qty, then add to the hold lines.
function HoldLineBuilder({ onAdd }: { onAdd: (l: HoldLine) => void }) {
  const [search, setSearch] = useState('');
  const { data } = useFormulary({ search: search || undefined, limit: 15, isActive: true });
  const [drug, setDrug] = useState<FormularyItem | null>(null);
  const { data: batches } = useBatchesByDrug(drug?.id ?? null);
  const fefo: DrugBatch | undefined = batches?.[0];
  const [qty, setQty] = useState('1');

  const add = () => {
    const n = parseInt(qty, 10);
    if (!drug || !fefo || !n || n <= 0) return toast.error('Pick a drug with stock and a valid quantity');
    if (fefo.quantityInStock < n) return toast.error('Not enough stock in the nearest-expiry batch');
    onAdd({ drugBatchId: fefo.id, quantity: n, label: `${drug.drugName}${drug.strength ? ` ${drug.strength}` : ''} · batch ${fefo.batchNumber} (exp ${formatDate(fefo.expiryDate)})` });
    setDrug(null); setSearch(''); setQty('1');
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      {drug ? (
        <div className="flex items-center justify-between text-sm">
          <span className="truncate">{drug.drugName} {drug.strength ?? ''}</span>
          <Button variant="ghost" size="sm" onClick={() => setDrug(null)}>Change</Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a drug to pre-pack" />
          {search.length >= 2 && (data?.data ?? []).length > 0 && (
            <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow">
              {(data?.data ?? []).map((d) => (
                <button key={d.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setDrug(d); setSearch(''); }}>{d.drugName} {d.strength ?? ''}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {drug && (
        <div className="flex items-end gap-2">
          <div className="flex-1 text-xs text-muted-foreground">
            {fefo ? <>FEFO batch <span className="font-mono">{fefo.batchNumber}</span> · exp {formatDate(fefo.expiryDate)} · {fefo.quantityInStock} in stock</> : 'No available batch'}
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Qty</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 w-20" />
          </div>
          <Button size="sm" onClick={add} disabled={!fefo}>Add</Button>
        </div>
      )}
    </div>
  );
}

function PrePackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const prePack = usePrePackHold();
  const [lines, setLines] = useState<HoldLine[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patients } = usePatientSearch(patientSearch);
  const [patient, setPatient] = useState<{ id: string; label: string } | null>(null);

  const submit = async () => {
    if (lines.length === 0) return toast.error('Add at least one item');
    try {
      await prePack.mutateAsync({ patientId: patient?.id, items: lines.map((l) => ({ drugBatchId: l.drugBatchId, quantity: l.quantity })) });
      toast.success('Pre-packed — stock held off the sell pool');
      onOpenChange(false); setLines([]); setPatient(null); setPatientSearch('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Pre-pack a prescription</DialogTitle><DialogDescription>Reserves the stock off the sell pool before the patient arrives. It isn&apos;t billed until collected.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Patient (optional)</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm"><span>{patient.label}</span><Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change</Button></div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patient (optional)" />
                {patientSearch.length >= 2 && (patients ?? []).length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow">
                    {(patients ?? []).map((p: { id: string; firstName: string; lastName?: string; mrn: string }) => (
                      <button key={p.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setPatient({ id: p.id, label: `${p.firstName} ${p.lastName ?? ''} (${p.mrn})` })}>{p.firstName} {p.lastName ?? ''} · {p.mrn}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1"><Label>Items *</Label><HoldLineBuilder onAdd={(l) => setLines([...lines, l])} /></div>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="flex-1 truncate">{l.label}</span>
              <Badge variant="outline">×{l.quantity}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={prePack.isPending}>Pre-pack &amp; hold</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrePackInner() {
  const [status, setStatus] = useState('held');
  const { data, isLoading } = useStockHolds({ status: status || undefined });
  const collect = useCollectHold();
  const release = useReleaseHold();
  const [open, setOpen] = useState(false);
  const rows = data?.items ?? [];

  const onCollect = async (id: string, total: number) => {
    if (!window.confirm(`Collect & bill this pre-pack for ${fmt(total)} (cash)?`)) return;
    try {
      await collect.mutateAsync({ id, payments: total > 0 ? [{ method: 'cash', amount: total }] : undefined });
      toast.success('Collected & billed');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };
  const onRelease = async (id: string) => {
    if (!window.confirm('Release this hold and return the stock to the pool?')) return;
    try { await release.mutateAsync(id); toast.success('Released'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Pre-Packed Holds</h1>
          <p className="text-xs text-muted-foreground">Pack prescriptions before the patient arrives — stock is held off the sell pool, billed only on collection.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><PackagePlus className="mr-1.5 h-4 w-4" /> Pre-pack</Button>
      </div>

      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-48 rounded-md border border-border bg-background px-2 text-sm">
        <option value="held">Held (active)</option>
        <option value="collected">Collected</option>
        <option value="released">Released</option>
        <option value="">All</option>
      </select>

      {isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No pre-packed holds" description="Pre-pack a prescription to reserve its stock before the patient arrives." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Packed</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{r.patient ? `${r.patient.name} (${r.patient.mrn})` : 'Walk-in'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.items.slice(0, 3).map((i) => `${i.drugName}×${i.quantity}`).join(', ')}{r.items.length > 3 ? ` +${r.items.length - 3}` : ''}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.total)}</TableCell>
                <TableCell className="text-center"><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {r.status === 'held' && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => onCollect(r.id, r.total)}><PackageCheck className="mr-1 h-3.5 w-3.5" /> Collect</Button>
                      <Button size="sm" variant="ghost" onClick={() => onRelease(r.id)}><Undo2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <PrePackDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default function PrePackPage() {
  return (
    <PharmacyAdminGuard>
      <PrePackInner />
    </PharmacyAdminGuard>
  );
}
