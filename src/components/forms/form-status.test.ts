import { describe, it, expect } from 'vitest';
import { formStatus, hospitalFormStatus } from './form-status';

describe('formStatus (gap 304)', () => {
  it('reflects the saved record, not the unsaved checkbox', () => {
    expect(formStatus({ isPublished: false }).label).toBe('Draft');
    expect(formStatus({ isPublished: true }).label).toBe('Published');
  });
  it('flags pending edits on a published form', () => {
    expect(formStatus({ isPublished: true }, true)).toEqual({ label: 'Published · draft changes pending', tone: 'pending' });
    expect(formStatus({ isPublished: false }, true).tone).toBe('draft');
  });
});

describe('hospitalFormStatus (gap 304: list and builder share the API status)', () => {
  it('uses the server-derived status and label', () => {
    expect(
      hospitalFormStatus({
        status: 'published_with_changes',
        statusLabel: 'Published · unpublished changes',
        isPublished: true,
        hasUnpublishedChanges: true,
      }),
    ).toEqual({ code: 'published_with_changes', label: 'Published · unpublished changes', tone: 'pending' });
    expect(hospitalFormStatus({ status: 'draft', statusLabel: 'Draft', isPublished: false }).tone).toBe('draft');
  });

  it('falls back to the raw columns when the API omits a status', () => {
    expect(hospitalFormStatus({ isPublished: false }).label).toBe('Draft');
    expect(hospitalFormStatus({ isPublished: true }).label).toBe('Published');
    expect(hospitalFormStatus({ isPublished: true, hasUnpublishedChanges: true }).code).toBe('published_with_changes');
    expect(hospitalFormStatus({ isPublished: true, archivedAt: '2026-01-01' }).code).toBe('archived');
  });
});
