'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ChevronsUpDown,
  Check,
  Pencil,
  ShieldAlert,
  AlertOctagon,
  Phone,
  Mail,
  Printer,
  RotateCcw,
  Activity,
  ShieldX,
  SlidersHorizontal,
  ClipboardList,
  ClipboardCheck,
  Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import { packSummary } from '@/lib/pharmacy-units';
import {
  AdjustStockDialog,
  StockAdjustmentsLogDialog,
} from '@/components/pharmacy/stock-adjust-dialogs';
import { BulkInwardDialog } from '@/components/pharmacy/bulk-inward-dialog';
import { StockTakeDialog } from '@/components/pharmacy/stock-take-dialog';
import {
  useBatches,
  useCreateBatch,
  useUpdateBatch,
  useRunPharmacyExpiryAlerts,
  useExpiringBatches,
  useFormulary,
  useRecalledItems,
  useRecallAffectedPatients,
  useRecallBatch,
  useUnrecallBatch,
  useRecallDrug,
  useAdjustBatchStock,
  useStockAdjustments,
  type CreateBatchInput,
  type UpdateBatchInput,
  type DrugBatch,
} from '@/hooks/use-pharmacy';
import { useSuppliers, useInventorySettings } from '@/hooks/use-inventory';

interface FormState {
  drugId: string;
  drugLabel: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  supplierId: string;
  // G2 purchase-side discount structure.
  mrp: string;
  purchasePrice: string;
  purchaseDiscountPercent: string;
  gstPercent: string;
  freeQuantity: string;
  sellingPrice: string;
  quantityReceived: string;
  // GRN invoice traceability.
  invoiceNumber: string;
  invoiceDate: string;
  // Edit-only: correct the on-hand stock for an existing batch.
  quantityInStock: string;
}

const EMPTY_FORM: FormState = {
  drugId: '',
  drugLabel: '',
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  supplierId: '',
  mrp: '',
  purchasePrice: '',
  purchaseDiscountPercent: '',
  gstPercent: '',
  freeQuantity: '',
  sellingPrice: '',
  quantityReceived: '',
  invoiceNumber: '',
  invoiceDate: '',
  quantityInStock: '',
};

// ISO date → yyyy-MM-dd for <input type="date">.
const isoToDateInput = (s: string | null | undefined) => (s ? s.slice(0, 10) : '');

function formStateFromBatch(batch: DrugBatch): FormState {
  return {
    drugId: batch.drugId,
    drugLabel: `${batch.drug?.drugName ?? ''}${batch.drug?.strength ? ` ${batch.drug.strength}` : ''}`,
    batchNumber: batch.batchNumber,
    manufacturingDate: isoToDateInput(batch.manufacturingDate),
    expiryDate: isoToDateInput(batch.expiryDate),
    supplierId: batch.supplierId ?? '',
    mrp: batch.mrp != null ? String(batch.mrp) : '',
    purchasePrice: batch.purchasePrice != null ? String(batch.purchasePrice) : '',
    purchaseDiscountPercent:
      batch.purchaseDiscountPercent != null ? String(batch.purchaseDiscountPercent) : '',
    gstPercent: batch.gstPercent != null ? String(batch.gstPercent) : '',
    freeQuantity: batch.freeQuantity != null ? String(batch.freeQuantity) : '',
    sellingPrice: batch.sellingPrice != null ? String(batch.sellingPrice) : '',
    quantityReceived: String(batch.quantityReceived),
    invoiceNumber: batch.invoiceNumber ?? '',
    invoiceDate: isoToDateInput(batch.invoiceDate),
    quantityInStock: String(batch.quantityInStock),
  };
}

