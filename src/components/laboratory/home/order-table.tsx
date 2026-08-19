'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import {
  ClipboardCheck,
  FlaskConical,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type LabOrder
} from '@/hooks/use-lab';
import { EmptyRow, LoadingRow, PriorityBadge, SpecimensCell, StatusBadge, TestsCell, Th } from '@/components/laboratory/home/lab-table-bits';
import { TableShell } from '@/components/shared/diagnostics/table-bits';
import {
  EncounterBadge,
  OrderBillCell,
  PaymentStatusBadge,
} from '@/components/shared/diagnostics/order-bill-cell';


// ============================================================
// Reusable order table
// ============================================================
export function OrderTable({
  orders,
  loading,
  emptyMsg,
  onAccept,
  onView,
  onCollect,
  showAssignee,
  showBill,
}: {
  orders: LabOrder[];
  loading: boolean;
  emptyMsg: string;
  onAccept?: (o: LabOrder) => void;
  onView?: (o: LabOrder) => void;
  onCollect?: (o: LabOrder) => void;
  showAssignee?: boolean;
  /** Supervisor-only money column — the same one radiology's table carries. */
  showBill?: boolean;
}) {
  const colCount = 8 + (showAssignee ? 1 : 0) + (showBill ? 1 : 0);
  return (
    <TableShell>
      <thead>
        <tr className="border-b border-surface-container">
          <Th>Patient</Th>
          <Th>MRN</Th>
          <Th>Order #</Th>
          <Th>Tests</Th>
          <Th>Specimens</Th>
          <Th>Priority</Th>
          <Th>Status</Th>
          {showAssignee && <Th>Assigned</Th>}
          {showBill && <Th>Bill</Th>}
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <LoadingRow span={colCount} />
        ) : orders.length === 0 ? (
          <EmptyRow span={colCount} message={emptyMsg} />
        ) : (
          orders.map((o) => (
            <tr key={o.id} className="hover:bg-surface-container-low transition-colors">
              <td className="px-4 py-3 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>
                    {o.patient.firstName} {o.patient.lastName}
                  </span>
                  <EncounterBadge encounter={o.encounter} />
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{o.patient.mrn}</td>
              <td className="px-4 py-3 font-mono text-xs">{o.orderNumber ?? o.id.slice(0, 8)}</td>
              <td className="px-4 py-3">
                <TestsCell items={o.labOrderItems} />
              </td>
              <td className="px-4 py-3">
                <SpecimensCell samples={o.labSamples} />
              </td>
              <td className="px-4 py-3"><PriorityBadge priority={(o.urgency ?? o.priority) as string} /></td>
              <td className="px-4 py-3">
                {/* Where the work is, and where the money is. An unpaid order
                    used to look identical to a settled one. */}
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={o.status} reportStatus={o.labReport?.status} />
                  {o.status !== 'cancelled' && (
                    <PaymentStatusBadge
                      paymentVerified={o.paymentVerified}
                      deferredReason={o.paymentDeferredReason}
                      isLedger={o.linkedBill?.isLedger}
                    />
                  )}
                </div>
              </td>
              {showAssignee && (
                <td className="px-4 py-3 text-xs">
                  {o.assignedTo
                    ? `${o.assignedTo.firstName} ${o.assignedTo.lastName}`
                    : o.acceptedAt
                      ? <span className="text-amber-700">Unassigned</span>
                      : '-'}
                </td>
              )}
              {showBill && (
                <td className="px-4 py-3 text-xs">
                  <OrderBillCell bill={o.linkedBill} />
                </td>
              )}
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  {/* An order Intake has not accepted is not workable: no
                      payment taken, no assignment, no clock started. The server
                      refuses result entry and file upload on it, so saying so
                      here beats letting the bench try and get a 400. */}
                  {!o.acceptedAt && !onAccept && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800"
                      title="Accept this order from the Intake tab first — that is where payment is taken and it enters the lab workflow."
                    >
                      <Lock className="size-3" /> Awaiting intake
                    </span>
                  )}
                  {onView && (
                    <Button size="sm" variant="outline" onClick={() => onView(o)}>
                      View
                    </Button>
                  )}
                  {onAccept && !o.acceptedAt && (
                    <Button size="sm" onClick={() => onAccept(o)}>
                      <ClipboardCheck className="size-3.5" /> Accept
                    </Button>
                  )}
                  {onCollect && o.status === 'ordered' && o.acceptedAt && (
                    <Button size="sm" variant="outline" onClick={() => onCollect(o)}>
                      <FlaskConical className="size-3.5" /> Collect
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </TableShell>
  );
}
