// One definition of what counts as an abnormal vital sign.
//
// This was re-implemented per screen, and the copies had drifted apart in ways
// that mattered clinically. The nurse vitals screen flagged a systolic under
// 90, a temperature under 35 and a respiratory rate under 12; the clinical
// charting screen — the same nurse, minutes later — flagged none of them, so
// hypotension, hypothermia and bradypnoea showed as normal there. The doctor's
// consultation strip did no range check at all, which is what QA reported: the
// nurse's readings arrived on the doctor's screen unhighlighted.
//
// Adult ranges. Paediatric and neonatal thresholds differ by age and are NOT
// modelled here — if this system ever flags vitals for children, that needs its
// own table rather than a tweak to these numbers.

export interface VitalRange {
  /** Below this is abnormal. Undefined = no lower bound. */
  low?: number;
  /** Above this is abnormal. Undefined = no upper bound. */
  high?: number;
  unit: string;
  label: string;
}

/** Keyed by the field name used on the Vital record. */
export const VITAL_RANGES: Record<string, VitalRange> = {
  bloodPressureSystolic: { low: 90, high: 140, unit: 'mmHg', label: 'BP systolic' },
  bloodPressureDiastolic: { low: 60, high: 90, unit: 'mmHg', label: 'BP diastolic' },
  // Celsius. Values are stored in °C whatever unit they were typed in, so
  // convert before calling this — see lib/vitals-temperature.
  temperature: { low: 35, high: 38, unit: '°C', label: 'Temperature' },
  pulseRate: { low: 60, high: 100, unit: 'bpm', label: 'Pulse' },
  respiratoryRate: { low: 12, high: 20, unit: '/min', label: 'Respiratory rate' },
  oxygenSaturation: { low: 94, unit: '%', label: 'SpO₂' },
};

/** True when the reading falls outside the range for that vital. */
export function isValueAbnormal(key: string, value?: number | null): boolean {
  if (value === null || value === undefined || Number.isNaN(value)) return false;
  const r = VITAL_RANGES[key];
  if (!r) return false;
  if (r.low !== undefined && value < r.low) return true;
  if (r.high !== undefined && value > r.high) return true;
  return false;
}

/** "90–140 mmHg" / "≥ 94 %" — what normal looks like, for the hint under a field. */
export function vitalRangeText(key: string): string | null {
  const r = VITAL_RANGES[key];
  if (!r) return null;
  if (r.low !== undefined && r.high !== undefined) return `${r.low}–${r.high} ${r.unit}`;
  if (r.low !== undefined) return `≥ ${r.low} ${r.unit}`;
  if (r.high !== undefined) return `≤ ${r.high} ${r.unit}`;
  return null;
}

/** Which way it is out — for wording an alert as "high" or "low". */
export function abnormalDirection(key: string, value?: number | null): 'high' | 'low' | null {
  if (value === null || value === undefined) return null;
  const r = VITAL_RANGES[key];
  if (!r) return null;
  if (r.low !== undefined && value < r.low) return 'low';
  if (r.high !== undefined && value > r.high) return 'high';
  return null;
}

/**
 * Every out-of-range reading on a set of vitals, as short display strings —
 * "Temp 39.2 °C (high)". Used for handover summaries and alert bodies.
 */
export function abnormalVitalsSummary(
  vitals: Partial<Record<string, number | null | undefined>>,
): string[] {
  const out: string[] = [];
  for (const [key, range] of Object.entries(VITAL_RANGES)) {
    const value = vitals[key];
    const dir = abnormalDirection(key, value ?? null);
    if (dir) out.push(`${range.label} ${value} ${range.unit} (${dir})`);
  }
  return out;
}
