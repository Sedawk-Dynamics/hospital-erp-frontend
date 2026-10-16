'use client';

import { useState } from 'react';

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

interface FastTrackCodeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function FastTrackCodeDialog({ open, setOpen }: FastTrackCodeDialogProps) {
  const [code, setCode] = useState('');

  // ── Code Red — Trauma fields (UI-only; RHF + zod wired in a later pass) ──
  // A) MTP Pack 1 — unit counts are display-only; TXA is the editable field.
  const [prbcUnits, setPrbcUnits] = useState(0);
  const [ffpUnits, setFfpUnits] = useState(0);
  const [plateletPacks, setPlateletPacks] = useState(0);
  const [txaGiven, setTxaGiven] = useState(false);
  const [txaGivenAt, setTxaGivenAt] = useState<string | null>(null);
  // B) eFAST window findings, keyed by window.
  const [efast, setEfast] = useState<Record<string, string>>({});

  // ── Code STEMI fields (UI-only) ──
  const [ecgTime, setEcgTime] = useState('');
  const [balloonTime, setBalloonTime] = useState('');
  const [infarctTerritory, setInfarctTerritory] = useState('');
  const [aspirinGiven, setAspirinGiven] = useState(false);
  const [ticagrelorGiven, setTicagrelorGiven] = useState(false);
  const [atorvastatinGiven, setAtorvastatinGiven] = useState(false);

  // ── Code Stroke fields (UI-only) ──
  const [ctTime, setCtTime] = useState('');
  const [lkwWindow, setLkwWindow] = useState('');
  const [nihssScore, setNihssScore] = useState('');
  const [facialDroop, setFacialDroop] = useState('');
  const [armDrift, setArmDrift] = useState('');
  const [speech, setSpeech] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');

  // ── Code Sepsis fields (UI-only) ──
  const [serumLactate, setSerumLactate] = useState('');
  const [bloodCulturesDrawn, setBloodCulturesDrawn] = useState(false);
  const [antibioticsGiven, setAntibioticsGiven] = useState(false);
  const [crystalloidDone, setCrystalloidDone] = useState(false);

