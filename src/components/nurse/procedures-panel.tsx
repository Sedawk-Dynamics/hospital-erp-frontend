'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useClinicalProcedures,
  useCreateProcedure,
  CLINICAL_DEVICE_TYPE_LABELS,
  PROCEDURE_COMPLICATION_LABELS,
  type ClinicalProcedure,
  type ClinicalDeviceType,
  type ProcedureComplication,
  type ProcedureSide,
  type ProcedureStatus,
  type ProcedureTolerance,
} from '@/hooks/use-nursing-forms';
import { formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Clock, ListChecks } from 'lucide-react';

const PROCEDURE_TYPES = [
  'IV Cannulation',
  'Catheterisation',
  'NG Tube Insertion',
  'Wound Dressing',
  'Suction',
  'Nebulisation',
  'Blood Sample Collection',
  'Injection (IM/SC)',
  'Oxygen Setup',
  'Drain Insertion',
  'ECG',
  'Other',
];

interface FormState {
  procedureType: string;
  procedureSubtype: string;
  performedAt: string;
  site: string;
  side: ProcedureSide | '';
  status: ProcedureStatus;
  attemptCount: string;
  asepticTechnique: 'yes' | 'no' | '';
  equipmentUsed: string;
  complications: ProcedureComplication | '';
  complicationNotes: string;
  tolerance: ProcedureTolerance | '';
  painScore: string;
  createsDevice: boolean;
  deviceType: ClinicalDeviceType | '';
  deviceSubtype: string;
  notes: string;
}

const INITIAL: FormState = {
  procedureType: '',
  procedureSubtype: '',
  performedAt: new Date().toISOString().slice(0, 16),
  site: '',
  side: '',
  status: 'successful',
  attemptCount: '',
  asepticTechnique: '',
  equipmentUsed: '',
  complications: '',
  complicationNotes: '',
  tolerance: '',
  painScore: '',
  createsDevice: false,
  deviceType: '',
  deviceSubtype: '',
  notes: '',
};

