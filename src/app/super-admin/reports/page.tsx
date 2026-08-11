'use client';

import { Building2, Users, LifeBuoy } from 'lucide-react';
import { useTenants, useSupportTickets } from '@/hooks/use-super-admin';

export default function ReportsPage() {
  const { data: tenantsData, isLoading: tenantsLoading } = useTenants({ limit: 100 });
  const { data: ticketsData, isLoading: ticketsLoading } = useSupportTickets({ limit: 100 });

  const tenants = tenantsData?.data ?? [];
  const tickets = ticketsData?.data ?? [];
  const activeTenants = tenants.filter((t) => t.isActive).length;
  const inactiveTenants = tenants.filter((t) => !t.isActive).length;
  const totalUsers = tenants.reduce((sum, t) => sum + (t._count?.users ?? 0), 0);

  const ticketsByStatus = {
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  };

  const isLoading = tenantsLoading || ticketsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Reports</h1>
        <p className="font-label text-sm text-on-surface-variant">Platform analytics and reporting</p>
      </div>

      {/* Tenant Summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="pb-4 mb-4 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            Tenant Summary
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary text-center">
            <p className="font-headline text-3xl font-extrabold text-on-surface">{isLoading ? '-' : tenants.length}</p>
            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Hospitals</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary text-center">
            <p className="font-headline text-3xl font-extrabold text-green-600">{isLoading ? '-' : activeTenants}</p>
            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Active</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary text-center">
            <p className="font-headline text-3xl font-extrabold text-red-600">{isLoading ? '-' : inactiveTenants}</p>
            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Inactive</p>
          </div>
        </div>
      </div>

      {/* User Summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="pb-4 mb-4 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            User Summary
          </h2>
        </div>
        <div className="mb-4">
          <p className="font-headline text-3xl font-extrabold text-on-surface">{isLoading ? '-' : totalUsers}</p>
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total users across all hospitals</p>
        </div>
        {!isLoading && tenants.length > 0 && (
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
            <div className="divide-y divide-surface-container/50">
              {tenants
                .sort((a, b) => (b._count?.users ?? 0) - (a._count?.users ?? 0))
                .slice(0, 10)
                .map((t) => (
                  <div key={t.id} className="group hover:bg-surface-container-low transition-colors flex justify-between px-4 py-2">
                    <span className="font-label text-sm font-bold text-on-surface">{t.name}</span>
                    <span className="font-label text-[10px] text-on-surface-variant">{t._count?.users ?? 0} users</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Ticket Summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="pb-4 mb-4 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </div>
            Support Tickets Summary
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(ticketsByStatus).map(([status, count]) => (
            <div key={status} className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary text-center">
              <p className="font-headline text-3xl font-extrabold text-on-surface">{isLoading ? '-' : count}</p>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest capitalize">{status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
