'use client';

// Radiology's side of the shared accept flow: fetch what the study costs, hand
// it to the shared dialog, post the result. The dialog itself is the same
// component the lab uses, which is what keeps the two counters identical.

import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  useAcceptImagingRequest,
  useImagingBillingPreview,
  type ImagingRequest,
} from '@/hooks/use-imaging';
import { useUsersList } from '@/hooks/use-users';
import { AcceptDiagnosticOrderDialog } from '@/components/shared/diagnostics/accept-diagnostic-order-dialog';
import { money } from '@/components/shared/diagnostics/types';

export function AcceptRequestDialog({
  request,
  onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const accept = useAcceptImagingRequest();
  const previewQ = useImagingBillingPreview(request?.id, !!request);
  const usersQ = useUsersList(request ? { limit: 200 } : undefined);

  const radiologists = useMemo(
    () =>
      (usersQ.data?.data ?? [])
        .filter((u) =>
          u.userRoles?.some((ur) => ['radiologist', 'radiology_admin'].includes(ur.role.name)),
        )
        .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [usersQ.data],
  );

  return (
    <AcceptDiagnosticOrderDialog
      open={!!request}
      onOpenChange={onOpenChange}
      nounSingular="imaging request"
      subject={
        request
          ? {
              id: request.id,
              patientName:
                `${request.patient?.firstName ?? ''} ${request.patient?.lastName ?? ''}`.trim() ||
                'Unknown patient',
              mrn: request.patient?.mrn,
              reference: `${request.imagingType.replace(/_/g, ' ').toUpperCase()}${request.bodyPart ? ` — ${request.bodyPart}` : ''}`,
              orderedBy: request.orderer
                ? `Dr. ${request.orderer.firstName} ${request.orderer.lastName}`
                : null,
              urgency: request.urgency ?? request.priority ?? null,
              items: [
                {
                  id: request.id,
                  label: `${request.imagingType.replace(/_/g, ' ').toUpperCase()}${request.bodyPart ? ` — ${request.bodyPart}` : ''}`,
                  sublabel: request.clinicalIndication ?? null,
                },
              ],
            }
          : null
      }
      preview={previewQ.data ?? null}
      previewLoading={previewQ.isLoading}
      assignees={radiologists}
      assigneeLabel="Assign to radiologist"
      assigneeHint="Unassigned studies show under the Unassigned filter on the worklist."
      submitting={accept.isPending}
      onAccept={async ({ assigneeId, notes, payment, deferReason }) => {
        if (!request) return;
        const res = await accept.mutateAsync({
          id: request.id,
          assignedTechnicianId: assigneeId,
          notes,
          payment,
          deferReason,
        });
        const billing = (res as { billing?: { mode?: string; chargeAmount?: number } } | undefined)
          ?.billing;
        toast.success(
          billing?.mode === 'ip'
            ? `Accepted — ${money(billing.chargeAmount)} posted to the stay ledger`
            : payment
              ? `Payment collected — study accepted${assigneeId ? ' and assigned' : ''}`
              : `Study accepted${assigneeId ? ' and assigned' : ''}`,
        );
      }}
    />
  );
}
