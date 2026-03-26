'use client';

import { useState } from 'react';
import { CreditCard, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { HospitalFilter } from '../_components/hospital-filter';

export default function PatientBillingPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'bills', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 30 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<Array<{
        id: string; billNumber: string; total: number; paidAmount: number;
        balanceAmount: number; status: string; createdAt: string;
        billItems?: Array<{ description?: string; totalAmount?: number }>;
      }>>('/patient-portal/billing', { params });
      return res.data ?? [];
    },
  });

  const bills = data ?? [];
  const totalDue = bills.reduce((s, b) => s + (Number(b.balanceAmount) || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Bills & Payments</h1>
        {totalDue > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
            <span className="text-sm text-amber-800 font-medium">Outstanding: {`\u20B9${totalDue.toLocaleString('en-IN')}`}</span>
          </div>
        )}
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bill #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No bills found</p>
              </td></tr>
            ) : (
              bills.map((bill) => (
                <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{bill.billNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(bill.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-medium">{`\u20B9${Number(bill.total).toLocaleString('en-IN')}`}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{`\u20B9${Number(bill.paidAmount).toLocaleString('en-IN')}`}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{Number(bill.balanceAmount) > 0 ? `\u20B9${Number(bill.balanceAmount).toLocaleString('en-IN')}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      bill.status === 'paid' && 'bg-green-100 text-green-800',
                      bill.status === 'pending' && 'bg-amber-100 text-amber-800',
                      bill.status === 'partially_paid' && 'bg-blue-100 text-blue-800',
                    )}>{bill.status?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm"><Download className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
