'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import {
  useFormulary,
  useBatchesByDrug,
  useCreateDispense,
  usePrescriptionQueue,
  usePrescriptionDetail,
  type FormularyItem,
  type DrugBatch,
  type PrescriptionListItem,
} from '@/hooks/use-pharmacy';

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
  // Pricing — pulled from the chosen batch (or formulary fallback)
  sellingPrice: number;
  purchasePrice: number;
  // User-editable
  quantity: number;
  discount: number;
  // Stock check
  availableQty: number;
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

function computeItemNet(item: CartItem): number {
  const base = item.sellingPrice * item.quantity;
  return base - base * (item.discount / 100);
}

function computeItemMargin(item: CartItem): number {
  const cost = item.purchasePrice * item.quantity;
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
  const [paymentModes, setPaymentModes] = useState<string[]>([]);

  // --- Batch picker ---
  const [batchPickerForRow, setBatchPickerForRow] = useState<string | null>(null);
  const [batchPickerDrugId, setBatchPickerDrugId] = useState<string | null>(null);
  const batchPickerRef = useRef<HTMLDivElement>(null);

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
  const createDispense = useCreateDispense();

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
      .map((it) => ({
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
        quantity: it.quantity ?? 1,
        discount: 0,
        availableQty: 0,
      }));
    setCart(newCart);
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
      if (batchPickerRef.current && !batchPickerRef.current.contains(e.target as Node)) {
        setBatchPickerForRow(null);
        setBatchPickerDrugId(null);
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

  // --- Walk-in cart helpers ---
  const addWalkInItem = useCallback((item: FormularyItem) => {
    if (activePrescriptionId) {
      toast.warning('This bill is linked to a prescription. Clear it first to dispense walk-in items.');
      return;
    }
    setCart((prev) => {
      const rowKey = `walk::${item.id}`;
      const existing = prev.find((c) => c.rowKey === rowKey);
      if (existing) {
        if (existing.availableQty > 0 && existing.quantity >= existing.availableQty) {
          toast.warning(`Max available stock: ${existing.availableQty}`);
          return prev;
        }
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
          quantity: 1,
          discount: 0,
          availableQty: 0,
        },
      ];
    });
    setMedicineSearch('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  }, [activePrescriptionId]);

  const selectBatch = useCallback((rowKey: string, batch: DrugBatch) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.rowKey !== rowKey) return c;
        return {
          ...c,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          sellingPrice: toNum(batch.sellingPrice) || c.sellingPrice,
          purchasePrice: toNum(batch.purchasePrice),
          availableQty: batch.quantityInStock,
          expiryDate: batch.expiryDate,
          quantity: Math.min(c.quantity || 1, batch.quantityInStock || 1),
        };
      }),
    );
    setBatchPickerForRow(null);
    setBatchPickerDrugId(null);
  }, []);

  const updateQty = (rowKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.rowKey !== rowKey) return c;
          const newQty = Math.max(0, c.quantity + delta);
          if (c.availableQty > 0 && newQty > c.availableQty) {
            toast.warning(`Max available stock: ${c.availableQty}`);
            return c;
          }
          return { ...c, quantity: newQty };
        })
        .filter((c) => c.quantity > 0),
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

  const togglePaymentMode = (mode: string) => {
    setPaymentModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  };

  // --- Summary ---
  const summary = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + c.sellingPrice * c.quantity, 0);
    const totalDiscount = cart.reduce(
      (s, c) => s + c.sellingPrice * c.quantity * (c.discount / 100),
      0,
    );
    const afterDiscount = subtotal - totalDiscount;
    const rounded = Math.round(afterDiscount);
    const roundOff = Math.round((rounded - afterDiscount) * 100) / 100;
    const margin = cart.reduce((s, c) => s + computeItemMargin(c), 0);
    return { subtotal, totalDiscount, afterDiscount, rounded, roundOff, margin };
  }, [cart]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cartHasAllBatches = cart.length > 0 && cart.every((c) => c.batchId !== null);
  const linkedToPrescription = !!activePrescriptionId && !!activePrescription;
  const prescriptionItemsHaveLinks = !linkedToPrescription
    || cart.every((c) => c.prescriptionItemId !== null);
  const canCreateBill =
    cart.length > 0
    && selectedPatient !== null
    && cartHasAllBatches
    && linkedToPrescription
    && prescriptionItemsHaveLinks;

  const handleCreateBill = async () => {
    if (cart.length === 0) return toast.error('Add at least one medicine to the cart');
    if (!selectedPatient) return toast.error('Please select a patient first');
    if (!cartHasAllBatches) return toast.error('Please select a batch for each medicine');
    if (!linkedToPrescription) return toast.error('Pick a prescription — dispensing requires a doctor order');
    if (paymentModes.length === 0) return toast.error('Please select at least one payment mode');

    try {
      await createDispense.mutateAsync({
        patientId: selectedPatient.id,
        prescriptionId: activePrescriptionId as string,
        items: cart.map((c) => ({
          prescriptionItemId: c.prescriptionItemId as string,
          drugBatchId: c.batchId as string,
          quantity: c.quantity,
        })),
        notes: `Payment: ${paymentModes.join(', ')}`,
      });
      toast.success(`Dispensed ${cart.length} item${cart.length > 1 ? 's' : ''}`);
      setCart([]);
      setPaymentModes([]);
      setActivePrescriptionId(null);
      clearPatient();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to dispense';
      toast.error(message);
    }
  };

  const handleSaveDraft = async () => {
    if (cart.length === 0) return toast.error('Add at least one medicine to the cart');
    const draft = {
      id: crypto.randomUUID(),
      patient: selectedPatient,
      prescriptionId: activePrescriptionId,
      items: cart,
      paymentModes,
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
            placeholder="Search patient by name, mobile, MRN..."
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
                    </p>
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
                        {item.prescriptionItemId && (
                          <p className="text-[10px] uppercase tracking-wide text-emerald-600">From Rx</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 relative">
                        <button
                          onClick={() => {
                            if (batchPickerForRow === item.rowKey) {
                              setBatchPickerForRow(null);
                              setBatchPickerDrugId(null);
                            } else {
                              setBatchPickerForRow(item.rowKey);
                              setBatchPickerDrugId(item.formularyItemId);
                            }
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
                            </>
                          ) : (
                            <>
                              Select Batch
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                        {batchPickerForRow === item.rowKey && (
                          <div
                            ref={batchPickerRef}
                            className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover shadow-lg"
                          >
                            <div className="px-3 py-2 border-b bg-muted/30">
                              <p className="text-xs font-medium text-muted-foreground">
                                Batches for {item.drugName}
                              </p>
                            </div>
                            {batchesLoading ? (
                              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                                Loading batches...
                              </div>
                            ) : availableBatches.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                No available batches
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto">
                                {availableBatches.map((batch) => (
                                  <button
                                    key={batch.id}
                                    onClick={() => selectBatch(item.rowKey, batch)}
                                    className={cn(
                                      'flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b last:border-0 text-xs',
                                      item.batchId === batch.id && 'bg-primary/5',
                                    )}
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">{batch.batchNumber}</p>
                                      <p className="text-muted-foreground">
                                        Exp: {formatDate(batch.expiryDate)}
                                        {' · '}Stock: {batch.quantityInStock}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      {batch.sellingPrice != null && (
                                        <p className="font-semibold text-foreground">{`₹${toNum(batch.sellingPrice).toFixed(2)}`}</p>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateQty(item.rowKey, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.rowKey, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {item.availableQty > 0 && (
                          <p className="text-center text-[10px] text-muted-foreground mt-0.5">
                            Avl: {item.availableQty}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">{`₹${fmt(item.sellingPrice)}`}</td>
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
              <span>Total Qty: {cart.reduce((s, c) => s + c.quantity, 0)}</span>
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Bill Summary</h3>

          {selectedPatient && (
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Patient</p>
              <p className="text-sm font-medium text-foreground">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              {selectedPatient.mrn && (
                <p className="text-xs text-muted-foreground">MRN: {selectedPatient.mrn}</p>
              )}
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
          {cart.length > 0 && !linkedToPrescription && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Pick a prescription — drugs can only be dispensed against a doctor order.
              </p>
            </div>
          )}
          {cart.length > 0 && !cartHasAllBatches && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Select a batch for each medicine before billing.
              </p>
            </div>
          )}
          {cart.length > 0 && !selectedPatient && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">Select a patient to create the bill.</p>
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

          {/* Payment mode */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Mode of Payment</p>
            <div className="flex flex-wrap gap-2">
              {['Cash', 'Card', 'UPI', 'Bank Transfer'].map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={paymentModes.includes(mode)}
                    onChange={() => togglePaymentMode(mode)}
                  />
                  {mode}
                </label>
              ))}
            </div>
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
              disabled={!canCreateBill || createDispense.isPending}
              onClick={handleCreateBill}
            >
              {createDispense.isPending ? 'Dispensing...' : 'Dispense'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Return Bills Tab
// ============================================================

function ReturnBillsTab() {
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
        <Button>New Return</Button>
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
        drugBatch?: { drug?: { drugName: string }; batchNumber: string; sellingPrice?: number | string };
        patient?: { firstName: string; lastName: string };
      }>>('/pharmacy/dispensing', { params: { fromDate: today, limit: 100 } });
      return response.data;
    },
  });

  const records = dispensing ?? [];
  const total = records.reduce((sum, r) => {
    const price = r.drugBatch?.sellingPrice ? Number(r.drugBatch.sellingPrice) : 0;
    return sum + price * (r.quantityDispensed || 0);
  }, 0);
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
                const price = r.drugBatch?.sellingPrice ? Number(r.drugBatch.sellingPrice) : 0;
                const lineAmount = price * (r.quantityDispensed || 0);
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
