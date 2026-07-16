'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Siren, Loader2, Stethoscope, BedDouble, Info } from 'lucide-react';
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useDoctorsList } from '@/hooks/use-hospital';
import { useWards, useBeds } from '@/hooks/use-clinical';
import { useCreateEmergencyPatient } from '@/hooks/use-emergency';
import type { DoctorProfile } from '@/types';

type EmergencyType = 'op' | 'ip';

interface EmergencyPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preselected route; defaults to OP. */
  defaultType?: EmergencyType;
  onSuccess?: () => void;
}

/**
 * Front-desk Emergency / Casualty intake. Mints a temporary patient with (little
 * or) no data and routes it as OP or IP; from there it flows through the normal
 * pipeline, highlighted everywhere as EMERGENCY, until it is registered or
 * connected to an existing patient.
 */
export function EmergencyPatientDialog({
  open,
  onOpenChange,
  defaultType = 'op',
  onSuccess,
}: EmergencyPatientDialogProps) {
  const router = useRouter();
  const create = useCreateEmergencyPatient();

  const [type, setType] = useState<EmergencyType>(defaultType);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [billingCategory, setBillingCategory] = useState('cash');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const { data: doctorsRaw } = useDoctorsList();
  const { data: wards } = useWards();
  const { data: beds } = useBeds(wardId ? { wardId } : undefined);

  const doctors = useMemo(
    () =>
      (doctorsRaw || []).map((d: DoctorProfile) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
        specialization: d.specialization,
      })),
    [doctorsRaw],
  );
  const availableBeds = useMemo(
    () => (beds || []).filter((b) => b.status === 'available'),
    [beds],
  );

  useEffect(() => {
    if (open) setType(defaultType);
  }, [open, defaultType]);

  useEffect(() => {
    if (!open) {
      setFirstName('');
      setLastName('');
      setGender('');
      setAge('');
      setPhone('');
      setDoctorId('');
      setWardId('');
      setBedId('');
      setBillingCategory('cash');
      setChiefComplaint('');
    }
  }, [open]);

  // Reset bed when ward changes.
  useEffect(() => {
    setBedId('');
  }, [wardId]);

  async function handleSubmit() {
    try {
      const result = await create.mutateAsync({
        type,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        gender: gender || undefined,
        age: age ? Number(age) : undefined,
        phone: phone.trim() || undefined,
        doctorId: doctorId || undefined,
        wardId: type === 'ip' ? wardId || undefined : undefined,
        bedId: type === 'ip' ? bedId || undefined : undefined,
        billingCategory: type === 'ip' ? (billingCategory as any) : undefined,
        chiefComplaint: chiefComplaint.trim() || undefined,
      });
      toast.success(
        `Emergency ${type.toUpperCase()} patient created — ${result.mrn}` +
          (result.tokenNumber ? ` · Token #${result.tokenNumber}` : ''),
      );
      onOpenChange(false);
      onSuccess?.();
      // Take the front desk straight to where the case now lives.
      if (type === 'ip' && result.admissionId) {
        router.push(`/hospital/ip/${result.admissionId}`);
      } else if (type === 'op') {
        router.push('/hospital/walkin');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create emergency patient');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-red-600" />
            New Emergency Patient
          </DialogTitle>
          <DialogDescription>
            A temporary casualty patient — no registration needed. It works exactly like a normal
            {' '}OP / IP patient and stays highlighted as EMERGENCY until you register or connect it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* OP / IP choice */}
          <div className="grid grid-cols-2 gap-2">
            {(['op', 'ip'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors',
                  type === t
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40',
                )}
              >
                {t === 'op' ? <Stethoscope className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
                {t === 'op' ? 'Out-patient (OP)' : 'In-patient (IP)'}
              </button>
            ))}
          </div>

          {/* Identity (all optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name / label</Label>
              <Input
                placeholder="Unknown"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Age</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Attending doctor (optional; placeholder fallback) */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {type === 'op' ? 'Casualty doctor' : 'Attending doctor'}{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Assign later" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.specialization ? ` · ${d.specialization}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* IP-only placement */}
          {type === 'ip' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-dashed border-border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ward <span className="text-muted-foreground">(optional)</span></Label>
                <Select value={wardId} onValueChange={(v) => setWardId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pending placement" />
                  </SelectTrigger>
                  <SelectContent>
                    {(wards || []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bed <span className="text-muted-foreground">(optional)</span></Label>
                <Select value={bedId} onValueChange={(v) => setBedId(v ?? '')} disabled={!wardId}>
                  <SelectTrigger>
                    <SelectValue placeholder={wardId ? 'Select bed' : 'Choose ward first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBeds.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bedNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Billing category</Label>
                <Select value={billingCategory} onValueChange={(v) => setBillingCategory(v ?? 'cash')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Chief complaint */}
          <div className="space-y-1.5">
            <Label className="text-xs">Chief complaint / reason <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="e.g. RTA, chest pain, trauma…"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            The credit / deposit gate is bypassed for emergency patients — treatment and
            dispensing start immediately.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Siren className="mr-1.5 h-4 w-4" /> Create Emergency {type.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
