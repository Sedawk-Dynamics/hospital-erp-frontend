'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, Loader2, PillBottle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPost } from '@/lib/api';
import { useFormularySearch, useAllergyCheck, type FormularyDrug } from '@/hooks/use-doctor';

// Write an IP prescription directly on the IP patient page — no redirect, no
// patient search (the patient + IP visit are already known). Captures the
// formulary drugId so the order connects to pharmacy (eMAR schedule + the
// auto-pre-filled pharmacy indent both key off the prescription).

const FREQUENCY_OPTIONS = [
  'Once daily', 'Twice daily', 'Thrice daily', 'Four times daily',
  'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'At bedtime', 'SOS / PRN',
];
// Labels map to the backend MedicationRoute enum (others fall back to 'other').
const ROUTE_OPTIONS = ['Oral', 'IV', 'IM', 'Topical', 'Sublingual', 'Inhalation', 'Other'];
const ALLOWED_ROUTES = new Set(['oral', 'iv', 'im', 'topical', 'sublingual', 'inhalation', 'other']);

type IpDrugItem = {
  drugId?: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  instructions: string;
  isPrn: boolean;
};

function emptyItem(): IpDrugItem {
  return { drugName: '', genericName: '', dosage: '', frequency: 'Twice daily', duration: '', route: 'Oral', quantity: 1, instructions: '', isPrn: false };
}

interface Visit { id: string; visitType: string; status?: string }

