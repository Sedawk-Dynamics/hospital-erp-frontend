// Gap 304: the forms list read `isPublished` while the builder showed a
// checkbox whose label always said "Published (visible to nurses)", checked or
// not — so the same form read Draft in one place and Published in the other.
// Both now derive the label from the saved (live) record through this helper.

export type FormStatusTone = 'published' | 'draft' | 'pending';

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

export const FORM_STATUS_CLASS: Record<FormStatusTone, string> = {
  published: 'text-primary font-semibold',
  draft: 'text-amber-700 font-semibold',
  pending: 'text-blue-700 font-semibold',
};
