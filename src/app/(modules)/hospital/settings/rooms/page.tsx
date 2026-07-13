'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  BedDouble,
  Building,
  Building2,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  MoreHorizontal,
  Loader2,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  useFloors,
  useWards,
  useBeds,
  clinicalKeys,
  type Floor,
  type Ward,
  type BedAvailability,
} from '@/hooks/use-clinical';
import { apiPost, apiPut, apiDelete } from '@/lib/api';

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

const BED_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'electric', label: 'Electric' },
  { value: 'icu', label: 'ICU' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'bariatric', label: 'Bariatric' },
];

const BED_STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  available: { label: 'Available', variant: 'default' },
  occupied: { label: 'Occupied', variant: 'destructive' },
  maintenance: { label: 'Maintenance', variant: 'secondary' },
  reserved: { label: 'Reserved', variant: 'secondary' },
};

// ─── Schemas ────────────────────────────────────────────
const floorSchema = z.object({
  name: z.string().min(1, 'Floor name is required').max(60),
  level: z.number().int().min(-10).max(200),
  description: z.string().max(1000).optional(),
});
type FloorForm = z.infer<typeof floorSchema>;

const wardSchema = z.object({
  name: z.string().min(1, 'Ward name is required'),
  floorId: z.string().min(1, 'Floor is required'),
  wardType: z.string().optional(),
  // Per-day bed charge for this ward (blank = use the room tariff instead).
  dailyCharge: z.string().optional(),
});
type WardForm = z.infer<typeof wardSchema>;

const bedSchema = z.object({
  bedNumber: z.string().min(1, 'Bed number is required'),
  wardId: z.string().min(1, 'Ward is required'),
  bedType: z.string().optional(),
});
type BedForm = z.infer<typeof bedSchema>;

const bulkBedSchema = z.object({
  wardId: z.string().min(1, 'Ward is required'),
  prefix: z.string().max(10),
  startNumber: z.number().int().min(0).max(99999),
  count: z.number().int().min(1, 'At least 1 bed').max(200, 'Max 200 beds at once'),
  padding: z.number().int().min(0).max(6),
  bedType: z.string().optional(),
});
type BulkBedForm = z.infer<typeof bulkBedSchema>;

// Auto-detect prefix and next number from a ward's existing bed numbers.
// e.g. ["B-001", "B-002"] → { prefix: "B-", nextNumber: 3, padding: 3 }
function detectBedPattern(numbers: string[]): {
  prefix: string;
  nextNumber: number;
  padding: number;
} {
  if (numbers.length === 0) return { prefix: '', nextNumber: 1, padding: 0 };
  // Match optional prefix + trailing digits
  const re = /^(.*?)(\d+)$/;
  let prefix = '';
  let maxNum = 0;
  let padding = 0;
  let matched = 0;
  for (const n of numbers) {
    const m = n.match(re);
    if (!m) continue;
    matched++;
    const p = m[1];
    const numStr = m[2];
    if (matched === 1) {
      prefix = p;
      padding = numStr.length;
    } else if (p !== prefix) {
      // Prefixes diverge — give up on a clean detection
      return { prefix: '', nextNumber: 1, padding: 0 };
    }
    const num = parseInt(numStr, 10);
    if (num > maxNum) maxNum = num;
  }
  if (matched === 0) return { prefix: '', nextNumber: 1, padding: 0 };
  // Only keep zero-padding if the original used leading zeros
  const usePadding = padding > 1 && numbers.some((n) => /^.*?0\d+$/.test(n));
  return { prefix, nextNumber: maxNum + 1, padding: usePadding ? padding : 0 };
}

function buildBedNumbers(prefix: string, start: number, count: number, padding: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const numStr = padding > 0 ? String(n).padStart(padding, '0') : String(n);
    out.push(`${prefix}${numStr}`);
  }
  return out;
}

