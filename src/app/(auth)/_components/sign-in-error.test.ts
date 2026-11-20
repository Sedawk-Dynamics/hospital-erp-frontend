import { describe, it, expect } from 'vitest';
import {
  describeSignInError,
  WRONG_CREDENTIALS,
  SIGNIN_UNAVAILABLE,
  SERVER_UNREACHABLE,
} from './sign-in-error';

describe('describeSignInError (gaps 370 / 371)', () => {
  it('says the email or password is wrong on a credentials 401', () => {
    expect(
      describeSignInError({ response: { status: 401, data: { message: 'Invalid credentials' } } }),
    ).toBe(WRONG_CREDENTIALS);
  });

  it('keeps the server reason for other 401s', () => {
    expect(
      describeSignInError({ response: { status: 401, data: { message: 'Account is deactivated' } } }),
    ).toBe('Account is deactivated');
  });

  it('does not blame the user when the backend cannot be reached', () => {
    expect(describeSignInError({ code: 'ERR_NETWORK' })).toBe(SERVER_UNREACHABLE);
    expect(describeSignInError(new Error('Network Error'))).toBe(SERVER_UNREACHABLE);
  });

  it('reports a login-service fault as temporarily unavailable', () => {
    expect(
      describeSignInError({ response: { status: 500, data: { message: 'Internal server error' } } }),
    ).toBe(SIGNIN_UNAVAILABLE);
    expect(
      describeSignInError({ response: { status: 503, data: { code: 'SIGNIN_UNAVAILABLE' } } }),
    ).toBe(SIGNIN_UNAVAILABLE);
  });

  it('passes through a lockout message', () => {
    const message = 'Account temporarily locked due to repeated failed logins. Try again in 60 seconds.';
    expect(describeSignInError({ response: { status: 429, data: { message } } })).toBe(message);
  });
});
