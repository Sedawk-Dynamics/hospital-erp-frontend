'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useMemo, useState } from 'react';
import {
  Search,
  Eye,
  Undo2,
  CheckCircle2,
  FileSearch,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/utils';
import {
  useLabOrders,
  useLabReports,
  usePublishLabReport,
  useRejectLabReport,
  type LabOrder,
  type LabReport,
  LAB_OPEN_STATUSES
} from '@/hooks/use-lab';
import { LabReportPrintDialog } from '@/components/laboratory/lab-report-print-view';
import { SendBackDialog } from '@/components/shared/diagnostics/send-back-dialog';
import { useUsersList } from '@/hooks/use-users';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { useLabRole } from '@/hooks/use-lab-role';
import {
  LabOrderFilters,
  EMPTY_LAB_FILTERS,
  toLabQuery,
  type LabFilters
} from '@/components/laboratory/lab-order-filters';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';
import { EmptyRow, LoadingRow, PaginationBar, Th } from '@/components/laboratory/home/lab-table-bits';
import { OrderDetailDialog } from '@/components/laboratory/home/order-detail-dialog';
import { OrderTable } from '@/components/laboratory/home/order-table';
import { SampleCollectionDialog } from '@/components/laboratory/home/sample-collection-dialog';


// ============================================================
// Status Tab — orders by status (sample collection lifecycle)
// ============================================================
export function LabStatusTab({
  variant = 'worklist',
  seedOverdue = false,
  onSeedConsumed,
}: {
  // 'worklist' = the live queue (everything not finished or cancelled).
  // 'completed'/'cancelled' = locked to that status.
  variant?: 'worklist' | 'pending' | 'completed' | 'cancelled';
  /** Open already filtered to overdue — set when arriving from the card. */
  seedOverdue?: boolean;
  onSeedConsumed?: () => void;
} = {}) {
  const { isSupervisor } = useLabRole();
  const [filters, setFilters] = useState<LabFilters>({ ...EMPTY_LAB_FILTERS });
  const [page, setPage] = useState(1);

  // Arriving from the Overdue card / panel. Keyed on the flag so it seeds once
  // and then leaves the filter bar under the user's control.
  useSeedOnChange(seedOverdue ? 'overdue' : null, () => {
    setFilters({ ...EMPTY_LAB_FILTERS, overdue: true });
    setPage(1);
    onSeedConsumed?.();
  });

  // Supervisors can narrow by who holds the work; a technician has no business
  // filtering their colleagues, so the control is simply not offered.
  // Only the supervisor view offers an assignee filter, so only it needs the list.
  const usersQ = useUsersList(isSupervisor ? { limit: 200 } : undefined);
  const technicians = useMemo(
    () =>
      (usersQ.data?.data ?? [])
        .filter((u) =>
          u.userRoles?.some((ur) =>
            ['lab_technician', 'lab_supervisor'].includes(ur.role.name),
          ),
        )
        .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [usersQ.data],
  );

  const lockedStatus =
    variant === 'completed' ? 'completed' : variant === 'cancelled' ? 'cancelled' : undefined;

  const { data, isLoading } = useLabOrders({
    ...toLabQuery(filters),
    // A locked tab pins its own status and ignores the picker.
    status: lockedStatus ?? toLabQuery(filters).status,
    // The live queue asks the SERVER for every open status. It used to fetch a
    // page unfiltered and drop the finished rows in the browser, so the table
    // showed a handful of the twenty rows it had asked for while the pager
    // still counted all twenty — the queue looked empty when it was not.
    statuses:
      !lockedStatus && !filters.status && variant !== 'worklist' ? LAB_OPEN_STATUSES : undefined,
    page,
    limit: 20,
  });

  const orders = data?.data ?? [];

  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [collectFor, setCollectFor] = useState<LabOrder | null>(null);

  return (
    <div className="space-y-4">
      <LabOrderFilters
        value={filters}
        onChange={(f) => { setFilters(f); setPage(1); }}
        showStatus={!lockedStatus}
        technicians={isSupervisor ? technicians : undefined}
        showOverdue={variant !== 'completed' && variant !== 'cancelled'}
        showUnassigned={isSupervisor && variant !== 'completed' && variant !== 'cancelled'}
      />

      <OrderTable
        orders={orders}
        loading={isLoading}
        emptyMsg={
          variant === 'completed'
            ? 'No completed orders match these filters.'
            : variant === 'cancelled'
              ? 'No cancelled orders match these filters.'
              : filters.overdue
                ? 'Nothing is past its 24-hour SLA. '
                : 'Nothing in the queue matches these filters.'
        }
        onView={setActiveOrder}
        onCollect={setCollectFor}
        showAssignee={isSupervisor}
        showBill={isSupervisor}
      />

      <OrderDetailDialog
        order={activeOrder}
        onOpenChange={(open) => !open && setActiveOrder(null)}
      />
      <SampleCollectionDialog
        order={collectFor}
        onOpenChange={(open) => !open && setCollectFor(null)}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPage={setPage}
        />
      )}
    </div>
  );
}

