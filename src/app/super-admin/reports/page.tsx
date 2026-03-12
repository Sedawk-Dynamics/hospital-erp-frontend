'use client';

import { Building2, Users, CreditCard, LifeBuoy } from 'lucide-react';
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
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Platform analytics and reporting</p>
      </div>

      {/* Tenant Summary */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Tenant Summary
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{isLoading ? '-' : tenants.length}</p>
            <p className="text-xs text-muted-foreground">Total Hospitals</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{isLoading ? '-' : activeTenants}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{isLoading ? '-' : inactiveTenants}</p>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </div>
        </div>
      </div>

      {/* User Summary */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> User Summary
          </h2>
        </div>
        <div className="p-4">
          <p className="text-2xl font-bold text-foreground">{isLoading ? '-' : totalUsers}</p>
          <p className="text-xs text-muted-foreground">Total users across all hospitals</p>
        </div>
        {!isLoading && tenants.length > 0 && (
          <div className="border-t divide-y">
            {tenants
              .sort((a, b) => (b._count?.users ?? 0) - (a._count?.users ?? 0))
              .slice(0, 10)
              .map((t) => (
                <div key={t.id} className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">{t._count?.users ?? 0} users</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Ticket Summary */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> Support Tickets Summary
          </h2>
        </div>
        <div className="grid grid-cols-4 divide-x">
          {Object.entries(ticketsByStatus).map(([status, count]) => (
            <div key={status} className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{isLoading ? '-' : count}</p>
              <p className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
