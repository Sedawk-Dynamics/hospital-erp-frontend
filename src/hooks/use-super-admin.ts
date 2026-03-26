import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
  userSubscription?: UserSubscription | null;
  featureToggles?: FeatureToggle[];
}

export interface SubscriptionPurchaser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SubscriptionPaymentInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  user: SubscriptionPurchaser;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  startDate: string;
  endDate: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired';
  createdAt: string;
  plan?: {
    id: string;
    name: string;
    priceMonthly: number | null;
    priceYearly: number | null;
    maxUsers: number | null;
    maxHospitals: number | null;
  };
  subscriptionPayments?: SubscriptionPaymentInfo[];
}

export interface FeatureToggle {
  id: string;
  tenantId: string;
  featureKey: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  createdBy: string;
  subject: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  is2faEnabled?: boolean;
  tenantId?: string;
  tenant?: { id: string; name: string; slug: string };
  createdAt: string;
  updatedAt: string;
  userRoles: Array<{ role: { id: string; name: string } }>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// Query Keys
// ============================================================

export interface SubscriptionPlanAdmin {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
  maxHospitals: number | null;
  features: Record<string, boolean> | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const superAdminKeys = {
  tenants: {
    all: ['super-admin', 'tenants'] as const,
    list: (params?: PaginatedParams) => ['super-admin', 'tenants', 'list', params] as const,
    detail: (id: string) => ['super-admin', 'tenants', 'detail', id] as const,
  },
  users: {
    all: ['super-admin', 'users'] as const,
    list: (params?: PaginatedParams) => ['super-admin', 'users', 'list', params] as const,
    detail: (id: string) => ['super-admin', 'users', 'detail', id] as const,
  },
  tickets: {
    all: ['super-admin', 'tickets'] as const,
    list: (params?: Record<string, unknown>) => ['super-admin', 'tickets', 'list', params] as const,
    detail: (id: string) => ['super-admin', 'tickets', 'detail', id] as const,
  },
  plans: {
    all: ['super-admin', 'plans'] as const,
  },
  stats: ['super-admin', 'stats'] as const,
};

// ============================================================
// Tenant Hooks
// ============================================================

export function useTenants(params?: PaginatedParams) {
  return useQuery({
    queryKey: superAdminKeys.tenants.list(params),
    queryFn: async () => {
      const response = await apiGet<Tenant[]>('/tenants', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: superAdminKeys.tenants.detail(id),
    queryFn: async () => {
      const response = await apiGet<Tenant>(`/tenants/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
    }) => {
      const response = await apiPost<Tenant>('/tenants', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Omit<Tenant, 'id'>>) => {
      const response = await apiPut<Tenant>(`/tenants/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.detail(variables.id) });
    },
  });
}

export function useDeactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete<Tenant>(`/tenants/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

export function useActivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<Tenant>(`/tenants/${id}/activate`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.detail(id) });
    },
  });
}

export function useHardDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/tenants/${id}/destroy`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users.all });
    },
  });
}

export function useHardDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/users/all/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiPatch(`/users/all/${id}`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

// ============================================================
// Subscription Hooks
// ============================================================

// ============================================================
// Feature Toggle Hooks
// ============================================================

export function useUpdateFeatureToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      featureKey,
      enabled,
      config,
    }: {
      tenantId: string;
      featureKey: string;
      enabled: boolean;
      config?: Record<string, unknown>;
    }) => {
      const response = await apiPut<FeatureToggle>(`/tenants/${tenantId}/features`, {
        featureKey,
        enabled,
        config,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

// ============================================================
// Support Ticket Hooks
// ============================================================

interface TicketParams extends PaginatedParams {
  status?: string;
  priority?: string;
}

export function useSupportTickets(params?: TicketParams) {
  return useQuery({
    queryKey: superAdminKeys.tickets.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<SupportTicket[]>('/reports/support-tickets', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: superAdminKeys.tickets.detail(id),
    queryFn: async () => {
      const response = await apiGet<SupportTicket>(`/reports/support-tickets/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; priority?: string }) => {
      const response = await apiPut<SupportTicket>(`/reports/support-tickets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tickets.all });
    },
  });
}

export function useCloseTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolutionNotes }: { id: string; resolutionNotes: string }) => {
      const response = await apiPatch<SupportTicket>(`/reports/support-tickets/${id}/close`, {
        resolutionNotes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tickets.all });
    },
  });
}

// ============================================================
// Platform Users (cross-tenant)
// ============================================================

