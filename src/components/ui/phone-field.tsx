'use client';

/**
 * Phone input with a country-code picker + a 10-digit national number.
 * Defaults to +91 (India) but supports international users. The canonical value
 * is `code + national` (e.g. "+919999999945"); numbers are matched elsewhere by
 * their last 10 digits, so the country code is preserved without breaking search.
 */

export interface PhoneValue {
  code: string; // e.g. "+91"
  national: string; // up to 10 digits
}

export const DEFAULT_PHONE: PhoneValue = { code: '+91', national: '' };

/** Full E.164-style string, e.g. "+919999999945". */
export function phoneToE164(v: PhoneValue): string {
  return `${v.code}${v.national}`;
}

/** Parse a stored/full number back into { code, national } (national = last 10). */
export function parsePhone(full?: string | null): PhoneValue {
  if (!full) return { ...DEFAULT_PHONE };
  const digits = full.replace(/\D/g, '');
  const national = digits.slice(-10);
  const codeDigits = digits.slice(0, -10);
  return { code: codeDigits ? `+${codeDigits}` : '+91', national };
}

// A pragmatic set of common country codes; +91 default. Extendable.
const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+966', label: '🇸🇦 +966' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+977', label: '🇳🇵 +977' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+94', label: '🇱🇰 +94' },
  { code: '+92', label: '🇵🇰 +92' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+86', label: '🇨🇳 +86' },
  { code: '+27', label: '🇿🇦 +27' },
  { code: '+254', label: '🇰🇪 +254' },
  { code: '+234', label: '🇳🇬 +234' },
];

const BASE =
  'bg-surface-container-low border-none rounded-xl px-3 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none';

export function PhoneField({
  value,
  onChange,
  autoFocus,
  onEnter,
  id,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
  id?: string;
}) {
  // If the stored code isn't in the list, include it so it stays selectable.
  const codes = COUNTRY_CODES.some((c) => c.code === value.code)
    ? COUNTRY_CODES
    : [{ code: value.code, label: value.code }, ...COUNTRY_CODES];

  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        className={`${BASE} w-[92px] shrink-0`}
        value={value.code}
        onChange={(e) => onChange({ ...value, code: e.target.value })}
      >
        {codes.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoFocus={autoFocus}
        maxLength={10}
        placeholder="98765 43210"
        className={`${BASE} w-full tracking-wider placeholder:text-on-surface-variant/60`}
        value={value.national}
        onChange={(e) => onChange({ ...value, national: e.target.value.replace(/\D/g, '').slice(0, 10) })}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
    </div>
  );
}
