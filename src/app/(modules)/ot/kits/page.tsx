'use client';

// ============================================================
// OT module — Surgical Kit REQUESTS (design doc III, "Pre-Op Template Request").
// This is the OT NURSE side of the OT-Kit workflow: pick a scheduled surgery +
// the surgeon's preference-card template and send a bulk request to the pharmacy,
// then track it as the pharmacy issues (transit-locks) and later reconciles/
// net-bills it. Issuing and reconciling stay on the PHARMACY side
// (/pharmacy/ot-kits); the OT nurse requests, tracks, and can also maintain the
// surgeon preference-card templates (shared master data, edited here too).
// ============================================================

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Eye,
  Ban,
  PackageOpen,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useSurgicalTemplates,
  useOtKitIssues,
  useCancelKit,
  type OtKitIssue,
} from '@/hooks/use-ot-kit';
import { SurgicalTemplatesTab } from '@/components/ot-kit/surgical-templates-tab';
// Shared with the surgeon's own OT list — see components/ot-kit/request-kit-dialog.
import { RequestKitDialog } from '@/components/ot-kit/request-kit-dialog';

// ============================================================
// Helpers
// ============================================================

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-300',
  issued: 'bg-blue-100 text-blue-700 border-blue-300',
  reconciled: 'bg-teal-100 text-teal-700 border-teal-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

// OT-nurse-friendly wording for each pharmacy-side state.
const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  issued: 'Issued to theatre',
  reconciled: 'Reconciled & billed',
  cancelled: 'Cancelled',
};

const TEXTAREA_CLS =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 border-gray-300')}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ============================================================
// Page
// ============================================================

export default function OtKitRequestsPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Surgical Kit Requests</h1>
        <p className="text-xs text-muted-foreground">
          Pre-op: request the surgeon&apos;s preference-card kit for a scheduled surgery. The pharmacy issues the
          whole kit into the theatre, then reconciles the unused items after surgery — you only track it here.
        </p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList variant="line">
          <TabsTrigger value="requests">
            <PackageOpen className="h-4 w-4" /> Kit Requests
          </TabsTrigger>
          <TabsTrigger value="cards">
            <ClipboardList className="h-4 w-4" /> Preference Cards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="cards">
          <SurgicalTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Tab 1 — Kit Requests (request + track; NO issue/reconcile)
// ============================================================

function RequestsTab() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<OtKitIssue | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OtKitIssue | null>(null);

  const { data, isLoading, isError } = useOtKitIssues();
  const issues = data?.items ?? [];

  const { data: tplData } = useSurgicalTemplates({ includeInactive: true });
  const templateName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tplData?.items ?? []) m.set(t.id, t.name);
    return m;
  }, [tplData]);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kit requests you have raised to the pharmacy.</p>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Request Kit
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load kit requests. Please try again.
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                {['Kit #', 'Patient', 'Kit / Template', 'Items', 'Status', 'Requested', 'Action'].map((h, i) => (
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
                    <p className="mt-2 text-sm text-muted-foreground">Loading kit requests...</p>
                  </td>
                </tr>
              ) : !isError && issues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No kit requests yet. Request a preference-card kit for a scheduled surgery.
                    </p>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{issue.issueNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{issue.patientName ?? '—'}</div>
                      {issue.patientMrn && <div className="text-xs text-muted-foreground">MRN: {issue.patientMrn}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.templateId ? (templateName.get(issue.templateId) ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{issue.items?.length ?? 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(issue.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {issue.status === 'requested' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setCancelTarget(issue)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend — clarifies who does what */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium">Flow:</span>
        <span>You request</span>
        <ArrowRight className="h-3 w-3" />
        <span>Pharmacy issues to theatre</span>
        <ArrowRight className="h-3 w-3" />
        <span>Surgery consumes</span>
        <ArrowRight className="h-3 w-3" />
        <span>Pharmacy reconciles &amp; bills only what was used</span>
      </div>

      <RequestKitDialog open={requestOpen} onOpenChange={setRequestOpen} templates={tplData?.items ?? []} />
      {viewTarget && (
        <RequestDetailsDialog
          issue={viewTarget}
          templateName={viewTarget.templateId ? templateName.get(viewTarget.templateId) : undefined}
          onClose={() => setViewTarget(null)}
        />
      )}
      {cancelTarget && <WithdrawDialog issue={cancelTarget} onClose={() => setCancelTarget(null)} />}
    </div>
  );
}

// ============================================================
// Request details (read-only) — OT nurse sees issued/consumed once reconciled
// ============================================================

function RequestDetailsDialog({ issue, templateName, onClose }: { issue: OtKitIssue; templateName?: string; onClose: () => void }) {
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
          <div><span className="text-xs text-muted-foreground">Patient</span><div className="font-medium">{issue.patientName ?? '—'}</div></div>
          <div><span className="text-xs text-muted-foreground">MRN</span><div className="font-medium">{issue.patientMrn ?? '—'}</div></div>
          <div><span className="text-xs text-muted-foreground">Kit</span><div className="font-medium">{templateName ?? '—'}</div></div>
          <div><span className="text-xs text-muted-foreground">Issued at</span><div className="font-medium">{issue.issuedAt ? formatDate(issue.issuedAt) : '—'}</div></div>
        </div>

        {(issue.items?.length ?? 0) > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Item</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Issued</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Returned</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Consumed</th>
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
          <p className="text-sm text-muted-foreground">
            Requested — the pharmacy has not issued this kit yet. Items appear once it is issued to the theatre.
          </p>
        )}

        {issue.status === 'reconciled' && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-4 py-2.5 text-sm text-teal-700">
            Reconciled — only the consumed items were billed; unused units were reversed into pharmacy stock.
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
// Withdraw a still-requested kit
// ============================================================

function WithdrawDialog({ issue, onClose }: { issue: OtKitIssue; onClose: () => void }) {
  const cancel = useCancelKit();
  const [reason, setReason] = useState('');

  const submit = () => {
    cancel.mutate(
      { id: issue.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => { toast.success('Kit request withdrawn'); onClose(); },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to withdraw request')),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Kit Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Withdraw kit request <b>{issue.issueNumber}</b>? This is only possible before the pharmacy has issued it.
          </p>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. surgery deferred..." className={TEXTAREA_CLS} />
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
