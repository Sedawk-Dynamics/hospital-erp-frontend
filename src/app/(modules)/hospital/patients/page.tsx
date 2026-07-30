'use client';

import { useState, useCallback } from 'react';
import { Users, Search, Loader2, Link2, ClipboardCheck, Eye, UserRound, BadgeCheck, Clock, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { usePatientDirectory, type PatientCategory } from '@/hooks/use-hospital';
import {
  RegisterInPlaceDialog,
  MergeDialog,
  isTemporaryPatient,
} from '@/components/hospital/temp-patient-actions';
import { PatientDetailDialog } from '@/components/hospital/patient-detail-dialog';
import { PatientGlobalHistoryDialog } from '@/components/hospital/patient-global-history-dialog';
import type { Patient } from '@/types';

const TABS: { key: PatientCategory; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Everyone who has visited the hospital' },
  { key: 'registered', label: 'Registered', hint: 'Patients with a permanent record' },
  { key: 'temporary', label: 'Temporary', hint: 'Provisional — register or connect later' },
];

function fullName(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
}

function ageFromDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? `${age} yr` : '—';
}

function initials(p: Pick<Patient, 'firstName' | 'lastName'>): string {
  return `${p.firstName?.[0] ?? '?'}${p.lastName?.[0] ?? ''}`.toUpperCase();
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | undefined;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-headline text-xl font-bold text-on-surface">{value ?? '—'}</p>
        <p className="font-label text-xs text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

export default function HospitalPatientsPage() {
  const [category, setCategory] = useState<PatientCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [registerTarget, setRegisterTarget] = useState<Patient | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Patient | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Patient | null>(null);

  const { data, isLoading, isFetching } = usePatientDirectory({
    category,
    search: search.trim() || undefined,
    page,
    limit: 20,
  });

  // Hospital-wide counts for the stat cards (search-independent).
  const allCount = usePatientDirectory({ category: 'all', limit: 1 }).data?.total;
  const regCount = usePatientDirectory({ category: 'registered', limit: 1 }).data?.total;
  const tempCount = usePatientDirectory({ category: 'temporary', limit: 1 }).data?.total;

  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const countFor = (key: PatientCategory) =>
    key === 'all' ? allCount : key === 'registered' ? regCount : tempCount;

  const switchTab = useCallback((key: PatientCategory) => {
    setCategory(key);
    setPage(1);
  }, []);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <div>
          <h1 className="font-headline text-xl font-bold text-on-surface">Patients</h1>
          <p className="font-label text-sm text-on-surface-variant">
            Every patient the hospital has seen — registered and temporary.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="All patients" value={allCount} tone="bg-primary/10 text-primary" />
        <StatCard icon={BadgeCheck} label="Registered" value={regCount} tone="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={Clock} label="Temporary" value={tempCount} tone="bg-amber-500/10 text-amber-600" />
      </div>

      {/* Toolbar: tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const c = countFor(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                title={t.hint}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 font-label text-sm font-semibold transition-all',
                  category === t.key
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                {t.label}
                {c != null && (
                  <span
                    className={cn(
                      'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      category === t.key ? 'bg-white/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                    )}
                  >
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, MRN, or phone…"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-container">
            <tr className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">MRN</th>
              <th className="px-4 py-3 text-left">Gender</th>
              <th className="px-4 py-3 text-left">Age</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Registered</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="h-40 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-40 text-center">
                  <UserRound className="mx-auto mb-2 size-8 text-on-surface-variant/40" />
                  <p className="font-label text-sm text-on-surface-variant">No patients found.</p>
                </td>
              </tr>
            ) : (
              patients.map((p) => {
                const temp = isTemporaryPatient(p);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-surface-container/60 transition-colors last:border-0 hover:bg-surface-container-low/60"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 font-label text-xs font-bold text-primary">
                            {initials(p)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailId(p.id)}
                            className="truncate font-label font-semibold text-on-surface hover:text-primary"
                          >
                            {fullName(p)}
                          </button>
                          {temp && (
                            <Badge className="border-amber-500/20 bg-amber-500/10 uppercase text-amber-700">Temp</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-on-surface-variant">{p.mrn}</td>
                    <td className="px-4 py-2.5 capitalize text-on-surface-variant">{p.gender ?? '—'}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{ageFromDob(p.dateOfBirth)}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{p.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setDetailId(p.id)}>
                          <Eye className="size-3.5" />
                          Details
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setHistoryTarget(p)} title="History across all hospitals">
                          <Building2 className="size-3.5" />
                          History
                        </Button>
                        {temp && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setRegisterTarget(p)}>
                              <ClipboardCheck className="size-3.5" />
                              Register
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setMergeTarget(p)}>
                              <Link2 className="size-3.5" />
                              Connect
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <span className="font-label text-xs text-on-surface-variant">
              {total} patient{total === 1 ? '' : 's'}
              {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin" />}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
                Previous
              </Button>
              <span className="font-label text-xs text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((v) => v + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <PatientDetailDialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} patientId={detailId} />
      <PatientGlobalHistoryDialog
        open={!!historyTarget}
        onOpenChange={(o) => !o && setHistoryTarget(null)}
        patientId={historyTarget?.id ?? null}
        patientName={historyTarget ? `${historyTarget.firstName ?? ''} ${historyTarget.lastName ?? ''}`.trim() : undefined}
      />
      <RegisterInPlaceDialog patient={registerTarget} onClose={() => setRegisterTarget(null)} />
      <MergeDialog patient={mergeTarget} onClose={() => setMergeTarget(null)} />
    </div>
  );
}
