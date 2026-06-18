'use client';

import { useState } from 'react';
import { Search, Plus, Pencil, Power, Building2, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { VendorFormDialog } from '@/components/inventory/vendor-form-dialog';
import { useSuppliers, useUpdateSupplier, type Supplier } from '@/hooks/use-inventory';

export default function VendorMasterPage() {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data, isLoading } = useSuppliers({ limit: 200, isActive: showInactive ? undefined : true });
  const update = useUpdateSupplier();
  const all = data?.data ?? [];
  const vendors = all.filter((s) =>
    !search.trim()
      ? true
      : [s.name, s.gstNumber, s.contactPerson, s.phone].some((f) =>
          (f ?? '').toLowerCase().includes(search.toLowerCase()),
        ),
  );

  const startCreate = () => { setEditing(null); setFormOpen(true); };
  const startEdit = (v: Supplier) => { setEditing(v); setFormOpen(true); };

  const toggleActive = async (v: Supplier) => {
    try {
      await update.mutateAsync({ id: v.id, isActive: !v.isActive });
      toast.success(v.isActive ? 'Vendor deactivated' : 'Vendor reactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update vendor');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Your distributor master. Saved details auto-fill on every stock inward — only invoice
            number, date and amounts change per delivery.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, GSTIN, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          variant={showInactive ? 'default' : 'outline'}
          onClick={() => setShowInactive((s) => !s)}
        >
          {showInactive ? 'Showing inactive' : 'Show inactive'}
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No vendors yet"
            description="Add your regular distributors so stock inward auto-fills their details."
            action={<Button size="sm" onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Vendor</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Drug Licence</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="font-medium">{v.name}</div>
                    {v.address && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{v.address}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{v.gstNumber ?? '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{v.licenseNumber ?? '-'}</TableCell>
                  <TableCell className="text-sm">
                    {v.contactPerson && <div>{v.contactPerson}</div>}
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {v.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</span>}
                      {v.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {v.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit vendor" onClick={() => startEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        title={v.isActive ? 'Deactivate vendor' : 'Reactivate vendor'}
                        onClick={() => toggleActive(v)}
                        disabled={update.isPending}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <VendorFormDialog open={formOpen} onOpenChange={setFormOpen} vendor={editing} />
    </div>
  );
}
