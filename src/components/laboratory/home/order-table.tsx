'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import {
  ClipboardCheck,
  FlaskConical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type LabOrder
} from '@/hooks/use-lab';
import { EmptyRow, LoadingRow, PriorityBadge, SpecimensCell, StatusBadge, Th } from '@/components/laboratory/home/lab-table-bits';


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
}: {
  orders: LabOrder[];
  loading: boolean;
  emptyMsg: string;
  onAccept?: (o: LabOrder) => void;
  onView?: (o: LabOrder) => void;
  onCollect?: (o: LabOrder) => void;
  showAssignee?: boolean;
}) {
  const colCount = 8 + (showAssignee ? 1 : 0);
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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
                    {o.patient.firstName} {o.patient.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.patient.mrn}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{o.labOrderItems?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <SpecimensCell samples={o.labSamples} />
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={(o.urgency ?? o.priority) as string} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} reportStatus={o.labReport?.status} /></td>
                  {showAssignee && (
                    <td className="px-4 py-3 text-xs">
                      {o.assignedTo ? `${o.assignedTo.firstName} ${o.assignedTo.lastName}` : '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
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
        </table>
      </div>
    </div>
  );
}
