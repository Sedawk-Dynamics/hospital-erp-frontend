'use client';

import { useState } from 'react';
import { Users, Plus, Edit2, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  type Supplier, type CreateSupplierInput, type SupplyType,
} from '@/hooks/use-inventory';

const SUPPLY_TYPES: { value: SupplyType; label: string }[] = [
  { value: 'drugs', label: 'Drugs' },
  { value: 'consumables', label: 'Consumables' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'all', label: 'All' },
];

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const { data, isLoading } = useSuppliers({ search: search || undefined, limit: 50 });
  const suppliers = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> Suppliers
          </h1>
          <p className="text-xs text-muted-foreground">
            Master list of vendors. Linked to purchase orders, batches, and returns.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Supplier
        </Button>
      </div>

      <div className="relative max-w-md">
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState icon={Users} title="No suppliers" description="Add your first supplier." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.contactPerson ?? '-'}</TableCell>
                  <TableCell className="text-sm">
                    {s.phone ? (<a href={`tel:${s.phone}`} className="hover:underline"><Phone className="inline h-3 w-3 mr-1" />{s.phone}</a>) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.email ? (<a href={`mailto:${s.email}`} className="hover:underline"><Mail className="inline h-3 w-3 mr-1" />{s.email}</a>) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.gstNumber ?? '-'}</TableCell>
                  <TableCell>
                    {s.supplyType ? <Badge variant="outline" className="text-xs">{s.supplyType}</Badge> : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Active</Badge>
                    ) : (
                      <Badge className="bg-muted">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditSupplier(s)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(createOpen || editSupplier) && (
        <SupplierDialog
          supplier={editSupplier}
          onClose={() => {
            setCreateOpen(false);
            setEditSupplier(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState<CreateSupplierInput & { isActive?: boolean }>({
    name: supplier?.name ?? '',
    contactPerson: supplier?.contactPerson ?? undefined,
    phone: supplier?.phone ?? undefined,
    email: supplier?.email ?? undefined,
    address: supplier?.address ?? undefined,
    gstNumber: supplier?.gstNumber ?? undefined,
    licenseNumber: supplier?.licenseNumber ?? undefined,
    supplyType: supplier?.supplyType ?? undefined,
    isActive: supplier?.isActive ?? true,
  });

  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const del = useDeleteSupplier();

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (isEdit && supplier) {
        await update.mutateAsync({ id: supplier.id, ...form });
        toast.success('Supplier updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Supplier created');
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  const handleDeactivate = async () => {
    if (!supplier) return;
    if (!confirm('Deactivate this supplier?')) return;
    try {
      await del.mutateAsync(supplier.id);
      toast.success('Supplier deactivated');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Name *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Contact Person</label>
              <Input value={form.contactPerson ?? ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs font-medium">Phone</label>
              <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value || undefined })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Email</label>
            <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || undefined })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">GST Number</label>
              <Input value={form.gstNumber ?? ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value || undefined })} />
            </div>
            <div>
              <label className="text-xs font-medium">License Number</label>
              <Input value={form.licenseNumber ?? ''} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value || undefined })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Supply Type</label>
            <Select
              value={form.supplyType ?? ''}
              onValueChange={(v) => setForm({ ...form, supplyType: v ? (v as SupplyType) : undefined })}
            >
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {SUPPLY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Address</label>
            <Textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value || undefined })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          {isEdit && (
            <Button variant="destructive" onClick={handleDeactivate} disabled={del.isPending}>
              Deactivate
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
