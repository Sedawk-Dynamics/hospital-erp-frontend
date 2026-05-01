'use client';

// /nurse/forms — landing page for the nurse Forms tab.
// Shows the calling nurse's currently-assigned patients so they can pick one
// to record forms against. Patient selection scopes to "patients of doctors
// I'm assigned to" (same rule the nurse dashboard uses).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMyPatients } from '@/hooks/use-nurse-doctor-assignments';
import { FORM_TYPES } from '@/hooks/use-nursing-forms';

export default function NurseFormsLandingPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useMyPatients({ status: 'all', type: 'all' });

  const records = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) => {
      const name = `${r.patient.firstName} ${r.patient.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (r.patient.mrn ?? '').toLowerCase().includes(q);
    });
  }, [records, search]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Patient Forms
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record nursing assessments and notes for assigned patients.
          </p>
        </div>
      </div>

      {/* Form catalogue (descriptive only — actual entry happens per-patient) */}
      <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <h2 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-3">
          Available forms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {FORM_TYPES.map((f) => (
            <div
              key={f.key}
              className="rounded-lg border bg-surface-container-low px-3 py-2"
            >
              <p className="text-sm font-semibold text-foreground">{f.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Patient list */}
      <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Assigned patients
          </h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient or MRN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {records.length === 0
              ? 'No assigned patients. Ask your nurse admin to assign you to a doctor first.'
              : 'No patients match your search.'}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => {
              const initials = `${r.patient.firstName?.[0] ?? ''}${r.patient.lastName?.[0] ?? ''}`.toUpperCase();
              const fullName = `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim();
              const subline = [
                r.patient.mrn ? `MRN ${r.patient.mrn}` : null,
                r.recordType === 'admission' ? 'IP' : 'OP',
                r.recordType === 'appointment' ? r.status : null,
                r.ward?.name,
                r.bed?.bedNumber ? `Bed ${r.bed.bedNumber}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              // Admission rows get richer context via admissionId. OPD rows
              // are now appointment-driven; if the visit already exists we
              // pass that for direct form attach, otherwise pass the
              // appointmentId so the form workspace can create one on save.
              const targetParam =
                r.recordType === 'admission'
                  ? `admissionId=${r.id}`
                  : r.visitId
                    ? `visitId=${r.visitId}`
                    : `appointmentId=${r.appointmentId ?? r.id}`;
              return (
                <li key={`${r.recordType}-${r.id}`}>
                  <Link
                    href={`/nurse/forms/${r.patientId}?${targetParam}`}
                    className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md hover:bg-surface-container-low transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{subline}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
