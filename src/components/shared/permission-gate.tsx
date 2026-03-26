'use client';

import type { ReactNode } from 'react';
import { usePermissions, type PermissionAction } from '@/hooks/use-permissions';

// ---------------------------------------------------------------------------
// PermissionGate — show children only if user can perform action on module
// ---------------------------------------------------------------------------

interface PermissionGateProps {
  /** Permission module (e.g. 'billing', 'patients', 'lab_orders') */
  module: string;
  /** Permission action */
  action: PermissionAction;
  /** Content to render when the user has permission */
  children: ReactNode;
  /** Optional fallback when permission is denied (defaults to nothing) */
  fallback?: ReactNode;
}

export function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { canAccess } = usePermissions();

  if (!canAccess(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// RoleGate — show children only if user holds one of the listed roles
// ---------------------------------------------------------------------------

interface RoleGateProps {
  /** One or more role slugs (e.g. ['admin', 'doctor']) */
  roles: string[];
  /** Content to render when the user has a matching role */
  children: ReactNode;
  /** Optional fallback when role check fails (defaults to nothing) */
  fallback?: ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { hasAnyRole } = usePermissions();

  if (!hasAnyRole(...roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
