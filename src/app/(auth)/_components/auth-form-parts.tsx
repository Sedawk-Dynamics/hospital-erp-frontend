'use client';

// Small pieces shared by the patient sign-in forms.

export const AUTH_INPUT =
  'bg-surface-container-low border-none rounded-xl px-4 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60';

export const AUTH_LABEL = 'font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest';

export const AUTH_BUTTON =
  'w-full bg-primary text-on-primary font-label font-bold text-sm px-6 py-3 rounded-xl hover:shadow-lg transition-all h-11 disabled:opacity-60';

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl bg-error/10 px-4 py-2.5 font-label text-sm text-error">
      {children}
    </div>
  );
}

export function Busy({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {children}
    </span>
  );
}
