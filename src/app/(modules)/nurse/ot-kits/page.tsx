'use client';

// ============================================================
// Nurse — order the surgeon's OT kit from the pharmacy.
//
// The whole kit workflow already existed, and `POST /ot-kit/issues/request` was
// already open to any authenticated staff — but the only two screens that could
// reach it were /ot/kits (OT module: admin, super_admin, inventory_manager) and
// /doctor/ot-list (the surgeon). A ward nurse holds neither module, so the one
// person who usually raises the pre-op kit had no way to do it.
//
// This is that surface. It reuses the same RequestKitDialog the surgeon uses, so
// there is one definition of what a kit request is.
//
// The nurse requests and tracks. Issuing to the theatre and reconciling what was
// actually used stay with the pharmacy (/pharmacy/ot-kits) — those move stock
// and money, and are permission-gated accordingly.
// ============================================================

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Loader2, Eye, Ban, PackageOpen, ArrowRight, Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useSurgicalTemplates,
  useOtKitIssues,
  useCancelKit,
  type OtKitIssue,
} from '@/hooks/use-ot-kit';
import { RequestKitDialog } from '@/components/ot-kit/request-kit-dialog';

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-300',
  issued: 'bg-blue-100 text-blue-700 border-blue-300',
  reconciled: 'bg-teal-100 text-teal-700 border-teal-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

// Ward-nurse wording for each pharmacy-side state — what it means for them,
// not what the pharmacy calls it internally.
const STATUS_LABEL: Record<string, string> = {
  requested: 'Waiting on pharmacy',
  issued: 'Issued to theatre',
  reconciled: 'Reconciled & billed',
  cancelled: 'Cancelled',
};

const FILTERS = ['all', 'requested', 'issued', 'reconciled', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

const TEXTAREA_CLS =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 border-gray-300')}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export default function NurseOtKitsPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [requestOpen, setRequestOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<OtKitIssue | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<OtKitIssue | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, isError } = useOtKitIssues();
  const issues = useMemo(
    () => (filter === 'all' ? (data?.items ?? []) : (data?.items ?? []).filter((i) => i.status === filter)),
    [data, filter],
  );

  // Fetched once here and handed to the dialog so it does not refetch the cards.
  const { data: tplData } = useSurgicalTemplates({ includeInactive: true });
  const templateName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tplData?.items ?? []) m.set(t.id, t.name);
    return m;
  }, [tplData]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.items?.length ?? 0 };
    for (const i of data?.items ?? []) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold">OT Kits</h1>
          <p className="text-xs text-muted-foreground">
            Order the surgeon&apos;s preference-card kit for a scheduled surgery. The pharmacy issues
            the kit whole to the theatre and afterwards bills only what was actually used.
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Order OT Kit
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-bold capitalize transition-colors',
              filter === f
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
            )}
          >
            {f === 'all' ? 'All' : (STATUS_LABEL[f] ?? f)}
            {counts[f] ? <span className="ml-1.5 opacity-70">{counts[f]}</span> : null}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load OT kits. Please try again.
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                {['Kit #', 'Patient', 'Kit / Preference card', 'Items', 'Status', 'Ordered', 'Action'].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
                      i === 6 ? 'text-center' : 'text-left',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading OT kits...</p>
                  </td>
                </tr>
              ) : !isError && issues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {filter === 'all'
                        ? 'No OT kits yet. Order the surgeon’s kit for a scheduled surgery.'
                        : `No kits in “${STATUS_LABEL[filter] ?? filter}”.`}
                    </p>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => {
                  // Only a still-pending kit you raised yourself can be
                  // withdrawn here — once the pharmacy has issued it, stock has
                  // moved and pulling it back is their call.
                  const canWithdraw =
                    issue.status === 'requested' && issue.requestedById === currentUserId;
                  return (
                    <tr key={issue.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{issue.issueNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{issue.patientName ?? '—'}</div>
                        {issue.patientMrn && (
                          <div className="text-xs text-muted-foreground">MRN: {issue.patientMrn}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {issue.templateId ? (templateName.get(issue.templateId) ?? '—') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{issue.items?.length ?? 0}</td>
                      <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(issue.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canWithdraw && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setWithdrawTarget(issue)}
                            >
                              <Ban className="mr-1 h-3.5 w-3.5" /> Withdraw
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="View details"
                            onClick={() => setViewTarget(issue)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium">Flow:</span>
        <span>You order</span>
        <ArrowRight className="h-3 w-3" />
        <span>Pharmacy issues to theatre</span>
        <ArrowRight className="h-3 w-3" />
        <span>Surgery consumes</span>
        <ArrowRight className="h-3 w-3" />
        <span>Pharmacy reconciles &amp; bills only what was used</span>
      </div>

      <RequestKitDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        templates={tplData?.items ?? []}
      />
      {viewTarget && (
        <KitDetailsDialog
          issue={viewTarget}
          templateName={viewTarget.templateId ? templateName.get(viewTarget.templateId) : undefined}
          onClose={() => setViewTarget(null)}
        />
      )}
      {withdrawTarget && (
        <WithdrawDialog issue={withdrawTarget} onClose={() => setWithdrawTarget(null)} />
      )}
    </div>
  );
}

// ============================================================
// Kit details — read-only. Items only exist once the pharmacy has issued.
// ============================================================

function KitDetailsDialog({
  issue,
  templateName,
  onClose,
}: {
  issue: OtKitIssue;
  templateName?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Kit {issue.issueNumber}
            <StatusBadge status={issue.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Patient</span>
            <div className="font-medium">{issue.patientName ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">MRN</span>
            <div className="font-medium">{issue.patientMrn ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Kit</span>
            <div className="font-medium">{templateName ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Issued at</span>
            <div className="font-medium">{issue.issuedAt ? formatDate(issue.issuedAt) : '—'}</div>
          </div>
        </div>

        {issue.notes && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{issue.notes}</p>
        )}

        {(issue.items?.length ?? 0) > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Item', 'Issued', 'Returned', 'Consumed'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                        i === 0 ? 'text-left' : 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issue.items.map((it) => {
                  const consumed = it.consumedQty ?? it.issuedQty - (it.returnedQty ?? 0);
                  return (
                    <tr key={it.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">{it.drugName ?? it.drugFormularyId}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.issuedQty}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.returnedQty ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.issuedQty ? consumed : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" />
            Ordered — the pharmacy has not issued this kit yet. The items appear here once it goes
            to the theatre.
          </p>
        )}

        {issue.status === 'reconciled' && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-4 py-2.5 text-sm text-teal-700">
            Reconciled — only the consumed items were billed; unused units went back into pharmacy
            stock.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Withdraw — your own kit, before the pharmacy has issued it
// ============================================================

function WithdrawDialog({ issue, onClose }: { issue: OtKitIssue; onClose: () => void }) {
  const cancel = useCancelKit();
  const [reason, setReason] = useState('');

  const submit = () => {
    cancel.mutate(
      { id: issue.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Kit order withdrawn');
          onClose();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to withdraw the order')),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Kit Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Withdraw kit <b>{issue.issueNumber}</b>? Only possible while the pharmacy has not
            issued it — after that they have to pull it back and return the stock.
          </p>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. surgery deferred, wrong preference card..."
              className={TEXTAREA_CLS}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep</Button>
          <Button variant="destructive" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
