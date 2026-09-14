'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Package, ScanLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/utils';
import { useCreateUnifiedStock } from '@/hooks/use-inventory';
import { useUpdateFormularyItem, type FormularyItem } from '@/hooks/use-pharmacy';
import { matchHsnGstRate, useHsnGstRates } from '@/hooks/use-drug-master';

interface ProductFormState {
  name: string;
  productCategory: string;
  manufacturer: string;
  unit: string;
  packSize: string;
  gtin: string;
  hsnCode: string;
  gst: string;
  sellingPrice: string;
  purchasePrice: string;
  openingStock: string;
  minStock: string;
  isActive: boolean;
}

const EMPTY: ProductFormState = {
  name: '',
  productCategory: '',
  manufacturer: '',
  unit: '',
  packSize: '1',
  gtin: '',
  hsnCode: '',
  gst: '',
  sellingPrice: '',
  purchasePrice: '',
  openingStock: '0',
  minStock: '',
  isActive: true,
};

function fromItem(item: FormularyItem): ProductFormState {
  return {
    name: item.drugName,
    productCategory: item.productCategory ?? '',
    manufacturer: item.manufacturer ?? '',
    unit: item.unitOfMeasurement ?? item.looseUnitLabel ?? '',
    packSize: item.packSize != null ? String(item.packSize) : '1',
    gtin: item.gtin ?? '',
    hsnCode: item.hsnCode ?? '',
    gst: item.taxPercent != null ? String(item.taxPercent) : '',
    sellingPrice: item.price != null ? String(item.price) : '',
    purchasePrice: '',
    openingStock: '0',
    minStock: item.minStock != null ? String(item.minStock) : '',
    isActive: item.isActive,
  };
}

const numberOrUndefined = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;

const intOrUndefined = (value: string) => {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) ? number : undefined;
};

/**
 * Retail-product form. It intentionally contains no salts, dosage, indication,
 * narcotic or schedule controls: a product shares stock and billing with a
 * medicine, but it is not clinical data and must never look like it is.
 */
