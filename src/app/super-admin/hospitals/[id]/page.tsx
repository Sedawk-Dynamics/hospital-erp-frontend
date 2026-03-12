'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTenant, useTenantRoles } from '@/hooks/use-super-admin';
import { HospitalUsersTab } from '@/components/super-admin/hospital-users-tab';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function HospitalDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant(id);
  const { data: roles = [] } = useTenantRoles(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Hospital not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/super-admin/hospitals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{tenant.name}</h1>
            <Badge variant={tenant.isActive ? 'default' : 'destructive'}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users ({tenant._count?.users ?? 0})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="rounded-lg border bg-card p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Hospital Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{tenant.email || 'No email set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{tenant.phone || 'No phone set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[tenant.address, tenant.city, tenant.state, tenant.country]
                        .filter(Boolean)
                        .join(', ') || 'No address set'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-foreground">{tenant._count?.users ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-foreground">{roles.length}</p>
                    <p className="text-xs text-muted-foreground">Roles</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-foreground">
                      {tenant.featureToggles?.filter((f) => f.isEnabled).length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Features</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-foreground">
                      {tenant.tenantSubscriptions?.find((s) => s.status === 'active')
                        ? 'Active'
                        : 'None'}
                    </p>
                    <p className="text-xs text-muted-foreground">Subscription</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <HospitalUsersTab tenantId={id} />
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Users</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-medium capitalize">{role.name.replace(/_/g, ' ')}</span>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={role.isSystemRole ? 'secondary' : 'outline'}>
                        {role.isSystemRole ? 'System' : 'Custom'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{role._count.userRoles}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{role._count.rolePermissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="rounded-lg border bg-card p-6">
            {tenant.tenantSubscriptions && tenant.tenantSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {tenant.tenantSubscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                          {sub.status}
                        </Badge>
                        <span className="text-sm capitalize text-muted-foreground">
                          {sub.billingCycle} billing
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(sub.startDate).toLocaleDateString()} — {new Date(sub.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No subscription found</p>
            )}
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenant.featureToggles?.map((ft) => (
                  <tr key={ft.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 capitalize font-medium">
                      {ft.featureKey.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={ft.isEnabled ? 'default' : 'secondary'}>
                        {ft.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
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