  const toggleTxa = (checked: boolean) => {
    setTxaGiven(checked);
    setTxaGivenAt(
      checked
        ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
        : null,
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Fast Track Code</DialogTitle>
          <DialogDescription>
            Activate a rapid-response protocol code for this patient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code *</Label>
            <Select value={code} onValueChange={(v) => setCode(v ?? '')}>
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
                    <Input
                      id="ft-prbc"
                      type="number"
                      min={0}
                      value={prbcUnits}
                      onChange={(e) => setPrbcUnits(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-ffp">FFP Units</Label>
                    <Input
                      id="ft-ffp"
                      type="number"
                      min={0}
                      value={ffpUnits}
                      onChange={(e) => setFfpUnits(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-platelet">Platelet Pack (RDP/SDP)</Label>
                    <Input
                      id="ft-platelet"
                      type="number"
                      min={0}
                      value={plateletPacks}
                      onChange={(e) => setPlateletPacks(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* TXA — the one toggle in this card */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={txaGiven}
                      onChange={(e) => toggleTxa(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
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
                      <Select
                        value={efast[w.key] ?? ''}
                        onValueChange={(v) => setEfast((prev) => ({ ...prev, [w.key]: v ?? '' }))}
                      >
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
                    <Input
                      id="ft-ecg-time"
                      type="number"
                      min={0}
                      placeholder="e.g. 8"
                      value={ecgTime}
                      onChange={(e) => setEcgTime(e.target.value)}
                    />
                    <p className="text-[11px] text-on-surface-variant">Target: &lt; 10 min</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-balloon-time">Door-to-Balloon Time (in mins)</Label>
                    <Input
                      id="ft-balloon-time"
                      type="number"
                      min={0}
                      placeholder="e.g. 75"
                      value={balloonTime}
                      onChange={(e) => setBalloonTime(e.target.value)}
                    />
                    <p className="text-[11px] text-on-surface-variant">Target: &lt; 90 min</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-infarct">Infarct Territory</Label>
                    <Input
                      id="ft-infarct"
                      placeholder="e.g. Anterior wall (LAD)"
                      value={infarctTerritory}
                      onChange={(e) => setInfarctTerritory(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 3) DAPT Drugs */}
              <div className="rounded-lg border border-outline-variant/40 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  DAPT Drugs
                </p>
                <div className="grid grid-cols-3 items-center gap-4">
                  {[
                    { label: 'Aspirin 325 mg', checked: aspirinGiven, set: setAspirinGiven },
                    { label: 'Ticagrelor / Clopidogrel', checked: ticagrelorGiven, set: setTicagrelorGiven },
                    { label: 'Atorvastatin 80 mg', checked: atorvastatinGiven, set: setAtorvastatinGiven },
                  ].map((d) => (
                    <label
                      key={d.label}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={d.checked}
                          onChange={(e) => d.set(e.target.checked)}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                        <span className="text-xs font-medium text-on-surface">{d.label}</span>
                      </div>
                      <span
                        className={
                          d.checked
                            ? 'text-xs font-semibold text-green-700'
                            : 'text-xs text-on-surface-variant'
                        }
                      >
                        {d.checked ? 'Given' : 'Not given'}
                      </span>
                    </label>
                  ))}
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
                    <Input
                      id="ft-ct-time"
                      type="number"
                      min={0}
                      placeholder="e.g. 18"
                      value={ctTime}
                      onChange={(e) => setCtTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-lkw">Last Known Well (LKW Window, in hrs)</Label>
                    <Input
                      id="ft-lkw"
                      type="number"
                      min={0}
                      placeholder="e.g. 3"
                      value={lkwWindow}
                      onChange={(e) => setLkwWindow(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-nihss">NIHSS Score</Label>
                    <Input
                      id="ft-nihss"
                      type="number"
                      min={0}
                      placeholder="e.g. 12"
                      value={nihssScore}
                      onChange={(e) => setNihssScore(e.target.value)}
                    />
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
                    <Input
                      id="ft-facial"
                      placeholder="e.g. Left-sided droop"
                      value={facialDroop}
                      onChange={(e) => setFacialDroop(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-arm">Arm Drift</Label>
                    <Input
                      id="ft-arm"
                      placeholder="e.g. Right arm drift"
                      value={armDrift}
                      onChange={(e) => setArmDrift(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-speech">Speech</Label>
                    <Input
                      id="ft-speech"
                      placeholder="e.g. Slurred"
                      value={speech}
                      onChange={(e) => setSpeech(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ft-glucose">Blood Glucose (mg/dL)</Label>
                    <Input
                      id="ft-glucose"
                      type="number"
                      min={0}
                      placeholder="e.g. 110"
                      value={bloodGlucose}
                      onChange={(e) => setBloodGlucose(e.target.value)}
                    />
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
                <Input
                  id="ft-lactate"
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="e.g. 2.4"
                  value={serumLactate}
                  onChange={(e) => setSerumLactate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Blood Cultures Drawn',
                    checked: bloodCulturesDrawn,
                    set: setBloodCulturesDrawn,
                    on: 'Done',
                    off: 'Not done',
                  },
                  {
                    label: 'IV Broad-Spectrum Antibiotics Given',
                    checked: antibioticsGiven,
                    set: setAntibioticsGiven,
                    on: 'Given',
                    off: 'Not given',
                  },
                  {
                    label: 'Crystalloid Resuscitation (30 mL/kg)',
                    checked: crystalloidDone,
                    set: setCrystalloidDone,
                    on: 'Done',
                    off: 'Not done',
                  },
                ].map((d) => (
                  <label
                    key={d.label}
                    className="flex cursor-pointer flex-col justify-between gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                  >
                    <div className="flex items-center  gap-2">
                      <input
                        type="checkbox"
                        checked={d.checked}
                        onChange={(e) => d.set(e.target.checked)}
                        className="h-3 w-3 rounded border-input accent-primary cursor-pointer"
                      />
                      <span className="text-[11px] font-medium leading-tight text-on-surface">
                        {d.label}
                      </span>
                    </div>
                    <span
                      className={
                        d.checked
                          ? 'text-xs font-semibold text-green-700'
                          : 'text-xs text-on-surface-variant'
                      }
                    >
                      {d.checked ? d.on : d.off}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!code}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
