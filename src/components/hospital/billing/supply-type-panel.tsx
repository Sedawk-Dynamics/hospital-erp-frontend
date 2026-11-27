'use client';

// #265: where a bill is supplied. Health services are supplied where they are
// performed, so the tax is CGST + SGST whoever the buyer is. Billing / admin can
// mark a DRAFT as an exception: goods shipped out, or a service done off site.

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useSetBillSupplyType, type BillSupplyType } from '@/hooks/use-hospital';
import { useCanManageGst } from '@/hooks/use-gst-portal';
import { GST_STATES, gstStateName } from '@/lib/gst-states';
import { getApiErrorMessage } from '@/lib/utils';

export const SUPPLY_TYPE_LABELS: Record<BillSupplyType, string> = {
  performed_at_hospital: 'Performed at the hospital',
  goods_shipped: 'Goods shipped to another place',
  off_site_service: 'Service performed off site',
};

export interface BillSupplyFields {
  id: string;
  status: string;
  invoiceNumber?: string | null;
  recipientGstin?: string | null;
  placeOfSupplyStateCode?: string | null;
  isInterState?: boolean;
  supplyType?: string | null;
  supplyDestinationStateCode?: string | null;
  supplyTypeReason?: string | null;
}

const typeOf = (v: string | null | undefined): BillSupplyType =>
  v === 'goods_shipped' || v === 'off_site_service' ? v : 'performed_at_hospital';

export function SupplyTypePanel({ bill }: { bill: BillSupplyFields | null }) {
  const save = useSetBillSupplyType();
  const canManage = useCanManageGst();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<BillSupplyType>('performed_at_hospital');
  const [state, setState] = useState('');
  const [reason, setReason] = useState('');

  if (!bill) return null;
  const isDraft = bill.status === 'draft' && !bill.invoiceNumber;
  const current = typeOf(bill.supplyType);
  if (!isDraft && current === 'performed_at_hospital' && !bill.isInterState) return null;

  const start = () => {
    setType(current);
    setState(bill.supplyDestinationStateCode ?? '');
    setReason(bill.supplyTypeReason ?? '');
    setEditing(true);
  };
  // An off-site service is supplied where its registered buyer is.
  const buyerState = bill.recipientGstin?.slice(0, 2) ?? '';
  const pick = (v: BillSupplyType) => {
    setType(v);
    if (v === 'off_site_service') setState(buyerState);
  };
  const exception = type !== 'performed_at_hospital';
  const problem = !exception
    ? null
    : type === 'off_site_service' && !bill.recipientGstin
      ? "Add the buyer's GSTIN first."
      : !state
        ? 'Choose the destination state.'
        : reason.trim().length < 3
          ? 'Give the reason.'
          : null;

  const onSave = async () => {
    try {
      await save.mutateAsync({
        id: bill.id,
        supplyType: type,
        destinationStateCode: exception ? state : null,
        reason: reason.trim() || null,
      });
      toast.success(exception ? `Place of supply: ${gstStateName(state)}` : 'Place of supply: the hospital');
      setEditing(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the place of supply'));
    }
  };

  if (!editing) {
    return (
      <div className="rounded-lg border border-outline-variant px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <MapPin className="h-3.5 w-3.5" /> Place of supply
          </span>
          {isDraft && canManage ? (
            <Button size="sm" variant="ghost" className="h-7" onClick={start}>
              Change
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-on-surface-variant">
          {isDraft
            ? current === 'performed_at_hospital'
              ? 'The hospital — CGST + SGST, whoever the buyer is.'
              : `${SUPPLY_TYPE_LABELS[current]} — ${gstStateName(bill.supplyDestinationStateCode) ?? '—'}`
            : `${gstStateName(bill.placeOfSupplyStateCode) ?? 'The hospital'} — issued with ${bill.isInterState ? 'IGST' : 'CGST + SGST'}`}
        </p>
        {isDraft && current !== 'performed_at_hospital' && bill.supplyTypeReason ? (
          <p className="text-on-surface-variant">Reason: {bill.supplyTypeReason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-outline-variant px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <MapPin className="h-3.5 w-3.5" /> Place of supply
      </p>
      <div>
        <Label className="text-[11px]">What this bill is for</Label>
        <Select value={type} onValueChange={(v: string | null) => v && pick(v as BillSupplyType)}>
          <SelectTrigger className="h-8">
            <SelectValue>{SUPPLY_TYPE_LABELS[type]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SUPPLY_TYPE_LABELS) as BillSupplyType[]).map((v) => (
              <SelectItem key={v} value={v}>
                {SUPPLY_TYPE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {exception ? (
        <>
          <div>
            <Label className="text-[11px]">Destination state *</Label>
            <Select value={state || null} onValueChange={(v: string | null) => v && setState(v)} disabled={type === 'off_site_service'}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Choose a state">{gstStateName(state) ?? 'Choose a state'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GST_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Reason *</Label>
            <Input className="h-8" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Implants couriered to Bengaluru" />
          </div>
          <p className="text-[10px] text-on-surface-variant">
            Another state means IGST when the bill is issued. The whole bill must be {type === 'goods_shipped' ? 'the shipped goods' : 'the off-site service'}:
            anything supplied at the hospital goes on its own bill.
          </p>
          {problem ? <p className="text-[11px] text-red-600">{problem}</p> : null}
        </>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" className="h-7" disabled={save.isPending || !!problem} onClick={onSave}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}
