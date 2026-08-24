import { describe, it, expect } from 'vitest';
import {
  formatTemperature,
  temperatureIn,
  temperatureRangeText,
  temperatureUnitLabel,
  temperatureValue,
  cToF,
} from './vitals-temperature';

// Temperature is stored as Celsius and only ever as Celsius — there is no unit
// column on the record. The °C/°F switch used to affect data ENTRY alone, so
// every screen that showed a reading printed Celsius, and three of them printed
// it with an °F suffix. These cover the reading half.

describe('temperatureIn', () => {
  it('leaves Celsius alone', () => {
    expect(temperatureIn(37.2, 'C')).toBe(37.2);
  });

  it('converts to Fahrenheit', () => {
    expect(temperatureIn(37, 'F')).toBe(98.6);
    expect(temperatureIn(38, 'F')).toBe(100.4);
  });

  it('accepts the string a Prisma Decimal arrives as', () => {
    // `Vital.temperature` is Decimal(4,1) and reaches some hooks as a string.
    expect(temperatureIn('37', 'F')).toBe(98.6);
    expect(temperatureIn('36.6', 'C')).toBe(36.6);
  });

  it('has no reading rather than a wrong one', () => {
    expect(temperatureIn(null, 'F')).toBeNull();
    expect(temperatureIn(undefined, 'C')).toBeNull();
    expect(temperatureIn('', 'C')).toBeNull();
    expect(temperatureIn('not a number', 'C')).toBeNull();
  });

  it('does not treat 0 °C as missing', () => {
    expect(temperatureIn(0, 'C')).toBe(0);
    expect(temperatureIn(0, 'F')).toBe(32);
  });
});

describe('formatTemperature', () => {
  it('labels the value with the unit it was actually converted to', () => {
    // The bug this replaces: the Celsius number printed with an °F suffix, so
    // 37.2 read as "37.2 °F" — which looks like profound hypothermia.
    expect(formatTemperature(37.2, 'C')).toBe('37.2 °C');
    expect(formatTemperature(37.2, 'F')).toBe('99.0 °F');
  });

  it('always shows one decimal, so 37 does not read as less precise', () => {
    expect(formatTemperature(37, 'C')).toBe('37.0 °C');
  });

  it('uses the caller’s fallback when there is no reading', () => {
    expect(formatTemperature(null, 'F')).toBe('—');
    expect(formatTemperature(null, 'F', '-')).toBe('-');
  });
});

describe('temperatureValue', () => {
  it('gives the bare number for a column that carries its own unit header', () => {
    expect(temperatureValue(37, 'F')).toBe('98.6');
    expect(temperatureValue(37, 'C')).toBe('37.0');
    expect(temperatureValue(null, 'C', '–')).toBe('–');
  });
});

describe('temperatureUnitLabel', () => {
  it('names the unit for a column header', () => {
    expect(temperatureUnitLabel('C')).toBe('°C');
    expect(temperatureUnitLabel('F')).toBe('°F');
  });
});

describe('temperatureRangeText', () => {
  it('states the normal range in the unit being read', () => {
    // Showing "35–38 °C" to someone reading 99.0 tells them nothing.
    expect(temperatureRangeText(35, 38, 'C')).toBe('35–38 °C');
    expect(temperatureRangeText(35, 38, 'F')).toBe(`${cToF(35).toFixed(1)}–${cToF(38).toFixed(1)} °F`);
    expect(temperatureRangeText(35, 38, 'F')).toBe('95.0–100.4 °F');
  });
});
