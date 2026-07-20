'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Eye,
  Ban,
  PackageOpen,
  ClipboardList,
  Boxes,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useSurgicalTemplates,
  useOtKitIssues,
  useIssueKit,
  useReconcileKit,
  useCancelKit,
  type SurgicalTemplate,
  type OtKitIssue,
} from '@/hooks/use-ot-kit';
import { SurgicalTemplatesTab } from '@/components/ot-kit/surgical-templates-tab';

// ============================================================
// Constants + helpers
// ============================================================

const ISSUE_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'issued', label: 'Issued' },
  { key: 'reconciled', label: 'Reconciled' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-300',
  issued: 'bg-blue-100 text-blue-700 border-blue-300',
  reconciled: 'bg-teal-100 text-teal-700 border-teal-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

const inr = (n?: number | null) => (n == null ? '—' : `₹${Number(n).toFixed(2)}`);

const TEXTAREA_CLS =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 border-gray-300',
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}


// ============================================================
// Page
// ============================================================

export default function OtKitsPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-headline text-xl font-bold">OT Kit Fulfilment</h1>
        <p className="text-xs text-muted-foreground">
          Pharmacy side of the OT-Kit workflow. The OT nurse requests a kit (OT → Surgical Kits); here you
          <b> issue</b> it whole into the theatre (transit-lock, unbilled), then after surgery <b>reconcile</b> the
          returned items — Issued − Returned = Consumed, and only the consumed items are billed to the patient.
        </p>
      </div>

      <Tabs defaultValue="issues">
        <TabsList variant="line">
          <TabsTrigger value="issues">
            <PackageOpen className="h-4 w-4" /> Issue &amp; Reconcile
          </TabsTrigger>
          <TabsTrigger value="templates">
            <ClipboardList className="h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <KitIssuesTab />
        </TabsContent>
        <TabsContent value="templates">
          <SurgicalTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Tab 1 — Kit Issues
// ============================================================

