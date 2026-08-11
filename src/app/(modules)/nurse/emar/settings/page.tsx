'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Save, Loader2, Clock, Repeat, Settings as SettingsIcon } from 'lucide-react';
import {
  useEmarTimeSlots,
  useCreateTimeSlot,
  useUpdateTimeSlot,
  useDeleteTimeSlot,
  useEmarFrequencies,
  useCreateFrequency,
  useUpdateFrequency,
  useDeleteFrequency,
  useEmarSettings,
  useUpdateEmarSettings,
  type EmarTimeSlot,
  type EmarFrequency,
} from '@/hooks/use-emar';

export default function EmarSettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-headline text-xl font-bold">eMAR Settings</h1>
            <p className="text-sm text-muted-foreground">Configure time slots, frequency master, and grace period.</p>
          </div>
        </div>
        <Link href="/nurse/emar">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to eMAR
          </Button>
        </Link>
      </div>

      <SettingsCard />
      <TimeSlotsCard />
      <FrequenciesCard />
    </div>
  );
}

// ── Grace period & PRN min interval ──────────────────────────

function SettingsCard() {
  const { data: raw, isLoading } = useEmarSettings();
  const settings = useMemo(() => {
    if (!raw) return null;
    return (raw as any).data ?? raw;
  }, [raw]);
  const update = useUpdateEmarSettings();

  const [grace, setGrace] = useState<number>(120);
  const [prnMin, setPrnMin] = useState<number>(240);

  useEffect(() => {
    if (settings) {
      setGrace(settings.gracePeriodMinutes ?? 120);
      setPrnMin(settings.defaultPrnMinIntervalMinutes ?? 240);
    }
  }, [settings]);

  const save = async () => {
    try {
      await update.mutateAsync({ gracePeriodMinutes: grace, defaultPrnMinIntervalMinutes: prnMin });
      toast.success('eMAR settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-headline text-sm font-bold">Lifecycle Settings</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Doses past their scheduled time auto-flip to <span className="font-mono">overdue</span>, then to{' '}
            <span className="font-mono">missed</span> after the grace period.
          </p>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Grace period (minutes)</Label>
          <NumberInput min={0} max={1440} value={grace} onValueChange={setGrace} className="mt-1" />
          <p className="text-[10px] text-on-surface-variant mt-1">Time after scheduled at which an unactioned dose is auto-marked missed.</p>
        </div>
        <div>
          <Label className="text-xs">Default PRN minimum interval (minutes)</Label>
          <NumberInput min={0} max={1440} value={prnMin} onValueChange={setPrnMin} className="mt-1" />
          <p className="text-[10px] text-on-surface-variant mt-1">Minimum gap between two consecutive PRN administrations of the same drug.</p>
        </div>
        <div className="flex items-end">
          <Button size="sm" className="gap-1.5 w-full" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Time Slot CRUD ───────────────────────────────────────────

function TimeSlotsCard() {
  const { data: raw, isLoading } = useEmarTimeSlots();
  const slots: EmarTimeSlot[] = useMemo(() => {
    if (!raw) return [];
    return Array.isArray(raw) ? raw : (raw as any).data ?? [];
  }, [raw]);

  const create = useCreateTimeSlot();
  const update = useUpdateTimeSlot();
  const remove = useDeleteTimeSlot();

  const [editor, setEditor] = useState<{ open: boolean; slot: EmarTimeSlot | null }>({ open: false, slot: null });
  const [form, setForm] = useState<Partial<EmarTimeSlot>>({ code: '', label: '', time: '08:00', sortOrder: 0, isActive: true });

  const openCreate = () => {
    setEditor({ open: true, slot: null });
    setForm({ code: '', label: '', time: '08:00', sortOrder: slots.length, isActive: true });
  };
  const openEdit = (s: EmarTimeSlot) => {
    setEditor({ open: true, slot: s });
    setForm({ code: s.code, label: s.label, time: s.time, sortOrder: s.sortOrder, isActive: s.isActive });
  };

  const submit = async () => {
    try {
      if (editor.slot) {
        await update.mutateAsync({ id: editor.slot.id, data: form });
        toast.success('Time slot updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Time slot created');
      }
      setEditor({ open: false, slot: null });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  };

  const del = async (s: EmarTimeSlot) => {
    if (!confirm(`Delete time slot "${s.code}"? Doses already scheduled at this slot will keep their existing time but new orders won't use it.`)) return;
    try {
      await remove.mutateAsync(s.id);
      toast.success('Time slot deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-sm font-bold">Time Slot Master</h2>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-3 w-3" />Add slot</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left px-5 py-2.5">Code</th>
              <th className="text-left px-3 py-2.5">Label</th>
              <th className="text-left px-3 py-2.5">Time</th>
              <th className="text-left px-3 py-2.5">Order</th>
              <th className="text-left px-3 py-2.5">Active</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-b border-outline-variant/50 hover:bg-surface-container-low/40">
                <td className="px-5 py-2.5 font-mono text-xs">{s.code}</td>
                <td className="px-3 py-2.5">{s.label}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.time}</td>
                <td className="px-3 py-2.5">{s.sortOrder}</td>
                <td className="px-3 py-2.5">
                  <span className={s.isActive ? 'text-green-700' : 'text-gray-500'}>{s.isActive ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(s)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-6 text-sm text-on-surface-variant">No time slots configured. Defaults will seed automatically.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editor.open} onOpenChange={(open) => !open && setEditor({ open: false, slot: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editor.slot ? 'Edit time slot' : 'Add time slot'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Code (e.g. MORNING, NIGHT)</Label>
              <Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={form.label ?? ''} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time (HH:mm)</Label>
              <Input type="time" value={form.time ?? '08:00'} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-1 w-32" />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <NumberInput min={0} value={form.sortOrder ?? 0} onValueChange={(v) => setForm({ ...form, sortOrder: v })} className="mt-1 w-32" />
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditor({ open: false, slot: null })}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {editor.slot ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Frequency CRUD ───────────────────────────────────────────

function FrequenciesCard() {
  const { data: rawSlots } = useEmarTimeSlots();
  const slots: EmarTimeSlot[] = useMemo(() => {
    if (!rawSlots) return [];
    return Array.isArray(rawSlots) ? rawSlots : (rawSlots as any).data ?? [];
  }, [rawSlots]);

  const { data: raw, isLoading } = useEmarFrequencies();
  const freqs: EmarFrequency[] = useMemo(() => {
    if (!raw) return [];
    return Array.isArray(raw) ? raw : (raw as any).data ?? [];
  }, [raw]);

  const create = useCreateFrequency();
  const update = useUpdateFrequency();
  const remove = useDeleteFrequency();

  const [editor, setEditor] = useState<{ open: boolean; freq: EmarFrequency | null }>({ open: false, freq: null });
  const [form, setForm] = useState<Partial<EmarFrequency>>({
    code: '', label: '', type: 'slot', slotCodes: [], intervalHours: null, minPrnIntervalMinutes: null, isActive: true,
  });

  const openCreate = () => {
    setEditor({ open: true, freq: null });
    setForm({ code: '', label: '', type: 'slot', slotCodes: [], intervalHours: null, minPrnIntervalMinutes: null, isActive: true });
  };
  const openEdit = (f: EmarFrequency) => {
    setEditor({ open: true, freq: f });
    setForm({
      code: f.code, label: f.label, type: f.type,
      slotCodes: f.slotCodes ?? [],
      intervalHours: f.intervalHours, minPrnIntervalMinutes: f.minPrnIntervalMinutes,
      isActive: f.isActive,
    });
  };

  const toggleSlot = (code: string) => {
    const cur = form.slotCodes ?? [];
    setForm({
      ...form,
      slotCodes: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
    });
  };

  const submit = async () => {
    try {
      const payload: any = { ...form };
      if (form.type !== 'slot') payload.slotCodes = [];
      if (form.type !== 'interval') payload.intervalHours = null;
      if (form.type !== 'prn') payload.minPrnIntervalMinutes = null;
      if (editor.freq) {
        await update.mutateAsync({ id: editor.freq.id, data: payload });
        toast.success('Frequency updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Frequency created');
      }
      setEditor({ open: false, freq: null });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  };

  const del = async (f: EmarFrequency) => {
    if (!confirm(`Delete frequency "${f.code}"?`)) return;
    try {
      await remove.mutateAsync(f.id);
      toast.success('Frequency deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-sm font-bold">Frequency Master</h2>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-3 w-3" />Add frequency</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left px-5 py-2.5">Code</th>
              <th className="text-left px-3 py-2.5">Label</th>
              <th className="text-left px-3 py-2.5">Type</th>
              <th className="text-left px-3 py-2.5">Slots / Interval</th>
              <th className="text-left px-3 py-2.5">Active</th>
              <th className="text-right px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {freqs.map((f) => (
              <tr key={f.id} className="border-b border-outline-variant/50 hover:bg-surface-container-low/40">
                <td className="px-5 py-2.5 font-mono text-xs">{f.code}</td>
                <td className="px-3 py-2.5">{f.label}</td>
                <td className="px-3 py-2.5"><span className="text-[10px] uppercase font-bold text-on-surface-variant">{f.type}</span></td>
                <td className="px-3 py-2.5 text-xs">
                  {f.type === 'slot' && (f.slotCodes?.join(', ') || '—')}
                  {f.type === 'interval' && (f.intervalHours ? `Every ${f.intervalHours}h` : '—')}
                  {f.type === 'prn' && (f.minPrnIntervalMinutes ? `Min ${f.minPrnIntervalMinutes}m` : 'No limit')}
                  {f.type === 'once' && 'Single dose'}
                </td>
                <td className="px-3 py-2.5"><span className={f.isActive ? 'text-green-700' : 'text-gray-500'}>{f.isActive ? 'Yes' : 'No'}</span></td>
                <td className="px-5 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(f)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {freqs.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-6 text-sm text-on-surface-variant">No frequencies configured. Defaults seed automatically.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editor.open} onOpenChange={(open) => !open && setEditor({ open: false, freq: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editor.freq ? 'Edit frequency' : 'Add frequency'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Code (e.g. BD, TID, Q6H)</Label>
              <Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={form.label ?? ''} onChange={(e) => setForm({ ...form, label: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type as string} onValueChange={(v) => v && setForm({ ...form, type: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot">Slot-based (BD, TID, ...)</SelectItem>
                  <SelectItem value="interval">Interval (Q6H, Q8H, ...)</SelectItem>
                  <SelectItem value="once">Once / STAT</SelectItem>
                  <SelectItem value="prn">PRN / SOS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'slot' && (
              <div>
                <Label className="text-xs mb-1.5 block">Slots ({form.slotCodes?.length ?? 0} selected)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {slots.filter((s) => s.isActive).map((s) => {
                    const selected = (form.slotCodes ?? []).includes(s.code);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSlot(s.code)}
                        className={'text-[10px] px-2 py-1 rounded-full border ' + (selected ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant')}
                      >
                        {s.code} <span className="opacity-70">{s.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.type === 'interval' && (
              <div>
                <Label className="text-xs">Interval hours</Label>
                <NumberInput min={1} max={48} value={form.intervalHours ?? null} onValueChange={(v) => setForm({ ...form, intervalHours: v })} className="mt-1 w-32" />
              </div>
            )}

            {form.type === 'prn' && (
              <div>
                <Label className="text-xs">Minimum interval (minutes)</Label>
                <NumberInput min={0} max={1440} value={form.minPrnIntervalMinutes ?? null} onValueChange={(v) => setForm({ ...form, minPrnIntervalMinutes: v })} className="mt-1 w-32" />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditor({ open: false, freq: null })}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {editor.freq ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
