'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffProfiles, useDeactivateStaffProfile, type StaffStatus } from '@/hooks/use-hr';
import { Search, UserMinus } from 'lucide-react';

const STATUS_TONE: Record<StaffStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
  resigned: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  terminated: 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function HrStaffPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StaffStatus | ''>('');
  const { data, isLoading } = useStaffProfiles({ search: search || undefined, status: status || undefined });
  const deactivate = useDeactivateStaffProfile();

  const rows = (data?.data ?? []) as Array<{
    id: string;
    employeeId?: string | null;
    position?: string | null;
    status: StaffStatus;
    employmentType?: string | null;
    user?: { firstName: string; lastName?: string | null; email?: string | null };
    department?: { name: string };
    dateOfJoining?: string | null;
    salary?: number | string | null;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-headline">Staff Profiles</h1>
        <p className="text-sm text-on-surface-variant">
          Personal info, department, position, employment type, license info.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                placeholder="Search by name or employee ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as StaffStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No staff found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Emp ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Joined</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{r.employeeId ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div>{r.user?.firstName} {r.user?.lastName ?? ''}</div>
                        {r.user?.email && <div className="text-xs text-on-surface-variant">{r.user.email}</div>}
                      </td>
                      <td className="px-3 py-2">{r.department?.name ?? '—'}</td>
                      <td className="px-3 py-2">{r.position ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{r.employmentType?.replace('_', ' ') ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.dateOfJoining ? new Date(r.dateOfJoining).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.status === 'active' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Deactivate this staff profile?')) deactivate.mutate(r.id);
                            }}
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1" /> Deactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
