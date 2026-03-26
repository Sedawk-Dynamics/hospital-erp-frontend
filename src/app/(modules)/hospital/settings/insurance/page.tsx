'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────
interface Insurer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Schema ─────────────────────────────────────────────
const insurerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
});
type InsurerForm = z.infer<typeof insurerSchema>;

const QUERY_KEY = ['insurance', 'insurers'];

// ─── Page ───────────────────────────────────────────────
export default function InsuranceSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Insurer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: insurers, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiGet<Insurer[]>('/insurance/insurers', {
        params: { limit: 100 },
      });
      return res.data;
    },
  });

  const allInsurers = Array.isArray(insurers) ? insurers : [];
  const filteredInsurers = allInsurers.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.contactPerson ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const form = useForm<InsurerForm>({
    resolver: zodResolver(insurerSchema),
    defaultValues: { name: '', contactPerson: '', phone: '', email: '', address: '' },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsurerForm) => {
      const body: Record<string, unknown> = { name: data.name };
      if (data.contactPerson) body.contactPerson = data.contactPerson;
      if (data.phone) body.phone = data.phone;
      if (data.email) body.email = data.email;
      if (data.address) body.address = data.address;
      const res = await apiPost<Insurer>('/insurance/insurers', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Insurance provider created');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeDialog();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create provider');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: InsurerForm & { id: string }) => {
      const body: Record<string, unknown> = { name: data.name };
      body.contactPerson = data.contactPerson || null;
      body.phone = data.phone || null;
      body.email = data.email || null;
      body.address = data.address || null;
      const res = await apiPut<Insurer>(`/insurance/insurers/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Insurance provider updated');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeDialog();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update provider');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/insurance/insurers/${id}`);
    },
    onSuccess: () => {
      toast.success('Insurance provider deleted');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setDeleteConfirm(null);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to delete provider');
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    setDialogOpen(true);
  };

  const openEdit = (insurer: Insurer) => {
    setEditing(insurer);
    form.reset({
      name: insurer.name,
      contactPerson: insurer.contactPerson || '',
      phone: insurer.phone || '',
      email: insurer.email || '',
      address: insurer.address || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: InsurerForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl bg-surface-container-low" />
          <Skeleton className="h-7 w-48 bg-surface-container-low" />
        </div>
        <Skeleton className="h-10 w-full max-w-xs bg-surface-container-low" />
        <Skeleton className="h-64 w-full rounded-xl bg-surface-container-low" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/hospital/settings')}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-headline text-xl font-bold">Insurance Providers</h1>
            <p className="font-label text-[10px] text-on-surface-variant">
              Manage insurance companies and TPA providers
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">
          <Plus className="mr-1 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl pl-6 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
          {allInsurers.length} provider{allInsurers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filteredInsurers.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-on-surface-variant/40 mb-3" />
            <p className="font-label text-sm font-bold">
              {searchTerm ? 'No matching providers' : 'No insurance providers yet'}
            </p>
            <p className="font-label text-[10px] text-on-surface-variant mt-1">
              {searchTerm
                ? 'Try a different search term'
                : 'Add your first insurance provider to get started'}
            </p>
            {!searchTerm && (
              <Button size="sm" className="mt-4 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Add Provider
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInsurers.map((insurer) => (
                <TableRow key={insurer.id} className="group hover:bg-surface-container-low transition-colors">
                  <TableCell className="font-label text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      {insurer.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-label text-sm text-on-surface-variant">
                    {insurer.contactPerson || '-'}
                  </TableCell>
                  <TableCell className="font-label text-sm text-on-surface-variant">
                    {insurer.phone || '-'}
                  </TableCell>
                  <TableCell className="font-label text-sm text-on-surface-variant">
                    {insurer.email || '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${insurer.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
                      {insurer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(insurer)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(insurer)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create/Edit Dialog ─────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Insurance Provider' : 'Add Insurance Provider'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the provider details.'
                : 'Enter the provider details below.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ins-name">Provider Name *</Label>
              <Input
                id="ins-name"
                {...form.register('name')}
                placeholder="e.g. Star Health Insurance"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-contact">Contact Person</Label>
              <Input
                id="ins-contact"
                {...form.register('contactPerson')}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ins-phone">Phone</Label>
                <Input
                  id="ins-phone"
                  {...form.register('phone')}
                  placeholder="+91 XXXX XXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ins-email">Email</Label>
                <Input
                  id="ins-email"
                  type="email"
                  {...form.register('email')}
                  placeholder="email@insurer.com"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-address">Address</Label>
              <Input
                id="ins-address"
                {...form.register('address')}
                placeholder="Office address"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────── */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Insurance Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
