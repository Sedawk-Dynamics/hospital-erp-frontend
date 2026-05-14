'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate } from '@/lib/date-utils';
import {
  Search, Plus, Pencil, Trash2, Loader2, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import {
  useInventoryItems, useCreateItem, useUpdateItem, useDeleteItem,
  type InventoryItem, type InventoryCategory,
} from '@/hooks/use-inventory';

const CATEGORIES: Array<{ value: InventoryCategory; label: string }> = [
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'drug', label: 'Drug' },
  { value: 'other', label: 'Other' },
];

// Numeric fields are stored as strings to dodge the zod-coerce ↔ react-hook-form
// Resolver typing mismatch; we coerce at submit time.
const itemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  itemCode: z.string().optional(),
  category: z.enum(['drug', 'consumable', 'surgical_supply', 'equipment', 'other']),
  unitOfMeasurement: z.string().optional(),
  description: z.string().optional(),
  minimumStockThreshold: z.string().refine((v) => /^\d+$/.test(v), 'Must be a whole number'),
  currentStock: z.string().refine((v) => /^\d+$/.test(v), 'Must be a whole number'),
  costPerUnit: z.string().optional(),
  sellingPricePerUnit: z.string().optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

function rupees(n: number | string | null) {
  if (n == null || n === '') return '-';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function OTInventoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<InventoryCategory | 'all'>('surgical_supply');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const { data, isLoading } = useInventoryItems({
    page,
    limit: 20,
    search: search.trim() || undefined,
    category: category === 'all' ? undefined : category,
    isActive: true,
  });
  const items = (data?.data ?? []) as InventoryItem[];

  const create = useCreateItem();
  const update = useUpdateItem();
  const remove = useDeleteItem();

  const columns: Column<InventoryItem & Record<string, unknown>>[] = [
    {
      key: 'itemName',
      label: 'Item',
      sortable: true,
      render: (it) => (
        <div>
          <p className="font-medium text-foreground">{it.itemName}</p>
          {it.itemCode && <p className="text-xs text-muted-foreground">{it.itemCode}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (it) => <span className="capitalize text-muted-foreground">{it.category.replace('_', ' ')}</span>,
    },
    {
      key: 'currentStock',
      label: 'Stock',
      render: (it) => `${it.currentStock} ${it.unitOfMeasurement ?? ''}`,
    },
    {
      key: 'costPerUnit',
      label: 'Unit Cost',
      render: (it) => rupees(it.costPerUnit),
    },
    {
      key: 'status',
      label: 'Status',
      render: (it) => {
        if (it.currentStock === 0) return <StatusBadge status="out_of_stock" />;
        if (it.minimumStockThreshold && it.currentStock <= it.minimumStockThreshold) return <StatusBadge status="low_stock" />;
        return <StatusBadge status="in_stock" />;
      },
    },
    {
      key: 'createdAt',
      label: 'Added',
      render: (it) => formatDate(it.createdAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-center w-[100px]',
      render: (it) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); setEditing(it); setDialogOpen(true); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${it.itemName}"?`)) {
                remove.mutate(it.id, {
                  onSuccess: () => toast.success('Item deleted'),
                  onError: (err: any) => toast.error(err?.message ?? 'Delete failed'),
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="OT Inventory Management"
        description="OT equipment, surgical instruments and consumables — create, edit and track stock"
        action={
          <Button className="gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory((v ?? 'all') as InventoryCategory | 'all'); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items as Array<InventoryItem & Record<string, unknown>>}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No items yet. Click 'Add Item' to register your first OT inventory."
      />

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={(values) => {
          const payload = {
            itemName: values.itemName,
            itemCode: values.itemCode || undefined,
            category: values.category,
            description: values.description || undefined,
            unitOfMeasurement: values.unitOfMeasurement || undefined,
            minimumStockThreshold: Number(values.minimumStockThreshold),
            currentStock: Number(values.currentStock),
            costPerUnit: values.costPerUnit ? Number(values.costPerUnit) : undefined,
            sellingPricePerUnit: values.sellingPricePerUnit ? Number(values.sellingPricePerUnit) : undefined,
          };
          if (editing) {
            update.mutate(
              { id: editing.id, ...payload },
              {
                onSuccess: () => { toast.success('Item updated'); setDialogOpen(false); },
                onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
              },
            );
          } else {
            create.mutate(payload, {
              onSuccess: () => { toast.success('Item added'); setDialogOpen(false); },
              onError: (e: any) => toast.error(e?.message ?? 'Create failed'),
            });
          }
        }}
        isPending={create.isPending || update.isPending}
      />
    </div>
  );
}

function ItemDialog({
  open, onOpenChange, editing, onSubmit, isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: InventoryItem | null;
  onSubmit: (values: ItemForm) => void;
  isPending: boolean;
}) {
  const {
    register, handleSubmit, setValue, watch, reset, formState: { errors },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemName: '',
      itemCode: '',
      category: 'surgical_supply',
      unitOfMeasurement: '',
      description: '',
      minimumStockThreshold: '10',
      currentStock: '0',
      costPerUnit: '',
      sellingPricePerUnit: '',
    },
  });

  // Whenever the parent flips the editing target (incl. setting it to null for
  // an "Add" flow), repopulate the form so we never show stale values.
  useEffect(() => {
    if (!open) return;
    reset({
      itemName: editing?.itemName ?? '',
      itemCode: editing?.itemCode ?? '',
      category: (editing?.category ?? 'surgical_supply') as InventoryCategory,
      unitOfMeasurement: editing?.unitOfMeasurement ?? '',
      description: editing?.description ?? '',
      minimumStockThreshold: String(editing?.minimumStockThreshold ?? 10),
      currentStock: String(editing?.currentStock ?? 0),
      costPerUnit: editing?.costPerUnit != null ? String(editing.costPerUnit) : '',
      sellingPricePerUnit: editing?.sellingPricePerUnit != null ? String(editing.sellingPricePerUnit) : '',
    });
  }, [editing, open, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Item' : 'Add OT Inventory Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Item Name *</Label>
              <Input {...register('itemName')} placeholder="e.g., Suture Vicryl 2-0" />
              {errors.itemName && <p className="text-xs text-red-500 mt-1">{errors.itemName.message}</p>}
            </div>
            <div>
              <Label>Item Code</Label>
              <Input {...register('itemCode')} placeholder="SKU / internal code" />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={watch('category')}
                onValueChange={(v) => setValue('category', (v ?? 'surgical_supply') as InventoryCategory)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit (e.g., box, pcs)</Label>
              <Input {...register('unitOfMeasurement')} placeholder="pcs" />
            </div>
            <div>
              <Label>Reorder Threshold</Label>
              <Input type="number" min={0} {...register('minimumStockThreshold')} />
            </div>
            <div>
              <Label>{editing ? 'Current Stock (display only)' : 'Initial Stock'}</Label>
              <Input type="number" min={0} {...register('currentStock')} disabled={!!editing} />
            </div>
            <div>
              <Label>Cost / Unit (₹)</Label>
              <Input type="number" min={0} step="0.01" {...register('costPerUnit')} />
            </div>
            <div className="col-span-2">
              <Label>Selling Price / Unit (₹)</Label>
              <Input type="number" min={0} step="0.01" {...register('sellingPricePerUnit')} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <textarea
                {...register('description')}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              <Package className="h-4 w-4 mr-1.5" />
              {editing ? 'Save' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
