'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Power, Trash2, Filter, Users, UserCheck, UserX, Shield, Eye,
  Mail, Phone, Building2, Calendar, ShieldCheck, Key,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePlatformUsers, useHardDeleteUser, useToggleUserActive, type PlatformUser } from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { fullName } from '@/lib/person-name';

// Role color map for visual distinction
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-600',
  admin: 'bg-purple-500/10 text-purple-600',
  doctor: 'bg-blue-500/10 text-blue-600',
  nurse: 'bg-cyan-500/10 text-cyan-600',
  receptionist: 'bg-amber-500/10 text-amber-600',
  pharmacist: 'bg-green-500/10 text-green-600',
  lab_technician: 'bg-indigo-500/10 text-indigo-600',
  radiologist: 'bg-pink-500/10 text-pink-600',
  accountant: 'bg-orange-500/10 text-orange-600',
  cashier: 'bg-yellow-500/10 text-yellow-700',
  counsellor: 'bg-teal-500/10 text-teal-600',
  ward_manager: 'bg-violet-500/10 text-violet-600',
  ot_manager: 'bg-rose-500/10 text-rose-600',
  staff: 'bg-slate-500/10 text-slate-600',
};

function getRoleColor(roleName: string) {
  return ROLE_COLORS[roleName] || 'bg-secondary/10 text-secondary';
}

