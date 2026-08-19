'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { toast } from 'sonner';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePatient, useUpdatePatient } from '@/hooks/use-hospital';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { NursingFormsPanel } from '@/components/doctor/nursing-forms-panel';

// ============================================================
// Schema
// ============================================================

const patientEditSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(['male', 'female', 'other'], { error: 'Gender is required' }),
  dateOfBirth: z.string().optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[+]?[\d\s()-]{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  bloodGroup: z.string().optional(),
  maritalStatus: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  religion: z.string().optional(),
  abhaNumber: z.string().optional(),
  nationalId: z.string().optional(),
  referredBy: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

type PatientEditFormData = z.infer<typeof patientEditSchema>;

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

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-800',
  moderate: 'bg-orange-100 text-orange-800',
  severe: 'bg-red-100 text-red-800',
};

// ============================================================
// Props
// ============================================================

interface PatientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  /** When opened from an appointment context, filters form submissions to this appointment */
  appointmentId?: string | null;
}

// ============================================================
// Helpers
// ============================================================

function formatLabel(value: string | undefined | null): string {
  if (!value) return '-';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================
// Sub-components
// ============================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
      {title}
    </p>
  );
}

function InfoField({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '-'}</p>
    </div>
  );
}

// ============================================================
// Component
// ============================================================

