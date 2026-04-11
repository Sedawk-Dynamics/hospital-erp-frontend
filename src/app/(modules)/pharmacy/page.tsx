'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Plus, Minus, Trash2, User, Package, ChevronDown } from 'lucide-react';
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
  type FormularyItem,
  type DrugBatch,
} from '@/hooks/use-pharmacy';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';

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

      {/* Forms assigned by admin to pharmacy_home view location appear here */}
      <PatientFormSubmissionsPanel
        title="Pharmacy Forms Submissions"
        viewLocation="pharmacy_home"
      />
    </div>
  );
}

// ============================================================
// Cart Item type
// ============================================================

interface CartItem {
  formularyItemId: string;
  drugName: string;
  genericName: string | null;
  batchNumber: string;
  batchId: string | null;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discount: number; // percentage
  gstRate: number;
  availableQty: number;
  expiryDate: string | null;
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  uhid?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
}

function computeItemAmount(item: CartItem): number {
  const base = item.sellingPrice * item.quantity;
  const discounted = base - base * (item.discount / 100);
  return discounted;
}

// ============================================================
// PharmacyPOS — fully wired billing tab
// ============================================================

function PharmacyPOS() {
  // --- Patient search state ---
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  // --- Medicine search state ---
  const [medicineSearch, setMedicineSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Cart state ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentModes, setPaymentModes] = useState<string[]>([]);

  // --- Batch picker state ---
  const [batchPickerForItem, setBatchPickerForItem] = useState<string | null>(null);
  const [batchPickerDrugId, setBatchPickerDrugId] = useState<string | null>(null);
  const batchPickerRef = useRef<HTMLDivElement>(null);

  // --- Debounced search terms ---
  const [debouncedMedicine, setDebouncedMedicine] = useState('');
  const [debouncedPatient, setDebouncedPatient] = useState('');

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

  // --- Medicine search query (formulary) ---
  const { data: formularyData, isLoading: searchLoading } = useFormulary({
    search: debouncedMedicine || undefined,
    limit: 15,
  });

  const searchResults = formularyData?.data ?? [];

  // --- Batch fetch for batch picker ---
  const { data: batchesForDrug, isLoading: batchesLoading } = useBatchesByDrug(batchPickerDrugId);

  // Filter out expired / zero-stock batches
  const availableBatches = (batchesForDrug ?? []).filter(
    (b) => b.availableQuantity > 0 && new Date(b.expiryDate) > new Date()
  );

  // --- Create dispense mutation ---
  const createDispense = useCreateDispense();

  // --- Close dropdowns on outside click ---
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
      if (batchPickerRef.current && !batchPickerRef.current.contains(e.target as Node)) {
        setBatchPickerForItem(null);
        setBatchPickerDrugId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Select patient ---
  const selectPatient = useCallback((patient: PatientResult) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
  }, []);

  const clearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientSearch('');
  }, []);

  // --- Add medicine to cart ---
  const addToCart = useCallback((item: FormularyItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.formularyItemId === item.id);
      if (existing) {
        if (existing.availableQty > 0 && existing.quantity >= existing.availableQty) {
          toast.warning(`Max available stock: ${existing.availableQty}`);
          return prev;
        }
        return prev.map((c) =>
          c.formularyItemId === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          formularyItemId: item.id,
          drugName: item.drugName,
          genericName: item.genericName,
          batchNumber: '-',
          batchId: null,
          quantity: 1,
          mrp: item.mrp != null ? Number(item.mrp) : item.sellingPrice != null ? Number(item.sellingPrice) : 0,
          sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : item.mrp != null ? Number(item.mrp) : 0,
          discount: 0,
          gstRate: item.gstRate != null ? Number(item.gstRate) : 0,
          availableQty: 0, // will be set when batch is selected
          expiryDate: null,
        },
      ];
    });
    setMedicineSearch('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  }, []);

  // --- Select batch for a cart item ---
  const selectBatch = useCallback((formularyItemId: string, batch: DrugBatch) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.formularyItemId !== formularyItemId) return c;
        const sp = batch.sellingPrice != null ? Number(batch.sellingPrice) : c.sellingPrice;
        const mrp = batch.mrp != null ? Number(batch.mrp) : c.mrp;
        const gst = batch.gstRate != null ? Number(batch.gstRate) : c.gstRate;
        return {
          ...c,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          sellingPrice: sp,
          mrp,
          gstRate: gst,
          availableQty: batch.availableQuantity,
          expiryDate: batch.expiryDate,
          quantity: Math.min(c.quantity, batch.availableQuantity),
        };
      })
    );
    setBatchPickerForItem(null);
    setBatchPickerDrugId(null);
  }, []);

  // --- Quantity helpers ---
  const updateQty = (formularyItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.formularyItemId !== formularyItemId) return c;
          const newQty = Math.max(0, c.quantity + delta);
          if (c.availableQty > 0 && newQty > c.availableQty) {
            toast.warning(`Max available stock: ${c.availableQty}`);
            return c;
          }
          return { ...c, quantity: newQty };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (formularyItemId: string) => {
    setCart((prev) => prev.filter((c) => c.formularyItemId !== formularyItemId));
  };

  const updateDiscount = (formularyItemId: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.formularyItemId === formularyItemId
          ? { ...c, discount: Math.min(100, Math.max(0, discount)) }
          : c
      )
    );
  };

  // --- Toggle payment mode ---
  const togglePaymentMode = (mode: string) => {
    setPaymentModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  // --- Summary calculations ---
  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const totalDiscount = cart.reduce((sum, item) => {
    const base = item.sellingPrice * item.quantity;
    return sum + base * (item.discount / 100);
  }, 0);
  const afterDiscount = subtotal - totalDiscount;
  const totalTax = cart.reduce((sum, item) => {
    const amount = computeItemAmount(item);
    return sum + amount * (item.gstRate / 100);
  }, 0);
  const grandTotal = afterDiscount + totalTax;
  const roundedTotal = Math.round(grandTotal * 100) / 100;
  const roundOff = Math.round((roundedTotal - grandTotal) * 100) / 100;

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Validation helpers ---
  const cartHasAllBatches = cart.every((c) => c.batchId !== null);
  const canCreateBill = cart.length > 0 && selectedPatient !== null && cartHasAllBatches;

  // --- Create bill handler ---
  const handleCreateBill = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one medicine to the cart');
      return;
    }
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    if (!cartHasAllBatches) {
      toast.error('Please select a batch for each medicine');
      return;
    }
    if (paymentModes.length === 0) {
      toast.error('Please select at least one payment mode');
      return;
    }

    try {
      await createDispense.mutateAsync({
        patientId: selectedPatient.id,
        items: cart.map((c) => ({
          drugBatchId: c.batchId!,
          quantity: c.quantity,
        })),
        notes: paymentModes.length > 0 ? `Payment: ${paymentModes.join(', ')}` : undefined,
      });
      toast.success('Bill created successfully');
      setCart([]);
      setPaymentModes([]);
      clearPatient();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create bill';
      toast.error(message);
    }
  };

  // --- Save draft handler ---
  const handleSaveDraft = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one medicine to the cart');
      return;
    }

    // Save draft to localStorage for now (backend doesn't have a draft status)
    const draft = {
      id: crypto.randomUUID(),
      patient: selectedPatient,
      items: cart,
      paymentModes,
      subtotal,
      totalDiscount,
      grandTotal: roundedTotal,
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
      {/* Patient search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md" ref={patientDropdownRef}>
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient by name, mobile, UHID..."
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

          {/* Selected patient chip */}
          {selectedPatient && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {selectedPatient.uhid && <span className="text-primary/70">{selectedPatient.uhid}</span>}
                <button
                  onClick={clearPatient}
                  className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                >
                  &times;
                </button>
              </span>
            </div>
          )}

          {/* Patient search dropdown */}
          {showPatientDropdown && patientSearch.length >= 2 && !selectedPatient && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {patientLoading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Searching patients...
                </div>
              ) : patientResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No patients found
                </div>
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
                        {p.uhid && <span className="ml-2 text-xs text-muted-foreground">({p.uhid})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.mobile || p.phone || ''}{p.gender ? ` \u00b7 ${p.gender}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm">IP List</Button>
        <Button variant="outline" size="sm">Prescription</Button>
      </div>

      {/* Medicine search */}
      <div className="relative max-w-lg" ref={dropdownRef}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          ref={searchInputRef}
          placeholder="Search medicine by name..."
          value={medicineSearch}
          onChange={(e) => {
            setMedicineSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (medicineSearch.length > 0) setShowDropdown(true);
          }}
          className="pl-9"
        />
        {/* Search results dropdown */}
        {showDropdown && medicineSearch.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                No medicines found
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.drugName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.genericName && `${item.genericName} \u00b7 `}
                      {item.dosageForm && `${item.dosageForm} `}
                      {item.strength && `${item.strength}`}
                      {item.manufacturer && ` \u00b7 ${item.manufacturer}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.mrp != null ? `\u20B9${Number(item.mrp).toFixed(2)}` : '-'}
                    </p>
                    {item.sellingPrice != null && item.sellingPrice !== item.mrp && (
                      <p className="text-xs text-muted-foreground">
                        Sell: \u20B9{Number(item.sellingPrice).toFixed(2)}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* POS-style billing area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-3">
        {/* Line items */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Medicine Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Batch</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">MRP</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Disc %</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                      Search for medicines to add to bill
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.formularyItemId} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{item.drugName}</p>
                        {item.genericName && (
                          <p className="text-xs text-muted-foreground">{item.genericName}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 relative">
                        <button
                          onClick={() => {
                            if (batchPickerForItem === item.formularyItemId) {
                              setBatchPickerForItem(null);
                              setBatchPickerDrugId(null);
                            } else {
                              setBatchPickerForItem(item.formularyItemId);
                              setBatchPickerDrugId(item.formularyItemId);
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                            item.batchId
                              ? 'bg-muted/50 hover:bg-muted text-foreground'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
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

                        {/* Batch picker dropdown */}
                        {batchPickerForItem === item.formularyItemId && (
                          <div
                            ref={batchPickerRef}
                            className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover shadow-lg"
                          >
                            <div className="px-3 py-2 border-b bg-muted/30">
                              <p className="text-xs font-medium text-muted-foreground">
                                Available Batches for {item.drugName}
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
                                    onClick={() => selectBatch(item.formularyItemId, batch)}
                                    className={cn(
                                      'flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b last:border-0 text-xs',
                                      item.batchId === batch.id && 'bg-primary/5'
                                    )}
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">{batch.batchNumber}</p>
                                      <p className="text-muted-foreground">
                                        Exp: {formatDate(batch.expiryDate)}
                                        {' \u00b7 '}Stock: {batch.availableQuantity}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      {batch.sellingPrice != null && (
                                        <p className="font-semibold text-foreground">{`\u20B9${Number(batch.sellingPrice).toFixed(2)}`}</p>
                                      )}
                                      {batch.mrp != null && (
                                        <p className="text-muted-foreground">MRP: {`\u20B9${Number(batch.mrp).toFixed(2)}`}</p>
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
                            onClick={() => updateQty(item.formularyItemId, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.formularyItemId, 1)}
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
                      <td className="px-3 py-2.5 text-right">{`\u20B9${fmt(item.mrp)}`}</td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount}
                          onChange={(e) => updateDiscount(item.formularyItemId, Number(e.target.value))}
                          className="h-7 w-16 text-center text-xs mx-auto"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {`\u20B9${fmt(computeItemAmount(item))}`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => removeItem(item.formularyItemId)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
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
          {/* Cart item count */}
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

          {/* Patient info */}
          {selectedPatient && (
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Patient</p>
              <p className="text-sm font-medium text-foreground">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              {selectedPatient.uhid && (
                <p className="text-xs text-muted-foreground">UHID: {selectedPatient.uhid}</p>
              )}
            </div>
          )}

          {/* Validation warnings */}
          {cart.length > 0 && !cartHasAllBatches && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Select a batch for each medicine before creating the bill.
              </p>
            </div>
          )}
          {cart.length > 0 && !selectedPatient && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Search and select a patient to create the bill.
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{`\u20B9${fmt(subtotal)}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium text-green-600">{totalDiscount > 0 ? `-\u20B9${fmt(totalDiscount)}` : '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (GST)</span>
              <span className="font-medium">{`\u20B9${fmt(totalTax)}`}</span>
            </div>
            {roundOff !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Round Off</span>
                <span className="font-medium">{roundOff > 0 ? `+${fmt(roundOff)}` : fmt(roundOff)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between text-base">
              <span className="font-semibold">Grand Total</span>
              <span className="font-bold text-primary">{`\u20B9${fmt(roundedTotal)}`}</span>
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
              {createDispense.isPending ? 'Creating...' : 'Create Bill'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Return Bills Tab (unchanged)
// ============================================================

function ReturnBillsTab() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy', 'returns', search],
    queryFn: async () => {
      const response = await apiGet<Array<{
        id: string; returnNumber?: string; status: string; reason?: string; createdAt: string;
        drugBatch?: { drug?: { drugName: string }; batchNumber: string };
        quantity?: number; amount?: number;
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
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Reason</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : returns.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No return bills found.</td></tr>
            ) : (
              returns.map((r) => (
                <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">{r.returnNumber ?? r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{r.drugBatch?.drug?.drugName ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.drugBatch?.batchNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{r.quantity ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.amount != null ? `\u20B9${Number(r.amount).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      r.status === 'approved' && 'bg-green-100 text-green-800',
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
// Cash Counter Tab (unchanged)
// ============================================================

function PharmacyCashCounterTab() {
  const { data: dispensing, isLoading } = useQuery({
    queryKey: ['pharmacy', 'cash-counter'],
    queryFn: async () => {
      const today = toInputDateStr();
      const response = await apiGet<Array<{
        id: string; quantity: number; totalCost?: number; status: string; createdAt: string;
        drugBatch?: { drug?: { drugName: string }; batchNumber: string; sellingPrice?: number };
        patient?: { firstName: string; lastName: string };
        prescription?: { id: string };
      }>>('/pharmacy/dispensing', { params: { startDate: today, limit: 100 } });
      return response.data;
    },
  });

  const records = dispensing ?? [];
  const total = records.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
  const fmt = (n: number) => `\u20B9${n.toLocaleString('en-IN')}`;

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
          <p className="font-headline text-3xl font-extrabold mt-1">{records.reduce((s, r) => s + (r.quantity || 0), 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Verified</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{records.filter((r) => r.status === 'verified').length}</p>
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
              records.map((r) => (
                <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">{r.drugBatch?.drug?.drugName ?? '-'}</td>
                  <td className="px-4 py-3">{r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.drugBatch?.batchNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{r.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.totalCost != null ? fmt(Number(r.totalCost)) : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatTime24(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      r.status === 'dispensed' && 'bg-blue-100 text-blue-800',
                      r.status === 'verified' && 'bg-green-100 text-green-800',
                      r.status === 'pending' && 'bg-amber-100 text-amber-800',
                    )}>{r.status}</span>
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
