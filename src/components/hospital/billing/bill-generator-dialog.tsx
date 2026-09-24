'use client';

// ───────────────────────────────────────────────────────────────────────
// Bill Generator Dialog (Week 11 — Hospital Billing > Billing tab)
//
// Front-desk workflow:
//   1. Pick a patient (search).
//   2. Create a draft bill (or pick an existing draft for the patient).
//   3. Auto-pull charges from clinical sources (consultation/lab/pharmacy
//      /imaging/room) — each tab shows unbilled items with checkbox select.
//   4. Add manual line items (description + qty + unit price + tax).
//   5. Apply concession/discount (% or fixed) with a reason.
//   6. Finalize → bill moves from draft → pending and is ready for payment.
// ───────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentBadge, TreatmentBadge } from '@/components/hospital/gst/gst-badges';
import { useGstProfile } from '@/hooks/use-gst-profile';
import { toast } from 'sonner';
import {
  Loader2, Search, Plus, Trash2, Stethoscope, FlaskConical, Pill, Scan, BedDouble,
  Percent, IndianRupee, FileCheck2, CheckCircle2, X, Undo2, Pencil, Check, Printer,
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { BillPrintDialog } from '@/components/hospital/billing/bill-print-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { cn, getApiErrorMessage } from '@/lib/utils';

import {
  usePatientSearch,
  useCreateBill,
  useBill,
  useBills,
  usePatientCharges,
  usePullCharges,
  useAddBillItem,
  useRefreshDraftTax,
  useRemoveBillItem,
  useUpdateBillItem,
  useSetBillDiscount,
  useFinalizeBill,
  useReopenBill,
  openBillDocumentPdf,
  type ChargeRow,
  type ChargeSource,
} from '@/hooks/use-hospital';

interface BackendBill {
  id: string;
  billNumber: string;
  status: string;
  subtotal?: string | number;
  discountAmount?: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
  amountPaid?: string | number;
  balanceDue?: string | number;
  /** Decided by the API from payment + TPA state, not guessed from amountPaid. */
  canReopen?: boolean;
  reopenBlockedReason?: string | null;
  billItems?: BillLineItem[];
  patient?: { id: string; firstName: string; lastName: string; mrn?: string | null };
  // What this bill IS under GST, once it has been finalised and issued.
  gstDocumentType?: string | null;
  invoiceNumber?: string | null;
  taxableValue?: string | number;
  cgstAmount?: string | number;
  sgstAmount?: string | number;
  igstAmount?: string | number;
}

interface BillGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a patient (e.g. from OP List quick-bill action). */
  initialPatient?: { id: string; firstName: string; lastName: string; mrn?: string | null } | null;
  /** Resume an existing draft bill. */
  initialBillId?: string | null;
  /**
   * Set when this bill belongs to an IP / Emergency / Day Care stay, which
   * decides WHICH document Print Bill renders: the branded stay document
   * (/billing/admissions/:id/bill-document) for a stay, or the counter bill
   * (/billing/:id/document) for an OP bill. Both are printable — the OP one
   * only became so once it stopped depending on a payment existing first.
   */
  admissionId?: string | null;
  onBillFinalized?: (billId: string) => void;
}

