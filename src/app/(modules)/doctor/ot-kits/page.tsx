'use client';

// ============================================================
// Doctor — raise and track the OT kit for a case.
//
// `POST /ot-kit/issues/request` has always been open to any authenticated
// staff, and the surgeon COULD already raise a kit — but only from a small icon
// on an OT-case row, or a footer button inside that case's detail dialog, and
// only while the case sits in one of three statuses. Nobody found it. QA
// reported the action as missing for doctors, which is what an action with no
// entry point amounts to.
//
// This is the entry point: one visible place in the doctor's own module to
// raise a kit and see where it got to. It reuses the same RequestKitDialog the
// OT nurse and the OT module use, so there stays exactly one definition of what
// a kit request is.
//
// Issuing to theatre and reconciling what was actually used stay with the
// pharmacy — those move stock and money and are permission-gated there.
// ============================================================

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Eye, PackageOpen, Plus, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useAuthStore } from '@/stores/auth-store';
import { useOtKitIssues, useCancelKit, type OtKitIssue } from '@/hooks/use-ot-kit';
import { RequestKitDialog } from '@/components/ot-kit/request-kit-dialog';

// What each pharmacy-side state means to the surgeon who asked for the kit.
const STATUS: Record<string, { label: string; tone: string }> = {
  requested: { label: 'With the pharmacy', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  issued: { label: 'Issued to theatre', tone: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  reconciled: { label: 'Used & billed', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', tone: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
};

function KitDetailDialog({ issue, onClose }: { issue: OtKitIssue; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-primary" />
            {issue.issueNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium">
              {issue.patientName ?? '—'}
              {issue.patientMrn ? ` · ${issue.patientMrn}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge className={cn('border', STATUS[issue.status]?.tone)}>
              {STATUS[issue.status]?.label ?? issue.status}
            </Badge>
          </div>
          {(issue.items ?? []).length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(issue.items ?? []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-sm">{it.drugName ?? 'Item'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{it.issuedQty}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {it.consumedQty ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DoctorOtKitsPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data, isLoading } = useOtKitIssues();
  const cancelKit = useCancelKit();

  const [requestOpen, setRequestOpen] = useState(false);
  const [viewing, setViewing] = useState<OtKitIssue | null>(null);

  // The surgeon's own requests first — the list is hospital-wide, and a theatre
  // running several cases makes someone else's kit the top row otherwise.
  const issues = useMemo(() => {
    const list = data?.items ?? [];
    return [...list].sort((a, b) => {
      const mine = (i: OtKitIssue) => (i.requestedById === currentUserId ? 0 : 1);
      if (mine(a) !== mine(b)) return mine(a) - mine(b);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [data, currentUserId]);

  async function doCancel(issue: OtKitIssue) {
    try {
      await cancelKit.mutateAsync({ id: issue.id });
      toast.success('Kit request withdrawn');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not withdraw the request'));
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">OT Kits</h1>
          <p className="text-sm text-muted-foreground">
            Ask the pharmacy for a surgical kit and follow it through to theatre.
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Request OT Kit
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No kit requests yet"
          description="Request a kit for a scheduled case and the pharmacy will issue it to theatre."
          action={
            <Button onClick={() => setRequestOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Request OT Kit
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kit</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((k) => {
                const mine = k.requestedById === currentUserId;
                return (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-medium">{k.issueNumber}</div>
                      {mine && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                          <Stethoscope className="h-3 w-3" /> Yours
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {k.patientName ?? '—'}
                      {k.patientMrn && (
                        <div className="text-[11px] text-muted-foreground">{k.patientMrn}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.createdAt ? formatDate(k.createdAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', STATUS[k.status]?.tone)}>
                        {STATUS[k.status]?.label ?? k.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setViewing(k)}
                          aria-label="View kit"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* Only your own request, and only while the pharmacy
                            has not issued it — after that a cancellation is a
                            stock reversal and belongs to the pharmacy. */}
                        {mine && k.status === 'requested' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={cancelKit.isPending}
                            onClick={() => doCancel(k)}
                            aria-label="Withdraw request"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <RequestKitDialog open={requestOpen} onOpenChange={setRequestOpen} />
      {viewing && <KitDetailDialog issue={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
