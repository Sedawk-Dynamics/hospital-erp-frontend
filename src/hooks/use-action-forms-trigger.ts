'use client';

import { useState, useCallback } from 'react';
import type { FormTrigger } from '@/types/forms';

// ─────────────────────────────────────────────────────────
// Lightweight state container for "after-action" form prompts.
// Use this when you want to fire the IntakeFormsModal after a
// specific user action (e.g. after a Check-In API call succeeds).
//
//   const formsAfter = useActionFormsTrigger();
//
//   // After action succeeds:
//   formsAfter.fire('visit_check_in', tenantId, { appointmentId, patientId });
//
//   // Then render somewhere:
//   <IntakeFormsModal
//     open={formsAfter.isOpen}
//     trigger={formsAfter.trigger ?? 'manual'}
//     tenantId={formsAfter.tenantId}
//     context={formsAfter.context}
//     onComplete={formsAfter.close}
//   />
// ─────────────────────────────────────────────────────────

export interface ActionFormsContext {
  appointmentId?: string;
  admissionId?: string;
  visitId?: string;
  patientId?: string;
}

export interface ActionFormsTriggerState {
  isOpen: boolean;
  trigger: FormTrigger | null;
  tenantId: string | null;
  context: ActionFormsContext;
  /** Fire the modal after an action with the given trigger + context */
  fire: (
    trigger: FormTrigger,
    tenantId: string | null | undefined,
    context: ActionFormsContext,
  ) => void;
  /** Close the modal (called by the modal's onComplete) */
  close: () => void;
}

export function useActionFormsTrigger(): ActionFormsTriggerState {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<FormTrigger | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [context, setContext] = useState<ActionFormsContext>({});

  const fire = useCallback(
    (
      newTrigger: FormTrigger,
      newTenantId: string | null | undefined,
      newContext: ActionFormsContext,
    ) => {
      setTrigger(newTrigger);
      setTenantId(newTenantId ?? null);
      setContext(newContext);
      setIsOpen(true);
    },
    [],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, trigger, tenantId, context, fire, close };
}
