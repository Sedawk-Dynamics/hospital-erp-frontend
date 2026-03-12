import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  is2faEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  userRoles: Array<{ role: { id: string; name: string } }>;
}

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  _count: { userRoles: number; rolePermissions: number };
}

export interface UserStats {
  activeCount: number;
  totalCount: number;
  maxUsers: number | null;
}

interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  isActive?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================
// Query Keys
// ============================================================

export const userKeys = {
  all: ['users'] as const,
  list: (params?: UserListParams) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  roles: ['users', 'roles'] as const,
  stats: ['users', 'stats'] as const,
};

// ============================================================
// Query Hooks
// ============================================================

export function useUsersList(params?: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const response = await apiGet<UserListItem[]>('/users', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await apiGet<UserListItem>(`/users/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useRolesList() {
  return useQuery({
    queryKey: userKeys.roles,
    queryFn: async () => {
      const response = await apiGet<RoleOption[]>('/roles');
      return response.data;
    },
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: userKeys.stats,
    queryFn: async () => {
      const response = await apiGet<UserStats>('/users/stats');
      return response.data;
    },
  });
}

// ============================================================
// Mutation Hooks
// ============================================================

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      roleIds: string[];
    }) => {
      const response = await apiPost<UserListItem>('/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      isActive?: boolean;
      roleIds?: string[];
    }) => {
      const response = await apiPut<UserListItem>(`/users/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete<UserListItem>(`/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
