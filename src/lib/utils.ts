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
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const res = (error as { response?: { data?: { message?: string } } })?.response;
  if (res?.data?.message) return res.data.message;
  if (error instanceof Error && error.message && !/status code/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}
