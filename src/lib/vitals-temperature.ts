// Temperature is recorded in °F as often as °C on an Indian ward, but the
// server only ever accepts Celsius (`z.number().min(25).max(50)`) — so a nurse
// typing 98.6 got a bare 400 with nothing to explain it.
//
// One definition of the conversion, the accepted range and the error wording,
// shared by every screen that takes a temperature. The stored value is ALWAYS
// Celsius; the unit is a data-entry convenience and is never persisted.

export type TempUnit = 'C' | 'F';

/** What the server accepts, in Celsius. Mirrors the vitals zod schema. */
export const TEMP_C_MIN = 25;
export const TEMP_C_MAX = 50;

export const fToC = (f: number): number => Math.round((((f - 32) * 5) / 9) * 10) / 10;
export const cToF = (c: number): number => Math.round(((c * 9) / 5 + 32) * 10) / 10;

/** Read a typed value as Celsius, whichever unit it was entered in. */
export function toCelsius(value: number | undefined, unit: TempUnit): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return unit === 'F' ? fToC(value) : value;
}

/** True when the Celsius value is outside what the server will accept. */
export function isTemperatureOutOfRange(celsius: number | undefined): boolean {
  return celsius !== undefined && (celsius < TEMP_C_MIN || celsius > TEMP_C_MAX);
}

/** The range message in the unit the user is actually typing in. */
export function temperatureRangeMessage(unit: TempUnit): string {
  return unit === 'F'
    ? `Temperature must be between ${cToF(TEMP_C_MIN)} and ${cToF(TEMP_C_MAX)} °F`
    : `Temperature must be between ${TEMP_C_MIN} and ${TEMP_C_MAX} °C`;
}

/** A sensible placeholder for the unit in play. */
export function temperaturePlaceholder(unit: TempUnit): string {
  return unit === 'F' ? '98.6' : '36.6';
}

// ── Display ────────────────────────────────────────────────────────────────
//
// Reading a temperature was the other half of this, and it was missing: the
// °C/°F toggle only ever affected data ENTRY, so every screen that showed a
// recorded temperature printed the stored Celsius. Three of them printed it
// with an °F suffix, so a 37.2 rendered as "37.2 °F" — a number that reads as
// profound hypothermia.
//
// These take the stored Celsius and answer in whichever unit the reader
// prefers, so a display can never disagree with its own label.

/**
 * The stored Celsius value as a number in the requested unit.
 *
 * Accepts a string as well as a number: `Vital.temperature` is a Prisma
 * Decimal, which arrives over JSON as a string on some of these hooks and as a
 * number on others. Making every caller cast would be one more place to get it
 * wrong.
 */
export function temperatureIn(
  celsius: number | string | null | undefined,
  unit: TempUnit,
): number | null {
  if (celsius === null || celsius === undefined || celsius === '') return null;
  const c = Number(celsius);
  if (!Number.isFinite(c)) return null;
  return unit === 'F' ? cToF(c) : Math.round(c * 10) / 10;
}

/** `"99.0 °F"` / `"37.2 °C"`, or the fallback when there is no reading. */
export function formatTemperature(
  celsius: number | string | null | undefined,
  unit: TempUnit,
  fallback = '—',
): string {
  const v = temperatureIn(celsius, unit);
  return v === null ? fallback : `${v.toFixed(1)} °${unit}`;
}

/** Just the number, for a cell that carries its unit in the column header. */
export function temperatureValue(
  celsius: number | string | null | undefined,
  unit: TempUnit,
  fallback = '—',
): string {
  const v = temperatureIn(celsius, unit);
  return v === null ? fallback : v.toFixed(1);
}

/** `"°C"` / `"°F"` — for a column header or a field suffix. */
export function temperatureUnitLabel(unit: TempUnit): string {
  return `°${unit}`;
}

/**
 * The normal range in the reader's unit. The thresholds in `vitals-ranges` are
 * Celsius, so showing "35–38 °C" to someone reading Fahrenheit tells them
 * nothing about the 99.0 in front of them.
 */
export function temperatureRangeText(low: number, high: number, unit: TempUnit): string {
  return unit === 'F'
    ? `${cToF(low).toFixed(1)}–${cToF(high).toFixed(1)} °F`
    : `${low}–${high} °C`;
}
