'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  BedDouble,
  Building,
  ChevronDown,
  ChevronRight,
  Pencil,
  MoreHorizontal,
  Loader2,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useWards, useBeds, clinicalKeys, type Ward, type BedAvailability } from '@/hooks/use-clinical';
import { apiPost, apiPut } from '@/lib/api';

// ─── Constants ──────────────────────────────────────────
const WARD_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'semi_private', label: 'Semi Private' },
  { value: 'private_ward', label: 'Private' },
  { value: 'icu', label: 'ICU' },
  { value: 'nicu', label: 'NICU' },
  { value: 'picu', label: 'PICU' },
  { value: 'emergency', label: 'Emergency' },
];

const BED_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  available: { label: 'Available', variant: 'default' },
  occupied: { label: 'Occupied', variant: 'destructive' },
  maintenance: { label: 'Maintenance', variant: 'secondary' },
  reserved: { label: 'Reserved', variant: 'secondary' },
  under_cleaning: { label: 'Cleaning', variant: 'secondary' },
  under_maintenance: { label: 'Maintenance', variant: 'secondary' },
};

// ─── Schemas ────────────────────────────────────────────
const wardSchema = z.object({
  name: z.string().min(1, 'Ward name is required'),
  floor: z.string().optional(),
  wardType: z.string().optional(),
  totalBeds: z.number().int().min(0).optional(),
});
type WardForm = z.infer<typeof wardSchema>;

const bedSchema = z.object({
  bedNumber: z.string().min(1, 'Bed number is required'),
  wardId: z.string().min(1, 'Ward is required'),
  bedType: z.string().optional(),
});
type BedForm = z.infer<typeof bedSchema>;

