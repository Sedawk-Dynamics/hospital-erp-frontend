'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, CreditCard, User, Calendar,
  Package, Trash2, Power, Users, Stethoscope, BedDouble, FlaskConical,
  Pill, ShieldCheck, Receipt, Activity, BarChart3, Layers, Globe, Hash,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  useTenant, useTenantRoles, useDeactivateTenant, useActivateTenant,
  useHardDeleteTenant, useTenantStats,
} from '@/hooks/use-super-admin';
import { HospitalUsersTab } from '@/components/super-admin/hospital-users-tab';
import { formatDate } from '@/lib/date-utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

function StatCard({ label, value, icon: Icon, color = 'text-primary', sub }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sanctuary border-l-4 border-primary">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">{label}</span>
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
      </div>
      <p className="font-headline text-2xl font-extrabold">{value}</p>
      {sub && <p className="font-label text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  );
}

export default function HospitalDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant(id);
  const { data: roles = [] } = useTenantRoles(id);
  const { data: stats, isLoading: statsLoading } = useTenantStats(id);

  const deactivateTenant = useDeactivateTenant();
  const activateTenant = useActivateTenant();
  const hardDeleteTenant = useHardDeleteTenant();

  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleDeactivate = async () => {
    try {
      await deactivateTenant.mutateAsync(id);
      toast.success('Hospital deactivated');
      setShowDeactivate(false);
    } catch { toast.error('Failed to deactivate hospital'); }
  };

  const handleActivate = async () => {
    try {
      await activateTenant.mutateAsync(id);
      toast.success('Hospital activated');
    } catch { toast.error('Failed to activate hospital'); }
  };

  const handleDelete = async () => {
    try {
      await hardDeleteTenant.mutateAsync(id);
      toast.success('Hospital permanently deleted');
      router.push('/super-admin/hospitals');
    } catch { toast.error('Failed to delete hospital'); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return <div className="py-20 text-center font-label text-on-surface-variant">Hospital not found</div>;
  }

  const activeSub = tenant.userSubscription?.status === 'active' ? tenant.userSubscription : null;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const fmtCurrency = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/super-admin/hospitals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-xl font-bold">{tenant.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tenant.isActive ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </span>
            {activeSub && (
              <Badge className="bg-purple-500/10 text-purple-600 border-0 text-[10px] font-bold">
                {activeSub.plan?.name}
              </Badge>
            )}
          </div>
          <p className="font-label text-sm text-on-surface-variant">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {tenant.isActive ? (
            <Button variant="outline" size="sm" onClick={() => setShowDeactivate(true)}>
              <Power className="mr-1.5 h-3.5 w-3.5" /> Deactivate
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleActivate} disabled={activateTenant.isPending}>
              <Power className="mr-1.5 h-3.5 w-3.5" /> Activate
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog open={showDeactivate} onOpenChange={setShowDeactivate} title="Deactivate Hospital"
        description={`Are you sure you want to deactivate "${tenant.name}"? Users will not be able to access this hospital.`}
        confirmLabel="Deactivate" isLoading={deactivateTenant.isPending} onConfirm={handleDeactivate} />
      <ConfirmDialog open={showDelete} onOpenChange={setShowDelete} title="Permanently Delete Hospital"
        description={`This will permanently delete "${tenant.name}" and ALL its data. This action cannot be undone.`}
        confirmText={tenant.name} confirmLabel="Delete Forever" isLoading={hardDeleteTenant.isPending} onConfirm={handleDelete} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="users">Users ({tenant._count?.users ?? 0})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {/* -- Overview Tab -- */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Hospital Info + Owner Subscription side by side */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Hospital Info */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4">
                <h3 className="font-headline text-base font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Hospital Information
                </h3>
                <div className="space-y-3 font-label text-sm">
                  {[
                    { icon: Mail, value: tenant.email, fallback: 'No email' },
                    { icon: Phone, value: tenant.phone, fallback: 'No phone' },
                    { icon: MapPin, value: [tenant.address, tenant.city, tenant.state, tenant.country].filter(Boolean).join(', '), fallback: 'No address' },
                    { icon: Globe, value: (tenant as any).website, fallback: null },
                    { icon: Hash, value: (tenant as any).hospitalCode ? `Code: ${(tenant as any).hospitalCode}` : null, fallback: null },
                  ].filter(({ value, fallback }) => value || fallback).map(({ icon: Icon, value, fallback }, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <span className={value ? 'text-on-surface' : 'text-on-surface-variant'}>{value || fallback}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-surface-container font-label text-[10px] text-on-surface-variant">
                  Created {formatDate(tenant.createdAt)}
                  {(tenant as any).onboardedAt && <> &middot; Onboarded {formatDate((tenant as any).onboardedAt)}</>}
                </div>
              </div>

              {/* Owner's Subscription */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4">
                <h3 className="font-headline text-base font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Owner&apos;s Subscription
                </h3>
                {activeSub ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-headline text-lg font-bold">{activeSub.plan?.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeSub.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                        {activeSub.status}
                      </span>
                    </div>
                    {activeSub.plan?.priceMonthly != null && (
                      <p className="font-label text-xs text-on-surface-variant">
                        Rs {Number(activeSub.plan.priceMonthly).toLocaleString()}/mo
                        {activeSub.plan.priceYearly != null && <> &middot; Rs {Number(activeSub.plan.priceYearly).toLocaleString()}/yr</>}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-container-low rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-0.5"><CreditCard className="h-3 w-3 text-on-surface-variant" /><span className="font-label text-[9px] text-on-surface-variant uppercase">Billing</span></div>
                        <p className="font-label text-xs font-bold capitalize">{activeSub.billingCycle || '-'}</p>
                      </div>
                      <div className="bg-surface-container-low rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-0.5"><Clock className="h-3 w-3 text-on-surface-variant" /><span className="font-label text-[9px] text-on-surface-variant uppercase">Expires</span></div>
                        <p className="font-label text-xs font-bold">{activeSub.endDate ? formatDate(activeSub.endDate) : 'No end'}</p>
                      </div>
                    </div>
                    {activeSub.plan?.maxUsers != null && (
                      <p className="font-label text-[10px] text-on-surface-variant">
                        {activeSub.plan.maxUsers} users &middot; {activeSub.plan.maxHospitals ?? 'Unlimited'} hospitals
                      </p>
                    )}
                    <p className="font-label text-[10px] text-on-surface-variant pt-2 border-t border-surface-container">
                      Subscription owned by the admin user. <Link href="/super-admin/subscriptions" className="text-primary hover:underline">Manage</Link>
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Package className="h-8 w-8 text-on-surface-variant/30 mx-auto mb-2" />
                    <p className="font-label text-sm text-on-surface-variant">No active subscription</p>
                    <p className="font-label text-[10px] text-on-surface-variant mt-1">
                      <Link href="/super-admin/subscriptions" className="text-primary hover:underline">Offer a plan</Link> to the hospital owner
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Users" value={tenant._count?.users ?? 0} icon={Users} />
              <StatCard label="Roles" value={roles.length} icon={ShieldCheck} />
              <StatCard label="Active Features" value={tenant.featureToggles?.filter((f: any) => f.isEnabled).length ?? 0} icon={Activity} />
              <StatCard label="Departments" value={stats?.infrastructure?.departments ?? 0} icon={Building2} />
            </div>
          </div>
        </TabsContent>

        {/* -- Stats Tab -- */}
        <TabsContent value="stats">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Patients & Appointments</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <StatCard label="Total Patients" value={fmt(stats.patients.total)} icon={Users} />
                  <StatCard label="New Today" value={fmt(stats.patients.todayNew)} icon={User} color="text-emerald-600" />
                  <StatCard label="Active Admissions" value={fmt(stats.patients.activeAdmissions)} icon={BedDouble} color="text-blue-600" />
                  <StatCard label="Today Appts" value={fmt(stats.appointments.today)} icon={Calendar} color="text-violet-600" />
                  <StatCard label="Total Appts" value={fmt(stats.appointments.total)} icon={Calendar} sub={`${fmt(stats.appointments.completed)} done · ${fmt(stats.appointments.pending)} pending`} />
                </div>
              </div>
              <div>
                <h3 className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Billing & Revenue</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Total Revenue" value={fmtCurrency(stats.billing.totalRevenue)} icon={Receipt} color="text-emerald-600" />
                  <StatCard label="Today Revenue" value={fmtCurrency(stats.billing.todayRevenue)} icon={Activity} color="text-blue-600" />
                  <StatCard label="Total Bills" value={fmt(stats.billing.totalBills)} icon={Receipt} />
                  <StatCard label="Pending Bills" value={fmt(stats.billing.pendingBills)} icon={Receipt} color="text-amber-600" />
                </div>
              </div>
              <div>
                <h3 className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Infrastructure</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="Departments" value={fmt(stats.infrastructure.departments)} icon={Building2} />
                  <StatCard label="Wards" value={fmt(stats.infrastructure.wards)} icon={Layers} />
                  <StatCard label="Total Beds" value={fmt(stats.infrastructure.beds.total)} icon={BedDouble} sub={`${fmt(stats.infrastructure.beds.occupied)} occupied · ${fmt(stats.infrastructure.beds.available)} available`} />
                  <StatCard label="OT Rooms" value={fmt(stats.infrastructure.operatingTheaters)} icon={Activity} color="text-rose-600" />
                  <StatCard label="Staff" value={fmt(stats.staff.totalUsers)} icon={Users} sub={`${fmt(stats.staff.doctors)} doctors`} />
                </div>
              </div>
              <div>
                <h3 className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Lab, Pharmacy & Insurance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Lab Orders" value={fmt(stats.lab.totalOrders)} icon={FlaskConical} color="text-orange-600" sub={`${fmt(stats.lab.pending)} pending`} />
                  <StatCard label="Drugs" value={fmt(stats.pharmacy.totalDrugs)} icon={Pill} color="text-green-600" sub={stats.pharmacy.lowStock > 0 ? `${fmt(stats.pharmacy.lowStock)} low stock` : 'Stock OK'} />
                  <StatCard label="Insurance Claims" value={fmt(stats.insurance.totalClaims)} icon={ShieldCheck} color="text-indigo-600" sub={`${fmt(stats.insurance.pending)} pending`} />
                  <StatCard label="Doctors" value={fmt(stats.staff.doctors)} icon={Stethoscope} color="text-teal-600" />
                </div>
              </div>
              {stats.departmentList && stats.departmentList.length > 0 && (
                <div>
                  <h3 className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">Departments</h3>
                  <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                          <th className="px-4 pb-3 pt-4 font-semibold text-left">Department</th>
                          <th className="px-4 pb-3 pt-4 font-semibold text-left">Doctors</th>
                          <th className="px-4 pb-3 pt-4 font-semibold text-left">Wards</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container/50">
                        {stats.departmentList.map((dept: any) => (
                          <tr key={dept.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-4 py-2.5 font-label text-sm font-bold">{dept.name}</td>
                            <td className="px-4 py-2.5 font-label text-sm text-on-surface-variant">{dept._count.doctorProfiles}</td>
                            <td className="px-4 py-2.5 font-label text-sm text-on-surface-variant">{dept._count.wards}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center">
              <BarChart3 className="h-8 w-8 text-on-surface-variant mx-auto mb-2" />
              <p className="font-label text-on-surface-variant">No statistics available</p>
            </div>
          )}
        </TabsContent>

        {/* -- Users Tab -- */}
        <TabsContent value="users">
          <HospitalUsersTab tenantId={id} />
        </TabsContent>

        {/* -- Roles Tab -- */}
        <TabsContent value="roles">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Role</th>
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Type</th>
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Users</th>
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {roles.map((role: any) => (
                  <tr key={role.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-label text-sm font-bold capitalize">{role.name.replace(/_/g, ' ')}</span>
                      {role.description && <p className="font-label text-[10px] text-on-surface-variant">{role.description}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.isSystemRole ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {role.isSystemRole ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-label text-sm text-on-surface-variant">{role._count.userRoles}</td>
                    <td className="px-4 py-2.5 font-label text-sm text-on-surface-variant">{role._count.rolePermissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* -- Features Tab -- */}
        <TabsContent value="features">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Feature</th>
                  <th className="px-4 pb-3 pt-4 font-semibold text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {tenant.featureToggles?.map((ft: any) => (
                  <tr key={ft.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-2.5 capitalize font-label text-sm font-bold">{ft.featureKey.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ft.isEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {ft.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
