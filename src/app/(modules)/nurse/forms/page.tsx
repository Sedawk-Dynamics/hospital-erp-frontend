'use client';

// /nurse/forms — landing page for the dynamic Patient Forms tab.
//
// Lists every patient a nurse may need to document, across all encounter
// types, not just OPD:
//   • OPD          — front-desk-confirmed appointments under the nurse's
//                    assigned doctors (unchanged).
//   • IP /         — every current admission on the ward. Admissions are NOT
//     Emergency /    filtered by nurse↔doctor assignment: IP is a shared
//     Day Care       ledger, an emergency admission may have no doctor
//                    attached yet, and a day-care case can be handed over
//                    mid-shift. Scoping these to "my doctors" is what made
//                    them unreachable from here.
//   • Temporary    — provisional TEMP- patients the front desk has not routed
//                    to OP or IP yet.
//
// Each row links to /nurse/forms/[patientId] with the encounter in the query
// string so the submission binds to the right visit / admission.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useMyPatients } from '@/hooks/use-nurse-doctor-assignments';
import { useNurseAdmissions, type NurseAdmission } from '@/hooks/use-nurse';
import { usePatientDirectory } from '@/hooks/use-hospital';
import { useHospitalForms, FORM_CATEGORIES } from '@/hooks/use-forms';

type Kind = 'op' | 'ip' | 'emergency' | 'daycare' | 'temporary';

const KIND_LABEL: Record<Kind, string> = {
  op: 'OPD',
  ip: 'IP',
  emergency: 'Emergency',
  daycare: 'Day Care',
  temporary: 'Temporary',
};

const KIND_TINT: Record<Kind, string> = {
  op: 'bg-sky-100 text-sky-800',
  ip: 'bg-teal-100 text-teal-800',
  emergency: 'bg-rose-100 text-rose-800',
  daycare: 'bg-amber-100 text-amber-800',
  temporary: 'bg-slate-200 text-slate-800',
};

interface Row {
  key: string;
  kind: Kind;
  patientId: string;
  name: string;
  mrn: string | null;
  subline: string;
  /** Query string carrying the encounter, empty for an unrouted temp patient. */
  query: string;
}

