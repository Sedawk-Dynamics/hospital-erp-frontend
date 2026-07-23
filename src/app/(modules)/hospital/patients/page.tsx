'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  Search,
  Loader2,
  Link2,
  ClipboardCheck,
  BadgeCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { usePatientDirectory, type PatientCategory } from '@/hooks/use-hospital';
import {
  RegisterInPlaceDialog,
  MergeDialog,
  isTemporaryPatient,
} from '@/components/hospital/temp-patient-actions';
import type { Patient } from '@/types';

const TABS: { key: PatientCategory; label: string; hint: string }[] = [
  { key: 'all', label: 'All Patients', hint: 'Everyone who has visited the hospital' },
  { key: 'registered', label: 'Registered', hint: 'Patients with a permanent record' },
  { key: 'temporary', label: 'Temporary', hint: 'Provisional — register or connect later' },
];

function isTemp(p: Patient): boolean {
  return isTemporaryPatient(p);
}

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

export default function HospitalPatientsPage() {
  const [category, setCategory] = useState<PatientCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [registerTarget, setRegisterTarget] = useState<Patient | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Patient | null>(null);

  const { data, isLoading, isFetching } = usePatientDirectory({
    category,
    search: search.trim() || undefined,
    page,
    limit: 20,
  });

  const patients = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const switchTab = useCallback((key: PatientCategory) => {
    setCategory(key);
    setPage(1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-on-surface">Patients</h1>
            <p className="text-sm text-on-surface-variant">
              Every patient the hospital has seen — registered and temporary.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            title={t.hint}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              category === t.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, MRN, or phone…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant/40 bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>MRN</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-on-surface-variant" />
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-on-surface-variant">
                  No patients found.
                </TableCell>
              </TableRow>
            ) : (
              patients.map((p) => {
                const temp = isTemp(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(p)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-on-surface">{fullName(p)}</span>
                            {temp && (
                              <Badge variant="secondary" className="uppercase">Temp</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
                    <TableCell className="capitalize">{p.gender ?? '—'}</TableCell>
                    <TableCell>{ageFromDob(p.dateOfBirth)}</TableCell>
                    <TableCell>{p.phone || '—'}</TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {temp ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRegisterTarget(p)}>
                            <ClipboardCheck className="size-3.5" />
                            Register
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMergeTarget(p)}>
                            <Link2 className="size-3.5" />
                            Connect
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                          <BadgeCheck className="size-3.5 text-primary" />
                          Registered
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-on-surface-variant">
          <span>
            {total} patient{total === 1 ? '' : 's'}
            {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin" />}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="px-2 py-1">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <RegisterInPlaceDialog patient={registerTarget} onClose={() => setRegisterTarget(null)} />
      <MergeDialog patient={mergeTarget} onClose={() => setMergeTarget(null)} />
    </div>
  );
}
