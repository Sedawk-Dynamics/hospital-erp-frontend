// Shapes and wording shared by the patient sign-in screens and the PIN settings.

/** What the server says about a code it sent. Never the code, never whether an account exists. */
export interface CodeReceipt {
  channel: 'sms' | 'whatsapp' | 'email';
  sentTo: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}

export function sentByText(receipt: CodeReceipt): string {
  const by = { sms: 'by SMS', whatsapp: 'on WhatsApp', email: 'by email' }[receipt.channel] ?? '';
  return `We sent a 6-digit code ${by} to `.replace('  ', ' ');
}

interface ErrorBody {
  message?: string;
  code?: string;
  errors?: { message: string }[];
}

export function authErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: ErrorBody } })?.response?.data?.code;
}

/** The server's own words (they are written for the patient), else the fallback. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const res = (error as { response?: { data?: ErrorBody } })?.response;
  return res?.data?.errors?.[0]?.message || res?.data?.message || fallback;
}

export const onlyDigits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/** A patient and nothing else: staff sign in with a password and have no PIN. */
export function isPatientOnly(roles: readonly unknown[] | undefined | null): boolean {
  return !!roles?.length && roles.every((r) => String(r) === 'patient');
}
