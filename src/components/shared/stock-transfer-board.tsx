'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeftRight, Search, Plus, ArrowRight, Clock, CheckCircle2, XCircle, Truck,
  Send, Inbox, Loader2, ChevronLeft, ChevronRight, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { apiGet } from '@/lib/api';
import {
  useStockTransfers, useCreateStockTransfer, useApproveStockTransfer,
  useRejectStockTransfer, useDispatchStockTransfer, useReceiveStockTransfer,
  useCancelStockTransfer,
  type StockTransferStatus,
} from '@/hooks/use-inventory';

const STATUS_LABEL: Record<StockTransferStatus, string> = {
  pending: 'Pending', approved: 'Approved', dispatched: 'Dispatched',
  received: 'Received', rejected: 'Rejected', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<StockTransferStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-blue-100 text-blue-700 border-blue-300',
  dispatched: 'bg-purple-100 text-purple-700 border-purple-300',
  received: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
  cancelled: 'bg-gray-200 text-gray-700 border-gray-300',
};

const STATUS_FILTERS: Array<{ key: StockTransferStatus | 'all'; label: string; icon: typeof Clock }> = [
  { key: 'all', label: 'All', icon: ArrowLeftRight },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'dispatched', label: 'Dispatched', icon: Send },
  { key: 'received', label: 'Received', icon: Inbox },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
];

