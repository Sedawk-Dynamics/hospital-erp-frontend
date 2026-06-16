'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Package,
  ChevronDown,
  ClipboardList,
  Stethoscope,
  X,
  Check,
  CalendarClock,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import { calcQuantityFromStrings } from '@/lib/dosage-calc';
import { looseUnitLabel, packSummary, formatBaseQty } from '@/lib/pharmacy-units';
import {
  useFormulary,
  useBatchesByDrug,
  useCreatePharmacySale,
  usePrescriptionQueue,
  usePrescriptionDetail,
  type FormularyItem,
  type DrugBatch,
  type PrescriptionListItem,
  type PharmacySale,
  type PharmacyPaymentMethod,
  type PharmacyTenderInput,
  type CreatePharmacySaleInput,
} from '@/hooks/use-pharmacy';
import { PharmacyReceiptDialog } from '@/components/pharmacy/pharmacy-receipt-dialog';

export default function PharmacyBillingPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Pharmacy Billing</h1>

      <Tabs defaultValue="billing">
        <TabsList variant="line">
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="return">Return Bills</TabsTrigger>
          <TabsTrigger value="cash-counter">Cash Counter</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="pt-4">
          <PharmacyPOS />
        </TabsContent>
        <TabsContent value="return" className="pt-4">
          <ReturnBillsTab />
        </TabsContent>
        <TabsContent value="cash-counter" className="pt-4">
          <PharmacyCashCounterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Cart row — one entry per prescription-item / batch pair
// ============================================================

interface CartItem {
  // Stable key (`<prescriptionItemId>::<formularyItemId>` for rx items, or
  // `walk::<formularyItemId>` for walk-in dispenses). Stays stable across
  // batch/qty edits, unique per row.
  rowKey: string;
  prescriptionItemId: string | null;
  formularyItemId: string;
  drugName: string;
  genericName: string | null;
  // Selected batch (null until the cashier picks one)
  batchId: string | null;
  batchNumber: string;
  expiryDate: string | null;
  // Pricing — per BASE (loose) unit, pulled from the chosen batch / formulary
  sellingPrice: number;
  purchasePrice: number;
  // Loose / sub-unit sale. packSize = base units per pack/strip. When the line
  // sells 'pack' the quantity counts packs; when 'loose' it counts sub-units.
  packSize: number;
  looseUnitLabel: string;
  // Dosage form (tablet/syrup/...) — drives the base-unit noun shown to the
  // cashier when no explicit looseUnitLabel is configured.
  dosageForm: string | null;
  taxPercent: number;
  saleUnit: 'pack' | 'loose';
  // User-editable (quantity is in the chosen saleUnit)
  quantity: number;
  discount: number;
  // Stock check — always in BASE units
  availableQty: number;
  // Prescribed dosing context — populated for prescription rows so the cashier
  // can see what the doctor ordered (e.g. "1-1-1 · 3 days → 9"). Blank for
  // walk-in / OTC rows. rxQuantity is the prescribed count in base (loose) units.
  rxDosage?: string;
  rxFrequency?: string;
  rxDuration?: string | null;
  // Per-intake dose multiplier the doctor set (default 1).
  rxDose?: number;
  rxQuantity?: number | null;
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  uhid?: string;
  mrn?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
}

const toNum = (n: number | string | null | undefined): number => {
  if (n == null) return 0;
  return typeof n === 'string' ? Number(n) : n;
};

// Base (loose) units this line represents, accounting for pack vs loose selling.
function baseQtyOf(item: CartItem): number {
  const pack = item.packSize > 0 ? item.packSize : 1;
  return item.saleUnit === 'loose' ? item.quantity : item.quantity * pack;
}

function computeItemGross(item: CartItem): number {
  return item.sellingPrice * baseQtyOf(item);
}

function computeItemNet(item: CartItem): number {
  const gross = computeItemGross(item);
  return gross - gross * (item.discount / 100);
}

// GST embedded in the MRP (prices are tax-inclusive).
function computeItemTax(item: CartItem): number {
  const net = computeItemNet(item);
  const rate = item.taxPercent || 0;
  return net - net / (1 + rate / 100);
}

function computeItemMargin(item: CartItem): number {
  const cost = item.purchasePrice * baseQtyOf(item);
  return computeItemNet(item) - cost;
}

// ============================================================
// PharmacyPOS — wired to /pharmacy/dispensing
// ============================================================

