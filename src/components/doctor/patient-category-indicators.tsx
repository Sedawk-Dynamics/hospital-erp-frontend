'use client';

interface PatientCategoryIndicatorsProps {
  newPatients: number;
  reviewPatients: number;
  oldPatients: number;
}

export function PatientCategoryIndicators({
  newPatients,
  reviewPatients,
  oldPatients,
}: PatientCategoryIndicatorsProps) {
  return (
    <div className="flex items-center gap-4 font-label text-xs">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-error" />
        <span className="text-on-surface-variant">New Patients ({newPatients})</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-on-surface-variant">Review Patients ({reviewPatients})</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-tertiary" />
        <span className="text-on-surface-variant">Old Patients ({oldPatients})</span>
      </div>
    </div>
  );
}
