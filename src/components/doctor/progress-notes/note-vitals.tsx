'use client';

// Renders the vitals captured alongside a progress note as compact labelled
// chips — shown inside the note's Objective section. Only readings that were
// actually recorded appear; empty fields are skipped.

import { Activity } from 'lucide-react';
import type { Vital } from '@/hooks/use-doctor';

function buildReadings(v: Vital): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const sys = v.bloodPressureSystolic;
  const dia = v.bloodPressureDiastolic;
  if (sys != null || dia != null) {
    out.push({ label: 'BP', value: `${sys ?? '–'}/${dia ?? '–'} mmHg` });
  }
  const hr = v.pulseRate ?? v.heartRate;
  if (hr != null) out.push({ label: 'HR', value: `${hr} bpm` });
  if (v.temperature != null) out.push({ label: 'Temp', value: `${v.temperature}°C` });
  if (v.oxygenSaturation != null) out.push({ label: 'SpO₂', value: `${v.oxygenSaturation}%` });
  if (v.respiratoryRate != null) out.push({ label: 'RR', value: `${v.respiratoryRate}/min` });
  const wt = v.weightKg ?? v.weight;
  if (wt != null) out.push({ label: 'Wt', value: `${wt} kg` });
  const ht = v.heightCm ?? v.height;
  if (ht != null) out.push({ label: 'Ht', value: `${ht} cm` });
  if (v.bmi != null) out.push({ label: 'BMI', value: `${v.bmi}` });
  if (v.bloodSugar != null) out.push({ label: 'Sugar', value: `${v.bloodSugar} mg/dL` });
  return out;
}

export function NoteVitals({ vital }: { vital: Vital }) {
  const readings = buildReadings(vital);
  if (readings.length === 0) return null;
  return (
    <div className="mt-2 border-t border-outline-variant/30 pt-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
        <Activity className="h-3 w-3" /> Vitals
      </div>
      <div className="flex flex-wrap gap-1">
        {readings.map((r) => (
          <span
            key={r.label}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <span className="font-semibold text-primary">{r.label}</span>
            <span className="text-muted-foreground">-</span>
            {r.value}
          </span>
        ))}
      </div>
    </div>
  );
}
