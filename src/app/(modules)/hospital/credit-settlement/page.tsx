'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CreditSettlement } from '@/types';

export default function CreditSettlementPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Credit Settlement</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Count</p>
          <p className="mt-1 text-xl font-bold">{items.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-secondary">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Claim</p>
          <p className="mt-1 text-xl font-bold">{formatAmount(totalClaim)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Received</p>
          <p className="mt-1 text-xl font-bold text-green-600">{formatAmount(totalReceived)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-error">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Outstanding</p>
          <p className="mt-1 text-xl font-bold text-red-600">{formatAmount(totalOutstanding)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest capitalize">{type} Provider</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">No. of Admissions</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Claim Amount</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Received Amount</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-label text-on-surface-variant">No records found.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{item.providerName}</td>
                    <td className="px-4 py-3 text-center font-label text-sm">{item.totalAdmissions}</td>
                    <td className="px-4 py-3 text-right font-label text-sm">{formatAmount(item.claimAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-label text-sm">{formatAmount(item.receivedAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-label text-sm font-bold">{formatAmount(item.outstandingAmount)}</td>
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
