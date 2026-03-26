'use client';

import { useState } from 'react';
import { Search, Plus, Pill, ChevronLeft, ChevronRight } from 'lucide-react';
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
  useFormulary,
  useCreateFormularyItem,
  usePharmacyCategories,
} from '@/hooks/use-pharmacy';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

const EMPTY_FORM = {
  drugName: '',
  genericName: '',
  categoryId: '',
  dosageForm: '',
  strength: '',
  unit: '',
  manufacturer: '',
  hsnCode: '',
  gstRate: '',
  mrp: '',
  purchasePrice: '',
  sellingPrice: '',
  reorderLevel: '',
};

export default function PharmacyInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const { data, isLoading } = useFormulary({ page, limit: 20, search: search || undefined });
  const { data: categoriesData } = usePharmacyCategories();
  const createItem = useCreateFormularyItem();

  const items = data?.data ?? [];
  const meta = data?.meta;
  const categories = categoriesData?.data ?? [];

  const handleCreate = async () => {
    if (!formData.drugName.trim()) {
      toast.error('Drug name is required');
      return;
    }
    try {
      await createItem.mutateAsync({
        drugName: formData.drugName,
        genericName: formData.genericName || undefined,
        categoryId: formData.categoryId || undefined,
        dosageForm: formData.dosageForm || undefined,
        strength: formData.strength || undefined,
        unit: formData.unit || undefined,
        manufacturer: formData.manufacturer || undefined,
        hsnCode: formData.hsnCode || undefined,
        gstRate: formData.gstRate ? parseFloat(formData.gstRate) : undefined,
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : undefined,
        reorderLevel: formData.reorderLevel ? parseInt(formData.reorderLevel) : undefined,
      });
      toast.success('Drug added to formulary');
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
    } catch {
      toast.error('Failed to add drug');
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Drug Formulary</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Drug
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Drug to Formulary</DialogTitle>
              <DialogDescription>
                Enter the drug details below. Fields marked with * are required.
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
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dosageForm">Dosage Form</Label>
                  <Input
                    id="dosageForm"
                    value={formData.dosageForm}
                    onChange={(e) => updateField('dosageForm', e.target.value)}
                    placeholder="e.g. Tablet, Syrup"
                  />
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
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    placeholder="e.g. Strip"
                  />
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hsnCode">HSN Code</Label>
                  <Input
                    id="hsnCode"
                    value={formData.hsnCode}
                    onChange={(e) => updateField('hsnCode', e.target.value)}
                    placeholder="e.g. 3004"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gstRate">GST Rate (%)</Label>
                  <Input
                    id="gstRate"
                    type="number"
                    value={formData.gstRate}
                    onChange={(e) => updateField('gstRate', e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mrp">MRP</Label>
                  <Input
                    id="mrp"
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => updateField('mrp', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purchasePrice">Purchase Price</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
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
                    value={formData.sellingPrice}
                    onChange={(e) => updateField('sellingPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  value={formData.reorderLevel}
                  onChange={(e) => updateField('reorderLevel', e.target.value)}
                  placeholder="Minimum stock quantity"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleCreate} disabled={createItem.isPending}>
                {createItem.isPending ? 'Adding...' : 'Add Drug'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <Button size="sm" onClick={() => setDialogOpen(true)}>
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
                  <TableHead>Dosage Form</TableHead>
                  <TableHead>Strength</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.drugName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.genericName || '-'}</TableCell>
                    <TableCell>{item.category?.name || '-'}</TableCell>
                    <TableCell>{item.dosageForm || '-'}</TableCell>
                    <TableCell>{item.strength || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.sellingPrice != null ? `₹${item.sellingPrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.isActive ? 'default' : 'destructive'}
                        className={item.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
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
    </div>
  );
}
