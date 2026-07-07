'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Loader2,
  Eye,
  Ban,
  PackageOpen,
  ClipboardList,
  Trash2,
  Pencil,
  X,
  Boxes,
  ScanLine,
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
  useCreateSurgicalTemplate,
  useUpdateSurgicalTemplate,
  useDeleteSurgicalTemplate,
  useOtKitIssues,
  useRequestKit,
  useIssueKit,
  useReconcileKit,
  useCancelKit,
  type SurgicalTemplate,
  type OtKitIssue,
} from '@/hooks/use-ot-kit';
import { useFormulary } from '@/hooks/use-pharmacy';
import { usePatientSearch, useDoctorsList } from '@/hooks/use-hospital';

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

let _uidCounter = 0;
function uid() {
  _uidCounter += 1;
  return `row-${Date.now()}-${_uidCounter}`;
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
          <TemplatesTab />
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
  const [requestOpen, setRequestOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<OtKitIssue | null>(null);
  const [viewTarget, setViewTarget] = useState<OtKitIssue | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OtKitIssue | null>(null);

  const { data, isLoading, isError } = useOtKitIssues(
    statusFilter === 'all' ? undefined : { status: statusFilter },
  );
  const issues = data?.items ?? [];

  // Templates: used both by the request dialog and to resolve template names in the table.
  const { data: tplData } = useSurgicalTemplates({ includeInactive: true });
  const templateName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tplData?.items ?? []) m.set(t.id, t.name);
    return m;
  }, [tplData]);

  const issueMutation = useIssueKit();

  const handleIssue = (issue: OtKitIssue) => {
    issueMutation.mutate(
      { issueId: issue.id },
      {
        onSuccess: () => toast.success(`Kit ${issue.issueNumber} issued to theatre`),
        onError: (err: any) => toast.error(err?.message ?? 'Failed to issue kit'),
      },
    );
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Toolbar */}
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
        {/* Requests normally come from the OT nurse; pharmacy can also raise one on behalf. */}
        <Button variant="outline" onClick={() => setRequestOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Request on behalf
        </Button>
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
                      No kit issues found
                      {statusFilter !== 'all' ? ` with "${statusLabel(statusFilter)}" status` : ''}.
                    </p>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{issue.issueNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{issue.patientName ?? issue.patientId}</div>
                      {issue.patientMrn && (
                        <div className="text-xs text-muted-foreground">MRN: {issue.patientMrn}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {issue.templateId ? (templateName.get(issue.templateId) ?? '—') : '—'}
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
                            onClick={() => handleIssue(issue)}
                            disabled={issueMutation.isPending}
                          >
                            {issueMutation.isPending ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PackageOpen className="mr-1 h-3.5 w-3.5" />
                            )}
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

      <RequestKitDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        templates={tplData?.items ?? []}
      />
      {reconcileTarget && (
        <ReconcileKitDialog issue={reconcileTarget} onClose={() => setReconcileTarget(null)} />
      )}
      {viewTarget && (
        <IssueDetailsDialog
          issue={viewTarget}
          templateName={viewTarget.templateId ? templateName.get(viewTarget.templateId) : undefined}
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
// Request Kit dialog — patient + template + notes
// ============================================================

function RequestKitDialog({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: SurgicalTemplate[];
}) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string; mrn?: string } | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const requestMutation = useRequestKit();

  const reset = () => {
    setPatientQuery('');
    setPatient(null);
    setTemplateId('');
    setNotes('');
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const submit = () => {
    if (!patient) {
      toast.error('Select a patient');
      return;
    }
    requestMutation.mutate(
      {
        patientId: patient.id,
        templateId: templateId || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Kit requested');
          handleClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to request kit'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request OT Kit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                <div>
                  <span className="font-medium">{patient.name}</span>
                  {patient.mrn && (
                    <span className="ml-2 text-xs text-muted-foreground">MRN: {patient.mrn}</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPatient(null);
                    setPatientQuery('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name or MRN..."
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {patientQuery.length >= 2 && (
                  <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                    {patientsLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                      </div>
                    ) : patients && patients.length > 0 ? (
                      patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setPatient({
                              id: p.id,
                              name: `${p.firstName} ${p.lastName ?? ''}`.trim(),
                              mrn: p.mrn ?? undefined,
                            })
                          }
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                        >
                          <span className="font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          {p.mrn && <span className="ml-2 text-muted-foreground">MRN: {p.mrn}</span>}
                          {p.phone && <span className="ml-2 text-muted-foreground">{p.phone}</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No patients found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <Label>Preference-card template</Label>
            <Select
              value={templateId || 'none'}
              onValueChange={(v: string | null) => setTemplateId(v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No template —</SelectItem>
                {templates
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.procedureName ? ` · ${t.procedureName}` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The template's items become the requested kit. It is expanded to FEFO batches when the kit is issued.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this kit..."
              className={TEXTAREA_CLS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={requestMutation.isPending}>
            {requestMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Request Kit
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
          <DialogTitle>Reconcile OT Kit — {issue.issueNumber}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Scan/enter the <b>unused</b> items returned to the pharmacy. Consumed = Issued − Returned. Only
          consumed items are billed to the patient; unused units are reversed into active stock.
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
                        {it.looseUnitLabel && (
                          <div className="text-xs text-muted-foreground">{it.looseUnitLabel}</div>
                        )}
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
            <div className="font-medium">{issue.patientName ?? issue.patientId}</div>
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
            <div className="font-medium">{issue.billId ?? '—'}</div>
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
                        {it.looseUnitLabel && (
                          <div className="text-xs text-muted-foreground">{it.looseUnitLabel}</div>
                        )}
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

// ============================================================
// Tab 2 — Templates (surgical preference cards)
// ============================================================

function TemplatesTab() {
  const [editing, setEditing] = useState<SurgicalTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SurgicalTemplate | null>(null);

  const { data, isLoading, isError } = useSurgicalTemplates({ includeInactive: true });
  const templates = data?.items ?? [];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Preference cards — the default drug/consumable pack a surgeon needs for a procedure.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Template
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load templates. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 px-1 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading templates...
        </div>
      ) : !isError && templates.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No preference-card templates yet. Create one to speed up kit requests.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden"
            >
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-headline text-sm font-bold text-on-surface">{t.name}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[10px]',
                      t.isActive
                        ? 'bg-teal-100 text-teal-700 border-teal-300'
                        : 'bg-gray-100 text-gray-600 border-gray-300',
                    )}
                  >
                    {t.isActive ? 'Active' : 'Retired'}
                  </Badge>
                </div>
                {t.procedureName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.procedureName}</p>
                )}
              </div>
              <div className="flex-1 space-y-1.5 px-4 py-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Boxes className="h-3.5 w-3.5" />
                  {t.items?.length ?? 0} item{(t.items?.length ?? 0) === 1 ? '' : 's'}
                </div>
                {t.kitBarcode && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ScanLine className="h-3.5 w-3.5" />
                    <span className="font-mono">{t.kitBarcode}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 border-t bg-surface-container-low p-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteTarget(t)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Retire
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateDialog
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteTemplateDialog template={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ============================================================
// Template create / edit dialog
// ============================================================

interface TplItemState {
  key: string;
  drugFormularyId: string;
  drugName: string;
  defaultQuantity: number;
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: SurgicalTemplate | null;
  onClose: () => void;
}) {
  const isEdit = !!template;
  const create = useCreateSurgicalTemplate();
  const update = useUpdateSurgicalTemplate();
  const { data: doctors } = useDoctorsList();

  const [name, setName] = useState(template?.name ?? '');
  const [procedureName, setProcedureName] = useState(template?.procedureName ?? '');
  const [doctorId, setDoctorId] = useState(template?.doctorId ?? '');
  const [kitBarcode, setKitBarcode] = useState(template?.kitBarcode ?? '');
  const [notes, setNotes] = useState(template?.notes ?? '');
  const [items, setItems] = useState<TplItemState[]>(() =>
    (template?.items ?? []).map((i) => ({
      key: uid(),
      drugFormularyId: i.drugFormularyId,
      drugName: i.drugName ?? '',
      defaultQuantity: i.defaultQuantity,
    })),
  );

  const doctorOptions = useMemo(
    () =>
      (doctors ?? []).map((d) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim(),
      })),
    [doctors],
  );

  const addItem = () =>
    setItems((prev) => [...prev, { key: uid(), drugFormularyId: '', drugName: '', defaultQuantity: 1 }]);
  const updateItem = (key: string, patch: Partial<TplItemState>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    const filled = items.filter((i) => i.drugFormularyId);
    if (filled.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    if (filled.some((i) => !i.defaultQuantity || i.defaultQuantity <= 0)) {
      toast.error('Every item needs a quantity of at least 1');
      return;
    }

    const input = {
      name: name.trim(),
      procedureName: procedureName.trim() || undefined,
      doctorId: doctorId || undefined,
      kitBarcode: kitBarcode.trim() || undefined,
      notes: notes.trim() || undefined,
      items: filled.map((i) => ({
        drugFormularyId: i.drugFormularyId,
        defaultQuantity: i.defaultQuantity,
      })),
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Template updated' : 'Template created');
      onClose();
    };
    const onError = (err: any) => toast.error(err?.message ?? 'Failed to save template');

    if (isEdit && template) {
      update.mutate({ id: template.id, ...input }, { onSuccess, onError });
    } else {
      create.mutate(input, { onSuccess, onError });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'New Preference-Card Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Rao — Lap Chole Kit"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Procedure</Label>
              <Input
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="e.g. Laparoscopic Cholecystectomy"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Surgeon</Label>
              <Select
                value={doctorId || 'none'}
                onValueChange={(v: string | null) => setDoctorId(v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select surgeon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {doctorOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kit barcode</Label>
              <Input
                value={kitBarcode}
                onChange={(e) => setKitBarcode(e.target.value)}
                placeholder="Optional — scannable kit code"
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kit items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No items yet. Add the drugs/consumables that make up this kit.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <TemplateItemRow
                    key={item.key}
                    item={item}
                    onChange={(patch) => updateItem(item.key, patch)}
                    onRemove={() => removeItem(item.key)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this template..."
              className={TEXTAREA_CLS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// One template item row = drug picker + quantity + remove.
function TemplateItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: TplItemState;
  onChange: (patch: Partial<TplItemState>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const fq = useFormulary({ search: search.trim() || undefined });
  const drugs = fq.data?.data ?? [];

  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          {item.drugFormularyId ? (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
              <span className="text-sm font-medium">{item.drugName || item.drugFormularyId}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => onChange({ drugFormularyId: '', drugName: '' })}
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search drug / consumable..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {fq.isLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                    </div>
                  ) : drugs.length > 0 ? (
                    drugs.slice(0, 8).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onChange({ drugFormularyId: d.id, drugName: d.drugName });
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && <span className="ml-2 text-xs text-muted-foreground">{d.strength}</span>}
                        {d.genericName && (
                          <span className="ml-2 text-xs text-muted-foreground">{d.genericName}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No drugs found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="w-24">
          <Input
            type="number"
            min={1}
            value={item.defaultQuantity}
            onChange={(e) => onChange({ defaultQuantity: Math.max(1, Math.floor(Number(e.target.value) || 0)) })}
            className="text-right"
            aria-label="Quantity"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-red-600"
          onClick={onRemove}
          title="Remove item"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Delete / retire template
// ============================================================

function DeleteTemplateDialog({ template, onClose }: { template: SurgicalTemplate; onClose: () => void }) {
  const del = useDeleteSurgicalTemplate();

  const submit = () => {
    del.mutate(template.id, {
      onSuccess: () => {
        toast.success('Template retired');
        onClose();
      },
      onError: (err: any) => toast.error(err?.message ?? 'Failed to retire template'),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retire Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Retire <b>{template.name}</b>? It will no longer be selectable for new kit requests. Existing kit
          issues are unaffected.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button variant="destructive" onClick={submit} disabled={del.isPending}>
            {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Retire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
