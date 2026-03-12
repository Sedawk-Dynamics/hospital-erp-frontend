'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CreditSettlement } from '@/types';

export default function CreditSettlementPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Credit Settlement</h1>

      <Tabs defaultValue="insurance">
        <TabsList variant="line">
          <TabsTrigger value="insurance">Insurance Provider</TabsTrigger>
          <TabsTrigger value="corporate">Corporate Provider</TabsTrigger>
          <TabsTrigger value="patient">Patient Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="insurance" className="pt-4">
          <ProviderTab type="insurance" />
        </TabsContent>
        <TabsContent value="corporate" className="pt-4">
          <ProviderTab type="corporate" />
        </TabsContent>
        <TabsContent value="patient" className="pt-4">
          <ProviderTab type="patient" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProviderTab({ type }: { type: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'credit-settlement', type],
    queryFn: async () => {
      try {
        const response = await apiGet<CreditSettlement[]>('/billing/credit-settlement', {
          params: { providerType: type },
        });
        return response.data;
      } catch {
        return [] as CreditSettlement[];
      }
    },
  });

  const items = data || [];
  const totalClaim = items.reduce((s, i) => s + (i.claimAmount || 0), 0);
  const totalReceived = items.reduce((s, i) => s + (i.receivedAmount || 0), 0);
  const totalOutstanding = items.reduce((s, i) => s + (i.outstandingAmount || 0), 0);

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Count</p>
          <p className="mt-1 text-xl font-bold">{items.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Claim</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatAmount(totalClaim)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Received</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formatAmount(totalReceived)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="mt-1 text-xl font-bold text-red-600">{formatAmount(totalOutstanding)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground capitalize">{type} Provider</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">No. of Admissions</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Claim Amount</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Received Amount</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No records found.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{item.providerName}</td>
                    <td className="px-4 py-3 text-center">{item.totalAdmissions}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(item.claimAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatAmount(item.receivedAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{formatAmount(item.outstandingAmount)}</td>
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
