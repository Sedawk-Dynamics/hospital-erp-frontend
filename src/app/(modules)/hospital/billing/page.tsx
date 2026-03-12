'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Bill } from '@/types';
import { cn } from '@/lib/utils';

export default function HospitalBillingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Hospital Billing</h1>

      <Tabs defaultValue="billing">
        <TabsList variant="line">
          <TabsTrigger value="billing">Hospital Billing</TabsTrigger>
          <TabsTrigger value="cash-counter">Cash Counter</TabsTrigger>
          <TabsTrigger value="pending">Pending List</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="pt-4">
          <BillingTab />
        </TabsContent>
        <TabsContent value="cash-counter" className="pt-4">
          <div className="py-8 text-center text-muted-foreground">Cash Counter — Coming Soon</div>
        </TabsContent>
        <TabsContent value="pending" className="pt-4">
          <PendingListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BillingTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing', { search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const bills = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search UHID, Phone, OP Number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button>New Bill</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bill #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bills found.</td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{bill.billNumber}</td>
                    <td className="px-4 py-3">
                      {bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(bill.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{bill.total?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600">{bill.paidAmount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">{bill.balanceAmount?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        bill.status === 'paid' && 'bg-green-100 text-green-800',
                        bill.status === 'pending' && 'bg-amber-100 text-amber-800',
                        bill.status === 'partially_paid' && 'bg-blue-100 text-blue-800',
                        bill.status === 'cancelled' && 'bg-red-100 text-red-800',
                        bill.status === 'draft' && 'bg-gray-100 text-gray-800',
                      )}>
                        {bill.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingListTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing-pending'],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { status: 'pending', limit: 50 } });
      return response.data;
    },
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bill #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : (data || []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No pending bills.</td>
              </tr>
            ) : (
              (data || []).map((bill) => (
                <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{bill.billNumber}</td>
                  <td className="px-4 py-3">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-3 text-right">{bill.total?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{bill.balanceAmount?.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
