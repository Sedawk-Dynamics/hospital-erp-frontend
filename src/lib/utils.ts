import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert snake_case DB name to Title Case: "billing_admin" → "Billing Admin" */
export function formatRoleName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pull the human-readable message out of a failed API call.
 *
 * The API layer rejects with the raw Axios error, whose `.message` is the
 * useless "Request failed with status code 409". The real, user-facing text the
 * backend sent lives at `error.response.data.message` (see the standard
 * `{ success, message, data }` envelope). Falls back to the Axios message, then
 * a caller-supplied default.
 *
 * A zod failure is the exception: the envelope's message is the constant
 * "Validation error" and the useful part — which field, and why — is in the
 * `errors` array. Without folding that in, every 400 in the app reads as
 * "Validation error" or "Request failed with status code 400" and nobody can
 * tell which field to fix.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const data = (
    error as {
      response?: {
        data?: { message?: string; errors?: Array<{ field?: string; message?: string }> };
      };
    }
  )?.response?.data;

  const fieldErrors = (data?.errors ?? [])
    .map((e) => {
      const field = (e.field ?? '').split('.').pop();
      const label = field ? humanizeFieldName(field) : '';
      return label && e.message ? `${label}: ${e.message}` : (e.message ?? '');
    })
    .filter(Boolean);

  if (fieldErrors.length) {
    // At most three — a form with everything wrong should not produce a toast
    // nobody can read.
    const shown = fieldErrors.slice(0, 3).join(' · ');
    return fieldErrors.length > 3 ? `${shown} (+${fieldErrors.length - 3} more)` : shown;
  }

  if (data?.message) return data.message;
  if (error instanceof Error && error.message && !/status code/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

/** "bloodPressureSystolic" → "Blood pressure systolic" */
function humanizeFieldName(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
