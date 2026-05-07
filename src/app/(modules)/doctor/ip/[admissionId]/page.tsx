'use client';

import { use } from 'react';
import IPPatientWorkspace from '@/components/shared/ip-patient-workspace';

export default function DoctorIPDetailPage({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = use(params);
  return (
    <IPPatientWorkspace admissionId={admissionId} role="doctor" backHref="/doctor/ip" />
  );
}