export default function UsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = usePlatformUsers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const hardDeleteUser = useHardDeleteUser();
  const toggleUserActive = useToggleUserActive();

  const [deleteTarget, setDeleteTarget] = useState<PlatformUser | null>(null);
  const [viewTarget, setViewTarget] = useState<PlatformUser | null>(null);

  // Extract unique roles from all loaded users for the filter dropdown
  const uniqueRoles = useMemo(() => {
    if (!data?.data) return [];
    const roleMap = new Map<string, string>();
    data.data.forEach((user) => {
      user.userRoles?.forEach((ur) => {
        if (!roleMap.has(ur.role.id)) {
          roleMap.set(ur.role.id, ur.role.name);
        }
      });
    });
    return Array.from(roleMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.data]);

  // Client-side filtering for status and role
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    let filtered = data.data;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) =>
        statusFilter === 'active' ? u.isActive : !u.isActive
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) =>
        u.userRoles?.some((ur) => ur.role.name === roleFilter)
      );
    }

    return filtered;
  }, [data?.data, statusFilter, roleFilter]);

  // Stats from current data
  const stats = useMemo(() => {
    const all = data?.data ?? [];
    const active = all.filter((u) => u.isActive).length;
    const inactive = all.length - active;
    const rolesCount = new Set(
      all.flatMap((u) => u.userRoles?.map((ur) => ur.role.name) ?? [])
    ).size;
    return { total: data?.meta?.total ?? 0, active, inactive, rolesCount };
  }, [data]);

  const handleToggleActive = async (user: PlatformUser) => {
    const newState = !user.isActive;
    try {
      await toggleUserActive.mutateAsync({ id: user.id, isActive: newState });
      toast.success(`${fullName(user)} ${newState ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error(`Failed to ${newState ? 'activate' : 'deactivate'} user`);
    }
  };

  const handleFilterChange = (type: 'status' | 'role', value: string) => {
    if (type === 'status') setStatusFilter(value);
    else setRoleFilter(value);
    setPage(1);
  };

  const columns: Column<PlatformUser>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-label text-sm font-bold">{item.firstName} {item.lastName}</p>
          <p className="font-label text-[10px] text-on-surface-variant">{item.email}</p>
        </div>
      ),
    },
    {
      key: 'hospital',
      label: 'Hospital',
      render: (item) => {
        const hospitals = (item as any).ownedHospitals as { id: string; name: string; slug: string }[] | undefined;
        const isPlatform = item.tenant?.slug === '__platform__';
        const isSuperAdmin = item.userRoles?.some((ur: any) => ur.role.name === 'super_admin');

        // Super admin shows "Platform (Super Admin)"
        if (isSuperAdmin && isPlatform) {
          return <span className="font-label text-xs text-on-surface-variant">Platform (Super Admin)</span>;
        }

        // Show owned hospitals if available
        if (hospitals && hospitals.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {hospitals.map((h) => (
                <span
                  key={h.id}
                  className="text-primary hover:underline cursor-pointer font-label text-xs"
                  onClick={() => router.push(`/super-admin/hospitals/${h.id}`)}
                >
                  {h.name}
                </span>
              ))}
            </div>
          );
        }

        // Fallback: show tenant name if not platform
        if (!isPlatform && item.tenant?.name) {
          return (
            <span
              className="text-primary hover:underline cursor-pointer"
              onClick={() => router.push(`/super-admin/hospitals/${item.tenantId}`)}
            >
              {item.tenant.name}
            </span>
          );
        }

        return <span className="font-label text-xs text-on-surface-variant">No hospital</span>;
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (item) => item.phone || '-',
    },
    {
      key: 'roles',
      label: 'Roles',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.userRoles?.map((ur) => (
            <Badge
              key={ur.role.id}
              variant="secondary"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${getRoleColor(ur.role.name)}`}
            >
              {ur.role.name.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (item) => formatDate(item.createdAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewTarget(item)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleActive(item)}
            disabled={toggleUserActive.isPending}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            {item.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTarget(item)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Users</h1>
        <p className="font-label text-sm text-on-surface-variant">All users across all hospitals</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Total Users</p>
            <p className="font-headline text-lg font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Active</p>
            <p className="font-headline text-lg font-bold text-green-600">{stats.active}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <UserX className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Inactive</p>
            <p className="font-headline text-lg font-bold text-red-500">{stats.inactive}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Roles</p>
            <p className="font-headline text-lg font-bold text-purple-600">{stats.rolesCount}</p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-on-surface-variant" />
          <span className="font-label text-xs text-on-surface-variant font-bold uppercase tracking-wider">Filters</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="bg-surface-container-low border-none rounded-lg px-3 py-2 font-label text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => handleFilterChange('role', e.target.value)}
          className="bg-surface-container-low border-none rounded-lg px-3 py-2 font-label text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
        >
          <option value="all">All Roles</option>
          {uniqueRoles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.name.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Active filter tags */}
        {(statusFilter !== 'all' || roleFilter !== 'all') && (
          <div className="flex items-center gap-2">
            {statusFilter !== 'all' && (
              <Badge
                variant="secondary"
                className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => handleFilterChange('status', 'all')}
              >
                Status: {statusFilter} &times;
              </Badge>
            )}
            {roleFilter !== 'all' && (
              <Badge
                variant="secondary"
                className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getRoleColor(roleFilter)}`}
                onClick={() => handleFilterChange('role', 'all')}
              >
                Role: {roleFilter.replace(/_/g, ' ')} &times;
              </Badge>
            )}
            <button
              onClick={() => { setStatusFilter('all'); setRoleFilter('all'); }}
              className="font-label text-[10px] text-on-surface-variant hover:text-on-surface transition-colors underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(filteredData ?? []) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        searchPlaceholder="Search by name or email..."
        onSearch={setSearch}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No users found."
      />

      {/* View user details dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {viewTarget && (() => {
            const ownedHospitals = (viewTarget as any).ownedHospitals as { id: string; name: string; slug: string }[] | undefined;
            const isSuperAdmin = viewTarget.userRoles?.some((ur) => ur.role.name === 'super_admin');

            return (
              <div className="space-y-5">
                {/* Name & Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline text-lg font-bold">{viewTarget.firstName} {viewTarget.lastName}</h3>
                    <p className="font-label text-xs text-on-surface-variant">ID: {viewTarget.id}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${viewTarget.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
                    {viewTarget.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
                  <h4 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <span className="font-label text-sm">{viewTarget.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <span className="font-label text-sm">{viewTarget.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Roles */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
                  <h4 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Roles</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {viewTarget.userRoles?.length ? viewTarget.userRoles.map((ur) => (
                      <Badge
                        key={ur.role.id}
                        variant="secondary"
                        className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${getRoleColor(ur.role.name)}`}
                      >
                        {ur.role.name.replace(/_/g, ' ')}
                      </Badge>
                    )) : (
                      <span className="font-label text-sm text-on-surface-variant">No roles assigned</span>
                    )}
                  </div>
                </div>

                {/* Hospital / Tenant */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
                  <h4 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Hospital</h4>
                  {isSuperAdmin && viewTarget.tenant?.slug === '__platform__' ? (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-red-500" />
                      <span className="font-label text-sm font-bold text-red-600">Platform (Super Admin)</span>
                    </div>
                  ) : ownedHospitals && ownedHospitals.length > 0 ? (
                    <div className="space-y-2">
                      {ownedHospitals.map((h) => (
                        <div key={h.id} className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span
                            className="font-label text-sm text-primary font-bold hover:underline cursor-pointer"
                            onClick={() => { setViewTarget(null); router.push(`/super-admin/hospitals/${h.id}`); }}
                          >
                            {h.name}
                          </span>
                          <span className="font-label text-[10px] text-on-surface-variant font-mono">({h.slug})</span>
                        </div>
                      ))}
                    </div>
                  ) : viewTarget.tenant && viewTarget.tenant.slug !== '__platform__' ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span
                        className="font-label text-sm text-primary font-bold hover:underline cursor-pointer"
                        onClick={() => { setViewTarget(null); router.push(`/super-admin/hospitals/${viewTarget.tenantId}`); }}
                      >
                        {viewTarget.tenant.name}
                      </span>
                    </div>
                  ) : (
                    <span className="font-label text-sm text-on-surface-variant">No hospital assigned</span>
                  )}
                </div>

                {/* Security */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
                  <h4 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Security</h4>
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-on-surface-variant shrink-0" />
                    <span className="font-label text-sm">
                      Two-Factor Authentication:{' '}
                      <span className={`font-bold ${viewTarget.is2faEnabled ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {viewTarget.is2faEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
                  <h4 className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Timestamps</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <div>
                        <p className="font-label text-[10px] text-on-surface-variant">Created</p>
                        <p className="font-label text-sm font-bold">{formatDateTime(viewTarget.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-on-surface-variant shrink-0" />
                      <div>
                        <p className="font-label text-[10px] text-on-surface-variant">Updated</p>
                        <p className="font-label text-sm font-bold">{formatDateTime(viewTarget.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setViewTarget(null)}>Close</Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { handleToggleActive(viewTarget); setViewTarget(null); }}
                    disabled={toggleUserActive.isPending}
                  >
                    <Power className="mr-1.5 h-3.5 w-3.5" />
                    {viewTarget.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => { setViewTarget(null); setDeleteTarget(viewTarget); }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Permanently Delete User"
        description={`This will permanently delete "${deleteTarget ? fullName(deleteTarget) : ''}" and all their associated data. This action cannot be undone.`}
        confirmLabel="Delete User"
        isLoading={hardDeleteUser.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await hardDeleteUser.mutateAsync(deleteTarget.id);
            toast.success(`${fullName(deleteTarget)} has been deleted`);
            setDeleteTarget(null);
          } catch {
            toast.error('Failed to delete user');
          }
        }}
      />
    </div>
  );
}
