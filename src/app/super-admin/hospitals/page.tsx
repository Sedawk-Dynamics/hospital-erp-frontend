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
import { useTenants, useCreateTenant, useDeactivateTenant, type Tenant } from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';

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
          <p className="font-medium text-primary hover:underline">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.slug}</p>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (item) => item.email || '-',
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (item) => item.phone || '-',
    },
    {
      key: 'users',
      label: 'Users',
      render: (item) => item._count?.users ?? 0,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => (
        <Badge variant={item.isActive ? 'default' : 'destructive'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Onboarded',
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
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
          {item.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeactivate(item.id, item.name)}
              disabled={deactivateTenant.isPending}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Hospitals</h1>
          <p className="text-sm text-muted-foreground">Manage tenant hospitals on the platform</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Hospital
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Hospital</DialogTitle>
              <DialogDescription>
                Onboard a new hospital to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
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
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="city-general"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="admin@hospital.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Medical Ave"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createTenant.isPending}>
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
    </div>
  );
}
