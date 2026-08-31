'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { Fragment, useState } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  type LabOrder
} from '@/hooks/use-lab';
import { EmptyRow, LoadingRow, PriorityBadge, SpecimensCell, StatusBadge, TestsCell, Th } from '@/components/laboratory/home/lab-table-bits';
import { TableShell } from '@/components/shared/diagnostics/table-bits';
import {
  EncounterBadge,
  ConsultationBadge,
  OrderBillCell,
  PaymentStatusBadge,
} from '@/components/shared/diagnostics/order-bill-cell';
import { fullName } from '@/lib/person-name';


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
  const colCount = 9 + (showAssignee ? 1 : 0) + (showBill ? 1 : 0);
  // Which orders are showing their full test list. Multiple can be open at
  // once — the lab compares orders against each other while deciding what to
  // pick up next, so opening one must not close another.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <TableShell>
      <thead>
        <tr className="border-b border-surface-container">
          {/* Expander column — no label; the control explains itself. */}
          <Th> </Th>
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
          orders.map((o) => {
            const items = o.labOrderItems ?? [];
            const isOpen = expanded.has(o.id);
            return (
            <Fragment key={o.id}>
            <tr className="hover:bg-surface-container-low transition-colors">
              <td className="py-3 pl-3 pr-0 align-top">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Hide tests' : `Show all ${items.length} tests`}
                    className="rounded-md p-0.5 text-muted-foreground hover:bg-surface-container hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
                    />
                  </button>
                )}
              </td>
              <td className="px-4 py-3 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>
                    {o.patient.firstName} {o.patient.lastName}
                  </span>
                  <EncounterBadge encounter={o.encounter} />
                  <ConsultationBadge consultation={o.consultation} />
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
                    ? fullName(o.assignedTo)
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

            {/* The expanded view the queue was missing: every test on the
                order, with the state each one is in, without opening the order
                or crossing to another tab. */}
            {isOpen && (
              <tr className="bg-surface-container-low/60">
                <td />
                <td colSpan={colCount - 1} className="px-4 pb-3 pt-0">
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{it.test?.testName ?? 'Test'}</span>
                        {it.test?.testCode && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {it.test.testCode}
                          </span>
                        )}
                        <span className="rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                          {it.status.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
            </Fragment>
            );
          })
        )}
      </tbody>
    </TableShell>
  );
}
