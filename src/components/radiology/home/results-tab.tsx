'use client';

// The admin's approval queue and the published archive — the mirror of the lab's
// TestReportTab, which pins `review` for Awaiting Approval and `published` for
// the archive.
//
// The queue used to be "request completed and result not published", which swept
// in drafts a radiologist was still working on. Now that Mark as Done is back,
// it is exactly what somebody has submitted: status = finalized.

import { useState } from 'react';
import { Eye, Pencil, ShieldCheck, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/date-utils';
import { cn, getApiErrorMessage } from '@/lib/utils';
import {
  useImagingResults,
  useVerifyImagingResult,
  useReopenImagingResult,
  type ImagingResult,
} from '@/hooks/use-imaging';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import {
  EmptyRow,
  LoadingRow,
  PaginationBar,
  TableShell,
  Th,
} from '@/components/shared/diagnostics/table-bits';
import { RadiologyReportPrintDialog } from '@/components/radiology/radiology-report-print-view';
import { SendBackDialog } from '@/components/shared/diagnostics/send-back-dialog';
import { EditResultDialog } from './edit-result-dialog';

export function ResultsTab({
  lockedStatus,
}: {
  /**
   * When set, pins the queue (finalized = Awaiting Approval, published =
   * Published) and hides the dropdown so it reads as a dedicated tab.
   */
  lockedStatus?: 'finalized' | 'published';
} = {}) {
  const { isRadiologyAdmin } = useRadiologyRole();
  const [statusFilter, setStatusFilter] = useState<'finalized' | 'published' | 'draft'>(
    lockedStatus ?? 'published',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useImagingResults({
    page,
    limit: 20,
    status: statusFilter,
    search: search.trim() || undefined,
  });
  const results = (data?.data ?? []) as ImagingResult[];

  const verify = useVerifyImagingResult();
  const reopen = useReopenImagingResult();
  const [editFor, setEditFor] = useState<ImagingResult | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sendBackFor, setSendBackFor] = useState<ImagingResult | null>(null);

  const isApprovalQueue = statusFilter === 'finalized';

  const handleApprove = async (r: ImagingResult) => {
    try {
      await verify.mutateAsync(r.id);
      toast.success('Report approved & published — the doctor and patient can now see it');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to approve'));
    }
  };

  // Sending back without saying why just returns the same report unchanged, so
  // the reason is collected rather than sent blank — same dialog the lab uses.
  const handleSendBack = async (reason: string) => {
    if (!sendBackFor) return;
    await reopen.mutateAsync({ id: sendBackFor.id, reason });
    toast.success('Sent back to the radiologist — they have been told why');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by patient or impression…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm flex-1"
        />
        {!lockedStatus && (
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="published">Published</option>
            <option value="finalized">Awaiting approval</option>
            <option value="draft">Drafts</option>
          </select>
        )}
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-surface-container">
            <Th>Patient</Th>
            <Th>Modality</Th>
            <Th>Status</Th>
            <Th>Radiologist</Th>
            <Th>{isApprovalQueue ? 'Submitted' : 'Created'}</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingRow span={6} />
          ) : results.length === 0 ? (
            <EmptyRow
              span={6}
              message={
                isApprovalQueue
                  ? 'No reports awaiting approval.'
                  : statusFilter === 'draft'
                    ? 'No drafts on the bench.'
                    : 'No published reports yet.'
              }
            />
          ) : (
            results.map((r) => (
              <tr key={r.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  {(r as { patient?: { firstName: string; lastName: string } }).patient?.firstName}{' '}
                  {(r as { patient?: { firstName: string; lastName: string } }).patient?.lastName}
                </td>
                <td className="px-4 py-3 capitalize">
                  {r.imagingRequest?.imagingType?.replace(/_/g, ' ') ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={cn(
                      'capitalize',
                      r.status === 'draft' && 'bg-indigo-100 text-indigo-800',
                      r.status === 'finalized' && 'bg-amber-100 text-amber-800',
                      r.status === 'published' && 'bg-emerald-100 text-emerald-800',
                    )}
                  >
                    {r.status === 'finalized' ? 'Awaiting approval' : r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.radiologist ? `${r.radiologist.firstName} ${r.radiologist.lastName}` : '-'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {formatDateTime(
                    isApprovalQueue
                      ? ((r as { updatedAt?: string }).updatedAt ?? r.createdAt)
                      : r.createdAt,
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewId(r.id)}
                      title="Preview branded report"
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    {r.status !== 'published' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditFor(r)}
                        title="Edit attached files"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    )}
                    {r.status === 'finalized' && isRadiologyAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-200 text-amber-800 hover:bg-amber-50"
                          onClick={() => setSendBackFor(r)}
                          disabled={reopen.isPending}
                          title="Send back to the radiologist for changes"
                        >
                          <Undo2 className="size-3.5" /> Send back
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(r)}
                          disabled={verify.isPending}
                        >
                          {verify.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="size-3.5" />
                          )}{' '}
                          Approve &amp; Publish
                        </Button>
                      </>
                    )}
                    {r.status === 'finalized' && !isRadiologyAdmin && (
                      <span className="px-2 text-[10px] italic text-muted-foreground">
                        Awaiting admin approval
                      </span>
                    )}
                    {r.status === 'draft' && isRadiologyAdmin && (
                      <span className="px-2 text-[10px] italic text-muted-foreground">
                        Still with the radiologist
                      </span>
                    )}
                    {r.pdfReportUrl && (
                      <a
                        className="px-2 py-1 text-xs underline"
                        href={r.pdfReportUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <RadiologyReportPrintDialog
        resultId={previewId}
        open={!!previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
      />
      <EditResultDialog result={editFor} onOpenChange={(open) => !open && setEditFor(null)} />

      <SendBackDialog
        open={!!sendBackFor}
        onOpenChange={(open) => !open && setSendBackFor(null)}
        submitting={reopen.isPending}
        subject={
          sendBackFor
            ? {
                title:
                  `${(sendBackFor as { patient?: { firstName: string; lastName: string } }).patient?.firstName ?? ''} ${(sendBackFor as { patient?: { firstName: string; lastName: string } }).patient?.lastName ?? ''}`.trim() ||
                  'Imaging report',
                sublabel: sendBackFor.imagingRequest?.imagingType
                  ? sendBackFor.imagingRequest.imagingType.replace(/_/g, ' ').toUpperCase()
                  : null,
              }
            : null
        }
        onConfirm={handleSendBack}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <PaginationBar page={page} totalPages={data?.meta?.totalPages ?? 1} onPage={setPage} />
      )}
    </div>
  );
}