export default function NurseFormsLandingPage() {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | Kind>('all');

  // OPD — confirmed appointments under the nurse's assigned doctors.
  const opQ = useMyPatients({ status: 'all', type: 'op' });
  // IP / emergency / day care — every current admission, assignment-agnostic.
  const ipQ = useNurseAdmissions({ status: 'admitted', limit: 200 });
  // Provisional patients with no encounter yet.
  const tempQ = usePatientDirectory({ category: 'temporary', limit: 100 });

  // Show a quick preview of the hospital's form catalogue so nurses know
  // what's available before they pick a patient.
  const formsQ = useHospitalForms({ status: 'active', limit: 100 });

  const isLoading = opQ.isLoading || ipQ.isLoading || tempQ.isLoading;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    for (const r of opQ.data?.data ?? []) {
      if (r.recordType !== 'appointment') continue;
      const query = r.visitId
        ? `visitId=${r.visitId}`
        : `appointmentId=${r.appointmentId ?? r.id}`;
      out.push({
        key: `op-${r.id}`,
        kind: 'op',
        patientId: r.patientId,
        name: `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim(),
        mrn: r.patient.mrn ?? null,
        subline: [
          r.patient.mrn ? `MRN ${r.patient.mrn}` : null,
          r.doctor?.user
            ? `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName ?? ''}`.trim()
            : null,
          r.status,
        ]
          .filter(Boolean)
          .join(' · '),
        query,
      });
    }

    const admissions: NurseAdmission[] = Array.isArray(ipQ.data)
      ? (ipQ.data as unknown as NurseAdmission[])
      : ((ipQ.data as unknown as { data?: NurseAdmission[] })?.data ?? []);
    for (const a of admissions) {
      // Null admission_type is an ordinary IP stay (see the admission-types work).
      const t = (a.admissionType ?? 'ip') as Kind;
      const kind: Kind = t === 'emergency' || t === 'daycare' ? t : 'ip';
      out.push({
        key: `adm-${a.id}`,
        kind,
        patientId: a.patientId,
        name: `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.trim() || 'Patient',
        mrn: a.patient?.mrn ?? null,
        subline: [
          a.patient?.mrn ? `MRN ${a.patient.mrn}` : null,
          a.ipNumber ?? null,
          a.ward?.name ?? null,
          a.bed?.bedNumber ? `Bed ${a.bed.bedNumber}` : null,
          a.doctor?.user
            ? `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName ?? ''}`.trim()
            : 'No doctor assigned',
        ]
          .filter(Boolean)
          .join(' · '),
        query: `admissionId=${a.id}${a.visitId ? `&visitId=${a.visitId}` : ''}`,
      });
    }

    // A temp patient that has already been routed to OP or IP shows up above
    // with its encounter; only list the ones still floating on their own.
    const routed = new Set(out.map((r) => r.patientId));
    for (const p of tempQ.data?.patients ?? []) {
      if (routed.has(p.id)) continue;
      out.push({
        key: `temp-${p.id}`,
        kind: 'temporary',
        patientId: p.id,
        name: `${p.firstName} ${p.lastName ?? ''}`.trim(),
        mrn: p.mrn ?? null,
        subline: [p.mrn ? `MRN ${p.mrn}` : null, p.phone, 'Not routed to OP/IP yet']
          .filter(Boolean)
          .join(' · '),
        query: '',
      });
    }

    return out;
  }, [opQ.data, ipQ.data, tempQ.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (kindFilter !== 'all') list = list.filter((r) => r.kind === kindFilter);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.mrn ?? '').toLowerCase().includes(q),
    );
  }, [rows, kindFilter, search]);

  const forms = (formsQ.data?.data ?? []).filter((f) => f.isPublished);
  const formsByCat = useMemo(() => {
    const map = new Map<string, typeof forms>();
    for (const f of forms) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [forms]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
          <FileText className="h-5 w-5 text-primary" />
          Patient Forms
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Record assessments and notes using forms set up by your hospital admin — for OPD, IP,
          emergency, day-care and temporary patients.
        </p>
      </div>

      {/* Form catalogue — descriptive only */}
      <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <h2 className="mb-3 font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          Available forms
        </h2>
        {formsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : forms.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Your hospital admin hasn&apos;t published any forms yet. Ask them to set them up under{' '}
            <span className="font-semibold">Settings → Patient Forms</span>.
          </p>
        ) : (
          <div className="space-y-2">
            {FORM_CATEGORIES.filter((c) => formsByCat.has(c.value)).map((c) => (
              <div key={c.value}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(formsByCat.get(c.value) ?? []).map((f) => (
                    <span
                      key={f.id}
                      className="rounded-full border bg-surface-container-low px-2.5 py-1 text-xs"
                    >
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Patient list */}
      <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
            <Users className="h-3.5 w-3.5" />
            Patients
          </h2>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient or MRN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['all', 'op', 'ip', 'emergency', 'daycare', 'temporary'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ring-border/60 transition-colors',
                kindFilter === k
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'text-muted-foreground hover:bg-surface-container-low',
              )}
            >
              {k === 'all' ? 'All' : KIND_LABEL[k]}
              <span className="ml-1 opacity-70">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {rows.length === 0
              ? 'No patients to document right now. OPD needs a front-desk-confirmed appointment under one of your doctors; IP shows current admissions.'
              : 'No patients match this filter.'}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => {
              const initials = r.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0])
                .join('')
                .toUpperCase();
              return (
                <li key={r.key}>
                  <Link
                    href={`/nurse/forms/${r.patientId}${r.query ? `?${r.query}` : ''}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-container-low"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.subline}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                        KIND_TINT[r.kind],
                      )}
                    >
                      {KIND_LABEL[r.kind]}
                    </span>
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