const createSchema = z.object({
  // Exactly one of inventoryItemId / drugBatchId (drug batch = pharmacy stock).
  inventoryItemId: z.string().optional(),
  drugBatchId: z.string().optional(),
  fromDepartmentId: z.string().optional(),
  toDepartmentId: z.string().optional(),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  // Keep quantity as a string in form state so z's coerce->unknown typing
  // mismatch with react-hook-form's Resolver doesn't fight us.
  quantityRequested: z.string().refine((v) => /^\d+$/.test(v) && Number(v) > 0, 'Quantity must be positive'),
  batchNumber: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => !!d.inventoryItemId || !!d.drugBatchId, {
  message: 'Select an item or a pharmacy drug',
  path: ['inventoryItemId'],
}).refine((d) => d.fromDepartmentId || d.fromLocation, {
  message: 'Choose a source department or location',
  path: ['fromDepartmentId'],
}).refine((d) => d.toDepartmentId || d.toLocation, {
  message: 'Choose a destination department or location',
  path: ['toDepartmentId'],
});
type CreateForm = z.infer<typeof createSchema>;

// A transfer endpoint (source/destination) can be a department, a ward, or a
// free-typed location. Departments use the FK; wards + custom locations are
// stored in the location text field (the model has no wardId).
type EndpointType = 'department' | 'ward' | 'location';

// What's being moved: a generic inventory item, or a pharmacy drug batch.
type ItemKind = 'inventory' | 'drug';

interface Dept { id: string; name: string }
interface ItemRow { id: string; itemName: string; itemCode?: string | null; currentStock: number; unitOfMeasurement?: string | null }
interface DrugBatchRow { id: string; batchNumber: string; quantityInStock: number; drug?: { drugName: string } | null }

interface Props {
  /** Title for the page header */
  title?: string;
  /** Description shown under the title */
  description?: string;
  /** When provided, locks the "from" / "to" side of every new transfer (e.g. OT module) */
  defaultFromDepartmentId?: string;
  defaultToDepartmentId?: string;
}

export function StockTransferBoard({
  title = 'Stock Transfer',
  description = 'Move stock between departments — pharmacy, OT, ward, lab and warehouse',
  defaultFromDepartmentId,
  defaultToDepartmentId,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StockTransferStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const params = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search.trim() || undefined,
    page,
    limit: 20,
  };
  const { data, isLoading } = useStockTransfers(params);
  const transfers = data?.data ?? [];
  const meta = data?.meta;

  // Counts for stat tiles
  const { data: allData } = useStockTransfers({ limit: 1000 });
  const counts = useMemo(() => {
    const all = allData?.data ?? [];
    const c: Record<string, number> = { all: all.length };
    for (const t of all) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [allData]);

  // Mutations
  const approve = useApproveStockTransfer();
  const reject = useRejectStockTransfer();
  const dispatch = useDispatchStockTransfer();
  const receive = useReceiveStockTransfer();
  const cancel = useCancelStockTransfer();

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title={title}
        description={description}
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Transfer
          </Button>
        }
      />

      {/* Stat pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={`flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[88px] shadow-sm transition-all duration-150 hover:-translate-y-0.5 ${active ? 'border-primary bg-primary/10 shadow-md' : 'border-transparent bg-card hover:border-border'}`}
            >
              <span className="text-lg font-bold">{counts[f.key] ?? 0}</span>
              <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <f.icon className="h-3 w-3" /> {f.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transfer #, item, department..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-40 w-full" /></div>
        ) : transfers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ArrowLeftRight}
              title="No stock transfers"
              description="Create your first transfer to start moving stock between departments."
              action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Transfer</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Transfer #</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">From → To</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{t.transferNumber}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {t.inventoryItem?.itemName ?? t.drugBatch?.drug?.drugName ?? '-'}
                        {t.drugBatch && (
                          <span className="ml-1.5 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Pharmacy</span>
                        )}
                      </div>
                      {(t.drugBatch?.batchNumber || t.batchNumber) && (
                        <div className="text-xs text-muted-foreground">Batch: {t.drugBatch?.batchNumber ?? t.batchNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{t.fromDepartment?.name ?? t.fromLocation ?? '-'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>{t.toDepartment?.name ?? t.toLocation ?? '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {t.quantityTransferred > 0 ? `${t.quantityTransferred} / ` : ''}
                      {t.quantityRequested}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLOR[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {t.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-700 hover:bg-emerald-50 h-8"
                              onClick={() => approve.mutate({ id: t.id }, {
                                onSuccess: () => toast.success('Transfer approved'),
                                onError: (e: any) => toast.error(e?.message ?? 'Approve failed'),
                              })}
                              disabled={approve.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-700 hover:bg-red-50 h-8"
                              onClick={() => setRejectingId(t.id)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {t.status === 'approved' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-purple-700 hover:bg-purple-50 h-8"
                              onClick={() => dispatch.mutate({ id: t.id }, {
                                onSuccess: () => toast.success('Transfer dispatched'),
                                onError: (e: any) => toast.error(e?.message ?? 'Dispatch failed'),
                              })}
                              disabled={dispatch.isPending}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" /> Dispatch
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-600 hover:bg-gray-50 h-8"
                              onClick={() => cancel.mutate({ id: t.id }, {
                                onSuccess: () => toast.success('Cancelled'),
                                onError: (e: any) => toast.error(e?.message ?? 'Cancel failed'),
                              })}
                              disabled={cancel.isPending}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
                            </Button>
                          </>
                        )}
                        {t.status === 'dispatched' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-700 hover:bg-emerald-50 h-8"
                            onClick={() => receive.mutate(t.id, {
                              onSuccess: () => toast.success('Transfer received'),
                              onError: (e: any) => toast.error(e?.message ?? 'Receive failed'),
                            })}
                            disabled={receive.isPending}
                          >
                            <Inbox className="h-3.5 w-3.5 mr-1" /> Receive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateTransferDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultFromDepartmentId={defaultFromDepartmentId}
        defaultToDepartmentId={defaultToDepartmentId}
      />

      <Dialog open={rejectingId !== null} onOpenChange={(o) => { if (!o) { setRejectingId(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this transfer rejected?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
            <Button
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => {
                if (!rejectingId) return;
                reject.mutate({ id: rejectingId, rejectionReason: rejectReason }, {
                  onSuccess: () => {
                    toast.success('Transfer rejected');
                    setRejectingId(null);
                    setRejectReason('');
                  },
                  onError: (e: any) => toast.error(e?.message ?? 'Reject failed'),
                });
              }}
            >
              {reject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateTransferDialog({
  open, onOpenChange, defaultFromDepartmentId, defaultToDepartmentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultFromDepartmentId?: string;
  defaultToDepartmentId?: string;
}) {
  const create = useCreateStockTransfer();

  const { data: deptsResp } = useQuery({
    queryKey: ['infrastructure', 'departments', 'all'],
    queryFn: async () => {
      const r = await apiGet<Dept[]>('/infrastructure/departments', { params: { limit: 200 } });
      return r.data;
    },
  });
  const departments = deptsResp ?? [];

  // Wards are offered as a transfer source/destination too (e.g. pharmacy →
  // ward). The StockTransfer model has no wardId, so a ward is stored in the
  // fromLocation / toLocation text field (its name).
  const { data: wardsResp } = useQuery({
    queryKey: ['infrastructure', 'wards', 'all'],
    queryFn: async () => {
      const r = await apiGet<Dept[]>('/infrastructure/wards', { params: { limit: 300 } });
      return r.data;
    },
  });
  const wards = wardsResp ?? [];

  // What's being moved: a generic inventory item or a pharmacy drug batch.
  const [itemKind, setItemKind] = useState<ItemKind>('inventory');

  const [itemSearch, setItemSearch] = useState('');
  const { data: itemsResp } = useQuery({
    queryKey: ['inventory', 'items', 'search', itemSearch],
    queryFn: async () => {
      const r = await apiGet<ItemRow[]>('/inventory/items', { params: { search: itemSearch || undefined, isActive: true, limit: 30 } });
      return r.data;
    },
    enabled: itemKind === 'inventory',
  });
  const items = itemsResp ?? [];

  // Pharmacy drug batches (in-stock) for issuing drug stock from the pharmacy.
  const [drugSearch, setDrugSearch] = useState('');
  const { data: drugsResp } = useQuery({
    queryKey: ['pharmacy', 'batches', 'transfer-search', drugSearch],
    queryFn: async () => {
      const r = await apiGet<DrugBatchRow[]>('/pharmacy/batches', {
        params: { search: drugSearch || undefined, availableOnly: true, limit: 30 },
      });
      return r.data;
    },
    enabled: itemKind === 'drug',
  });
  const drugBatches = drugsResp ?? [];

  const {
    register, handleSubmit, setValue, watch, reset, formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      inventoryItemId: '',
      drugBatchId: '',
      fromDepartmentId: defaultFromDepartmentId ?? '',
      toDepartmentId: defaultToDepartmentId ?? '',
      fromLocation: '',
      toLocation: '',
      quantityRequested: '1',
      batchNumber: '',
      reason: '',
      notes: '',
    },
  });

  const selectedItemId = watch('inventoryItemId');
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [selectedItemId, items],
  );
  const selectedDrugId = watch('drugBatchId');
  const selectedDrug = useMemo(
    () => drugBatches.find((b) => b.id === selectedDrugId) ?? null,
    [selectedDrugId, drugBatches],
  );

  // Each side can be a Department (FK), a Ward (stored as location name), or a
  // free-text location.
  const [fromType, setFromType] = useState<EndpointType>('department');
  const [toType, setToType] = useState<EndpointType>('department');

  // Default the source to the "Pharmacy" department when one exists and the
  // caller didn't pin a source — supports "transfer from pharmacy" out of the box.
  const pharmacyDeptId = useMemo(
    () => departments.find((d) => /pharmac/i.test(d.name))?.id,
    [departments],
  );
  useEffect(() => {
    if (open && !defaultFromDepartmentId && fromType === 'department' && pharmacyDeptId && !watch('fromDepartmentId')) {
      setValue('fromDepartmentId', pharmacyDeptId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pharmacyDeptId]);

  const close = () => {
    reset();
    setItemSearch('');
    setDrugSearch('');
    setItemKind('inventory');
    setFromType('department');
    setToType('department');
    onOpenChange(false);
  };

  // Switching item kind clears the other reference so only one is ever sent.
  const changeItemKind = (k: ItemKind) => {
    setItemKind(k);
    setValue('inventoryItemId', '');
    setValue('drugBatchId', '');
  };

  // Switching a side's type resets that side's department + location so the two
  // never carry stale conflicting values.
  const changeFromType = (t: EndpointType) => {
    setFromType(t);
    setValue('fromDepartmentId', '');
    setValue('fromLocation', '');
  };
  const changeToType = (t: EndpointType) => {
    setToType(t);
    setValue('toDepartmentId', '');
    setValue('toLocation', '');
  };

  const onSubmit = (values: CreateForm) => {
    create.mutate(
      {
        inventoryItemId: values.inventoryItemId || undefined,
        drugBatchId: values.drugBatchId || undefined,
        fromDepartmentId: values.fromDepartmentId || undefined,
        toDepartmentId: values.toDepartmentId || undefined,
        fromLocation: values.fromLocation || undefined,
        toLocation: values.toLocation || undefined,
        quantityRequested: Number(values.quantityRequested),
        batchNumber: values.batchNumber || undefined,
        reason: values.reason || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Transfer request created');
          close();
        },
        onError: (e: any) => toast.error(e?.message ?? 'Failed to create transfer'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Stock Transfer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Item picker — generic inventory item OR a pharmacy drug batch */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Item *</Label>
              <div className="flex gap-0.5 rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => changeItemKind('inventory')}
                  className={cn('rounded px-2 py-1 transition', itemKind === 'inventory' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                >
                  Inventory
                </button>
                <button
                  type="button"
                  onClick={() => changeItemKind('drug')}
                  className={cn('rounded px-2 py-1 transition', itemKind === 'drug' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                >
                  Pharmacy drug
                </button>
              </div>
            </div>

            {itemKind === 'inventory' ? (
              selectedItem ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                  <div>
                    <span className="font-medium">{selectedItem.itemName}</span>
                    {selectedItem.itemCode && (
                      <span className="ml-2 text-xs text-muted-foreground">{selectedItem.itemCode}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Current stock: {selectedItem.currentStock} {selectedItem.unitOfMeasurement ?? ''}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue('inventoryItemId', '')}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Search items by name or code..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  {itemSearch.length >= 2 && (
                    <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                      {items.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No items found</div>
                      ) : (
                        items.map((it) => (
                          <button
                            type="button"
                            key={it.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                            onClick={() => setValue('inventoryItemId', it.id, { shouldValidate: true })}
                          >
                            <span className="font-medium">{it.itemName}</span>
                            {it.itemCode && <span className="ml-2 text-muted-foreground">{it.itemCode}</span>}
                            <span className="ml-2 text-xs text-muted-foreground">
                              stock: {it.currentStock} {it.unitOfMeasurement ?? ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            ) : selectedDrug ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                <div>
                  <span className="font-medium">{selectedDrug.drug?.drugName ?? 'Drug'}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">batch {selectedDrug.batchNumber}</span>
                  <div className="text-xs text-muted-foreground">In stock: {selectedDrug.quantityInStock}</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue('drugBatchId', '')}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="Search pharmacy drugs by name or batch..."
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                />
                {drugSearch.length >= 2 && (
                  <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                    {drugBatches.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No in-stock drug batches found</div>
                    ) : (
                      drugBatches.map((b) => (
                        <button
                          type="button"
                          key={b.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                          onClick={() => setValue('drugBatchId', b.id, { shouldValidate: true })}
                        >
                          <span className="font-medium">{b.drug?.drugName ?? 'Drug'}</span>
                          <span className="ml-2 text-muted-foreground font-mono">batch {b.batchNumber}</span>
                          <span className="ml-2 text-xs text-muted-foreground">stock: {b.quantityInStock}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {errors.inventoryItemId && (
              <p className="text-xs text-red-500">{errors.inventoryItemId.message}</p>
            )}
          </div>

          {/* From / To — each side can be a department, a ward, or a custom location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EndpointPicker
              label="From"
              type={fromType}
              onTypeChange={changeFromType}
              deptId={watch('fromDepartmentId') ?? ''}
              onDeptChange={(v) => { setValue('fromDepartmentId', v); setValue('fromLocation', ''); }}
              location={watch('fromLocation') ?? ''}
              onLocationChange={(v) => { setValue('fromLocation', v); setValue('fromDepartmentId', ''); }}
              departments={departments}
              wards={wards}
              error={errors.fromDepartmentId?.message}
            />
            <EndpointPicker
              label="To"
              type={toType}
              onTypeChange={changeToType}
              deptId={watch('toDepartmentId') ?? ''}
              onDeptChange={(v) => { setValue('toDepartmentId', v); setValue('toLocation', ''); }}
              location={watch('toLocation') ?? ''}
              onLocationChange={(v) => { setValue('toLocation', v); setValue('toDepartmentId', ''); }}
              departments={departments}
              wards={wards}
              error={errors.toDepartmentId?.message}
            />
          </div>

          {/* Qty + batch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min={1} {...register('quantityRequested')} />
              {errors.quantityRequested && (
                <p className="text-xs text-red-500 mt-1">{errors.quantityRequested.message}</p>
              )}
            </div>
            <div>
              <Label>Batch # (optional)</Label>
              <Input {...register('batchNumber')} placeholder="e.g., BTH-2023-08-001" />
            </div>
          </div>

          <div>
            <Label>Reason</Label>
            <Input {...register('reason')} placeholder="e.g., Patient procedure, scheduled surgery" />
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Additional notes..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              <Truck className="h-4 w-4 mr-1.5" />
              Create Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// One transfer endpoint (From / To): pick a department, a ward, or a custom
// location. Wards + custom locations are written to the location text field.
function EndpointPicker({
  label, type, onTypeChange, deptId, onDeptChange, location, onLocationChange,
  departments, wards, error,
}: {
  label: string;
  type: EndpointType;
  onTypeChange: (t: EndpointType) => void;
  deptId: string;
  onDeptChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  departments: Dept[];
  wards: Dept[];
  error?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={type} onValueChange={(v) => v && onTypeChange(v as EndpointType)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Department</SelectItem>
          <SelectItem value="ward">Ward</SelectItem>
          <SelectItem value="location">Other location</SelectItem>
        </SelectContent>
      </Select>

      {type === 'department' && (
        <Select
          value={deptId || 'none'}
          onValueChange={(v) => onDeptChange(v === 'none' ? '' : (v ?? ''))}
        >
          <SelectTrigger className="mt-2"><SelectValue placeholder="Pick department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— external / warehouse —</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === 'ward' && (
        <Select
          value={location || 'none'}
          onValueChange={(v) => onLocationChange(v === 'none' ? '' : (v ?? ''))}
        >
          <SelectTrigger className="mt-2"><SelectValue placeholder="Pick ward" /></SelectTrigger>
          <SelectContent>
            {wards.length === 0 ? (
              <SelectItem value="none" disabled>No wards available</SelectItem>
            ) : (
              wards.map((w) => (
                <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {type === 'location' && (
        <Input
          className="mt-2"
          placeholder="e.g. Central Warehouse"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
        />
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
