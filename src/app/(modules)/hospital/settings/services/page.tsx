'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Stethoscope,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  Search,
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
interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    doctorProfiles?: number;
    wards?: number;
  };
}

// ─── Schema ─────────────────────────────────────────────
const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
});
type DepartmentForm = z.infer<typeof departmentSchema>;

const QUERY_KEY = ['infrastructure', 'departments'];

// ─── Debounce hook (inline) ─────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Page ───────────────────────────────────────────────
export default function ServicesSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, { search: debouncedSearch }],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await apiGet<Department[]>('/infrastructure/departments', { params });
      return res.data;
    },
  });

  const departments = Array.isArray(data) ? data : [];

  const form = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', code: '', description: '' },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: DepartmentForm) => {
      const body: Record<string, unknown> = { name: formData.name };
      if (formData.code) body.code = formData.code;
      if (formData.description) body.description = formData.description;
      const res = await apiPost<Department>('/infrastructure/departments', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Department created');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeDialog();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create department');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...formData }: DepartmentForm & { id: string }) => {
      const body: Record<string, unknown> = { name: formData.name };
      body.code = formData.code || null;
      body.description = formData.description || null;
      const res = await apiPut<Department>(`/infrastructure/departments/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Department updated');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeDialog();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update department');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/infrastructure/departments/${id}`);
    },
    onSuccess: () => {
      toast.success('Department deleted');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setDeleteConfirm(null);
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({ name: '', code: '', description: '' });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', code: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    form.reset({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (formData: DepartmentForm) => {
    if (editing) {
      updateMutation.mutate({ ...formData, id: editing.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeDepts = departments.filter((d) => d.isActive).length;
  const inactiveDepts = departments.filter((d) => !d.isActive).length;

  // ─── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl bg-surface-container-low" />
          <Skeleton className="h-7 w-56 bg-surface-container-low" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl bg-surface-container-low" />
          ))}
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
            <h1 className="font-headline text-xl font-bold">
              Service Master Configuration
            </h1>
            <p className="font-label text-[10px] text-on-surface-variant">
              Manage hospital departments and services
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">
          <Plus className="mr-1 h-4 w-4" />
          Add Department
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{departments.length}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Departments</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{activeDepts}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{inactiveDepts}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      {/* Table */}
      {departments.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-on-surface-variant/40 mb-3" />
            <p className="font-label text-sm font-bold">
              {search ? 'No matching departments' : 'No departments yet'}
            </p>
            <p className="font-label text-[10px] text-on-surface-variant mt-1">
              {search
                ? 'Try a different search term'
                : 'Create your first department to get started'}
            </p>
            {!search && (
              <Button size="sm" className="mt-4 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Add Department
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id} className="group hover:bg-surface-container-low transition-colors">
                  <TableCell className="font-label text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                      {dept.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-label text-sm text-on-surface-variant">
                    {dept.code ? (
                      <span className="font-mono text-[10px] bg-surface-container-low rounded px-1.5 py-0.5">
                        {dept.code}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="font-label text-sm text-on-surface-variant max-w-[200px] truncate">
                    {dept.description || '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dept.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
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
                        <DropdownMenuItem onClick={() => openEdit(dept)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(dept)}
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
              {editing ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the department details.'
                : 'Enter the department details below.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                {...form.register('name')}
                placeholder="e.g. Cardiology"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Code</Label>
              <Input
                id="dept-code"
                {...form.register('code')}
                placeholder="e.g. CARD"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Description</Label>
              <Input
                id="dept-desc"
                {...form.register('description')}
                placeholder="Brief description of the department"
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
            <DialogTitle>Delete Department</DialogTitle>
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
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
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
