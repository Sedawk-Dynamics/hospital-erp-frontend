import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================
// Types — mirror backend compliance.audit_logs response shape
// ============================================================

export type AuditAction = 'create' | 'read' | 'update' | 'delete';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface AuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export const complianceKeys = {
  all: ['compliance'] as const,
  auditLogs: (params?: AuditLogsParams) =>
    ['compliance', 'audit-logs', params] as const,
};

/**
 * Hospital-wide audit log query — backed by `GET /compliance/audit-logs`.
 *
 * This surfaces every audited action across the hospital (lab actions,
 * billing, clinical, etc.). Distinct from `useInventoryAuditLogs`, which
 * hits the inventory-scoped `/inventory/reports/audit-logs` view.
 */
export function useAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: complianceKeys.auditLogs(params),
    queryFn: async () => {
      const response = await apiGet<AuditLogEntry[]>('/compliance/audit-logs', {
        params,
      });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}
