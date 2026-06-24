'use client';

import { useState } from 'react';
import { Pill, Boxes } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  useCreateUnifiedStock,
  type InventoryCategory,
  type CreateUnifiedStockInput,
} from '@/hooks/use-inventory';

type Kind = 'drug' | 'item';

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'];

// One "New Item" dialog for the unified Storage list — a thing in storage can be a
// medicine (batch-tracked, with expiry/FEFO/dispensing) or any other supply.
export function UnifiedItemDialog({
  defaultKind = 'drug',
  onClose,
  onCreated,
}: {
  defaultKind?: Kind;
  onClose: () => void;
  onCreated?: (kind: Kind, refId?: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(defaultKind);

  // Medicine fields
  const [drugName, setDrugName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('');
  const [packSize, setPackSize] = useState('');
  const [looseUnitLabel, setLooseUnitLabel] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [drugPrice, setDrugPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [hsnCode, setHsnCode] = useState('');

  // Generic item fields
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('consumable');
  const [unit, setUnit] = useState('');
  const [reorder, setReorder] = useState('10');
  const [initialStock, setInitialStock] = useState('0');
  const [cost, setCost] = useState('');
  const [sell, setSell] = useState('');
  const [description, setDescription] = useState('');

  const create = useCreateUnifiedStock();

  const num = (v: string) => (v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined);

  const buildPayload = (force?: boolean): CreateUnifiedStockInput | null => {
    if (kind === 'drug') {
      if (!drugName.trim()) {
        toast.error('Medicine name is required');
        return null;
      }
      return {
        kind: 'drug',
        force,
        drug: {
          drugName: drugName.trim(),
          genericName: genericName.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          strength: strength.trim() || undefined,
          dosageForm: dosageForm || undefined,
          packSize: num(packSize),
          looseUnitLabel: looseUnitLabel.trim() || undefined,
          taxPercent: num(taxPercent),
          price: num(drugPrice),
          minStock: num(minStock),
          hsnCode: hsnCode.trim() || undefined,
        },
      };
    }
    if (!itemName.trim()) {
      toast.error('Item name is required');
      return null;
    }
    return {
      kind: 'item',
      item: {
        itemName: itemName.trim(),
        itemCode: itemCode.trim() || undefined,
        category,
        unitOfMeasurement: unit.trim() || undefined,
        minimumStockThreshold: num(reorder),
        currentStock: num(initialStock) ?? 0,
        costPerUnit: num(cost),
        sellingPricePerUnit: num(sell),
        description: description.trim() || undefined,
      },
    };
  };

  const submit = async (force?: boolean) => {
    const payload = buildPayload(force);
    if (!payload) return;
    try {
      const result = await create.mutateAsync(payload);
      // The formulary near-duplicate guard fired — offer to create anyway.
      if (result.status === 'duplicate_suspected') {
        const top = result.matches?.[0];
        const ok = window.confirm(
          `A similar medicine already exists${top ? `: "${top.drugName}"` : ''}.\n\n` +
            'Create this as a new entry anyway?',
        );
        if (ok) await submit(true);
        return;
      }
      toast.success(kind === 'drug' ? 'Medicine added to storage' : 'Item added to storage');
      onCreated?.(kind, result.item?.id as string | undefined);
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
            Add anything you keep in storage. A medicine is batch-tracked (expiry, FEFO,
            dispensing); any other supply is tracked by simple stock count.
          </DialogDescription>
        </DialogHeader>

        {/* Kind selector — medicine vs any other supply */}
        <div className="grid grid-cols-2 gap-2">
          {([
            { k: 'drug', icon: Pill, title: 'Medicine', sub: 'Batch & expiry tracked' },
            { k: 'item', icon: Boxes, title: 'Other item', sub: 'Consumable, equipment…' },
          ] as const).map(({ k, icon: Icon, title, sub }) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition',
                kind === k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
              )}
            >
              <Icon className={cn('h-5 w-5', kind === k ? 'text-primary' : 'text-muted-foreground')} />
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {kind === 'drug' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Medicine name *</Label>
                  <Input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="e.g. Paracetamol 500" />
                </div>
                <div>
                  <Label className="text-xs">Generic / composition</Label>
                  <Input value={genericName} onChange={(e) => setGenericName(e.target.value)} placeholder="e.g. Acetaminophen" />
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
                  <Label className="text-xs">Manufacturer</Label>
                  <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Pack size (units/pack)</Label>
                  <Input type="number" min={1} value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="e.g. 10" />
                </div>
                <div>
                  <Label className="text-xs">Loose unit label</Label>
                  <Input value={looseUnitLabel} onChange={(e) => setLooseUnitLabel(e.target.value)} placeholder="e.g. Tablet" />
                </div>
                <div>
                  <Label className="text-xs">Reorder level</Label>
                  <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">GST %</Label>
                  <Input type="number" min={0} step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="12" />
                </div>
                <div>
                  <Label className="text-xs">Selling price (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={drugPrice} onChange={(e) => setDrugPrice(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">HSN code</Label>
                  <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                After adding the medicine, open its row to receive a batch (quantity, expiry, MRP…).
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Item name *</Label>
                  <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Surgical gloves" />
                </div>
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category *</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as InventoryCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Unit (box, ml, kg…)</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Reorder threshold</Label>
                  <Input type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Initial stock</Label>
                  <Input type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cost per unit (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Selling price (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={sell} onChange={(e) => setSell(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit()} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : kind === 'drug' ? 'Add Medicine' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
