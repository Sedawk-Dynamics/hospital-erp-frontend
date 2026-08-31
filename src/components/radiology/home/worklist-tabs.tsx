'use client';

// The radiology worklists — the mirror of the lab's LabStatusTab.
//
// Every list now goes through the shared filter bar and asks the SERVER for its
// set. The old tabs each carried a bare search box and filtered nothing else,
// and the dashboard tab derived its three counts from one page of 100 rows in
// the browser, so a busy department silently under-reported itself.

import { useMemo, useState } from 'react';
import { RotateCcw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/date-utils';
import { getApiErrorMessage } from '@/lib/utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';
import { useUsersList } from '@/hooks/use-users';
import {
  useImagingRequests,
  useReopenImagingRequest,
  IMAGING_CLOSURE_REASON_LABELS,
  type ImagingRequest,
} from '@/hooks/use-imaging';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import {
  EmptyRow,
  LoadingRow,
  PaginationBar,
  TableShell,
  Th,
} from '@/components/shared/diagnostics/table-bits';
import {
  ImagingOrderFilters,
  EMPTY_IMAGING_FILTERS,
  toImagingQuery,
  type ImagingFilters,
} from '@/components/radiology/imaging-order-filters';
import { RequestTable } from './request-table';
import { AcceptRequestDialog } from './accept-request-dialog';
import { UploadResultDialog } from './upload-result-dialog';
import { CloseRequestDialog } from './close-request-dialog';
import { fullName } from '@/lib/person-name';

/** Every status a study can be in while it is still live work. */
export const IMAGING_OPEN_STATUSES = 'requested,scheduled,in_progress';

export type ImagingListVariant = 'intake' | 'worklist' | 'completed' | 'closed';

export function ImagingWorklistTab({
  variant,
  seedOverdue = false,
  onSeedConsumed,
}: {
  variant: ImagingListVariant;
  /** Open already filtered to overdue — set when arriving from the card. */
  seedOverdue?: boolean;
  onSeedConsumed?: () => void;
}) {
  const { isRadiologyAdmin, isRadiologist } = useRadiologyRole();
  const [filters, setFilters] = useState<ImagingFilters>({ ...EMPTY_IMAGING_FILTERS });
  const [page, setPage] = useState(1);

  const [acceptFor, setAcceptFor] = useState<ImagingRequest | null>(null);
  const [uploadFor, setUploadFor] = useState<ImagingRequest | null>(null);
  const [closeFor, setCloseFor] = useState<ImagingRequest | null>(null);

  // Arriving from the Overdue card. Keyed on the flag so it seeds once and then
  // leaves the bar under the user's control.
  useSeedOnChange(seedOverdue ? 'overdue' : null, () => {
    setFilters({ ...EMPTY_IMAGING_FILTERS, overdue: true });
    setPage(1);
    onSeedConsumed?.();
  });

  // Only the admin view offers an assignee filter, so only it needs the list.
  const usersQ = useUsersList(isRadiologyAdmin ? { limit: 200 } : undefined);
  const radiologists = useMemo(
    () =>
      (usersQ.data?.data ?? [])
        .filter((u) =>
          u.userRoles?.some((ur) => ['radiologist', 'radiology_admin'].includes(ur.role.name)),
        )
        .map((u) => ({ id: u.id, name: fullName(u) })),
    [usersQ.data],
  );

  const q = toImagingQuery(filters);
  const scope = (() => {
    switch (variant) {
      case 'intake':
        // What the admin has to accept: raised by a doctor, still untouched.
        return { accepted: false, excludeCancelled: true, excludeCompleted: true };
      case 'completed':
        return { status: 'completed' as const };
      case 'closed':
        return { closed: true };
      default:
        // The bench: accepted and still live. A radiologist additionally only
        // ever sees payment-cleared work — the server enforces the same rule.
        return {
          accepted: true,
          statuses: q.status ? undefined : IMAGING_OPEN_STATUSES,
          ...(isRadiologist ? { paymentVerified: 'true' as const } : {}),
        };
    }
  })();

  const { data, isLoading } = useImagingRequests({
    ...q,
    ...scope,
    page,
    limit: 20,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];
  const locked = variant === 'completed' || variant === 'closed';

  if (variant === 'closed') {
    return (
      <ClosedList
        requests={requests}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPage={setPage}
        filters={filters}
        onFilters={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ImagingOrderFilters
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showStatus={!locked && variant !== 'intake'}
        radiologists={isRadiologyAdmin && variant !== 'intake' ? radiologists : undefined}
        showOverdue={!locked}
        showUnassigned={isRadiologyAdmin && variant === 'worklist'}
      />

      {variant === 'intake' && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
          These studies are waiting on radiology. Accepting takes the payment at this counter (or
          posts it to the patient&apos;s stay ledger) and hands the study to a radiologist.
        </div>
      )}

      <RequestTable
        requests={requests}
        loading={isLoading}
        emptyMsg={
          variant === 'intake'
            ? 'Nothing waiting to be accepted.'
            : variant === 'completed'
              ? 'No completed studies match these filters.'
              : filters.overdue
                ? 'Nothing is past its 24-hour SLA.'
                : 'Nothing in the worklist matches these filters.'
        }
        showBill={isRadiologyAdmin}
        showAssignee={variant !== 'intake'}
        onAccept={isRadiologyAdmin && variant === 'intake' ? setAcceptFor : undefined}
        onUpload={variant === 'intake' ? undefined : setUploadFor}
        onClose={isRadiologyAdmin && !locked ? setCloseFor : undefined}
      />

      <AcceptRequestDialog request={acceptFor} onOpenChange={(o) => !o && setAcceptFor(null)} />
      <UploadResultDialog request={uploadFor} onOpenChange={(o) => !o && setUploadFor(null)} />
      <CloseRequestDialog request={closeFor} onOpenChange={(o) => !o && setCloseFor(null)} />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}

/** Terminal admin-closed studies, with a way back into the worklist. */
function ClosedList({
  requests,
  loading,
  page,
  totalPages,
  onPage,
  filters,
  onFilters,
}: {
  requests: ImagingRequest[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (n: number) => void;
  filters: ImagingFilters;
  onFilters: (f: ImagingFilters) => void;
}) {
  const { isRadiologyAdmin } = useRadiologyRole();
  const reopen = useReopenImagingRequest();

  const handleReopen = async (r: ImagingRequest) => {
    try {
      await reopen.mutateAsync(r.id);
      toast.success('Reopened — back in the worklist');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reopen'));
    }
  };

  const cols = isRadiologyAdmin ? 8 : 7;

  return (
    <div className="space-y-4">
      <ImagingOrderFilters
        value={filters}
        onChange={onFilters}
        showStatus={false}
        showOverdue={false}
      />

      <TableShell>
        <thead>
          <tr className="border-b border-surface-container">
            <Th>Patient</Th>
            <Th>Study</Th>
            <Th>Body Part</Th>
            <Th>Status</Th>
            <Th>Reason</Th>
            <Th>Closed By</Th>
            <Th>Closed At</Th>
            {isRadiologyAdmin && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <LoadingRow span={cols} />
          ) : requests.length === 0 ? (
            <EmptyRow span={cols} message="No closed or no-show requests." />
          ) : (
            requests.map((r) => (
              <tr key={r.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3 font-medium">
                  <div>
                    {r.patient?.firstName} {r.patient?.lastName}
                  </div>
                  {r.patient?.mrn && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {r.patient.mrn}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">{r.bodyPart ?? '-'}</td>
                <td className="px-4 py-3">
                  {r.status === 'no_show' ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 text-amber-700"
                    >
                      <UserX className="mr-1 size-3" /> No-show
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                      Cancelled
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div>
                    {r.closureReason
                      ? (IMAGING_CLOSURE_REASON_LABELS[r.closureReason] ?? r.closureReason)
                      : '-'}
                  </div>
                  {r.closureNote && (
                    <div
                      className="max-w-[200px] truncate text-[10px] text-muted-foreground"
                      title={r.closureNote}
                    >
                      {r.closureNote}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.closer ? fullName(r.closer) : '-'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.closedAt ? formatDateTime(r.closedAt) : '-'}
                </td>
                {isRadiologyAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReopen(r)}
                        disabled={reopen.isPending}
                      >
                        <RotateCcw className="size-3.5" /> Reopen
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} onPage={onPage} />}
    </div>
  );
}
