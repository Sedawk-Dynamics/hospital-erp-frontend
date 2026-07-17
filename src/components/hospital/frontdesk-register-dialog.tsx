'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toInputDateStr, formatDate, getCurrentISTTime, isToday } from '@/lib/date-utils';
import {
  UserPlus, Search, Loader2, UserRound, Clock, CalendarCheck,
  CreditCard, Banknote, Smartphone, Building2, ChevronRight,
  ChevronLeft, CheckCircle2, ArrowRight, Siren, Info,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  usePatientSearch,
  useDoctorsList,
  useAvailableSlots,
} from '@/hooks/use-hospital';
import { useCreateEmergencyPatient } from '@/hooks/use-emergency';
import { cn } from '@/lib/utils';
import { apiPost, apiPatch, apiGet } from '@/lib/api';
import type { Patient, Appointment, DoctorProfile } from '@/types';

// ============================================================
// Schemas
// ============================================================

const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(['male', 'female', 'other'], { error: 'Gender is required' }),
  dateOfBirth: z.string().optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[+]?[\d\s()-]{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  relationship: z
    .enum(['self', 'spouse', 'child', 'parent', 'sibling', 'guardian', 'other'])
    .optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

const RELATIONSHIPS = [
  { value: 'self', label: 'Self (Account Holder)' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'guardian', label: 'Guardian / Ward' },
  { value: 'other', label: 'Other' },
] as const;

type AccountHolder = {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  tenantId: string;
  tenant?: { id: string; name: string; slug: string } | null;
  _count?: { patients: number };
};

type ExistingProfile = {
  id: string;
  mrn: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  gender?: string | null;
  relationship?: string | null;
  isSelf?: boolean;
  tenant?: { id: string; name: string } | null;
};

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  { value: 'upi', label: 'UPI', icon: Smartphone, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30' },
  { value: 'insurance', label: 'Insurance', icon: CheckCircle2, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30' },
] as const;

const QUICK_DATES = [
  { label: 'Today', getValue: () => toInputDateStr() },
  { label: 'Tomorrow', getValue: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toInputDateStr(d);
  }},
  { label: 'Day After', getValue: () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toInputDateStr(d);
  }},
];

// ============================================================
// Step indicator
// ============================================================

