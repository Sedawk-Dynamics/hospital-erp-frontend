'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateSupplier,
  useUpdateSupplier,
  type Supplier,
  type SupplyType,
} from '@/hooks/use-inventory';

/**
 * G10: create / edit a vendor (supplier) in the vendor master. Used by the
 * Vendors page and inline from the stock-inward forms so a new distributor can
 * be added once and then auto-fill (name / GSTIN / contact) on every inward.
 */
export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Supplier | null;
  onSaved?: (vendor: Supplier) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted fresh each open → form state resets without a sync effect. */}
        {open && (
          <VendorForm vendor={vendor ?? null} onSaved={onSaved} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormState {
  name: string;
  gstNumber: string;
  licenseNumber: string;
  phone: string;
  email: string;
  address: string;
  supplyType: SupplyType;
  /** Kept as a string for the input; parsed to a number on save. */
  paymentTermDays: string;
}

function VendorForm({
  vendor,
  onSaved,
  onClose,
}: {
  vendor: Supplier | null;
  onSaved?: (vendor: Supplier) => void;
  onClose: () => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [form, setForm] = useState<FormState>(() => ({
    name: vendor?.name ?? '',
    gstNumber: vendor?.gstNumber ?? '',
    licenseNumber: vendor?.licenseNumber ?? '',
    phone: vendor?.phone ?? '',
    email: vendor?.email ?? '',
    address: vendor?.address ?? '',
    supplyType: vendor?.supplyType ?? 'drugs',
    paymentTermDays: vendor?.paymentTermDays != null ? String(vendor.paymentTermDays) : '',
  }));

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  const save = async () => {
    if (!form.name.trim()) return toast.error('Vendor name is required');
    const payload = {
      name: form.name.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      licenseNumber: form.licenseNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      supplyType: form.supplyType,
      paymentTermDays: form.paymentTermDays.trim() ? Number(form.paymentTermDays) : undefined,
    };
    try {
      const saved = vendor
        ? await update.mutateAsync({ id: vendor.id, ...payload })
        : await create.mutateAsync(payload);
      toast.success(vendor ? 'Vendor updated' : 'Vendor added');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vendor');
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{vendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
        <DialogDescription>
          Saved once, then auto-filled on every stock inward — only invoice details change per delivery.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="v-name">Vendor name *</Label>
          <Input id="v-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. MedPlus Distributors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-gst">GSTIN</Label>
            <Input id="v-gst" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-dl">Drug Licence No.</Label>
            <Input id="v-dl" value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} placeholder="DL-..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-phone">Phone</Label>
            <Input id="v-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-email">Email</Label>
            <Input id="v-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Supplies</Label>
            <Select value={form.supplyType} onValueChange={(v) => set('supplyType', (v ?? 'drugs') as SupplyType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="drugs">Drugs</SelectItem>
                <SelectItem value="consumables">Consumables</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-terms">Payment terms (days)</Label>
            <Input
              id="v-terms"
              type="number"
              min={0}
              max={365}
              value={form.paymentTermDays}
              onChange={(e) => set('paymentTermDays', e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-addr">Address</Label>
          <Textarea id="v-addr" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={pending}>
          {pending ? 'Saving…' : vendor ? 'Save changes' : 'Add vendor'}
        </Button>
      </DialogFooter>
    </>
  );
}