// ─── Page ───────────────────────────────────────────────
export default function RoomsSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: wards, isLoading: wardsLoading } = useWards();
  const { data: beds, isLoading: bedsLoading } = useBeds();

  const [expandedWard, setExpandedWard] = useState<string | null>(null);
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);

  // ─── Ward form ──────────────────────────────────────────
  const wardForm = useForm<WardForm>({
    resolver: zodResolver(wardSchema),
    defaultValues: { name: '', floor: '', wardType: '', totalBeds: 0 },
  });

  const createWard = useMutation({
    mutationFn: async (data: WardForm) => {
      const body: Record<string, unknown> = { name: data.name, totalBeds: data.totalBeds ?? 0 };
      if (data.wardType) body.wardType = data.wardType;
      if (data.floor) body.floor = data.floor;
      const res = await apiPost<Ward>('/infrastructure/wards', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ward created successfully');
      queryClient.invalidateQueries({ queryKey: clinicalKeys.wards.all });
      setWardDialogOpen(false);
      wardForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create ward');
    },
  });

  const updateWard = useMutation({
    mutationFn: async ({ id, ...data }: WardForm & { id: string }) => {
      const body: Record<string, unknown> = { name: data.name };
      if (data.wardType) body.wardType = data.wardType;
      if (data.floor) body.floor = data.floor;
      if (data.totalBeds !== undefined) body.totalBeds = data.totalBeds;
      const res = await apiPut<Ward>(`/infrastructure/wards/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ward updated successfully');
      queryClient.invalidateQueries({ queryKey: clinicalKeys.wards.all });
      setWardDialogOpen(false);
      setEditingWard(null);
      wardForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update ward');
    },
  });

  // ─── Bed form ───────────────────────────────────────────
  const bedForm = useForm<BedForm>({
    resolver: zodResolver(bedSchema),
    defaultValues: { bedNumber: '', wardId: '', bedType: '' },
  });

  const createBed = useMutation({
    mutationFn: async (data: BedForm) => {
      const res = await apiPost<BedAvailability>('/infrastructure/beds', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Bed created successfully');
      queryClient.invalidateQueries({ queryKey: clinicalKeys.beds.all });
      queryClient.invalidateQueries({ queryKey: clinicalKeys.wards.all });
      setBedDialogOpen(false);
      bedForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create bed');
    },
  });

  const handleOpenWardDialog = (ward?: Ward) => {
    if (ward) {
      setEditingWard(ward);
      wardForm.reset({
        name: ward.name,
        floor: ward.floor || '',
        wardType: ward.wardType || '',
        totalBeds: ward.totalBeds ?? 0,
      });
    } else {
      setEditingWard(null);
      wardForm.reset({ name: '', floor: '', wardType: '', totalBeds: 0 });
    }
    setWardDialogOpen(true);
  };

  const onWardSubmit = (data: WardForm) => {
    if (editingWard) {
      updateWard.mutate({ ...data, id: editingWard.id });
    } else {
      createWard.mutate(data);
    }
  };

  const onBedSubmit = (data: BedForm) => {
    createBed.mutate(data);
  };

  const toggleWard = (id: string) => {
    setExpandedWard((prev) => (prev === id ? null : id));
  };

  const wardBeds = (wardId: string) =>
    (beds || []).filter((b) => b.wardId === wardId);

  const isLoading = wardsLoading || bedsLoading;

  // ─── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl bg-surface-container-low" />
          <Skeleton className="h-7 w-48 bg-surface-container-low" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl bg-surface-container-low" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl bg-surface-container-low" />
        ))}
      </div>
    );
  }

  const totalBeds = beds?.length ?? 0;
  const availableBeds = (beds ?? []).filter((b) => b.status === 'available').length;
  const occupiedBeds = (beds ?? []).filter((b) => b.status === 'occupied').length;

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
            <h1 className="font-headline text-xl font-bold">Rooms &amp; Wards</h1>
            <p className="font-label text-[10px] text-on-surface-variant">
              Manage wards, rooms, and bed assignments
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBedDialogOpen(true)}>
            <BedDouble className="mr-1 h-4 w-4" />
            Add Bed
          </Button>
          <Button size="sm" onClick={() => handleOpenWardDialog()} className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">
            <Plus className="mr-1 h-4 w-4" />
            Add Ward
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{wards?.length ?? 0}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Wards</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{totalBeds}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Beds</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{availableBeds}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Available</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{occupiedBeds}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Occupied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wards list */}
      {!wards || wards.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-on-surface-variant/40 mb-3" />
            <p className="font-label text-sm font-bold">No wards found</p>
            <p className="font-label text-[10px] text-on-surface-variant mt-1">
              Create your first ward to get started
            </p>
            <Button size="sm" className="mt-4 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" onClick={() => handleOpenWardDialog()}>
              <Plus className="mr-1 h-4 w-4" /> Add Ward
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Ward Name</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Beds</TableHead>
                <TableHead>Available</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wards.map((ward) => {
                const isExpanded = expandedWard === ward.id;
                const wBeds = wardBeds(ward.id);
                const bedCount = ward._count?.beds ?? ward.totalBeds ?? wBeds.length;
                const avail = wBeds.filter((b) => b.status === 'available').length;
                return (
                  <React.Fragment key={ward.id}>
                    <TableRow
                      className="cursor-pointer group hover:bg-surface-container-low transition-colors"
                      onClick={() => toggleWard(ward.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-on-surface-variant" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                        )}
                      </TableCell>
                      <TableCell className="font-label text-sm font-bold">{ward.name}</TableCell>
                      <TableCell className="font-label text-sm text-on-surface-variant">{ward.floor || '-'}</TableCell>
                      <TableCell className="font-label text-sm text-on-surface-variant capitalize">
                        {ward.wardType?.replace('_', ' ') || '-'}
                      </TableCell>
                      <TableCell className="font-label text-sm">{bedCount}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${avail > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                          {avail} available
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenWardDialog(ward)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {/* Expanded Beds */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-surface-container-low/50 px-8 py-3">
                          {wBeds.length === 0 ? (
                            <p className="font-label text-sm text-on-surface-variant text-center py-4">
                              No beds in this ward yet.
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Bed Number</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Floor</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {wBeds.map((bed) => {
                                  const statusInfo = BED_STATUS_MAP[bed.status] ?? {
                                    label: bed.status,
                                    variant: 'secondary' as const,
                                  };
                                  return (
                                    <TableRow key={bed.id} className="group hover:bg-surface-container-low transition-colors">
                                      <TableCell className="font-label text-sm font-bold">
                                        {bed.bedNumber}
                                      </TableCell>
                                      <TableCell className="font-label text-sm text-on-surface-variant capitalize">
                                        {bed.bedType || 'Standard'}
                                      </TableCell>
                                      <TableCell className="font-label text-sm text-on-surface-variant">
                                        {bed.floor || '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={statusInfo.variant}>
                                          {statusInfo.label}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create/Edit Ward Dialog ─────────────────────────── */}
      <Dialog open={wardDialogOpen} onOpenChange={setWardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWard ? 'Edit Ward' : 'Add New Ward'}</DialogTitle>
            <DialogDescription>
              {editingWard ? 'Update the ward details.' : 'Enter the ward details below.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={wardForm.handleSubmit(onWardSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ward-name">Ward Name *</Label>
              <Input id="ward-name" {...wardForm.register('name')} placeholder="e.g. General Ward A" />
              {wardForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {wardForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ward Type</Label>
                <Select
                  value={wardForm.watch('wardType') || undefined}
                  onValueChange={(val) =>
                    wardForm.setValue('wardType', val ?? '', { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WARD_TYPES.map((wt) => (
                      <SelectItem key={wt.value} value={wt.value}>
                        {wt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ward-floor">Floor</Label>
                <Input
                  id="ward-floor"
                  {...wardForm.register('floor')}
                  placeholder="e.g. 2"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ward-beds">Total Beds</Label>
              <Input
                id="ward-beds"
                type="number"
                min={0}
                {...wardForm.register('totalBeds', { valueAsNumber: true })}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setWardDialogOpen(false);
                  setEditingWard(null);
                  wardForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createWard.isPending || updateWard.isPending}
              >
                {(createWard.isPending || updateWard.isPending) && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {editingWard ? 'Update Ward' : 'Create Ward'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Bed Dialog ───────────────────────────────── */}
      <Dialog open={bedDialogOpen} onOpenChange={setBedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Bed</DialogTitle>
            <DialogDescription>Assign a bed to a ward.</DialogDescription>
          </DialogHeader>
          <form onSubmit={bedForm.handleSubmit(onBedSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ward *</Label>
              <Select
                value={bedForm.watch('wardId') || undefined}
                onValueChange={(val) =>
                  bedForm.setValue('wardId', val ?? '', { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {(wards || []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bedForm.formState.errors.wardId && (
                <p className="text-xs text-destructive">
                  {bedForm.formState.errors.wardId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-number">Bed Number *</Label>
              <Input
                id="bed-number"
                {...bedForm.register('bedNumber')}
                placeholder="e.g. B-101"
              />
              {bedForm.formState.errors.bedNumber && (
                <p className="text-xs text-destructive">
                  {bedForm.formState.errors.bedNumber.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-type">Bed Type</Label>
              <Input
                id="bed-type"
                {...bedForm.register('bedType')}
                placeholder="Standard, Electric, ICU, etc."
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setBedDialogOpen(false);
                  bedForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createBed.isPending}>
                {createBed.isPending && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                Add Bed
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