export function ProceduresPanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL);
  const { data, isLoading } = useClinicalProcedures(
    { patientId, limit: 30 },
    { enabled: !!patientId },
  );
  const create = useCreateProcedure();

  const items: ClinicalProcedure[] = Array.isArray(data?.data)
    ? (data!.data as ClinicalProcedure[])
    : [];

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function parseNum(v: string): number | undefined {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function submit() {
    if (!form.procedureType.trim() || !form.performedAt) {
      toast.error('Procedure type and time are required');
      return;
    }
    if (form.createsDevice && (!form.deviceType || !form.site.trim())) {
      toast.error('Device requires a type and site');
      return;
    }

    create.mutate(
      {
        patientId,
        admissionId,
        procedureType: form.procedureType.trim(),
        procedureSubtype: form.procedureSubtype || undefined,
        performedAt: new Date(form.performedAt).toISOString(),
        site: form.site || undefined,
        side: form.side || undefined,
        status: form.status,
        attemptCount: parseNum(form.attemptCount),
        asepticTechnique:
          form.asepticTechnique === '' ? undefined : form.asepticTechnique === 'yes',
        equipmentUsed: form.equipmentUsed || undefined,
        complications: form.complications || undefined,
        complicationNotes: form.complicationNotes || undefined,
        tolerance: form.tolerance || undefined,
        painScore: parseNum(form.painScore),
        device:
          form.createsDevice && form.deviceType
            ? {
                deviceType: form.deviceType as ClinicalDeviceType,
                deviceSubtype: form.deviceSubtype || undefined,
                site: form.site,
              }
            : undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Procedure recorded');
          setOpen(false);
          setForm(INITIAL);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to record');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Procedures
          </h3>
          <p className="text-[10px] text-on-surface-variant">
            One-time clinical actions performed by nursing staff
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Log Procedure</Button>} />
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Procedure</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Type *
                  </label>
                  <Select
                    value={form.procedureType || null}
                    onValueChange={(v) => set('procedureType', v ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Subtype
                  </label>
                  <Input
                    value={form.procedureSubtype}
                    onChange={(e) => set('procedureSubtype', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Performed At *
                  </label>
                  <Input
                    type="datetime-local"
                    value={form.performedAt}
                    onChange={(e) => set('performedAt', e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Site
                  </label>
                  <Input
                    value={form.site}
                    onChange={(e) => set('site', e.target.value)}
                    placeholder="e.g. Left forearm"
                  />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Side
                  </label>
                  <Select
                    value={form.side || null}
                    onValueChange={(v) => set('side', (v ?? '') as ProcedureSide | '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="midline">Midline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set('status', (v ?? 'successful') as ProcedureStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="successful">Successful</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Attempts
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.attemptCount}
                    onChange={(e) => set('attemptCount', e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Aseptic Technique
                  </label>
                  <Select
                    value={form.asepticTechnique || null}
                    onValueChange={(v) =>
                      set('asepticTechnique', (v ?? '') as 'yes' | 'no' | '')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Equipment Used
                </label>
                <Input
                  value={form.equipmentUsed}
                  onChange={(e) => set('equipmentUsed', e.target.value)}
                  placeholder="e.g. 18G IV catheter, 10ml syringe"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Complications
                  </label>
                  <Select
                    value={form.complications || null}
                    onValueChange={(v) =>
                      set('complications', (v ?? '') as ProcedureComplication | '')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROCEDURE_COMPLICATION_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Tolerance
                  </label>
                  <Select
                    value={form.tolerance || null}
                    onValueChange={(v) =>
                      set('tolerance', (v ?? '') as ProcedureTolerance | '')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="well_tolerated">Well tolerated</SelectItem>
                      <SelectItem value="poorly_tolerated">Poorly tolerated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Complication Notes
                </label>
                <Textarea
                  rows={2}
                  value={form.complicationNotes}
                  onChange={(e) => set('complicationNotes', e.target.value)}
                />
              </div>

              {/* Device link */}
              <div className="rounded-lg border border-outline-variant/30 p-3 space-y-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.createsDevice}
                    onChange={(e) => set('createsDevice', e.target.checked)}
                  />
                  This procedure created an ongoing device / line
                </label>
                {form.createsDevice && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                        Device Type *
                      </label>
                      <Select
                        value={form.deviceType || null}
                        onValueChange={(v) =>
                          set('deviceType', (v ?? '') as ClinicalDeviceType | '')
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CLINICAL_DEVICE_TYPE_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                        Subtype
                      </label>
                      <Input
                        value={form.deviceSubtype}
                        onChange={(e) => set('deviceSubtype', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Notes
                </label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-6">
          No procedures recorded yet
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-outline-variant/20 p-3 hover:bg-surface-container-low/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{p.procedureType}</span>
                    {p.procedureSubtype && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground">
                        {p.procedureSubtype}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'successful'
                          ? 'bg-emerald-100 text-emerald-700'
                          : p.status === 'partial'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.deviceCreated && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        + device
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-on-surface-variant">
                    {p.site && <span>Site: {p.site}</span>}
                    {p.side && <span>Side: {p.side}</span>}
                    {p.attemptCount != null && <span>Attempts: {p.attemptCount}</span>}
                    {p.complications && p.complications !== 'none' && (
                      <span className="text-red-600 font-medium">
                        Complication: {PROCEDURE_COMPLICATION_LABELS[p.complications]}
                      </span>
                    )}
                    {p.tolerance && <span>{p.tolerance.replace('_', ' ')}</span>}
                    {p.painScore != null && <span>Pain {p.painScore}/10</span>}
                  </div>
                  {p.notes && (
                    <p className="text-sm text-on-surface mt-1 whitespace-pre-wrap">
                      {p.notes}
                    </p>
                  )}
                  {p.nurse && (
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      by {p.nurse.firstName} {p.nurse.lastName ?? ''}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant whitespace-nowrap flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(p.performedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
