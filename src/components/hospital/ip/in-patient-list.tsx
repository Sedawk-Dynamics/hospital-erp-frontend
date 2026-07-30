'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { AdmissionTypeBadge, ADMISSION_TYPE_OPTIONS, type AdmissionType } from '@/components/shared/admission-type-badge';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  ArrowRightLeft,
  LogOut,
  Printer,
  ClipboardCheck,
  Link2,
  CheckCircle2,
  ExternalLink,
  UserPlus,
  Receipt,
  PieChart,
  Wallet,
  Loader2,
  BedDouble,
  FileText,
  FileWarning,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { formatDate, formatDateTime, toInputDateStr } from '@/lib/date-utils';
import { toast } from 'sonner';
import type { Admission, Patient, DoctorProfile, BedWithStatus } from '@/types';
import { FrontDeskRegisterDialog } from '@/components/hospital/frontdesk-register-dialog';
import {
  RegisterInPlaceDialog,
  MergeDialog,
  isTemporaryPatient,
} from '@/components/hospital/temp-patient-actions';
import { BillGeneratorDialog } from '@/components/hospital/billing/bill-generator-dialog';
import { AdvancePaymentDialog } from '@/components/hospital/billing/week12-dialogs';
import { BillingSummaryDialog } from '@/components/pharmacy/billing-summary-dialog';
import { AssignBedDialog } from '@/components/hospital/ip/assign-bed-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useGlobalPatientSearch, useProvisionLocalPatient } from '@/hooks/use-hospital';
import { useAuthStore } from '@/stores/auth-store';

// Generating a bill or collecting advance are billing actions. Gate on the
// real billing:create permission so the billing / cash counter (front desk,
// cashier, billing admin, admin) sees them and clinical roles (doctor, nurse,
// lab, etc.) don't — instead of hardcoding admin-only.
function useCanBillToHospital() {
  const { canAccess } = usePermissions();
  return canAccess('billing', 'create');
}

// ---------------------------------------------------------------------------
// Stat items for the filter row
// ---------------------------------------------------------------------------
const statItems = [
  { key: 'all', label: 'Total', color: 'text-foreground' },
  { key: 'admitted', label: 'In IP', color: 'text-blue-600' },
  { key: 'discharged', label: 'Discharged', color: 'text-green-600' },
  { key: 'absconded', label: 'Cancelled', color: 'text-red-600' },
];

interface Floor {
  id: string;
  name: string;
  level: number;
}

interface Ward {
  id: string;
  name: string;
  wardType?: string;
  totalBeds?: number;
  floorId?: string | null;
  floor?: { id: string; name: string; level: number } | null;
}

interface WardAvailability {
  wardId: string;
  available: number;
  occupied: number;
  reserved: number;
  totalBeds: number;
}

// Standard admission checklist (used both during admission and on detail view)
const ADMISSION_CHECKLIST = [
  { key: 'id_proof', label: 'Government ID proof verified', required: true },
  { key: 'consent', label: 'Admission consent form signed', required: true },
  { key: 'insurance', label: 'Insurance / TPA card collected (if applicable)', required: false },
  { key: 'allergy', label: 'Drug allergy history recorded', required: true },
  { key: 'belongings', label: 'Patient belongings list signed', required: false },
  { key: 'kin_contact', label: 'Next-of-kin contact captured', required: true },
  { key: 'deposit', label: 'Advance deposit collected', required: true },
  { key: 'orientation', label: 'Ward / bed orientation given to attendant', required: false },
];

