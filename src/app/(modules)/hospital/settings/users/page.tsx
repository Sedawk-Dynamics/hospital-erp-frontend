'use client';

import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Pencil, UserX, UserCheck, Shield, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserFormDialog } from '@/components/hospital/user-form-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate } from '@/lib/date-utils';
import { useRouter } from 'next/navigation';
import {
  useUsersList,
  useRolesList,
  useUserStats,
  useCreateUser,
  useUpdateUser,
  type UserListItem,
} from '@/hooks/use-users';

export default function UserAccessConfigPage() {
  const router = useRouter();
  // ─── State ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserListItem | null;
    action: 'activate' | 'deactivate';
  }>({ open: false, user: null, action: 'deactivate' });

  const debouncedSearch = useDebounce(search, 400);

  // ─── Data ───────────────────────────────────────────────
  const { data: usersData, isLoading } = useUsersList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    roleId: roleFilter !== 'all' ? roleFilter : undefined,
    isActive: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: roles = [] } = useRolesList();
  const { data: stats } = useUserStats();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const users = usersData?.data || [];
  const meta = usersData?.meta;

  // ─── Handlers ───────────────────────────────────────────
  const handleCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: UserListItem) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password?: string;
    roleIds: string[];
  }) => {
    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          roleIds: data.roleIds,
        });
        toast.success('User updated successfully');
      } else {
        await createUser.mutateAsync({
          email: data.email,
          password: data.password!,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          roleIds: data.roleIds,
        });
        toast.success('User created successfully');
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    }
  };

  const handleToggleStatus = async () => {
    const { user, action } = confirmDialog;
    if (!user) return;
    try {
      await updateUser.mutateAsync({
        id: user.id,
        isActive: action === 'activate',
      });
      toast.success(`User ${action === 'activate' ? 'activated' : 'deactivated'} successfully`);
      setConfirmDialog({ open: false, user: null, action: 'deactivate' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/hospital/settings')} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
            <ArrowLeft className="h-5 w-5 text-on-surface-variant" />
          </button>
          <h1 className="font-headline text-xl font-bold">User Access Configuration</h1>
          {stats && (
            <Badge variant="secondary">
              {stats.activeCount} / {stats.maxUsers ?? '∞'} users
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={
            stats?.maxUsers !== null && stats !== undefined
              ? stats.activeCount >= stats.maxUsers!
              : false
          }
          className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={handleSearchChange}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>

        <Select
          value={roleFilter}
          onValueChange={(val) => {
            setRoleFilter(val ?? 'all');
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles
              .filter((r) => r.name !== 'super_admin')
              .map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <span className="capitalize">{role.name.replace(/_/g, ' ')}</span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val ?? 'all');
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">User</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Phone</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Roles</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">2FA</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Created</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 font-label text-on-surface-variant">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center font-label text-on-surface-variant">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="font-label text-sm font-bold">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="font-label text-[10px] text-on-surface-variant">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-label text-sm text-on-surface-variant">{user.phone || '-'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {user.userRoles.map((ur) => (
                          <span key={ur.role.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                            {ur.role.name.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user.isActive ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {user.is2faEnabled ? (
                        <Shield className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="font-label text-on-surface-variant">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-label text-[10px] text-on-surface-variant">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                user,
                                action: user.isActive ? 'deactivate' : 'activate',
                              })
                            }
                          >
                            {user.isActive ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <span className="font-label text-xs text-on-surface-variant">
              Showing {users.length} of {meta.total} users
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        roles={roles}
        isSubmitting={createUser.isPending || updateUser.isPending}
        onSubmit={handleFormSubmit}
      />

      {/* Confirm Deactivate/Activate Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
        title={`${confirmDialog.action === 'activate' ? 'Activate' : 'Deactivate'} User`}
        description={`Are you sure you want to ${confirmDialog.action} ${confirmDialog.user?.firstName} ${confirmDialog.user?.lastName}? ${
          confirmDialog.action === 'deactivate'
            ? 'They will no longer be able to log in.'
            : 'They will be able to log in again.'
        }`}
        confirmLabel={confirmDialog.action === 'activate' ? 'Activate' : 'Deactivate'}
        variant={confirmDialog.action === 'deactivate' ? 'destructive' : 'default'}
        isLoading={updateUser.isPending}
        onConfirm={handleToggleStatus}
      />
    </div>
  );
}
