'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Save, Building2, Shield, Plus, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatRoleName } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
  code: string;
  headOfDepartment?: string;
  isActive: boolean;
  _count?: { wards: number };
}

interface RoleItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  permissions: { id: string; module: string; action: string }[];
  _count?: { users: number };
  createdAt: string;
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const tenant = user?.tenant;

  // General settings state
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);

  // Roles state
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Load tenant info
  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name || '');
      setOrgSlug(tenant.slug || '');
      setOrgEmail(tenant.email || '');
      setOrgPhone(tenant.phone || '');
      setOrgAddress(tenant.address || '');
    }
  }, [tenant]);

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    setDeptLoading(true);
    try {
      const { data } = await apiClient.get('/infrastructure/departments', {
        params: { limit: 100 },
      });
      setDepartments(data.data || []);
    } catch {
      // Silently fail - departments might not be set up yet
    } finally {
      setDeptLoading(false);
    }
  }, []);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const { data } = await apiClient.get('/roles', {
        params: { limit: 100 },
      });
      setRoles(data.data || []);
    } catch {
      // Silently fail
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchRoles();
  }, [fetchDepartments, fetchRoles]);

  // Save organization settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await apiClient.put(`/tenants/${tenant?.id}`, {
        name: orgName,
        email: orgEmail,
        phone: orgPhone,
        address: orgAddress,
      });
      toast.success('Organization settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Department columns
  const deptColumns: Column<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      sortable: true,
      render: (dept) => <span className="font-medium">{dept.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      render: (dept) => (
        <Badge variant="outline" className="font-mono text-xs">
          {dept.code}
        </Badge>
      ),
    },
    {
      key: 'headOfDepartment',
      label: 'Head of Department',
      render: (dept) => dept.headOfDepartment || '-',
    },
    {
      key: 'wards',
      label: 'Wards',
      render: (dept) => dept._count?.wards ?? 0,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (dept) => <StatusBadge status={dept.isActive ? 'active' : 'inactive'} />,
    },
  ];

  // Role columns
  const roleColumns: Column<RoleItem>[] = [
    {
      key: 'name',
      label: 'Role Name',
      sortable: true,
      render: (role) => (
        <div>
          <span className="font-medium">{formatRoleName(role.name)}</span>
          {role.isSystem && (
            <Badge variant="secondary" className="ml-2 text-xs">System</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (role) => (
        <span className="text-muted-foreground text-sm">
          {role.description || '-'}
        </span>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (role) => (
        <Badge variant="outline">{role.permissions?.length ?? 0} permissions</Badge>
      ),
    },
    {
      key: 'users',
      label: 'Users',
      render: (role) => role._count?.users ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your organization settings"
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>Update your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="City Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Organization Code</Label>
                  <Input id="orgSlug" value={orgSlug} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgEmail">Contact Email</Label>
                  <Input
                    id="orgEmail"
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    placeholder="info@hospital.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgPhone">Contact Phone</Label>
                  <Input
                    id="orgPhone"
                    type="tel"
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="orgAddress">Address</Label>
                  <Input
                    id="orgAddress"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    placeholder="123 Medical Drive, Healthcare City"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Departments
                </CardTitle>
                <CardDescription>Manage hospital departments</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => window.location.href = '/departments'}>
                <Plus className="h-4 w-4" />
                Manage Departments
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={deptColumns as any}
                data={departments as any}
                isLoading={deptLoading}
                emptyMessage="No departments configured yet."
                page={1}
                totalPages={1}
                total={departments.length}
                onPageChange={() => {}}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Roles & Permissions
                </CardTitle>
                <CardDescription>Manage roles and access permissions</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => window.location.href = '/users'}>
                <Plus className="h-4 w-4" />
                Manage Users
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={roleColumns as any}
                data={roles as any}
                isLoading={rolesLoading}
                emptyMessage="No roles configured yet."
                page={1}
                totalPages={1}
                total={roles.length}
                onPageChange={() => {}}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
