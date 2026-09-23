import type { EmarSchedule } from '@/hooks/use-emar';
import { formatDateTime } from '@/lib/date-utils';

function recordedAt(dose: EmarSchedule) {
  return dose.actualGivenTime ?? dose.actionedAt ?? dose.createdAt ?? dose.scheduledAt;
}

export function latestAdministeredPrnByItem(schedules: EmarSchedule[]) {
  const latest = new Map<string, EmarSchedule>();

  for (const dose of schedules) {
    if (!dose.isPrn || (dose.status !== 'given' && dose.status !== 'given_late')) continue;
    const current = latest.get(dose.prescriptionItemId);
    if (!current || new Date(recordedAt(dose)).getTime() > new Date(recordedAt(current)).getTime()) {
      latest.set(dose.prescriptionItemId, dose);
    }
  }

  return latest;
}

export function PrnDoseHistoryCard({ dose }: { dose: EmarSchedule }) {
  const administeredBy = dose.givenBy
    ? `${dose.givenBy.firstName} ${dose.givenBy.lastName ?? ''}`.trim()
    : 'Not available';
  const ndps = dose.ndpsPatientDose;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
      <p className="text-xs font-semibold text-blue-950">Latest recorded PRN dose</p>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-blue-700">Given at</span>
          <span className="font-medium text-blue-950">{formatDateTime(recordedAt(dose))}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-blue-700">Recorded by</span>
          <span className="font-medium text-blue-950">{administeredBy}</span>
        </div>
        {ndps && (
          <>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-blue-700">Quantity given</span>
              <span className="font-medium text-blue-950">{Number(ndps.administeredQuantity)} {ndps.quantityUnit}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-blue-700">Quantity remaining</span>
              <span className="font-medium text-blue-950">{Number(ndps.residualQuantity)} {ndps.quantityUnit}</span>
            </div>
          </>
        )}
      </div>
      {dose.notes && (
        <p className="mt-2 border-t border-blue-200 pt-2 text-xs text-blue-950">
          <span className="font-medium">Notes:</span> {dose.notes}
        </p>
      )}
    </div>
  );
}
