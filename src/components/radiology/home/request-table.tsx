'use client';

// The radiology worklist table — deliberately the same shape as the lab's
// OrderTable: Patient · MRN · Reference · What · Priority · Status · Assigned ·
// Actions, with the money column appearing only where the admin needs it.
//
// The old table had no reference, no assignee and no accept action, and its
// "Bill" column existed on one tab only, so the same study looked like a
// different kind of record depending on which tab you were standing on.

import { ClipboardCheck, ImagePlus, Pencil, ShieldCheck, Ban, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImagingRequest } from '@/hooks/use-imaging';
import {
  EmptyRow,
  LoadingRow,
  PriorityBadge,
  TableShell,
  Th,
} from '@/components/shared/diagnostics/table-bits';
import {
  EncounterBadge,
  ConsultationBadge,
  OrderBillCell,
  PaymentStatusBadge,
} from '@/components/shared/diagnostics/order-bill-cell';
import { ImagingStatusBadge } from './imaging-status-badge';
import { fullName } from '@/lib/person-name';

export function RequestTable({
  requests,
  loading,
  emptyMsg,
  showBill,
  showAssignee = true,
  onAccept,
  onUpload,
  onClose,
}: {
  requests: ImagingRequest[];
  loading: boolean;
  emptyMsg: string;
  /** Admin-only money column. */
  showBill?: boolean;
  showAssignee?: boolean;
  onAccept?: (r: ImagingRequest) => void;
  onUpload?: (r: ImagingRequest) => void;
  onClose?: (r: ImagingRequest) => void;
}) {
  const colCount = 6 + (showBill ? 1 : 0) + (showAssignee ? 1 : 0) + 1;

  return (
    <TableShell>
      <thead>
        <tr className="border-b border-surface-container">
          <Th>Patient</Th>
          <Th>MRN</Th>
          <Th>Study</Th>
          <Th>Body Part</Th>
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
        ) : requests.length === 0 ? (
          <EmptyRow span={colCount} message={emptyMsg} />
        ) : (
          requests.map((r) => {
            const published = r.imagingResult?.status === 'published';
            const isDraft = r.imagingResult?.status === 'draft';
            const terminal = r.status === 'cancelled' || r.status === 'no_show';
            // The radiologist may only touch a study the admin has cleared. The
            // server enforces this too; hiding the button stops a click that
            // could only ever 403.
            const canWork = !!r.acceptedAt && r.paymentVerified !== false;

            return (
              <tr key={r.id} className="transition-colors hover:bg-surface-container-low">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>
                      {r.patient?.firstName} {r.patient?.lastName}
                    </span>
                    <EncounterBadge encounter={r.encounter} />
                  <ConsultationBadge consultation={r.consultation} />
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {r.patient?.mrn ?? '-'}
                </td>
                <td className="px-4 py-3 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">{r.bodyPart ?? '-'}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={r.urgency ?? r.priority} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <ImagingStatusBadge
                      status={r.status}
                      resultStatus={r.imagingResult?.status}
                      accepted={!!r.acceptedAt}
                    />
                    {!terminal && (
                      <PaymentStatusBadge
                        paymentVerified={r.paymentVerified}
                        deferredReason={r.paymentDeferredReason}
                        isLedger={r.linkedBill?.isLedger}
                      />
                    )}
                  </div>
                </td>
                {showAssignee && (
                  <td className="px-4 py-3 text-xs">
                    {r.assignedTechnician
                      ? fullName(r.assignedTechnician)
                      : r.acceptedAt
                        ? <span className="text-amber-700">Unassigned</span>
                        : '-'}
                  </td>
                )}
                {showBill && (
                  <td className="px-4 py-3 text-xs">
                    <OrderBillCell bill={r.linkedBill} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {onAccept && !r.acceptedAt && !terminal && (
                      <Button size="sm" onClick={() => onAccept(r)}>
                        <ClipboardCheck className="size-3.5" /> Accept
                      </Button>
                    )}
                    {onUpload && !terminal && canWork && !published && (
                      <Button size="sm" variant={isDraft ? 'outline' : 'default'} onClick={() => onUpload(r)}>
                        {r.imagingResult ? (
                          <>
                            <Pencil className="size-3.5" /> {isDraft ? 'Continue draft' : 'Open'}
                          </>
                        ) : (
                          <>
                            <ImagePlus className="size-3.5" /> Upload Result
                          </>
                        )}
                      </Button>
                    )}
                    {published && (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700"
                      >
                        <Lock className="mr-1 size-3" /> Published — locked
                      </Badge>
                    )}
                    {onUpload && !terminal && !canWork && (
                      <span className="px-2 text-[10px] italic text-muted-foreground">
                        {r.acceptedAt ? 'Payment pending' : 'Not accepted yet'}
                      </span>
                    )}
                    {onClose && !terminal && r.status !== 'completed' && !r.imagingResult && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => onClose(r)}
                      >
                        <Ban className="size-3.5" /> Close
                      </Button>
                    )}
                    {r.awaitingApproval && !onAccept && (
                      <span className="inline-flex items-center gap-1 px-2 text-[10px] italic text-muted-foreground">
                        <ShieldCheck className="size-3" /> Awaiting approval
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </TableShell>
  );
}
