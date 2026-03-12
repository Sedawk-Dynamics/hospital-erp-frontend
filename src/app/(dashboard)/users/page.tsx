'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { formatRoleName } from '@/lib/utils';
import type { User } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/users', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setUsers(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns: Column<User>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (user) => (
        <button
          onClick={() => router.push(`/users/${user.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {user.firstName} {user.lastName}
        </button>
      ),
    },
    {
      key: 'email',
      label: 'Email',
    },
    {
      key: 'phone',
      label: 'Phone',
    },
    {
      key: 'role',
      label: 'Role',
      render: (user) => (
        <Badge variant="secondary">
          {user.role?.name ? formatRoleName(user.role.name) : 'No role'}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (user) => (
        <StatusBadge status={user.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (user) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/users/${user.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users and their roles"
        action={
          <Button onClick={() => router.push('/users/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={users as any}
        searchPlaceholder="Search users by name or email..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No users found."
      />
    </div>
  );
}
