'use client';

import { useState } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { BarcodeScanner } from '@/components/shared/barcode-scanner';
import {
  useCreateUnifiedStock,
  type InventoryCategory,
  type CreateUnifiedStockInput,
} from '@/hooks/use-inventory';
import { useInwardScan } from '@/hooks/use-pharmacy';

// "Medicine" is just the batch-tracked category of stock — everything else is a
// plain item. One form, one set of fields for both; the category decides whether
// it's created as a formulary drug (batch/expiry tracked) or a generic item.
const CATEGORY_OPTIONS: { value: InventoryCategory; label: string }[] = [
  { value: 'drug', label: 'Medicine' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'];

export function UnifiedItemDialog({
  defaultCategory = 'drug',
  onClose,
  onCreated,
}: {
  defaultCategory?: InventoryCategory;
  onClose: () => void;
  onCreated?: (kind: 'drug' | 'item', refId?: string) => void;
}) {
  const [category, setCategory] = useState<InventoryCategory>(defaultCategory);
  const isMedicine = category === 'drug';

  // One shared field set for medicines AND other items.
  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('');
  const [packSize, setPackSize] = useState('');
  const [unit, setUnit] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [reorder, setReorder] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [gst, setGst] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [description, setDescription] = useState('');

  const create = useCreateUnifiedStock();
  const scan = useInwardScan();

  const num = (v: string) => (v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined);
  const intNum = (v: string) => {
    const n = parseInt(v, 10);
    return v.trim() !== '' && !isNaN(n) ? n : undefined;
  };

  // 1D (GTIN/EAN) or 2D (GS1 DataMatrix) scan → resolve the product and auto-fill.
  // A recognised medicine flips the category to Medicine and fills its details; an
  // unrecognised code is captured as the barcode so it's saved on the new item.
  const handleScan = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    try {
      const res = await scan.mutateAsync(c);
      const L = res.line;
      if (L.drugName) {
        setCategory('drug');
        setName((p) => p || L.drugName);
        if (L.genericName) setGenericName(L.genericName);
        if (L.manufacturer) setManufacturer(L.manufacturer);
        if (L.strength) setStrength(L.strength);
        if (L.dosageForm) setDosageForm(L.dosageForm);
        if (L.packSize) setPackSize(String(L.packSize));
        if (L.hsnCode) setHsnCode(L.hsnCode);
        setBarcode(L.gtin || res.gtin || c);
        toast.success(
          `Matched ${L.drugName}${res.suggestedFormularyId ? ' — already in your formulary' : ''}`,
        );
      } else {
        setBarcode(res.gtin || c);
        toast.message('Barcode captured — fill in the details below.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  const buildPayload = (force?: boolean): CreateUnifiedStockInput | null => {
    if (!name.trim()) {
      toast.error(`${isMedicine ? 'Medicine' : 'Item'} name is required`);
      return null;
    }
    if (isMedicine) {
      return {
        kind: 'drug',
        force,
        drug: {
          drugName: name.trim(),
          genericName: genericName.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          strength: strength.trim() || undefined,
          dosageForm: dosageForm || undefined,
          packSize: intNum(packSize),
          looseUnitLabel: unit.trim() || undefined,
          taxPercent: num(gst),
          price: num(sellingPrice),
          minStock: intNum(reorder),
          hsnCode: hsnCode.trim() || undefined,
          gtin: barcode.trim() || undefined,
        },
      };
    }
    return {
      kind: 'item',
      item: {
        itemName: name.trim(),
        itemCode: barcode.trim() || undefined,
        category,
        unitOfMeasurement: unit.trim() || undefined,
        minimumStockThreshold: intNum(reorder),
        currentStock: intNum(initialStock) ?? 0,
        costPerUnit: num(purchasePrice),
        sellingPricePerUnit: num(sellingPrice),
        description: description.trim() || undefined,
      },
    };
  };

  const submit = async (force?: boolean) => {
    const payload = buildPayload(force);
    if (!payload) return;
    try {
      const result = await create.mutateAsync(payload);
      if (result.status === 'duplicate_suspected') {
        const top = result.matches?.[0];
        const ok = window.confirm(
          `A similar medicine already exists${top ? `: "${top.drugName}"` : ''}.\n\n` +
            'Create this as a new entry anyway?',
        );
        if (ok) await submit(true);
        return;
      }
      toast.success(isMedicine ? 'Medicine added to storage' : 'Item added to storage');
      onCreated?.(isMedicine ? 'drug' : 'item', result.item?.id as string | undefined);
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to add to storage');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Item</DialogTitle>
          <DialogDescription>
            Add anything you keep in storage. Pick the category — &ldquo;Medicine&rdquo; is
            batch &amp; expiry tracked; everything else is tracked by stock count. Same form for both.
          </DialogDescription>
        </DialogHeader>

        {/* One scanner for both 1D barcodes and 2D DataMatrix. Switch between a
            USB/handheld scanner (default) and the phone/laptop/USB camera. */}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ScanLine className="h-4 w-4" /> Scan to auto-fill (optional) — reads 1D barcodes &amp; 2D DataMatrix
            {scan.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <BarcodeScanner
            onScan={handleScan}
            withModeSwitch
            defaultMode="scanner"
            placeholder="Scan or type a barcode / DataMatrix…"
          />
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isMedicine ? 'e.g. Paracetamol 500' : 'e.g. Surgical gloves'} />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as InventoryCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Generic / composition</Label>
              <Input value={genericName} onChange={(e) => setGenericName(e.target.value)} placeholder={isMedicine ? 'e.g. Acetaminophen' : 'optional'} />
            </div>
            <div>
              <Label className="text-xs">Manufacturer / brand</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Strength</Label>
              <Input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="500 mg" />
            </div>
            <div>
              <Label className="text-xs">Dosage form</Label>
              <Select value={dosageForm} onValueChange={(v) => setDosageForm(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Pack size (units/pack)</Label>
              <Input type="number" min={1} value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Unit (tablet, box, ml…)</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Barcode / GTIN / code</Label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">HSN code</Label>
              <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Reorder level</Label>
              <Input type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="10" />
            </div>
            <div>
              <Label className="text-xs">Purchase price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Selling price / MRP (₹)</Label>
              <Input type="number" min={0} step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">GST %</Label>
              <Input type="number" min={0} step="0.01" value={gst} onChange={(e) => setGst(e.target.value)} placeholder="12" />
            </div>
            {!isMedicine && (
              <div>
                <Label className="text-xs">Initial stock</Label>
                <Input type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Description / notes</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <p className="text-[11px] text-muted-foreground">
            {isMedicine
              ? 'After adding the medicine, open its row to receive a batch (quantity, expiry, MRP…).'
              : 'Stock for this item is tracked by count — use “Stock In” on its row to receive more.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit()} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : isMedicine ? 'Add Medicine' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
