'use client';

// Top-bar search (gap 367). The box used to be a bare <input> wired to nothing,
// so a patient who existed "returned nothing". It now searches:
//   • patients in this hospital — name, phone or MRN (server-side)
//   • doctors — by name, specialisation or department
//   • Hospital Reports — by title
// A patient opens their file; a report opens in Hospital Reports; a doctor
// opens Doctor Schedules for those who can manage them.

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2, Search, Stethoscope, UserRound } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate } from '@/lib/date-utils';
import { allReports } from '@/app/(modules)/hospital/reports/report-catalog';
import type { DoctorProfile, Patient } from '@/types';

type Result =
  | { kind: 'patient'; id: string; title: string; subtitle: string; href: string }
  | { kind: 'doctor'; id: string; title: string; subtitle: string; href: string | null }
  | { kind: 'report'; id: string; title: string; subtitle: string; href: string };

const ICONS = { patient: UserRound, doctor: Stethoscope, report: BarChart3 } as const;
const GROUP_LABELS = { patient: 'Patients', doctor: 'Doctors', report: 'Reports' } as const;

export function GlobalSearch() {
  const router = useRouter();
  const { canAccess, isAdmin } = usePermissions();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const term = useDebounce(query.trim(), 250);
  const enabled = term.length >= 2;
  const canSeePatients = canAccess('patients', 'read');

  const patientsQuery = useQuery({
    queryKey: ['global-search', 'patients', term],
    queryFn: async () => (await apiGet<Patient[]>('/patients/search', { params: { search: term } })).data ?? [],
    enabled: enabled && canSeePatients,
    retry: false,
    staleTime: 30_000,
  });

  // The doctor list is small and changes rarely; fetch it once, filter here.
  const doctorsQuery = useQuery({
    queryKey: ['global-search', 'doctors'],
    queryFn: async () =>
      (await apiGet<DoctorProfile[]>('/appointments/doctors', { params: { limit: 100 } })).data ?? [],
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const results = useMemo<Result[]>(() => {
    if (!enabled) return [];
    const needle = term.toLowerCase();

    const patients: Result[] = (patientsQuery.data ?? []).slice(0, 6).map((p) => ({
      kind: 'patient',
      id: p.id,
      title: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.mrn,
      subtitle: [p.mrn, p.phone, p.dateOfBirth ? `DOB ${formatDate(p.dateOfBirth)}` : null]
        .filter(Boolean)
        .join(' · '),
      href: `/hospital/patients/${p.id}`,
    }));

    const doctors: Result[] = (doctorsQuery.data ?? [])
      .filter((d) => {
        const hay = [
          d.user?.firstName,
          d.user?.lastName,
          d.specialization,
          (d as { department?: { name?: string } }).department?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 5)
      .map((d) => ({
        kind: 'doctor',
        id: d.id,
        title: `Dr. ${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim(),
        subtitle:
          [d.specialization, (d as { department?: { name?: string } }).department?.name]
            .filter(Boolean)
            .join(' · ') || 'Doctor',
        href: isAdmin() ? '/hospital/settings/doctor-schedules' : null,
      }));

    const reports: Result[] = allReports
      .filter((r) => r.label.toLowerCase().includes(needle) || r.category.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((r) => ({
        kind: 'report',
        id: r.label,
        title: r.label,
        subtitle: r.category,
        href: `/hospital/reports?report=${encodeURIComponent(r.label)}`,
      }));

    return [...patients, ...doctors, ...reports];
  }, [enabled, term, patientsQuery.data, doctorsQuery.data, isAdmin]);

  const loading =
    enabled && ((canSeePatients && patientsQuery.isFetching) || doctorsQuery.isFetching);
  const showPanel = open && query.trim().length >= 2;

  const choose = (r: Result) => {
    if (!r.href) return;
    setOpen(false);
    setQuery('');
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[Math.min(active, results.length - 1)];
      if (r) choose(r);
    }
  };

  return (
    <div className="relative hidden md:block group">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-outline" />
      <input
        className="bg-surface-container-low border-none rounded-xl pl-12 pr-10 py-2.5 w-80 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        placeholder="Search patients, doctors, or reports..."
        type="search"
        aria-label="Search patients, doctors, or reports"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on a result lands before the panel closes.
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
      />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-outline" />
      )}

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-[26rem] max-h-[28rem] overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center font-label text-sm text-on-surface-variant">
              {loading || query.trim() !== term ? 'Searching…' : `No patients, doctors or reports match “${term}”.`}
            </p>
          ) : (
            (['patient', 'doctor', 'report'] as const).map((kind) => {
              const group = results.filter((r) => r.kind === kind);
              if (!group.length) return null;
              const Icon = ICONS[kind];
              return (
                <div key={kind} className="py-1">
                  <p className="px-3 pb-1 pt-1.5 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {GROUP_LABELS[kind]}
                  </p>
                  {group.map((r) => {
                    const index = results.indexOf(r);
                    return (
                      <button
                        key={`${r.kind}-${r.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        disabled={!r.href}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(r)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-default ${
                          index === active && r.href ? 'bg-surface-container-low' : ''
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate font-label text-sm font-semibold">{r.title}</span>
                          <span className="block truncate font-label text-xs text-on-surface-variant">
                            {r.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