const STEPS = [
  { label: 'Patient', icon: UserPlus },
  { label: 'Appointment', icon: CalendarCheck },
  { label: 'Payment', icon: CreditCard },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      {STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <div key={step.label} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : isCompleted
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <step.icon className="h-3.5 w-3.5" />
              {step.label}
            </div>
            {index < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Props
// ============================================================

interface FrontDeskRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Pre-select patient mode: 'new' for registration, 'existing' for walk-in search */
  initialMode?: 'new' | 'existing';
}

// ============================================================
// Component
// ============================================================

export function FrontDeskRegisterDialog({
  open,
  onOpenChange,
  onSuccess,
  initialMode = 'new',
}: FrontDeskRegisterDialogProps) {
  const queryClient = useQueryClient();

  // Steps: 0 = Patient, 1 = Appointment, 2 = Payment
  const [step, setStep] = useState(0);

  // Patient state
  const [mode, setMode] = useState<'new' | 'existing'>(initialMode);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Tick "emergency" on the registration form and the casualty goes straight
  // into the OP queue on a temporary MRN: nothing is required, no slot is
  // picked, no payment is taken. Whatever the front desk already typed above is
  // still kept. It's registered (or connected to an existing patient) later.
  const [emergency, setEmergency] = useState(false);

  // New-patient sub-mode: register standalone OR attach as family profile to an existing user
  const [newPatientMode, setNewPatientMode] = useState<'standalone' | 'linkUser'>('standalone');
  const [userSearchValue, setUserSearchValue] = useState('');
  const [userSearchType, setUserSearchType] = useState<'phone' | 'email'>('phone');
  const [userResults, setUserResults] = useState<AccountHolder[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AccountHolder | null>(null);
  const [existingProfiles, setExistingProfiles] = useState<ExistingProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  // Appointment state
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(toInputDateStr());
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [appointmentType, setAppointmentType] = useState<'consultation' | 'follow_up' | 'procedure'>('consultation');
  const [reason, setReason] = useState('');

  // Payment state
  const [paymentMode, setPaymentMode] = useState('cash');

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Emergency only applies to a new patient — an existing one is already registered.
  const isEmergency = mode === 'new' && emergency;
  const createEmergency = useCreateEmergencyPatient();

  // Queries
  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const { data: doctorsRaw, isLoading: doctorsLoading } = useDoctorsList();
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(selectedDoctorId, appointmentDate);

  const doctors = useMemo(
    () =>
      (doctorsRaw || []).map((d: DoctorProfile) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
        specialization: d.specialization,
        consultationFee: d.consultationFee,
        department: d.department?.name,
      })),
    [doctorsRaw]
  );

  // Show all slots but mark past/booked status
  const allSlots = slotsData?.slots ?? [];
  const currentTime = getCurrentISTTime();
  const isTodaySelected = isToday(appointmentDate);
  const slots = allSlots.map((slot) => ({
    ...slot,
    isPast: isTodaySelected && slot.startTime < currentTime,
  }));
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  // Patient form
  const {
    register,
    handleSubmit: handlePatientSubmit,
    setValue: setPatientValue,
    watch: watchPatient,
    reset: resetPatientForm,
    formState: { errors: patientErrors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
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
      relationship: 'self',
    },
  });

  const genderValue = watchPatient('gender');
  const relationshipValue = watchPatient('relationship') ?? 'self';

  // Reset everything on close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setMode(initialMode);
      setPatientQuery('');
      setSelectedPatient(null);
      setShowPatientDropdown(false);
      setSelectedDoctorId('');
      setAppointmentDate(toInputDateStr());
      setSelectedSlot(null);
      setAppointmentType('consultation');
      setReason('');
      setPaymentMode('cash');
      setIsSubmitting(false);
      setNewPatientMode('standalone');
      setUserSearchValue('');
      setUserSearchType('phone');
      setUserResults([]);
      setSelectedUser(null);
      setExistingProfiles([]);
      setEmergency(false);
      resetPatientForm();
    }
  }, [open, resetPatientForm, initialMode]);

  // Account-holder search (phone or email)
  const runUserSearch = useCallback(async () => {
    const val = userSearchValue.trim();
    if (!val) {
      setUserResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const resp = await apiGet<AccountHolder[]>('/users/by-contact', {
        params: userSearchType === 'phone' ? { phone: val } : { email: val },
      });
      setUserResults(resp.data ?? []);
    } catch {
      setUserResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [userSearchValue, userSearchType]);

  // Load existing profiles under the selected user (in this tenant only)
  useEffect(() => {
    if (!selectedUser) {
      setExistingProfiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      try {
        const resp = await apiGet<ExistingProfile[]>(`/patients/by-user/${selectedUser.id}`);
        if (!cancelled) setExistingProfiles(resp.data ?? []);
      } catch {
        if (!cancelled) setExistingProfiles([]);
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUser]);

  // Clear slot when doctor or date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDoctorId, appointmentDate]);

  // ── Patient handlers ──

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setPatientQuery(`${patient.firstName} ${patient.lastName} (${patient.mrn})`);
    setShowPatientDropdown(false);
  }, []);

  const handlePatientInputChange = useCallback((value: string) => {
    setPatientQuery(value);
    setShowPatientDropdown(value.length >= 2);
    if (selectedPatient) setSelectedPatient(null);
  }, [selectedPatient]);

  // ── Step navigation ──

  const goToStep1Existing = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    setStep(1);
  };

  const handlePatientFormNext = (_data: PatientFormData) => {
    if (newPatientMode === 'linkUser' && !selectedUser) {
      toast.error('Please search and select an account holder');
      return;
    }
    // Store form data — we'll create patient on final submit
    setStep(1);
  };

  const goToStep2 = () => {
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }
    setStep(2);
  };

  // ── Final submit ──

  // Emergency intake — reads whatever the registration form already holds (all
  // of it optional) and posts to the dedicated endpoint, which mints the TEMP-ER
  // patient, the checked-in emergency appointment and its queue token in one
  // server-side call. It deliberately does NOT reuse the patient→appointment
  // chain below: that would lose the temporary MRN and the credit-gate bypass.
  // Bypasses the form's zod gate entirely — a casualty may be unidentified.
  const handleEmergencySubmit = async () => {
    setIsSubmitting(true);
    try {
      const p = watchPatient();
      const result = await createEmergency.mutateAsync({
        type: 'op',
        firstName: p.firstName?.trim() || undefined,
        lastName: p.lastName?.trim() || undefined,
        gender: p.gender || undefined,
        dateOfBirth: p.dateOfBirth || undefined,
        phone: p.phone?.trim() || undefined,
        email: p.email?.trim() || undefined,
        address: p.address?.trim() || undefined,
        chiefComplaint: reason.trim() || undefined,
      });
      toast.success(
        `Emergency OP patient created — ${result.mrn}` +
          (result.tokenNumber ? ` · Token #${result.tokenNumber}` : ''),
      );
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['front-desk'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to create emergency patient',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);

    try {
      let patientId = selectedPatient?.id;

      // Step 1: Create patient if new
      if (mode === 'new' && !patientId) {
        const patientData = watchPatient();
        const payload: Record<string, unknown> = {
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          gender: patientData.gender,
          phone: patientData.phone,
        };
        if (patientData.dateOfBirth) payload.dateOfBirth = patientData.dateOfBirth;
        if (patientData.email) payload.email = patientData.email;
        if (patientData.address) payload.address = patientData.address;
        if (patientData.city) payload.city = patientData.city;
        if (patientData.state) payload.state = patientData.state;
        if (patientData.zipCode) payload.zipCode = patientData.zipCode;

        // Linking as family member under an existing user account
        if (newPatientMode === 'linkUser' && selectedUser) {
          payload.userId = selectedUser.id;
          payload.relationship = patientData.relationship ?? 'other';
        }

        const patientResp = await apiPost<Patient>('/patients', payload);
        patientId = patientResp.data?.id;
        if (!patientId) throw new Error('Failed to create patient');
      }

      // Step 2: Create appointment
      const aptResp = await apiPost<Appointment>('/appointments', {
        patientId,
        doctorId: selectedDoctorId,
        appointmentDate,
        startTime: selectedSlot!.start,
        endTime: selectedSlot!.end,
        type: appointmentType,
        priority: 'normal',
        reason: reason || undefined,
        paymentMode,
      });

      const appointment = aptResp.data;
      if (!appointment?.id) throw new Error('Failed to create appointment');

      // Step 3: Generate queue token
      let tokenNumber: string | number = '';
      try {
        const queueResp = await apiPost<{ tokenNumber: string | number }>(
          `/appointments/${appointment.id}/queue`
        );
        tokenNumber = queueResp.data?.tokenNumber ?? '';
      } catch {
        // Queue token is optional
      }

      // Step 4: If today's date, auto check-in
      if (appointmentDate === toInputDateStr()) {
        try {
          await apiPatch(`/appointments/${appointment.id}/status`, { status: 'checked_in' });
        } catch {
          // Non-critical
        }
      }

      // Step 5: Create bill with consultation fee if available
      if (selectedDoctor?.consultationFee && selectedDoctor.consultationFee > 0) {
        try {
          await apiPost('/billing', {
            patientId,
            appointmentId: appointment.id,
            items: [{
              description: `Consultation Fee - ${selectedDoctor.name}`,
              category: 'consultation',
              quantity: 1,
              unitPrice: selectedDoctor.consultationFee,
            }],
            paymentMode,
          });
        } catch {
          // Bill creation is non-critical for the flow
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['front-desk'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });

      toast.success(
        tokenNumber
          ? `Appointment booked — Token #${tokenNumber}`
          : 'Appointment booked successfully'
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to complete registration'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDoctorAndDate = !!selectedDoctorId && !!appointmentDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEmergency ? (
              <Siren className="h-5 w-5 text-red-600" />
            ) : (
              <UserPlus className="h-5 w-5 text-primary" />
            )}
            {isEmergency
              ? 'Emergency / Casualty Patient'
              : step === 0
                ? 'Patient Details'
                : step === 1
                  ? 'Book Appointment'
                  : 'Payment'}
          </DialogTitle>
          <DialogDescription>
            {isEmergency
              ? 'A temporary casualty patient — no registration needed. Goes straight into the OP queue, highlighted as EMERGENCY, until you register or connect it.'
              : step === 0
                ? initialMode === 'new'
                  ? 'Fill in the new patient details below'
                  : 'Register a new patient or select an existing one'
                : step === 1
                  ? 'Choose doctor, date, and time for the appointment'
                  : 'Select payment mode for the consultation'}
          </DialogDescription>
        </DialogHeader>

        {/* Emergency intake is a single step — no slot to pick, no payment gate. */}
        {!isEmergency && <StepIndicator currentStep={step} />}

        {/* ════════════════════════════════════════════════ */}
        {/* STEP 0: Patient */}
        {/* ════════════════════════════════════════════════ */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Toggle: New / Existing — only shown for walk-in mode */}
            {initialMode === 'existing' && (
              <div className="flex gap-2 p-1 rounded-xl bg-surface-container">
                <button
                  type="button"
                  onClick={() => { setMode('new'); setSelectedPatient(null); setPatientQuery(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'new'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  New Patient
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('existing'); setEmergency(false); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'existing'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Existing Patient
                </button>
              </div>
            )}

            {mode === 'existing' ? (
              <div className="space-y-3">
                {/* Patient Search */}
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">
                    Search Patient
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
                    <Input
                      placeholder="Search by name, MRN, or phone..."
                      value={patientQuery}
                      onChange={(e) => handlePatientInputChange(e.target.value)}
                      onFocus={() => {
                        if (patientQuery.length >= 2 && !selectedPatient) {
                          setShowPatientDropdown(true);
                        }
                      }}
                      className="pl-9"
                      autoComplete="off"
                    />
                    {patientsLoading && patientQuery.length >= 2 && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}

                    {showPatientDropdown && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-surface-container bg-surface-container-lowest shadow-lg max-h-48 overflow-y-auto">
                        {patientsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : !patients || patients.length === 0 ? (
                          <p className="px-4 py-3 font-label text-sm text-on-surface-variant">
                            No patients found
                          </p>
                        ) : (
                          patients.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onClick={() => handleSelectPatient(patient)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-label text-xs font-bold">
                                {patient.firstName?.[0]}{patient.lastName?.[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-label text-sm font-semibold truncate">
                                  {patient.firstName} {patient.lastName}
                                </p>
                                <p className="font-label text-[10px] text-on-surface-variant">
                                  {patient.mrn} &middot; {patient.phone}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected patient chip */}
                {selectedPatient && (
                  <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                    <UserRound className="h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-label text-sm font-bold flex items-center gap-2">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                        <PatientTypeBadgeInline patientId={selectedPatient.id} />
                      </p>
                      <p className="font-label text-[10px] text-on-surface-variant">
                        MRN: {selectedPatient.mrn} &middot; {selectedPatient.phone}
                        {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedPatient(null); setPatientQuery(''); }}
                      className="text-on-surface-variant/60 hover:text-on-surface-variant text-lg"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={goToStep1Existing} disabled={!selectedPatient} className="gap-2">
                    Next: Book Appointment
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePatientSubmit(handlePatientFormNext)} className="space-y-4">
                {/* Emergency / casualty — one tick bypasses everything below */}
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 transition-colors',
                    emergency
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                      : 'border-border hover:border-red-300',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={emergency}
                    onChange={(e) => setEmergency(e.target.checked)}
                    className="h-4 w-4 accent-red-600"
                  />
                  <Siren className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Emergency / casualty patient
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    — treat now, register later. Nothing below is required.
                  </span>
                </label>

                {/* Account-holder linkage toggle */}
                <div className="flex gap-2 p-1 rounded-xl bg-surface-container">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPatientMode('standalone');
                      setSelectedUser(null);
                      setExistingProfiles([]);
                      setPatientValue('relationship', 'self');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                      newPatientMode === 'standalone'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Standalone Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPatientMode('linkUser');
                      setPatientValue('relationship', 'other');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                      newPatientMode === 'linkUser'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Add Under Existing User
                  </button>
                </div>

                {/* Account-holder search panel (only in linkUser mode) */}
                {newPatientMode === 'linkUser' && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">
                      Find Account Holder
                    </p>
                    <div className="flex gap-2">
                      <Select
                        value={userSearchType}
                        onValueChange={(v: string | null) => setUserSearchType((v ?? 'phone') as 'phone' | 'email')}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={userSearchType === 'phone' ? '+91XXXXXXXXXX' : 'user@example.com'}
                        value={userSearchValue}
                        onChange={(e) => setUserSearchValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            runUserSearch();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={runUserSearch}
                        disabled={userSearchLoading || !userSearchValue.trim()}
                        className="gap-1.5"
                      >
                        {userSearchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Search
                      </Button>
                    </div>

                    {/* Search results */}
                    {userResults.length > 0 && !selectedUser && (
                      <div className="rounded-lg border bg-card divide-y">
                        {userResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {u.firstName?.[0]}{u.lastName?.[0] ?? ''}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.email} · {u.phone || 'No phone'} ·{' '}
                                {u._count?.patients ?? 0} profile{(u._count?.patients ?? 0) === 1 ? '' : 's'}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    {userSearchValue && !userSearchLoading && userResults.length === 0 && !selectedUser && (
                      <p className="text-xs text-muted-foreground italic">
                        No user found with that {userSearchType}.
                      </p>
                    )}

                    {/* Selected user card */}
                    {selectedUser && (
                      <div className="rounded-lg bg-card border border-primary/30 p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">
                            {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0] ?? ''}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">
                              {selectedUser.firstName} {selectedUser.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {selectedUser.email} · {selectedUser.phone || '—'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSelectedUser(null); setUserResults([]); setUserSearchValue(''); }}
                            className="text-muted-foreground hover:text-foreground text-sm"
                          >
                            Change
                          </button>
                        </div>

                        {/* Existing profiles under this user */}
                        {profilesLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading profiles...
                          </div>
                        ) : existingProfiles.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Existing profiles ({existingProfiles.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {existingProfiles.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                                >
                                  {p.firstName} {p.lastName ?? ''}
                                  <span className="text-muted-foreground">· {p.relationship ?? 'self'}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">
                            No profiles yet — this will be their first.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Relationship selector — only meaningful in linkUser mode */}
                {newPatientMode === 'linkUser' && selectedUser && (
                  <div className="space-y-1.5">
                    <Label>Relationship to Account Holder *</Label>
                    <Select
                      value={relationshipValue}
                      onValueChange={(v: string | null) => {
                        if (v) setPatientValue('relationship', v as PatientFormData['relationship']);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Basic Info */}
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {newPatientMode === 'linkUser' ? 'Patient Profile Info' : 'Basic Info'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fd-firstName">First Name *</Label>
                      <Input id="fd-firstName" placeholder="Enter first name" {...register('firstName')} />
                      {patientErrors.firstName && (
                        <p className="text-xs text-destructive">{patientErrors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fd-lastName">Last Name *</Label>
                      <Input id="fd-lastName" placeholder="Enter last name" {...register('lastName')} />
                      {patientErrors.lastName && (
                        <p className="text-xs text-destructive">{patientErrors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Gender *</Label>
                      <Select
                        value={genderValue}
                        onValueChange={(value: string | null) => {
                          if (value) setPatientValue('gender', value as 'male' | 'female' | 'other');
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {patientErrors.gender && (
                        <p className="text-xs text-destructive">{patientErrors.gender.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fd-dob">Date of Birth</Label>
                      <Input id="fd-dob" type="date" {...register('dateOfBirth')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fd-phone">Phone *</Label>
                      <Input id="fd-phone" placeholder="Enter phone number" {...register('phone')} />
                      {patientErrors.phone && (
                        <p className="text-xs text-destructive">{patientErrors.phone.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fd-email">Email</Label>
                      <Input id="fd-email" type="email" placeholder="Optional" {...register('email')} />
                    </div>
                  </div>
                </div>

                {/* Address (collapsed) */}
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Address (Optional)
                  </p>
                  <div className="space-y-1.5">
                    <Input placeholder="Address" {...register('address')} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input placeholder="City" {...register('city')} />
                    <Input placeholder="State" {...register('state')} />
                    <Input placeholder="Zip Code" {...register('zipCode')} />
                  </div>
                </div>

                <div className="flex justify-end">
                  {emergency ? (
                    // type="button" — deliberately skips the form's zod gate.
                    <Button
                      type="button"
                      onClick={handleEmergencySubmit}
                      disabled={isSubmitting}
                      className="gap-2 bg-red-600 text-white hover:bg-red-700"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                      ) : (
                        <><Siren className="h-4 w-4" /> Create Emergency Patient</>
                      )}
                    </Button>
                  ) : (
                    <Button type="submit" className="gap-2">
                      Next: Book Appointment
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* STEP 1: Appointment (Doctor + Date + Slot) */}
        {/* ════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Doctor Selection */}
            <div className="space-y-1.5">
              <Label className="font-label text-xs font-semibold text-on-surface-variant">
                Select Doctor *
              </Label>
              <Select
                value={selectedDoctorId}
                onValueChange={(value: string | null) => setSelectedDoctorId(value ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={doctorsLoading ? 'Loading doctors...' : 'Choose a doctor'} />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <span className="font-label text-sm">
                        {doc.name}
                        {doc.specialization && (
                          <span className="text-on-surface-variant ml-1">({doc.specialization})</span>
                        )}
                        {doc.consultationFee != null && doc.consultationFee > 0 && (
                          <span className="text-primary ml-1 font-bold">
                            — Rs.{doc.consultationFee}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Doctor Info Card */}
            {selectedDoctor && (
              <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-label text-sm font-bold">{selectedDoctor.name}</p>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    {selectedDoctor.specialization || 'General'}
                    {selectedDoctor.department ? ` · ${selectedDoctor.department}` : ''}
                  </p>
                </div>
                {selectedDoctor.consultationFee != null && selectedDoctor.consultationFee > 0 && (
                  <div className="text-right">
                    <p className="font-label text-lg font-bold text-primary">
                      Rs.{selectedDoctor.consultationFee}
                    </p>
                    <p className="font-label text-[10px] text-on-surface-variant">Consultation Fee</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Date Buttons + Custom Date */}
            <div className="space-y-1.5">
              <Label className="font-label text-xs font-semibold text-on-surface-variant">
                Appointment Date *
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_DATES.map((qd) => {
                  const val = qd.getValue();
                  const isActive = appointmentDate === val;
                  return (
                    <Button
                      key={qd.label}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAppointmentDate(val)}
                      className={isActive ? '' : 'hover:bg-primary/10 hover:text-primary hover:border-primary'}
                    >
                      {qd.label}
                    </Button>
                  );
                })}
                <Input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-[160px]"
                  min={toInputDateStr()}
                />
              </div>
            </div>

            {/* Available Slots */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 font-label text-xs font-semibold text-on-surface-variant">
                <Clock className="h-3.5 w-3.5" />
                Time Slot *
              </Label>

              {!hasDoctorAndDate && (
                <p className="text-sm text-muted-foreground">
                  Select a doctor and date to view available slots.
                </p>
              )}

              {hasDoctorAndDate && slotsLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading slots...</span>
                </div>
              )}

              {hasDoctorAndDate && !slotsLoading && slots.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No slots available for the selected doctor on this date.
                  </p>
                </div>
              )}

              {hasDoctorAndDate && !slotsLoading && slots.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.start === slot.startTime;
                      const isDisabled = !slot.available || slot.isPast;
                      return (
                        <Button
                          key={slot.startTime}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          disabled={isDisabled}
                          className={
                            !slot.available
                              ? 'opacity-60 cursor-not-allowed bg-red-50 text-red-400 border-red-200 line-through dark:bg-red-950/20 dark:text-red-400/60 dark:border-red-900/30'
                              : slot.isPast
                                ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                : isSelected
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : 'hover:bg-primary/10 hover:text-primary hover:border-primary'
                          }
                          onClick={() => setSelectedSlot({ start: slot.startTime, end: slot.endTime })}
                        >
                          <span className="flex flex-col items-center leading-tight">
                            <span>{slot.startTime}</span>
                            {!slot.available && (
                              <span className="text-[9px] font-bold">Booked</span>
                            )}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Appointment Type + Reason */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-label text-xs font-semibold text-on-surface-variant">Type</Label>
                <Select
                  value={appointmentType}
                  onValueChange={(v: string | null) => setAppointmentType((v ?? 'consultation') as typeof appointmentType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-label text-xs font-semibold text-on-surface-variant">Reason</Label>
                <Input
                  placeholder="Reason for visit..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={goToStep2} disabled={!selectedDoctorId || !selectedSlot} className="gap-2">
                Next: Payment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* STEP 2: Payment */}
        {/* ════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Summary Card */}
            <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Appointment Summary
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant">Patient</p>
                  <p className="font-semibold">
                    {selectedPatient
                      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                      : `${watchPatient('firstName')} ${watchPatient('lastName')}`}
                  </p>
                </div>
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant">Doctor</p>
                  <p className="font-semibold">{selectedDoctor?.name}</p>
                </div>
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant">Date</p>
                  <p className="font-semibold">
                    {formatDate(new Date(appointmentDate + 'T00:00:00'))}
                  </p>
                </div>
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant">Time</p>
                  <p className="font-semibold">{selectedSlot?.start} - {selectedSlot?.end}</p>
                </div>
              </div>
              {selectedDoctor?.consultationFee != null && selectedDoctor.consultationFee > 0 && (
                <div className="flex items-center justify-between border-t border-surface-container pt-3">
                  <p className="font-label text-sm text-on-surface-variant">Consultation Fee</p>
                  <p className="font-headline text-xl font-bold text-primary">
                    Rs.{selectedDoctor.consultationFee}
                  </p>
                </div>
              )}
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-2">
              <Label className="font-label text-xs font-semibold text-on-surface-variant">
                Payment Mode
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAYMENT_MODES.map((pm) => {
                  const isActive = paymentMode === pm.value;
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMode(pm.value)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-surface-container hover:border-primary/30 hover:bg-surface-container-low'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${pm.color}`}>
                        <pm.icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className={`font-label text-sm font-bold ${isActive ? 'text-primary' : ''}`}>
                          {pm.label}
                        </p>
                      </div>
                      {isActive && (
                        <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="gap-2 bg-primary text-white font-bold px-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Book
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Patient Type Badge (inline) ────────────────────────────

function PatientTypeBadgeInline({ patientId }: { patientId: string }) {
  const { data } = useQuery({
    queryKey: ['patient-type-check', patientId],
    queryFn: async () => {
      const res = await apiGet<Array<{ appointmentDate: string }>>('/appointments', {
        params: { patientId, status: 'completed', limit: 1 },
      });
      const appointments = res.data ?? [];
      if (appointments.length === 0) return 'new' as const;
      const lastDate = new Date(appointments[0].appointmentDate);
      const days = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30 ? ('review' as const) : ('old' as const);
    },
    enabled: !!patientId,
    staleTime: 60_000,
  });

  if (!data) return null;

  const config = {
    new: { label: 'New', className: 'bg-red-100 text-red-700' },
    review: { label: 'Review', className: 'bg-blue-100 text-blue-700' },
    old: { label: 'Old', className: 'bg-purple-100 text-purple-700' },
  }[data];

  return (
    <span className={`inline-flex rounded-full px-1.5 py-0 text-[9px] font-bold ${config.className}`}>
      {config.label}
    </span>
  );
}
