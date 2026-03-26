'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useTenants, useCreateTenant, useDeactivateTenant, useActivateTenant, useHardDeleteTenant, type Tenant } from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate } from '@/lib/date-utils';

export default function HospitalsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useTenants({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  const createTenant = useCreateTenant();
  const deactivateTenant = useDeactivateTenant();
  const activateTenant = useActivateTenant();
  const hardDeleteTenant = useHardDeleteTenant();

  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required');
      return;
    }
    try {
      await createTenant.mutateAsync(formData);
      toast.success('Hospital created successfully');
      setDialogOpen(false);
      setFormData({ name: '', slug: '', email: '', phone: '', address: '', city: '', state: '', country: '' });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create hospital';
      toast.error(message);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate "${name}"?`)) return;
    try {
      await deactivateTenant.mutateAsync(id);
      toast.success(`${name} has been deactivated`);
    } catch {
      toast.error('Failed to deactivate hospital');
    }
  };

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      label: 'Hospital Name',
      sortable: true,
      render: (item) => (
        <div
          className="cursor-pointer"
          onClick={() => router.push(`/super-admin/hospitals/${item.id}`)}
        >
          <p className="font-label text-sm font-bold text-primary hover:underline">{item.name}</p>
          <p className="font-label text-[10px] text-on-surface-variant">{item.slug}</p>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (item) => <span className="font-label text-sm">{item.email || '-'}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (item) => <span className="font-label text-sm">{item.phone || '-'}</span>,
    },
    {
      key: 'users',
      label: 'Users',
      render: (item) => <span className="font-label text-sm font-bold">{item._count?.users ?? 0}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Onboarded',
      sortable: true,
      render: (item) => <span className="font-label text-sm">{formatDate(item.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/super-admin/hospitals/${item.id}`)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
          {item.isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeactivate(item.id, item.name)}
              disabled={deactivateTenant.isPending}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await activateTenant.mutateAsync(item.id);
                  toast.success(`${item.name} has been activated`);
                } catch {
                  toast.error('Failed to activate hospital');
                }
              }}
              disabled={activateTenant.isPending}
            >
              Activate
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget(item)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Hospitals</h1>
          <p className="font-label text-sm text-on-surface-variant">Manage tenant hospitals on the platform</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Hospital
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline text-lg font-bold">Add New Hospital</DialogTitle>
              <DialogDescription className="font-label text-sm text-on-surface-variant">
                Onboard a new hospital to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Name *</Label>
                  <Input
                    id="name"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({
                      ...p,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    }))}
                    placeholder="City General Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Slug *</Label>
                  <Input
                    id="slug"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="city-general"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="admin@hospital.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Phone</Label>
                  <Input
                    id="phone"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Address</Label>
                <Input
                  id="address"
                  className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Medical Ave"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">City</Label>
                  <Input
                    id="city"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">State</Label>
                  <Input
                    id="state"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.state}
                    onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Country</Label>
                  <Input
                    id="country"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    value={formData.country}
                    onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" onClick={handleCreate} disabled={createTenant.isPending}>
                {createTenant.isPending ? 'Creating...' : 'Create Hospital'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        searchPlaceholder="Search hospitals..."
        onSearch={setSearch}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No hospitals found."
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Permanently Delete Hospital"
        description={`This will permanently delete "${deleteTarget?.name}" and ALL its data including users, patients, appointments, bills, and more. This action cannot be undone.`}
        confirmText={deleteTarget?.name}
        confirmLabel="Delete Forever"
        isLoading={hardDeleteTenant.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await hardDeleteTenant.mutateAsync(deleteTarget.id);
            toast.success(`${deleteTarget.name} has been permanently deleted`);
            setDeleteTarget(null);
          } catch {
            toast.error('Failed to delete hospital');
          }
        }}
      />
    </div>
  );
}
