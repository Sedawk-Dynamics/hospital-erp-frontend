// One line under each patient in the New Appointment / Admit Patient pickers
// (gap 332): the MRN-… number (or the hospital they are registered at), the
// phone, and the date of birth when two results share a name — the only thing
// that tells two "Ravi Kumar"s apart at the counter.

import { formatDate } from '@/lib/date-utils';
import type { GlobalPatientMatch } from '@/hooks/use-hospital';

const nameKey = (m: Pick<GlobalPatientMatch, 'firstName' | 'lastName'>) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase();

export function patientPickerSubtitle(m: GlobalPatientMatch, all: GlobalPatientMatch[]): string {
  const where = m.isLocal ? m.mrn || 'No MRN' : `at ${m.hospital}`;
  const parts = [where, m.phone || 'No phone'];
  const collides = all.some((o) => o !== m && nameKey(o) === nameKey(m));
  if (collides) parts.push(m.dateOfBirth ? `DOB ${formatDate(m.dateOfBirth)}` : 'DOB not recorded');
  return parts.join(' · ');
}
