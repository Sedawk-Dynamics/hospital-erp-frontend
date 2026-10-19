'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fastTrackCodeSchema, type FastTrackCode } from '../../lib/schema/fast-track-code-schema';

export const FAST_TRACK_CODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'code_red_trauma', label: 'Code Red — Trauma' },
  { value: 'code_stemi', label: 'Code STEMI' },
  { value: 'code_stroke', label: 'Code Stroke' },
  { value: 'code_sepsis', label: 'Code Sepsis' },
];

/** eFAST ultrasound windows and their allowed findings (order as specified). */
const EFAST_WINDOWS: { key: string; label: string; options: string[] }[] = [
  { key: 'ruq', label: 'RUQ (Morison Pouch)', options: ['+ Free Fluid', 'Negative'] },
  { key: 'luq', label: 'LUQ (Splenorenal)', options: ['Negative', '+ Free Fluid'] },
  { key: 'suprapubic', label: 'Suprapubic (Pelvis)', options: ['Negative', '+ Free Fluid'] },
  { key: 'pericardium', label: 'Pericardium (Subxiphoid)', options: ['No Effusion', 'Tamponade'] },
  {
    key: 'thoracic',
    label: 'Thoracic / Pleural Windows',
    options: ['RT Hemothorax', 'Pneumothorax', 'Normal Lung Sliding'],
  },
];

// Superset of every code's fields — the single RHF form holds this shape, and
// zodResolver(fastTrackCodeSchema) validates/narrows it to the selected code.
// Number inputs are kept as strings (what <Input> yields); zod coerces them.
type FastTrackFormValues = {
  code: '' | FastTrackCode;
  // trauma
  prbcUnits: string;
  ffpUnits: string;
  plateletPacks: string;
  txaGiven: boolean;
  txaGivenAt: string | null;
  efast: { ruq: string; luq: string; suprapubic: string; pericardium: string; thoracic: string };
  // stemi
  ecgTime: string;
  balloonTime: string;
  infarctTerritory: string;
  aspirinGiven: boolean;
  ticagrelorGiven: boolean;
  atorvastatinGiven: boolean;
  // stroke
  ctTime: string;
  lkwWindow: string;
  nihssScore: string;
  facialDroop: string;
  armDrift: string;
  speech: string;
  bloodGlucose: string;
  // sepsis
  serumLactate: string;
  bloodCulturesDrawn: boolean;
  antibioticsGiven: boolean;
  crystalloidDone: boolean;
};

const DEFAULTS: FastTrackFormValues = {
  code: '',
  prbcUnits: '',
  ffpUnits: '',
  plateletPacks: '',
  txaGiven: false,
  txaGivenAt: null,
  efast: { ruq: '', luq: '', suprapubic: '', pericardium: '', thoracic: '' },
  ecgTime: '',
  balloonTime: '',
  infarctTerritory: '',
  aspirinGiven: false,
  ticagrelorGiven: false,
  atorvastatinGiven: false,
  ctTime: '',
  lkwWindow: '',
  nihssScore: '',
  facialDroop: '',
  armDrift: '',
  speech: '',
  bloodGlucose: '',
  serumLactate: '',
  bloodCulturesDrawn: false,
  antibioticsGiven: false,
  crystalloidDone: false,
};

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

interface FastTrackCodeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (payload: { code: FastTrackCode; details: Record<string, unknown> }) => void;
}

