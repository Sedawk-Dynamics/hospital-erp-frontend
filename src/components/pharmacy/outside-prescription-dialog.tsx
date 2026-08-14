'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, Upload, FileText, AlertTriangle } from 'lucide-react';
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
  useOcrPrescription,
  useCreateExternalPrescription,
  type ExternalPrescription,
  type DrugSchedule,
} from '@/hooks/use-pharmacy';

/**
 * Capture a paper prescription a walk-in presents at the counter.
 *
 * The photo is a typing aid, never the record: OCR pre-fills the form and the
 * operator confirms every field before anything is saved. A mis-read
 * registration number would make the statutory register wrong, and the register
 * is the thing a drug inspector reads.
 *
 * The uploaded image is kept because Schedule X requires the pharmacy to retain
 * a copy of the prescription for two years.
 */
export function OutsidePrescriptionDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  schedules,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when the counter already identified the customer as a patient. */
  patientId?: string | null;
  patientName?: string | null;
  /** Schedules on the cart, so retention matches the strictest one. */
  schedules?: DrugSchedule[];
  onCaptured: (rx: ExternalPrescription) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const ocr = useOcrPrescription();
  const create = useCreateExternalPrescription();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrJson, setOcrJson] = useState<unknown>(null);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<string[]>([]);

  const [prescriberName, setPrescriberName] = useState('');
  const [prescriberRegNo, setPrescriberRegNo] = useState('');
  const [prescriberQualification, setPrescriberQualification] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [prescribedDate, setPrescribedDate] = useState('');
  const [patientNameRaw, setPatientNameRaw] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setImageUrl(null);
    setOcrJson(null);
    setOcrWarnings([]);
    setMedicines([]);
    setPrescriberName('');
    setPrescriberRegNo('');
    setPrescriberQualification('');
    setHospitalName('');
    setPrescribedDate('');
    setPatientNameRaw('');
    setPatientAddress('');
    setNotes('');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await ocr.mutateAsync(file);
      setImageUrl(r.imageUrl);
      setOcrJson(r);
      setOcrWarnings(r.warnings ?? []);
      setMedicines(r.medicines ?? []);
      // Pre-fill only the blanks, so a value the operator already corrected is
      // never overwritten by a second scan.
      setPrescriberName((v) => v || r.prescriberName || '');
      setPrescriberRegNo((v) => v || r.prescriberRegNo || '');
      setPrescriberQualification((v) => v || r.prescriberQualification || '');
      setHospitalName((v) => v || r.hospitalName || '');
      setPrescribedDate((v) => v || r.prescribedDate || '');
      setPatientNameRaw((v) => v || r.patientName || '');
      setPatientAddress((v) => v || r.patientAddress || '');
      toast.success('Prescription read — please check the details before saving.');
    } catch (err) {
      // OCR is a convenience. When it is unavailable the operator types the
      // details in, so this is a notice rather than a dead end.
      toast.error(
        err instanceof Error ? err.message : 'Could not read that image — enter the details by hand.',
      );
    }
  };

  const save = async () => {
    if (!prescriberName.trim()) {
      toast.error("Enter the prescriber's name.");
      return;
    }
    try {
      const rx = await create.mutateAsync({
        patientId: patientId ?? null,
        patientNameRaw: patientNameRaw.trim() || patientName || null,
        patientAddress: patientAddress.trim() || null,
        prescriberName: prescriberName.trim(),
        prescriberRegNo: prescriberRegNo.trim() || null,
        prescriberQualification: prescriberQualification.trim() || null,
        hospitalName: hospitalName.trim() || null,
        prescribedDate: prescribedDate || null,
        imageUrl,
        ocrJson,
        notes: notes.trim() || null,
        schedules,
      });
      onCaptured(rx);
      onOpenChange(false);
      reset();
      toast.success('Outside prescription attached to this sale.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the prescription');
    }
  };

  const busy = ocr.isPending || create.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Outside prescription</DialogTitle>
          <DialogDescription>
            For a customer holding a prescription written elsewhere. Photograph it to fill the form,
            then check every field — this is what the statutory register records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Capture ── */}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
              {ocr.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
              Photograph
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> Upload
            </Button>
            {imageUrl && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <FileText className="h-3.5 w-3.5" /> Copy attached
              </span>
            )}
          </div>

          {ocrWarnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Please check these
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-warning/90">
                {ocrWarnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Prescriber: the fields that make a prescription verifiable ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="orx-prescriber">Prescriber name *</Label>
              <Input
                id="orx-prescriber"
                value={prescriberName}
                onChange={(e) => setPrescriberName(e.target.value)}
                placeholder="A. Gaur"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orx-reg">Registration no.</Label>
              <Input
                id="orx-reg"
                value={prescriberRegNo}
                onChange={(e) => setPrescriberRegNo(e.target.value)}
                placeholder="NMC / state council number"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orx-qual">Qualification</Label>
              <Input
                id="orx-qual"
                value={prescriberQualification}
                onChange={(e) => setPrescriberQualification(e.target.value)}
                placeholder="MBBS, MD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orx-hospital">Clinic / hospital</Label>
              <Input
                id="orx-hospital"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orx-date">Prescription date</Label>
              <Input
                id="orx-date"
                type="date"
                value={prescribedDate}
                onChange={(e) => setPrescribedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orx-patient">Patient name</Label>
              <Input
                id="orx-patient"
                value={patientNameRaw}
                onChange={(e) => setPatientNameRaw(e.target.value)}
                placeholder={patientName ?? 'As written on the slip'}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {/* Held nowhere else for a walk-in, and the H1 register needs it. */}
            <Label htmlFor="orx-address">Patient address</Label>
            <Input
              id="orx-address"
              value={patientAddress}
              onChange={(e) => setPatientAddress(e.target.value)}
              placeholder="Required for the Schedule H1 register"
            />
          </div>

          {medicines.length > 0 && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground">Medicines on the slip</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {medicines.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Check the cart matches what was prescribed.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="orx-notes">Notes</Label>
            <Textarea
              id="orx-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || !prescriberName.trim()}>
            {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Attach to sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
