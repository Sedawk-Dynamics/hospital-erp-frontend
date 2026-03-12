'use client';

import { Building2, Users, CreditCard, LifeBuoy, Activity, TrendingUp } from 'lucide-react';
import { useTenants, useSupportTickets } from '@/hooks/use-super-admin';

export default function SuperAdminDashboardPage() {
  const { data: tenantsData, isLoading: tenantsLoading } = useTenants({ limit: 100 });
  const { data: ticketsData, isLoading: ticketsLoading } = useSupportTickets({ limit: 100 });

  const tenants = tenantsData?.data ?? [];
  const tickets = ticketsData?.data ?? [];
  const activeTenants = tenants.filter((t) => t.isActive).length;
  const totalUsers = tenants.reduce((sum, t) => sum + (t._count?.users ?? 0), 0);
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  const cards = [
    { label: 'Total Hospitals', value: tenants.length, icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Hospitals', value: activeTenants, icon: Activity, color: 'text-green-600 bg-green-50' },
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Open Tickets', value: openTickets, icon: LifeBuoy, color: 'text-orange-600 bg-orange-50' },
    { label: 'Active Subscriptions', value: activeTenants, icon: CreditCard, color: 'text-teal-600 bg-teal-50' },
    { label: 'Platform Health', value: '99.9%', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
  ];

  const isLoading = tenantsLoading || ticketsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your SaaS platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  {isLoading ? (
                    <div className="mt-1 h-6 w-12 animate-pulse rounded bg-muted" />
                  ) : (
                    <p className="text-xl font-bold text-foreground">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Tenants */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-foreground">Recent Hospitals</h2>
        </div>
        <div className="divide-y">
          {tenantsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hospitals onboarded yet</div>
          ) : (
            tenants.slice(0, 5).map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">{tenant.slug} &middot; {tenant._count?.users ?? 0} users</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    tenant.isActive
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {tenant.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-foreground">Recent Support Tickets</h2>
        </div>
        <div className="divide-y">
          {ticketsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No support tickets</div>
          ) : (
            tickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.priority} priority &middot; {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    ticket.status === 'open'
                      ? 'bg-yellow-50 text-yellow-700'
                      : ticket.status === 'in_progress'
                        ? 'bg-blue-50 text-blue-700'
                        : ticket.status === 'resolved' || ticket.status === 'closed'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                  }`}
                >
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
