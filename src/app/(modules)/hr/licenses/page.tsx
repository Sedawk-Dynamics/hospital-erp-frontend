'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLicenses, useExpiringLicenses, type LicenseStatus } from '@/hooks/use-hr';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const STATUS_TONE: Record<LicenseStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expired: 'bg-rose-100 text-rose-700 border-rose-200',
  renewal_pending: 'bg-amber-100 text-amber-700 border-amber-200',
};

function daysUntil(date?: string | null) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function HrLicensesPage() {
  const [status, setStatus] = useState<LicenseStatus | ''>('');
  const { data: all, isLoading } = useLicenses({ status: status || undefined, limit: 100 });
  const { data: expiring } = useExpiringLicenses(30);

  const rows = (all?.data ?? []) as Array<{
    id: string;
    licenseType: string;
    licenseNumber: string;
    issuingAuthority?: string | null;
    issuedDate?: string | null;
    expiryDate?: string | null;
    status: LicenseStatus;
    staff?: { employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-headline">License Tracking</h1>
        <p className="text-sm text-on-surface-variant">
          Staff certifications and licenses with expiry alerts.
        </p>
      </div>

      {(expiring?.length ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-900">
              <AlertTriangle className="h-4 w-4" /> Expiring within 30 days ({expiring?.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {expiring?.map((lic) => {
                const days = daysUntil(lic.expiryDate);
                return (
                  <div key={lic.id} className="rounded-md border border-orange-200 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{lic.licenseType}</div>
                        <div className="text-xs text-on-surface-variant">{lic.licenseNumber}</div>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                        {days !== null ? (days <= 0 ? 'expired' : `${days}d left`) : '—'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {lic.staff?.user?.firstName} {lic.staff?.user?.lastName ?? ''} {lic.staff?.employeeId ? `· ${lic.staff.employeeId}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> All Licenses
            </CardTitle>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LicenseStatus | '')}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="renewal_pending">Renewal Pending</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No licenses.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Authority</th>
                    <th className="px-3 py-2">Issued</th>
                    <th className="px-3 py-2">Expires</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const days = daysUntil(r.expiryDate);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          {r.staff?.user?.firstName} {r.staff?.user?.lastName ?? ''}
                        </td>
                        <td className="px-3 py-2">{r.licenseType}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.licenseNumber}</td>
                        <td className="px-3 py-2 text-xs">{r.issuingAuthority ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">{r.issuedDate ? new Date(r.issuedDate).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.expiryDate ? (
                            <span className={days !== null && days <= 30 ? 'text-orange-700 font-semibold' : ''}>
                              {new Date(r.expiryDate).toLocaleDateString('en-IN')}
                              {days !== null && days <= 30 && days > 0 && ` (${days}d)`}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
