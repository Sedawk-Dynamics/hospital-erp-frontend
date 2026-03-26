'use client';

import { User, Mail, Phone, MapPin, Calendar, Shield, Heart, AlertTriangle } from 'lucide-react';
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
        allergies?: Array<{ allergen: string; severity: string; reaction?: string }>;
        mrn?: string;
      }>('/patient-portal/profile');
      return res.data;
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">My Profile</h1>

      {/* Basic Info */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <User className="h-4 w-4" /> Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Name:</span> <span className="ml-2 font-medium">{patient?.firstName} {patient?.lastName}</span></div>
          <div><span className="text-muted-foreground">MRN:</span> <span className="ml-2 font-medium">{patient?.mrn || '-'}</span></div>
          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span>{patient?.email || user?.email || '-'}</span></div>
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{patient?.phone || '-'}</span></div>
          <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /><span>{patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : '-'}</span></div>
          <div><span className="text-muted-foreground">Gender:</span> <span className="ml-2 capitalize">{patient?.gender || '-'}</span></div>
          <div><span className="text-muted-foreground">Blood Group:</span> <span className="ml-2 font-medium text-red-600">{patient?.bloodGroup || '-'}</span></div>
          <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span>{[patient?.addressLine1, patient?.city, patient?.state].filter(Boolean).join(', ') || '-'}</span></div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" /> Emergency Contacts
        </h3>
        {patient?.emergencyContacts && patient.emergencyContacts.length > 0 ? (
          <div className="space-y-3">
            {patient.emergencyContacts.map((c: { name: string; phone: string; relationship: string }, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex-1"><span className="font-medium">{c.name}</span> <span className="text-muted-foreground">({c.relationship})</span></div>
                <span className="text-muted-foreground">{c.phone}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No emergency contacts added</p>
        )}
      </div>

      {/* Allergies */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Allergies
        </h3>
        {patient?.allergies && patient.allergies.length > 0 ? (
          <div className="space-y-2">
            {patient.allergies.map((a: { allergen: string; severity: string; reaction?: string }, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-100 p-3 text-sm">
                <Heart className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-red-800">{a.allergen}</span>
                  <span className="text-red-600 ml-2 text-xs capitalize">({a.severity})</span>
                  {a.reaction && <p className="text-xs text-red-600 mt-0.5">{a.reaction}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No allergies recorded</p>
        )}
      </div>
    </div>
  );
}
