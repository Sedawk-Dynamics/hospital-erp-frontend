'use client';

// The lab's side of the shared accept flow: fetch what the order costs, hand it
// to the shared dialog, post the result. The dialog itself is the same component
// radiology uses, so both counters look and behave identically.
//
// Accepting used to be assign-a-technician-and-a-note. It is now the lab's whole
// counter transaction — the charge is posted here (it used to fire the moment
// the doctor placed the order, putting money on a bill for work the lab had not
// agreed to do), the money is taken here, and only then is the order admitted.

import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  useAcceptLabOrder,
  useLabOrderBillingPreview,
  type LabOrder,
} from '@/hooks/use-lab';
import { useUsersList } from '@/hooks/use-users';
import { AcceptDiagnosticOrderDialog } from '@/components/shared/diagnostics/accept-diagnostic-order-dialog';
import { money } from '@/components/shared/diagnostics/types';

export function AcceptOrderDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const accept = useAcceptLabOrder();
  const previewQ = useLabOrderBillingPreview(order?.id, !!order);
  const usersQ = useUsersList(order ? { limit: 200 } : undefined);

  const labStaff = useMemo(
    () =>
      (usersQ.data?.data ?? [])
        .filter((u) =>
          u.userRoles?.some((ur) => ['lab_technician', 'lab_supervisor'].includes(ur.role.name)),
        )
        .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [usersQ.data],
  );

  return (
    <AcceptDiagnosticOrderDialog
      open={!!order}
      onOpenChange={onOpenChange}
      nounSingular="lab order"
      subject={
        order
          ? {
              id: order.id,
              patientName:
                `${order.patient.firstName} ${order.patient.lastName ?? ''}`.trim() ||
                'Unknown patient',
              mrn: order.patient.mrn,
              reference: order.orderNumber ?? null,
              orderedBy: order.orderer
                ? `Dr. ${order.orderer.firstName} ${order.orderer.lastName}`
                : null,
              urgency: order.urgency ?? order.priority ?? null,
              items: (order.labOrderItems ?? []).map((it) => ({
                id: it.id,
                label: it.test?.testName ?? 'Test',
                sublabel: it.test?.testCode ?? null,
              })),
            }
          : null
      }
      preview={previewQ.data ?? null}
      previewLoading={previewQ.isLoading}
      assignees={labStaff}
      assigneeLabel="Assign to"
      assigneeHint="Unassigned orders show under the Unassigned filter on the work queue."
      submitting={accept.isPending}
      onAccept={async ({ assigneeId, notes, payment, deferReason }) => {
        if (!order) return;
        const res = await accept.mutateAsync({
          id: order.id,
          assignedToId: assigneeId,
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
              ? `Payment collected — order accepted${assigneeId ? ' and assigned' : ''}`
              : `Order accepted${assigneeId ? ' and assigned' : ''}`,
        );
      }}
    />
  );
}
