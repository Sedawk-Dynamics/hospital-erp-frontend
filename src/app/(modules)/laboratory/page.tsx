'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { LabOrder } from '@/types';
import { cn } from '@/lib/utils';

export default function LaboratoryHomePage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Laboratory Home</h1>

      <Tabs defaultValue="status">
        <TabsList variant="line">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="test-report">Test Report</TabsTrigger>
          <TabsTrigger value="technicians">For Technicians</TabsTrigger>
          <TabsTrigger value="outsource">Outsource List</TabsTrigger>
          <TabsTrigger value="order">Order</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="pt-4">
          <LabStatusTab />
        </TabsContent>
        <TabsContent value="test-report" className="pt-4">
          <LabOrderList />
        </TabsContent>
        <TabsContent value="technicians" className="pt-4">
          <TechniciansTab />
        </TabsContent>
        <TabsContent value="outsource" className="pt-4">
          <OutsourceTab />
        </TabsContent>
        <TabsContent value="order" className="pt-4">
          <LabOrderList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabStatusTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['laboratory', 'orders', { search, page }],
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', {
        params: { search: search || undefined, page, limit: 20 },
      });
      return { data: response.data, meta: response.meta! };
    },
  });

  const orders = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient, order number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button>Create Patient</Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Mobile</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total Tests</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Priority</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">No lab orders found.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{order.patient?.phone || '-'}</td>
                    <td className="px-4 py-3">{order.orderNumber}</td>
                    <td className="px-4 py-3">{order.tests?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        order.priority === 'routine' && 'bg-gray-100 text-gray-800',
                        order.priority === 'urgent' && 'bg-amber-100 text-amber-800',
                        order.priority === 'stat' && 'bg-red-100 text-red-800',
                      )}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        order.status === 'pending' && 'bg-amber-100 text-amber-800',
                        order.status === 'sample_collected' && 'bg-blue-100 text-blue-800',
                        order.status === 'in_progress' && 'bg-purple-100 text-purple-800',
                        order.status === 'completed' && 'bg-green-100 text-green-800',
                        order.status === 'cancelled' && 'bg-red-100 text-red-800',
                      )}>
                        {order.status?.replace('_', ' ')}
                      </span>
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

function LabOrderList() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['laboratory', 'orders-all', page],
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', {
        params: { page, limit: 20 },
      });
      return { data: response.data, meta: response.meta! };
    },
  });

  const orders = data?.data ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order #</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Doctor</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Tests</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-label text-on-surface-variant">No orders found.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.patient?.firstName} {order.patient?.lastName}</td>
                  <td className="px-4 py-3">
                    {order.doctor ? `Dr. ${order.doctor.user?.firstName} ${order.doctor.user?.lastName}` : '-'}
                  </td>
                  <td className="px-4 py-3">{order.tests?.map((t) => t.name).join(', ') || '-'}</td>
                  <td className="px-4 py-3 capitalize">{order.status?.replace('_', ' ')}</td>
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

/** For Technicians: shows samples that need processing (collected/in_progress) */
function TechniciansTab() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['laboratory', 'samples', search],
    queryFn: async () => {
      const response = await apiGet<Array<{
        id: string; sampleId: string; sampleType: string; status: string;
        collectedAt: string; labOrder?: { orderNumber: string; patient?: { firstName: string; lastName: string } };
      }>>('/lab/samples', { params: { search: search || undefined, limit: 50 } });
      return response.data;
    },
  });

  const samples = data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input placeholder="Search sample, patient..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Sample ID</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order #</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Sample Type</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Collected</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : samples.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">No samples pending.</td></tr>
            ) : (
              samples.map((s) => (
                <tr key={s.id} className="group hover:bg-surface-container-low transition-colors transition-colors">
                  <td className="px-4 py-3 font-medium">{s.sampleId}</td>
                  <td className="px-4 py-3">{s.labOrder?.patient ? `${s.labOrder.patient.firstName} ${s.labOrder.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-3">{s.labOrder?.orderNumber ?? '-'}</td>
                  <td className="px-4 py-3 capitalize">{s.sampleType?.replace('_', ' ') || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.collectedAt ? new Date(s.collectedAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      s.status === 'collected' && 'bg-blue-100 text-blue-800',
                      s.status === 'in_transit' && 'bg-amber-100 text-amber-800',
                      s.status === 'received' && 'bg-purple-100 text-purple-800',
                      s.status === 'processing' && 'bg-indigo-100 text-indigo-800',
                      s.status === 'completed' && 'bg-green-100 text-green-800',
                      s.status === 'rejected' && 'bg-red-100 text-red-800',
                    )}>
                      {s.status?.replace('_', ' ')}
                    </span>
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

/** Outsource List: shows third-party lab orders */
function OutsourceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['laboratory', 'outsource'],
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', {
        params: { isThirdParty: true, limit: 50 },
      });
      return response.data;
    },
  });

  const orders = data ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-container">
            <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order #</th>
            <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
            <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Third-Party Lab</th>
            <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Tests</th>
            <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
          ) : orders.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center font-label text-on-surface-variant">No outsourced orders.</td></tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="group hover:bg-surface-container-low transition-colors transition-colors">
                <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                <td className="px-4 py-3">{order.patient?.firstName} {order.patient?.lastName}</td>
                <td className="px-4 py-3">{order.thirdPartyLabName || '-'}</td>
                <td className="px-4 py-3">{order.tests?.map((t) => t.name).join(', ') || '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                    order.status === 'completed' && 'bg-green-100 text-green-800',
                    order.status === 'in_progress' && 'bg-purple-100 text-purple-800',
                    order.status === 'ordered' && 'bg-amber-100 text-amber-800',
                  )}>
                    {order.status?.replace('_', ' ')}
                  </span>
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
