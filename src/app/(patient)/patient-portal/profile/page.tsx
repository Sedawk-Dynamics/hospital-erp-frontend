'use client';

import { User, Mail, Phone, MapPin, Calendar, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';

export default function PatientProfilePage() {
  const { user } = useAuthStore();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', 'profile'],
    queryFn: async () => {
      const res = await apiGet<{
        id: string; firstName: string; lastName: string; email?: string;
        phone?: string; gender?: string; dateOfBirth?: string; bloodGroup?: string;
        addressLine1?: string; city?: string; state?: string;
        emergencyContacts?: Array<{ name: string; phone: string; relationship: string }>;
        mrn?: string;
      }>('/patient-portal/profile');
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
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
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
    </div>
  );
}
