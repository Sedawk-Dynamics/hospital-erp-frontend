import { describe, it, expect } from 'vitest';
import { getApiErrorMessage, formatRoleName } from './utils';

function axiosError(data: unknown, message = 'Request failed with status code 400') {
  return Object.assign(new Error(message), { response: { data } });
}

describe('getApiErrorMessage', () => {
  it('uses the envelope message', () => {
    expect(getApiErrorMessage(axiosError({ message: 'Bed is already occupied' }))).toBe(
      'Bed is already occupied',
    );
  });

  // A zod failure always carries the constant "Validation error" as its message
  // and puts the useful part in `errors`. Reporting only the message is how a
  // doctor got "Request failed with status code 400" with no idea which box was
  // wrong.
  it('names the field a validation error came from', () => {
    const err = axiosError({
      message: 'Validation error',
      errors: [{ field: 'body.temperature', message: 'Number must be less than or equal to 50' }],
    });
    expect(getApiErrorMessage(err)).toBe(
      'Temperature: Number must be less than or equal to 50',
    );
  });

  it('humanizes a camelCase field name', () => {
    const err = axiosError({
      message: 'Validation error',
      errors: [{ field: 'body.bloodPressureSystolic', message: 'Expected integer' }],
    });
    expect(getApiErrorMessage(err)).toBe('Blood pressure systolic: Expected integer');
  });

  it('caps a wall of field errors so the toast stays readable', () => {
    const err = axiosError({
      message: 'Validation error',
      errors: ['a', 'b', 'c', 'd', 'e'].map((f) => ({ field: f, message: 'Required' })),
    });
    expect(getApiErrorMessage(err)).toContain('(+2 more)');
  });

  it('falls back past the useless axios message', () => {
    expect(getApiErrorMessage(axiosError({}), 'Failed to record vitals')).toBe(
      'Failed to record vitals',
    );
  });

  it('keeps a genuine Error message', () => {
    expect(getApiErrorMessage(new Error('Network Error'))).toBe('Network Error');
  });

  it('handles a non-error', () => {
    expect(getApiErrorMessage(undefined, 'nope')).toBe('nope');
  });
});

describe('formatRoleName', () => {
  it('title-cases a snake_case role', () => {
    expect(formatRoleName('billing_admin')).toBe('Billing Admin');
  });
});
