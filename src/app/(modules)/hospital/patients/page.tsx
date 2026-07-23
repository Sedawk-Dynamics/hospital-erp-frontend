'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Loader2,
  UserRound,
  Link2,
  ClipboardCheck,
  BadgeCheck,
} from 'lucide-react';

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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  usePatientDirectory,
  useRegisterTemporaryPatient,
  useMergeTemporaryPatient,
  type PatientCategory,
} from '@/hooks/use-hospital';
import type { Patient } from '@/types';

const TABS: { key: PatientCategory; label: string; hint: string }[] = [
  { key: 'all', label: 'All Patients', hint: 'Everyone who has visited the hospital' },
  { key: 'registered', label: 'Registered', hint: 'Patients with a permanent record' },
  { key: 'temporary', label: 'Temporary', hint: 'Provisional — register or connect later' },
];

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

function isTemp(p: Patient): boolean {
  return !!p.mrn && p.mrn.startsWith('TEMP-');
}

function fullName(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
}

function ageFromDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? `${age} yr` : '—';
}

function initials(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName?.[0] ?? '?'}${p.lastName?.[0] ?? ''}`.toUpperCase();
}

export default function HospitalPatientsPage() {
  const [category, setCategory] = useState<PatientCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [registerTarget, setRegisterTarget] = useState<Patient | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Patient | null>(null);

  const { data, isLoading, isFetching } = usePatientDirectory({
    category,
    search: search.trim() || undefined,
    page,
    limit: 20,
  });

  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const switchTab = useCallback((key: PatientCategory) => {
    setCategory(key);
    setPage(1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-on-surface">Patients</h1>
            <p className="text-sm text-on-surface-variant">
              Every patient the hospital has seen — registered and temporary.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            title={t.hint}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              category === t.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, MRN, or phone…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant/40 bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>MRN</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-on-surface-variant" />
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-on-surface-variant">
                  No patients found.
                </TableCell>
              </TableRow>
            ) : (
              patients.map((p) => {
                const temp = isTemp(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(p)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-on-surface">{fullName(p)}</span>
                            {temp && (
                              <Badge variant="secondary" className="uppercase">Temp</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
                    <TableCell className="capitalize">{p.gender ?? '—'}</TableCell>
                    <TableCell>{ageFromDob(p.dateOfBirth)}</TableCell>
                    <TableCell>{p.phone || '—'}</TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {temp ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRegisterTarget(p)}>
                            <ClipboardCheck className="size-3.5" />
                            Register
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMergeTarget(p)}>
                            <Link2 className="size-3.5" />
                            Connect
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                          <BadgeCheck className="size-3.5 text-primary" />
                          Registered
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-on-surface-variant">
          <span>
            {total} patient{total === 1 ? '' : 's'}
            {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin" />}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="px-2 py-1">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <RegisterInPlaceDialog patient={registerTarget} onClose={() => setRegisterTarget(null)} />
      <MergeDialog patient={mergeTarget} onClose={() => setMergeTarget(null)} />
    </div>
  );
}

// ============================================================
// Register-in-place dialog (temp → permanent, same row)
// ============================================================

function RegisterInPlaceDialog({
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

  // Seed the form from the temp record whenever a new one is opened.
  useEffect(() => {
    if (patient) {
      setFirstName(patient.firstName && patient.firstName !== 'Temporary' ? patient.firstName : '');
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
// Merge dialog (temp → existing registered patient)
// ============================================================

function MergeDialog({
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
                <AvatarFallback className="text-xs">{initials(patient)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-on-surface">{fullName(patient)}</span>
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
                    <AvatarFallback className="text-xs">{initials(p)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-on-surface">{fullName(p)}</div>
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
