'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, Loader2, UserRound, Link2, ClipboardCheck } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  usePatientDirectory,
  useRegisterTemporaryPatient,
  useMergeTemporaryPatient,
} from '@/hooks/use-hospital';
import type { Patient } from '@/types';

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

/** True when a patient record is still provisional (TEMP- MRN, not merged). */
export function isTemporaryPatient(p?: { mrn?: string | null } | null): boolean {
  return !!p?.mrn && p.mrn.startsWith('TEMP-') && !p.mrn.endsWith('-MERGED');
}

export function tempFullName(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
}

export function tempInitials(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName?.[0] ?? '?'}${p.lastName?.[0] ?? ''}`.toUpperCase();
}

// ============================================================
// Register-in-place dialog (temp → permanent, same row)
// ============================================================

export function RegisterInPlaceDialog({
  patient,
  onClose,
}: {
  patient: Patient | null;
  onClose: () => void;
}) {
  const register = useRegisterTemporaryPatient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Seed the form from the temp record whenever a new one is opened. The
  // placeholder "Temporary N" name is cleared so the desk types the real one.
  useEffect(() => {
    if (patient) {
      setFirstName(
        patient.firstName && !/^Temporary(\s|$)/.test(patient.firstName) ? patient.firstName : '',
      );
      setLastName(patient.lastName ?? '');
      setGender(patient.gender ?? null);
      setDob(patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '');
      setPhone(patient.phone ?? '');
      setEmail(patient.email ?? '');
      setAddress(patient.address ?? patient.addressLine1 ?? '');
      setCity(patient.city ?? '');
      setState(patient.state ?? '');
      setZipCode(patient.zipCode ?? patient.postalCode ?? '');
    }
  }, [patient]);

  const submit = async () => {
    if (!patient) return;
    if (!firstName.trim()) {
      toast.error('First name is required to register the patient');
      return;
    }
    try {
      const updated = await register.mutateAsync({
        id: patient.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          gender: (gender as any) || undefined,
          dateOfBirth: dob || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zipCode: zipCode.trim() || undefined,
        },
      });
      toast.success(`Registered as ${updated?.mrn ?? 'permanent patient'}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to register patient');
    }
  };

  return (
    <Dialog open={!!patient} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Patient</DialogTitle>
          <DialogDescription>
            Fill in the patient&apos;s details — same form as a new registration. A permanent MRN is
            issued and all existing visits, admissions and bills stay on the same record — nothing is
            duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          {/* Basic info */}
          <div className="rounded-lg border border-dashed border-outline-variant/40 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Basic Info
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter first name" />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter last name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">
                        {g.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-lg border border-dashed border-outline-variant/40 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Address (Optional)
            </p>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
            <div className="grid grid-cols-3 gap-3">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="Zip Code" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={register.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={register.isPending}>
            {register.isPending && <Loader2 className="size-4 animate-spin" />}
            Register Patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Merge / Connect dialog (temp → existing registered patient)
// ============================================================

export function MergeDialog({
  patient,
  onClose,
}: {
  patient: Patient | null;
  onClose: () => void;
}) {
  const merge = useMergeTemporaryPatient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

  const { data, isFetching } = usePatientDirectory({
    category: 'registered',
    search: search.trim() || undefined,
    page: 1,
    limit: 10,
  });
  const results = (data?.patients ?? []).filter((p) => p.id !== patient?.id);

  const close = () => {
    setSearch('');
    setSelected(null);
    onClose();
  };

  const submit = async () => {
    if (!patient || !selected) return;
    try {
      await merge.mutateAsync({ id: patient.id, targetPatientId: selected.id });
      toast.success(`Connected ${patient.mrn} to ${selected.mrn}`);
      close();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to connect patient');
    }
  };

  return (
    <Dialog open={!!patient} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect to Existing Patient</DialogTitle>
          <DialogDescription>
            Move this temporary record&apos;s visits, admissions and bills onto an already-registered
            patient. The temporary record is retired — no duplicate is left behind.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* The temporary record being connected */}
          {patient && (
            <div className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container/40 p-3">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">{tempInitials(patient)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-on-surface">{tempFullName(patient)}</span>
                  <Badge variant="secondary" className="uppercase">Temp</Badge>
                </div>
                <div className="truncate text-xs text-on-surface-variant">
                  {patient.mrn} · {patient.phone || 'no phone'}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            <span className="h-px flex-1 bg-outline-variant/40" />
            Connect into
            <span className="h-px flex-1 bg-outline-variant/40" />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder="Search registered patients by name, MRN, phone…"
              className="pl-9"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-outline-variant/40 p-1">
            {isFetching ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-on-surface-variant" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-on-surface-variant">
                {search.trim() ? 'No matching patients.' : 'Type to search patients.'}
              </div>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                    selected?.id === p.id ? 'bg-primary/10' : 'hover:bg-surface-container-high',
                  )}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{tempInitials(p)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-on-surface">{tempFullName(p)}</div>
                    <div className="truncate text-xs text-on-surface-variant">
                      {p.mrn} · {p.phone || 'no phone'}
                    </div>
                  </div>
                  {selected?.id === p.id && <UserRound className="size-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={merge.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selected || merge.isPending}>
            {merge.isPending && <Loader2 className="size-4 animate-spin" />}
            Connect Patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TempPatientActions — self-contained Register + Connect buttons for a row
// ============================================================

export function TempPatientActions({
  patient,
  size = 'sm',
}: {
  patient: Patient;
  size?: 'sm' | 'default';
}) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  if (!isTemporaryPatient(patient)) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size={size} variant="outline" onClick={() => setRegisterOpen(true)}>
          <ClipboardCheck className="size-3.5" />
          Register
        </Button>
        <Button size={size} variant="ghost" onClick={() => setMergeOpen(true)}>
          <Link2 className="size-3.5" />
          Connect
        </Button>
      </div>
      <RegisterInPlaceDialog patient={registerOpen ? patient : null} onClose={() => setRegisterOpen(false)} />
      <MergeDialog patient={mergeOpen ? patient : null} onClose={() => setMergeOpen(false)} />
    </>
  );
}
