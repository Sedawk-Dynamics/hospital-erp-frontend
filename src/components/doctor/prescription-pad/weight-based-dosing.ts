export type DoseUnit = 'mg' | 'mcg' | 'g' | 'ml' | 'IU';

export interface WeightBasedDoseInput {
  weightKg: number;
  dosePerKg: number;
  unit: DoseUnit;
  frequencyPerDay?: number;
  maxSingleDose?: number;
  maxDailyDose?: number;
}

export interface WeightBasedDoseResult {
  singleDose: number;
  dailyDose: number;
  unit: DoseUnit;
  capped: boolean;
  cappedReason?: 'single' | 'daily';
  display: string;
}

export function calculateWeightBasedDose(input: WeightBasedDoseInput): WeightBasedDoseResult {
  const { weightKg, dosePerKg, unit, frequencyPerDay = 1, maxSingleDose, maxDailyDose } = input;

  if (weightKg <= 0 || dosePerKg <= 0) {
    return { singleDose: 0, dailyDose: 0, unit, capped: false, display: '-' };
  }

  let singleDose = round(weightKg * dosePerKg);
  let capped = false;
  let cappedReason: 'single' | 'daily' | undefined;

  if (maxSingleDose !== undefined && singleDose > maxSingleDose) {
    singleDose = maxSingleDose;
    capped = true;
    cappedReason = 'single';
  }

  let dailyDose = round(singleDose * frequencyPerDay);
  if (maxDailyDose !== undefined && dailyDose > maxDailyDose) {
    dailyDose = maxDailyDose;
    singleDose = round(dailyDose / frequencyPerDay);
    capped = true;
    cappedReason = 'daily';
  }

  const display =
    frequencyPerDay > 1
      ? `${singleDose} ${unit} × ${frequencyPerDay}/day (total ${dailyDose} ${unit}/day)`
      : `${singleDose} ${unit}/day`;

  return { singleDose, dailyDose, unit, capped, cappedReason, display };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
