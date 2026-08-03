'use client';

// The implementation moved to `components/shared/patient-history-panel` so
// nurses and the IP workspace (IP / emergency / day-care) render the exact
// same history the doctor sees in an OP consultation. This file stays as the
// doctor-side name the consultation page already imports.

export {
  PatientHistoryPanel as MedicalHistoryPanel,
  PatientHistoryPanel,
  type PatientHistoryPanelProps,
} from '@/components/shared/patient-history-panel';
