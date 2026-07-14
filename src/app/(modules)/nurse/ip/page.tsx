'use client';

// Nurse IP Patients
// ──────────────────────────────────────────────────────────────────────────
// Browseable list of every admitted patient the nurse can act on. Each row
// links to the shared IP workspace at /nurse/ip/[admissionId] which surfaces
// vitals, eMAR, prescriptions, charting and progress notes for that patient.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  ClipboardList,
  Eye,
  HeartPulse,
  PillBottle,
  Search,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNurseAdmissions, type NurseAdmission } from '@/hooks/use-nurse';
import { formatDate } from '@/lib/date-utils';

export default function NurseIPListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'admitted' | 'discharged'>('admitted');

  const { data, isLoading } = useNurseAdmissions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 200,
  });

  const admissions: NurseAdmission[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : (data as unknown as { data: NurseAdmission[] }).data ?? [];
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return admissions;
    const q = search.toLowerCase();
    return admissions.filter((a) => {
      const name = `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (a.patient?.mrn ?? '').toLowerCase().includes(q) ||
        (a.ipNumber ?? '').toLowerCase().includes(q) ||
        (a.ward?.name ?? '').toLowerCase().includes(q) ||
        (a.bed?.bedNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [admissions, search]);

  const counts = useMemo(() => {
    const c = { all: admissions.length, admitted: 0, discharged: 0 };
    for (const a of admissions) {
      if (a.status === 'admitted') c.admitted++;
      else if (a.status === 'discharged') c.discharged++;
    }
    return c;
  }, [admissions]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">IP Patients</h1>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(['admitted', 'discharged', 'all'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === k
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {k === 'all' ? `All (${counts.all})` : k === 'admitted' ? `In IP (${counts.admitted})` : `Discharged (${counts.discharged})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, MRN, IP no, ward, bed..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              {['Patient', 'IP No.', 'Ward / Bed', 'Doctor', 'Admitted', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  className={`px-4 pb-3 pt-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant ${
                    h === 'Actions' ? 'text-right' : 'text-left'
                  }`}
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
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  No IP patients match the filter.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const initials = `${a.patient?.firstName?.[0] ?? ''}${a.patient?.lastName?.[0] ?? ''}`.toUpperCase();
                return (
                  <tr
                    key={a.id}
                    className="group hover:bg-surface-container-low cursor-pointer"
                    onClick={() => router.push(`/nurse/ip/${a.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/nurse/ip/${a.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.patient?.firstName} {a.patient?.lastName}
                          </Link>
                          <p className="text-[10px] text-muted-foreground">
                            {a.patient?.mrn ?? '-'}{a.patient?.phone ? ` · ${a.patient.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.ipNumber ?? a.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {a.ward?.name ?? '–'} / Bed {a.bed?.bedNumber ?? '–'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.doctor?.user
                        ? `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                        : '–'}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(a.admissionDate)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`capitalize text-[10px] ${
                          a.status === 'admitted' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'discharged' ? 'bg-green-100 text-green-700' :
                          a.status === 'transferred' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View patient"
                          nativeButton={false}
                          render={<Link href={`/nurse/ip/${a.id}`} />}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Vitals"
                          nativeButton={false}
                          render={<Link href={`/nurse/vitals?patientId=${a.patientId}&kind=ipd`} />}
                        >
                          <HeartPulse className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Clinical charting"
                          nativeButton={false}
                          render={<Link href={`/nurse/charting?admissionId=${a.id}&patientId=${a.patientId}`} />}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="eMAR"
                          nativeButton={false}
                          render={<Link href={`/nurse/emar?admissionId=${a.id}`} />}
                        >
                          <PillBottle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
