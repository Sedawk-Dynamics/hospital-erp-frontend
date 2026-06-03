'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import {
  AlertOctagon, Phone, Mail, Printer, Search, ShieldAlert,
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { formatDate, formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useRecalledItems, useRecallAffectedPatients,
  useRecallBatch, useUnrecallBatch, useRecallDrug,
  useBatches, useFormulary,
} from '@/hooks/use-pharmacy';

type Mode = 'recalled' | 'flag-batch' | 'flag-drug';

function PharmacyRecallsPageInner() {
  const [mode, setMode] = useState<Mode>('recalled');
  const [affectedBatchId, setAffectedBatchId] = useState<string | null>(null);

  const { data, isLoading } = useRecalledItems('all');
  const recalledBatches = data?.recalledBatches ?? [];
  const recalledDrugs = data?.recalledDrugs ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Recall Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Recalled batches are auto-blocked from dispensing. Generate an
            affected-patient list to contact recipients.
          </p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="recalled">Active Recalls</TabsTrigger>
          <TabsTrigger value="flag-batch">Flag a Batch</TabsTrigger>
          <TabsTrigger value="flag-drug">Flag a Drug</TabsTrigger>
        </TabsList>

        <TabsContent value="recalled" className="mt-3 space-y-4">
          <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="flex items-center justify-between px-4 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Recalled Batches ({recalledBatches.length})
              </h3>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recalledBatches.length === 0 ? (
              <EmptyState
                icon={AlertOctagon}
                title="No batches recalled"
                description="All batches are clear."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Dispensed</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recalledBatches.map((b) => (
                    <RecalledBatchRow
                      key={b.id}
                      batch={b}
                      onShowAffected={() => setAffectedBatchId(b.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            <div className="flex items-center justify-between px-4 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Recalled Drugs (formulary) ({recalledDrugs.length})
              </h3>
            </div>
            {recalledDrugs.length === 0 ? (
              <EmptyState
                icon={AlertOctagon}
                title="No drugs recalled"
                description="No formulary entries are marked as recalled."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Generic</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recalledDrugs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.drugName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.genericName ?? '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.category?.name ?? '-'}</TableCell>
                      <TableCell className="text-right">{d._count?.drugBatches ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="flag-batch" className="mt-3">
          <FlagBatchPanel />
        </TabsContent>

        <TabsContent value="flag-drug" className="mt-3">
          <FlagDrugPanel />
        </TabsContent>
      </Tabs>

      {affectedBatchId && (
        <AffectedPatientsDialog
          batchId={affectedBatchId}
          onClose={() => setAffectedBatchId(null)}
        />
      )}
    </div>
  );
}

function RecalledBatchRow({
  batch,
  onShowAffected,
}: {
  batch: NonNullable<ReturnType<typeof useRecalledItems>['data']>['recalledBatches'][number];
  onShowAffected: () => void;
}) {
  const unrecall = useUnrecallBatch();

  const handleUnrecall = async () => {
    if (!confirm('Lift the recall on this batch? Dispensing will be allowed again.')) return;
    try {
      await unrecall.mutateAsync(batch.id);
      toast.success('Recall lifted');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to lift recall');
    }
  };

  const dispensedCount = batch._count?.dispensingRecords ?? 0;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{batch.drug.drugName}</div>
        <div className="text-xs text-muted-foreground">{batch.drug.genericName ?? ''}</div>
      </TableCell>
      <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDate(batch.expiryDate)}</TableCell>
      <TableCell className="text-right">{batch.quantityInStock}</TableCell>
      <TableCell className="text-right">{dispensedCount}</TableCell>
      <TableCell className="text-sm max-w-[260px] truncate">{batch.recallReason ?? '-'}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {dispensedCount > 0 && (
            <Button size="sm" variant="outline" onClick={onShowAffected}>
              <Phone className="mr-1 h-3.5 w-3.5" />
              Affected Patients ({dispensedCount})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleUnrecall} disabled={unrecall.isPending}>
            Lift recall
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function FlagBatchPanel() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: batchesResp } = useBatches({ search: search || undefined, limit: 25 });
  const batches = batchesResp?.data.filter((b) => !b.isRecalled) ?? [];
  const recallBatch = useRecallBatch();

  const handleRecall = async () => {
    if (!selectedId) {
      toast.error('Pick a batch');
      return;
    }
    if (!reason.trim()) {
      toast.error('Recall reason is required');
      return;
    }
    if (!confirm('Recall this batch? All future dispensing will be blocked.')) return;
    try {
      await recallBatch.mutateAsync({ id: selectedId, recallReason: reason });
      toast.success('Batch recalled');
      setSelectedId(null);
      setReason('');
      setSearch('');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to recall');
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
      <div>
        <label className="text-xs font-medium">Find batch</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Drug name or batch number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {batches.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-md border">
          {batches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                selectedId === b.id ? 'bg-primary/10' : ''
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{b.drug?.drugName}</span>
                <span className="text-xs text-muted-foreground">Stock: {b.quantityInStock}</span>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Batch {b.batchNumber} · Exp {formatDate(b.expiryDate)}
              </div>
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-xs font-medium">Recall reason</label>
        <Textarea
          placeholder="e.g. manufacturer recall — contamination risk lot 2026-A"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleRecall} disabled={recallBatch.isPending}>
          <AlertOctagon className="mr-1.5 h-4 w-4" />
          Recall Batch
        </Button>
      </div>
    </div>
  );
}

function FlagDrugPanel() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: formularyResp } = useFormulary({ search: search || undefined, limit: 25, isActive: true });
  const drugs = formularyResp?.data.filter((d) => !d.isRecalled) ?? [];
  const recallDrug = useRecallDrug();

  const handleRecall = async () => {
    if (!selectedId) {
      toast.error('Pick a drug');
      return;
    }
    if (!reason.trim()) {
      toast.error('Recall reason is required');
      return;
    }
    if (!confirm('Recall this drug and ALL its batches? Dispensing will be blocked.')) return;
    try {
      await recallDrug.mutateAsync({ id: selectedId, recallReason: reason });
      toast.success('Drug recalled — all batches blocked');
      setSelectedId(null);
      setReason('');
      setSearch('');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to recall');
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
      <div>
        <label className="text-xs font-medium">Find drug</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Drug name or generic name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {drugs.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-md border">
          {drugs.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                selectedId === d.id ? 'bg-primary/10' : ''
              }`}
            >
              <div className="font-medium">{d.drugName}</div>
              <div className="text-xs text-muted-foreground">
                {d.genericName ?? ''}
                {d.category?.name ? ` · ${d.category.name}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-xs font-medium">Recall reason</label>
        <Textarea
          placeholder="e.g. nationwide product recall by manufacturer..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleRecall} disabled={recallDrug.isPending}>
          <AlertOctagon className="mr-1.5 h-4 w-4" />
          Recall Drug (all batches)
        </Button>
      </div>
    </div>
  );
}

function AffectedPatientsDialog({
  batchId,
  onClose,
}: {
  batchId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useRecallAffectedPatients(batchId);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Affected Patients</DialogTitle>
          {data && (
            <DialogDescription>
              {data.batch.drug.drugName} · Batch {data.batch.batchNumber}
              {' — '}
              {data.totalPatients} patients · {data.totalDispenses} dispenses
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || data.patients.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No dispensed records"
            description="This batch was never dispensed."
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                Recall reason: {data.batch.recallReason ?? 'n/a'}
              </p>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1 h-3.5 w-3.5" />
                Print
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Last Dispense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.patients.map((p) => (
                  <TableRow key={p.patientId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
                    <TableCell className="text-sm">
                      {p.phone ? (
                        <a className="hover:underline" href={`tel:${p.phone}`}>{p.phone}</a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.email ? (
                        <a className="hover:underline" href={`mailto:${p.email}`}>
                          <Mail className="inline h-3 w-3 mr-1" />
                          {p.email}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">{p.totalQuantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.dispenses[0] ? formatDateTimeAmPm(p.dispenses[0].dispensedAt) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PharmacyRecallsPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyRecallsPageInner />
    </PharmacyAdminGuard>
  );
}