function PharmacyPOS() {
  const searchParams = useSearchParams();
  const initialPrescriptionId = searchParams.get('prescriptionId');

  // --- Patient state ---
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientDropdownRef = useRef<HTMLDivElement>(null);
  const [debouncedPatient, setDebouncedPatient] = useState('');

  // --- Prescription state ---
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(initialPrescriptionId);
  const [prescriptionPickerOpen, setPrescriptionPickerOpen] = useState(false);
  const prescriptionPickerRef = useRef<HTMLDivElement>(null);

  // --- Walk-in medicine search ---
  const [medicineSearch, setMedicineSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [debouncedMedicine, setDebouncedMedicine] = useState('');

  // --- Cart + payment state ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  // G7: split payment — when on, the bill is settled across multiple tenders.
  const [splitMode, setSplitMode] = useState(false);
  const [tenders, setTenders] = useState<Array<{ id: string; method: string; amount: string }>>([
    { id: 'tender-1', method: 'Cash', amount: '' },
  ]);

  // --- Receipt ---
  const [receiptSale, setReceiptSale] = useState<PharmacySale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // --- Batch picker (modal) ---
  const [batchPickerForRow, setBatchPickerForRow] = useState<string | null>(null);
  const [batchPickerDrugId, setBatchPickerDrugId] = useState<string | null>(null);

  // --- Debounces ---
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedicine(medicineSearch), 300);
    return () => clearTimeout(t);
  }, [medicineSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPatient(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // --- Patient search query ---
  const { data: patientData, isLoading: patientLoading } = useQuery({
    queryKey: ['patients', 'search', debouncedPatient],
    queryFn: async () => {
      const response = await apiGet<PatientResult[]>('/patients/search', {
        params: { search: debouncedPatient, limit: 10 },
      });
      return response.data;
    },
    enabled: debouncedPatient.length >= 2,
  });
  const patientResults = patientData ?? [];

  // --- Pending prescriptions for the selected patient (for the picker) ---
  const { data: pendingForPatient } = usePrescriptionQueue(
    selectedPatient
      ? { patientId: selectedPatient.id, status: 'pending', dispensed: false, limit: 20 }
      : undefined,
  );

  // --- Active prescription detail (when chosen via deep-link or picker) ---
  const { data: activePrescription } = usePrescriptionDetail(activePrescriptionId);

  // --- Walk-in formulary search ---
  const { data: formularyData, isLoading: searchLoading } = useFormulary({
    search: debouncedMedicine || undefined,
    limit: 15,
    isActive: true,
  });
  const searchResults = formularyData?.data ?? [];

  // --- Batch fetch for picker ---
  const { data: batchesForDrug, isLoading: batchesLoading } = useBatchesByDrug(batchPickerDrugId);
  const availableBatches = (batchesForDrug ?? []).filter((b) => b.quantityInStock > 0);

  // --- Mutation ---
  const createSale = useCreatePharmacySale();

  // --- Auto-load patient + cart when prescription detail arrives ---
  useEffect(() => {
    if (!activePrescription) return;
    // Hydrate selected patient from the prescription if needed.
    if (!selectedPatient || selectedPatient.id !== activePrescription.patient.id) {
      setSelectedPatient({
        id: activePrescription.patient.id,
        firstName: activePrescription.patient.firstName,
        lastName: activePrescription.patient.lastName,
        mrn: activePrescription.patient.mrn,
      });
      setPatientSearch(`${activePrescription.patient.firstName} ${activePrescription.patient.lastName}`);
    }
    // Replace the cart with the prescription's items (only those with a
    // formulary link — free-text rows can be searched and added manually).
    const newCart: CartItem[] = activePrescription.prescriptionItems
      .filter((it) => it.drugId)
      .map((it) => {
        // The dispense count the doctor intends: the stored quantity, or one
        // derived from the dose pattern × duration × per-intake dose (e.g. 1-1-1
        // for 3 days with dose 2 → 18).
        const rxQty = it.quantity ?? calcQuantityFromStrings(it.frequency, it.duration, it.doseQuantity);
        const rxDose = Number(it.doseQuantity ?? 1) || 1;
        return {
          rowKey: `${it.id}::${it.drugId}`,
          prescriptionItemId: it.id,
          formularyItemId: it.drugId as string,
          drugName: it.drugName,
          genericName: null,
          batchId: null,
          batchNumber: '-',
          expiryDate: null,
          sellingPrice: 0,
          purchasePrice: 0,
          packSize: 1,
          looseUnitLabel: 'unit',
          dosageForm: null,
          taxPercent: 12,
          // Prescriptions are written in loose units (tablets), never packs —
          // bill the exact count the doctor ordered.
          saleUnit: 'loose',
          quantity: rxQty ?? 1,
          discount: 0,
          availableQty: 0,
          rxDosage: it.dosage,
          rxFrequency: it.frequency,
          rxDuration: it.duration,
          rxDose,
          rxQuantity: rxQty ?? null,
        };
      });
    setCart(newCart);
    // FEFO — auto-pick the nearest-expiry batch for each prescription line.
    newCart.forEach((c) => void autoSelectBatch(c.rowKey, c.formularyItemId));
    if (activePrescription.prescriptionItems.some((it) => !it.drugId)) {
      toast.info('Some items lack a formulary link and need to be selected manually.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrescription?.id]);

  // --- Outside-click handlers ---
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (prescriptionPickerRef.current && !prescriptionPickerRef.current.contains(e.target as Node)) {
        setPrescriptionPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Patient handlers ---
  const selectPatient = useCallback((patient: PatientResult) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
  }, []);

  const clearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientSearch('');
    setActivePrescriptionId(null);
    setCart([]);
  }, []);

  // --- Prescription handlers ---
  const selectPrescription = useCallback((rx: PrescriptionListItem) => {
    setActivePrescriptionId(rx.id);
    setPrescriptionPickerOpen(false);
  }, []);

  const clearPrescription = useCallback(() => {
    setActivePrescriptionId(null);
    setCart([]);
  }, []);

  const selectBatch = useCallback((rowKey: string, batch: DrugBatch) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.rowKey !== rowKey) return c;
        // Pull pack/loose/GST config off the batch's formulary drug (if present).
        const pack = batch.drug?.packSize && batch.drug.packSize > 0 ? batch.drug.packSize : c.packSize;

        // First batch pick (the FEFO auto-select on load) of a prescription line
        // for a loose-sellable drug (tablets/caps, packSize > 1): default to
        // billing the doctor's exact count in LOOSE units, never packs — so a
        // "30 tablets" Rx auto-bills 30 tablets. A later manual re-pick keeps
        // whatever unit/qty the cashier has since chosen.
        const firstPick = c.batchId === null;
        const rxLooseSolid = c.prescriptionItemId != null && pack > 1;

        let saleUnit: 'pack' | 'loose';
        let quantity: number;
        if (firstPick && rxLooseSolid) {
          saleUnit = 'loose';
          const target = c.rxQuantity ?? c.quantity ?? 1;
          quantity = Math.max(1, Math.min(target, batch.quantityInStock));
        } else {
          saleUnit = pack > 1 ? c.saleUnit : 'pack';
          const maxInUnit =
            saleUnit === 'loose' ? batch.quantityInStock : Math.floor(batch.quantityInStock / (pack || 1));
          quantity = Math.max(1, Math.min(c.quantity || 1, maxInUnit || 1));
        }

        return {
          ...c,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          sellingPrice: toNum(batch.sellingPrice) || c.sellingPrice,
          purchasePrice: toNum(batch.purchasePrice),
          packSize: pack,
          dosageForm: batch.drug?.dosageForm ?? c.dosageForm,
          looseUnitLabel: looseUnitLabel(batch.drug?.dosageForm, batch.drug?.looseUnitLabel) || c.looseUnitLabel,
          taxPercent: batch.drug?.taxPercent != null ? toNum(batch.drug.taxPercent) : c.taxPercent,
          saleUnit,
          availableQty: batch.quantityInStock,
          expiryDate: batch.expiryDate,
          quantity,
        };
      }),
    );
    setBatchPickerForRow(null);
    setBatchPickerDrugId(null);
  }, []);

  // FEFO — auto-pick the nearest-expiry available batch for a freshly-added row.
  const autoSelectBatch = useCallback(async (rowKey: string, drugId: string) => {
    try {
      const res = await apiGet<DrugBatch[]>('/pharmacy/batches', {
        params: { drugId, availableOnly: true, limit: 50 },
      });
      const batches = (res.data ?? []).filter((b) => b.quantityInStock > 0);
      if (batches.length === 0) return;
      const nearest = batches
        .slice()
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
      selectBatch(rowKey, nearest);
    } catch {
      /* leave unselected — the cashier can pick manually */
    }
  }, [selectBatch]);

  // --- Walk-in cart helpers ---
  const addWalkInItem = useCallback((item: FormularyItem) => {
    if (activePrescriptionId) {
      toast.warning('This bill is linked to a prescription. Clear it first to add walk-in items.');
      return;
    }
    const pack = item.packSize && item.packSize > 0 ? item.packSize : 1;
    const rowKey = `walk::${item.id}`;
    const alreadyInCart = cart.some((c) => c.rowKey === rowKey);
    setCart((prev) => {
      const existing = prev.find((c) => c.rowKey === rowKey);
      if (existing) {
        return prev.map((c) =>
          c.rowKey === rowKey ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          rowKey,
          prescriptionItemId: null,
          formularyItemId: item.id,
          drugName: item.drugName,
          genericName: item.genericName,
          batchId: null,
          batchNumber: '-',
          expiryDate: null,
          sellingPrice: toNum(item.price),
          purchasePrice: 0,
          packSize: pack,
          looseUnitLabel: looseUnitLabel(item.dosageForm, item.looseUnitLabel),
          dosageForm: item.dosageForm ?? null,
          taxPercent: item.taxPercent != null ? toNum(item.taxPercent) : 12,
          // Default to loose so "give me X" works out of the box; the cashier
          // can flip to pack selling when a packSize is configured.
          saleUnit: pack > 1 ? 'loose' : 'pack',
          quantity: 1,
          discount: 0,
          availableQty: 0,
        },
      ];
    });
    // Auto-pick the nearest-expiry batch (FEFO) for newly-added rows.
    if (!alreadyInCart) void autoSelectBatch(rowKey, item.id);
    setMedicineSearch('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  }, [activePrescriptionId, cart, autoSelectBatch]);

  // Max quantity in the row's current unit (packs vs loose), given base stock.
  const maxQtyInUnit = (c: CartItem): number => {
    if (c.availableQty <= 0) return Infinity; // batch not chosen yet — no cap
    const pack = c.packSize > 0 ? c.packSize : 1;
    return c.saleUnit === 'loose' ? c.availableQty : Math.floor(c.availableQty / pack);
  };

  const updateQty = (rowKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.rowKey !== rowKey) return c;
          const max = maxQtyInUnit(c);
          const newQty = Math.max(0, c.quantity + delta);
          if (newQty > max) {
            toast.warning(`Max available: ${max} ${c.saleUnit === 'loose' ? c.looseUnitLabel : 'pack'}(s)`);
            return c;
          }
          return { ...c, quantity: newQty };
        })
        .filter((c) => c.quantity > 0),
    );
  };

  // Typed quantity (free entry). Empty string keeps 0 transiently; clamped to stock.
  const setQtyExact = (rowKey: string, raw: string) => {
    const parsed = Math.floor(Number(raw));
    setCart((prev) =>
      prev.map((c) => {
        if (c.rowKey !== rowKey) return c;
        if (!raw || Number.isNaN(parsed) || parsed < 0) return { ...c, quantity: 0 };
        const max = maxQtyInUnit(c);
        if (parsed > max) {
          toast.warning(`Max available: ${max} ${c.saleUnit === 'loose' ? c.looseUnitLabel : 'pack'}(s)`);
          return { ...c, quantity: max === Infinity ? parsed : max };
        }
        return { ...c, quantity: parsed };
      }),
    );
  };

  // Flip a row between selling whole packs and loose sub-units, re-clamping qty.
  const toggleSaleUnit = (rowKey: string, unit: 'pack' | 'loose') => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.rowKey !== rowKey) return c;
        const next = { ...c, saleUnit: unit };
        const max = maxQtyInUnit(next);
        return { ...next, quantity: Math.max(1, Math.min(c.quantity || 1, max === Infinity ? c.quantity || 1 : max)) };
      }),
    );
  };

  const removeItem = (rowKey: string) => {
    setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
  };

  const updateDiscount = (rowKey: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.rowKey === rowKey ? { ...c, discount: Math.min(100, Math.max(0, discount)) } : c,
      ),
    );
  };

  // --- Summary ---
  const summary = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + computeItemGross(c), 0);
    const totalDiscount = cart.reduce((s, c) => s + computeItemGross(c) * (c.discount / 100), 0);
    const afterDiscount = subtotal - totalDiscount;
    const totalTax = cart.reduce((s, c) => s + computeItemTax(c), 0);
    const rounded = Math.round(afterDiscount);
    const roundOff = Math.round((rounded - afterDiscount) * 100) / 100;
    const margin = cart.reduce((s, c) => s + computeItemMargin(c), 0);
    return { subtotal, totalDiscount, afterDiscount, totalTax, rounded, roundOff, margin };
  }, [cart]);

  const tenderedNum = Number(amountTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - summary.rounded);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cartHasAllBatches = cart.length > 0 && cart.every((c) => c.batchId !== null);
  // A bill needs a cart with a batch per line. Patient AND prescription are
  // both OPTIONAL — a walk-in / OTC counter sale needs neither.
  const canCreateBill = cart.length > 0 && cartHasAllBatches;

  const PAYMENT_METHOD_MAP: Record<string, PharmacyPaymentMethod> = {
    Cash: 'cash',
    Card: 'credit_card',
    UPI: 'upi',
    'Bank Transfer': 'net_banking',
    Insurance: 'insurance',
  };

  // Sum of all split tenders entered (in split mode).
  const tendersTotal = tenders.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Bills the whole cart as one invoice, then opens the printable receipt.
  const runSale = async () => {
    try {
      // Build the tender line(s). Both modes go through payments[] so Insurance
      // (and any future mode) works uniformly; the backend trims change and
      // settles the bill. Split mode = one line per tender; single mode = one
      // line for the chosen method at the tendered (or full) amount.
      const tenderLines: PharmacyTenderInput[] = splitMode
        ? tenders
            .filter((t) => Number(t.amount) > 0)
            .map((t) => ({ method: PAYMENT_METHOD_MAP[t.method] ?? 'cash', amount: Number(t.amount) }))
        : (() => {
            const amt = amountTendered ? Math.min(tenderedNum, summary.rounded) : summary.rounded;
            return amt > 0
              ? [{ method: PAYMENT_METHOD_MAP[paymentMode] ?? 'cash', amount: amt }]
              : [];
          })();

      const payload: CreatePharmacySaleInput = {
        // Omitted for walk-in — backend bills it to the tenant Walk-in customer.
        patientId: selectedPatient?.id,
        prescriptionId: activePrescriptionId || undefined,
        items: cart.map((c) => ({
          drugBatchId: c.batchId as string,
          prescriptionItemId: c.prescriptionItemId || undefined,
          quantity: c.quantity,
          saleUnit: c.saleUnit,
          discountPercent: c.discount || undefined,
        })),
      };
      if (tenderLines.length) payload.payments = tenderLines;
      const sale = await createSale.mutateAsync(payload);
      toast.success(`Bill ${sale.bill.billNumber} created`);
      setReceiptSale(sale);
      setReceiptOpen(true);
      setCart([]);
      setAmountTendered('');
      setSplitMode(false);
      setTenders([{ id: 'tender-1', method: 'Cash', amount: '' }]);
      setActivePrescriptionId(null);
      clearPatient();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create bill';
      toast.error(message);
    }
  };

  const handleCreateBill = async () => {
    if (cart.length === 0) return toast.error('Add at least one medicine to the cart');
    if (!cartHasAllBatches) return toast.error('Please select a batch for each medicine');

    await runSale();
  };

  const handleSaveDraft = async () => {
    if (cart.length === 0) return toast.error('Add at least one medicine to the cart');
    const draft = {
      id: crypto.randomUUID(),
      patient: selectedPatient,
      prescriptionId: activePrescriptionId,
      items: cart,
      paymentMode,
      summary,
      createdAt: new Date().toISOString(),
    };
    try {
      const existingRaw = localStorage.getItem('pharmacy_drafts');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(draft);
      localStorage.setItem('pharmacy_drafts', JSON.stringify(existing));
      toast.success('Draft saved locally');
    } catch {
      toast.error('Failed to save draft');
    }
  };

  return (
    <div className="space-y-4">
      {/* Patient + prescription selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md min-w-[260px]" ref={patientDropdownRef}>
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient (optional for walk-in)..."
            value={patientSearch}
            onChange={(e) => {
              setPatientSearch(e.target.value);
              if (selectedPatient) setSelectedPatient(null);
              setShowPatientDropdown(true);
            }}
            onFocus={() => {
              if (patientSearch.length >= 2 && !selectedPatient) setShowPatientDropdown(true);
            }}
            className="pl-9"
          />

          {selectedPatient && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {selectedPatient.mrn && <span className="text-primary/70">{selectedPatient.mrn}</span>}
                <button
                  onClick={clearPatient}
                  className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                  aria-label="Clear patient"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          {showPatientDropdown && patientSearch.length >= 2 && !selectedPatient && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {patientLoading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Searching patients...
                </div>
              ) : patientResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">No patients found</div>
              ) : (
                patientResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {p.firstName?.[0]}{p.lastName?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {p.firstName} {p.lastName}
                        {(p.mrn || p.uhid) && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({p.mrn ?? p.uhid})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.mobile || p.phone || ''}{p.gender ? ` · ${p.gender}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Prescription picker — visible once a patient is selected */}
        <div className="relative" ref={prescriptionPickerRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrescriptionPickerOpen((o) => !o)}
            disabled={!selectedPatient}
          >
            <ClipboardList className="h-4 w-4 mr-1.5" />
            {activePrescription
              ? `Rx: ${activePrescription.id.slice(0, 8)} (${activePrescription.prescriptionItems.length} items)`
              : 'Select Prescription'}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
          {activePrescriptionId && (
            <button
              type="button"
              onClick={clearPrescription}
              className="ml-1 text-xs text-muted-foreground hover:text-destructive"
              aria-label="Clear prescription"
            >
              <X className="inline h-3 w-3" />
            </button>
          )}
          {prescriptionPickerOpen && selectedPatient && (
            <div className="absolute top-full left-0 z-50 mt-1 w-[420px] rounded-lg border bg-popover shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <p className="text-xs font-medium">
                  Pending prescriptions for {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {(pendingForPatient?.data ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No pending prescriptions for this patient.
                  </div>
                ) : (
                  (pendingForPatient?.data ?? []).map((rx) => (
                    <button
                      key={rx.id}
                      onClick={() => selectPrescription(rx)}
                      className="flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">
                          {rx.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {rx.prescriptionType} · {rx.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <Stethoscope className="inline h-3 w-3 mr-1" />
                        {rx.doctor?.user
                          ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}`
                          : 'Doctor'}
                      </p>
                      <p className="text-xs text-foreground line-clamp-2">
                        {rx.prescriptionItems.map((it) => it.drugName).join(', ') || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(rx.createdAt)} · {rx.prescriptionItems.length} item{rx.prescriptionItems.length > 1 ? 's' : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Walk-in medicine search (disabled when prescription is loaded) */}
      <div className="relative max-w-lg" ref={dropdownRef}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          ref={searchInputRef}
          placeholder={
            activePrescriptionId
              ? 'Cart locked to prescription items — clear Rx to add walk-in items'
              : 'Search medicine to add (walk-in)...'
          }
          value={medicineSearch}
          onChange={(e) => {
            setMedicineSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (medicineSearch.length > 0) setShowDropdown(true);
          }}
          className="pl-9"
          disabled={!!activePrescriptionId}
        />
        {showDropdown && medicineSearch.length > 0 && !activePrescriptionId && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">No medicines found</div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addWalkInItem(item)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.drugName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.genericName && `${item.genericName} · `}
                      {item.dosageForm && `${item.dosageForm} `}
                      {item.strength && `${item.strength}`}
                      {item.manufacturer && ` · ${item.manufacturer}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.price != null ? `₹${toNum(item.price).toFixed(2)}` : '-'}
                      {item.price != null && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {' '}/{looseUnitLabel(item.dosageForm, item.looseUnitLabel)}
                        </span>
                      )}
                    </p>
                    {packSummary(item.packSize, item.dosageForm, item.looseUnitLabel) && (
                      <p className="text-[10px] text-muted-foreground">
                        {packSummary(item.packSize, item.dosageForm, item.looseUnitLabel)}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart + summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Medicine</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Batch</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Disc %</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                      {activePrescriptionId
                        ? 'Loading prescription items...'
                        : 'Search for medicines to add to bill, or pick a prescription'}
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.rowKey} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{item.drugName}</p>
                        {item.genericName && (
                          <p className="text-xs text-muted-foreground">{item.genericName}</p>
                        )}
                        {packSummary(item.packSize, item.dosageForm, item.looseUnitLabel) && (
                          <p className="text-[10px] text-muted-foreground">
                            <Package className="mr-0.5 inline h-2.5 w-2.5" />
                            {packSummary(item.packSize, item.dosageForm, item.looseUnitLabel)}
                          </p>
                        )}
                        {item.prescriptionItemId && (
                          <div className="mt-0.5 space-y-0.5">
                            {[item.rxDosage, item.rxFrequency, item.rxDuration, (item.rxDose ?? 1) > 1 ? `× ${item.rxDose} dose` : null].filter(Boolean).length > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                {[item.rxDosage, item.rxFrequency, item.rxDuration, (item.rxDose ?? 1) > 1 ? `× ${item.rxDose} dose` : null].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {item.rxQuantity != null && (
                              <p className="text-[10px]">
                                <span className="uppercase tracking-wide text-emerald-600">Rx qty: </span>
                                <span className="font-semibold text-foreground">
                                  {formatBaseQty(item.rxQuantity, item.dosageForm, item.looseUnitLabel)}
                                </span>
                                {item.batchId && baseQtyOf(item) !== item.rxQuantity && (
                                  <span className="ml-1 text-amber-600">
                                    (billing {formatBaseQty(baseQtyOf(item), item.dosageForm, item.looseUnitLabel)})
                                  </span>
                                )}
                              </p>
                            )}
                            {item.rxQuantity == null && (
                              <p className="text-[10px] uppercase tracking-wide text-emerald-600">From Rx</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            setBatchPickerForRow(item.rowKey);
                            setBatchPickerDrugId(item.formularyItemId);
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                            item.batchId
                              ? 'bg-muted/50 hover:bg-muted text-foreground'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
                          )}
                        >
                          {item.batchId ? (
                            <>
                              <Package className="h-3 w-3" />
                              {item.batchNumber}
                              {item.expiryDate && (
                                <span className="text-muted-foreground ml-1">
                                  (Exp: {formatDate(item.expiryDate)})
                                </span>
                              )}
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            </>
                          ) : (
                            <>
                              Select Batch
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateQty(item.rowKey, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity || ''}
                            onChange={(e) => setQtyExact(item.rowKey, e.target.value)}
                            className="h-6 w-12 rounded border bg-background text-center text-xs"
                          />
                          <button
                            onClick={() => updateQty(item.rowKey, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {item.packSize > 1 && (
                          <div className="mt-1 flex items-center justify-center gap-1">
                            {(['pack', 'loose'] as const).map((u) => (
                              <button
                                key={u}
                                onClick={() => toggleSaleUnit(item.rowKey, u)}
                                className={cn(
                                  'rounded border px-1.5 py-0.5 text-[10px] capitalize transition-colors',
                                  item.saleUnit === u
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:bg-muted/50',
                                )}
                              >
                                {u === 'loose' ? item.looseUnitLabel || 'Loose' : 'Pack'}
                              </button>
                            ))}
                          </div>
                        )}
                        {item.availableQty > 0 && (
                          <p className="text-center text-[10px] text-muted-foreground mt-0.5">
                            Avl: {item.saleUnit === 'loose'
                              ? `${item.availableQty} ${item.looseUnitLabel || 'units'}`
                              : `${Math.floor(item.availableQty / (item.packSize || 1))} pack`}
                            {item.packSize > 1 && ` (1 pack = ${item.packSize})`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {`₹${fmt(item.saleUnit === 'loose' ? item.sellingPrice : item.sellingPrice * (item.packSize || 1))}`}
                        <div className="text-[10px] text-muted-foreground">
                          {item.saleUnit === 'loose' ? `/${item.looseUnitLabel || 'unit'}` : '/pack'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount}
                          onChange={(e) => updateDiscount(item.rowKey, Number(e.target.value))}
                          className="h-7 w-16 text-center text-xs mx-auto"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {`₹${fmt(computeItemNet(item))}`}
                        {item.taxPercent > 0 && (
                          <div className="text-[10px] font-normal text-muted-foreground">
                            incl. GST {item.taxPercent}%
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => removeItem(item.rowKey)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {cart.length > 0 && (
            <div className="border-t px-3 py-2 bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
              <span>{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</span>
              <span title="Loose units (tablets/caps/ml), not packs">
                Total Units: {cart.reduce((s, c) => s + baseQtyOf(c), 0)}
              </span>
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Bill Summary</h3>

          {selectedPatient ? (
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Patient</p>
              <p className="text-sm font-medium text-foreground">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              {selectedPatient.mrn && (
                <p className="text-xs text-muted-foreground">MRN: {selectedPatient.mrn}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/20 px-3 py-2 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Walk-in customer</p>
                <p className="text-xs text-muted-foreground">No patient — OTC counter sale</p>
              </div>
            </div>
          )}

          {activePrescription && (
            <div className="rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2">
              <p className="text-xs text-emerald-700">Linked Prescription</p>
              <p className="text-sm font-medium text-emerald-900 font-mono">
                {activePrescription.id.slice(0, 12)}
              </p>
              <p className="text-xs text-emerald-700">
                {activePrescription.doctor?.user
                  ? `Dr. ${activePrescription.doctor.user.firstName} ${activePrescription.doctor.user.lastName}`
                  : 'Doctor'}
              </p>
            </div>
          )}

          {/* Validation warnings */}
          {cart.length > 0 && !cartHasAllBatches && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Select a batch for each medicine before billing.
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sub Amount</span>
              <span className="font-medium">{`₹${fmt(summary.subtotal)}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium text-green-600">
                {summary.totalDiscount > 0 ? `-₹${fmt(summary.totalDiscount)}` : '0.00'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Incl. GST</span>
              <span className="text-muted-foreground">₹{fmt(summary.totalTax)}</span>
            </div>
            {summary.roundOff !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Round Off</span>
                <span className="font-medium">
                  {summary.roundOff > 0 ? `+${fmt(summary.roundOff)}` : fmt(summary.roundOff)}
                </span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between text-base">
              <span className="font-semibold">Payable Amount</span>
              <span className="font-bold text-primary">{`₹${fmt(summary.rounded)}`}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Margin / Profit</span>
              <span className={cn('font-medium', summary.margin >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {`₹${fmt(summary.margin)}`}
              </span>
            </div>
          </div>

          {/* Payment — single mode, or G7 split across multiple tenders */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Payment</p>
              <button
                type="button"
                onClick={() => {
                  setSplitMode((s) => !s);
                  if (!splitMode) {
                    // Seed the first tender with the balance for a quick split.
                    setTenders([{ id: 'tender-1', method: paymentMode, amount: '' }]);
                  }
                }}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                  splitMode
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {splitMode ? 'Split: ON' : 'Split payment'}
              </button>
            </div>

            {!splitMode ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Insurance'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        paymentMode === mode
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Amount Tendered</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder={`Default: ₹${fmt(summary.rounded)} (full)`}
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="h-9"
                  />
                  {tenderedNum > 0 && (
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {tenderedNum >= summary.rounded ? 'Change to return' : 'Balance due'}
                      </span>
                      <span className={cn('font-medium', tenderedNum >= summary.rounded ? 'text-emerald-600' : 'text-amber-600')}>
                        ₹{fmt(tenderedNum >= summary.rounded ? changeDue : summary.rounded - tenderedNum)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {tenders.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <select
                      value={t.method}
                      onChange={(e) =>
                        setTenders((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, method: e.target.value } : x)),
                        )
                      }
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Insurance'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0.00"
                      value={t.amount}
                      onChange={(e) =>
                        setTenders((prev) =>
                          prev.map((x) => (x.id === t.id ? { ...x, amount: e.target.value } : x)),
                        )
                      }
                      className="h-9 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTenders((prev) =>
                          prev.length > 1 ? prev.filter((x) => x.id !== t.id) : prev,
                        )
                      }
                      disabled={tenders.length <= 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      title="Remove tender"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {idx === tenders.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTenders((prev) => {
                            const remaining = Math.max(0, summary.rounded - tendersTotal);
                            return [
                              ...prev,
                              {
                                id: `tender-${prev.length + 1}-${Date.now()}`,
                                method: 'UPI',
                                amount: remaining ? remaining.toFixed(2) : '',
                              },
                            ];
                          })
                        }
                        className="text-primary hover:text-primary/80"
                        title="Add another tender"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Allocated / Payable</span>
                  <span
                    className={cn(
                      'font-medium',
                      Math.abs(tendersTotal - summary.rounded) < 0.01
                        ? 'text-emerald-600'
                        : 'text-amber-600',
                    )}
                  >
                    ₹{fmt(tendersTotal)} / ₹{fmt(summary.rounded)}
                  </span>
                </div>
                {tendersTotal < summary.rounded && (
                  <p className="text-[11px] text-amber-600">
                    Balance due ₹{fmt(summary.rounded - tendersTotal)} will remain unpaid on the bill.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={cart.length === 0}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              className="flex-1"
              disabled={!canCreateBill || createSale.isPending}
              onClick={handleCreateBill}
            >
              {createSale.isPending ? 'Billing...' : 'Generate Bill'}
            </Button>
          </div>
        </div>
      </div>

      {/* Batch selection modal (opens on top; FEFO-sorted, nearest expiry first) */}
      <Dialog
        open={batchPickerForRow !== null}
        onOpenChange={(o) => {
          if (!o) {
            setBatchPickerForRow(null);
            setBatchPickerDrugId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {(() => {
            const pickItem = cart.find((c) => c.rowKey === batchPickerForRow) ?? null;
            const sorted = availableBatches
              .slice()
              .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-primary" />
                    Select Batch{pickItem ? ` — ${pickItem.drugName}` : ''}
                  </DialogTitle>
                </DialogHeader>
                {batchesLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No in-stock batches for this drug. Add stock under Batches.
                  </div>
                ) : (
                  <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
                    {sorted.map((batch, idx) => {
                      const days = Math.floor(
                        (new Date(batch.expiryDate).getTime() - Date.now()) / 86400000,
                      );
                      const isNearest = idx === 0;
                      const isSelected = pickItem?.batchId === batch.id;
                      const expiringSoon = days <= 30;
                      return (
                        <button
                          key={batch.id}
                          onClick={() => pickItem && selectBatch(pickItem.rowKey, batch)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">{batch.batchNumber}</span>
                              {isNearest && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                  <CalendarClock className="mr-0.5 h-2.5 w-2.5" />
                                  Earliest expiry
                                </Badge>
                              )}
                              {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <p className={cn('text-xs', expiringSoon ? 'text-amber-600' : 'text-muted-foreground')}>
                              Exp: {formatDate(batch.expiryDate)} ({days}d) · Stock: {batch.quantityInStock}
                            </p>
                          </div>
                          {batch.sellingPrice != null && (
                            <p className="shrink-0 font-semibold text-sm">
                              ₹{toNum(batch.sellingPrice).toFixed(2)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  The earliest-expiry batch is auto-selected (FEFO). Pick another to override.
                </p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <PharmacyReceiptDialog sale={receiptSale} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </div>
  );
}

// ============================================================
// Return Bills Tab
// ============================================================

function ReturnBillsTab() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy', 'returns', search],
    queryFn: async () => {
      const response = await apiGet<Array<{
        id: string;
        status: string;
        reason?: string;
        quantity?: number;
        createdAt: string;
        drugBatch?: { drug?: { drugName: string }; batchNumber: string };
        patient?: { firstName: string; lastName: string };
      }>>('/pharmacy/returns', { params: { search: search || undefined, limit: 50 } });
      return response.data;
    },
  });

  const returns = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search return bills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => router.push('/pharmacy/returns')}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Return
        </Button>
      </div>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Return #</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Drug</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Batch</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Qty</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Reason</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : returns.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">No return bills found.</td></tr>
            ) : (
              returns.map((r) => (
                <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">{r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{r.drugBatch?.drug?.drugName ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.drugBatch?.batchNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{r.quantity ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      r.status === 'processed' && 'bg-green-100 text-green-800',
                      r.status === 'pending' && 'bg-amber-100 text-amber-800',
                      r.status === 'rejected' && 'bg-red-100 text-red-800',
                    )}>{r.status?.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Cash Counter Tab
// ============================================================

function PharmacyCashCounterTab() {
  const { data: dispensing, isLoading } = useQuery({
    queryKey: ['pharmacy', 'cash-counter'],
    queryFn: async () => {
      const today = toInputDateStr();
      const response = await apiGet<Array<{
        id: string;
        quantityDispensed: number;
        dispensedAt: string;
        verifiedBy: string | null;
        notes?: string | null;
        unitPrice?: number | string | null;
        lineTotal?: number | string | null;
        drugBatch?: { drug?: { drugName: string }; batchNumber: string; sellingPrice?: number | string };
        patient?: { firstName: string; lastName: string };
      }>>('/pharmacy/dispensing', { params: { fromDate: today, limit: 100 } });
      return response.data;
    },
  });

  const records = dispensing ?? [];
  // Prefer the price actually billed (lineTotal/unitPrice recorded on the sale);
  // fall back to the batch selling price for legacy/queue dispenses.
  const lineAmountOf = (r: {
    lineTotal?: number | string | null;
    unitPrice?: number | string | null;
    quantityDispensed: number;
    drugBatch?: { sellingPrice?: number | string };
  }) => {
    if (r.lineTotal != null) return Number(r.lineTotal);
    const unit = r.unitPrice != null ? Number(r.unitPrice) : Number(r.drugBatch?.sellingPrice ?? 0);
    return unit * (r.quantityDispensed || 0);
  };
  const total = records.reduce((sum, r) => sum + lineAmountOf(r), 0);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Today&apos;s Sales</p>
          <p className="font-headline text-3xl font-extrabold mt-1">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground">{records.length} transactions</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Items Dispensed</p>
          <p className="font-headline text-3xl font-extrabold mt-1">
            {records.reduce((s, r) => s + (r.quantityDispensed || 0), 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Verified</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {records.filter((r) => r.verifiedBy).length}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Drug</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Batch</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Qty</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Time</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">No dispensing records today.</td></tr>
            ) : (
              records.map((r) => {
                const lineAmount = lineAmountOf(r);
                return (
                  <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-medium">{r.drugBatch?.drug?.drugName ?? '-'}</td>
                    <td className="px-4 py-3">{r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.drugBatch?.batchNumber ?? '-'}</td>
                    <td className="px-4 py-3 text-right">{r.quantityDispensed}</td>
                    <td className="px-4 py-3 text-right font-medium">{lineAmount > 0 ? fmt(lineAmount) : '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTime24(r.dispensedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        r.verifiedBy ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800',
                      )}>
                        {r.verifiedBy ? 'verified' : 'dispensed'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
