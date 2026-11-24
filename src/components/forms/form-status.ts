// Gap 304: the forms list read `isPublished` while the builder showed a
// checkbox whose label always said "Published (visible to nurses)", checked or
// not — so the same form read Draft in one place and Published in the other.
//
// Hospital forms now keep the nurse-visible published version separate from
// the admin's unpublished draft, and the API derives ONE status for both
// screens (`status` / `statusLabel`). `hospitalFormStatus` reads that; the
// older `formStatus` is still used by the super-admin template builder, whose
// templates have no draft/published split.

export type FormStatusTone = 'published' | 'draft' | 'pending' | 'archived';

export interface FormStatus {
  label: string;
  tone: FormStatusTone;
}

/**
 * Status of the saved form. `hasUnsavedEdits` is the builder's local dirty
 * state: edits to a published form are not live until saved.
 */
export function formStatus(saved: { isPublished: boolean }, hasUnsavedEdits = false): FormStatus {
  if (saved.isPublished && hasUnsavedEdits) return { label: 'Published · draft changes pending', tone: 'pending' };
  if (saved.isPublished) return { label: 'Published', tone: 'published' };
  return { label: hasUnsavedEdits ? 'Draft · unsaved changes' : 'Draft', tone: 'draft' };
}

/** Server-derived status of a hospital form. Mirrors the API's enum. */
export type HospitalFormStatusCode = 'draft' | 'published' | 'published_with_changes' | 'archived';

const STATUS_TONE: Record<HospitalFormStatusCode, FormStatusTone> = {
  draft: 'draft',
  published: 'published',
  published_with_changes: 'pending',
  archived: 'archived',
};

const STATUS_LABEL: Record<HospitalFormStatusCode, string> = {
  draft: 'Draft',
  published: 'Published',
  published_with_changes: 'Published · unpublished changes',
  archived: 'Archived',
};

/**
 * The status the list and the builder both show, taken from the API. Falls
 * back to deriving it from the raw columns only if an older API omits it.
 */
export function hospitalFormStatus(form: {
  status?: HospitalFormStatusCode;
  statusLabel?: string;
  isPublished: boolean;
  archivedAt?: string | null;
  hasUnpublishedChanges?: boolean;
}): FormStatus & { code: HospitalFormStatusCode } {
  const code: HospitalFormStatusCode =
    form.status ??
    (form.archivedAt
      ? 'archived'
      : !form.isPublished
        ? 'draft'
        : form.hasUnpublishedChanges
          ? 'published_with_changes'
          : 'published');
  return { code, label: form.statusLabel ?? STATUS_LABEL[code], tone: STATUS_TONE[code] };
}

export const FORM_STATUS_CLASS: Record<FormStatusTone, string> = {
  published: 'text-primary font-semibold',
  draft: 'text-amber-700 font-semibold',
  pending: 'text-blue-700 font-semibold',
  archived: 'text-destructive font-semibold',
};
