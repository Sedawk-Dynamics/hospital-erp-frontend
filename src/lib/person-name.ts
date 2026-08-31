/**
 * Joining a person's name parts, without printing the word "null".
 *
 * `` `${firstName} ${lastName}` `` is the obvious thing to write and it is
 * wrong whenever a last name is missing: a template literal stringifies null,
 * so the screen reads "Temporary 5 null" — and where the name is uppercased,
 * "TEMPORARY 5 NULL", which looks like corrupted data rather than an absent
 * surname.
 *
 * A missing last name is NORMAL here, not an edge case. Every temporary
 * patient is created with only a first name — that is the whole point of the
 * temporary-patient flow, where somebody arrives unable to give their details.
 * `.trim()` does not help either, because the "null" lands in the middle.
 */

/** A person's parts, however the caller's API happens to name them. */
export interface NameParts {
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * "Asha Menon", or "Temporary 5" when there is no surname.
 *
 * @param fallback what to return when there is no name at all — a row still
 *                 needs something to render, and an empty string collapses the
 *                 layout it sits in.
 */
export function fullName(person: NameParts | null | undefined, fallback = ''): string {
  if (!person) return fallback;
  const parts = [person.firstName, person.lastName]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : fallback;
}

/**
 * Initials for an avatar — "AM", or "T" from a first name alone.
 *
 * Falls back to a single character rather than an empty circle, which reads as
 * a broken image.
 */
export function initials(person: NameParts | null | undefined, fallback = '?'): string {
  const first = person?.firstName?.trim()?.[0] ?? '';
  const last = person?.lastName?.trim()?.[0] ?? '';
  const out = `${first}${last}`.toUpperCase();
  return out || fallback;
}
