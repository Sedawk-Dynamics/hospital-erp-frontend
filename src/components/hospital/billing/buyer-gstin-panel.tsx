'use client';

// G-4: the B2B buyer on a hospital bill. A valid GSTIN makes the invoice B2B. It
// does not change the tax (#265): a health service is supplied at the hospital,
// so it is CGST + SGST even for a buyer in another state. Only editable while the
// bill is a draft — once issued, the correction is a credit note.

import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetBillBuyer } from '@/hooks/use-hospital';
import { gstinProblem } from '@/lib/gstin';
import { getApiErrorMessage } from '@/lib/utils';

export interface BillBuyerFields {
  id: string;
  status: string;
  recipientGstin?: string | null;
  recipientLegalName?: string | null;
  recipientAddress?: string | null;
}

export function BuyerGstinPanel({ bill }: { bill: BillBuyerFields | null }) {
  const setBuyer = useSetBillBuyer();
  const [editing, setEditing] = useState(false);
  const [gstin, setGstin] = useState('');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');

  if (!bill) return null;
  const isDraft = bill.status === 'draft';
  const problem = gstinProblem(gstin);

  const start = () => {
    setGstin(bill.recipientGstin ?? '');
    setLegalName(bill.recipientLegalName ?? '');
    setAddress(bill.recipientAddress ?? '');
    setEditing(true);
  };

  const save = async (clear = false) => {
    if (!clear && problem) {
      toast.error(problem);
      return;
    }
    if (!clear && gstin.trim() && !legalName.trim()) {
      toast.error("Enter the buyer's legal name as registered with the GSTIN");
      return;
    }
    try {
      await setBuyer.mutateAsync({
        id: bill.id,
        gstin: clear ? null : gstin.trim().toUpperCase() || null,
        legalName: clear ? null : legalName.trim() || null,
        address: clear ? null : address.trim() || null,
      });
      toast.success(clear || !gstin.trim() ? 'Buyer cleared — B2C invoice' : 'Buyer saved — this will be a B2B tax invoice');
      setEditing(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the buyer'));
    }
  };

  if (!editing) {
    if (!bill.recipientGstin && !isDraft) return null;
    return (
      <div className="rounded-lg border border-outline-variant px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 className="h-3.5 w-3.5" /> Buyer (B2B)
          </span>
          {isDraft && (
            <Button size="sm" variant="ghost" className="h-7" onClick={start}>
              {bill.recipientGstin ? 'Change' : 'Add GSTIN'}
            </Button>
          )}
        </div>
        {bill.recipientGstin ? (
          <p className="mt-1 text-on-surface-variant">
            {bill.recipientLegalName ?? '—'} · <span className="font-mono">{bill.recipientGstin}</span>
          </p>
        ) : (
          <p className="mt-1 text-on-surface-variant">None — issued as a B2C invoice.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-outline-variant px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Building2 className="h-3.5 w-3.5" /> Buyer GSTIN (B2B invoice)
      </p>
      <div>
        <Label className="text-[11px]">GSTIN</Label>
        <Input
          className="h-8 font-mono uppercase"
          value={gstin}
          maxLength={15}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="15-character GSTIN"
        />
        {gstin.trim() && problem && <p className="mt-0.5 text-[11px] text-red-600">{problem}</p>}
      </div>
      <div>
        <Label className="text-[11px]">Legal name *</Label>
        <Input className="h-8" value={legalName} maxLength={200} onChange={(e) => setLegalName(e.target.value)} />
      </div>
      <div>
        <Label className="text-[11px]">Address</Label>
        <Input className="h-8" value={address} maxLength={500} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <p className="text-[10px] text-on-surface-variant">
        For a corporate, insurer or TPA that asks for a B2B invoice. The tax stays CGST + SGST: the service is supplied
        at the hospital, whichever state the buyer is in.
      </p>
      <div className="flex justify-end gap-1.5">
        {bill.recipientGstin && (
          <Button size="sm" variant="ghost" className="h-7" disabled={setBuyer.isPending} onClick={() => save(true)}>
            Remove
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" className="h-7" disabled={setBuyer.isPending} onClick={() => save(false)}>
          {setBuyer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}
