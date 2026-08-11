'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck, FileSearch, CheckCircle2, XCircle, 
  Search, Send, ClipboardCheck, 
} from 'lucide-react';

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  patientName: string;
  insuranceProvider: string;
  policyNumber: string;
  claimAmount: number;
  approvedAmount?: number;
  status: string;
  submittedAt: string;
  updatedAt: string;
}

interface PreAuthRequest {
  id: string;
  requestNumber: string;
  patientName: string;
  procedure: string;
  estimatedCost: number;
  insuranceProvider: string;
  status: string;
  createdAt: string;
}

interface ClaimStats {
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function InsuranceDashboard() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: claimStats, isLoading: statsLoading } = useQuery({
    queryKey: ['insurance', 'stats'],
    queryFn: async () => {
      try {
        const response = await apiGet<ClaimStats>('/insurance/claims', {
          params: { summary: true },
        });
        return response.data;
      } catch {
        return { submitted: 0, underReview: 0, approved: 0, rejected: 0 } as ClaimStats;
      }
    },
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ['insurance', 'claims', search, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const response = await apiGet<InsuranceClaim[]>('/insurance/claims', { params });
      return { data: response.data, meta: response.meta };
    },
  });

  const { data: preAuthData, isLoading: preAuthLoading } = useQuery({
    queryKey: ['insurance', 'pre-auth'],
    queryFn: async () => {
      const response = await apiGet<PreAuthRequest[]>('/insurance/pre-auth', {
        params: { limit: 10, status: 'pending' },
      });
      return response.data;
    },
  });

  const overview = claimStats ?? { submitted: 0, underReview: 0, approved: 0, rejected: 0 };
  const claims = claimsData?.data ?? [];
  const preAuthRequests = preAuthData ?? [];

  const stats = [
    { label: 'Submitted', value: overview.submitted, icon: Send },
    { label: 'Under Review', value: overview.underReview, icon: FileSearch },
    { label: 'Approved', value: overview.approved, icon: CheckCircle2 },
    { label: 'Rejected', value: overview.rejected, icon: XCircle },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Insurance Management</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
            Claims processing, pre-authorizations, and insurance coordination
          </p>
        </div>
      </div>

      {/* Claims Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">
                  {statsLoading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          placeholder="Search claims by patient, provider..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Active Claims Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            Insurance Claims
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Claim #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Provider</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Policy #</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Claimed</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Approved</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {claimsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No claims found.</td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{claim.claimNumber}</td>
                    <td className="px-4 py-3 font-label text-sm font-bold">{claim.patientName}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{claim.insuranceProvider}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{claim.policyNumber}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{fmt(claim.claimAmount)}</td>
                    <td className="px-4 py-3 text-right font-label text-sm text-primary">
                      {claim.approvedAmount != null ? fmt(claim.approvedAmount) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          claim.status === 'submitted' && 'bg-secondary/10 text-secondary',
                          claim.status === 'under_review' && 'bg-secondary/10 text-secondary',
                          claim.status === 'approved' && 'bg-primary/10 text-primary',
                          claim.status === 'rejected' && 'bg-error-container text-on-error-container',
                          claim.status === 'settled' && 'bg-primary/10 text-primary',
                        )}
                      >
                        {claim.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(claim.submittedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(claimsData?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-[10px] text-on-surface-variant">
              Page {page} of {claimsData?.meta?.totalPages}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (claimsData?.meta?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pre-Authorization Requests */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            Pending Pre-Authorization Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Request #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Procedure</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Est. Cost</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Provider</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {preAuthLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : preAuthRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending pre-authorization requests.
                  </td>
                </tr>
              ) : (
                preAuthRequests.map((req) => (
                  <tr key={req.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{req.requestNumber}</td>
                    <td className="px-4 py-3 font-label text-sm font-bold">{req.patientName}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{req.procedure}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{fmt(req.estimatedCost)}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{req.insuranceProvider}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          req.status === 'pending' && 'bg-secondary/10 text-secondary',
                          req.status === 'approved' && 'bg-primary/10 text-primary',
                          req.status === 'rejected' && 'bg-error-container text-on-error-container',
                        )}
                      >
                        {req.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(req.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
