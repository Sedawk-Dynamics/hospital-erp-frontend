'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { Search, Plus, Pill, ChevronLeft, ChevronRight, Pencil, Trash2, PackagePlus, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
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
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useFormulary,
  useCreateFormularyItem,
  useUpdateFormularyItem,
  useDeleteFormularyItem,
  useCreateBatch,
  usePharmacyCategories,
  type FormularyItem,
  type DosageForm,
  type CreateFormularyInput,
} from '@/hooks/use-pharmacy';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { ImportFromCatalogDialog } from '@/components/pharmacy/import-from-catalog-dialog';

const DOSAGE_FORMS: DosageForm[] = [
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'cream',
  'drops',
  'inhaler',
  'other',
];

interface FormState {
  drugName: string;
  genericName: string;
  categoryId: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  unitOfMeasurement: string;
  price: string;
  packSize: string;
  looseUnitLabel: string;
  taxPercent: string;
  indications: string;
  contraindications: string;
}

const EMPTY_FORM: FormState = {
  drugName: '',
  genericName: '',
  categoryId: '',
  manufacturer: '',
  dosageForm: '',
  strength: '',
  unitOfMeasurement: '',
  price: '',
  packSize: '',
  looseUnitLabel: '',
  taxPercent: '',
  indications: '',
  contraindications: '',
};

function formStateFromItem(item: FormularyItem): FormState {
  return {
    drugName: item.drugName,
    genericName: item.genericName ?? '',
    categoryId: item.categoryId ?? '',
    manufacturer: item.manufacturer ?? '',
    dosageForm: item.dosageForm ?? '',
    strength: item.strength ?? '',
    unitOfMeasurement: item.unitOfMeasurement ?? '',
    price: item.price != null ? String(item.price) : '',
    packSize: item.packSize != null ? String(item.packSize) : '',
    looseUnitLabel: item.looseUnitLabel ?? '',
    taxPercent: item.taxPercent != null ? String(item.taxPercent) : '',
    indications: item.indications ?? '',
    contraindications: item.contraindications ?? '',
  };
}

function formStateToInput(form: FormState): CreateFormularyInput {
  const out: CreateFormularyInput = { drugName: form.drugName.trim() };
  if (form.genericName.trim()) out.genericName = form.genericName.trim();
  if (form.categoryId) out.categoryId = form.categoryId;
  if (form.manufacturer.trim()) out.manufacturer = form.manufacturer.trim();
  if (form.dosageForm) out.dosageForm = form.dosageForm as DosageForm;
  if (form.strength.trim()) out.strength = form.strength.trim();
  if (form.unitOfMeasurement.trim()) out.unitOfMeasurement = form.unitOfMeasurement.trim();
  if (form.price && !isNaN(parseFloat(form.price))) out.price = parseFloat(form.price);
  if (form.packSize && !isNaN(parseInt(form.packSize, 10))) out.packSize = parseInt(form.packSize, 10);
  if (form.looseUnitLabel.trim()) out.looseUnitLabel = form.looseUnitLabel.trim();
  if (form.taxPercent && !isNaN(parseFloat(form.taxPercent))) out.taxPercent = parseFloat(form.taxPercent);
  if (form.indications.trim()) out.indications = form.indications.trim();
  if (form.contraindications.trim()) out.contraindications = form.contraindications.trim();
  return out;
}

// Compact "add stock" (batch) form used directly from a formulary row.
interface StockForm {
  batchNumber: string;
  expiryDate: string;
  quantityReceived: string;
  purchasePrice: string;
  sellingPrice: string;
}
const EMPTY_STOCK: StockForm = {
  batchNumber: '',
  expiryDate: '',
  quantityReceived: '',
  purchasePrice: '',
  sellingPrice: '',
};

function PharmacyInventoryPageInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormularyItem | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quick "add stock" dialog
  const [stockDrug, setStockDrug] = useState<FormularyItem | null>(null);
  const [stockForm, setStockForm] = useState<StockForm>(EMPTY_STOCK);

  const { data, isLoading } = useFormulary({
    page,
    limit: 20,
    search: search || undefined,
    stockStatus: stockFilter === 'all' ? undefined : stockFilter,
  });
  const { data: categoriesData } = usePharmacyCategories();
  const createItem = useCreateFormularyItem();
  const updateItem = useUpdateFormularyItem();
  const deleteItem = useDeleteFormularyItem();
  const createBatch = useCreateBatch();

  const items = data?.data ?? [];
  const meta = data?.meta;
  const categories = categoriesData?.data ?? [];

  const updateField = (field: keyof FormState, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.drugName.trim()) {
      toast.error('Drug name is required');
      return;
    }
    try {
      const payload = formStateToInput(formData);
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...payload });
        toast.success('Drug updated');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Drug added to formulary');
      }
      setDialogOpen(false);
      setEditingItem(null);
      setFormData(EMPTY_FORM);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save drug';
      toast.error(msg);
    }
  };

  const startEdit = (item: FormularyItem) => {
    setEditingItem(item);
    setFormData(formStateFromItem(item));
    setDialogOpen(true);
  };

  const startCreate = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteItem.mutateAsync(deleteId);
      toast.success('Drug removed');
      setDeleteId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete drug';
      toast.error(msg);
    }
  };

  const openAddStock = (item: FormularyItem) => {
    setStockForm({
      ...EMPTY_STOCK,
      // Pre-fill selling price from the formulary price so a quick add is 1-click.
      sellingPrice: item.price != null ? String(item.price) : '',
    });
    setStockDrug(item);
  };

  const handleAddStock = async () => {
    if (!stockDrug) return;
    if (!stockForm.batchNumber.trim()) return toast.error('Batch number is required');
    if (!stockForm.expiryDate) return toast.error('Expiry date is required');
    const qty = parseInt(stockForm.quantityReceived, 10);
    if (!qty || qty <= 0) return toast.error('Quantity must be greater than 0');
    try {
      await createBatch.mutateAsync({
        drugId: stockDrug.id,
        batchNumber: stockForm.batchNumber.trim(),
        expiryDate: stockForm.expiryDate,
        quantityReceived: qty,
        ...(stockForm.purchasePrice && !isNaN(parseFloat(stockForm.purchasePrice))
          ? { purchasePrice: parseFloat(stockForm.purchasePrice) }
          : {}),
        ...(stockForm.sellingPrice && !isNaN(parseFloat(stockForm.sellingPrice))
          ? { sellingPrice: parseFloat(stockForm.sellingPrice) }
          : {}),
      });
      toast.success(`Stock added for ${stockDrug.drugName}`);
      setStockDrug(null);
      setStockForm(EMPTY_STOCK);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add stock';
      toast.error(msg);
    }
  };

  // Quick availability toggle — flips whether the drug can be prescribed/sold.
  const toggleActive = async (item: FormularyItem) => {
    try {
      await updateItem.mutateAsync({ id: item.id, isActive: !item.isActive });
      toast.success(item.isActive ? 'Marked unavailable' : 'Marked available');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Drug Formulary</h1>
          <p className="text-sm text-muted-foreground">Master list of drugs available for prescribing and dispensing.</p>
        </div>
        <div className="flex items-center gap-2">
        <ImportFromCatalogDialog />
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            setFormData(EMPTY_FORM);
          }
        }}>
          <DialogTrigger
            render={
              <Button size="sm" onClick={startCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Drug
              </Button>
            }
          />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Drug' : 'Add Drug to Formulary'}</DialogTitle>
              <DialogDescription>
                {editingItem
                  ? 'Update the drug details. Fields marked with * are required.'
                  : 'Enter the drug details. Fields marked with * are required.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="drugName">Drug Name *</Label>
                  <Input
                    id="drugName"
                    value={formData.drugName}
                    onChange={(e) => updateField('drugName', e.target.value)}
                    placeholder="e.g. Paracetamol 500mg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="genericName">Generic Name</Label>
                  <Input
                    id="genericName"
                    value={formData.genericName}
                    onChange={(e) => updateField('genericName', e.target.value)}
                    placeholder="e.g. Acetaminophen"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => updateField('categoryId', value ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dosage Form</Label>
                  <Select
                    value={formData.dosageForm}
                    onValueChange={(value) => updateField('dosageForm', value ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select form" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOSAGE_FORMS.map((form) => (
                        <SelectItem key={form} value={form} className="capitalize">{form}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="strength">Strength</Label>
                  <Input
                    id="strength"
                    value={formData.strength}
                    onChange={(e) => updateField('strength', e.target.value)}
                    placeholder="e.g. 500mg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitOfMeasurement">Unit</Label>
                  <Input
                    id="unitOfMeasurement"
                    value={formData.unitOfMeasurement}
                    onChange={(e) => updateField('unitOfMeasurement', e.target.value)}
                    placeholder="e.g. Strip"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price / unit (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {/* Loose / sub-unit sale + GST — drives the POS pack/loose toggle */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="packSize">Pack Size</Label>
                  <Input
                    id="packSize"
                    type="number"
                    min={1}
                    value={formData.packSize}
                    onChange={(e) => updateField('packSize', e.target.value)}
                    placeholder="e.g. 10 (tabs/strip)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="looseUnitLabel">Loose Unit</Label>
                  <Input
                    id="looseUnitLabel"
                    value={formData.looseUnitLabel}
                    onChange={(e) => updateField('looseUnitLabel', e.target.value)}
                    placeholder="e.g. Tablet"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxPercent">GST %</Label>
                  <Input
                    id="taxPercent"
                    type="number"
                    step="0.01"
                    value={formData.taxPercent}
                    onChange={(e) => updateField('taxPercent', e.target.value)}
                    placeholder="12"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => updateField('manufacturer', e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="indications">Indications</Label>
                <Textarea
                  id="indications"
                  value={formData.indications}
                  onChange={(e) => updateField('indications', e.target.value)}
                  placeholder="Conditions this drug treats..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contraindications">Contraindications</Label>
                <Textarea
                  id="contraindications"
                  value={formData.contraindications}
                  onChange={(e) => updateField('contraindications', e.target.value)}
                  placeholder="When this drug should NOT be used..."
                  rows={2}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Supplier and batch-level info (mfg date, expiry, batch qty) are managed under Batches.
              </p>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleSubmit} disabled={createItem.isPending || updateItem.isPending}>
                {(createItem.isPending || updateItem.isPending)
                  ? 'Saving...'
                  : editingItem ? 'Save Changes' : 'Add Drug'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search bar + stock filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search drugs by name, generic name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { key: 'all', label: 'All' },
            { key: 'in', label: 'In stock' },
            { key: 'out', label: 'Out of stock' },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={stockFilter === f.key ? 'default' : 'outline'}
              onClick={() => {
                setStockFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </Button>
          ))}
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
        ) : items.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No drugs found"
            description={search ? 'Try adjusting your search query.' : 'Add drugs to your formulary to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={startCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Drug
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug Name</TableHead>
                  <TableHead>Generic Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Strength</TableHead>
                  <TableHead className="text-center">Pack</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.drugName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.genericName || '-'}</TableCell>
                    <TableCell>{item.category?.name || '-'}</TableCell>
                    <TableCell className="capitalize">{item.dosageForm || '-'}</TableCell>
                    <TableCell>{item.strength || '-'}</TableCell>
                    <TableCell className="text-center">
                      {item.packSize && item.packSize > 1 ? (
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {item.packSize} {item.looseUnitLabel || 'units'}/pack
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.manufacturer || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.price != null ? `₹${Number(item.price).toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.inStock ? (
                        <div className="flex flex-col items-center">
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            In stock: {item.totalStock}
                          </Badge>
                          {item.nearestExpiry && (
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                              exp {formatDate(item.nearestExpiry)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Out of stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(item)}
                        disabled={item.isRecalled}
                        title={item.isRecalled ? 'Recalled' : 'Click to toggle availability'}
                        className="inline-flex"
                      >
                        <Badge
                          className={cn(
                            'cursor-pointer transition-colors',
                            item.isRecalled
                              ? 'bg-red-500/10 text-red-600 border-red-500/20 cursor-not-allowed'
                              : item.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {item.isRecalled ? 'Recalled' : item.isActive ? 'Available' : 'Unavailable'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddStock(item)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        title="Add stock"
                      >
                        <PackagePlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="h-8 w-8 p-0" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(item.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Quick Add Stock (batch) */}
      <Dialog open={!!stockDrug} onOpenChange={(open) => { if (!open) { setStockDrug(null); setStockForm(EMPTY_STOCK); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Add Stock
            </DialogTitle>
            <DialogDescription>
              Receive a batch for <span className="font-medium text-foreground">{stockDrug?.drugName}</span>
              {stockDrug?.strength ? ` ${stockDrug.strength}` : ''}. Stock becomes available immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stockBatch">Batch Number *</Label>
                <Input
                  id="stockBatch"
                  value={stockForm.batchNumber}
                  onChange={(e) => setStockForm((p) => ({ ...p, batchNumber: e.target.value }))}
                  placeholder="e.g. B24A001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockExpiry">Expiry Date *</Label>
                <Input
                  id="stockExpiry"
                  type="date"
                  min={toInputDateStr()}
                  value={stockForm.expiryDate}
                  onChange={(e) => setStockForm((p) => ({ ...p, expiryDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stockQty">Quantity *</Label>
                <Input
                  id="stockQty"
                  type="number"
                  min={1}
                  value={stockForm.quantityReceived}
                  onChange={(e) => setStockForm((p) => ({ ...p, quantityReceived: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockPurchase">Purchase ₹</Label>
                <Input
                  id="stockPurchase"
                  type="number"
                  step="0.01"
                  value={stockForm.purchasePrice}
                  onChange={(e) => setStockForm((p) => ({ ...p, purchasePrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockSelling">Selling ₹</Label>
                <Input
                  id="stockSelling"
                  type="number"
                  step="0.01"
                  value={stockForm.sellingPrice}
                  onChange={(e) => setStockForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quantity is in base/loose units (e.g. individual tablets). Manage multiple batches under Batches.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleAddStock} disabled={createBatch.isPending}>
              {createBatch.isPending ? 'Adding...' : 'Add Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete drug?</DialogTitle>
            <DialogDescription>
              This will permanently remove the drug from the formulary. Drugs that have batches attached cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PharmacyInventoryPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyInventoryPageInner />
    </PharmacyAdminGuard>
  );
}