export function usePlatformUsers(params?: PaginatedParams) {
  return useQuery({
    queryKey: superAdminKeys.users.list(params),
    queryFn: async () => {
      const response = await apiGet<PlatformUser[]>('/users/all', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

// ============================================================
// Bootstrap Roles
// ============================================================

export function useBootstrapRoles() {
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiPost(`/tenants/${tenantId}/bootstrap-roles`);
      return response.data;
    },
  });
}

// ============================================================
// Tenant-Scoped User Management (Super Admin)
// ============================================================

export interface TenantRole {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  _count: { userRoles: number; rolePermissions: number };
}

export interface TenantUserStats {
  activeCount: number;
  totalCount: number;
  maxUsers: number | null;
}

interface TenantUserParams extends PaginatedParams {
  roleId?: string;
  isActive?: string;
}

// ============================================================
// Tenant Comprehensive Stats
// ============================================================

export interface TenantComprehensiveStats {
  patients: { total: number; todayNew: number; activeAdmissions: number };
  appointments: { total: number; today: number; completed: number; pending: number; cancelled: number };
  billing: { totalBills: number; pendingBills: number; todayRevenue: number; totalRevenue: number };
  infrastructure: {
    departments: number;
    wards: number;
    beds: { total: number; occupied: number; available: number };
    operatingTheaters: number;
  };
  staff: { totalUsers: number; doctors: number; staff: number };
  lab: { totalOrders: number; pending: number };
  pharmacy: { totalDrugs: number; lowStock: number };
  insurance: { totalClaims: number; pending: number };
  departmentList: Array<{ id: string; name: string; _count: { doctorProfiles: number; wards: number } }>;
}

export function useTenantStats(tenantId: string) {
  return useQuery({
    queryKey: ['super-admin', 'tenant-stats', tenantId],
    queryFn: async () => {
      const response = await apiGet<TenantComprehensiveStats>(`/tenants/${tenantId}/stats`);
      return response.data;
    },
    enabled: !!tenantId,
  });
}

export const tenantUserKeys = {
  users: (tenantId: string, params?: TenantUserParams) =>
    ['super-admin', 'tenant-users', tenantId, params] as const,
  roles: (tenantId: string) =>
    ['super-admin', 'tenant-roles', tenantId] as const,
  stats: (tenantId: string) =>
    ['super-admin', 'tenant-user-stats', tenantId] as const,
};

export function useTenantUsers(tenantId: string, params?: TenantUserParams) {
  return useQuery({
    queryKey: tenantUserKeys.users(tenantId, params),
    queryFn: async () => {
      const response = await apiGet<PlatformUser[]>(`/tenants/${tenantId}/users`, { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
    enabled: !!tenantId,
  });
}

export function useTenantRoles(tenantId: string) {
  return useQuery({
    queryKey: tenantUserKeys.roles(tenantId),
    queryFn: async () => {
      const response = await apiGet<TenantRole[]>(`/tenants/${tenantId}/roles`);
      return response.data;
    },
    enabled: !!tenantId,
  });
}

export function useTenantUserStats(tenantId: string) {
  return useQuery({
    queryKey: tenantUserKeys.stats(tenantId),
    queryFn: async () => {
      const response = await apiGet<TenantUserStats>(`/tenants/${tenantId}/users/stats`);
      return response.data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateTenantUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      ...data
    }: {
      tenantId: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      roleIds: string[];
    }) => {
      const response = await apiPost<PlatformUser>(`/tenants/${tenantId}/users`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['super-admin', 'tenant-users', variables.tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ['super-admin', 'tenant-user-stats', variables.tenantId],
      });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
    },
  });
}

// ============================================================
// Subscription Plan Management (Super Admin)
// ============================================================

/** Fetch all plans including inactive ones */
export function useAllPlans() {
  return useQuery({
    queryKey: superAdminKeys.plans.all,
    queryFn: async () => {
      const response = await apiGet<SubscriptionPlanAdmin[]>('/subscription-plans/all');
      return response.data;
    },
  });
}

/** Create a new subscription plan */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      priceMonthly?: number;
      priceYearly?: number;
      maxUsers?: number;
      maxHospitals?: number;
      features?: Record<string, boolean>;
      isActive?: boolean;
    }) => {
      const response = await apiPost<SubscriptionPlanAdmin>('/subscription-plans/plans', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.plans.all });
    },
  });
}

/** Update an existing subscription plan */
export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      priceMonthly?: number | null;
      priceYearly?: number | null;
      maxUsers?: number | null;
      maxHospitals?: number | null;
      features?: Record<string, boolean>;
      isActive?: boolean;
    }) => {
      const response = await apiPut<SubscriptionPlanAdmin>(`/subscription-plans/plans/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.plans.all });
    },
  });
}

export interface AdminSubscription {
  id: string;
  plan: { id: string; name: string; priceMonthly: number | null; priceYearly: number | null };
  status: 'active' | 'expired' | 'cancelled';
  billingCycle: 'monthly' | 'yearly' | null;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  subscriptionPaymentMethod: 'manual' | 'autopay';
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  hospitals: { id: string; name: string; slug: string }[];
  isDemoTrial: boolean;
}

/** Super admin: list all subscriptions */
export function useAllSubscriptions() {
  return useQuery({
    queryKey: ['super-admin', 'all-subscriptions'] as const,
    queryFn: async () => {
      const response = await apiGet<AdminSubscription[]>('/subscription-plans/admin/all-subscriptions');
      return response.data;
    },
  });
}

export interface PlanAssignment {
  userId: string;
  userName: string;
  email: string;
  plans: { id: string; name: string }[];
  assignedAt: string;
}

/** Super admin: list all plan assignments */
export function usePlanAssignments() {
  return useQuery({
    queryKey: ['super-admin', 'plan-assignments'] as const,
    queryFn: async () => {
      const response = await apiGet<PlanAssignment[]>('/subscription-plans/admin/plan-assignments');
      return response.data;
    },
  });
}

/** Super admin: offer plans to a user */
export function useAdminAssignPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      planIds: string[];
    }) => {
      const response = await apiPost('/subscription-plans/admin/assign-plan', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.tenants.all });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users.all });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plan-assignments'] });
    },
  });
}