// ---------------------------------------------------------------------------
// AdmissionDialog — Create a new admission (multi-step: details → checklist)
// Supports two patient modes:
//   - 'existing': search the registry and pick a patient (default)
//   - 'new':      register a new patient inline before admitting
// ---------------------------------------------------------------------------
function AdmissionDialog({
  open,
  onOpenChange,
  onAdmitted,
  initialMode = 'existing',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdmitted: (admission: Admission) => void;
  initialMode?: 'existing' | 'new';
}) {
  const queryClient = useQueryClient();
  // Register the patient first, then capture the admission, then confirm — the
  // patient step mirrors the OP "Register New Patient" form; the second step is
  // "Admit Patient" (the IP counterpart of OP's "Book Appointment").
  const [step, setStep] = useState<'patient' | 'admit' | 'checklist'>('patient');

  // Patient mode toggle — switches between search and inline registration
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>(initialMode);
  // When ticked (new-patient mode), save a provisional (TEMP-) record instead of
  // admitting — every field is optional.
  const [isTemporary, setIsTemporary] = useState(false);


  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  // Hold on to the picked patient so the display survives search changes.
  const [selectedPatientSnapshot, setSelectedPatientSnapshot] = useState<Patient | null>(null);

  // New-patient inline registration fields (used when patientMode === 'new')
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    gender: 'male' as 'male' | 'female' | 'other',
    dateOfBirth: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [admissionType, setAdmissionType] = useState<AdmissionType>('ip');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(toInputDateStr());
  const [expectedDischarge, setExpectedDischarge] = useState('');
  const [admissionReason, setAdmissionReason] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  // How this IP stay settles — drives the credit gate + TPA reimbursable split.
  const [billingCategory, setBillingCategory] = useState<'cash' | 'package' | 'insurance' | 'corporate'>('cash');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Debounced patient search
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPatientSearch(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Patient search spans EVERY hospital on the ERP (a patient is one person).
  const { data: matches } = useGlobalPatientSearch(
    patientMode === 'existing' ? debouncedPatientSearch : '',
  );
  const provisionLocal = useProvisionLocalPatient();

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () =>
      apiGet<DoctorProfile[]>('/appointments/doctors', { params: { limit: 100 } }),
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors-list'],
    queryFn: () =>
      apiGet<Floor[]>('/infrastructure/floors', { params: { limit: 200 } }),
  });

  const { data: wardsData } = useQuery({
    queryKey: ['wards-list', selectedFloorId],
    queryFn: () =>
      apiGet<Ward[]>('/infrastructure/wards', {
        params: { limit: 200, ...(selectedFloorId && { floorId: selectedFloorId }) },
      }),
  });

  // Per-ward availability (available/occupied/reserved/total) for dropdown badges
  const { data: availabilityData } = useQuery({
    queryKey: ['beds-availability-summary', selectedFloorId],
    queryFn: () =>
      apiGet<{ summary: unknown; wards: WardAvailability[] }>(
        '/infrastructure/beds/availability',
        { params: { ...(selectedFloorId && { floorId: selectedFloorId }) } },
      ),
  });

  const { data: bedsData } = useQuery({
    queryKey: ['beds-available', selectedWardId, selectedPatientId],
    queryFn: () =>
      apiGet<BedWithStatus[]>('/infrastructure/beds', {
        params: {
          wardId: selectedWardId,
          status: 'available',
          // Include this patient's already-reserved bed in the picker.
          ...(selectedPatientId ? { forPatientId: selectedPatientId } : {}),
          limit: 200,
        },
      }),
    enabled: !!selectedWardId,
  });

  // Reset bed when ward changes
  useEffect(() => {
    setSelectedBedId('');
  }, [selectedWardId]);

  // Reset ward + bed when floor changes
  useEffect(() => {
    setSelectedWardId('');
    setSelectedBedId('');
  }, [selectedFloorId]);

  const patientMatches = matches ?? [];
  const doctors = doctorsData?.data ?? [];
  const floors = floorsData?.data ?? [];
  const wards = wardsData?.data ?? [];
  const beds = bedsData?.data ?? [];
  const availabilityByWard = new Map(
    (availabilityData?.data?.wards ?? []).map((w) => [w.wardId, w]),
  );

  const selectedPatient = selectedPatientSnapshot ?? undefined;
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const selectedFloor = floors.find((f) => f.id === selectedFloorId);
  const selectedWard = wards.find((w) => w.id === selectedWardId);
  const selectedBed = beds.find((b) => b.id === selectedBedId);

  const doctorName = (d?: typeof doctors[number]) =>
    d ? `Dr. ${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() : '';


  // Mutation: optionally register patient → create visit → create admission
  const admitMutation = useMutation({
    mutationFn: async () => {
      let patientId = selectedPatientId;

      // Step 0 (new mode only): register the patient first
      if (patientMode === 'new') {
        const payload: Record<string, unknown> = {
          firstName: newPatient.firstName.trim(),
          lastName: newPatient.lastName.trim(),
          gender: newPatient.gender,
          phone: newPatient.phone.trim(),
        };
        if (newPatient.dateOfBirth) payload.dateOfBirth = newPatient.dateOfBirth;
        if (newPatient.email.trim()) payload.email = newPatient.email.trim();
        if (newPatient.address.trim()) payload.address = newPatient.address.trim();
        if (newPatient.city.trim()) payload.city = newPatient.city.trim();
        if (newPatient.state.trim()) payload.state = newPatient.state.trim();
        if (newPatient.zipCode.trim()) payload.zipCode = newPatient.zipCode.trim();

        const patientRes = await apiPost<Patient>('/patients', payload);
        if (!patientRes.data?.id) throw new Error('Failed to register patient');
        patientId = patientRes.data.id;
      }

      // Step 1: create an IP visit (doctor optional — omit when not chosen).
      const visitRes = await apiPost<{ id: string }>('/clinical/visits', {
        patientId,
        doctorId: selectedDoctorId || undefined,
        visitType: 'ip',
        visitDate: admissionDate,
      });
      const visitId = visitRes.data.id;

      // Step 2: create admission
      const admissionRes = await apiPost<Admission>('/clinical/admissions', {
        visitId,
        patientId,
        // Doctor optional now — omit when not chosen.
        doctorId: selectedDoctorId || undefined,
        admissionType,
        // No bed/ward at registration — assigned later from the IP workspace.
        admissionDate,
        expectedDischargeDate: expectedDischarge || undefined,
        admissionReason: admissionReason || undefined,
        depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
        billingCategory,
      });
      return admissionRes.data;
    },
    onSuccess: (admission) => {
      toast.success(
        patientMode === 'new'
          ? 'Patient registered and admitted successfully'
          : 'Patient admitted successfully',
      );
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['beds-available'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onAdmitted(admission);
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to admit patient');
    },
  });

  // Register-only: the register-new-patient box just creates the patient record.
  // Admission is a separate action (pick the now-existing patient and admit).
  const registerOnlyMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        firstName: newPatient.firstName.trim(),
        lastName: newPatient.lastName.trim(),
        gender: newPatient.gender,
        phone: newPatient.phone.trim(),
      };
      if (newPatient.dateOfBirth) payload.dateOfBirth = newPatient.dateOfBirth;
      if (newPatient.email.trim()) payload.email = newPatient.email.trim();
      if (newPatient.address.trim()) payload.address = newPatient.address.trim();
      if (newPatient.city.trim()) payload.city = newPatient.city.trim();
      if (newPatient.state.trim()) payload.state = newPatient.state.trim();
      if (newPatient.zipCode.trim()) payload.zipCode = newPatient.zipCode.trim();
      const res = await apiPost<Patient>('/patients', payload);
      if (!res.data?.id) throw new Error('Failed to register patient');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Patient registered successfully');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to register patient');
    },
  });

  const resetForm = useCallback(() => {
    setPatientSearch('');
    setSelectedPatientId('');
    setSelectedPatientSnapshot(null);
    setNewPatient({
      firstName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
    });
    setPatientMode(initialMode);
    setIsTemporary(false);
    setSelectedDoctorId('');
    setAdmissionType('ip');
    setSelectedFloorId('');
    setSelectedWardId('');
    setSelectedBedId('');
    setAdmissionDate(toInputDateStr());
    setExpectedDischarge('');
    setAdmissionReason('');
    setDepositAmount('');
    setBillingCategory('cash');
    setChecklist({});
    setStep('patient');
  }, [initialMode]);

  const newPatientValid =
    newPatient.firstName.trim().length > 0 &&
    newPatient.lastName.trim().length > 0 &&
    /^[+]?[\d\s()-]{7,15}$/.test(newPatient.phone.trim());

  const patientValid =
    patientMode === 'existing' ? !!selectedPatientId : newPatientValid;

  // Quick "Save as Temporary" — create a provisional (TEMP-) patient from the
  // inline fields without admitting. It becomes a normal patient that can be
  // admitted, registered in place, or connected later from the Patients page.
  const [savingTemp, setSavingTemp] = useState(false);
  const handleSaveAsTemporary = async () => {
    try {
      setSavingTemp(true);
      const resp = await apiPost<Patient>('/patients/temporary', {
        firstName: newPatient.firstName.trim() || undefined,
        lastName: newPatient.lastName.trim() || undefined,
        gender: newPatient.gender || undefined,
        dateOfBirth: newPatient.dateOfBirth || undefined,
        phone: newPatient.phone.trim() || undefined,
        email: newPatient.email.trim() || undefined,
        address: newPatient.address.trim() || undefined,
        city: newPatient.city.trim() || undefined,
        state: newPatient.state.trim() || undefined,
        zipCode: newPatient.zipCode.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success(`Temporary patient created (${resp.data?.mrn ?? 'TEMP'})`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create temporary patient');
    } finally {
      setSavingTemp(false);
    }
  };

  // Only the patient is required to admit now — doctor, bed and ward are all
  // optional and assigned later. Admission type always has a value (defaults IP).
  const detailsValid = patientValid;

  const requiredChecklistDone = ADMISSION_CHECKLIST.filter((c) => c.required).every(
    (c) => checklist[c.key],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {patientMode === 'new' ? (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                Register New Patient &amp; Admit
              </>
            ) : (
              'Admit Patient'
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'patient'
              ? patientMode === 'new'
                ? 'Register the new patient, then admit them to a bed.'
                : 'Pick the patient, then admit them to a bed.'
              : step === 'admit'
                ? 'Fill in admission details (ward, bed, doctor, deposit).'
                : 'Verify the admission checklist before confirming.'}
          </DialogDescription>
        </DialogHeader>


        {step === 'patient' && (
          <div className="grid gap-4 py-2">
            {/* Admission works on an existing patient. To bring in someone new,
                register them first via the Register New Patient box, then admit. */}
            {patientMode === 'new' ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">

                {/* Temporary-patient tickmark — relaxes all fields to optional */}
                <label className="flex items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container/40 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTemporary}
                    onChange={(e) => setIsTemporary(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Temporary patient</p>
                    <p className="text-xs text-on-surface-variant">
                      Save now with partial details — all fields optional and the patient is not
                      admitted. Complete or connect the record later from the Patients page.
                    </p>
                  </div>
                </label>

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  New Patient Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>First Name *</Label>
                    <Input
                      placeholder="First name"
                      value={newPatient.firstName}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, firstName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Last Name *</Label>
                    <Input
                      placeholder="Last name"
                      value={newPatient.lastName}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, lastName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Gender *</Label>
                    <Select
                      value={newPatient.gender}
                      onValueChange={(v) =>
                        v &&
                        setNewPatient((p) => ({
                          ...p,
                          gender: v as 'male' | 'female' | 'other',
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={newPatient.dateOfBirth}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Phone *</Label>
                    <Input
                      placeholder="+91XXXXXXXXXX"
                      value={newPatient.phone}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="Optional"
                      value={newPatient.email}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5 col-span-2">
                    <Label>Address</Label>
                    <Input
                      placeholder="Street address (optional)"
                      value={newPatient.address}
                      onChange={(e) =>
                        setNewPatient((p) => ({ ...p, address: e.target.value }))
                      }
                    />
                  </div>
                  {/* City / State / Zip — same optional address fields the OP
                      registration form collects, so IP captures identical data. */}
                  <div className="grid grid-cols-3 gap-3 col-span-2">
                    <Input
                      placeholder="City"
                      value={newPatient.city}
                      onChange={(e) => setNewPatient((p) => ({ ...p, city: e.target.value }))}
                    />
                    <Input
                      placeholder="State"
                      value={newPatient.state}
                      onChange={(e) => setNewPatient((p) => ({ ...p, state: e.target.value }))}
                    />
                    <Input
                      placeholder="Zip Code"
                      value={newPatient.zipCode}
                      onChange={(e) => setNewPatient((p) => ({ ...p, zipCode: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  An MRN will be auto-generated when the patient is registered.
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Patient *</Label>
                {selectedPatientId ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">
                    {selectedPatient
                      ? `${[selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(' ')}${selectedPatient.mrn ? ` (${selectedPatient.mrn})` : ''}`
                      : 'Loading patient…'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPatientId('');
                      setSelectedPatientSnapshot(null);
                      setPatientSearch('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Search by name, MRN, phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientMatches.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover">
                      {patientMatches.map((m) => (
                        <button
                          key={m.sourcePatientId}
                          type="button"
                          disabled={provisionLocal.isPending}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left disabled:opacity-50"
                          onClick={async () => {
                            // Local → use directly; cross-hospital → provision a
                            // local record (new MRN, same person) then use it.
                            let localId = m.localPatientId;
                            let snap: Patient = { id: localId ?? m.sourcePatientId, firstName: m.firstName, lastName: m.lastName, mrn: m.mrn, phone: m.phone } as Patient;
                            if (!localId) {
                              try {
                                const p = await provisionLocal.mutateAsync(m.sourcePatientId);
                                if (!p?.id) throw new Error('no id');
                                localId = p.id;
                                snap = p;
                                toast.success(`Added ${p.firstName} to this hospital (MRN ${p.mrn})`);
                              } catch {
                                toast.error('Could not add this patient to your hospital');
                                return;
                              }
                            }
                            setSelectedPatientId(localId);
                            setSelectedPatientSnapshot(snap);
                            setPatientSearch([snap.firstName, snap.lastName].filter(Boolean).join(' '));
                          }}
                        >
                          <span className="font-medium">
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {m.isLocal ? (m.mrn ?? '—') : `at ${m.hospital}`} | {m.phone ?? '—'}
                          </span>
                          {!m.isLocal && (
                            <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Add here
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            )}
          </div>
        )}

        {step === 'admit' && (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Admission type — IP / Emergency / Day Care. All three run the
                  same IP flow; this just tags + filters the admission. */}
              <div className="col-span-2 grid gap-1.5">
                <Label>Admission Type *</Label>
                <div className="flex gap-1.5">
                  {ADMISSION_TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setAdmissionType(o.value)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        admissionType === o.value
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <>
                  <div className="grid gap-1.5">
                    <Label>Admission Date *</Label>
                    <Input
                      type="date"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Expected Discharge</Label>
                    <Input
                      type="date"
                      value={expectedDischarge}
                      onChange={(e) => setExpectedDischarge(e.target.value)}
                    />
                  </div>

                  {/* Deposit */}
                  <div className="grid gap-1.5">
                    <Label>Deposit / Advance Amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
              </>

              {/* Billing category — cash vs insurance / corporate (TPA) */}
              <div className="grid gap-1.5">
                <Label>Billing Category</Label>
                <Select value={billingCategory} onValueChange={(v) => { if (v) setBillingCategory(v as typeof billingCategory); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                    <SelectItem value="insurance">Insurance (TPA)</SelectItem>
                    <SelectItem value="corporate">Corporate (TPA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Consultant doctor — optional (assign now or later); kept small. */}
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">
                  Consultant Doctor <span className="font-normal">(optional)</span>
                </Label>
                <Select value={selectedDoctorId} onValueChange={(v) => setSelectedDoctorId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign a doctor">
                      {() => (selectedDoctor ? doctorName(selectedDoctor) : 'Assign a doctor')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {doctorName(d)}
                        {d.specialization ? ` — ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div className="grid gap-1.5">
              <Label>Diagnosis / Admission Reason</Label>
              <Textarea
                placeholder="Provisional diagnosis or chief complaint..."
                value={admissionReason}
                onChange={(e) => setAdmissionReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {step === 'checklist' && (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Patient:</span>{' '}
                <strong>
                  {patientMode === 'new'
                    ? `${newPatient.firstName} ${newPatient.lastName}`.trim()
                    : `${selectedPatient?.firstName ?? ''} ${selectedPatient?.lastName ?? ''}`.trim()}
                </strong>{' '}
                {patientMode === 'new' ? (
                  <span className="text-primary font-semibold">(New · MRN pending)</span>
                ) : (
                  <>({selectedPatient?.mrn})</>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Doctor:</span>{' '}
                <strong>
                  Dr. {selectedDoctor?.user?.firstName} {selectedDoctor?.user?.lastName}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Bed:</span>{' '}
                <strong>{selectedBed?.bedNumber}</strong> in{' '}
                <strong>{selectedWard?.name}</strong>
                {selectedWard?.floor ? (
                  <span className="text-muted-foreground">
                    {' '}· Floor {selectedWard.floor.level} ({selectedWard.floor.name})
                  </span>
                ) : null}
              </p>
              <p>
                <span className="text-muted-foreground">Deposit:</span>{' '}
                <strong>₹{Number(depositAmount || 0).toLocaleString('en-IN')}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Confirm required documents (marked *) are collected.
            </p>
            <ul className="space-y-2">
              {ADMISSION_CHECKLIST.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[item.key]}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                  <span className="text-sm">
                    {item.label}
                    {item.required && <span className="text-destructive ml-1">*</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {step === 'patient' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {patientMode === 'new' ? (
                isTemporary ? (
                  <Button disabled={savingTemp} onClick={handleSaveAsTemporary}>
                    {savingTemp && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Temporary Patient
                  </Button>
                ) : (
                  // Register-patient box only registers — admitting is a separate
                  // action from the IP page (search the patient, then admit).
                  <Button
                    disabled={!newPatientValid || registerOnlyMutation.isPending}
                    onClick={() => registerOnlyMutation.mutate()}
                  >
                    {registerOnlyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Register Patient
                  </Button>
                )
              ) : (
                <Button disabled={!patientValid} onClick={() => setStep('admit')}>
                  Next: Admit Patient
                </Button>
              )}
            </>
          ) : step === 'admit' ? (
            <>
              <Button variant="outline" onClick={() => setStep('patient')}>
                Back
              </Button>
              <Button disabled={!detailsValid} onClick={() => setStep('checklist')}>
                Next: Checklist
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('admit')}>
                Back
              </Button>
              <Button
                onClick={() => admitMutation.mutate()}
                disabled={admitMutation.isPending || !requiredChecklistDone}
              >
                {admitMutation.isPending ? 'Admitting...' : 'Confirm Admission'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AdmissionSlipDialog — Printable admission slip
// ---------------------------------------------------------------------------
function AdmissionSlipDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const slipRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!slipRef.current) return;
    const html = slipRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Admission Slip — ${admission?.patient?.firstName} ${admission?.patient?.lastName}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;margin:24px;font-size:13px;line-height:1.5}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  td{padding:4px 6px;vertical-align:top}
  td.lbl{color:#666;width:38%}
  td.val{font-weight:600}
  ul{margin:4px 0 0 0;padding-left:18px}
  li{margin-bottom:3px}
  .header{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #111;padding-bottom:8px}
  .muted{color:#666;font-size:11px}
  .signrow{display:flex;justify-content:space-between;margin-top:50px}
  .sign{border-top:1px solid #111;padding-top:4px;font-size:11px;width:200px;text-align:center}
</style>
</head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
  };

  if (!admission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admission Slip</DialogTitle>
          <DialogDescription>
            Generated for {admission.patient?.firstName} {admission.patient?.lastName}
          </DialogDescription>
        </DialogHeader>

        <div ref={slipRef} className="rounded-lg border bg-white p-6 text-foreground">
          <div className="header flex items-end justify-between border-b-2 border-foreground pb-2">
            <div>
              <h1 className="text-lg font-bold">ADMISSION SLIP</h1>
              <p className="muted text-xs text-muted-foreground">
                Generated: {formatDateTime(new Date())}
              </p>
            </div>
            <div className="text-right text-xs">
              <p>
                <strong>IP No:</strong> {admission.id?.slice(0, 8).toUpperCase()}
              </p>
              <p>
                <strong>Admission Date:</strong> {formatDate(admission.admissionDate)}
              </p>
            </div>
          </div>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Patient Details</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="lbl text-muted-foreground py-1">Name</td>
                <td className="val font-semibold">
                  {admission.patient?.firstName} {admission.patient?.lastName}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">MRN</td>
                <td className="val font-semibold">{admission.patient?.mrn ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Phone</td>
                <td className="val font-semibold">{admission.patient?.phone ?? '-'}</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Admission Details</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="lbl text-muted-foreground py-1">Consultant</td>
                <td className="val font-semibold">
                  Dr. {admission.doctor?.user?.firstName} {admission.doctor?.user?.lastName}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Ward</td>
                <td className="val font-semibold">{admission.ward?.name ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Bed</td>
                <td className="val font-semibold">{admission.bed?.bedNumber ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Diagnosis / Reason</td>
                <td className="val font-semibold">{admission.admissionReason ?? '-'}</td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Expected Discharge</td>
                <td className="val font-semibold">
                  {admission.expectedDischargeDate
                    ? formatDate(admission.expectedDischargeDate)
                    : '-'}
                </td>
              </tr>
              <tr>
                <td className="lbl text-muted-foreground py-1">Deposit Collected</td>
                <td className="val font-semibold">
                  ₹{Number(admission.depositAmount ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-semibold mt-4 border-b pb-1">Required Documents</h2>
          <ul className="text-sm">
            {ADMISSION_CHECKLIST.map((item) => (
              <li key={item.key}>
                ☐ {item.label}
                {item.required ? ' *' : ''}
              </li>
            ))}
          </ul>

          <div className="signrow flex justify-between mt-12 text-xs">
            <div className="sign border-t pt-1 w-[200px] text-center">
              Patient / Attendant
            </div>
            <div className="sign border-t pt-1 w-[200px] text-center">Admitting Officer</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Slip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// DischargeDialog
// ---------------------------------------------------------------------------
// G5 (2.1): shape of the assembled final-bill summary returned by the discharge API.
type DischargeBillingSummary = {
  finalBillId: string | null;
  totalBilled: number;
  totalPaid: number;
  totalBalanceDue: number;
  depositAmount: number;
  advanceApplied: number;
  netAfterDeposit: number;
  refundDue: number;
  bills: Array<{ billNumber: string; status: string; totalAmount: number; balanceDue: number }>;
};

function DischargeDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const roles = user?.roles ?? (user?.role?.name ? [user.role.name] : []);
  const canForce = roles.some((r) => r === 'admin' || r === 'super_admin');

  const [dischargeDate, setDischargeDate] = useState(toInputDateStr());
  const [notes, setNotes] = useState('');
  // G5 (2.1): the discharge response carries the assembled final-bill summary.
  const [summary, setSummary] = useState<DischargeBillingSummary | null>(null);

  useEffect(() => { if (open) setSummary(null); }, [open]);

  // The published discharge summary is the doctor's sign-off for discharge.
  // Fetch its status so we can prompt the user to complete it if it's missing.
  const dsQuery = useQuery({
    queryKey: ['discharge-summary', 'by-admission', admission.id],
    queryFn: async () => {
      try {
        return (await apiGet<{ status: 'draft' | 'finalized' | 'published' }>(
          `/mrd/discharge-summary/by-admission/${admission.id}`,
        )).data;
      } catch {
        return null; // 404 = no summary yet
      }
    },
    enabled: open,
    retry: false,
  });
  const dsStatus = dsQuery.data?.status;
  const published = dsStatus === 'published';

  const dischargeMutation = useMutation({
    mutationFn: async (opts?: { force?: boolean }) =>
      (await apiPatch<{ dischargeBilling?: DischargeBillingSummary | null }>(
        `/clinical/admissions/${admission.id}/discharge`,
        { dischargeDate, notes: notes || undefined, force: opts?.force || undefined },
      )).data?.dischargeBilling ?? null,
    onSuccess: (billing) => {
      toast.success('Patient discharged successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['beds-available'] });
      // Keep the dialog open to show the final-bill summary; close if none.
      if (billing) setSummary(billing); else onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Discharge failed');
    },
  });
  const money = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

  const openDischargeSummary = () => {
    onOpenChange(false);
    router.push(`/doctor/discharge-summary?admissionId=${admission.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{summary ? 'Discharged — Final Bill' : 'Discharge Patient'}</DialogTitle>
          <DialogDescription>
            {summary ? (
              <>Final bill assembled for <strong>{admission.patient?.firstName} {admission.patient?.lastName}</strong>.</>
            ) : (
              <>Discharge <strong>{admission.patient?.firstName} {admission.patient?.lastName}</strong>?</>
            )}
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="grid gap-2 py-2">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Total billed</span><span className="font-medium">{money(summary.totalBilled)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{money(summary.totalPaid)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance due</span><span className="font-medium">{money(summary.totalBalanceDue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span>{money(summary.depositAmount)}</span></div>
              {summary.advanceApplied > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Advance applied</span><span>{money(summary.advanceApplied)}</span></div>
              )}
              <div className="my-1 border-t" />
              {summary.refundDue > 0 ? (
                <div className="flex justify-between text-emerald-700"><span className="font-semibold">Refund due to patient</span><span className="font-semibold">{money(summary.refundDue)}</span></div>
              ) : (
                <div className="flex justify-between text-foreground"><span className="font-semibold">Net payable (after deposit)</span><span className="font-semibold">{money(summary.netAfterDeposit)}</span></div>
              )}
            </div>
            {summary.bills.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {summary.bills.length} bill(s): {summary.bills.map((b) => `${b.billNumber} (${b.status})`).join(', ')}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Collect the net payable / issue the refund at the billing counter.</p>
          </div>
        )}

        {!summary && (
          dsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking discharge summary…
            </div>
          ) : !published ? (
            // Discharge summary not published yet — the doctor must complete it first.
            <div className="grid gap-3 py-2">
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
                <div className="flex items-start gap-2">
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Discharge summary required</p>
                    <p className="mt-0.5 text-[13px] text-amber-700">
                      The doctor must complete and <strong>publish</strong> the discharge summary before this patient can be discharged. Publishing the summary discharges the patient automatically.
                    </p>
                    <p className="mt-1.5 text-[11px] text-amber-700">
                      Current status:{' '}
                      <strong className="capitalize">{dsStatus ?? 'not started'}</strong>
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Ward:</span> {admission.ward?.name ?? '-'}</p>
                <p><span className="text-muted-foreground">Bed:</span> {admission.bed?.bedNumber ?? '-'}</p>
                <p><span className="text-muted-foreground">Admitted:</span> {admission.admissionDate ? formatDate(admission.admissionDate) : '-'}</p>
              </div>
            </div>
          ) : (
            // Published summary → normal discharge confirmation.
            <div className="grid gap-4 py-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Ward:</span> {admission.ward?.name ?? '-'}</p>
                <p><span className="text-muted-foreground">Bed:</span> {admission.bed?.bedNumber ?? '-'}</p>
                <p><span className="text-muted-foreground">Admitted:</span> {admission.admissionDate ? formatDate(admission.admissionDate) : '-'}</p>
              </div>

              <div className="grid gap-1.5">
                <Label>Discharge Date *</Label>
                <Input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Discharge notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )
        )}

        <DialogFooter>
          {summary ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : dsQuery.isLoading ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          ) : !published ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="gap-1.5" onClick={openDischargeSummary}>
                <FileText className="h-4 w-4" /> Open discharge summary
              </Button>
              {canForce && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => dischargeMutation.mutate({ force: true })}
                  disabled={dischargeMutation.isPending}
                >
                  {dischargeMutation.isPending ? 'Discharging…' : 'Discharge without summary'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => dischargeMutation.mutate({})}
                disabled={dischargeMutation.isPending}
              >
                {dischargeMutation.isPending ? 'Discharging...' : 'Confirm Discharge'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ViewAdmissionDialog — read-only summary + slip / checklist tabs
// ---------------------------------------------------------------------------
function ViewAdmissionDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: Admission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [slipOpen, setSlipOpen] = useState(false);

  if (!admission) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {admission.patient?.firstName} {admission.patient?.lastName}
              <span
                className={cn(
                  'ml-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                  admission.status === 'admitted' && 'bg-blue-100 text-blue-700',
                  admission.status === 'discharged' && 'bg-green-100 text-green-700',
                  admission.status === 'transferred' && 'bg-cyan-100 text-cyan-700',
                  admission.status === 'absconded' && 'bg-red-100 text-red-700',
                )}
              >
                {admission.status}
              </span>
            </DialogTitle>
            <DialogDescription>
              MRN: {admission.patient?.mrn} · IP No: {admission.id?.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Consultant"
                  value={`Dr. ${admission.doctor?.user?.firstName ?? ''} ${admission.doctor?.user?.lastName ?? ''}`} />
                <DetailRow label="Ward" value={admission.ward?.name ?? '-'} />
                <DetailRow label="Bed" value={admission.bed?.bedNumber ?? '-'} />
                <DetailRow label="Admitted" value={formatDate(admission.admissionDate)} />
                <DetailRow
                  label="Expected Discharge"
                  value={
                    admission.expectedDischargeDate
                      ? formatDate(admission.expectedDischargeDate)
                      : '-'
                  }
                />
                <DetailRow
                  label="Deposit"
                  value={`₹${Number(admission.depositAmount ?? 0).toLocaleString('en-IN')}`}
                />
                <div className="col-span-2">
                  <DetailRow
                    label="Diagnosis / Reason"
                    value={admission.admissionReason ?? '-'}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="pt-4">
              <ul className="space-y-2">
                {ADMISSION_CHECKLIST.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>
                      {item.label}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Print the admission slip for the patient&apos;s record.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => setSlipOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Admission Slip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdmissionSlipDialog
        admission={admission}
        open={slipOpen}
        onOpenChange={setSlipOpen}
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowActionsMenu
// ---------------------------------------------------------------------------
function RowActionsMenu({
  admission,
  onView,
}: {
  admission: Admission;
  onView: (adm: Admission) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [registerTempOpen, setRegisterTempOpen] = useState(false);
  const [connectTempOpen, setConnectTempOpen] = useState(false);

  const canBill = useCanBillToHospital();
  const isActive = admission.status === 'admitted';
  // Provisional (TEMP-) patient → offer Register / Connect right here.
  const isTemp = isTemporaryPatient(admission.patient);
  const tempPatient = admission.patient
    ? ({ ...admission.patient, id: admission.patient.id ?? admission.patientId } as Patient)
    : null;

  // Patient payload shared by the billing dialogs.
  const billingPatient = {
    id: admission.patient?.id ?? admission.patientId,
    firstName: admission.patient?.firstName ?? '',
    lastName: admission.patient?.lastName ?? '',
    mrn: admission.patient?.mrn ?? null,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/hospital/ip/${admission.id}`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open IP Workspace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onView(admission)}>
            <Eye className="mr-2 h-4 w-4" />
            Quick View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSlipOpen(true)}>
            <Printer className="mr-2 h-4 w-4" />
            Print Admission Slip
          </DropdownMenuItem>
          {isTemp && tempPatient && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRegisterTempOpen(true)}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Register Patient
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConnectTempOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Connect to Existing
              </DropdownMenuItem>
            </>
          )}
          {canBill && (
            <>
              <DropdownMenuSeparator />
              {isActive && (
                <DropdownMenuItem onClick={() => setAdvanceOpen(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Collect Advance
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setBillOpen(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                Generate Final Bill
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSummaryOpen(true)}>
                <PieChart className="mr-2 h-4 w-4" />
                Billing Summary (TPA split)
              </DropdownMenuItem>
            </>
          )}
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDischargeOpen(true)}>
                <LogOut className="mr-2 h-4 w-4" />
                Discharge
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BillingSummaryDialog
        patientId={billingPatient.id}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />

      <AssignBedDialog
        admissionId={admission.id}
        currentBedId={admission.bedId ?? null}
        currentWardName={admission.ward?.name ?? null}
        currentBedNumber={admission.bed?.bedNumber ?? null}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
          queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
        }}
      />
      <DischargeDialog
        admission={admission}
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
      />
      <AdmissionSlipDialog
        admission={admission}
        open={slipOpen}
        onOpenChange={setSlipOpen}
      />

      {/* Temporary-patient resolution — reachable from the row's 3-dots menu. */}
      <RegisterInPlaceDialog
        patient={registerTempOpen ? tempPatient : null}
        onClose={() => setRegisterTempOpen(false)}
      />
      <MergeDialog
        patient={connectTempOpen ? tempPatient : null}
        onClose={() => setConnectTempOpen(false)}
      />

      {canBill && (
        <>
          {/* Final settlement bill — auto-pulls room + all clinical charges. */}
          <BillGeneratorDialog
            open={billOpen}
            onOpenChange={setBillOpen}
            initialPatient={billingPatient}
          />
          {/* Advance / deposit collection against the admitted patient. */}
          <AdvancePaymentDialog
            open={advanceOpen}
            onOpenChange={setAdvanceOpen}
            patient={billingPatient}
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// useAdmissionStats — fetch counts per status (limit=1 + meta.total)
// ---------------------------------------------------------------------------
function useAdmissionStats() {
  return useQuery({
    queryKey: ['hospital', 'admission-stats'],
    queryFn: async () => {
      const fetchCount = async (status?: string) => {
        const params: Record<string, unknown> = { limit: 1, page: 1 };
        if (status) params.status = status;
        const res = await apiGet<unknown[]>('/clinical/admissions', { params });
        return res.meta?.total ?? 0;
      };
      const [all, admitted, discharged, absconded] = await Promise.all([
        fetchCount(),
        fetchCount('admitted'),
        fetchCount('discharged'),
        fetchCount('absconded'),
      ]);
      return { all, admitted, discharged, absconded } as Record<string, number>;
    },
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// InPatientList — Main component
// ---------------------------------------------------------------------------
export function InPatientList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AdmissionType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [registerNewOpen, setRegisterNewOpen] = useState(false);
  const [viewAdmission, setViewAdmission] = useState<Admission | null>(null);
  const [postAdmitSlip, setPostAdmitSlip] = useState<Admission | null>(null);

  const { data: stats } = useAdmissionStats();

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'admissions', { status: statusFilter, type: typeFilter, search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.admissionType = typeFilter;
      if (search) params.search = search;
      const response = await apiGet<Admission[]>('/clinical/admissions', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const admissions = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto">
        {statItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setStatusFilter(item.key);
              setPage(1);
            }}
            className={cn(
              'flex flex-col items-center rounded-xl border-2 px-4 py-3 min-w-[100px] transition-all',
              statusFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-surface-container-lowest hover:border-surface-container',
            )}
          >
            <span className={cn('text-xl font-bold', item.color)}>
              {stats ? stats[item.key] ?? 0 : '–'}
            </span>
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Admit button */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient, IP number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button
          variant="outline"
          className="rounded-xl gap-1.5"
          onClick={() => setRegisterNewOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Register New Patient
        </Button>
        <Button className="rounded-xl gap-1.5" onClick={() => setAdmitOpen(true)}>
          <Plus className="h-4 w-4" />
          Admit Patient
        </Button>
      </div>

      {/* Care-type filter — All / IP / Emergency / Day Care */}
      <div className="flex items-center gap-1.5">
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mr-1">
          Type
        </span>
        {[{ value: 'all', label: 'All' }, ...ADMISSION_TYPE_OPTIONS].map((o) => (
          <button
            key={o.value}
            onClick={() => {
              setTypeFilter(o.value as 'all' | AdmissionType);
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3 py-1 font-label text-xs font-semibold transition-all',
              typeFilter === o.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">IP Number</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Bed</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Advance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-label text-on-surface-variant"
                  >
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-label text-on-surface-variant"
                  >
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => {
                  const initials = `${adm.patient?.firstName?.[0] || ''}${
                    adm.patient?.lastName?.[0] || ''
                  }`.toUpperCase();
                  return (
                    <tr
                      key={adm.id}
                      className="group hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="flex items-center gap-1.5">
                              <Link
                                href={`/hospital/ip/${adm.id}`}
                                className="font-label text-sm font-bold hover:text-primary"
                              >
                                {adm.patient?.firstName} {adm.patient?.lastName}
                              </Link>
                              <AdmissionTypeBadge type={(adm as { admissionType?: string }).admissionType} />
                              {isTemporaryPatient(adm.patient) && (
                                <Badge variant="secondary" className="uppercase">Temp</Badge>
                              )}
                            </span>
                            <p className="font-label text-[10px] text-on-surface-variant">
                              {adm.patient?.mrn} | {adm.patient?.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {adm.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-xs text-on-surface-variant truncate max-w-[180px]">
                          {adm.admissionReason || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.doctor
                            ? `Dr. ${adm.doctor.user?.firstName || ''} ${
                                adm.doctor.user?.lastName || ''
                              }`
                            : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">
                          {adm.ward?.name || '-'} / {adm.bed?.bedNumber || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">
                        ₹{Number(adm.depositAmount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                            adm.status === 'admitted' && 'bg-blue-100 text-blue-700',
                            adm.status === 'discharged' && 'bg-green-100 text-green-700',
                            adm.status === 'transferred' && 'bg-cyan-100 text-cyan-700',
                            adm.status === 'absconded' && 'bg-red-100 text-red-700',
                          )}
                        >
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu
                          admission={adm}
                          onView={setViewAdmission}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-sm text-on-surface-variant">
              Page {page} of {data?.meta?.totalPages} ({data?.meta?.total} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.meta?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Admission dialog (existing patient) */}
      <AdmissionDialog
        open={admitOpen}
        onOpenChange={setAdmitOpen}
        onAdmitted={(adm) => setPostAdmitSlip(adm)}
      />

      {/* Register a new patient — the shared register box (same everywhere).
          Admitting is a separate action (open Admit, search the patient). */}
      <FrontDeskRegisterDialog
        open={registerNewOpen}
        onOpenChange={setRegisterNewOpen}
        initialMode="new"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patients'] });
          queryClient.invalidateQueries({ queryKey: ['hospital'] });
        }}
      />

      {/* Auto-open admission slip after admit */}
      <AdmissionSlipDialog
        admission={postAdmitSlip}
        open={!!postAdmitSlip}
        onOpenChange={(o) => !o && setPostAdmitSlip(null)}
      />

      {/* View details dialog */}
      <ViewAdmissionDialog
        admission={viewAdmission}
        open={!!viewAdmission}
        onOpenChange={(o) => !o && setViewAdmission(null)}
      />

    </div>
  );
}
