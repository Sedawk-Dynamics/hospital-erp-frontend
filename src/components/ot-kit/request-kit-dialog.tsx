'use client';

// ============================================================
// Request an OT kit from the pharmacy.
//
// Lived inside the OT nurse's /ot/kits page, which meant the surgeon — the one
// person who knows which preference card a case needs — had no way to raise a
// kit request at all. `POST /ot-kit/issues/request` was already open to any
// authenticated staff; only the UI was missing. Shared now between:
//   • /ot/kits            — OT nurse, free-standing "Request Kit" button
//   • /doctor/ot-list     — surgeon, from the row of their own scheduled case
//
// When `surgery` is supplied the case is fixed (no picker, no patient search)
// and the surgeon's own preference cards float to the top of the kit list.
// ============================================================

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, Loader2, Stethoscope, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';
import { getApiErrorMessage } from '@/lib/utils';
import { useSurgicalTemplates, useRequestKit, type SurgicalTemplate } from '@/hooks/use-ot-kit';
import { useOTRequests, type OTRequest } from '@/hooks/use-ot';
import { usePatientSearch } from '@/hooks/use-hospital';

const TEXTAREA_CLS =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The minimum a case needs to carry to hang a kit request off it. Typed
 * structurally rather than as `OTRequest` so the doctor's `DoctorOTRequest` —
 * the same rows off the same endpoint, declared separately in use-doctor — fits
 * without a cast.
 */
export interface KitSurgery {
  id: string;
  patientId: string;
  patient?: { firstName: string; lastName?: string | null; mrn?: string | null; uhid?: string | null };
  surgeryName?: string | null;
  procedureName?: string | null;
  speciality?: string | null;
  scheduledDate?: string | null;
  surgeonId?: string | null;
}

function surgeryLabel(s: KitSurgery): string {
  const patient = s.patient
    ? `${s.patient.firstName} ${s.patient.lastName ?? ''}`.trim()
    : s.patientId;
  const proc = s.surgeryName ?? s.procedureName ?? 'Surgery';
  const when = s.scheduledDate ? ` · ${formatDate(s.scheduledDate)}` : '';
  return `${patient} · ${proc}${when}`;
}

export interface RequestKitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Fixes the request to one scheduled case — the surgeon opens this from their
   * own OT list row, so there is nothing to pick.
   */
  surgery?: KitSurgery | null;
  /** Pre-fetched preference cards; fetched here when the caller has none. */
  templates?: SurgicalTemplate[];
  onRequested?: () => void;
}