const fmt = (n: number | undefined | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const SOURCE_TABS: { key: ChargeSource; label: string; icon: typeof Stethoscope }[] = [
  { key: 'all', label: 'All', icon: FileCheck2 },
  { key: 'consultation', label: 'Doctor', icon: Stethoscope },
  { key: 'lab', label: 'Lab', icon: FlaskConical },
  { key: 'pharmacy', label: 'Pharmacy', icon: Pill },
  { key: 'imaging', label: 'Imaging', icon: Scan },
  { key: 'room', label: 'Room', icon: BedDouble },
];

export function BillGeneratorDialog({
  open,
  onOpenChange,
  initialPatient,
  initialBillId,
  admissionId,
  onBillFinalized,
}: BillGeneratorDialogProps) {
  // The internal state is keyed by the open session — every re-open of the
  // dialog mounts a fresh <BillGeneratorBody/> with the latest initial props,
  // which sidesteps the "setState in effect" pattern we'd otherwise need
  // to re-seed step/patient/billId.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[92rem] w-[96vw] max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Bill</DialogTitle>
          <DialogDescription>
            Auto-pull charges from consultations, lab, pharmacy, imaging and room,
            add manual lines, apply discount and finalize.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BillGeneratorBody
            key={`${initialBillId ?? ''}|${initialPatient?.id ?? ''}`}
            initialPatient={initialPatient ?? null}
            initialBillId={initialBillId ?? null}
            admissionId={admissionId ?? null}
            onClose={() => onOpenChange(false)}
            onBillFinalized={onBillFinalized}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BillGeneratorBody({
  initialPatient,
  initialBillId,
  admissionId,
  onClose,
  onBillFinalized,
}: {
  initialPatient: { id: string; firstName: string; lastName: string; mrn?: string | null } | null;
  initialBillId: string | null;
  admissionId: string | null;
  onClose: () => void;
  onBillFinalized?: (billId: string) => void;
}) {
  const [step, setStep] = useState<'pickPatient' | 'compose'>(
    initialBillId || initialPatient ? 'compose' : 'pickPatient',
  );
  const [patient, setPatient] = useState<{
    id: string; firstName: string; lastName: string; mrn?: string | null;
  } | null>(
    initialPatient
      ? {
          id: initialPatient.id,
          firstName: initialPatient.firstName,
          lastName: initialPatient.lastName,
          mrn: initialPatient.mrn,
        }
      : null,
  );
  const [billId] = useState<string | null>(initialBillId);
  const [patientSearch, setPatientSearch] = useState('');

  return (
    <>
        {step === 'pickPatient' && (
          <PatientPickerStep
            search={patientSearch}
            onSearch={setPatientSearch}
            onPick={(p) => {
              setPatient(p);
              setStep('compose');
            }}
          />
        )}

        {step === 'compose' && patient && (
          <ComposeStep
            patient={patient}
            initialBillId={billId}
            admissionId={admissionId}
            onClose={onClose}
            onFinalized={(id) => {
              toast.success('Bill finalized');
              onBillFinalized?.(id);
              onClose();
            }}
          />
        )}

        {step === 'compose' && !patient && billId && (
          <ResolveBillPatient
            billId={billId}
            onResolved={(p) => setPatient(p)}
          />
        )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 1: Patient picker (search + click-to-select)
// ────────────────────────────────────────────────────────────────────────

function PatientPickerStep({
  search,
  onSearch,
  onPick,
}: {
  search: string;
  onSearch: (s: string) => void;
  onPick: (p: { id: string; firstName: string; lastName: string; mrn?: string | null }) => void;
}) {
  const { data: results, isLoading } = usePatientSearch(search);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search by name, MRN or phone..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-[55vh] overflow-y-auto rounded-xl border bg-surface-container-lowest">
        {search.length < 2 ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            Type at least 2 characters to search.
          </p>
        ) : isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            <Loader2 className="inline h-4 w-4 animate-spin" /> Searching...
          </p>
        ) : !results || results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            No patients found.
          </p>
        ) : (
          <ul className="divide-y divide-surface-container/60">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-label text-sm font-bold">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="font-label text-xs text-on-surface-variant">
                        MRN {p.mrn ?? '-'} · {p.phone ?? '-'}
                      </p>
                    </div>
                    <span className="text-xs text-primary font-bold">Select →</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Helper: hydrate the patient object from an existing draft bill (when the
// dialog is opened by clicking a row in the Draft list).
function ResolveBillPatient({
  billId,
  onResolved,
}: {
  billId: string;
  onResolved: (p: { id: string; firstName: string; lastName: string; mrn?: string | null }) => void;
}) {
  const { data: bill } = useBill(billId);
  useEffect(() => {
    if (bill?.patient) {
      onResolved({
        id: bill.patient.id,
        firstName: bill.patient.firstName,
        lastName: bill.patient.lastName,
        mrn: bill.patient.mrn,
      });
    }
  }, [bill, onResolved]);
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 2: Compose — left column charges/lines, right column summary
// ────────────────────────────────────────────────────────────────────────

function ComposeStep({
  patient,
  initialBillId,
  admissionId,
  onClose,
  onFinalized,
}: {
  patient: { id: string; firstName: string; lastName: string; mrn?: string | null };
  initialBillId: string | null;
  admissionId: string | null;
  onClose: () => void;
  onFinalized: (billId: string) => void;
}) {
  const [activeSource, setActiveSource] = useState<ChargeSource>('all');
  const [billId, setBillId] = useState<string | null>(initialBillId);
  const [selectedRefs, setSelectedRefs] = useState<Record<string, ChargeRow>>({});
  const [printOpen, setPrintOpen] = useState(false);
  const [printingOp, setPrintingOp] = useState(false);

  // Reuse an existing draft for this patient if one is already there — keeps
  // the workflow idempotent (e.g. cashier re-opens the dialog).
  const { data: existingBills } = useBills({
    patientId: patient.id,
    status: 'draft',
    limit: 1,
  });
  const createBill = useCreateBill();

  // Effective bill ID: prefer the one already in state (set by mutation
  // onSuccess), otherwise the first draft already on file for the patient.
  // We avoid setState-in-effect by deriving this on render.
  const effectiveBillId = billId ?? existingBills?.data?.[0]?.id ?? null;

  const createBillRequestedRef = useRef(false);
  useEffect(() => {
    // Only kick off auto-create when the search has settled, there's no
    // existing draft and we haven't already requested one in this session.
    if (effectiveBillId) return;
    // NEVER auto-create for a stay. createBill makes a plain OP bill with no
    // admissionId, which would sit outside the admission's ledger and split the
    // stay across two bills. An admission always arrives with its running bill
    // (getIpAdmissionsForBilling ensures one), so this is a guard, not a path.
    if (admissionId) return;
    if (!existingBills) return;
    if (existingBills.data && existingBills.data.length > 0) return;
    if (createBillRequestedRef.current) return;
    createBillRequestedRef.current = true;
    createBill.mutate(
      { patientId: patient.id, items: [] },
      {
        onSuccess: (b) => {
          if (b?.id) setBillId(b.id);
        },
        onError: () => toast.error('Could not create draft bill'),
      },
    );
  }, [effectiveBillId, existingBills, createBill, patient.id, admissionId]);

  const { data: bill, isLoading: billLoading } = useBill(effectiveBillId ?? '');
  const billTyped = (bill as unknown) as BackendBill | null;
  const { data: charges, isLoading: chargesLoading } = usePatientCharges(
    patient.id ? { patientId: patient.id, source: activeSource } : null,
  );

  const pullCharges = usePullCharges();
  const refreshDraftTax = useRefreshDraftTax();
  const addBillItem = useAddBillItem();
  const removeBillItem = useRemoveBillItem();
  const updateBillItem = useUpdateBillItem();
  const setBillDiscount = useSetBillDiscount();
  const finalizeBill = useFinalizeBill();
  const reopenBill = useReopenBill();

  const handleToggle = useCallback((row: ChargeRow) => {
    const key = `${row.referenceType}:${row.referenceId}`;
    setSelectedRefs((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = row;
      return next;
    });
  }, []);

  // Re-decide the tax when a DRAFT is opened.
  //
  // A draft's lines keep whatever they were stamped with when they were added,
  // so every correction made since is invisible on it — a room pulled while
  // the browser was dropping its daily rate went on reading "at or below the
  // ₹5,000/day threshold" on a ₹10,000/day room, and medicines added before
  // their HSN codes were filled in still carried no code.
  //
  // Once per draft per opening: keyed on the bill so re-renders do not re-fire
  // it, and the server refuses anything past draft so a document is untouched.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = effectiveBillId;
    if (!open || !id || billTyped?.status !== 'draft') return;
    if (refreshedFor.current === id) return;
    refreshedFor.current = id;
    refreshDraftTax.mutate(id);
    // `refreshDraftTax` is a stable mutation object; including it would re-run
    // this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveBillId, billTyped?.status]);

  const handlePull = useCallback(async () => {
    const items = Object.values(selectedRefs);
    if (!effectiveBillId || items.length === 0) return;
    try {
      const res = await pullCharges.mutateAsync({
        billId: effectiveBillId,
        // Everything the tax rules need, not just the money.
        //
        // This used to rebuild each row from seven fields, which threw away
        // every fact the server had worked out about the supply — and the
        // server then re-resolved the line with almost nothing. A ₹10,000/day
        // room came back EXEMPT because `dailyRate` never arrived, so the room
        // rule saw zero and put it under the ₹5,000 threshold.
        charges: items.map((c) => ({
          referenceType: c.referenceType,
          referenceId: c.referenceId,
          description: c.description,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          taxRate: c.taxRate,
          category: c.category,
          // The supply's own identity and classification.
          hsnCode: c.hsnCode,
          sacCode: c.sacCode,
          gstTreatment: c.gstTreatment,
          gstApproved: c.gstApproved,
          taxInclusive: c.taxInclusive,
          // The context it was supplied in.
          patientAdmitted: c.patientAdmitted,
          issuedForTreatment: c.issuedForTreatment,
          isTakeHome: c.isTakeHome,
          isCosmetic: c.isCosmetic,
          // What the room rule is judged on.
          dailyRate: c.dailyRate,
          bedType: c.bedType,
          wardType: c.wardType,
        })),
      });
      // Anything the server refused was already billed elsewhere — usually the
      // lab or radiology counter charged it when they accepted the order. Say
      // which, or the total is quietly short and the desk re-adds it by hand.
      const skipped = res?.skipped ?? [];
      if (skipped.length) {
        toast.warning(
          `${skipped.length} charge(s) are already on another bill and were not added: ${skipped.join(', ')}`,
        );
      }
      if (res?.added || !skipped.length) {
        toast.success(`${res?.added ?? items.length} item(s) added to bill`);
      }
      setSelectedRefs({});
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to pull charges');
    }
  }, [effectiveBillId, selectedRefs, pullCharges]);

  const handleAddManual = useCallback(
    async (data: { description: string; quantity: number; unitPrice: number; discount: number }) => {
      if (!effectiveBillId || billTyped?.status !== 'draft') {
        toast.error(
          effectiveBillId
            ? 'Reopen this bill before adding another charge'
            : 'The draft bill is still being prepared',
        );
        return false;
      }
      try {
        await addBillItem.mutateAsync({
          billId: effectiveBillId,
          data: {
            description: data.description,
            quantity: data.quantity,
            unitPrice: data.unitPrice,
            discount: data.discount,
          },
        });
        toast.success('Line added');
        return true;
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e, 'Failed to add line'));
        return false;
      }
    },
    [effectiveBillId, billTyped?.status, addBillItem],
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
      if (!effectiveBillId) return;
      try {
        await removeBillItem.mutateAsync({ billId: effectiveBillId, itemId });
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to remove line');
      }
    },
    [effectiveBillId, removeBillItem],
  );

  const handleUpdateItem = useCallback(
    async (itemId: string, data: { description?: string; quantity?: number; unitPrice?: number; discount?: number }) => {
      if (!effectiveBillId) return;
      try {
        await updateBillItem.mutateAsync({ billId: effectiveBillId, itemId, data });
        toast.success('Line updated');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to update line');
      }
    },
    [effectiveBillId, updateBillItem],
  );

  const handleSetDiscount = useCallback(
    async (discountType: 'percentage' | 'fixed', discountValue: number, reason: string) => {
      if (!effectiveBillId) return;
      try {
        await setBillDiscount.mutateAsync({
          billId: effectiveBillId,
          data: { discountType, discountValue, reason: reason || undefined },
        });
        toast.success(discountValue > 0 ? 'Discount applied' : 'Discount cleared');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to apply discount');
      }
    },
    [effectiveBillId, setBillDiscount],
  );

  // Finalized by mistake? While nothing has been collected the bill can go back
  // to draft so the missing items land on the SAME bill instead of forcing the
  // counter to abandon it and start a fresh one.
  const handleReopen = useCallback(async () => {
    if (!effectiveBillId) return;
    try {
      await reopenBill.mutateAsync(effectiveBillId);
      toast.success('Bill reopened — you can add items again');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to reopen bill'));
    }
  }, [effectiveBillId, reopenBill]);

  const handleFinalize = useCallback(async () => {
    if (!effectiveBillId) return;
    try {
      await finalizeBill.mutateAsync(effectiveBillId);
      onFinalized(effectiveBillId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to finalize');
    }
  }, [effectiveBillId, finalizeBill, onFinalized]);

  // Reopen eligibility comes from the server because amountPaid alone is not
  // enough: a TPA split can leave it at zero while a claim or applied admission
  // advance still makes the issued bill immutable.
  const isPendingFinalized = billTyped?.status === 'pending';
  const isFinalizedEditable =
    isPendingFinalized &&
    (billTyped?.canReopen ?? Number(billTyped?.amountPaid ?? 0) === 0);

  const selectedCount = Object.keys(selectedRefs).length;
  const selectedTotal = Object.values(selectedRefs).reduce((s, c) => s + c.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Patient strip */}
      <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Patient</p>
          <p className="font-display text-lg font-bold">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="font-label text-xs text-on-surface-variant">MRN {patient.mrn ?? '-'}</p>
        </div>
        <div className="text-right">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Bill #</p>
          <p className="font-label text-sm font-bold">{billTyped?.billNumber ?? '...'}</p>
          <p className="font-label text-[10px] text-on-surface-variant">
            Status: <span className="font-bold">{billTyped?.status ?? 'draft'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Auto-pull charges + manual line add + line items */}
        <div className="lg:col-span-2 space-y-4">
          <ChargesPanel
            activeSource={activeSource}
            onSourceChange={setActiveSource}
            charges={charges?.charges ?? []}
            summary={charges?.summary}
            loading={chargesLoading}
            selectedRefs={selectedRefs}
            onToggle={handleToggle}
            onPullAll={(rows) => {
              const next: Record<string, ChargeRow> = {};
              // Select All means "everything this counter may bill" — it used
              // to sweep in rows whose own checkbox is disabled, so the server
              // then refused them and the count came up short.
              for (const r of rows) {
                if (r.alreadyBilled || r.pullable === false) continue;
                next[`${r.referenceType}:${r.referenceId}`] = r;
              }
              setSelectedRefs(next);
            }}
            onPullSelected={handlePull}
            pulling={pullCharges.isPending}
            selectedCount={selectedCount}
            selectedTotal={selectedTotal}
          />

          <ManualLineForm
            onAdd={handleAddManual}
            loading={addBillItem.isPending}
            disabled={!effectiveBillId || billLoading || billTyped?.status !== 'draft'}
            disabledReason={
              !effectiveBillId || billLoading || !billTyped
                ? 'Preparing the draft bill…'
                : billTyped.status !== 'draft'
                  ? isFinalizedEditable
                    ? 'Reopen this bill before adding another charge.'
                    : billTyped.reopenBlockedReason ?? 'Manual charges can only be added to a draft bill.'
                  : undefined
            }
          />

          <BillLinesPanel
            items={billTyped?.billItems ?? []}
            loading={billLoading || !effectiveBillId}
            onRemove={handleRemove}
            removing={removeBillItem.isPending}
            onUpdate={handleUpdateItem}
            updating={updateBillItem.isPending}
            editable={billTyped?.status === 'draft'}
          />
        </div>

        {/* RIGHT: Discount + summary + actions */}
        <div className="space-y-4">
          <DiscountPanel
            bill={billTyped ?? null}
            onApply={handleSetDiscount}
            loading={setBillDiscount.isPending}
          />
          <BillSummaryPanel bill={billTyped ?? null} />
          <div className="flex flex-col gap-2">
            {isPendingFinalized ? (
              isFinalizedEditable ? (
                <>
                  <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 font-label text-[11px] text-amber-800">
                    This bill is finalized. Reopen it to add or remove items — allowed
                    because nothing has been collected against it yet.
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={reopenBill.isPending}
                    onClick={handleReopen}
                  >
                    {reopenBill.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reopening...</>
                    ) : (
                      <><Undo2 className="mr-2 h-4 w-4" /> Reopen Bill for Editing</>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="rounded-lg bg-surface-container-low border border-outline-variant px-3 py-2 font-label text-[11px] text-on-surface-variant">
                    {billTyped?.reopenBlockedReason ?? 'This finalized bill cannot be reopened.'}
                  </p>
                  <Button className="w-full" variant="outline" disabled>
                    <Undo2 className="mr-2 h-4 w-4" /> Reopen unavailable
                  </Button>
                </>
              )
            ) : (
              <Button
                className="w-full"
                disabled={!billTyped || billTyped.status !== 'draft' || (billTyped.billItems?.length ?? 0) === 0 || finalizeBill.isPending}
                onClick={handleFinalize}
              >
                {finalizeBill.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Finalize Bill</>
                )}
              </Button>
            )}
            {/* Print the branded bill. A stay gets the admission document —
                interim while the patient is admitted, final after. An OP bill
                gets its own copy, which used to be impossible: the only
                printable form was the receipt, and that exists per PAYMENT, so
                a patient leaving with an unpaid bill had nothing to take. */}
            {admissionId ? (
              <Button variant="outline" className="w-full gap-1.5" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4" /> Print Bill
              </Button>
            ) : (
              billTyped &&
              billTyped.status !== 'draft' && (
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={printingOp}
                  onClick={async () => {
                    setPrintingOp(true);
                    try {
                      await openBillDocumentPdf(billTyped.id);
                    } catch (e) {
                      toast.error(getApiErrorMessage(e, 'Could not open the bill'));
                    } finally {
                      setPrintingOp(false);
                    }
                  }}
                >
                  {printingOp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print Bill
                </Button>
              )
            )}
            <Button variant="outline" onClick={onClose}>
              {billTyped?.status === 'draft' ? 'Close (keep as draft)' : 'Close'}
            </Button>
          </div>
        </div>
      </div>

      {admissionId && (
        <BillPrintDialog admissionId={admissionId} open={printOpen} onOpenChange={setPrintOpen} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Charges panel: tabs across sources + selectable rows
// ────────────────────────────────────────────────────────────────────────

function ChargesPanel({
  activeSource,
  onSourceChange,
  charges,
  summary,
  loading,
  selectedRefs,
  onToggle,
  onPullAll,
  onPullSelected,
  pulling,
  selectedCount,
  selectedTotal,
}: {
  activeSource: ChargeSource;
  onSourceChange: (s: ChargeSource) => void;
  charges: ChargeRow[];
  summary?: {
    consultation: number; lab: number; pharmacy: number;
    imaging: number; room: number; grandTotal: number; count: number;
  };
  loading: boolean;
  selectedRefs: Record<string, ChargeRow>;
  onToggle: (row: ChargeRow) => void;
  onPullAll: (rows: ChargeRow[]) => void;
  onPullSelected: () => void;
  pulling: boolean;
  selectedCount: number;
  selectedTotal: number;
}) {
  return (
    <div className="rounded-xl border bg-surface-container-lowest">
      <div className="flex items-center gap-1 border-b border-surface-container p-1 overflow-x-auto">
        {SOURCE_TABS.map((tab) => {
          const Icon = tab.icon;
          const total = tab.key === 'all'
            ? summary?.grandTotal
            : summary?.[tab.key as keyof typeof summary] as number | undefined;
          const active = activeSource === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSourceChange(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap',
                active
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {total ? (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  active ? 'bg-on-primary/10 text-on-primary' : 'bg-primary/10 text-primary',
                )}>{fmt(total)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 flex flex-wrap items-center gap-2 border-b border-surface-container">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPullAll(charges)}
          disabled={!charges.length}
          className="text-xs"
        >
          Select All
        </Button>
        <Button
          size="sm"
          onClick={onPullSelected}
          disabled={selectedCount === 0 || pulling}
          className="text-xs"
        >
          {pulling ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Adding...</>
          ) : (
            <>Add {selectedCount > 0 ? `${selectedCount} item(s) — ${fmt(selectedTotal)}` : 'selected'}</>
          )}
        </Button>
        {summary?.count !== undefined && (
          <span className="ml-auto text-xs text-on-surface-variant">
            {summary.count} unbilled item(s)
          </span>
        )}
      </div>

      <div className="max-h-[42vh] overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            <Loader2 className="inline h-4 w-4 animate-spin" /> Loading charges...
          </p>
        ) : charges.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            Nothing to bill yet from this source.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-container-lowest">
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/40">
              {charges.map((row) => {
                const key = `${row.referenceType}:${row.referenceId}`;
                const checked = !!selectedRefs[key];
                // The department owns this charge, not this counter.
                const locked = row.pullable === false;
                return (
                  <tr
                    key={key}
                    className={cn(
                      'hover:bg-surface-container-low transition-colors',
                      (row.alreadyBilled || locked) && 'opacity-50',
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={row.alreadyBilled || locked}
                        onChange={() => onToggle(row)}
                        className="h-4 w-4 rounded accent-primary"
                        title={locked ? row.notPullableReason : undefined}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-label text-sm">{row.description}</p>
                      <p className="font-label text-[10px] text-on-surface-variant">
                        {row.source} · {row.occurredAt}
                        {row.alreadyBilled && <span className="ml-2 text-secondary font-bold">already billed</span>}
                        {/* Lab and radiology bill their own work — an OP patient
                            pays at their counter, an admitted one has it posted
                            to the stay ledger when they accept. Saying so beats
                            a checkbox that silently refuses to tick. */}
                        {locked && !row.alreadyBilled && (
                          <span className="ml-2 font-bold text-teal-700">
                            {row.notPullableReason}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right font-label text-sm">{row.quantity}</td>
                    <td className="px-3 py-2 text-right font-label text-sm">{fmt(row.unitPrice)}</td>
                    {/* No tax column here on purpose. A pending charge has not
                        been priced yet — its rate is decided when it is pulled
                        onto the bill, and showing a source's guess beforehand is
                        how the desk learns to distrust the figure that matters. */}
                    <td className="px-3 py-2 text-right font-label text-sm font-bold">{fmt(row.totalAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Manual line add — for ad-hoc charges not in any other module
// ────────────────────────────────────────────────────────────────────────

export function ManualLineForm({
  onAdd,
  loading,
  disabled = false,
  disabledReason,
}: {
  onAdd: (data: { description: string; quantity: number; unitPrice: number; discount: number }) => Promise<boolean>;
  loading: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>(0);

  const submit = async () => {
    if (loading || disabled) return;
    if (!description.trim()) {
      toast.error('Description required');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error('Quantity must be a positive whole number');
      return;
    }
    if (!unitPrice || Number(unitPrice) <= 0) {
      toast.error('Unit price must be > 0');
      return;
    }
    if (Number(discount) < 0) {
      toast.error('Discount cannot be negative');
      return;
    }
    const added = await onAdd({
      description: description.trim(),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      discount: Number(discount) || 0,
    });
    // Preserve what the user typed when the API refuses the line so they can
    // correct it and retry. Clearing on every resolved promise made a failed
    // add look successful while nothing appeared on the bill.
    if (!added) return;
    setDescription('');
    setQuantity(1);
    setUnitPrice('');
    setDiscount(0);
  };

  return (
    <div className="rounded-xl border bg-surface-container-lowest p-3">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
        Add Manual Charge
      </p>
      <div className="grid grid-cols-12 gap-2">
        <Input
          className="col-span-5"
          placeholder="Description (e.g. Dressing fee)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled || loading}
        />
        <NumberInput
          className="col-span-1"
          min={1}
          emptyValue={1}
          integer
          value={quantity}
          onValueChange={setQuantity}
          placeholder="Qty"
          disabled={disabled || loading}
        />
        <Input
          className="col-span-2"
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Unit ₹"
          min="0.01"
          disabled={disabled || loading}
        />
        <Input
          className="col-span-2"
          type="number"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Disc"
          min="0"
          disabled={disabled || loading}
        />
        {/* No Tax% box. The engine classifies the line from its code or its
            tariff; a rate typed here would be ignored by it anyway. */}
        <Button className="col-span-2" onClick={submit} disabled={loading || disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
        </Button>
      </div>
      {disabledReason && (
        <p className="mt-2 font-label text-[11px] text-amber-700">{disabledReason}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Bill lines table (with remove)
// ────────────────────────────────────────────────────────────────────────

type BillLineItem = {
  id: string; description: string; quantity: number; unitPrice: string | number;
  discountAmount: string | number; taxPercent: string | number; taxAmount: string | number;
  totalAmount: string | number; isAutoPulled?: boolean; category?: string;
  // The tax position the determination engine settled on for this line. Not
  // typed by anyone — read off the item's code, its tariff, or the rule that
  // applies (a room over the threshold, a medicine to an admitted patient).
  hsnSacCode?: string | null;
  gstTreatment?: string | null;
  taxableValue?: string | number;
  cgstAmount?: string | number;
  sgstAmount?: string | number;
  igstAmount?: string | number;
  rateSource?: string | null;
  taxReason?: string | null;
  requiresTaxResolution?: boolean;
};

type BillLineEdit = { description?: string; quantity?: number; unitPrice?: number; discount?: number };

function BillLinesPanel({
  items,
  loading,
  onRemove,
  removing,
  onUpdate,
  updating,
  editable,
}: {
  items: BillLineItem[];
  loading: boolean;
  onRemove: (itemId: string) => void;
  removing: boolean;
  onUpdate: (itemId: string, data: BillLineEdit) => Promise<void>;
  updating: boolean;
  editable: boolean;
}) {
  return (
    <div className="rounded-xl border bg-surface-container-lowest">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant px-3 py-2 border-b border-surface-container">
        Bill Lines ({items.length}){editable && <span className="ml-2 normal-case tracking-normal text-primary">· click the pencil to edit any price</span>}
      </p>
      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            <Loader2 className="inline h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            No line items yet. Auto-pull or add a manual line.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-container-lowest">
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">HSN / SAC</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Disc</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                {/* The engine's answer, not a number anybody typed. */}
                <th className="px-3 py-2">GST</th>
                <th className="px-3 py-2 text-right">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/40">
              {items.map((it) => (
                <BillLineRow
                  key={it.id}
                  item={it}
                  onRemove={onRemove}
                  removing={removing}
                  onUpdate={onUpdate}
                  updating={updating}
                  editable={editable}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// One bill line — displays read-only, or inline inputs when the pencil is
// clicked. Front desk can change description / qty / unit price / discount /
// tax% on any draft line (including auto-pulled ones); Total recomputes on save.
function BillLineRow({
  item,
  onRemove,
  removing,
  onUpdate,
  updating,
  editable,
}: {
  item: BillLineItem;
  onRemove: (itemId: string) => void;
  removing: boolean;
  onUpdate: (itemId: string, data: BillLineEdit) => Promise<void>;
  updating: boolean;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState<number>(item.quantity);
  const [unit, setUnit] = useState<number>(Number(item.unitPrice));
  const [disc, setDisc] = useState<number>(Number(item.discountAmount));

  const start = () => {
    setDesc(item.description);
    setQty(item.quantity);
    setUnit(Number(item.unitPrice));
    setDisc(Number(item.discountAmount));
    setEditing(true);
  };

  /**
   * The NET, before tax — deliberately not a total.
   *
   * Whether tax is added on top or already inside the price is decided by the
   * engine, per line: a service is taxed on top, a medicine's MRP has the GST
   * inside it. The old preview assumed on-top for everything and quietly
   * disagreed with the saved line on any tax-inclusive item. Showing the net
   * and letting the total come back from the server is the only figure the
   * screen can be sure of.
   */
  const previewNet = Math.max(0, qty * unit - disc);

  const save = async () => {
    if (!desc.trim()) { toast.error('Description is required'); return; }
    if (qty <= 0) { toast.error('Quantity must be positive'); return; }
    // No rate is sent. The engine re-resolves the line from its code, its
    // tariff or the rule that applies — which is the whole point of having one.
    await onUpdate(item.id, { description: desc.trim(), quantity: qty, unitPrice: unit, discount: disc });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-primary/5">
        <td className="px-3 py-2">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="h-7 text-sm" />
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-on-surface-variant">
          {item.hsnSacCode ?? '—'}
        </td>
        <td className="px-2 py-2">
          <NumberInput value={qty} onValueChange={setQty} min={0} integer className="h-7 w-14 text-right text-sm" />
        </td>
        <td className="px-2 py-2">
          <NumberInput value={unit} onValueChange={setUnit} min={0} className="h-7 w-20 text-right text-sm" />
        </td>
        <td className="px-2 py-2">
          <NumberInput value={disc} onValueChange={setDisc} min={0} className="h-7 w-16 text-right text-sm" />
        </td>
        <td className="px-3 py-2 text-right font-label text-sm">{fmt(previewNet)}</td>
        <td className="px-3 py-2" colSpan={3}>
          <span className="font-label text-[10px] text-on-surface-variant">
            GST is recalculated on save
          </span>
        </td>
        <td className="px-3 py-2 text-right font-label text-sm font-bold">{fmt(previewNet)}</td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={save} disabled={updating} title="Save" className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={updating} title="Cancel" className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-surface-container-low transition-colors">
      <td className="px-3 py-2">
        <p className="font-label text-sm">{item.description}</p>
        <p className="font-label text-[10px] text-on-surface-variant capitalize">
          {item.category ?? 'other'}
          {item.isAutoPulled && <span className="ml-2 text-primary">· auto</span>}
        </p>
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-on-surface-variant">
        {item.hsnSacCode ?? '—'}
      </td>
      <td className="px-3 py-2 text-right font-label text-sm">{item.quantity}</td>
      <td className="px-3 py-2 text-right font-label text-sm">{fmt(Number(item.unitPrice))}</td>
      <td className="px-3 py-2 text-right font-label text-sm">{fmt(Number(item.discountAmount))}</td>
      {/* A dash where there is no taxable value. An exempt supply HAS a value
          — it is in Total, on the same row — but it has no taxable value, and
          printing one under this heading beside an "Exempt" badge made the row
          contradict itself. */}
      <td className="px-3 py-2 text-right font-label text-sm">
        {item.gstTreatment === 'taxable' ? fmt(Number(item.taxableValue ?? 0)) : '—'}
      </td>
      <td className="px-3 py-2">
        <TreatmentBadge
          treatment={item.gstTreatment}
          ratePercent={Number(item.taxPercent)}
          requiresResolution={item.requiresTaxResolution}
          reason={item.taxReason}
        />
      </td>
      <td className="px-3 py-2 text-right font-label text-sm">{fmt(Number(item.cgstAmount ?? 0))}</td>
      <td className="px-3 py-2 text-right font-label text-sm">{fmt(Number(item.sgstAmount ?? 0))}</td>
      <td className="px-3 py-2 text-right font-label text-sm font-bold">{fmt(Number(item.totalAmount))}</td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-1">
          {editable && (
            <button
              type="button"
              onClick={start}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
              aria-label="Edit line"
              title="Edit this line"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={removing}
            className="rounded p-1 text-error hover:bg-error/10 transition-opacity disabled:opacity-30"
            aria-label="Remove line"
            title="Remove this line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Discount panel — % or fixed with reason
// ────────────────────────────────────────────────────────────────────────

function DiscountPanel({
  bill,
  onApply,
  loading,
}: {
  bill: { discountAmount?: string | number; subtotal?: string | number } | null;
  onApply: (type: 'percentage' | 'fixed', value: number, reason: string) => Promise<void>;
  loading: boolean;
}) {
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  const currentDiscount = Number(bill?.discountAmount ?? 0);

  const submit = async () => {
    const numeric = Number(value) || 0;
    if (numeric < 0) {
      toast.error('Discount must be non-negative');
      return;
    }
    if (type === 'percentage' && numeric > 100) {
      toast.error('Percentage cannot exceed 100');
      return;
    }
    await onApply(type, numeric, reason);
    setValue('');
    setReason('');
  };

  return (
    <div className="rounded-xl border bg-surface-container-lowest p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Concession / Discount
        </p>
        {currentDiscount > 0 && (
          <button
            type="button"
            onClick={() => onApply('fixed', 0, 'Cleared')}
            className="text-xs text-error hover:opacity-70"
          >
            <X className="inline h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <p className="font-display text-xl font-bold text-secondary">
        {fmt(currentDiscount)}
      </p>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setType('percentage')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors',
            type === 'percentage'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-surface-container text-on-surface-variant',
          )}
        >
          <Percent className="h-3 w-3" /> Percent
        </button>
        <button
          type="button"
          onClick={() => setType('fixed')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors',
            type === 'fixed'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-surface-container text-on-surface-variant',
          )}
        >
          <IndianRupee className="h-3 w-3" /> Amount
        </button>
      </div>

      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder={type === 'percentage' ? '0–100' : '₹ Amount'}
        value={value}
        onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <Input
        placeholder="Reason (required for audit)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button onClick={submit} disabled={loading} className="w-full" size="sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Discount'}
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Right-rail summary
// ────────────────────────────────────────────────────────────────────────

/**
 * Exported for its own test.
 *
 * It is pure presentation over figures the server settled, and it carries the
 * one thing on this screen that is easy to get quietly wrong — what the tax
 * rows MEAN. Reaching it through the whole dialog would mean standing up ten
 * hooks to assert on a sentence.
 */
export function BillSummaryPanel({
  bill,
}: {
  bill: {
    subtotal?: string | number; discountAmount?: string | number;
    taxAmount?: string | number; totalAmount?: string | number;
    amountPaid?: string | number; balanceDue?: string | number;
    taxableValue?: string | number; cgstAmount?: string | number;
    sgstAmount?: string | number; igstAmount?: string | number;
    gstDocumentType?: string | null; invoiceNumber?: string | null;
    /** Read for the taxable/exempt split — see the note in `rows`. */
    billItems?: BillLineItem[];
  } | null;
}) {
  // Whether the hospital charges GST at all. "No tax because we are not
  // registered" and "no tax because these supplies are exempt" are completely
  // different statements, and saying the wrong one is worse than saying
  // nothing. Cached centrally, so this costs nothing on top of the screens
  // that already read it.
  const { data: gstProfile } = useGstProfile();

  const rows = useMemo(() => {
    if (!bill) return null;
    // Split by TREATMENT, from the lines.
    //
    // The bill header's `taxable_value` is the undifferentiated sum of every
    // line's value, exempt ones included — deliberately, because the reports
    // partition it to fill both the taxable tables and the exempt table. Shown
    // raw under a heading that says "Taxable value" it was simply wrong: a
    // stay reading 8,168.60 taxable against 100.00 of GST implies a rate of
    // 1.2%, and most of that 8,168.60 is exempt healthcare.
    //
    // The two figures below add back up to the subtotal, so the panel still
    // reconciles on its face.
    const items = bill.billItems ?? [];
    const sumWhere = (pick: (t: string | null | undefined) => boolean) =>
      items
        .filter((i) => pick(i.gstTreatment))
        .reduce((t, i) => t + Number(i.taxableValue ?? 0), 0);
    const taxableSupplies = sumWhere((t) => t === 'taxable');
    const exemptSupplies = sumWhere((t) => !!t && t !== 'taxable');
    const unclassified = sumWhere((t) => !t);
    return {
      lineCount: items.length,
      subtotal: Number(bill.subtotal ?? 0),
      discount: Number(bill.discountAmount ?? 0),
      // Falls back to the header only when the lines have not loaded — an
      // empty bill, where the two are the same number anyway.
      taxable: items.length ? taxableSupplies : Number(bill.taxableValue ?? 0),
      exempt: exemptSupplies,
      unclassified,
      cgst: Number(bill.cgstAmount ?? 0),
      sgst: Number(bill.sgstAmount ?? 0),
      igst: Number(bill.igstAmount ?? 0),
      tax: Number(bill.taxAmount ?? 0),
      total: Number(bill.totalAmount ?? 0),
      paid: Number(bill.amountPaid ?? 0),
      balance: Number(bill.balanceDue ?? 0),
    };
  }, [bill]);

  return (
    <div className="rounded-xl border bg-surface-container-lowest p-3 space-y-2">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        Summary
      </p>
      {!rows ? (
        <p className="text-xs text-on-surface-variant">No bill yet.</p>
      ) : (
        <>
          {/* What this bill is called, once it has been issued. A draft shows
              nothing — it has no name and no number yet. */}
          <DocumentBadge
            documentType={bill?.gstDocumentType}
            invoiceNumber={bill?.invoiceNumber}
            className="pb-1"
          />
          <SummaryRow label="Subtotal" value={fmt(rows.subtotal)} />
          <SummaryRow label="Discount" value={`− ${fmt(rows.discount)}`} negative />
          <SummaryRow label="Taxable value" value={fmt(rows.taxable)} muted />
          {/* Named, rather than folded into the line above it. Most of a
              hospital's income is exempt healthcare, and a summary that does
              not say so leaves the reader to assume the tax was simply
              under-charged. */}
          {rows.exempt > 0 ? (
            <SummaryRow label="Exempt / nil-rated" value={fmt(rows.exempt)} muted />
          ) : null}
          {/* Neither taxable nor exempt: nothing has established a position for
              it. The finalisation gate refuses a bill carrying one, so this is
              a draft-only warning — but it has to be visible, or the two rows
              above would silently fail to add up to the subtotal. */}
          {rows.unclassified > 0 ? (
            <SummaryRow label="Unclassified" value={fmt(rows.unclassified)} negative />
          ) : null}
          {/* Broken out the way the return asks for it. CGST/SGST and IGST are
              mutually exclusive, so only the pair that applies is shown. */}
          {rows.igst > 0 ? (
            <SummaryRow label="IGST" value={fmt(rows.igst)} muted />
          ) : (
            <>
              <SummaryRow label="CGST" value={fmt(rows.cgst)} muted />
              <SummaryRow label="SGST" value={fmt(rows.sgst)} muted />
            </>
          )}
          <SummaryRow label="Total GST" value={fmt(rows.tax)} />
          {/* Why there is no tax.
              A bill of nothing but exempt healthcare shows a column of dashes
              and four zeroes, and to the person at the counter that reads as
              "the tax has not loaded" rather than "no tax is due". Every other
              surface says it outright — the patient portal, the printed
              invoice and the stay document all do — and this screen, the one
              the bill is actually assembled on, was the only one silent. */}
          {rows.tax === 0 && rows.lineCount > 0 && rows.unclassified === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-2 py-1.5 font-label text-[11px] leading-relaxed text-on-surface-variant">
              {gstProfile && !gstProfile.registered
                ? 'This hospital is not registered under GST, so no tax is charged on any bill.'
                : 'No GST is due — every line on this bill is exempt or nil-rated. Hover a line’s badge for the reason it was treated that way.'}
            </p>
          ) : null}
          <div className="h-px bg-surface-container my-1" />
          <SummaryRow label="Total" value={fmt(rows.total)} bold />
          <SummaryRow label="Paid" value={fmt(rows.paid)} muted />
          <SummaryRow label="Balance Due" value={fmt(rows.balance)} bold accent />
        </>
      )}
    </div>
  );
}

function SummaryRow({
  label, value, bold, negative, muted, accent,
}: {
  label: string; value: string; bold?: boolean; negative?: boolean;
  muted?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn('font-label', muted && 'text-on-surface-variant')}>{label}</span>
      <span
        className={cn(
          'font-label tabular-nums',
          bold && 'font-bold',
          negative && 'text-secondary',
          accent && 'text-error',
        )}
      >
        {value}
      </span>
    </div>
  );
}
