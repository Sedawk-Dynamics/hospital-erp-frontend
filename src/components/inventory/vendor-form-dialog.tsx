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

// How the vendor is paid. `credit` = pay later (terms + credit limit apply);
// Upfront (pay now) is stored as the neutral 'cash' marker (no terms/credit).
type PaymentMode = 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'credit';
type PaymentType = 'credit' | 'upfront';

interface FormState {
  name: string;
  gstNumber: string;
  licenseNumber: string;
  phone: string;
  email: string;
  address: string;
  supplyType: SupplyType;
  // Credit (pay later) vs Upfront (pay now).
  paymentType: '' | PaymentType;
  /** Kept as strings for the inputs; parsed to numbers on save. Credit-only. */
  paymentTermDays: string;
  creditLimit: string;
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
  const [form, setForm] = useState<FormState>(() => {
    const vm = vendor?.paymentMode as PaymentMode | undefined;
    return {
      name: vendor?.name ?? '',
      gstNumber: vendor?.gstNumber ?? '',
      licenseNumber: vendor?.licenseNumber ?? '',
      phone: vendor?.phone ?? '',
      email: vendor?.email ?? '',
      address: vendor?.address ?? '',
      supplyType: vendor?.supplyType ?? 'drugs',
      // Derive the type from the saved mode: 'credit' → Credit, any other → Upfront.
      paymentType: vm === 'credit' ? 'credit' : vm ? 'upfront' : '',
      paymentTermDays: vendor?.paymentTermDays != null ? String(vendor.paymentTermDays) : '',
      creditLimit: vendor?.creditLimit != null ? String(vendor.creditLimit) : '',
    };
  });

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  const isCredit = form.paymentType === 'credit';
  const isUpfront = form.paymentType === 'upfront';

  const save = async () => {
    if (!form.name.trim()) return toast.error('Vendor name is required');
    // Credit → mode 'credit' + terms/limit apply. Upfront → the neutral 'cash'
    // marker (pay now), with terms/credit limit cleared (null) so none linger.
    const paymentMode: PaymentMode | null = isCredit ? 'credit' : isUpfront ? 'cash' : null;
    const payload = {
      name: form.name.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      licenseNumber: form.licenseNumber.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      supplyType: form.supplyType,
      paymentTermDays: isCredit && form.paymentTermDays.trim() ? Number(form.paymentTermDays) : null,
      creditLimit: isCredit && form.creditLimit.trim() ? Number(form.creditLimit) : null,
      paymentMode,
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
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>

          {/* Payment type: Credit (pay later) or Upfront (pay now). */}
          <div className="space-y-1.5">
            <Label htmlFor="v-type">Payment type</Label>
            <Select
              value={form.paymentType || null}
              onValueChange={(v) => set('paymentType', (v ?? '') as PaymentType)}
            >
              <SelectTrigger id="v-type" className="w-full">
                <SelectValue placeholder="Select">
                  {(value) => (value === 'credit' ? 'Credit' : value === 'upfront' ? 'Upfront' : 'Select')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="upfront">Upfront</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Credit → terms + credit limit. */}
          {isCredit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          )}

          {/* Upfront → paid at purchase; no terms or credit limit apply. */}
          {isUpfront && (
            <p className="text-[11px] text-muted-foreground">
              Paid at the time of purchase — no credit terms or limit apply.
            </p>
          )}
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
