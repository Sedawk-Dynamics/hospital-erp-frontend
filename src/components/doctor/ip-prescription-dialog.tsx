'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, PillBottle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPost } from '@/lib/api';
import { calcQuantity } from '@/lib/dosage-calc';
import { MedicineTable } from '@/components/doctor/prescription-pad/medicine-table';
import {
  encodeFrequency,
  encodeDuration,
  type MedicineFormData,
} from '@/components/doctor/consultation-completion/consultation-completion-schema';

// Write an IP prescription directly on the IP patient page — same M-A-N dose /
// frequency / duration / auto-Qty capture as the OP prescription pad (via the
// shared MedicineTable), so the dispense quantity is computed and reaches the
// pharmacy. Captures the formulary drugId so the order connects to pharmacy
// (eMAR schedule + the auto-pre-filled pharmacy indent key off the prescription).

const ALLOWED_ROUTES = new Set(['oral', 'iv', 'im', 'topical', 'sublingual', 'inhalation', 'other']);

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
  const [medicines, setMedicines] = useState<MedicineFormData[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // On open: reset and resolve the patient's active IP visit.
  useEffect(() => {
    if (!open) return;
    setMedicines([]); setNotes(''); setVisitId('');
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

  const save = useCallback(async () => {
    if (!visitId) { toast.error('No active IP visit for this patient.'); return; }
    const valid = medicines.filter((m) => m.drugName.trim());
    if (valid.length === 0) { toast.error('Add at least one medicine.'); return; }

    const items = valid.map((med) => {
      const durationUnit = med.durationUnit || 'days';
      const explicitQty = typeof med.quantity === 'number' && !Number.isNaN(med.quantity) && med.quantity > 0
        ? med.quantity : undefined;
      const autoQty = calcQuantity(med.frequency, med.durationValue, durationUnit, med.doseQuantity);
      const total = explicitQty ?? autoQty ?? undefined;
      const route = (med.route || 'oral').toLowerCase();
      return {
        drugId: med.drugId || undefined,
        drugName: med.drugName.trim(),
        genericName: med.genericName || undefined,
        // Dosage is required by the API — fall back to strength / name.
        dosage: (med.dosage || med.strength || med.drugName).trim(),
        // "1-0-1 - After Meal" / "As Needed (SOS)" / "Stat" — parseable downstream.
        frequency: encodeFrequency(med.frequency, med.timing, med.isPrn) || 'As directed',
        duration: med.durationValue ? encodeDuration(med.durationValue, durationUnit) : undefined,
        route: ALLOWED_ROUTES.has(route) ? route : 'other',
        instructions: med.instructions || undefined,
        doseQuantity: Number(med.doseQuantity) > 0 ? Number(med.doseQuantity) : 1,
        quantity: total != null ? Math.max(1, Math.round(total)) : undefined,
        isPrn: med.isPrn ?? false,
      };
    });

    setSaving(true);
    try {
      await apiPost('/prescriptions', {
        patientId,
        doctorId: doctorUserId,
        visitId,
        prescriptionType: 'ip',
        notes: notes || undefined,
        items,
      });
      toast.success('IP prescription written — pharmacy draft prepared.');
      qc.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => k === 'prescriptions' || k === 'indents' || k === 'emar') });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to write prescription.');
    } finally {
      setSaving(false);
    }
  }, [visitId, medicines, patientId, doctorUserId, notes, qc, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PillBottle className="h-5 w-5 text-primary" /> New IP Prescription
          </DialogTitle>
          <DialogDescription>
            For <strong>{patientName}</strong>{mrn ? ` (${mrn})` : ''} — written directly on the IP record.
            {!visitLoading && !visitId && <span className="ml-1 text-destructive">No active IP visit found.</span>}
          </DialogDescription>
        </DialogHeader>

        <MedicineTable medicines={medicines} onChange={setMedicines} patientId={patientId} />

        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Prescription notes…" className="mt-1" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || medicines.length === 0 || !visitId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PillBottle className="h-4 w-4" />} Write Prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
