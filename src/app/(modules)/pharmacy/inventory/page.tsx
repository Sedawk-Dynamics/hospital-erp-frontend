'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import { Search, Plus, Pill, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useFormulary,
  useCreateFormularyItem,
  useUpdateFormularyItem,
  useDeleteFormularyItem,
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
  if (form.indications.trim()) out.indications = form.indications.trim();
  if (form.contraindications.trim()) out.contraindications = form.contraindications.trim();
  return out;
}

function PharmacyInventoryPageInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormularyItem | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useFormulary({ page, limit: 20, search: search || undefined });
  const { data: categoriesData } = usePharmacyCategories();
  const createItem = useCreateFormularyItem();
  const updateItem = useUpdateFormularyItem();
  const deleteItem = useDeleteFormularyItem();

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
                  <Label htmlFor="price">Cost (₹)</Label>
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

      {/* Search bar */}
      <div className="relative max-w-md">
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
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
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
                    <TableCell className="text-muted-foreground">{item.manufacturer || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.price != null ? `₹${Number(item.price).toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          item.isRecalled
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : item.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {item.isRecalled ? 'Recalled' : item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(item.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
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