export function PatientDetailDialog({
  open,
  onOpenChange,
  patientId,
  
}: PatientDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data: patient, isLoading } = usePatient(patientId ?? '');
  const updatePatient = useUpdatePatient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientEditFormData>({
    resolver: zodResolver(patientEditSchema),
  });

  const genderValue = watch('gender');
  const bloodGroupValue = watch('bloodGroup');
  const maritalStatusValue = watch('maritalStatus');

  // Reset editing state when dialog closes or patientId changes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  // Populate form when patient data arrives or when entering edit mode
  useEffect(() => {
    if (patient) {
      reset({
        firstName: patient.firstName ?? '',
        lastName: patient.lastName ?? '',
        gender: patient.gender ?? 'male',
        dateOfBirth: patient.dateOfBirth
          ? toInputDateStr(new Date(patient.dateOfBirth))
          : '',
        phone: patient.phone ?? '',
        email: patient.email ?? '',
        bloodGroup: patient.bloodGroup ?? '',
        maritalStatus: patient.maritalStatus ?? '',
        address: patient.addressLine1 ?? patient.address ?? '',
        city: patient.city ?? '',
        state: patient.state ?? '',
        zipCode: patient.postalCode ?? patient.zipCode ?? '',
        country: patient.country ?? '',
        nationality: patient.nationality ?? '',
        occupation: patient.occupation ?? '',
        religion: patient.religion ?? '',
        abhaNumber: patient.abhaNumber ?? '',
        nationalId: patient.idProofNumber ?? patient.nationalId ?? '',
        referredBy: patient.referredBy ?? '',
        notes: patient.notes ?? '',
      });
    }
  }, [patient, reset]);

  const onSubmit = async (data: PatientEditFormData) => {
    if (!patientId) return;
    try {
      await updatePatient.mutateAsync({ id: patientId, data });
      toast.success('Patient updated successfully');
      setIsEditing(false);
    } catch {
      toast.error('Failed to update patient');
    }
  };

  const handleCancel = () => {
    if (patient) {
      reset({
        firstName: patient.firstName ?? '',
        lastName: patient.lastName ?? '',
        gender: patient.gender ?? 'male',
        dateOfBirth: patient.dateOfBirth
          ? toInputDateStr(new Date(patient.dateOfBirth))
          : '',
        phone: patient.phone ?? '',
        email: patient.email ?? '',
        bloodGroup: patient.bloodGroup ?? '',
        maritalStatus: patient.maritalStatus ?? '',
        address: patient.addressLine1 ?? patient.address ?? '',
        city: patient.city ?? '',
        state: patient.state ?? '',
        zipCode: patient.postalCode ?? patient.zipCode ?? '',
        country: patient.country ?? '',
        nationality: patient.nationality ?? '',
        occupation: patient.occupation ?? '',
        religion: patient.religion ?? '',
        abhaNumber: patient.abhaNumber ?? '',
        nationalId: patient.idProofNumber ?? patient.nationalId ?? '',
        referredBy: patient.referredBy ?? '',
        notes: patient.notes ?? '',
      });
    }
    setIsEditing(false);
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-headline text-on-surface-variant">
                Patient Details
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Edit patient information below.'
                  : 'View patient profile and medical information.'}
              </DialogDescription>
            </div>
            {!isLoading && patient && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="ml-4"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* No patient */}
        {!isLoading && !patient && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Patient not found.</p>
          </div>
        )}

        {/* Patient data */}
        {!isLoading && patient && (
          <>
            {isEditing ? (
              /* ============================== EDIT MODE ============================== */
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Demographics */}
                <div>
                  <SectionHeader title="Demographics" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="font-label">First Name</Label>
                      <Input id="firstName" {...register('firstName')} />
                      {errors.firstName && (
                        <p className="text-xs text-destructive">{errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="font-label">Last Name</Label>
                      <Input id="lastName" {...register('lastName')} />
                      {errors.lastName && (
                        <p className="text-xs text-destructive">{errors.lastName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-label">MRN</Label>
                      <Input value={patient.mrn ?? ''} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-label">Gender</Label>
                      <Select
                        value={genderValue}
                        onValueChange={(value: string | null) => {
                          if (value) setValue('gender', value as 'male' | 'female' | 'other');
                        }}
                      >
                        <SelectTrigger>
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
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dateOfBirth" className="font-label">Date of Birth</Label>
                      <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="font-label">Phone</Label>
                      <Input id="phone" {...register('phone')} />
                      {errors.phone && (
                        <p className="text-xs text-destructive">{errors.phone.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="font-label">Email</Label>
                      <Input id="email" type="email" {...register('email')} />
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-label">Blood Group</Label>
                      <Select
                        value={bloodGroupValue || ''}
                        onValueChange={(value: string | null) => {
                          setValue('bloodGroup', value || '');
                        }}
                      >
                        <SelectTrigger>
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
                      <Label className="font-label">Marital Status</Label>
                      <Select
                        value={maritalStatusValue || ''}
                        onValueChange={(value: string | null) => {
                          setValue('maritalStatus', value || '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
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
                </div>

                <Separator />

                {/* Address */}
                <div>
                  <SectionHeader title="Address" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="address" className="font-label">Address</Label>
                      <Input id="address" {...register('address')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="font-label">City</Label>
                      <Input id="city" {...register('city')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="font-label">State</Label>
                      <Input id="state" {...register('state')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="zipCode" className="font-label">Zip Code</Label>
                      <Input id="zipCode" {...register('zipCode')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="font-label">Country</Label>
                      <Input id="country" {...register('country')} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Additional */}
                <div>
                  <SectionHeader title="Additional Information" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="nationality" className="font-label">Nationality</Label>
                      <Input id="nationality" {...register('nationality')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="occupation" className="font-label">Occupation</Label>
                      <Input id="occupation" {...register('occupation')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="religion" className="font-label">Religion</Label>
                      <Input id="religion" {...register('religion')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="abhaNumber" className="font-label">ABHA Number</Label>
                      <Input id="abhaNumber" {...register('abhaNumber')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="nationalId" className="font-label">National ID</Label>
                      <Input id="nationalId" {...register('nationalId')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="referredBy" className="font-label">Referred By</Label>
                      <Input id="referredBy" {...register('referredBy')} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Form actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              /* ============================== READ MODE ============================== */
              <div className="space-y-6">
                {/* Demographics */}
                <div>
                  <SectionHeader title="Demographics" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <InfoField
                      label="Name"
                      value={`${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim()}
                    />
                    <InfoField label="MRN" value={patient.mrn} />
                    <InfoField label="Gender" value={formatLabel(patient.gender)} />
                    <InfoField label="Date of Birth" value={formatDate(patient.dateOfBirth)} />
                    <InfoField label="Phone" value={patient.phone} />
                    <InfoField label="Email" value={patient.email} />
                    <InfoField label="Blood Group" value={patient.bloodGroup} />
                    <InfoField label="Marital Status" value={formatLabel(patient.maritalStatus)} />
                  </div>
                </div>

                <Separator />

                {/* Address */}
                <div>
                  <SectionHeader title="Address" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="col-span-2">
                      <InfoField label="Address" value={patient.addressLine1 ?? patient.address} />
                    </div>
                    <InfoField label="City" value={patient.city} />
                    <InfoField label="State" value={patient.state} />
                    <InfoField label="Zip Code" value={patient.postalCode ?? patient.zipCode} />
                    <InfoField label="Country" value={patient.country} />
                  </div>
                </div>

                <Separator />

                {/* Additional */}
                <div>
                  <SectionHeader title="Additional Information" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <InfoField label="Nationality" value={patient.nationality} />
                    <InfoField label="Occupation" value={patient.occupation} />
                    <InfoField label="Religion" value={patient.religion} />
                    <InfoField label="ABHA Number" value={patient.abhaNumber} />
                    <InfoField label="National ID" value={patient.idProofNumber ?? patient.nationalId} />
                    <InfoField label="Referred By" value={patient.referredBy} />
                  </div>
                </div>

                <Separator />

                {/* Emergency Contacts */}
                <div>
                  <SectionHeader title="Emergency Contacts" />
                  {patient.emergencyContacts && patient.emergencyContacts.length > 0 ? (
                    <div className="space-y-3">
                      {patient.emergencyContacts.map(
                        (contact: {
                          id: string;
                          name: string;
                          relationship?: string;
                          phone: string;
                          email?: string;
                          isPrimary?: boolean;
                        }) => (
                          <div
                            key={contact.id}
                            className="flex items-start gap-3 rounded-md border p-3"
                          >
                            <div className="flex-1 grid grid-cols-3 gap-x-4 gap-y-1">
                              <div>
                                <p className="text-xs text-muted-foreground">Name</p>
                                <p className="text-sm font-medium">{contact.name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Relationship</p>
                                <p className="text-sm font-medium">
                                  {formatLabel(contact.relationship)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="text-sm font-medium">{contact.phone}</p>
                              </div>
                            </div>
                            {contact.isPrimary && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Primary
                              </Badge>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No emergency contacts on file.</p>
                  )}
                </div>

                <Separator />

                {/* Allergies */}
                <div>
                  <SectionHeader title="Allergies" />
                  {patient.allergies && patient.allergies.length > 0 ? (
                    <div className="space-y-2">
                      {patient.allergies.map(
                        (allergy: {
                          id: string;
                          allergen: string;
                          allergyType?: string;
                          severity?: string;
                          reaction?: string;
                        }) => (
                          <div
                            key={allergy.id}
                            className="flex items-center gap-3 rounded-md border p-3"
                          >
                            <div className="flex-1 grid grid-cols-3 gap-x-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Allergen</p>
                                <p className="text-sm font-medium">{allergy.allergen}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Type</p>
                                <p className="text-sm font-medium">
                                  {formatLabel(allergy.allergyType)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Severity</p>
                                {allergy.severity ? (
                                  <Badge
                                    className={`text-xs ${SEVERITY_COLORS[allergy.severity.toLowerCase()] ?? 'bg-gray-100 text-gray-800'}`}
                                  >
                                    {formatLabel(allergy.severity)}
                                  </Badge>
                                ) : (
                                  <p className="text-sm font-medium">-</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No allergies recorded.</p>
                  )}
                </div>

                {/* Notes */}
                {patient.notes && (
                  <>
                    <Separator />
                    <div>
                      <SectionHeader title="Notes" />
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {patient.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Patient form submissions — visible to anyone with patient
                    detail access (doctor, nurse, nurse_admin, admin). */}
                <Separator />
                <NursingFormsPanel patientId={patient.id} />

                {/* Status & timestamps */}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Status:</span>
                    <Badge variant={patient.isActive ? 'default' : 'secondary'}>
                      {patient.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <span>Last updated: {formatDate(patient.updatedAt)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
