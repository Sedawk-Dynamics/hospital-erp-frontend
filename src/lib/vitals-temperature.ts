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
