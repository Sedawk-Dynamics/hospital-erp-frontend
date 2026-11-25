'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, type IcuFormProps } from './field';
import { useSaveSeverityScore } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

// SOFA: 6 organ systems, each scored 0–4 from its clinical band. Total out of 24.
const SOFA_SYSTEMS: { key: string; label: string; options: string[] }[] = [
  {
    key: 'respiration',
    label: 'Respiration (PaO₂/FiO₂)',
    options: ['≥ 400 (or not assessed)', '< 400', '< 300', '< 200 + mech. ventilation', '< 100 + mech. ventilation'],
  },
  {
    key: 'coagulation',
    label: 'Coagulation (Platelets ×10³/µL)',
    options: ['≥ 150', '< 150', '< 100', '< 50', '< 20'],
  },
  {
    key: 'liver',
    label: 'Liver (Bilirubin mg/dL)',
    options: ['< 1.2', '1.2–1.9', '2.0–5.9', '6.0–11.9', '≥ 12.0'],
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular (MAP & vasopressors)',
    options: ['MAP ≥ 70 mmHg', 'MAP < 70 mmHg', 'Dopamine ≤ 5 or Dobutamine', 'Norepinephrine ≤ 0.1', 'Norepinephrine > 0.1'],
  },
  {
    key: 'cns',
    label: 'CNS (GCS)',
    options: ['15', '13–14', '10–12', '6–9', '< 6'],
  },
  {
    key: 'renal',
    label: 'Renal (Creatinine & urine output)',
    options: ['< 1.2 mg/dL', '1.2–1.9', '2.0–3.4', '3.5–4.9 or < 500 mL/day', '> 5.0 or < 200 mL/day'],
  },
];

function sofaInterpretation(total: number): { label: string; tone: string } {
  if (total >= 11) return { label: 'Severe multi-organ dysfunction', tone: 'text-error' };
  if (total >= 10) return { label: 'High risk', tone: 'text-orange-600' };
  if (total >= 7) return { label: 'Moderate risk', tone: 'text-amber-600' };
  return { label: 'Low risk', tone: 'text-primary' };
}

// Approximate APACHE II predicted in-hospital mortality by score band.
function apacheMortality(score: number): string {
  if (score >= 35) return '~85%';
  if (score >= 30) return '~73%';
  if (score >= 25) return '~55%';
  if (score >= 20) return '~40%';
  if (score >= 15) return '~25%';
  if (score >= 10) return '~15%';
  if (score >= 5) return '~8%';
  return '~4%';
}

export function SeverityScoresForm({ admissionId, weight, onSaved }: IcuFormProps) {
  const [sofa, setSofa] = useState<Record<string, number>>({});
  const [apache, setApache] = useState(0);

  const sofaTotal = SOFA_SYSTEMS.reduce((sum, s) => sum + (sofa[s.key] ?? 0), 0);
  const sofaVerdict = sofaInterpretation(sofaTotal);

  const save = useSaveSeverityScore();

  const onSave = () => {
    save.mutate(
      {
        admissionId: admissionId!,
        sofaRespiration: sofa.respiration,
        sofaCoagulation: sofa.coagulation,
        sofaLiver: sofa.liver,
        sofaCardiovascular: sofa.cardiovascular,
        sofaCns: sofa.cns,
        sofaRenal: sofa.renal,
        sofaTotal,
        apacheScore: apache,
      },
      {
        onSuccess: () => { toast.success('Severity scores saved'); setSofa({}); setApache(0); onSaved?.(); },
        onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* SOFA */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-primary">SOFA score</p>
          <span className="text-xs">
            Total: <strong>{sofaTotal}</strong> / 24 ·{' '}
            <span className={sofaVerdict.tone}>{sofaVerdict.label}</span>
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOFA_SYSTEMS.map((s) => (
            <Field key={s.key} label={s.label}>
              <Select
                value={sofa[s.key] != null ? String(sofa[s.key]) : ''}
                onValueChange={(v) => setSofa((prev) => ({ ...prev, [s.key]: Number(v) }))}
              >
                <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Select (0–4)" /></SelectTrigger>
                <SelectContent>
                  {s.options.map((opt, n) => (
                    <SelectItem key={n} value={String(n)}>{n} · {opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ))}
        </div>
      </div>

      {/* APACHE II */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-primary">APACHE II</p>
          <span className="text-xs">
            Predicted mortality: <strong className="text-error">{apacheMortality(apache)}</strong>
          </span>
        </div>
        <Field label="Total score (0–71)">
          <Input
            type="number"
            min={0}
            max={71}
            value={apache}
            onChange={(e) => setApache(Math.min(71, Math.max(0, Number(e.target.value) || 0)))}
            className="h-8 sm:w-40"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onSave}>Save Severity Scores</Button>
      </div>
    </div>
  );
}
