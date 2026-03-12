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
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Laboratory Home</h1>

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
          <div className="py-8 text-center text-muted-foreground">For Technicians — Coming Soon</div>
        </TabsContent>
        <TabsContent value="outsource" className="pt-4">
          <div className="py-8 text-center text-muted-foreground">Outsource List — Coming Soon</div>
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, order number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button>Create Patient</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mobile</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Tests</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No lab orders found.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{order.patient?.phone || '-'}</td>
                    <td className="px-4 py-3">{order.orderNumber}</td>
                    <td className="px-4 py-3">{order.tests?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        order.priority === 'routine' && 'bg-gray-100 text-gray-800',
                        order.priority === 'urgent' && 'bg-amber-100 text-amber-800',
                        order.priority === 'stat' && 'bg-red-100 text-red-800',
                      )}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
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
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tests</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
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
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No orders found.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
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