export function RequestKitDialog({
  open,
  onOpenChange,
  surgery,
  templates: templatesProp,
  onRequested,
}: RequestKitDialogProps) {
  // Only fetch what the caller did not already have. The OT nurse's page has
  // the list on screen; the doctor's OT list does not.
  const { data: fetched } = useSurgicalTemplates(undefined, {
    enabled: open && !templatesProp,
  });
  const templates: SurgicalTemplate[] = useMemo(
    () => templatesProp ?? fetched?.items ?? [],
    [templatesProp, fetched],
  );

  // Only needed for the free-standing (non-fixed) case.
  const { data: otData } = useOTRequests(
    { status: 'scheduled', limit: 100 },
    { enabled: open && !surgery },
  );
  const surgeries = useMemo(() => otData?.data ?? [], [otData]);

  const [otRequestId, setOtRequestId] = useState('');
  const [manualPatient, setManualPatient] = useState<{ id: string; name: string; mrn?: string } | null>(
    null,
  );
  const [patientQuery, setPatientQuery] = useState('');
  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const [templateId, setTemplateId] = useState('');
  const [notes, setNotes] = useState('');

  const requestMutation = useRequestKit();

  const selectedSurgery: KitSurgery | null = useMemo(
    () => surgery ?? surgeries.find((s) => s.id === otRequestId) ?? null,
    [surgery, surgeries, otRequestId],
  );

  // Suggest the surgeon's preference card when a surgery is picked.
  const suggestedTemplates = useMemo(() => {
    const active = templates.filter((t) => t.isActive);
    if (!selectedSurgery?.surgeonId) return active;
    const pref = active.filter((t) => t.doctorId === selectedSurgery.surgeonId);
    return pref.length
      ? [...pref, ...active.filter((t) => t.doctorId !== selectedSurgery.surgeonId)]
      : active;
  }, [templates, selectedSurgery]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const resolvedPatient = selectedSurgery
    ? {
        id: selectedSurgery.patientId,
        name:
          `${selectedSurgery.patient?.firstName ?? ''} ${selectedSurgery.patient?.lastName ?? ''}`.trim() ||
          selectedSurgery.patientId,
        mrn: selectedSurgery.patient?.mrn ?? selectedSurgery.patient?.uhid,
      }
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
    if (!templateId) {
      toast.error('Select the surgeon’s preference-card kit');
      return;
    }
    requestMutation.mutate(
      {
        patientId: resolvedPatient.id,
        otRequestId: selectedSurgery?.id || undefined,
        templateId,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Kit requested — sent to the pharmacy');
          onRequested?.();
          handleClose();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to request kit')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request OT Kit</DialogTitle>
          <DialogDescription>
            The pharmacy issues the kit whole to the theatre, then reconciles what was
            actually used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {surgery ? (
            // Fixed case — the surgeon opened this from the row itself.
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground">
                <Stethoscope className="h-3.5 w-3.5" />
                <span className="font-medium">{surgery.surgeryName ?? surgery.procedureName}</span>
              </div>
              <span>{surgeryLabel(surgery)}</span>
            </div>
          ) : (
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
                      {surgeryLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSurgery && (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Stethoscope className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {selectedSurgery.surgeryName ?? selectedSurgery.procedureName}
                    </span>
                  </div>
                  {selectedSurgery.speciality && <span>{selectedSurgery.speciality}</span>}
                </div>
              )}
            </div>
          )}

          {/* Manual patient (only when no surgery is linked) */}
          {!surgery && !otRequestId && (
            <div className="space-y-1.5">
              <Label>Patient {resolvedPatient ? '' : '*'}</Label>
              {manualPatient ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
                  <div>
                    <span className="font-medium">{manualPatient.name}</span>
                    {manualPatient.mrn && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        MRN: {manualPatient.mrn}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setManualPatient(null);
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
                              setManualPatient({
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
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No patients found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Template — required (design doc: the required surgical template is picked) */}
          <div className="space-y-1.5">
            <Label>Surgeon&apos;s preference-card kit *</Label>
            <Select
              value={templateId || null}
              onValueChange={(v: string | null) => setTemplateId(v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the required surgical kit" />
              </SelectTrigger>
              <SelectContent>
                {suggestedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.procedureName ? ` · ${t.procedureName}` : ''}
                    {` · ${t.items?.length ?? 0} item${(t.items?.length ?? 0) === 1 ? '' : 's'}`}
                    {selectedSurgery?.surgeonId && t.doctorId === selectedSurgery.surgeonId
                      ? '  (surgeon preference)'
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestedTemplates.length === 0 ? (
              <p className="text-xs text-amber-600">
                No preference cards yet — the OT nurse or the pharmacy can create one under
                “Preference Cards”.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The kit&apos;s items are the bundle the pharmacy issues whole to the theatre
                (expanded to FEFO batches on issue).
              </p>
            )}

            {/* What is actually IN the kit. A surgeon picking a preference card
                by name alone is trusting a label — this shows the contents so
                they can check before the pharmacy packs it. */}
            {selectedTemplate && <KitContents template={selectedTemplate} />}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for the pharmacy..."
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
            Send Request to Pharmacy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What a preference card contains. Read-only: the card is shared master data
 * maintained by the OT nurse and the pharmacy, so the surgeon checks it here
 * and asks for it to be changed there rather than editing it mid-request.
 */
function KitContents({ template }: { template: SurgicalTemplate }) {
  const items = template.items ?? [];
  return (
    <div className="mt-2 rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-muted-foreground">
          <PackageOpen className="h-3 w-3" /> In this kit
        </span>
        <span className="text-[10px] text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          This preference card has no items yet — the pharmacy would have nothing to pack.
        </p>
      ) : (
        <ul className="max-h-44 divide-y overflow-y-auto">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{i.drugName ?? '—'}</span>
                {i.notes && (
                  <span className="block text-[10px] text-muted-foreground">{i.notes}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs">
                {i.defaultQuantity}
                {i.looseUnitLabel ? ` ${i.looseUnitLabel}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {template.notes && (
        <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">{template.notes}</p>
      )}
    </div>
  );
}
