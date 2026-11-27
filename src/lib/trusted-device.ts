// What this browser remembers so a patient can sign in with their PIN here.
//
// The device token is random and was shown to this browser once; on its own it
// opens nothing (the PIN is also needed, five tries at most). It is kept next
// to the app's other sign-in state in localStorage, and survives signing out,
// like a phone that stays yours when the screen locks. The PIN itself is never
// stored anywhere.

const KEY = 'patientDevice';
const SKIP_KEY = 'patientPinPromptSkippedAt';
const SKIP_FOR_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrustedDevice {
  deviceId: string;
  deviceToken: string;
  /** First name, for "Welcome back". */
  name?: string;
  /** Too many wrong PINs: this device needs a code and a new PIN. */
  locked?: boolean;
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** For useSyncExternalStore. */
export function subscribeTrustedDevice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored text, stable between renders. */
export function trustedDeviceSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseTrustedDevice(raw: string | null): TrustedDevice | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as TrustedDevice;
    return d && typeof d.deviceToken === 'string' && typeof d.deviceId === 'string' ? d : null;
  } catch {
    return null;
  }
}

export const getTrustedDevice = () => parseTrustedDevice(trustedDeviceSnapshot());

export function saveTrustedDevice(device: TrustedDevice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(device));
    localStorage.removeItem(SKIP_KEY);
  } catch {
    // Storage blocked or full: PIN sign-in simply is not offered here.
  }
  changed();
}

export function forgetTrustedDevice(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
  changed();
}

/** "Not now" on the PIN prompt: do not ask again here for a month. */
export function skipPinPrompt(): void {
  try {
    localStorage.setItem(SKIP_KEY, String(Date.now()));
  } catch {
    // asked again next time
  }
}

export function pinPromptSkipped(): boolean {
  try {
    const at = Number(localStorage.getItem(SKIP_KEY));
    return at > 0 && Date.now() - at < SKIP_FOR_MS;
  } catch {
    return false;
  }
}
