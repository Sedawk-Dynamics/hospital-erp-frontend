'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Settings, Plus, Pencil, MapPin, Monitor, CheckCircle2, XCircle, Wrench, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useOperatingTheaters, useCreateOperatingTheater, useUpdateOperatingTheater,
  useDeleteOperatingTheater, useOtSchedulingSettings, useUpdateOtSchedulingSettings,
  type OperatingTheater,
} from '@/hooks/use-ot';

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  in_use: 'bg-blue-100 text-blue-700 border-blue-300',
  maintenance: 'bg-amber-100 text-amber-700 border-amber-300',
};

const statusIcon: Record<string, typeof CheckCircle2> = {
  available: CheckCircle2,
  in_use: Monitor,
  maintenance: Wrench,
};

const theaterSchema = z.object({
  name: z.string().min(1, 'Theater name is required').max(100),
  location: z.string().max(255).optional(),
  status: z.enum(['available', 'in_use', 'maintenance']),
  equipmentText: z.string().optional(),
});
type TheaterForm = z.infer<typeof theaterSchema>;

export default function OTSettingsPage() {
  const { data: theaters, isLoading } = useOperatingTheaters();
  const create = useCreateOperatingTheater();
  const update = useUpdateOperatingTheater();
  const remove = useDeleteOperatingTheater();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperatingTheater | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: OperatingTheater) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = (t: OperatingTheater) => {
    if (!confirm(`Delete theater "${t.name}"?`)) return;
    remove.mutate(t.id, {
      onSuccess: () => toast.success('Theater deleted'),
      onError: (e: any) => toast.error(e?.message ?? 'Delete failed'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Settings"
        description="Configure operating theaters, equipment and preferences"
        action={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Theater
          </Button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-5 border-b flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold">Operating Theaters</h2>
            <p className="text-sm text-muted-foreground">Manage theater configurations, locations and equipment</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5"><Skeleton className="h-24 w-full" /></div>
        ) : !theaters || theaters.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Monitor}
              title="No operating theaters configured"
              description="Add operating theaters to start managing OT schedules and equipment."
              action={
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Theater
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {theaters.map((t) => {
              const Icon = statusIcon[t.status] ?? CheckCircle2;
              return (
                <div
                  key={t.id}
                  className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-5 hover:shadow-lg transition-all duration-150 border"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{t.name}</h3>
                      {t.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {t.location}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLOR[t.status] ?? ''}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {t.equipmentList && t.equipmentList.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Equipment</p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.equipmentList.map((eq) => (
                          <span
                            key={eq}
                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(t)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SchedulingPreferencesCard />

      <TheaterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        theater={editing}
        onSubmit={(values) => {
          const payload = {
            name: values.name,
            location: values.location || undefined,
            status: values.status,
            equipmentList: values.equipmentText
              ? values.equipmentText.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
          };
          if (editing) {
            update.mutate(
              { id: editing.id, ...payload },
              {
                onSuccess: () => {
                  toast.success('Theater updated');
                  setDialogOpen(false);
                },
                onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
              },
            );
          } else {
            create.mutate(payload, {
              onSuccess: () => {
                toast.success('Theater created');
                setDialogOpen(false);
              },
              onError: (e: any) => toast.error(e?.message ?? 'Create failed'),
            });
          }
        }}
        isPending={create.isPending || update.isPending}
      />
    </div>
  );
}

function SchedulingPreferencesCard() {
  const { data: settings, isLoading } = useOtSchedulingSettings();
  const update = useUpdateOtSchedulingSettings();
  const [form, setForm] = useState({
    defaultDurationMinutes: 60,
    bufferMinutes: 30,
    maxSurgeriesPerDay: 10,
    dayStartTime: '',
    dayEndTime: '',
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      defaultDurationMinutes: settings.defaultDurationMinutes,
      bufferMinutes: settings.bufferMinutes,
      maxSurgeriesPerDay: settings.maxSurgeriesPerDay,
      dayStartTime: settings.dayStartTime ?? '',
      dayEndTime: settings.dayEndTime ?? '',
    });
  }, [settings]);

  const handleSave = () => {
    update.mutate(
      {
        defaultDurationMinutes: Number(form.defaultDurationMinutes) || 60,
        bufferMinutes: Number(form.bufferMinutes) || 0,
        maxSurgeriesPerDay: Number(form.maxSurgeriesPerDay) || 1,
        dayStartTime: form.dayStartTime || null,
        dayEndTime: form.dayEndTime || null,
      },
      {
        onSuccess: () => toast.success('Scheduling preferences saved'),
        onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Save failed'),
      },
    );
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
      <div className="p-5 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold">Scheduling Preferences</h2>
            <p className="text-sm text-muted-foreground">Default surgery duration, buffers, and daily caps</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={update.isPending || isLoading}>
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          Save
        </Button>
      </div>
      <div className="p-5 space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Default Surgery Duration (min)</Label>
              <Input
                type="number"
                value={form.defaultDurationMinutes}
                onChange={(e) => setForm({ ...form, defaultDurationMinutes: Number(e.target.value) })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Buffer Time Between Surgeries (min)</Label>
              <Input
                type="number"
                value={form.bufferMinutes}
                onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Max Surgeries Per Day</Label>
              <Input
                type="number"
                value={form.maxSurgeriesPerDay}
                onChange={(e) => setForm({ ...form, maxSurgeriesPerDay: Number(e.target.value) })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>OT Day Starts At</Label>
              <Input
                type="time"
                value={form.dayStartTime}
                onChange={(e) => setForm({ ...form, dayStartTime: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>OT Day Ends At</Label>
              <Input
                type="time"
                value={form.dayEndTime}
                onChange={(e) => setForm({ ...form, dayEndTime: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TheaterDialog({
  open, onOpenChange, theater, onSubmit, isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  theater: OperatingTheater | null;
  onSubmit: (values: TheaterForm) => void;
  isPending: boolean;
}) {
  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<TheaterForm>({
    resolver: zodResolver(theaterSchema),
    defaultValues: {
      name: '',
      location: '',
      status: 'available',
      equipmentText: '',
    },
  });

  // Reset whenever the parent points us at a different theater (or null for "Add").
  useEffect(() => {
    if (!open) return;
    reset({
      name: theater?.name ?? '',
      location: theater?.location ?? '',
      status: (theater?.status ?? 'available') as 'available' | 'in_use' | 'maintenance',
      equipmentText: theater?.equipmentList?.join(', ') ?? '',
    });
  }, [theater, open, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{theater ? 'Edit Theater' : 'Add Operating Theater'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} placeholder="e.g., OT-1" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register('location')} placeholder="e.g., Floor 3, Block A" />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(v) => setValue('status', (v ?? 'available') as 'available' | 'in_use' | 'maintenance')}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="equip">Equipment (comma-separated)</Label>
            <Input id="equip" {...register('equipmentText')} placeholder="C-arm, Ventilator, Monitor" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {theater ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
