'use client';

// The same patient file, opened from the platform directory. super_admin runs
// the platform rather than a hospital, so the backend drops the tenant filter
// and the header says "Platform view" alongside the owning hospital's name.

import { use } from 'react';
import { PatientFileView } from '@/components/patients/patient-file-view';

export default function PlatformPatientFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PatientFileView patientId={id} backHref="/super-admin/patients" />;
}