// ─── Page ───────────────────────────────────────────────
export default function FloorsWardsSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: floors, isLoading: floorsLoading } = useFloors();
  const { data: wards, isLoading: wardsLoading } = useWards();
  const { data: beds, isLoading: bedsLoading } = useBeds();

  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [expandedWard, setExpandedWard] = useState<string | null>(null);

  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [bedDialogMode, setBedDialogMode] = useState<'single' | 'bulk'>('single');
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [defaultWardFloorId, setDefaultWardFloorId] = useState<string>('');
  const [defaultBedWardId, setDefaultBedWardId] = useState<string>('');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: clinicalKeys.floors.all });
    queryClient.invalidateQueries({ queryKey: clinicalKeys.wards.all });
    queryClient.invalidateQueries({ queryKey: clinicalKeys.beds.all });
  };

  // ─── Floor form ─────────────────────────────────────────
  const floorForm = useForm<FloorForm>({
    resolver: zodResolver(floorSchema),
    defaultValues: { name: '', level: 0, description: '' },
  });

  const createFloor = useMutation({
    mutationFn: async (data: FloorForm) => {
      const res = await apiPost<Floor>('/infrastructure/floors', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Floor created');
      invalidateAll();
      setFloorDialogOpen(false);
      floorForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create floor');
    },
  });

  const updateFloor = useMutation({
    mutationFn: async ({ id, ...data }: FloorForm & { id: string }) => {
      const res = await apiPut<Floor>(`/infrastructure/floors/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Floor updated');
      invalidateAll();
      setFloorDialogOpen(false);
      setEditingFloor(null);
      floorForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update floor');
    },
  });

  const deleteFloor = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/infrastructure/floors/${id}`);
    },
    onSuccess: () => {
      toast.success('Floor deleted');
      invalidateAll();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to delete floor');
    },
  });

  // ─── Ward form ──────────────────────────────────────────
  const wardForm = useForm<WardForm>({
    resolver: zodResolver(wardSchema),
    defaultValues: { name: '', floorId: '', wardType: '', dailyCharge: '' },
  });

  // Blank clears the per-day charge (null); a number sets it.
  const parseCharge = (v?: string): number | null =>
    v != null && v.trim() !== '' ? Math.max(0, Number(v) || 0) : null;

  const createWard = useMutation({
    mutationFn: async (data: WardForm) => {
      const body: Record<string, unknown> = {
        name: data.name,
        floorId: data.floorId,
        dailyCharge: parseCharge(data.dailyCharge),
      };
      if (data.wardType) body.wardType = data.wardType;
      const res = await apiPost<Ward>('/infrastructure/wards', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ward created');
      invalidateAll();
      setWardDialogOpen(false);
      wardForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create ward');
    },
  });

  const updateWard = useMutation({
    mutationFn: async ({ id, ...data }: WardForm & { id: string }) => {
      const body: Record<string, unknown> = { name: data.name, floorId: data.floorId, dailyCharge: parseCharge(data.dailyCharge) };
      if (data.wardType) body.wardType = data.wardType;
      const res = await apiPut<Ward>(`/infrastructure/wards/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ward updated');
      invalidateAll();
      setWardDialogOpen(false);
      setEditingWard(null);
      wardForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update ward');
    },
  });

  const deleteWard = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/infrastructure/wards/${id}`);
    },
    onSuccess: () => {
      toast.success('Ward deleted');
      invalidateAll();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to delete ward');
    },
  });

  // ─── Bed form ───────────────────────────────────────────
  const bedForm = useForm<BedForm>({
    resolver: zodResolver(bedSchema),
    defaultValues: { bedNumber: '', wardId: '', bedType: '' },
  });

  const createBed = useMutation({
    mutationFn: async (data: BedForm) => {
      const body: Record<string, unknown> = {
        wardId: data.wardId,
        bedNumber: data.bedNumber,
      };
      if (data.bedType) body.bedType = data.bedType;
      const res = await apiPost<BedAvailability>('/infrastructure/beds', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Bed created');
      invalidateAll();
      setBedDialogOpen(false);
      bedForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create bed');
    },
  });

  const deleteBed = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/infrastructure/beds/${id}`);
    },
    onSuccess: () => {
      toast.success('Bed removed');
      invalidateAll();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to remove bed');
    },
  });

  // ─── Bulk bed form ──────────────────────────────────────
  const bulkBedForm = useForm<BulkBedForm>({
    resolver: zodResolver(bulkBedSchema),
    defaultValues: {
      wardId: '',
      prefix: '',
      startNumber: 1,
      count: 5,
      padding: 0,
      bedType: '',
    },
  });

  const bulkCreateBeds = useMutation({
    mutationFn: async (data: BulkBedForm) => {
      const numbers = buildBedNumbers(
        data.prefix || '',
        data.startNumber,
        data.count,
        data.padding ?? 0,
      );
      const body: Record<string, unknown> = {
        wardId: data.wardId,
        beds: numbers.map((bedNumber) => ({ bedNumber })),
      };
      if (data.bedType) body.bedType = data.bedType;
      const res = await apiPost<{ count: number; beds: BedAvailability[] }>(
        '/infrastructure/beds/bulk',
        body,
      );
      return res.data;
    },
    onSuccess: (result) => {
      toast.success(`${result.count} beds created`);
      invalidateAll();
      setBedDialogOpen(false);
      bulkBedForm.reset();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create beds');
    },
  });

  // ─── Dialog openers ─────────────────────────────────────
  const handleOpenFloorDialog = (floor?: Floor) => {
    if (floor) {
      setEditingFloor(floor);
      floorForm.reset({
        name: floor.name,
        level: floor.level,
        description: floor.description || '',
      });
    } else {
      setEditingFloor(null);
      const nextLevel = floors && floors.length > 0
        ? Math.max(...floors.map((f) => f.level)) + 1
        : 0;
      floorForm.reset({ name: '', level: nextLevel, description: '' });
    }
    setFloorDialogOpen(true);
  };

  const handleOpenWardDialog = (ward?: Ward, floorId?: string) => {
    if (ward) {
      setEditingWard(ward);
      wardForm.reset({
        name: ward.name,
        floorId: ward.floorId || '',
        wardType: ward.wardType || '',
        dailyCharge: ward.dailyCharge != null ? String(ward.dailyCharge) : '',
      });
      setDefaultWardFloorId(ward.floorId || '');
    } else {
      setEditingWard(null);
      wardForm.reset({
        name: '',
        floorId: floorId || '',
        wardType: '',
        dailyCharge: '',
      });
      setDefaultWardFloorId(floorId || '');
    }
    setWardDialogOpen(true);
  };

  const handleOpenBedDialog = (wardId?: string) => {
    const targetWardId = wardId || '';
    bedForm.reset({ bedNumber: '', wardId: targetWardId, bedType: '' });

    // Seed bulk form with auto-detected numbering for this ward
    const wardBedNumbers = targetWardId
      ? (beds || []).filter((b) => b.wardId === targetWardId).map((b) => b.bedNumber)
      : [];
    const detected = detectBedPattern(wardBedNumbers);
    bulkBedForm.reset({
      wardId: targetWardId,
      prefix: detected.prefix,
      startNumber: detected.nextNumber,
      count: 5,
      padding: detected.padding,
      bedType: '',
    });

    setDefaultBedWardId(targetWardId);
    setBedDialogMode('single');
    setBedDialogOpen(true);
  };

  // ─── Submitters ─────────────────────────────────────────
  const onFloorSubmit = (data: FloorForm) => {
    if (editingFloor) {
      updateFloor.mutate({ ...data, id: editingFloor.id });
    } else {
      createFloor.mutate(data);
    }
  };

  const onWardSubmit = (data: WardForm) => {
    if (editingWard) {
      updateWard.mutate({ ...data, id: editingWard.id });
    } else {
      createWard.mutate(data);
    }
  };

  const onBedSubmit = (data: BedForm) => createBed.mutate(data);
  const onBulkBedSubmit = (data: BulkBedForm) => bulkCreateBeds.mutate(data);

  // Re-detect numbering when the user switches the ward in the bulk form
  const handleBulkWardChange = (newWardId: string) => {
    bulkBedForm.setValue('wardId', newWardId, { shouldValidate: true });
    const wardBedNumbers = (beds || [])
      .filter((b) => b.wardId === newWardId)
      .map((b) => b.bedNumber);
    const detected = detectBedPattern(wardBedNumbers);
    bulkBedForm.setValue('prefix', detected.prefix);
    bulkBedForm.setValue('startNumber', detected.nextNumber);
    bulkBedForm.setValue('padding', detected.padding);
  };

  // ─── Derived ────────────────────────────────────────────
  const floorsSorted = useMemo(
    () => [...(floors || [])].sort((a, b) => a.level - b.level),
    [floors],
  );

  const wardsByFloor = useMemo(() => {
    const map = new Map<string, Ward[]>();
    (wards || []).forEach((w) => {
      const key = w.floorId || '__unassigned__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [wards]);

  const bedsByWard = useMemo(() => {
    const map = new Map<string, BedAvailability[]>();
    (beds || []).forEach((b) => {
      if (!map.has(b.wardId)) map.set(b.wardId, []);
      map.get(b.wardId)!.push(b);
    });
    return map;
  }, [beds]);

  const isLoading = floorsLoading || wardsLoading || bedsLoading;

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
          <Skeleton key={i} className="h-32 w-full rounded-xl bg-surface-container-low" />
        ))}
      </div>
    );
  }

  // ─── Stats ──────────────────────────────────────────────
  const totalFloors = floors?.length ?? 0;
  const totalWards = wards?.length ?? 0;
  const totalBeds = beds?.length ?? 0;
  const availableBeds = (beds ?? []).filter((b) => b.status === 'available').length;

  // unassigned ward bucket — wards without floorId (data quality / fallback)
  const unassignedWards = wardsByFloor.get('__unassigned__') || [];

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
            <h1 className="font-headline text-xl font-bold">Floors &amp; Wards</h1>
            <p className="font-label text-[10px] text-on-surface-variant">
              Manage building floors, clinical wards, and bed inventory
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => handleOpenFloorDialog()}
          className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Floor
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={Layers} value={totalFloors} label="Floors" tone="primary" />
        <SummaryCard icon={Building} value={totalWards} label="Wards" tone="blue" />
        <SummaryCard icon={BedDouble} value={totalBeds} label="Total Beds" tone="amber" />
        <SummaryCard icon={CheckCircle2} value={availableBeds} label="Available" tone="emerald" />
      </div>

      {/* Empty state */}
      {totalFloors === 0 && totalWards === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-on-surface-variant/40 mb-3" />
            <p className="font-label text-sm font-bold">No floors yet</p>
            <p className="font-label text-[10px] text-on-surface-variant mt-1">
              Start by creating a floor (e.g. Ground, 1st, 2nd). Wards live inside floors.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
              onClick={() => handleOpenFloorDialog()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Floor
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Floors list */}
          {floorsSorted.map((floor) => {
            const floorWards = wardsByFloor.get(floor.id) || [];
            const isFloorOpen = expandedFloor === floor.id;
            const floorBedCount = floorWards.reduce(
              (acc, w) => acc + (bedsByWard.get(w.id)?.length ?? w._count?.beds ?? 0),
              0,
            );
            return (
              <FloorCard
                key={floor.id}
                floor={floor}
                wardsCount={floorWards.length}
                bedsCount={floorBedCount}
                isOpen={isFloorOpen}
                onToggle={() => setExpandedFloor(isFloorOpen ? null : floor.id)}
                onEdit={() => handleOpenFloorDialog(floor)}
                onDelete={() => {
                  if (confirm(`Delete floor "${floor.name}"? Wards must be moved first.`))
                    deleteFloor.mutate(floor.id);
                }}
                onAddWard={() => handleOpenWardDialog(undefined, floor.id)}
              >
                <WardList
                  wards={floorWards}
                  bedsByWard={bedsByWard}
                  expandedWard={expandedWard}
                  onToggleWard={(id) => setExpandedWard(expandedWard === id ? null : id)}
                  onEditWard={handleOpenWardDialog}
                  onDeleteWard={(id) => {
                    if (confirm('Delete this ward? Beds must be removed first.'))
                      deleteWard.mutate(id);
                  }}
                  onAddBed={(wardId) => handleOpenBedDialog(wardId)}
                  onDeleteBed={(id) => {
                    if (confirm('Remove this bed?')) deleteBed.mutate(id);
                  }}
                />
              </FloorCard>
            );
          })}

          {/* Unassigned wards (no floor link) */}
          {unassignedWards.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl shadow-sanctuary overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-600" />
                  <p className="font-label text-sm font-bold text-amber-900 dark:text-amber-100">
                    Unassigned Wards ({unassignedWards.length})
                  </p>
                </div>
                <p className="font-label text-[10px] text-amber-700 dark:text-amber-400">
                  Edit each ward to assign a floor.
                </p>
              </div>
              <div className="p-2">
                <WardList
                  wards={unassignedWards}
                  bedsByWard={bedsByWard}
                  expandedWard={expandedWard}
                  onToggleWard={(id) => setExpandedWard(expandedWard === id ? null : id)}
                  onEditWard={handleOpenWardDialog}
                  onDeleteWard={(id) => {
                    if (confirm('Delete this ward?')) deleteWard.mutate(id);
                  }}
                  onAddBed={(wardId) => handleOpenBedDialog(wardId)}
                  onDeleteBed={(id) => {
                    if (confirm('Remove this bed?')) deleteBed.mutate(id);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Floor Dialog ────────────────────────────────────── */}
      <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFloor ? 'Edit Floor' : 'Add Floor'}</DialogTitle>
            <DialogDescription>
              A floor is a physical building level (e.g. Ground, 1st, 2nd). Wards live inside it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={floorForm.handleSubmit(onFloorSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="floor-name">Floor Name *</Label>
                <Input
                  id="floor-name"
                  {...floorForm.register('name')}
                  placeholder="e.g. Ground, 1st, 2nd"
                />
                {floorForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {floorForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="floor-level">Level *</Label>
                <Input
                  id="floor-level"
                  type="number"
                  {...floorForm.register('level', { valueAsNumber: true })}
                />
                {floorForm.formState.errors.level && (
                  <p className="text-xs text-destructive">
                    {floorForm.formState.errors.level.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="floor-desc">Description</Label>
              <Input
                id="floor-desc"
                {...floorForm.register('description')}
                placeholder="Optional notes about this floor"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setFloorDialogOpen(false);
                  setEditingFloor(null);
                  floorForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createFloor.isPending || updateFloor.isPending}
              >
                {(createFloor.isPending || updateFloor.isPending) && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {editingFloor ? 'Update Floor' : 'Create Floor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Ward Dialog ─────────────────────────────────────── */}
      <Dialog open={wardDialogOpen} onOpenChange={setWardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWard ? 'Edit Ward' : 'Add Ward'}</DialogTitle>
            <DialogDescription>
              Wards are clinical units (ICU, General, Maternity). They own beds and nurse
              assignments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={wardForm.handleSubmit(onWardSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ward-name">Ward Name *</Label>
              <Input
                id="ward-name"
                {...wardForm.register('name')}
                placeholder="e.g. ICU, General Ward A"
              />
              {wardForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {wardForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Floor *</Label>
                <Select
                  value={wardForm.watch('floorId') || defaultWardFloorId || null}
                  onValueChange={(val) =>
                    wardForm.setValue('floorId', val ?? '', { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select floor">
                      {(value) => {
                        const f = floorsSorted.find((x) => x.id === value);
                        return f ? f.name : 'Select floor';
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {floorsSorted.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {wardForm.formState.errors.floorId && (
                  <p className="text-xs text-destructive">
                    {wardForm.formState.errors.floorId.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Ward Type</Label>
                <Select
                  value={wardForm.watch('wardType') || null}
                  onValueChange={(val) =>
                    wardForm.setValue('wardType', val ?? '', { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type">
                      {(value) => {
                        const wt = WARD_TYPES.find((x) => x.value === value);
                        return wt ? wt.label : 'Select type';
                      }}
                    </SelectValue>
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
            </div>
            <div className="mt-4 space-y-1.5">
              <Label>Bed charge per day (₹)</Label>
              <Input type="number" min={0} step="0.01" placeholder="e.g. 2000" {...wardForm.register('dailyCharge')} />
              <p className="text-[11px] text-muted-foreground">
                Charged per day to every bed in this ward on the IP bill. Leave blank to fall back to the room tariff.
              </p>
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

      {/* ── Bed Dialog (Single | Bulk) ───────────────────────── */}
      <Dialog open={bedDialogOpen} onOpenChange={setBedDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {bedDialogMode === 'bulk' ? 'Beds' : 'Bed'}</DialogTitle>
            <DialogDescription>
              {bedDialogMode === 'bulk'
                ? 'Generate a numbered range of beds in one shot.'
                : 'Beds are owned by wards.'}
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setBedDialogMode('single')}
              className={`font-label text-xs font-bold py-2 rounded-lg transition-colors ${
                bedDialogMode === 'single'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sanctuary'
                  : 'text-on-surface-variant'
              }`}
            >
              Single Bed
            </button>
            <button
              type="button"
              onClick={() => setBedDialogMode('bulk')}
              className={`font-label text-xs font-bold py-2 rounded-lg transition-colors ${
                bedDialogMode === 'bulk'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sanctuary'
                  : 'text-on-surface-variant'
              }`}
            >
              Bulk Add
            </button>
          </div>

          {bedDialogMode === 'single' ? (
            <form onSubmit={bedForm.handleSubmit(onBedSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Ward *</Label>
                <Select
                  value={bedForm.watch('wardId') || defaultBedWardId || null}
                  onValueChange={(val) =>
                    bedForm.setValue('wardId', val ?? '', { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select ward">
                      {(value) => {
                        const w = (wards || []).find((x) => x.id === value);
                        if (!w) return 'Select ward';
                        return w.floor?.name ? `${w.name} — ${w.floor.name}` : w.name;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(wards || []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                        {w.floor?.name ? ` — ${w.floor.name}` : ''}
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
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>Bed Type</Label>
                  <Select
                    value={bedForm.watch('bedType') || null}
                    onValueChange={(val) =>
                      bedForm.setValue('bedType', val ?? '', { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Standard">
                        {(value) => {
                          const bt = BED_TYPES.find((x) => x.value === value);
                          return bt ? bt.label : 'Standard';
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BED_TYPES.map((bt) => (
                        <SelectItem key={bt.value} value={bt.value}>
                          {bt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  {createBed.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Add Bed
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <BulkBedFormBody
              form={bulkBedForm}
              wards={wards || []}
              isPending={bulkCreateBeds.isPending}
              onWardChange={handleBulkWardChange}
              onCancel={() => {
                setBedDialogOpen(false);
                bulkBedForm.reset();
              }}
              onSubmit={onBulkBedSubmit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  tone: 'primary' | 'blue' | 'amber' | 'emerald';
}) {
  const tones: Record<string, { border: string; bg: string; text: string }> = {
    primary: { border: 'border-l-primary', bg: 'bg-primary/10', text: 'text-primary' },
    blue: { border: 'border-l-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600' },
    amber: { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600' },
    emerald: {
      border: 'border-l-emerald-500',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600',
    },
  };
  const t = tones[tone];
  return (
    <div className={`bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 ${t.border}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.bg} ${t.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function BulkBedFormBody({
  form,
  wards,
  isPending,
  onWardChange,
  onCancel,
  onSubmit,
}: {
  form: UseFormReturn<BulkBedForm>;
  wards: Ward[];
  isPending: boolean;
  onWardChange: (wardId: string) => void;
  onCancel: () => void;
  onSubmit: (data: BulkBedForm) => void;
}) {
  const wardId = form.watch('wardId');
  const prefix = form.watch('prefix') || '';
  const startNumber = Number(form.watch('startNumber') ?? 1);
  const count = Number(form.watch('count') ?? 0);
  const padding = Number(form.watch('padding') ?? 0);

  const preview = useMemo(
    () => buildBedNumbers(prefix, startNumber, count, padding),
    [prefix, startNumber, count, padding],
  );

  const previewHead = preview.slice(0, 6);
  const previewTail = preview.length > 6 ? preview.slice(-2) : [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Ward *</Label>
        <Select
          value={wardId || null}
          onValueChange={(val) => onWardChange(val ?? '')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select ward">
              {(value) => {
                const w = wards.find((x) => x.id === value);
                if (!w) return 'Select ward';
                return w.floor?.name ? `${w.name} — ${w.floor.name}` : w.name;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {wards.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
                {w.floor?.name ? ` — ${w.floor.name}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.wardId && (
          <p className="text-xs text-destructive">{form.formState.errors.wardId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-prefix">Prefix</Label>
          <Input id="bulk-prefix" {...form.register('prefix')} placeholder="e.g. B-" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-start">Start #</Label>
          <Input
            id="bulk-start"
            type="number"
            min={0}
            {...form.register('startNumber', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-count">How Many *</Label>
          <Input
            id="bulk-count"
            type="number"
            min={1}
            max={200}
            {...form.register('count', { valueAsNumber: true })}
          />
          {form.formState.errors.count && (
            <p className="text-xs text-destructive">{form.formState.errors.count.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-padding">Pad Zeros</Label>
          <Select
            value={String(padding)}
            onValueChange={(val) =>
              form.setValue('padding', Number(val ?? '0'), { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None">
                {(value) => {
                  const n = Number(value);
                  return n > 0 ? `${n} digits (e.g. ${'0'.repeat(n - 1)}1)` : 'None';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">None</SelectItem>
              <SelectItem value="2">2 digits (e.g. 01)</SelectItem>
              <SelectItem value="3">3 digits (e.g. 001)</SelectItem>
              <SelectItem value="4">4 digits (e.g. 0001)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Bed Type</Label>
          <Select
            value={form.watch('bedType') || null}
            onValueChange={(val) =>
              form.setValue('bedType', val ?? '', { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Standard">
                {(value) => {
                  const bt = BED_TYPES.find((x) => x.value === value);
                  return bt ? bt.label : 'Standard';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BED_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>
                  {bt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Preview
          </p>
          <p className="font-label text-[10px] text-on-surface-variant">
            {preview.length} bed{preview.length === 1 ? '' : 's'}
          </p>
        </div>
        {preview.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Set count to see preview</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {previewHead.map((n) => (
              <Badge key={n} variant="secondary" className="font-mono text-[11px]">
                {n}
              </Badge>
            ))}
            {previewTail.length > 0 && (
              <>
                <span className="text-xs text-on-surface-variant self-center">…</span>
                {previewTail.map((n) => (
                  <Badge key={n} variant="secondary" className="font-mono text-[11px]">
                    {n}
                  </Badge>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || preview.length === 0}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Create {preview.length || ''} Bed{preview.length === 1 ? '' : 's'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FloorCard({
  floor,
  wardsCount,
  bedsCount,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onAddWard,
  children,
}: {
  floor: Floor;
  wardsCount: number;
  bedsCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWard: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-low transition-colors border-b"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-label text-sm font-bold truncate">{floor.name}</p>
              <Badge variant="secondary" className="text-[10px]">
                Level {floor.level}
              </Badge>
            </div>
            <p className="font-label text-[10px] text-on-surface-variant truncate">
              {wardsCount} ward{wardsCount === 1 ? '' : 's'} · {bedsCount} bed
              {bedsCount === 1 ? '' : 's'}
              {floor.description ? ` · ${floor.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={onAddWard}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ward
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-on-surface-variant ml-1" />
          ) : (
            <ChevronRight className="h-4 w-4 text-on-surface-variant ml-1" />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="p-2">
          {wardsCount === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="font-label text-sm text-on-surface-variant">
                No wards on this floor yet.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={onAddWard}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Ward
              </Button>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

function WardList({
  wards,
  bedsByWard,
  expandedWard,
  onToggleWard,
  onEditWard,
  onDeleteWard,
  onAddBed,
  onDeleteBed,
}: {
  wards: Ward[];
  bedsByWard: Map<string, BedAvailability[]>;
  expandedWard: string | null;
  onToggleWard: (id: string) => void;
  onEditWard: (ward: Ward) => void;
  onDeleteWard: (id: string) => void;
  onAddBed: (wardId: string) => void;
  onDeleteBed: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {wards.map((ward) => {
        const isOpen = expandedWard === ward.id;
        const wBeds = bedsByWard.get(ward.id) || [];
        const avail = wBeds.filter((b) => b.status === 'available').length;
        const occupied = wBeds.filter((b) => b.status === 'occupied').length;
        return (
          <div
            key={ward.id}
            className="rounded-xl border border-outline-variant/50 overflow-hidden"
          >
            <div
              className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-container-low/30 hover:bg-surface-container-low transition-colors cursor-pointer"
              onClick={() => onToggleWard(ward.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-on-surface-variant shrink-0" />
                )}
                <Building className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-label text-sm font-bold truncate">{ward.name}</p>
                    {ward.wardType && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {ward.wardType.replace('_', ' ')}
                      </Badge>
                    )}
                    {ward.dailyCharge != null && Number(ward.dailyCharge) > 0 && (
                      <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-700">
                        ₹{Number(ward.dailyCharge).toLocaleString('en-IN')}/day
                      </Badge>
                    )}
                  </div>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    {wBeds.length} bed{wBeds.length === 1 ? '' : 's'} · {avail} available · {occupied} occupied
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => onAddBed(ward.id)}>
                  <BedDouble className="mr-1 h-3.5 w-3.5" />
                  Bed
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditWard(ward)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteWard(ward.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {isOpen && (
              <div className="px-3 py-2 bg-surface-container-lowest">
                {wBeds.length === 0 ? (
                  <p className="font-label text-xs text-on-surface-variant text-center py-3">
                    No beds in this ward yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bed</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wBeds.map((bed) => {
                        const statusInfo = BED_STATUS_MAP[bed.status] ?? {
                          label: bed.status,
                          variant: 'secondary' as const,
                        };
                        return (
                          <TableRow key={bed.id}>
                            <TableCell className="font-label text-sm font-bold">
                              {bed.bedNumber}
                            </TableCell>
                            <TableCell className="font-label text-sm text-on-surface-variant capitalize">
                              {bed.bedType || 'Standard'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => onDeleteBed(bed.id)}
                                disabled={bed.status === 'occupied'}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
