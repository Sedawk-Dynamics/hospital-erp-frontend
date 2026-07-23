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

type PaymentMode = 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'credit';

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'credit', label: 'Credit' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'NEFT / RTGS' },
  { value: 'upi', label: 'UPI' },
];

interface FormState {
  name: string;
  gstNumber: string;
  licenseNumber: string;
  phone: string;
  email: string;
  address: string;
  supplyType: SupplyType;
  /** Kept as strings for the inputs; parsed to numbers on save. */
  paymentTermDays: string;
  creditLimit: string;
  paymentMode: '' | PaymentMode;
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
    creditLimit: vendor?.creditLimit != null ? String(vendor.creditLimit) : '',
    paymentMode: (vendor?.paymentMode as PaymentMode | undefined) ?? '',
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
      creditLimit: form.creditLimit.trim() ? Number(form.creditLimit) : undefined,
      paymentMode: form.paymentMode || undefined,
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

        {/* Payment section — reference figures the accounts team uses when
            clearing dues. Nothing here is enforced; there is no vendor login. */}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-mode">Payment mode</Label>
              <Select
                value={form.paymentMode || null}
                onValueChange={(v) => set('paymentMode', (v ?? '') as PaymentMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select">
                    {(value) => PAYMENT_MODES.find((m) => m.value === value)?.label ?? 'Select'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-terms">Terms (days)</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="v-credit">Credit limit (₹)</Label>
              <Input
                id="v-credit"
                type="number"
                min={0}
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => set('creditLimit', e.target.value)}
                placeholder="e.g. 50000"
              />
            </div>
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