// ============================================================
// Test Report Tab — published + corrected reports, plus a "Pending Approval"
// filter so supervisors can quickly jump to the review queue.
// ============================================================
export function TestReportTab({
  lockedStatus,
}: {
  // When set, pins the report queue (published = Results, review = Awaiting
  // Approval) and hides the dropdown so it reads as a dedicated tab.
  lockedStatus?: 'published' | 'review' | 'draft';
} = {}) {
  const { canApprove } = useLabRole();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'published' | 'review' | 'draft'>(
    lockedStatus ?? 'published',
  );
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLabReports({
    search: search || undefined,
    status: statusFilter,
    page,
    limit: 20,
  });

  const publish = usePublishLabReport();
  const reject = useRejectLabReport();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sendBackFor, setSendBackFor] = useState<LabReport | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const reports = data?.data ?? [];
  const isReviewView = statusFilter === 'review';

  const handleApprove = async (r: LabReport) => {
    try {
      await publish.mutateAsync({ id: r.id, notify: true });
      toast.success('Approved & published — the doctor and patient can see it now');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to publish'));
    }
  };

  // The queue used to be a read-only list: to approve anything the supervisor
  // had to leave it, find the order on another tab, open it and scroll. The
  // decision now happens where the work is.
  const cols = 5 + (canApprove || isReviewView ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search by patient/MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm outline-none"
          />
        </div>
        {!lockedStatus && (
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="published">Published</option>
            <option value="review">Pending approval</option>
            <option value="draft">Drafts</option>
          </select>
        )}
      </div>

      {isReviewView && canApprove && reports.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Open the report to read it, then approve to release it to the doctor and
          patient — or send it back to the bench with what needs fixing.
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Order #</Th>
              <Th>Patient</Th>
              <Th>Status</Th>
              <Th>{isReviewView ? 'Submitted' : statusFilter === 'draft' ? 'Updated' : 'Published'}</Th>
              <Th>Version</Th>
              {(canApprove || isReviewView) && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRow span={cols} />
            ) : reports.length === 0 ? (
              <EmptyRow
                span={cols}
                message={
                  isReviewView
                    ? 'Nothing waiting on approval.'
                    : statusFilter === 'draft'
                      ? 'No drafts on the bench.'
                      : 'No published reports yet.'
                }
              />
            ) : (
              reports.map((r) => {
                const orderId = r.orderId ?? r.labOrderId;
                const sentBack = r.status === 'draft' && !!(r as { correctionNotes?: string }).correctionNotes;
                return (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-medium">{orderId?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      {r.patient ? `${r.patient.firstName} ${r.patient.lastName ?? ''}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'capitalize',
                          r.status === 'review' && 'bg-amber-100 text-amber-800',
                          r.status === 'draft' && 'bg-indigo-100 text-indigo-800',
                          r.status === 'published' && 'bg-emerald-100 text-emerald-800',
                        )}
                      >
                        {r.status === 'review' ? 'Awaiting approval' : sentBack ? 'Sent back' : r.status}
                      </Badge>
                      {/* Why it came back, on the row — the technician should not
                          have to open anything to find out what to fix. */}
                      {sentBack && (
                        <p className="mt-0.5 max-w-[240px] truncate text-[10px] text-amber-700"
                           title={(r as { correctionNotes?: string }).correctionNotes}>
                          {(r as { correctionNotes?: string }).correctionNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {isReviewView || statusFilter === 'draft'
                        ? ((r as { updatedAt?: string }).updatedAt
                            ? formatDateTime((r as { updatedAt?: string }).updatedAt!)
                            : '-')
                        : ((r as { publishedAt?: string }).publishedAt
                            ? formatDateTime((r as { publishedAt?: string }).publishedAt!)
                            : '-')}
                    </td>
                    <td className="px-4 py-3">v{(r as { version?: number }).version ?? 1}</td>
                    {(canApprove || isReviewView) && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {orderId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOpenOrderId(orderId)}
                              title="Open the order — files, results, samples"
                            >
                              <FileSearch className="size-3.5" /> Open
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewId(r.id)}
                            title="Preview the branded report"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {r.status === 'review' && canApprove && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-200 text-amber-800 hover:bg-amber-50"
                                onClick={() => setSendBackFor(r)}
                                disabled={reject.isPending}
                              >
                                <Undo2 className="size-3.5" /> Send back
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApprove(r)}
                                disabled={publish.isPending}
                              >
                                {publish.isPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3.5" />
                                )}{' '}
                                Approve &amp; Publish
                              </Button>
                            </>
                          )}
                          {r.status === 'review' && !canApprove && (
                            <span className="px-2 text-[10px] italic text-muted-foreground">
                              Awaiting lab admin
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LabReportPrintDialog
        reportId={previewId}
        open={!!previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
      />

      {/* Opening the order from here is what makes a decision possible: the
          files, the entered values and the samples are all in it. */}
      <OrderDetailDialog
        order={openOrderId ? ({ id: openOrderId } as LabOrder) : null}
        onOpenChange={(open) => !open && setOpenOrderId(null)}
      />

      <SendBackDialog
        open={!!sendBackFor}
        onOpenChange={(open) => !open && setSendBackFor(null)}
        submitting={reject.isPending}
        subject={
          sendBackFor
            ? {
                title: sendBackFor.patient
                  ? `${sendBackFor.patient.firstName} ${sendBackFor.patient.lastName ?? ''}`.trim()
                  : 'Lab report',
                sublabel: `Order ${(sendBackFor.orderId ?? sendBackFor.labOrderId)?.slice(0, 8)}`,
              }
            : null
        }
        onConfirm={async (reason) => {
          if (!sendBackFor) return;
          await reject.mutateAsync({ id: sendBackFor.id, reason });
          toast.success('Sent back to the bench — the technician has been told why');
        }}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}
