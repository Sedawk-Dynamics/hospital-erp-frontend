'use client';

// The hospital admin's centralized patient file. The backend scopes this to the
// caller's own hospital, so a patient who has never been here resolves to a
// not-found rather than to someone else's record.

import { use } from 'react';
import { PatientFileView } from '@/components/patients/patient-file-view';

export default function HospitalPatientFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PatientFileView patientId={id} backHref="/hospital/patients" />;
}
