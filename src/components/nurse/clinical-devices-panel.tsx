'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useClinicalDevices,
  useCreateClinicalDevice,
  useRemoveClinicalDevice,
  useCreateDeviceCheck,
  useDeviceChecks,
  CLINICAL_DEVICE_TYPE_LABELS,
  type ClinicalDevice,
  type ClinicalDeviceType,
  type DeviceFlowStatus,
  type DevicePatency,
  type DeviceSiteCondition,
  type DeviceSecurement,
  type UrineColor,
  type UrineFlow,
  type OxygenMode,
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
import {
  Loader2,
  Plus,
  Clock,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewDeviceForm {
  deviceType: ClinicalDeviceType | '';
  deviceSubtype: string;
  site: string;
  insertionTime: string;
  fluidType: string;
  flowRateMlPerHr: string;
  flowStatus: DeviceFlowStatus | '';
  oxygenMode: OxygenMode | '';
  oxygenFlowRate: string;
  notes: string;
}

const INITIAL_DEVICE: NewDeviceForm = {
  deviceType: '',
  deviceSubtype: '',
  site: '',
  insertionTime: new Date().toISOString().slice(0, 16),
  fluidType: '',
  flowRateMlPerHr: '',
  flowStatus: '',
  oxygenMode: '',
  oxygenFlowRate: '',
  notes: '',
};

interface CheckForm {
  patency: DevicePatency | '';
  siteCondition: DeviceSiteCondition | '';
  securement: DeviceSecurement | '';
  flowStatus: DeviceFlowStatus | '';
  urineFlow: UrineFlow | '';
  urineColor: UrineColor | '';
  painPresent: 'yes' | 'no' | '';
  infectionSuspected: boolean;
  dislodged: boolean;
  blocked: boolean;
  remarks: string;
}

const INITIAL_CHECK: CheckForm = {
  patency: '',
  siteCondition: '',
  securement: '',
  flowStatus: '',
  urineFlow: '',
  urineColor: '',
  painPresent: '',
  infectionSuspected: false,
  dislodged: false,
  blocked: false,
  remarks: '',
};

export function ClinicalDevicesPanel({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const [activeOpen, setActiveOpen] = useState<string | null>(null); // expanded device id
  const [addOpen, setAddOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState<string | null>(null); // device id to check
  const [removeOpen, setRemoveOpen] = useState<string | null>(null);
  const [form, setForm] = useState<NewDeviceForm>(INITIAL_DEVICE);
  const [checkForm, setCheckForm] = useState<CheckForm>(INITIAL_CHECK);

  const { data, isLoading } = useClinicalDevices(
    { patientId, limit: 50 },
    { enabled: !!patientId },
  );
  const create = useCreateClinicalDevice();
  const remove = useRemoveClinicalDevice();
  const addCheck = useCreateDeviceCheck();

  const devices: ClinicalDevice[] = Array.isArray(data?.data)
    ? (data!.data as ClinicalDevice[])
    : [];

  const active = useMemo(() => devices.filter((d) => d.status === 'active'), [devices]);
  const past = useMemo(() => devices.filter((d) => d.status !== 'active'), [devices]);

  function set<K extends keyof NewDeviceForm>(k: K, v: NewDeviceForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function setCheck<K extends keyof CheckForm>(k: K, v: CheckForm[K]) {
    setCheckForm((p) => ({ ...p, [k]: v }));
  }

  function parseNum(v: string): number | undefined {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  function submit() {
    if (!form.deviceType || !form.site.trim() || !form.insertionTime) {
      toast.error('Device type, site and insertion time are required');
      return;
    }
    create.mutate(
      {
        patientId,
        admissionId,
        deviceType: form.deviceType,
        deviceSubtype: form.deviceSubtype || undefined,
        site: form.site.trim(),
        insertionTime: new Date(form.insertionTime).toISOString(),
        flowStatus: form.flowStatus || undefined,
        fluidType: form.fluidType || undefined,
        flowRateMlPerHr: parseNum(form.flowRateMlPerHr),
        oxygenMode: form.oxygenMode || undefined,
        oxygenFlowRate: parseNum(form.oxygenFlowRate),
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Device recorded');
          setAddOpen(false);
          setForm(INITIAL_DEVICE);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to record');
        },
      },
    );
  }

  function submitCheck(deviceId: string) {
    const empty =
      !checkForm.patency &&
      !checkForm.siteCondition &&
      !checkForm.securement &&
      !checkForm.flowStatus &&
      !checkForm.urineFlow &&
      !checkForm.urineColor &&
      !checkForm.painPresent &&
      !checkForm.infectionSuspected &&
      !checkForm.dislodged &&
      !checkForm.blocked &&
      !checkForm.remarks.trim();
    if (empty) {
      toast.error('Record at least one check field');
      return;
    }
    addCheck.mutate(
      {
        deviceId,
        patency: checkForm.patency || undefined,
        siteCondition: checkForm.siteCondition || undefined,
        securement: checkForm.securement || undefined,
        flowStatus: checkForm.flowStatus || undefined,
        urineFlow: checkForm.urineFlow || undefined,
        urineColor: checkForm.urineColor || undefined,
        painPresent:
          checkForm.painPresent === '' ? undefined : checkForm.painPresent === 'yes',
        infectionSuspected: checkForm.infectionSuspected || undefined,
        dislodged: checkForm.dislodged || undefined,
        blocked: checkForm.blocked || undefined,
        remarks: checkForm.remarks || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Check recorded');
          setCheckOpen(null);
          setCheckForm(INITIAL_CHECK);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to record');
        },
      },
    );
  }

  function submitRemove(deviceId: string) {
    remove.mutate(
      { id: deviceId, status: 'removed' },
      {
        onSuccess: () => {
          toast.success('Device removed');
          setRemoveOpen(null);
        },
        onError: (err: unknown) => {
          toast.error((err as { message?: string })?.message ?? 'Failed to remove');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            Devices &amp; Lines
          </h3>
          <p className="text-[10px] text-on-surface-variant">
            Active items requiring monitoring (IV, catheter, oxygen, drain…)
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Device</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Insert Device / Line</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                    placeholder="e.g. Foley, Nasal Cannula"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Site *
                  </label>
                  <Input
                    value={form.site}
                    onChange={(e) => set('site', e.target.value)}
                    placeholder="e.g. Left forearm"
                  />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Insertion Time *
                  </label>
                  <Input
                    type="datetime-local"
                    value={form.insertionTime}
                    onChange={(e) => set('insertionTime', e.target.value)}
                  />
                </div>
              </div>

              {/* IV-specific */}
              {(form.deviceType === 'iv_cannula' ||
                form.deviceType === 'central_line') && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Fluid Type
                    </label>
                    <Input
                      value={form.fluidType}
                      onChange={(e) => set('fluidType', e.target.value)}
                      placeholder="NS, RL…"
                    />
                  </div>
                  <div>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Flow (ml/hr)
                    </label>
                    <Input
                      type="number"
                      value={form.flowRateMlPerHr}
                      onChange={(e) => set('flowRateMlPerHr', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Status
                    </label>
                    <Select
                      value={form.flowStatus || null}
                      onValueChange={(v) =>
                        set('flowStatus', (v ?? '') as DeviceFlowStatus | '')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="stopped">Stopped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Oxygen-specific */}
              {form.deviceType === 'oxygen_device' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Mode
                    </label>
                    <Select
                      value={form.oxygenMode || null}
                      onValueChange={(v) => set('oxygenMode', (v ?? '') as OxygenMode | '')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nasal_cannula">Nasal Cannula</SelectItem>
                        <SelectItem value="mask">Mask</SelectItem>
                        <SelectItem value="venturi">Venturi</SelectItem>
                        <SelectItem value="rebreather">Rebreather</SelectItem>
                        <SelectItem value="high_flow">High Flow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Flow Rate (L/min)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.oxygenFlowRate}
                      onChange={(e) => set('oxygenFlowRate', e.target.value)}
                    />
                  </div>
                </div>
              )}

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
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
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

      {/* Active devices */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-6">
          No active devices
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              expanded={activeOpen === d.id}
              onToggle={() => setActiveOpen(activeOpen === d.id ? null : d.id)}
              onCheck={() => {
                setCheckForm(INITIAL_CHECK);
                setCheckOpen(d.id);
              }}
              onRemove={() => setRemoveOpen(d.id)}
            />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <details className="rounded-lg border border-outline-variant/20 p-3">
          <summary className="text-xs font-semibold text-on-surface-variant cursor-pointer">
            Past devices ({past.length})
          </summary>
          <div className="mt-3 space-y-2">
            {past.map((d) => (
              <div
                key={d.id}
                className="rounded border border-outline-variant/10 p-2 text-xs flex items-center justify-between opacity-70"
              >
                <span>
                  {CLINICAL_DEVICE_TYPE_LABELS[d.deviceType]} – {d.site}
                </span>
                <span className="text-on-surface-variant">
                  {d.removalTime ? `Removed ${formatDateTime(d.removalTime)}` : d.status}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Check dialog */}
      <Dialog open={!!checkOpen} onOpenChange={(o) => !o && setCheckOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Device Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Patency
                </label>
                <Select
                  value={checkForm.patency || null}
                  onValueChange={(v) => setCheck('patency', (v ?? '') as DevicePatency | '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patent">Patent</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Site Condition
                </label>
                <Select
                  value={checkForm.siteCondition || null}
                  onValueChange={(v) =>
                    setCheck('siteCondition', (v ?? '') as DeviceSiteCondition | '')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="redness">Redness</SelectItem>
                    <SelectItem value="swelling">Swelling</SelectItem>
                    <SelectItem value="infection">Infection</SelectItem>
                    <SelectItem value="leakage">Leakage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Securement
                </label>
                <Select
                  value={checkForm.securement || null}
                  onValueChange={(v) =>
                    setCheck('securement', (v ?? '') as DeviceSecurement | '')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secure">Secure</SelectItem>
                    <SelectItem value="loose">Loose</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Pain Present
                </label>
                <Select
                  value={checkForm.painPresent || null}
                  onValueChange={(v) =>
                    setCheck('painPresent', (v ?? '') as 'yes' | 'no' | '')
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  IV Flow Status
                </label>
                <Select
                  value={checkForm.flowStatus || null}
                  onValueChange={(v) =>
                    setCheck('flowStatus', (v ?? '') as DeviceFlowStatus | '')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                  Urine Flow
                </label>
                <Select
                  value={checkForm.urineFlow || null}
                  onValueChange={(v) =>
                    setCheck('urineFlow', (v ?? '') as UrineFlow | '')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adequate">Adequate</SelectItem>
                    <SelectItem value="reduced">Reduced</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                Urine Color
              </label>
              <Select
                value={checkForm.urineColor || null}
                onValueChange={(v) => setCheck('urineColor', (v ?? '') as UrineColor | '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="bloody">Bloody</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={checkForm.infectionSuspected}
                  onChange={(e) => setCheck('infectionSuspected', e.target.checked)}
                />
                Infection suspected
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={checkForm.dislodged}
                  onChange={(e) => setCheck('dislodged', e.target.checked)}
                />
                Dislodged
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={checkForm.blocked}
                  onChange={(e) => setCheck('blocked', e.target.checked)}
                />
                Blocked
              </label>
            </div>

            <div>
              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 block">
                Remarks
              </label>
              <Textarea
                rows={2}
                value={checkForm.remarks}
                onChange={(e) => setCheck('remarks', e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => checkOpen && submitCheck(checkOpen)}
              disabled={addCheck.isPending}
            >
              {addCheck.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeOpen} onOpenChange={(o) => !o && setRemoveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove device?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-on-surface-variant">
            Marks the device as removed at the current time. Past checks remain in history.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => removeOpen && submitRemove(removeOpen)}
              disabled={remove.isPending}
            >
              {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeviceCard({
  device,
  expanded,
  onToggle,
  onCheck,
  onRemove,
}: {
  device: ClinicalDevice;
  expanded: boolean;
  onToggle: () => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const { data: checksData } = useDeviceChecks(device.id, { enabled: expanded });
  const checks = Array.isArray(checksData?.data) ? (checksData!.data as any[]) : [];
  const last = device.checks?.[0] ?? checks[0];

  return (
    <div className="rounded-lg border border-outline-variant/30 p-3 hover:bg-surface-container-low/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-on-surface">
              {CLINICAL_DEVICE_TYPE_LABELS[device.deviceType]}
            </span>
            {device.deviceSubtype && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground">
                {device.deviceSubtype}
              </span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Active
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Site: {device.site} · Inserted {formatDateTime(device.insertionTime)}
            {device.inserter && ` by ${device.inserter.firstName} ${device.inserter.lastName ?? ''}`}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-on-surface-variant">
            {device.fluidType && <span>Fluid: {device.fluidType}</span>}
            {device.flowRateMlPerHr != null && <span>{device.flowRateMlPerHr} ml/hr</span>}
            {device.flowStatus && <span>Status: {device.flowStatus}</span>}
            {device.oxygenMode && <span>Mode: {device.oxygenMode.replace('_', ' ')}</span>}
            {device.oxygenFlowRate != null && <span>{device.oxygenFlowRate} L/min</span>}
          </div>
          {last && (
            <p className="text-[10px] text-on-surface-variant mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last check {formatDateTime((last as any).checkedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="outline" onClick={onCheck} className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Check
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {expanded ? 'Hide' : 'History'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-outline-variant/20 pt-3">
          {checks.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No checks yet</p>
          ) : (
            <ul className="space-y-1.5">
              {checks.map((c: any) => (
                <li
                  key={c.id}
                  className="text-xs rounded bg-surface-container-low/40 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {c.patency && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                            c.patency === 'patent'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700',
                          )}
                        >
                          {c.patency === 'patent' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {c.patency}
                        </span>
                      )}
                      {c.siteCondition && c.siteCondition !== 'normal' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {c.siteCondition}
                        </span>
                      )}
                      {c.infectionSuspected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          infection?
                        </span>
                      )}
                    </div>
                    <span className="text-on-surface-variant whitespace-nowrap">
                      {formatDateTime(c.checkedAt)}
                    </span>
                  </div>
                  {c.remarks && (
                    <p className="text-on-surface-variant mt-0.5 truncate">{c.remarks}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
