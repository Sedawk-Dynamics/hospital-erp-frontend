'use client';

import Link from 'next/link';
import { Building2, Users, CreditCard, LifeBuoy, Activity, TrendingUp, Package, Plus, Check, X, Pencil, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenants, useSupportTickets, useAllPlans, useUpdatePlan, type SubscriptionPlanAdmin } from '@/hooks/use-super-admin';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';

export default function SuperAdminDashboardPage() {
  const { data: tenantsData, isLoading: tenantsLoading } = useTenants({ limit: 100 });
  const { data: ticketsData, isLoading: ticketsLoading } = useSupportTickets({ limit: 100 });
  const { data: plans, isLoading: plansLoading } = useAllPlans();
  const updatePlan = useUpdatePlan();

  const tenants = tenantsData?.data ?? [];
  const tickets = ticketsData?.data ?? [];
  const activeTenants = tenants.filter((t) => t.isActive).length;
  const totalUsers = tenants.reduce((sum, t) => sum + (t._count?.users ?? 0), 0);
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const activePlans = (plans ?? []).filter((p) => p.isActive).length;
  const totalPlans = (plans ?? []).length;

  const cards = [
    { label: 'Total Hospitals', value: tenants.length, icon: Building2 },
    { label: 'Active Hospitals', value: activeTenants, icon: Activity },
    { label: 'Total Users', value: totalUsers, icon: Users },
    { label: 'Open Tickets', value: openTickets, icon: LifeBuoy },
    { label: 'Subscription Plans', value: `${activePlans}/${totalPlans}`, icon: Package },
    { label: 'Platform Health', value: '99.9%', icon: TrendingUp },
  ];

  const isLoading = tenantsLoading || ticketsLoading;

  const handleTogglePlan = async (plan: SubscriptionPlanAdmin) => {
    try {
      await updatePlan.mutateAsync({ id: plan.id, isActive: !plan.isActive });
      toast.success(`Plan "${plan.name}" ${plan.isActive ? 'deactivated' : 'activated'}`);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update plan';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Platform Dashboard</h1>
        <p className="font-label text-sm text-on-surface-variant">Overview of your SaaS platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{card.label}</p>
                  {isLoading || plansLoading ? (
                    <div className="mt-1 h-6 w-12 animate-shimmer rounded" />
                  ) : (
                    <p className="font-headline text-3xl font-extrabold">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription Plans Management */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-container px-4 py-3">
          <h2 className="font-headline text-lg font-bold">Subscription Plans</h2>
          <div className="flex items-center gap-2">
            <Link href="/super-admin/subscriptions?tab=plans">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Plan
              </Button>
            </Link>
            <Link href="/super-admin/subscriptions">
              <Button variant="ghost" size="sm">
                Manage All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="divide-y divide-surface-container/50">
          {plansLoading ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">Loading...</div>
          ) : !plans || plans.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-label text-sm text-on-surface-variant">No subscription plans created yet.</p>
              <Link href="/super-admin/subscriptions?tab=plans">
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Your First Plan
                </Button>
              </Link>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between px-4 py-3 group hover:bg-surface-container-low transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-label text-sm font-bold text-on-surface">{plan.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
                    {plan.priceMonthly != null ? (
                      <>&#8377;{plan.priceMonthly.toLocaleString('en-IN')}/mo</>
                    ) : (
                      'Custom pricing'
                    )}
                    {plan.priceYearly != null && (
                      <> &middot; &#8377;{plan.priceYearly.toLocaleString('en-IN')}/yr</>
                    )}
                    {plan.maxUsers != null && <> &middot; {plan.maxUsers} users</>}
                    {plan.maxUsers == null && <> &middot; Unlimited users</>}
                    {plan.maxHospitals != null && <> &middot; {plan.maxHospitals} hospital{plan.maxHospitals > 1 ? 's' : ''}</>}
                    {plan.maxHospitals == null && <> &middot; Unlimited hospitals</>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePlan(plan)}
                    disabled={updatePlan.isPending}
                    className="p-1.5 rounded hover:bg-surface-container-high transition-colors"
                    title={plan.isActive ? 'Deactivate plan' : 'Activate plan'}
                  >
                    {plan.isActive ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-on-surface-variant" />
                    )}
                  </button>
                  <Link href="/super-admin/subscriptions?tab=plans">
                    <button className="p-1.5 rounded hover:bg-surface-container-high transition-colors" title="Edit plan">
                      <Pencil className="h-4 w-4 text-on-surface-variant" />
                    </button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="border-b border-surface-container px-4 py-3">
          <h2 className="font-headline text-lg font-bold">Recent Hospitals</h2>
        </div>
        <div className="divide-y divide-surface-container/50">
          {tenantsLoading ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">Loading...</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">No hospitals onboarded yet</div>
          ) : (
            tenants.slice(0, 5).map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between px-4 py-3 group hover:bg-surface-container-low transition-colors">
                <div>
                  <p className="font-label text-sm font-bold text-on-surface">{tenant.name}</p>
                  <p className="font-label text-[10px] text-on-surface-variant">{tenant.slug} &middot; {tenant._count?.users ?? 0} users</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tenant.isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-error-container text-on-error-container'
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
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="border-b border-surface-container px-4 py-3">
          <h2 className="font-headline text-lg font-bold">Recent Support Tickets</h2>
        </div>
        <div className="divide-y divide-surface-container/50">
          {ticketsLoading ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">No support tickets</div>
          ) : (
            tickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between px-4 py-3 group hover:bg-surface-container-low transition-colors">
                <div>
                  <p className="font-label text-sm font-bold text-on-surface">{ticket.subject}</p>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    {ticket.priority} priority &middot; {formatDate(ticket.createdAt)}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ticket.status === 'open'
                      ? 'bg-secondary/10 text-secondary'
                      : ticket.status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : ticket.status === 'resolved' || ticket.status === 'closed'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-error-container text-on-error-container'
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
