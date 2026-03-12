'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CollectionSummaryCard } from '@/components/hospital/billing/collection-summary';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CollectionSummary, Bill } from '@/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BillingTransactionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Billing Transaction</h1>

      <Tabs defaultValue="summary">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="summary">Billing & Collection</TabsTrigger>
          <TabsTrigger value="overall">Overall Bills</TabsTrigger>
          <TabsTrigger value="credit">Credit Bills</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled Bills</TabsTrigger>
          <TabsTrigger value="draft">Draft Bills</TabsTrigger>
          <TabsTrigger value="receipt">Receipt Bills</TabsTrigger>
          <TabsTrigger value="dayend">Day End</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          <CollectionSummaryTab />
        </TabsContent>
        <TabsContent value="overall" className="pt-4">
          <BillListTab status={undefined} />
        </TabsContent>
        <TabsContent value="credit" className="pt-4">
          <BillListTab status="partially_paid" />
        </TabsContent>
        <TabsContent value="cancelled" className="pt-4">
          <BillListTab status="cancelled" />
        </TabsContent>
        <TabsContent value="draft" className="pt-4">
          <BillListTab status="draft" />
        </TabsContent>
        <TabsContent value="receipt" className="pt-4">
          <BillListTab status="paid" />
        </TabsContent>
        <TabsContent value="dayend" className="pt-4">
          <div className="py-8 text-center text-muted-foreground">Day End Report — Coming Soon</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CollectionSummaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'collection-summary'],
    queryFn: async () => {
      try {
        const response = await apiGet<CollectionSummary>('/billing/collection-summary');
        return response.data;
      } catch {
        return undefined;
      }
    },
  });

  return <CollectionSummaryCard summary={data} isLoading={isLoading} />;
}

function BillListTab({ status }: { status: string | undefined }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'bills', status, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (status) params.status = status;
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const bills = data?.data ?? [];

  return (
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
                  <td className="px-4 py-3">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(bill.createdAt).toLocaleDateString()}</td>
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
  );
}
