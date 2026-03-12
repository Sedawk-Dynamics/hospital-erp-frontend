'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { usePlatformUsers, useTenants, type PlatformUser } from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';

export default function UsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = usePlatformUsers({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  // Fetch tenants to map tenantId → hospital name
  const { data: tenantsData } = useTenants({ limit: 100 });
  const tenantMap = useMemo(() => {
    const map = new Map<string, string>();
    tenantsData?.data?.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tenantsData]);

  const columns: Column<PlatformUser>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.firstName} {item.lastName}</p>
          <p className="text-xs text-muted-foreground">{item.email}</p>
        </div>
      ),
    },
    {
      key: 'hospital',
      label: 'Hospital',
      render: (item) => {
        const name = item.tenantId ? tenantMap.get(item.tenantId) : null;
        return name ? (
          <span
            className="text-primary hover:underline cursor-pointer"
            onClick={() => router.push(`/super-admin/hospitals/${item.tenantId}`)}
          >
            {name}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
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
            <Badge key={ur.role.id} variant="secondary" className="text-xs capitalize">
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
        <Badge variant={item.isActive ? 'default' : 'destructive'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">All users across the platform</p>
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        searchPlaceholder="Search users..."
        onSearch={setSearch}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No users found."
      />
    </div>
  );
}