function KitIssuesTab() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [issueTarget, setIssueTarget] = useState<OtKitIssue | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<OtKitIssue | null>(null);
  const [viewTarget, setViewTarget] = useState<OtKitIssue | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OtKitIssue | null>(null);

  const { data, isLoading, isError } = useOtKitIssues(
    statusFilter === 'all' ? undefined : { status: statusFilter },
  );
  const issues = data?.items ?? [];

  // Templates: resolve the requested kit's name + items (for the issue dialog).
  const { data: tplData } = useSurgicalTemplates({ includeInactive: true });
  const templateById = useMemo(() => {
    const m = new Map<string, SurgicalTemplate>();
    for (const t of tplData?.items ?? []) m.set(t.id, t);
    return m;
  }, [tplData]);

  return (
    <div className="space-y-4 pt-2">
      {/* Toolbar — requests arrive from the OT nurse; the pharmacy only issues + reconciles. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-56">
          <Select value={statusFilter} onValueChange={(v: string | null) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_STATUS_FILTERS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Kit requests come from the OT nurse (OT → Surgical Kits).
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load kit issues. Please try again.
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                {['Issue #', 'Patient', 'Template', 'Items', 'Status', 'Created', 'Action'].map((h, i) => (
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
                    <p className="mt-2 text-sm text-muted-foreground">Loading kit issues...</p>
                  </td>
                </tr>
              ) : !isError && issues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No kit requests
                      {statusFilter !== 'all' ? ` with "${statusLabel(statusFilter)}" status` : ''}. OT nurses
                      request kits from OT → Surgical Kits; they land here for you to issue.
                    </p>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{issue.issueNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{issue.patientName ?? '—'}</div>
                      {issue.patientMrn && (
                        <div className="text-xs text-muted-foreground">MRN: {issue.patientMrn}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.templateId ? (templateById.get(issue.templateId)?.name ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{issue.items?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(issue.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {issue.status === 'requested' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => setIssueTarget(issue)}
                          >
                            <PackageOpen className="mr-1 h-3.5 w-3.5" />
                            Issue Kit
                          </Button>
                        )}
                        {issue.status === 'issued' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            onClick={() => setReconcileTarget(issue)}
                          >
                            <Boxes className="mr-1 h-3.5 w-3.5" />
                            Reconcile
                          </Button>
                        )}
                        {(issue.status === 'requested' || issue.status === 'issued') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setCancelTarget(issue)}
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" />
                            Cancel
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

      {issueTarget && (
        <IssueKitDialog
          issue={issueTarget}
          template={issueTarget.templateId ? templateById.get(issueTarget.templateId) : undefined}
          onClose={() => setIssueTarget(null)}
        />
      )}
      {reconcileTarget && (
        <ReconcileKitDialog issue={reconcileTarget} onClose={() => setReconcileTarget(null)} />
      )}
      {viewTarget && (
        <IssueDetailsDialog
          issue={viewTarget}
          templateName={viewTarget.templateId ? templateById.get(viewTarget.templateId)?.name : undefined}
          onClose={() => setViewTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelKitDialog issue={cancelTarget} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}

// ============================================================
// Bulk Issue & Transit Lock dialog (design doc III, step 2 — Pharmacy Action)
// The pharmacist picks the pre-packed crate, (optionally) scans the kit's master
// barcode, and issues it: every item leaves active pharmacy stock (FEFO) into the
// Virtual OT Ledger under this patient's OT session — NOT billed yet.
// ============================================================

function IssueKitDialog({
  issue,
  template,
  onClose,
}: {
  issue: OtKitIssue;
  template?: SurgicalTemplate;
  onClose: () => void;
}) {
  const issueMutation = useIssueKit();

  const items = template?.items ?? [];

  const submit = () => {
    // The request already carries the template — issue expands it to FEFO batches.
    issueMutation.mutate(
      { issueId: issue.id },
      {
        onSuccess: () => {
          toast.success(`Kit ${issue.issueNumber} issued — moved to the Virtual OT Ledger (unbilled)`);
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to issue kit'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Issue &amp; Transit Lock — {issue.issueNumber}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          For <b>{issue.patientName ?? '—'}</b>. Pick the pre-packed crate and issue it — every item
          below leaves active pharmacy stock (earliest-expiry / FEFO batch) and moves into the
          <b> Virtual OT Ledger</b> bound to this OT session. It is <b>not billed yet</b>; after surgery you reconcile
          to bill only what was consumed.
        </p>

        {/* Kit contents */}
        {items.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Kit item
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Qty (from active stock)
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{it.drugName ?? it.drugFormularyId}</td>
                    <td className="px-3 py-2 text-right font-mono">{it.defaultQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            <Boxes className="h-4 w-4" />
            This request has no template items to expand — check with the OT nurse.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={issueMutation.isPending || items.length === 0}>
            {issueMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Issue to Theatre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Reconcile dialog — the core "reconcile net" UX
// ============================================================

function ReconcileKitDialog({ issue, onClose }: { issue: OtKitIssue; onClose: () => void }) {
  const reconcile = useReconcileKit();
  const [returns, setReturns] = useState<Record<string, number>>(() =>
    Object.fromEntries((issue.items ?? []).map((i) => [i.id, i.returnedQty ?? 0])),
  );
  const [notes, setNotes] = useState('');

  const setReturn = (itemId: string, issuedQty: number, raw: string) => {
    let v = raw === '' ? 0 : Math.floor(Number(raw));
    if (Number.isNaN(v) || v < 0) v = 0;
    if (v > issuedQty) v = issuedQty;
    setReturns((prev) => ({ ...prev, [itemId]: v }));
  };

  const estimatedBill = useMemo(() => {
    let total = 0;
    let hasPrice = false;
    for (const it of issue.items ?? []) {
      const consumed = it.issuedQty - (returns[it.id] ?? 0);
      if (it.unitPrice != null) {
        hasPrice = true;
        total += consumed * Number(it.unitPrice);
      }
    }
    return hasPrice ? total : null;
  }, [issue.items, returns]);

  const submit = () => {
    reconcile.mutate(
      {
        issueId: issue.id,
        returns: (issue.items ?? []).map((i) => ({ itemId: i.id, returnedQty: returns[i.id] ?? 0 })),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Kit reconciled — consumed items billed, unused units reversed into stock');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to reconcile kit'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post-OT Reconciliation — {issue.issueNumber}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Pull up the OT session and scan/enter the <b>unused</b> items returned to the pharmacy.
          Consumed = Issued − Returned. Net billing posts <b>only the consumed items</b> to the patient&apos;s
          main bill; unused units are reversed back into active pharmacy stock.
        </p>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Item
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Issued
                </th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Returned (unused)
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Consumed
                </th>
              </tr>
            </thead>
            <tbody>
              {(issue.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    This kit has no issued items.
                  </td>
                </tr>
              ) : (
                (issue.items ?? []).map((it) => {
                  const ret = returns[it.id] ?? 0;
                  const consumed = it.issuedQty - ret;
                  return (
                    <tr key={it.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.drugName ?? it.drugFormularyId}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.batchNumber ? `Batch ${it.batchNumber}` : 'No batch (short-issued)'}
                          {it.looseUnitLabel ? ` · ${it.looseUnitLabel}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{it.issuedQty}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <Input
                            type="number"
                            min={0}
                            max={it.issuedQty}
                            value={ret}
                            onChange={(e) => setReturn(it.id, it.issuedQty, e.target.value)}
                            className="w-24 text-right"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-semibold text-teal-600">{consumed}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {estimatedBill != null && (
          <div className="flex items-center justify-between rounded-lg border border-teal-500/30 bg-teal-500/5 px-4 py-2.5 text-sm">
            <span className="font-medium text-teal-700">Estimated bill (consumed only)</span>
            <span className="font-mono font-bold text-teal-700">{inr(estimatedBill)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional reconciliation notes..."
            className={TEXTAREA_CLS}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={reconcile.isPending || (issue.items ?? []).length === 0}>
            {reconcile.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Reconcile & Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Issue details (read-only)
// ============================================================

function IssueDetailsDialog({
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
            <span className="text-xs text-muted-foreground">Template</span>
            <div className="font-medium">{templateName ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Bill</span>
            <div className="font-medium">{issue.billNumber ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Issued at</span>
            <div className="font-medium">{issue.issuedAt ? formatDate(issue.issuedAt) : '—'}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Reconciled at</span>
            <div className="font-medium">{issue.reconciledAt ? formatDate(issue.reconciledAt) : '—'}</div>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Item
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Issued
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Returned
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Consumed
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody>
              {(issue.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No items on this kit.
                  </td>
                </tr>
              ) : (
                (issue.items ?? []).map((it) => {
                  const consumed = it.consumedQty ?? it.issuedQty - (it.returnedQty ?? 0);
                  return (
                    <tr key={it.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.drugName ?? it.drugFormularyId}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.batchNumber ? `Batch ${it.batchNumber}` : 'No batch (short-issued)'}
                          {it.looseUnitLabel ? ` · ${it.looseUnitLabel}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{it.issuedQty}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.returnedQty ?? 0}</td>
                      <td className="px-3 py-2 text-right font-mono">{consumed}</td>
                      <td className="px-3 py-2 text-right font-mono">{inr(it.lineTotal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {issue.notes && (
          <div className="text-sm">
            <span className="text-xs text-muted-foreground">Notes</span>
            <p className="mt-0.5">{issue.notes}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Cancel kit dialog
// ============================================================

function CancelKitDialog({ issue, onClose }: { issue: OtKitIssue; onClose: () => void }) {
  const cancel = useCancelKit();
  const [reason, setReason] = useState('');

  const submit = () => {
    cancel.mutate(
      { id: issue.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Kit cancelled');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to cancel kit'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Kit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cancel kit <b>{issue.issueNumber}</b>? Any reserved/issued stock is released back into inventory.
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
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button variant="destructive" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Cancel Kit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
