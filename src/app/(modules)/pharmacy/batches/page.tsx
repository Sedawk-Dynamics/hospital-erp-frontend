'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

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
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
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
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import {
  useBatches,
  useCreateBatch,
  useExpiringBatches,
  useFormulary,
  type CreateBatchInput,
} from '@/hooks/use-pharmacy';
import { useSuppliers } from '@/hooks/use-inventory';

interface FormState {
  drugId: string;
  drugLabel: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  supplierId: string;
  purchasePrice: string;
  sellingPrice: string;
  quantityReceived: string;
}

const EMPTY_FORM: FormState = {
  drugId: '',
  drugLabel: '',
  batchNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  supplierId: '',
  purchasePrice: '',
  sellingPrice: '',
  quantityReceived: '',
};

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
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

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

  const allBatches = useBatches({
    page,
    limit: 20,
    search: search || undefined,
    drugId: drugFilter ?? undefined,
  });

  const expiringBatches = useExpiringBatches(
    expiringDays ? { days: expiringDays, page, limit: 20 } : undefined,
  );

  const data = expiringDays ? expiringBatches.data : allBatches.data;
  const isLoading = expiringDays ? expiringBatches.isLoading : allBatches.isLoading;
  const batches = data?.data ?? [];
  const meta = data?.meta;

  const createBatch = useCreateBatch();

  const updateField = (field: keyof FormState, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const selectedDrugForFilter = useMemo(
    () => drugs.find((d) => d.id === drugFilter) ?? null,
    [drugs, drugFilter],
  );

  const handleSubmit = async () => {
    if (!formData.drugId) return toast.error('Pick a drug from the formulary');
    if (!formData.batchNumber.trim()) return toast.error('Batch number is required');
    if (!formData.expiryDate) return toast.error('Expiry date is required');
    const qty = parseInt(formData.quantityReceived, 10);
    if (!qty || qty <= 0) return toast.error('Quantity received must be > 0');

    const payload: CreateBatchInput = {
      drugId: formData.drugId,
      batchNumber: formData.batchNumber.trim(),
      expiryDate: formData.expiryDate,
      quantityReceived: qty,
    };
    if (formData.manufacturingDate) payload.manufacturingDate = formData.manufacturingDate;
    if (formData.supplierId) payload.supplierId = formData.supplierId;
    if (formData.purchasePrice && !isNaN(parseFloat(formData.purchasePrice))) {
      payload.purchasePrice = parseFloat(formData.purchasePrice);
    }
    if (formData.sellingPrice && !isNaN(parseFloat(formData.sellingPrice))) {
      payload.sellingPrice = parseFloat(formData.sellingPrice);
    }

    try {
      await createBatch.mutateAsync(payload);
      toast.success('Batch added');
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      setDrugSearchInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create batch';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Drug Batches</h1>
          <p className="text-sm text-muted-foreground">
            Receive new stock, track expiry, and monitor what&apos;s available for dispensing.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setFormData(EMPTY_FORM);
            setDrugSearchInput('');
          }
        }}>
          <DialogTrigger render={
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Batch
            </Button>
          } />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Receive New Batch</DialogTitle>
              <DialogDescription>
                Record a batch of drugs received from a supplier. Stock is added immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Drug picker */}
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

              <div className="grid grid-cols-3 gap-3">
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
                  <Label htmlFor="purchasePrice">Purchase Price</Label>
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
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleSubmit} disabled={createBatch.isPending}>
                {createBatch.isPending ? 'Saving...' : 'Add Batch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
            variant={expiringDays === null ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(null); setPage(1); }}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={expiringDays === 30 ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(30); setPage(1); }}
          >
            <AlertTriangle className="mr-1.5 h-3 w-3" />
            Expiring ≤30 days
          </Button>
          <Button
            size="sm"
            variant={expiringDays === 90 ? 'default' : 'outline'}
            onClick={() => { setExpiringDays(90); setPage(1); }}
          >
            ≤90 days
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
                <Button size="sm" onClick={() => setCreateOpen(true)}>
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
                  <TableHead className="text-center">Status</TableHead>
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
    </div>
  );
}

export default function PharmacyBatchesPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyBatchesPageInner />
    </PharmacyAdminGuard>
  );
}
