'use client';

import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Pencil, UserX, UserCheck, Shield } from 'lucide-react';
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
import {
  useUsersList,
  useRolesList,
  useUserStats,
  useCreateUser,
  useUpdateUser,
  type UserListItem,
} from '@/hooks/use-users';

export default function UserAccessConfigPage() {
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
          <h1 className="text-xl font-bold text-foreground">User Access Configuration</h1>
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
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 h-8"
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
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Roles</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">2FA</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="font-medium text-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user.phone || '-'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {user.userRoles.map((ur) => (
                          <Badge key={ur.role.id} variant="secondary" className="text-xs capitalize">
                            {ur.role.name.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={user.isActive ? 'default' : 'destructive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {user.is2faEnabled ? (
                        <Shield className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
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
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
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