export function FastTrackCodeDialog({ open, setOpen, onSave }: FastTrackCodeDialogProps) {
  const fastTrackForm = useForm<FastTrackFormValues>({
    resolver: zodResolver(fastTrackCodeSchema) as never,
    defaultValues: DEFAULTS,
  });

  const { register, control, watch, setValue, handleSubmit } = fastTrackForm;
  const code = watch('code');
  const txaGiven = watch('txaGiven');
  const txaGivenAt = watch('txaGivenAt');

  // Reset the form whenever the dialog is closed so it never reopens dirty.
  useEffect(() => {
    if (!open) fastTrackForm.reset(DEFAULTS);
  }, [open, fastTrackForm]);

  const submit = handleSubmit((data) => {
    const { code, ...details } = data;
    // Validation guarantees a real code here (never '').
    onSave({ code: code as FastTrackCode, details });
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Fast Track Code</DialogTitle>
          <DialogDescription>
            Activate a rapid-response protocol code for this patient.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code *</Label>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a fast-track code" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAST_TRACK_CODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* ── Code Red — Trauma ── */}
          {code === 'code_red_trauma' && (
            <div className="space-y-4">
              {/* A) Massive Transfusion Protocol (MTP Pack 1) */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Massive Transfusion Protocol (MTP Pack 1)
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-prbc">PRBC Units</Label>
                    <Input id="ft-prbc" type="number" min={0} {...register('prbcUnits')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-ffp">FFP Units</Label>
                    <Input id="ft-ffp" type="number" min={0} {...register('ffpUnits')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-platelet">Platelet Pack (RDP/SDP)</Label>
                    <Input id="ft-platelet" type="number" min={0} {...register('plateletPacks')} />
                  </div>
                </div>

                {/* TXA — the one toggle in this card */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      {...register('txaGiven', {
                        onChange: (e) =>
                          setValue('txaGivenAt', e.target.checked ? nowTime() : null),
                      })}
                    />
                    <span className="text-xs font-medium text-on-surface">
                      Tranexamic Acid (TXA) 1g IV Bolus
                    </span>
                  </div>
                  <span
                    className={
                      txaGiven
                        ? 'text-xs font-semibold text-green-700'
                        : 'text-xs text-on-surface-variant'
                    }
                  >
                    {txaGiven ? `GIVEN (${txaGivenAt})` : 'Not given'}
                  </span>
                </label>
              </div>

              {/* B) Bedside eFAST Ultrasound Window Mapping */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bedside eFAST Ultrasound Window Mapping
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {EFAST_WINDOWS.map((w) => (
                    <div key={w.key} className="space-y-1.5">
                      <Label>{w.label}</Label>
                      <Controller
                        control={control}
                        name={`efast.${w.key}` as `efast.${keyof FastTrackFormValues['efast']}`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select finding" />
                            </SelectTrigger>
                            <SelectContent>
                              {w.options.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Code STEMI ── */}
          {code === 'code_stemi' && (
            <div className="space-y-4">
              {/* 1) Timing Events & Diagnosis */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timing Events &amp; Diagnosis
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-ecg-time">Door-to-ECG Time (in mins)</Label>
                    <Input id="ft-ecg-time" type="number" min={0} placeholder="e.g. 8" {...register('ecgTime')} />
                    <p className="text-[11px] text-on-surface-variant">Target: &lt; 10 min</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-balloon-time">Door-to-Balloon Time (in mins)</Label>
                    <Input id="ft-balloon-time" type="number" min={0} placeholder="e.g. 75" {...register('balloonTime')} />
                    <p className="text-[11px] text-on-surface-variant">Target: &lt; 90 min</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-infarct">Infarct Territory</Label>
                    <Input id="ft-infarct" placeholder="e.g. Anterior wall (LAD)" {...register('infarctTerritory')} />
                  </div>
                </div>
              </div>

              {/* 3) DAPT Drugs */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  DAPT Drugs
                </p>
                <div className="grid grid-cols-3 items-center gap-4">
                  {([
                    { label: 'Aspirin 325 mg', name: 'aspirinGiven' },
                    { label: 'Ticagrelor / Clopidogrel', name: 'ticagrelorGiven' },
                    { label: 'Atorvastatin 80 mg', name: 'atorvastatinGiven' },
                  ] as const).map((d) => {
                    const checked = watch(d.name);
                    return (
                      <label
                        key={d.name}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                            {...register(d.name)}
                          />
                          <span className="text-xs font-medium text-on-surface">{d.label}</span>
                        </div>
                        <span
                          className={
                            checked
                              ? 'text-xs font-semibold text-green-700'
                              : 'text-xs text-on-surface-variant'
                          }
                        >
                          {checked ? 'Given' : 'Not given'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Code Stroke ── */}
          {code === 'code_stroke' && (
            <div className="space-y-4">
              {/* 1) Timing Events & Severity */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timing Events &amp; Severity
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-ct-time">Door-to-CT Time (in mins)</Label>
                    <Input id="ft-ct-time" type="number" min={0} placeholder="e.g. 18" {...register('ctTime')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-lkw">Last Known Well (LKW Window, in hrs)</Label>
                    <Input id="ft-lkw" type="number" min={0} placeholder="e.g. 3" {...register('lkwWindow')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-nihss">NIHSS Score</Label>
                    <Input id="ft-nihss" type="number" min={0} placeholder="e.g. 12" {...register('nihssScore')} />
                  </div>
                </div>
              </div>

              {/* 2) FAST Stroke Screen */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  FAST Stroke Screen
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-facial">Facial Droop</Label>
                    <Input id="ft-facial" placeholder="e.g. Left-sided droop" {...register('facialDroop')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-arm">Arm Drift</Label>
                    <Input id="ft-arm" placeholder="e.g. Right arm drift" {...register('armDrift')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-speech">Speech</Label>
                    <Input id="ft-speech" placeholder="e.g. Slurred" {...register('speech')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-glucose">Blood Glucose (mg/dL)</Label>
                    <Input id="ft-glucose" type="number" min={0} placeholder="e.g. 110" {...register('bloodGlucose')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Code Sepsis ── */}
          {code === 'code_sepsis' && (
            <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sepsis Bundle
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="ft-lactate">Serum Lactate (mmol/L)</Label>
                <Input id="ft-lactate" type="number" min={0} step="0.1" placeholder="e.g. 2.4" {...register('serumLactate')} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: 'Blood Cultures Drawn', name: 'bloodCulturesDrawn', on: 'Done', off: 'Not done' },
                  { label: 'IV Broad-Spectrum Antibiotics Given', name: 'antibioticsGiven', on: 'Given', off: 'Not given' },
                  { label: 'Crystalloid Resuscitation (30 mL/kg)', name: 'crystalloidDone', on: 'Done', off: 'Not done' },
                ] as const).map((d) => {
                  const checked = watch(d.name);
                  return (
                    <label
                      key={d.name}
                      className="flex cursor-pointer flex-col justify-between gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                    >
                      <div className="flex items-center  gap-2">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-input accent-primary cursor-pointer"
                          {...register(d.name)}
                        />
                        <span className="text-[11px] font-medium leading-tight text-on-surface">
                          {d.label}
                        </span>
                      </div>
                      <span
                        className={
                          checked
                            ? 'text-xs font-semibold text-green-700'
                            : 'text-xs text-on-surface-variant'
                        }
                      >
                        {checked ? d.on : d.off}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!code} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
