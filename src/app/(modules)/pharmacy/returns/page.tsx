'use client';

import { useState, useMemo } from 'react';
import {
  RotateCcw, Search, CheckCircle2, XCircle, Building2, User, Plus,
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
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useReturns, useCreateReturn, useProcessReturn, useBatches,
  type PharmacyReturn,
} from '@/hooks/use-pharmacy';

type ReturnTab = 'all' | 'pending' | 'processed' | 'rejected';
type CreateMode = 'patient_return' | 'vendor_return';

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
            Patient returns restock the batch on approval. Vendor returns log damaged/unsold stock.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateOpen('patient_return')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Patient Return
          </Button>
          {isPharmacyAdmin && (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen('vendor_return')}>
              <Plus className="mr-1.5 h-4 w-4" />
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
      await processReturn.mutateAsync({ id: record.id, status });
      toast.success(status === 'processed' ? 'Return processed — stock restored' : 'Return rejected');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to process return');
    }
  };

  const typeBadge =
    record.returnType === 'patient_return' ? (
      <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
        <User className="mr-1 h-3 w-3" /> Patient
      </Badge>
    ) : (
      <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">
        <Building2 className="mr-1 h-3 w-3" /> Vendor
      </Badge>
    );

  const statusBadge = {
    pending: <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Pending</Badge>,
    processed: <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Processed</Badge>,
    rejected: <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Rejected</Badge>,
  }[record.status];

  return (
    <TableRow>
      <TableCell>{typeBadge}</TableCell>
      <TableCell>
        <div className="font-medium">{record.drugBatch?.drug?.drugName ?? '-'}</div>
        <div className="text-xs text-muted-foreground font-mono">{record.drugBatch?.batchNumber}</div>
      </TableCell>
      <TableCell className="text-sm">
        {record.returnType === 'patient_return'
          ? record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : '-'
          : record.supplier?.name ?? '-'}
      </TableCell>
      <TableCell className="text-right">{record.quantity}</TableCell>
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
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const { data: batchesResp } = useBatches({
    search: batchSearch || undefined,
    limit: 25,
  });
  const batches = batchesResp?.data ?? [];

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId),
    [batches, selectedBatchId],
  );

  const createReturn = useCreateReturn();

  const handleSubmit = async () => {
    if (!selectedBatchId) {
      toast.error('Pick a batch');
      return;
    }
    if (quantity <= 0) {
      toast.error('Enter a quantity');
      return;
    }
    try {
      await createReturn.mutateAsync({
        returnType: mode,
        drugBatchId: selectedBatchId,
        // Patient is optional for a counter return — not collected here.
        supplierId:
          mode === 'vendor_return'
            ? supplierId || selectedBatch?.supplier?.id
            : undefined,
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
          <DialogTitle>
            {mode === 'patient_return' ? 'New Patient Return' : 'New Vendor Return'}
          </DialogTitle>
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
                  <div className="text-xs text-muted-foreground font-mono">
                    Batch {b.batchNumber}
                  </div>
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

          {mode === 'vendor_return' && (
            <div>
              <label className="text-xs font-medium">Supplier ID (optional)</label>
              <Input
                placeholder={selectedBatch?.supplier?.id ?? 'Defaults to batch supplier'}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Reason</label>
            <Textarea
              placeholder={
                mode === 'patient_return'
                  ? 'e.g. unused, allergic reaction, wrong dispense...'
                  : 'e.g. damaged on receipt, expired, recall...'
              }
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
