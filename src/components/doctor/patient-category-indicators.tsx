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
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="text-muted-foreground">New Patients ({newPatients})</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        <span className="text-muted-foreground">Review Patients ({reviewPatients})</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
        <span className="text-muted-foreground">Old Patients ({oldPatients})</span>
      </div>
    </div>
  );
}
