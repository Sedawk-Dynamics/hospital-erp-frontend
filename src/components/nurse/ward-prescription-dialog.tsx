'use client';

import { useState } from 'react';
import { Plus, Trash2, Search, Loader2, Pill, Send } from 'lucide-react';
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
import { useDebounce } from '@/hooks/use-debounce';
import { useFormularySearch, useCreatePrescription } from '@/hooks/use-doctor';
import type { NurseAdmission } from '@/hooks/use-nurse';
import { StockTypeBadge } from '@/components/shared/stock-type-badge';

/**
 * §4.2 ward→pharmacy flow: the ward nurse enters the doctor's key-sheet
 * prescription into the system against an admitted IP patient. On submit it
 * becomes an IP prescription that lands in the pharmacy queue (Ordered →
 * Preparing → Ready → Collected).
 */

const FREQUENCIES = ['1-0-0', '0-1-0', '0-0-1', '1-0-1', '1-1-1', '1-1-0', '0-1-1', 'SOS', 'Stat'];
const ROUTES = ['oral', 'iv', 'im', 'topical', 'sublingual', 'inhalation', 'other'] as const;

interface MedRow {
  key: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  route: (typeof ROUTES)[number];
  instructions: string;
}

let seq = 0;
const newRow = (drugName = ''): MedRow => ({
  key: `m-${++seq}`,
  drugName,
  dosage: '1 dose',
  frequency: '1-0-1',
  duration: '',
  quantity: '',
  route: 'oral',
  instructions: '',
});

export function WardPrescriptionDialog({
  admission,
  onOpenChange,
}: {
  admission: NurseAdmission | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [meds, setMeds] = useState<MedRow[]>([newRow()]);
  const [notes, setNotes] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  const debounced = useDebounce(drugSearch, 300);
  const { data: drugResults = [], isFetching } = useFormularySearch(debounced);
  const createRx = useCreatePrescription();

  const doctorId = admission?.doctorId ?? admission?.doctor?.id;
  const visitId = admission?.visitId;
  const patientName = admission?.patient
    ? `${admission.patient.firstName} ${admission.patient.lastName ?? ''}`.trim()
    : '';

  const reset = () => {
    seq = 0;
    setMeds([newRow()]);
    setNotes('');
    setDrugSearch('');
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const update = (key: string, field: keyof MedRow, value: string) =>
    setMeds((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  const remove = (key: string) =>
    setMeds((prev) => (prev.length === 1 ? [newRow()] : prev.filter((m) => m.key !== key)));
  const addFromSearch = (name: string) => {
    setMeds((prev) => {
      // Reuse a blank first row if present, else append.
      const blank = prev.find((m) => !m.drugName.trim());
      if (blank) return prev.map((m) => (m.key === blank.key ? { ...m, drugName: name } : m));
      return [...prev, newRow(name)];
    });
    setDrugSearch('');
  };

  const handleSubmit = async () => {
    if (!admission) return;
    if (!visitId) return toast.error('This admission has no active visit — cannot raise an order.');
    if (!doctorId) return toast.error('No attending doctor on this admission.');
    const items = meds
      .filter((m) => m.drugName.trim())
      .map((m) => ({
        drugName: m.drugName.trim(),
        dosage: m.dosage.trim() || '1 dose',
        frequency: m.frequency || '1-0-1',
        duration: m.duration.trim(),
        route: m.route,
        instructions: m.instructions.trim() || undefined,
        quantity: m.quantity ? parseInt(m.quantity, 10) : undefined,
      }));
    if (!items.length) return toast.error('Add at least one medicine');

    try {
      await createRx.mutateAsync({
        patientId: admission.patientId,
        doctorId,
        visitId,
        prescriptionType: 'ip',
        notes: notes.trim() || undefined,
        items,
      });
      toast.success('Order sent to pharmacy');
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to raise the order');
    }
  };

  return (
    <Dialog open={!!admission} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Enter Ward Prescription
          </DialogTitle>
          <DialogDescription>
            {patientName ? `${patientName} · MRN ${admission?.patient?.mrn ?? '-'}` : 'IP patient'}
            {admission?.ward?.name ? ` · ${admission.ward.name}` : ''}
            {admission?.bed?.bedNumber ? ` / Bed ${admission.bed.bedNumber}` : ''}
            {admission?.doctor?.user
              ? ` · Dr. ${admission.doctor.user.firstName} ${admission.doctor.user.lastName}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Drug search → add medicine */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search the formulary to add a medicine (or type it on a row below)…"
            value={drugSearch}
            onChange={(e) => setDrugSearch(e.target.value)}
          />
          {drugSearch.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {isFetching ? (
                <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Searching…
                </div>
              ) : drugResults.length === 0 ? (
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                  onClick={() => addFromSearch(drugSearch.trim())}
                >
                  Add &ldquo;{drugSearch.trim()}&rdquo; as written
                </button>
              ) : (
                drugResults.map((d, i) => (
                  <button
                    type="button"
                    key={`${d.id ?? d.drugMasterId ?? 'd'}-${i}`}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-muted/50 border-b last:border-0"
                    onClick={() => addFromSearch(`${d.drugName}${d.strength ? ` ${d.strength}` : ''}`)}
                  >
                    <span className="font-medium">{d.drugName}</span>
                    {d.strength ? <span className="text-muted-foreground"> {d.strength}</span> : ''}
                    <StockTypeBadge category={d.category} className="ml-1.5 align-middle" />
                    {d.genericName ? (
                      <span className="block text-xs text-muted-foreground">{d.genericName}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Medicine rows */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {meds.map((m, idx) => (
            <div key={m.key} className="rounded-lg border bg-surface-container-lowest p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{idx + 1}</span>
                <Input
                  className="h-8 flex-1 text-sm font-medium"
                  placeholder="Medicine name *"
                  value={m.drugName}
                  onChange={(e) => update(m.key, 'drugName', e.target.value)}
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600" onClick={() => remove(m.key)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-[11px]">Dosage</Label>
                  <Input className="h-8 text-xs" value={m.dosage} onChange={(e) => update(m.key, 'dosage', e.target.value)} placeholder="1 tab" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Frequency</Label>
                  <Select value={m.frequency} onValueChange={(v) => update(m.key, 'frequency', v ?? '1-0-1')}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Duration</Label>
                  <Input className="h-8 text-xs" value={m.duration} onChange={(e) => update(m.key, 'duration', e.target.value)} placeholder="5 days" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Qty</Label>
                  <Input className="h-8 text-xs" type="number" min={1} value={m.quantity} onChange={(e) => update(m.key, 'quantity', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Route</Label>
                  <Select value={m.route} onValueChange={(v) => update(m.key, 'route', (v ?? 'oral'))}>
                    <SelectTrigger className="h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROUTES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                className="mt-2 h-8 text-xs"
                placeholder="Instructions (optional) — e.g. after food"
                value={m.instructions}
                onChange={(e) => update(m.key, 'instructions', e.target.value)}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setMeds((p) => [...p, newRow()])}>
            <Plus className="mr-1.5 h-4 w-4" /> Add medicine
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Notes for pharmacy (optional)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. urgent, dispense for today only" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createRx.isPending}>
            {createRx.isPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="mr-1.5 h-4 w-4" /> Send to pharmacy</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
