'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPost } from '@/lib/api';
import type { Patient } from '@/types';

// ============================================================
// Schema
// ============================================================

const createPatientSchema = z.object({
  // Basic Info
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(['male', 'female', 'other'], { error: 'Gender is required' }),
  dateOfBirth: z.string().optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[+]?[\d\s()-]{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),

  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),

  // Additional Info
  bloodGroup: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  religion: z.string().optional(),
  referredBy: z.string().optional(),

  // ABHA Integration
  abhaNumber: z.string().optional(),

  // ID Proof
  nationalId: z.string().optional(),

  // Emergency Contact
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactIsPrimary: z.boolean().optional(),

  // Notes
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

type CreatePatientFormData = z.infer<typeof createPatientSchema>;

// ============================================================
// Constants
// ============================================================

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;
const MARITAL_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
] as const;
const RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'friend', label: 'Friend' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
] as const;

// ============================================================
// Props
// ============================================================

interface CreatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (patient: Patient) => void;
}

// ============================================================
// Component
// ============================================================

export function CreatePatientDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePatientDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePatientFormData>({
    resolver: zodResolver(createPatientSchema),
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
      country: '',
      bloodGroup: '',
      maritalStatus: '',
      nationality: '',
      occupation: '',
      religion: '',
      referredBy: '',
      abhaNumber: '',
      nationalId: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      emergencyContactIsPrimary: true,
      notes: '',
    },
  });

  // Cross-hospital lookup: a patient is one person across the whole ERP. When
  // the desk enters a phone/ABHA that already exists at ANY hospital, we pull
  // their details in and just mint a new MRN here — no re-registration.
  const [globalHit, setGlobalHit] = useState<{ hospitals: { name: string }[]; count: number } | null>(null);
  const checkGlobalPatient = async () => {
    const phone = watch('phone')?.trim();
    const abha = watch('abhaNumber')?.trim();
    if ((!phone || phone.length < 7) && !abha) return;
    try {
      const res = await apiGet<{
        found: boolean;
        patient: Record<string, string | null> | null;
        hospitals: { name: string }[];
        count: number;
      }>('/patients/global-lookup', { params: { phone: phone || undefined, abha: abha || undefined } });
      const d = res.data;
      if (!d?.found || !d.patient) { setGlobalHit(null); return; }
      const p = d.patient;
      setGlobalHit({ hospitals: d.hospitals ?? [], count: d.count ?? 0 });
      // Adopt the person's identity; fill the rest only where the desk left blank.
      const fill = (name: keyof CreatePatientFormData, val?: string | null, force = false) => {
        if (val && (force || !watch(name))) setValue(name, val as never, { shouldValidate: true });
      };
      fill('firstName', p.firstName, true);
      fill('lastName', p.lastName, true);
      const g = (p.gender ?? '').toLowerCase();
      if (g === 'male' || g === 'female' || g === 'other') setValue('gender', g);
      if (p.dateOfBirth) setValue('dateOfBirth', String(p.dateOfBirth).slice(0, 10));
      fill('email', p.email); fill('address', p.address); fill('city', p.city);
      fill('state', p.state); fill('zipCode', p.zipCode); fill('country', p.country);
      fill('bloodGroup', p.bloodGroup); fill('maritalStatus', p.maritalStatus);
      fill('nationality', p.nationality); fill('occupation', p.occupation);
      fill('abhaNumber', p.abhaNumber); fill('nationalId', p.nationalId);
    } catch {
      /* best-effort — leave the form as typed */
    }
  };

  const genderValue = watch('gender');
  const bloodGroupValue = watch('bloodGroup');
  const maritalStatusValue = watch('maritalStatus');
  const emergencyRelationshipValue = watch('emergencyContactRelationship');
  const emergencyIsPrimaryValue = watch('emergencyContactIsPrimary');

  // When ticked, the patient is saved as a provisional (TEMP-) record — every
  // field is optional and the record can be registered or connected later.
  const [isTemporary, setIsTemporary] = useState(false);
  const [savingTemp, setSavingTemp] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset();
      setIsTemporary(false);
    }
  }, [open, reset]);

  const handleSaveAsTemporary = async () => {
    const v = watch();
    try {
      setSavingTemp(true);
      const resp = await apiPost<Patient>('/patients/temporary', {
        firstName: v.firstName?.trim() || undefined,
        lastName: v.lastName?.trim() || undefined,
        gender: v.gender || undefined,
        dateOfBirth: v.dateOfBirth || undefined,
        phone: v.phone?.trim() || undefined,
        email: v.email?.trim() || undefined,
        bloodGroup: v.bloodGroup || undefined,
        address: v.address?.trim() || undefined,
        city: v.city?.trim() || undefined,
        state: v.state?.trim() || undefined,
        zipCode: v.zipCode?.trim() || undefined,
        notes: v.notes?.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      toast.success(`Temporary patient created (${resp.data?.mrn ?? 'TEMP'})`);
      onOpenChange(false);
      if (resp.data) onSuccess?.(resp.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create temporary patient');
    } finally {
      setSavingTemp(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: CreatePatientFormData) => {
      // Build payload, stripping empty optional fields
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        phone: data.phone,
      };
      if (data.dateOfBirth) payload.dateOfBirth = data.dateOfBirth;
      if (data.email) payload.email = data.email;
      if (data.address) payload.address = data.address;
      if (data.city) payload.city = data.city;
      if (data.state) payload.state = data.state;
      if (data.zipCode) payload.zipCode = data.zipCode;
      if (data.country) payload.country = data.country;
      if (data.bloodGroup) payload.bloodGroup = data.bloodGroup;
      if (data.maritalStatus) payload.maritalStatus = data.maritalStatus;
      if (data.nationality) payload.nationality = data.nationality;
      if (data.occupation) payload.occupation = data.occupation;
      if (data.religion) payload.religion = data.religion;
      if (data.referredBy) payload.referredBy = data.referredBy;
      if (data.abhaNumber) payload.abhaNumber = data.abhaNumber;
      if (data.nationalId) payload.nationalId = data.nationalId;
      if (data.notes) payload.notes = data.notes;

      // Create patient
      const response = await apiPost<Patient>('/patients', payload);
      const patient = response.data;

      // Create emergency contact separately if provided
      if (data.emergencyContactName && data.emergencyContactPhone) {
        const ecPayload: Record<string, unknown> = {
          name: data.emergencyContactName,
          phone: data.emergencyContactPhone,
          isPrimary: data.emergencyContactIsPrimary ?? true,
        };
        if (data.emergencyContactRelationship) {
          ecPayload.relationship = data.emergencyContactRelationship;
        }
        await apiPost(`/patients/${patient.id}/emergency-contacts`, ecPayload);
      }

      return patient;
    },
    onSuccess: (patient) => {
      toast.success('Patient registered successfully');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      onOpenChange(false);
      onSuccess?.(patient);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to register patient';
      toast.error(msg);
    },
  });

  const onSubmit = (data: CreatePatientFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Register New Patient
          </DialogTitle>
          <DialogDescription>
            Fill in the patient details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Cross-hospital match — this person already exists on the ERP. */}
          {globalHit && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
              <p className="font-semibold text-primary">Existing patient found on the ERP</p>
              <p className="mt-0.5 text-muted-foreground">
                Already registered at{' '}
                <span className="font-medium text-foreground">
                  {globalHit.hospitals.map((h) => h.name).join(', ') || 'another hospital'}
                </span>
                . Details pre-filled — a new MRN will be created for this hospital, no need to re-register.
              </p>
            </div>
          )}
          {/* ── Temporary-patient tickmark — relaxes all fields to optional ── */}
          <label className="flex items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container/40 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isTemporary}
              onChange={(e) => setIsTemporary(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <div>
              <p className="text-sm font-semibold text-on-surface">Temporary patient</p>
              <p className="text-xs text-on-surface-variant">
                Save now with whatever details you have — all fields become optional. Register the
                full record or connect it to an existing patient later from the Patients page.
              </p>
            </div>
          </label>

          {/* ── Basic Info ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Basic Info
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-firstName">First Name *</Label>
                <Input
                  id="cp-firstName"
                  placeholder="Enter first name"
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-lastName">Last Name *</Label>
                <Input
                  id="cp-lastName"
                  placeholder="Enter last name"
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender *</Label>
                <Select
                  value={genderValue}
                  onValueChange={(value: string | null) => {
                    if (value) setValue('gender', value as 'male' | 'female' | 'other');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="text-xs text-destructive">{errors.gender.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-dob">Date of Birth</Label>
                <Input
                  id="cp-dob"
                  type="date"
                  {...register('dateOfBirth')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-phone">Phone *</Label>
                <Input
                  id="cp-phone"
                  placeholder="Enter phone number"
                  {...register('phone', { onBlur: checkGlobalPatient })}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-email">Email</Label>
                <Input
                  id="cp-email"
                  type="email"
                  placeholder="Enter email (optional)"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Address ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Address
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cp-address">Address</Label>
              <Input
                id="cp-address"
                placeholder="Enter address"
                {...register('address')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-city">City</Label>
                <Input
                  id="cp-city"
                  placeholder="Enter city"
                  {...register('city')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-state">State</Label>
                <Input
                  id="cp-state"
                  placeholder="Enter state"
                  {...register('state')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-zipCode">Zip Code</Label>
                <Input
                  id="cp-zipCode"
                  placeholder="Enter zip code"
                  {...register('zipCode')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-country">Country</Label>
                <Input
                  id="cp-country"
                  placeholder="Enter country"
                  {...register('country')}
                />
              </div>
            </div>
          </div>

          {/* ── Additional Info ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Additional Info
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Blood Group</Label>
                <Select
                  value={bloodGroupValue || ''}
                  onValueChange={(value: string | null) => {
                    setValue('bloodGroup', value || '');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Marital Status</Label>
                <Select
                  value={maritalStatusValue || ''}
                  onValueChange={(value: string | null) => {
                    setValue('maritalStatus', value || '');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select marital status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUSES.map((ms) => (
                      <SelectItem key={ms.value} value={ms.value}>
                        {ms.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-nationality">Nationality</Label>
                <Input
                  id="cp-nationality"
                  placeholder="Enter nationality"
                  {...register('nationality')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-occupation">Occupation</Label>
                <Input
                  id="cp-occupation"
                  placeholder="Enter occupation"
                  {...register('occupation')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-religion">Religion</Label>
                <Input
                  id="cp-religion"
                  placeholder="Enter religion"
                  {...register('religion')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-referredBy">Referred By</Label>
                <Input
                  id="cp-referredBy"
                  placeholder="Referring doctor or source"
                  {...register('referredBy')}
                />
              </div>
            </div>
          </div>

          {/* ── ABHA Integration ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ABHA Integration
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cp-abhaNumber">ABHA Number</Label>
              <Input
                id="cp-abhaNumber"
                placeholder="Enter ABHA number"
                {...register('abhaNumber', { onBlur: checkGlobalPatient })}
              />
              <p className="text-xs text-muted-foreground">
                Ayushman Bharat Health Account ID
              </p>
            </div>
          </div>

          {/* ── ID Proof ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ID Proof
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cp-nationalId">Government ID Number</Label>
              <Input
                id="cp-nationalId"
                placeholder="Aadhaar / PAN / Passport number"
                {...register('nationalId')}
              />
            </div>
          </div>

          {/* ── Emergency Contact ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency Contact
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-ecName">Contact Name</Label>
                <Input
                  id="cp-ecName"
                  placeholder="Emergency contact name"
                  {...register('emergencyContactName')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-ecPhone">Contact Phone</Label>
                <Input
                  id="cp-ecPhone"
                  placeholder="Emergency contact phone"
                  {...register('emergencyContactPhone')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Relationship</Label>
                <Select
                  value={emergencyRelationshipValue || ''}
                  onValueChange={(value: string | null) => {
                    setValue('emergencyContactRelationship', value || '');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer h-9 px-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={emergencyIsPrimaryValue ?? true}
                    onChange={(e) => setValue('emergencyContactIsPrimary', e.target.checked)}
                  />
                  <span className="text-sm font-label text-on-surface-variant">
                    Primary contact
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notes
            </p>
            <div className="space-y-1.5">
              <Textarea
                id="cp-notes"
                placeholder="Additional notes about the patient (optional)"
                rows={3}
                {...register('notes')}
              />
              {errors.notes && (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending || savingTemp}
            >
              Cancel
            </Button>
            {isTemporary ? (
              <Button type="button" onClick={handleSaveAsTemporary} disabled={savingTemp}>
                {savingTemp ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </span>
                ) : (
                  'Create Temporary Patient'
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Registering...
                  </span>
                ) : (
                  'Register Patient'
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
