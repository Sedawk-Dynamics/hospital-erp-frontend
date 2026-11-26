// What to tell a person whose sign-in failed (gaps 370 / 371).
//
// "Please check your credentials" was shown for everything — a wrong password,
// a backend that could not be reached, and a login service returning 500. Two
// of those are not the user's fault, and telling them to re-type a correct
// password sends them in circles.

export const WRONG_CREDENTIALS = 'Email or password is wrong';
export const SIGNIN_UNAVAILABLE = 'Sign-in is temporarily unavailable. Try again in a few minutes.';
export const SERVER_UNREACHABLE =
  "Can't reach the server. Check your internet connection and try again.";

interface MaybeAxiosError {
  response?: { status?: number; data?: { message?: string; code?: string } };
  code?: string;
}

export function describeSignInError(error: unknown): string {
  const err = (error ?? {}) as MaybeAxiosError;
  const res = err.response;

  // No response at all: offline, DNS, CORS, backend down, or timed out.
  if (!res) return SERVER_UNREACHABLE;

  const status = res.status ?? 0;
  const message = res.data?.message;

  if (status >= 500 || res.data?.code === 'SIGNIN_UNAVAILABLE') return SIGNIN_UNAVAILABLE;

  // The backend says "Invalid credentials" for both an unknown email and a bad
  // password (deliberately — no account enumeration). Other 401s — a disabled
  // account, an inactive hospital, a wrong 2FA code — carry their own reason.
  if (status === 401) {
    return !message || /invalid credentials/i.test(message) ? WRONG_CREDENTIALS : message;
  }

  return message || WRONG_CREDENTIALS;
}
