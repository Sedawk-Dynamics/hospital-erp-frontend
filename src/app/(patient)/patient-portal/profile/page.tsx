'use client';

import { User, Mail, Phone, MapPin, Calendar, Shield, Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { profileEditSchema, ProfileEditValues } from '@/lib/schema/profile-edit-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdatePatientProfile } from '@/hooks/use-patient-profile';
import { usePatientProfileStore } from '@/stores/patient-profile-store';

interface PatientProfile {
  id: string; firstName: string; lastName: string; email?: string;
  phone?: string; gender?: string; dateOfBirth?: string; bloodGroup?: string;
  addressLine1?: string; city?: string; state?: string;
  mrn?: string;
}

export default function PatientProfilePage() {
  const { selectedProfileId } = usePatientProfileStore();
  const { user } = useAuthStore();
  const [editOpen,setEditOpen] = useState<boolean>(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', 'profile', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<{
        id: string; firstName: string; lastName: string; email?: string;
        phone?: string; gender?: string; dateOfBirth?: string; bloodGroup?: string;
        addressLine1?: string; city?: string; state?: string;
        emergencyContacts?: Array<{ name: string; phone: string; relationship: string }>;
        mrn?: string;
      }>('/patient-portal/profile', {
        params: selectedProfileId ? { profileId: selectedProfileId } : {},
      });
      return res.data;
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Account
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            My Profile
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            Your personal information and emergency contacts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label text-sm font-bold text-on-primary shadow-sanctuary transition-colors hover:bg-primary/90 shrink-0"
        >
          <Pencil className="h-4 w-4" />
          Edit Profile
        </button>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-label text-on-surface-variant">Name:</span>{' '}
            <span className="ml-2 font-label font-bold text-on-surface">
              {patient?.firstName} {patient?.lastName}
            </span>
          </div>
          <div>
            <span className="font-label text-on-surface-variant">MRN:</span>{' '}
            <span className="ml-2 font-label font-bold text-on-surface">{patient?.mrn || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="font-label text-on-surface">{patient?.email || user?.email || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="font-label text-on-surface">{patient?.phone || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="font-label text-on-surface">
              {patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : '-'}
            </span>
          </div>
          <div>
            <span className="font-label text-on-surface-variant">Gender:</span>{' '}
            <span className="ml-2 capitalize font-label text-on-surface">{patient?.gender || '-'}</span>
          </div>
          <div>
            <span className="font-label text-on-surface-variant">Blood Group:</span>{' '}
            <span className="ml-2 font-label font-bold text-error">{patient?.bloodGroup || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-on-surface-variant" />
            <span className="font-label text-on-surface">
              {[patient?.addressLine1, patient?.city, patient?.state].filter(Boolean).join(', ') || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6">
        <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Emergency Contacts
        </h3>
        {patient?.emergencyContacts && patient.emergencyContacts.length > 0 ? (
          <div className="space-y-3">
            {patient.emergencyContacts.map(
              (c: { name: string; phone: string; relationship: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm"
                >
                  <div className="flex-1">
                    <span className="font-label font-bold text-on-surface">{c.name}</span>{' '}
                    <span className="font-label text-on-surface-variant">({c.relationship})</span>
                  </div>
                  <span className="font-label text-on-surface-variant">{c.phone}</span>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="font-label text-sm text-on-surface-variant">No emergency contacts added</p>
        )}
      </div>

      <p className="font-label text-xs text-on-surface-variant">
        Manage allergies, personal habits, and family history in{' '}
        <a href="/patient-portal/medical-history" className="text-primary font-bold hover:underline">
          Medical History
        </a>
        .
      </p>

      <EditProfileDialog
        open={editOpen}
        patient={patient}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

function EditProfileDialog({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient?: PatientProfile;
  onClose: () => void;
}) {
  const updateProfile = useUpdatePatientProfile();

  const patientDetails=useForm<ProfileEditValues>({resolver:zodResolver(profileEditSchema),
    defaultValues: {
      firstName: patient?.firstName ?? '',
      lastName: patient?.lastName ?? '',
      email: patient?.email ?? '',
      phone: patient?.phone ?? '',
      dateOfBirth: patient?.dateOfBirth ?? '',
      gender: (patient?.gender as ProfileEditValues['gender']) ?? '',
      bloodGroup: patient?.bloodGroup ?? '',
      addressLine1: patient?.addressLine1 ?? '',
      city: patient?.city ?? '',
      state: patient?.state ?? '',
    },
  });


  const onsubmit=async (data: ProfileEditValues) => {
    if(!patient?.id)  return;
    const payload = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== ''),
    );
    try {
    await updateProfile.mutateAsync({ id: patient.id, data: payload });
    onClose();
  } catch (error) {
      console.error(error);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={patientDetails.handleSubmit(onsubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First Name</Label>
            <Input {...patientDetails.register('firstName')} id="firstName"  />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last Name</Label>
            <Input {...patientDetails.register('lastName')} id="lastName"  />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input {...patientDetails.register('email')}   id="email" type="email"  />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={patient?.phone ?? ''}
              disabled
              readOnly
            />
            <p className="font-label text-xs text-on-surface-variant">
              Phone number can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              {...patientDetails.register('dateOfBirth')}
              id="dateOfBirth"
              type="date"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <select
              {...patientDetails.register('gender')}
              id="gender"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bloodGroup">Blood Group</Label>
            <Input {...patientDetails.register('bloodGroup')} id="bloodGroup"   />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addressLine1">Address</Label>
            <Input {...patientDetails.register('addressLine1')} id="addressLine1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input {...patientDetails.register('city')} id="city"  />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input {...patientDetails.register('state')} id="state" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}