export function ProductFormDialog({
  open,
  product,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  product?: FormularyItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const editing = Boolean(product);
  const [form, setForm] = useState<ProductFormState>(() => (product ? fromItem(product) : EMPTY));
  const create = useCreateUnifiedStock();
  const update = useUpdateFormularyItem();
  const { data: hsnRates = [] } = useHsnGstRates(open);
  const pending = create.isPending || update.isPending;

  const set = (field: keyof ProductFormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));

  const setHsn = (value: string) => {
    const hit = matchHsnGstRate(value, hsnRates);
    setForm((current) => ({
      ...current,
      hsnCode: value,
      gst: hit ? String(hit.gstRate) : current.gst,
    }));
  };

  const validate = () => {
    if (!form.name.trim()) return 'Product name is required';
    if (!form.productCategory.trim()) return 'Product category is required';
    if (!form.unit.trim()) return 'Unit of sale is required';
    if (!form.hsnCode.trim()) return 'HSN code is required for billing';
    if (form.gst.trim() === '') return 'GST rate is required for billing';
    if (form.sellingPrice.trim() === '') return 'Selling price is required';
    if ((numberOrUndefined(form.gst) ?? -1) < 0 || (numberOrUndefined(form.gst) ?? 101) > 100) {
      return 'GST rate must be between 0 and 100';
    }
    if ((numberOrUndefined(form.sellingPrice) ?? -1) < 0) return 'Selling price cannot be negative';
    if ((intOrUndefined(form.packSize) ?? 0) < 1) return 'Pack size must be at least 1';
    if ((intOrUndefined(form.openingStock) ?? 0) < 0) return 'Opening stock cannot be negative';
    return null;
  };

  const submit = async (force = false) => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const common = {
      drugName: form.name.trim(),
      category: (product?.category && product.category !== 'drug'
        ? product.category
        : 'product') as 'product' | 'consumable' | 'surgical_supply' | 'equipment' | 'other',
      productCategory: form.productCategory.trim(),
      manufacturer: form.manufacturer.trim() || undefined,
      unitOfMeasurement: form.unit.trim(),
      looseUnitLabel: form.unit.trim(),
      packSize: intOrUndefined(form.packSize),
      gtin: form.gtin.trim() || undefined,
      hsnCode: form.hsnCode.trim(),
      taxPercent: numberOrUndefined(form.gst),
      price: numberOrUndefined(form.sellingPrice),
      minStock: intOrUndefined(form.minStock),
      isReimbursable: false,
      isActive: form.isActive,
    };

    try {
      if (product) {
        await update.mutateAsync({ id: product.id, ...common });
        toast.success('Product updated');
      } else {
        const result = await create.mutateAsync({
          kind: 'drug',
          force,
          drug: {
            ...common,
            openingStock: intOrUndefined(form.openingStock),
            costPerUnit: numberOrUndefined(form.purchasePrice),
          },
        });
        if (result.status === 'duplicate_suspected') {
          const match = result.matches?.[0];
          const confirmed = window.confirm(
            `A similar item already exists${match ? `: "${match.drugName}"` : ''}.\n\nCreate this product separately anyway?`,
          );
          if (confirmed) await submit(true);
          return;
        }
        toast.success('Product added to storage');
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, editing ? 'Failed to update product' : 'Failed to add product'));
    }
  };

  const hsnMatch = matchHsnGstRate(form.hsnCode, hsnRates);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> {editing ? 'Edit Product' : 'New Product'}
          </DialogTitle>
          <DialogDescription>
            A non-drug item sold by the pharmacy. It uses batches, stock, barcode scanning and GST,
            but has no salts, dosage, prescription schedule or clinical warnings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-2 pr-1">
          <section className="grid gap-3 rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product identity</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-name">Product Name *</Label>
                <Input id="product-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Baby feeding bottle" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category">Product Category *</Label>
                <Input id="product-category" value={form.productCategory} onChange={(e) => set('productCategory', e.target.value)} placeholder="e.g. Baby Care" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-brand">Brand / Manufacturer</Label>
                <Input id="product-brand" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="Company or brand" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-unit">Unit of Sale *</Label>
                <Input id="product-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. Piece, Bottle, Box" />
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Barcode &amp; tax</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-gtin">GTIN / Barcode</Label>
                <div className="relative">
                  <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="product-gtin" className="pl-8 font-mono" value={form.gtin} onChange={(e) => set('gtin', e.target.value)} placeholder="EAN / GTIN" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-hsn">HSN Code *</Label>
                <Input id="product-hsn" className="font-mono" value={form.hsnCode} onChange={(e) => setHsn(e.target.value)} placeholder="e.g. 3924" />
                {hsnMatch && <p className="text-[10px] text-primary">{hsnMatch.description ?? 'Matched HSN master'}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-gst">GST % *</Label>
                <Input id="product-gst" type="number" min={0} max={100} step="0.01" value={form.gst} onChange={(e) => set('gst', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price &amp; opening stock</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-pack">Pack Size</Label>
                <Input id="product-pack" type="number" min={1} value={form.packSize} onChange={(e) => set('packSize', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-price">Selling Price / Unit (₹) *</Label>
                <Input id="product-price" type="number" min={0} step="0.01" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-reorder">Reorder Level</Label>
                <Input id="product-reorder" type="number" min={0} value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
              </div>
              {!editing && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="product-opening">Opening Stock</Label>
                    <Input id="product-opening" type="number" min={0} value={form.openingStock} onChange={(e) => set('openingStock', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="product-cost">Purchase Cost / Unit (₹)</Label>
                    <Input id="product-cost" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quantities and prices are per sellable unit. Opening stock creates an “OPENING” batch;
              future receipts use the normal Add Stock flow with supplier, batch and expiry details.
            </p>
          </section>

          {editing && (
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Available for stock entry and sale
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save Product' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
