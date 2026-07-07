'use client';

// ============================================================
// OT module — Surgical Kit REQUESTS (design doc III, "Pre-Op Template Request").
// This is the OT NURSE side of the OT-Kit workflow: pick a scheduled surgery +
// the surgeon's preference-card template and send a bulk request to the pharmacy,
// then track it as the pharmacy issues (transit-locks) and later reconciles/
// net-bills it. Issuing, reconciling and editing templates all live on the
// PHARMACY side (/pharmacy/ot-kits) — the OT nurse only requests & tracks.
// ============================================================

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
  Boxes,
  ScanLine,
  Stethoscope,
  ArrowRight,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useSurgicalTemplates,
  useOtKitIssues,
  useRequestKit,
  useCancelKit,
  type SurgicalTemplate,
  type OtKitIssue,
} from '@/hooks/use-ot-kit';
import { useOTRequests, type OTRequest } from '@/hooks/use-ot';
import { usePatientSearch } from '@/hooks/use-hospital';

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

const inr = (n?: number | null) => (n == null ? '—' : `₹${Number(n).toFixed(2)}`);

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
          <PreferenceCardsTab />
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
                      <div className="font-medium text-foreground">{issue.patientName ?? issue.patientId}</div>
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
// Request Kit dialog — pick a scheduled surgery (or a patient) + template
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
  // Scheduled surgeries the nurse can attach a kit to.
  const { data: otData } = useOTRequests({ status: 'scheduled', limit: 100 });
  const surgeries = otData?.data ?? [];

  const [otRequestId, setOtRequestId] = useState('');
  const [manualPatient, setManualPatient] = useState<{ id: string; name: string; mrn?: string } | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const [templateId, setTemplateId] = useState('');
  const [notes, setNotes] = useState('');

  const requestMutation = useRequestKit();

  const selectedSurgery = useMemo(
    () => surgeries.find((s) => s.id === otRequestId) ?? null,
    [surgeries, otRequestId],
  );

  // Suggest the surgeon's preference card when a surgery is picked.
  const suggestedTemplates = useMemo(() => {
    const active = templates.filter((t) => t.isActive);
    if (!selectedSurgery?.surgeonId) return active;
    const pref = active.filter((t) => t.doctorId === selectedSurgery.surgeonId);
    return pref.length ? [...pref, ...active.filter((t) => t.doctorId !== selectedSurgery.surgeonId)] : active;
  }, [templates, selectedSurgery]);

  const resolvedPatient = selectedSurgery
    ? { id: selectedSurgery.patientId, name: `${selectedSurgery.patient?.firstName ?? ''} ${selectedSurgery.patient?.lastName ?? ''}`.trim() || selectedSurgery.patientId, mrn: selectedSurgery.patient?.mrn ?? selectedSurgery.patient?.uhid }
    : manualPatient;

  const reset = () => {
    setOtRequestId('');
    setManualPatient(null);
    setPatientQuery('');
    setTemplateId('');
    setNotes('');
  };
  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const submit = () => {
    if (!resolvedPatient) {
      toast.error('Select a scheduled surgery or a patient');
      return;
    }
    requestMutation.mutate(
      {
        patientId: resolvedPatient.id,
        otRequestId: otRequestId || undefined,
        templateId: templateId || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Kit requested — sent to the pharmacy');
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
          {/* Scheduled surgery */}
          <div className="space-y-1.5">
            <Label>Scheduled surgery</Label>
            <Select
              value={otRequestId || 'none'}
              onValueChange={(v: string | null) => {
                setOtRequestId(v === 'none' ? '' : (v ?? ''));
                if (v && v !== 'none') setManualPatient(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a scheduled surgery" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not linked to a scheduled surgery —</SelectItem>
                {surgeries.map((s: OTRequest) => (
                  <SelectItem key={s.id} value={s.id}>
                    {(s.patient ? `${s.patient.firstName} ${s.patient.lastName ?? ''}`.trim() : s.patientId)} · {s.surgeryName ?? s.procedureName}
                    {s.scheduledDate ? ` · ${formatDate(s.scheduledDate)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSurgery && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span className="font-medium">{selectedSurgery.surgeryName ?? selectedSurgery.procedureName}</span>
                </div>
                {selectedSurgery.speciality && <span>{selectedSurgery.speciality}</span>}
              </div>
            )}
          </div>

          {/* Manual patient (only when no surgery is linked) */}
          {!otRequestId && (
            <div className="space-y-1.5">
              <Label>Patient {resolvedPatient ? '' : '*'}</Label>
              {manualPatient ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                  <div>
                    <span className="font-medium">{manualPatient.name}</span>
                    {manualPatient.mrn && <span className="ml-2 text-xs text-muted-foreground">MRN: {manualPatient.mrn}</span>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setManualPatient(null); setPatientQuery(''); }}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by patient name or MRN..." value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} className="pl-9" />
                  </div>
                  {patientQuery.length >= 2 && (
                    <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                      {patientsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Searching...</div>
                      ) : patients && patients.length > 0 ? (
                        patients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setManualPatient({ id: p.id, name: `${p.firstName} ${p.lastName ?? ''}`.trim(), mrn: p.mrn ?? undefined })}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                          >
                            <span className="font-medium">{p.firstName} {p.lastName}</span>
                            {p.mrn && <span className="ml-2 text-muted-foreground">MRN: {p.mrn}</span>}
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
          )}

          {/* Template */}
          <div className="space-y-1.5">
            <Label>Preference-card kit</Label>
            <Select value={templateId || 'none'} onValueChange={(v: string | null) => setTemplateId(v === 'none' ? '' : (v ?? ''))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a kit template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No template (pharmacy builds it) —</SelectItem>
                {suggestedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.procedureName ? ` · ${t.procedureName}` : ''}
                    {selectedSurgery?.surgeonId && t.doctorId === selectedSurgery.surgeonId ? '  (surgeon preference)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The kit&apos;s items are the bundle the pharmacy issues to the theatre (expanded to FEFO batches at issue).
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the pharmacy..." className={TEXTAREA_CLS} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={requestMutation.isPending}>
            {requestMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Send Request to Pharmacy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <div><span className="text-xs text-muted-foreground">Patient</span><div className="font-medium">{issue.patientName ?? issue.patientId}</div></div>
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
        onError: (err: any) => toast.error(err?.message ?? 'Failed to withdraw request'),
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

// ============================================================
// Tab 2 — Preference Cards (READ-ONLY reference; CRUD lives in Pharmacy)
// ============================================================

function PreferenceCardsTab() {
  const { data, isLoading, isError } = useSurgicalTemplates();
  const templates = data?.items ?? [];

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-muted-foreground">
        The surgeon preference cards you can request. Cards are maintained by the pharmacy (Pharmacy → OT Kits → Templates).
      </p>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Failed to load preference cards.</div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 px-1 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading preference cards...
        </div>
      ) : !isError && templates.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No preference cards yet. Ask the pharmacy to create one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
              <div className="p-4 pb-2">
                <h3 className="truncate font-headline text-sm font-bold text-on-surface">{t.name}</h3>
                {t.procedureName && <p className="mt-0.5 text-xs text-muted-foreground">{t.procedureName}</p>}
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
                {(t.items?.length ?? 0) > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {t.items!.slice(0, 6).map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span className="truncate">{i.drugName ?? i.drugFormularyId}</span>
                        <span className="font-mono shrink-0">× {i.defaultQuantity}</span>
                      </li>
                    ))}
                    {(t.items?.length ?? 0) > 6 && <li className="italic">+ {(t.items!.length - 6)} more…</li>}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