function daysUntil(date: string | Date): number {
  const target = new Date(date).getTime();
  const now = Date.now();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function PharmacyBatchesPageInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drugFilter, setDrugFilter] = useState<string | null>(null);
  const [expiringDays, setExpiringDays] = useState<number | null>(null);
  const [recalledOnly, setRecalledOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // G1: bulk stock inward (CSV / OCR / manual) with fuzzy duplicate review.
  const [bulkInwardOpen, setBulkInwardOpen] = useState(false);
  // G4: physical stock-take (count sheet → flagged variances → audited corrections).
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<DrugBatch | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  // G4: stock-count adjustment + discrepancy log.
  const [adjustTarget, setAdjustTarget] = useState<DrugBatch | null>(null);
  const [adjustLogOpen, setAdjustLogOpen] = useState(false);

  // Recall management (moved here from the old Recalls page — recalls act on batches).
  const [recallTarget, setRecallTarget] = useState<DrugBatch | null>(null);
  const [affectedBatchId, setAffectedBatchId] = useState<string | null>(null);
  const [drugRecallOpen, setDrugRecallOpen] = useState(false);

  // Drug picker (combobox) state
  const [drugSearchInput, setDrugSearchInput] = useState('');
  const [drugComboOpen, setDrugComboOpen] = useState(false);
  const [drugFilterComboOpen, setDrugFilterComboOpen] = useState(false);
  const [debouncedDrugSearch, setDebouncedDrugSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDrugSearch(drugSearchInput), 250);
    return () => clearTimeout(t);
  }, [drugSearchInput]);

  // Data
  const { data: formulary } = useFormulary({
    search: debouncedDrugSearch || undefined,
    isActive: true,
    limit: 25,
  });
  const drugs = formulary?.data ?? [];

  const { data: suppliersData } = useSuppliers({ limit: 50 });
  const suppliers = suppliersData?.data ?? [];

  // G5: per-pharmacy configurable expiry alert threshold (Inventory Settings).
  const { data: invSettings } = useInventorySettings();
  const configuredMonths = invSettings?.expiryAlertMonths ?? 3;
  const configuredDays = configuredMonths * 30;

  const allBatches = useBatches({
    page,
    limit: 20,
    search: search || undefined,
    drugId: drugFilter ?? undefined,
    isRecalled: recalledOnly ? true : undefined,
  });

  const expiringBatches = useExpiringBatches(
    expiringDays ? { days: expiringDays, page, limit: 20 } : undefined,
  );

  // Formulary-level recalled drugs — shown as a panel in the Recalled view.
  const { data: recalledItems } = useRecalledItems('all');
  const recalledDrugs = recalledItems?.recalledDrugs ?? [];

  // Expiry overview (drug stock expiring within 90 days) — drives the summary
  // cards. Capped at 1000 batches, which comfortably covers a tenant's near-
  // expiry window. Value at risk = selling price × on-hand units.
  const { data: expirySummaryData } = useExpiringBatches({ days: 90, limit: 1000 });
  const expirySummary = useMemo(() => {
    const rows = expirySummaryData?.data ?? [];
    let within30 = 0;
    let withinConfigured = 0;
    let valueAtRisk = 0;
    for (const b of rows) {
      const d = daysUntil(b.expiryDate);
      if (d <= 30) within30 += 1;
      if (d <= configuredDays) withinConfigured += 1;
      valueAtRisk += (Number(b.sellingPrice) || 0) * (b.quantityInStock || 0);
    }
    return { within90: rows.length, within30, withinConfigured, valueAtRisk };
  }, [expirySummaryData, configuredDays]);

  const data = expiringDays ? expiringBatches.data : allBatches.data;
  const isLoading = expiringDays ? expiringBatches.isLoading : allBatches.isLoading;
  const batches = data?.data ?? [];
  const meta = data?.meta;

  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const runExpiry = useRunPharmacyExpiryAlerts();
  const unrecall = useUnrecallBatch();

  const handleLiftRecall = async (batch: DrugBatch) => {
    if (!confirm('Lift the recall on this batch? Dispensing will be allowed again.')) return;
    try {
      await unrecall.mutateAsync(batch.id);
      toast.success('Recall lifted');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to lift recall');
    }
  };

  const updateField = (field: keyof FormState, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const closeDialog = () => {
    setCreateOpen(false);
    setEditingBatch(null);
    setFormData(EMPTY_FORM);
    setDrugSearchInput('');
  };

  const startCreate = () => {
    setEditingBatch(null);
    setFormData(EMPTY_FORM);
    setDrugSearchInput('');
    setCreateOpen(true);
  };

  const startEdit = (batch: DrugBatch) => {
    setEditingBatch(batch);
    setFormData(formStateFromBatch(batch));
    setCreateOpen(true);
  };

  const handleRunExpiry = async () => {
    try {
      const res = await runExpiry.mutateAsync();
      const flagged = res?.expiredFlagged ?? 0;
      const alerts = res?.expiryAlerts ?? 0;
      const parts = [
        flagged > 0 ? `${flagged} expired batch${flagged === 1 ? '' : 'es'} flagged` : null,
        alerts > 0 ? `${alerts} near-expiry alert${alerts === 1 ? '' : 's'} sent` : null,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(' · ') : 'No expired or near-expiry stock found');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run expiry check');
    }
  };

  const handleUpdate = async () => {
    if (!editingBatch) return;
    if (!formData.batchNumber.trim()) return toast.error('Batch number is required');
    if (!formData.expiryDate) return toast.error('Expiry date is required');
    const stock = parseInt(formData.quantityInStock, 10);
    if (isNaN(stock) || stock < 0) return toast.error('Stock quantity must be 0 or more');

    const payload: UpdateBatchInput = {
      batchNumber: formData.batchNumber.trim(),
      expiryDate: formData.expiryDate,
      quantityInStock: stock,
      manufacturingDate: formData.manufacturingDate || null,
      supplierId: formData.supplierId || null,
      mrp:
        formData.mrp && !isNaN(parseFloat(formData.mrp)) ? parseFloat(formData.mrp) : null,
      purchasePrice:
        formData.purchasePrice && !isNaN(parseFloat(formData.purchasePrice))
          ? parseFloat(formData.purchasePrice)
          : null,
      purchaseDiscountPercent:
        formData.purchaseDiscountPercent && !isNaN(parseFloat(formData.purchaseDiscountPercent))
          ? parseFloat(formData.purchaseDiscountPercent)
          : null,
      gstPercent:
        formData.gstPercent && !isNaN(parseFloat(formData.gstPercent))
          ? parseFloat(formData.gstPercent)
          : null,
      sellingPrice:
        formData.sellingPrice && !isNaN(parseFloat(formData.sellingPrice))
          ? parseFloat(formData.sellingPrice)
          : null,
      invoiceNumber: formData.invoiceNumber.trim() || null,
      invoiceDate: formData.invoiceDate || null,
    };
    try {
      await updateBatch.mutateAsync({ id: editingBatch.id, ...payload });
      toast.success('Batch updated');
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update batch');
    }
  };

  const selectedDrugForFilter = useMemo(
    () => drugs.find((d) => d.id === drugFilter) ?? null,
    [drugs, drugFilter],
  );

  const handleSubmit = async () => {
    if (!formData.drugId) return toast.error('Pick a drug from the formulary');
    if (!formData.batchNumber.trim()) return toast.error('Batch number is required');
    if (!formData.expiryDate) return toast.error('Expiry date is required');
    const paidQty = parseInt(formData.quantityReceived, 10);
    if (!paidQty || paidQty <= 0) return toast.error('Quantity received must be > 0');
    const freeQty = parseInt(formData.freeQuantity, 10) || 0;

    const payload: CreateBatchInput = {
      drugId: formData.drugId,
      batchNumber: formData.batchNumber.trim(),
      expiryDate: formData.expiryDate,
      // Total received = paid + free; the free portion is recorded separately.
      quantityReceived: paidQty + freeQty,
      freeQuantity: freeQty,
    };
    if (formData.manufacturingDate) payload.manufacturingDate = formData.manufacturingDate;
    if (formData.supplierId) payload.supplierId = formData.supplierId;
    if (formData.mrp && !isNaN(parseFloat(formData.mrp))) payload.mrp = parseFloat(formData.mrp);
    if (formData.purchasePrice && !isNaN(parseFloat(formData.purchasePrice))) {
      payload.purchasePrice = parseFloat(formData.purchasePrice);
    }
    if (formData.purchaseDiscountPercent && !isNaN(parseFloat(formData.purchaseDiscountPercent))) {
      payload.purchaseDiscountPercent = parseFloat(formData.purchaseDiscountPercent);
    }
    if (formData.gstPercent && !isNaN(parseFloat(formData.gstPercent))) {
      payload.gstPercent = parseFloat(formData.gstPercent);
    }
    if (formData.sellingPrice && !isNaN(parseFloat(formData.sellingPrice))) {
      payload.sellingPrice = parseFloat(formData.sellingPrice);
    }
    if (formData.invoiceNumber.trim()) payload.invoiceNumber = formData.invoiceNumber.trim();
    if (formData.invoiceDate) payload.invoiceDate = formData.invoiceDate;

    try {
      await createBatch.mutateAsync(payload);
      toast.success('Batch added');
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      setDrugSearchInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create batch';
      // Manual GRN Step 6: the batch number already exists — offer to fold the
      // received quantity into it (Increase Quantity) instead of creating a dup.
      if (/already exists/i.test(msg)) {
        const ok = window.confirm(
          `Batch "${formData.batchNumber.trim()}" already exists for this drug.\n\n` +
            `Add the received ${paidQty + freeQty} unit(s) to the existing batch (Increase Quantity)?`,
        );
        if (ok) {
          try {
            await createBatch.mutateAsync({ ...payload, addToExisting: true });
            toast.success('Quantity added to existing batch');
            setCreateOpen(false);
            setFormData(EMPTY_FORM);
            setDrugSearchInput('');
          } catch (err2) {
            toast.error(err2 instanceof Error ? err2.message : 'Failed to update batch');
          }
        }
        return;
      }
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Drug Batches</h1>
          <p className="text-sm text-muted-foreground">
            Receive stock, track expiry, and manage recalls. Recalled batches are auto-blocked from dispensing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDrugRecallOpen(true)}
            title="Recall a drug and block all of its batches from dispensing"
          >
            <ShieldAlert className="mr-1.5 h-4 w-4 text-red-600" />
            Recall Drug
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunExpiry}
            disabled={runExpiry.isPending}
            title="Flag past-expiry batches and alert managers about near-expiry stock (per the configured threshold)"
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            {runExpiry.isPending ? 'Checking...' : 'Run expiry check'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStockTakeOpen(true)}
            title="Count the shelf — flag and correct stock discrepancies"
          >
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Stock Take
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustLogOpen(true)}
            title="View the stock-adjustment discrepancy log"
          >
            <ClipboardList className="mr-1.5 h-4 w-4" />
            Adjustments
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkInwardOpen(true)}
            title="Receive a whole distributor invoice — checks each line for duplicates first"
          >
            <Boxes className="mr-1.5 h-4 w-4" />
            Bulk Stock In
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Batch
          </Button>
        </div>
      </div>

      {/* G1: bulk stock inward with fuzzy duplicate review (CSV / OCR / manual) */}
      <BulkInwardDialog open={bulkInwardOpen} onOpenChange={setBulkInwardOpen} />

      {/* G4: physical stock-take — count sheet → flagged variances → audited corrections */}
      <StockTakeDialog open={stockTakeOpen} onOpenChange={setStockTakeOpen} />

      {/* Expiry overview — at-a-glance near-expiry exposure (drug stock). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          onClick={() => { setExpiringDays(configuredDays); setRecalledOnly(false); setPage(1); }}
          className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 text-left shadow-sanctuary transition hover:ring-1 hover:ring-amber-500/30"
          title="Alert threshold — configurable in Inventory Settings"
        >
          <div>
            <p className="text-xs text-muted-foreground">
              Expiry alert (≤{configuredMonths} mo)
            </p>
            <p className="mt-0.5 text-2xl font-bold text-amber-700">{expirySummary.withinConfigured}</p>
          </div>
          <AlertTriangle className="h-7 w-7 text-amber-500/60" />
        </button>
        <button
          onClick={() => { setExpiringDays(90); setRecalledOnly(false); setPage(1); }}
          className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 text-left shadow-sanctuary transition hover:ring-1 hover:ring-primary/30"
        >
          <div>
            <p className="text-xs text-muted-foreground">Expiring ≤90 days</p>
            <p className="mt-0.5 text-2xl font-bold">{expirySummary.within90}</p>
          </div>
          <Activity className="h-7 w-7 text-muted-foreground/40" />
        </button>
        <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
          <div>
            <p className="text-xs text-muted-foreground">Value at risk (≤90 days)</p>
            <p className="mt-0.5 text-2xl font-bold text-red-700 font-mono">
              ₹{expirySummary.valueAtRisk.toFixed(2)}
            </p>
          </div>
          <ShieldX className="h-7 w-7 text-red-500/50" />
        </div>
      </div>

      {/* Create / edit batch dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setCreateOpen(true); }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBatch ? 'Edit Batch' : 'Receive New Batch'}</DialogTitle>
              <DialogDescription>
                {editingBatch
                  ? 'Update this batch’s details. Adjust on-hand stock here if you are correcting a count.'
                  : 'Record a batch of drugs received from a supplier. Stock is added immediately.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Drug — picker on create; a batch can't change its drug, so it's read-only on edit */}
              {editingBatch ? (
                <div className="space-y-1.5">
                  <Label>Drug</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                    {formData.drugLabel || '—'}
                  </div>
                </div>
              ) : (
              <div className="space-y-1.5">
                <Label>Drug *</Label>
                <Popover open={drugComboOpen} onOpenChange={setDrugComboOpen}>
                  <PopoverTrigger render={
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className={formData.drugLabel ? '' : 'text-muted-foreground'}>
                        {formData.drugLabel || 'Search drug name...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  } />
                  <PopoverContent className="w-[480px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Type to search drugs..."
                        value={drugSearchInput}
                        onValueChange={setDrugSearchInput}
                      />
                      <CommandList>
                        <CommandEmpty>No drug found.</CommandEmpty>
                        <CommandGroup>
                          {drugs.map((drug) => (
                            <CommandItem
                              key={drug.id}
                              value={drug.id}
                              onSelect={() => {
                                updateField('drugId', drug.id);
                                updateField(
                                  'drugLabel',
                                  `${drug.drugName}${drug.strength ? ' ' + drug.strength : ''}${drug.dosageForm ? ' (' + drug.dosageForm + ')' : ''}`,
                                );
                                setDrugComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  formData.drugId === drug.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <div className="flex flex-col">
                                <span>
                                  {drug.drugName}
                                  {drug.strength ? ` ${drug.strength}` : ''}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {drug.genericName || ''}
                                  {drug.manufacturer ? ` · ${drug.manufacturer}` : ''}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="batchNumber">Batch Number *</Label>
                  <Input
                    id="batchNumber"
                    value={formData.batchNumber}
                    onChange={(e) => updateField('batchNumber', e.target.value)}
                    placeholder="e.g. B23A001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => updateField('supplierId', value ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* G10: auto-filled vendor metadata so it isn't re-keyed per invoice */}
                  {(() => {
                    const s = suppliers.find((x) => x.id === formData.supplierId);
                    if (!s) return null;
                    const meta = [
                      s.gstNumber ? `GSTIN ${s.gstNumber}` : null,
                      s.licenseNumber ? `DL ${s.licenseNumber}` : null,
                      s.phone || s.contactPerson || null,
                    ].filter(Boolean);
                    return meta.length ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{meta.join(' · ')}</p>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* GRN invoice traceability (design-doc manual GRN Steps 1/8/9) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceNumber">Invoice No.</Label>
                  <Input
                    id="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) => updateField('invoiceNumber', e.target.value)}
                    placeholder="Supplier invoice number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => updateField('invoiceDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manufacturingDate">Manufacturing Date</Label>
                  <Input
                    id="manufacturingDate"
                    type="date"
                    value={formData.manufacturingDate}
                    onChange={(e) => updateField('manufacturingDate', e.target.value)}
                    max={toInputDateStr()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiryDate">Expiry Date *</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => updateField('expiryDate', e.target.value)}
                    min={formData.manufacturingDate || undefined}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {editingBatch ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="quantityInStock">Qty In Stock *</Label>
                      <Input
                        id="quantityInStock"
                        type="number"
                        min={0}
                        value={formData.quantityInStock}
                        onChange={(e) => updateField('quantityInStock', e.target.value)}
                        placeholder="On-hand units"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="quantityReceived">Qty Received *</Label>
                        <Input
                          id="quantityReceived"
                          type="number"
                          min={1}
                          value={formData.quantityReceived}
                          onChange={(e) => updateField('quantityReceived', e.target.value)}
                          placeholder="e.g. 100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="freeQuantity">Free Qty</Label>
                        <Input
                          id="freeQuantity"
                          type="number"
                          min={0}
                          value={formData.freeQuantity}
                          onChange={(e) => updateField('freeQuantity', e.target.value)}
                          placeholder="e.g. 10"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="mrp">MRP</Label>
                    <Input
                      id="mrp"
                      type="number"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) => updateField('mrp', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="purchasePrice">Purchase Rate</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => updateField('purchasePrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchaseDiscountPercent">Disc %</Label>
                    <Input
                      id="purchaseDiscountPercent"
                      type="number"
                      step="0.01"
                      value={formData.purchaseDiscountPercent}
                      onChange={(e) => updateField('purchaseDiscountPercent', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  {/* G2: net purchase price as a distinct (derived) field — rate − discount */}
                  <div className="space-y-1.5">
                    <Label>Net Rate</Label>
                    <Input
                      type="number"
                      readOnly
                      tabIndex={-1}
                      className="bg-muted/40"
                      placeholder="—"
                      title="Net purchase price per unit = purchase rate − discount"
                      value={(() => {
                        const r = parseFloat(formData.purchasePrice);
                        if (!r || isNaN(r)) return '';
                        const d = parseFloat(formData.purchaseDiscountPercent) || 0;
                        return (r * (1 - d / 100)).toFixed(2);
                      })()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gstPercent">GST %</Label>
                    <Input
                      id="gstPercent"
                      type="number"
                      step="0.01"
                      value={formData.gstPercent}
                      onChange={(e) => updateField('gstPercent', e.target.value)}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sellingPrice">Selling Price</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => updateField('sellingPrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {/* G2: live derived purchase economics */}
                {(() => {
                  const rate = parseFloat(formData.purchasePrice);
                  if (!rate || isNaN(rate)) return null;
                  const disc = parseFloat(formData.purchaseDiscountPercent) || 0;
                  const gst = parseFloat(formData.gstPercent) || 0;
                  const paid = parseInt(formData.quantityReceived || formData.quantityInStock, 10) || 0;
                  const free = parseInt(formData.freeQuantity, 10) || 0;
                  const total = paid + free || 1;
                  const netRate = rate * (1 - disc / 100);
                  const netValue = netRate * paid;
                  const landingPerUnit = (netValue * (1 + gst / 100)) / total;
                  const sell = parseFloat(formData.sellingPrice);
                  const margin = !isNaN(sell) ? sell - landingPerUnit : null;
                  const marginPct = margin != null && landingPerUnit ? (margin / landingPerUnit) * 100 : null;
                  const f = (n: number) => `₹${n.toFixed(2)}`;
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                      <span>Net rate: <span className="font-medium text-foreground">{f(netRate)}</span></span>
                      <span>Net value: <span className="font-medium text-foreground">{f(netValue)}</span></span>
                      <span>Landing/unit: <span className="font-medium text-foreground">{f(landingPerUnit)}</span></span>
                      {margin != null && (
                        <span className={margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          Margin/unit: <span className="font-medium">{f(margin)}</span>
                          {marginPct != null ? ` (${marginPct.toFixed(1)}%)` : ''}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              {editingBatch ? (
                <Button onClick={handleUpdate} disabled={updateBatch.isPending}>
                  {updateBatch.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={createBatch.isPending}>
                  {createBatch.isPending ? 'Saving...' : 'Add Batch'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by batch number or drug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Drug filter combobox */}
        <Popover open={drugFilterComboOpen} onOpenChange={setDrugFilterComboOpen}>
          <PopoverTrigger render={
            <Button variant="outline" size="sm" className="font-normal">
              {selectedDrugForFilter ? selectedDrugForFilter.drugName : 'All drugs'}
              <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
            </Button>
          } />
          <PopoverContent className="w-[360px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search drug..."
                value={drugSearchInput}
                onValueChange={setDrugSearchInput}
              />
              <CommandList>
                <CommandEmpty>No drug found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { setDrugFilter(null); setDrugFilterComboOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', drugFilter === null ? 'opacity-100' : 'opacity-0')} />
                    All drugs
                  </CommandItem>
                  {drugs.map((drug) => (
                    <CommandItem
                      key={drug.id}
                      value={drug.id}
                      onSelect={() => { setDrugFilter(drug.id); setDrugFilterComboOpen(false); setPage(1); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', drugFilter === drug.id ? 'opacity-100' : 'opacity-0')} />
                      {drug.drugName}{drug.strength ? ` ${drug.strength}` : ''}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={expiringDays === null && !recalledOnly ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(null); setRecalledOnly(false); setPage(1); }}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={expiringDays === 30 ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(30); setRecalledOnly(false); setPage(1); }}
          >
            <AlertTriangle className="mr-1.5 h-3 w-3" />
            Expiring ≤30 days
          </Button>
          <Button
            size="sm"
            variant={expiringDays === 90 ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(90); setRecalledOnly(false); setPage(1); }}
          >
            ≤90 days
          </Button>
          <Button
            size="sm"
            variant={recalledOnly ? 'default' : 'outline'}
            onClick={() => { setRecalledOnly(true); setExpiringDays(null); setPage(1); }}
            className={recalledOnly ? '' : 'text-red-600'}
          >
            <ShieldAlert className="mr-1.5 h-3 w-3" />
            Recalled
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted/60" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No batches found"
            description={search || drugFilter || expiringDays
              ? 'Try clearing the filters.'
              : 'Receive your first batch from a supplier to get started.'}
            action={
              !(search || drugFilter || expiringDays) ? (
                <Button size="sm" onClick={startCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Batch
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Mfg Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  <TableHead className="text-right">Selling</TableHead>
                  <TableHead className="text-right">Value at risk</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const remaining = daysUntil(batch.expiryDate);
                  const isExpired = batch.isExpired || remaining < 0;
                  const isExpiringSoon = !isExpired && remaining <= 30;
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{batch.drug?.drugName ?? '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {batch.drug?.strength ?? ''}
                          {batch.drug?.dosageForm ? ` · ${batch.drug.dosageForm}` : ''}
                        </div>
                        {packSummary(batch.drug?.packSize, batch.drug?.dosageForm, batch.drug?.looseUnitLabel) && (
                          <div className="text-[10px] text-muted-foreground">
                            {packSummary(batch.drug?.packSize, batch.drug?.dosageForm, batch.drug?.looseUnitLabel)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{batch.supplier?.name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {batch.manufacturingDate ? formatDate(batch.manufacturingDate) : '-'}
                      </TableCell>
                      <TableCell className={cn('text-xs', isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground')}>
                        {formatDate(batch.expiryDate)}
                        {!isExpired && (
                          <span className="ml-1">({remaining}d)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {batch.quantityInStock}
                        {batch.quantityReceived !== batch.quantityInStock && (
                          <span className="text-xs text-muted-foreground"> / {batch.quantityReceived}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.sellingPrice != null ? `₹${Number(batch.sellingPrice).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(isExpired || remaining <= 90) && batch.quantityInStock > 0 && batch.sellingPrice != null ? (
                          <span className={isExpired ? 'text-red-600' : 'text-amber-700'}>
                            ₹{(Number(batch.sellingPrice) * batch.quantityInStock).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {batch.isRecalled ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Recalled</Badge>
                        ) : isExpired ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Expired</Badge>
                        ) : isExpiringSoon ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Expiring soon</Badge>
                        ) : batch.quantityInStock === 0 ? (
                          <Badge className="bg-muted text-muted-foreground">Out of stock</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">In stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {batch.isRecalled ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                title="View patients who received this batch"
                                onClick={() => setAffectedBatchId(batch.id)}
                              >
                                <Phone className="mr-1 h-3.5 w-3.5" />
                                Affected
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                title="Lift the recall on this batch"
                                onClick={() => handleLiftRecall(batch)}
                                disabled={unrecall.isPending}
                              >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                Lift
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Recall this batch"
                              onClick={() => setRecallTarget(batch)}
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="Adjust stock count (audited)"
                            onClick={() => setAdjustTarget(batch)}
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit batch"
                            onClick={() => startEdit(batch)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{page} / {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recalled drugs (formulary-level) — shown only in the Recalled view.
          A drug recall blocks every batch of that drug, including future ones. */}
      {recalledOnly && recalledDrugs.length > 0 && (
        <section className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="px-4 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Recalled drugs (all batches blocked) ({recalledDrugs.length})
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Generic</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recalledDrugs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.drugName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.genericName ?? '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.category?.name ?? '-'}</TableCell>
                  <TableCell className="text-right">{d._count?.drugBatches ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {recallTarget && (
        <RecallBatchDialog batch={recallTarget} onClose={() => setRecallTarget(null)} />
      )}
      {drugRecallOpen && <RecallDrugDialog onClose={() => setDrugRecallOpen(false)} />}
      {affectedBatchId && (
        <AffectedPatientsDialog
          batchId={affectedBatchId}
          onClose={() => setAffectedBatchId(null)}
        />
      )}

      {/* G4: stock-count adjustment + discrepancy log */}
      <AdjustStockDialog batch={adjustTarget} onOpenChange={(open) => !open && setAdjustTarget(null)} />
      <StockAdjustmentsLogDialog open={adjustLogOpen} onOpenChange={setAdjustLogOpen} />
    </div>
  );
}

// --- Recall a single batch (reason required; blocks dispensing on confirm) ---
function RecallBatchDialog({ batch, onClose }: { batch: DrugBatch; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const recallBatch = useRecallBatch();

  const handleRecall = async () => {
    if (!reason.trim()) return toast.error('Recall reason is required');
    try {
      await recallBatch.mutateAsync({ id: batch.id, recallReason: reason.trim() });
      toast.success('Batch recalled — dispensing blocked');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to recall batch');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recall Batch</DialogTitle>
          <DialogDescription>
            {batch.drug?.drugName ?? 'Drug'} · Batch{' '}
            <span className="font-mono">{batch.batchNumber}</span> · Exp {formatDate(batch.expiryDate)}
            {' — '}all future dispensing of this batch will be blocked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Recall reason *</Label>
          <Textarea
            placeholder="e.g. manufacturer recall — contamination risk lot 2026-A"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleRecall} disabled={recallBatch.isPending}>
            <AlertOctagon className="mr-1.5 h-4 w-4" />
            {recallBatch.isPending ? 'Recalling…' : 'Recall Batch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Recall a whole drug (and every one of its batches) ---
function RecallDrugDialog({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: formularyResp } = useFormulary({ search: search || undefined, limit: 25, isActive: true });
  const drugs = formularyResp?.data.filter((d) => !d.isRecalled) ?? [];
  const recallDrug = useRecallDrug();

  const handleRecall = async () => {
    if (!selectedId) return toast.error('Pick a drug');
    if (!reason.trim()) return toast.error('Recall reason is required');
    try {
      await recallDrug.mutateAsync({ id: selectedId, recallReason: reason.trim() });
      toast.success('Drug recalled — all batches blocked');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to recall drug');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recall Drug (all batches)</DialogTitle>
          <DialogDescription>
            Blocks dispensing of every batch of the selected drug — including batches received later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Find drug</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Drug name or generic name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {drugs.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-md border">
              {drugs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                    selectedId === d.id ? 'bg-primary/10' : '',
                  )}
                >
                  <div className="font-medium">{d.drugName}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.genericName ?? ''}
                    {d.category?.name ? ` · ${d.category.name}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Recall reason *</Label>
            <Textarea
              placeholder="e.g. nationwide product recall by manufacturer..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleRecall} disabled={recallDrug.isPending}>
            <AlertOctagon className="mr-1.5 h-4 w-4" />
            {recallDrug.isPending ? 'Recalling…' : 'Recall Drug'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Patients who received a (recalled) batch, for contacting/recall outreach ---
function AffectedPatientsDialog({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { data, isLoading } = useRecallAffectedPatients(batchId);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Affected Patients</DialogTitle>
          {data && (
            <DialogDescription>
              {data.batch.drug.drugName} · Batch {data.batch.batchNumber}
              {' — '}
              {data.totalPatients} patients · {data.totalDispenses} dispenses
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || data.patients.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No dispensed records"
            description="This batch was never dispensed."
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                Recall reason: {data.batch.recallReason ?? 'n/a'}
              </p>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1 h-3.5 w-3.5" />
                Print
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Last Dispense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.patients.map((p) => (
                  <TableRow key={p.patientId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
                    <TableCell className="text-sm">
                      {p.phone ? (
                        <a className="hover:underline" href={`tel:${p.phone}`}>{p.phone}</a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.email ? (
                        <a className="hover:underline" href={`mailto:${p.email}`}>
                          <Mail className="inline h-3 w-3 mr-1" />
                          {p.email}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">{p.totalQuantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.dispenses[0] ? formatDateTimeAmPm(p.dispenses[0].dispensedAt) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Drug Batches now lives under the Inventory module; inventory-module
// membership governs access (admin, super_admin, pharmacy_admin,
// inventory_manager), so no extra role guard is needed.
export default function DrugBatchesPage() {
  return <PharmacyBatchesPageInner />;
}