export function IpPrescriptionDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  mrn,
  doctorUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  patientName: string;
  mrn?: string | null;
  doctorUserId: string;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const [visitId, setVisitId] = useState('');
  const [visitLoading, setVisitLoading] = useState(false);
  const [items, setItems] = useState<IpDrugItem[]>([]);
  const [current, setCurrent] = useState<IpDrugItem>(emptyItem());
  const [drugQuery, setDrugQuery] = useState('');
  const [debouncedDrugQuery, setDebouncedDrugQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // On open: reset and resolve the patient's active IP visit.
  useEffect(() => {
    if (!open) return;
    setItems([]); setCurrent(emptyItem()); setDrugQuery(''); setDebouncedDrugQuery('');
    setShowDropdown(false); setNotes(''); setVisitId('');
    let cancelled = false;
    setVisitLoading(true);
    apiGet<Visit[]>('/clinical/visits', { params: { patientId, status: 'active' } })
      .then((res) => {
        if (cancelled) return;
        const visits = res.data ?? [];
        const ip = visits.find((v) => v.visitType === 'ip') ?? visits[0];
        if (ip) setVisitId(ip.id);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setVisitLoading(false); });
    return () => { cancelled = true; };
  }, [open, patientId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDrugQuery(drugQuery), 350);
    return () => clearTimeout(t);
  }, [drugQuery]);

  const { data: drugResults, isLoading: drugLoading } = useFormularySearch(debouncedDrugQuery);
  const { data: allergy } = useAllergyCheck(patientId, current.drugName);

  const selectDrug = useCallback((d: FormularyDrug) => {
    setCurrent((prev) => ({ ...prev, drugId: d.id ?? undefined, drugName: d.drugName, genericName: d.genericName ?? '', dosage: d.strength ?? prev.dosage }));
    setDrugQuery(''); setDebouncedDrugQuery(''); setShowDropdown(false);
  }, []);

  const addItem = useCallback(() => {
    if (!current.drugName || !current.dosage || (!current.duration && !current.isPrn)) {
      toast.error('Enter medicine, dosage and duration.');
      return;
    }
    setItems((p) => [...p, current]);
    setCurrent(emptyItem());
  }, [current]);

  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const save = useCallback(async () => {
    if (!visitId) { toast.error('No active IP visit for this patient.'); return; }
    if (items.length === 0) { toast.error('Add at least one medicine.'); return; }
    setSaving(true);
    try {
      await apiPost('/prescriptions', {
        patientId,
        doctorId: doctorUserId,
        visitId,
        prescriptionType: 'ip',
        notes: notes || undefined,
        items: items.map((it) => ({
          drugId: it.drugId,
          drugName: it.drugName,
          genericName: it.genericName || undefined,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration || undefined,
          route: ALLOWED_ROUTES.has((it.route || 'oral').toLowerCase()) ? (it.route || 'oral').toLowerCase() : 'other',
          instructions: it.instructions || undefined,
          quantity: it.quantity,
          isPrn: it.isPrn,
        })),
      });
      toast.success('IP prescription written — pharmacy draft prepared.');
      // Refresh the workspace Rx panel, the eMAR, and the auto-created pharmacy draft.
      qc.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => k === 'prescriptions' || k === 'indents' || k === 'emar') });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to write prescription.');
    } finally {
      setSaving(false);
    }
  }, [visitId, items, patientId, doctorUserId, notes, qc, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PillBottle className="h-5 w-5 text-primary" /> New IP Prescription
          </DialogTitle>
          <DialogDescription>
            For <strong>{patientName}</strong>{mrn ? ` (${mrn})` : ''} — written directly on the IP record.
            {!visitLoading && !visitId && <span className="ml-1 text-destructive">No active IP visit found.</span>}
          </DialogDescription>
        </DialogHeader>

        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex items-start justify-between rounded-md border bg-card px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold text-foreground">
                    {it.drugName} <span className="font-normal text-muted-foreground">{it.dosage}</span>
                    {it.isPrn && <Badge variant="outline" className="ml-2 text-[9px] uppercase">PRN</Badge>}
                    {!it.drugId && <span className="ml-2 text-[10px] text-amber-600">free-text</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {it.frequency}{it.route ? ` · ${it.route}` : ''}{it.duration ? ` · ${it.duration}` : ''}{it.quantity ? ` · qty ${it.quantity}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border p-3 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Medicine</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search the formulary..."
                value={current.drugName && !drugQuery ? current.drugName : drugQuery}
                onChange={(e) => { setDrugQuery(e.target.value); setShowDropdown(true); setCurrent((p) => ({ ...p, drugName: '', drugId: undefined })); }}
                onFocus={() => setShowDropdown(true)}
                className="pl-8 h-9 text-sm"
              />
              {showDropdown && debouncedDrugQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                  {drugLoading ? (
                    <div className="p-3 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : drugResults && drugResults.length > 0 ? (
                    drugResults.map((d, idx) => (
                      <button key={d.id ?? idx} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors" onClick={() => selectDrug(d)}>
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && <span className="text-xs text-muted-foreground">{d.strength}</span>}
                        {d.id == null && <span className="ml-auto text-[10px] text-amber-600">not stocked</span>}
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">No drugs found</div>
                  )}
                </div>
              )}
            </div>
            {allergy?.hasAllergy && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> Allergy alert: {allergy.matchedAllergies.map((a) => a.allergen).join(', ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Dosage</Label>
              <Input value={current.dosage} onChange={(e) => setCurrent((p) => ({ ...p, dosage: e.target.value }))} placeholder="e.g. 500mg" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Frequency</Label>
              <Select value={current.frequency} onValueChange={(v) => { if (v) setCurrent((p) => ({ ...p, frequency: v })); }}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCY_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration</Label>
              <Input value={current.duration} onChange={(e) => setCurrent((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 5 days" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Route</Label>
              <Select value={current.route} onValueChange={(v) => { if (v) setCurrent((p) => ({ ...p, route: v })); }}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ROUTE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantity</Label>
              <Input type="number" min={1} value={current.quantity} onChange={(e) => setCurrent((p) => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} className="mt-1 h-8 text-sm" />
            </div>
            <label className="flex items-end gap-1.5 pb-1.5 text-xs">
              <input type="checkbox" checked={current.isPrn} onChange={(e) => setCurrent((p) => ({ ...p, isPrn: e.target.checked }))} className="accent-primary h-3.5 w-3.5" />
              PRN / SOS
            </label>
          </div>
          <Input value={current.instructions} onChange={(e) => setCurrent((p) => ({ ...p, instructions: e.target.value }))} placeholder="Instructions (optional)" className="h-8 text-sm" />
          <Button size="sm" variant="outline" className="gap-1" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" /> Add medicine
          </Button>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Prescription notes..." className="mt-1" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || items.length === 0 || !visitId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PillBottle className="h-4 w-4" />} Write Prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
