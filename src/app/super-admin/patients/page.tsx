'use client';

// ============================================================
// Platform patient directory — super_admin only.
//
// The hospital admin's directory is tenant-scoped: it lists the patients
// registered at their own hospital and nothing else. This one is the platform
// view — every patient at every hospital, with the owning hospital named on each
// row, because on this screen that is the first thing you need to know.
//
// The route is gated to super_admin on the server; nothing here relies on the
// menu being hidden.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useDebounce } from '@/hooks/use-debounce';
import {
  usePlatformPatientDirectory,
  usePlatformPatientHospitals,
} from '@/hooks/use-patient-file';

const PAGE_SIZE = 25;

function age(dob: string | null): string {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(years) && years >= 0 ? `${years}y` : '—';
}

export default function PlatformPatientsPage() {
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = usePlatformPatientDirectory({
    search: debounced,
    tenantId,
    page,
    limit: PAGE_SIZE,
  });
  const { data: hospitals } = usePlatformPatientHospitals();

  const rows = data?.patients ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setFilter = (id: string) => {
    setTenantId(id);
    setPage(1);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
          <Users className="h-5 w-5 text-primary" /> Patients
        </h1>
        <p className="text-xs text-muted-foreground">
          Every patient registered on the platform, across all hospitals. Open one to see its full
          file. A hospital&apos;s own admin sees only the patients registered with them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, MRN, phone, email or ABHA…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${total.toLocaleString('en-IN')} patient${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Hospital filter — the platform view's most useful cut. */}
      {(hospitals?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('')}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              !tenantId ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
            )}
          >
            All hospitals
          </button>
          {hospitals!.map((h) => (
            <button
              key={h.tenantId}
              type="button"
              onClick={() => setFilter(h.tenantId)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                tenantId === h.tenantId
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-muted',
              )}
            >
              {h.name}
              <span className="ml-1 text-muted-foreground">{h.patientCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                {['Patient', 'MRN', 'Hospital', 'Age / Sex', 'Contact', 'Registered', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 pb-3 pt-4 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No patients match this search.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/super-admin/patients/${p.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.firstName} {p.lastName ?? ''}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {p.isTemporary && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[9px] text-amber-800">
                            Temporary
                          </Badge>
                        )}
                        {!p.isActive && (
                          <Badge variant="outline" className="text-[9px]">
                            Inactive
                          </Badge>
                        )}
                        {p.hasPortalAccount && (
                          <Badge variant="outline" className="text-[9px]">
                            Portal
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.mrn}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {p.hospital.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {age(p.dateOfBirth)} · {p.gender ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.phone ?? p.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(p.registeredOn)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        nativeButton={false}
                        render={<Link href={`/super-admin/patients/${p.id}`} />}
                      >
                        Open file
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} of ${total}`
              : '0 of 0'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((v) => v + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
