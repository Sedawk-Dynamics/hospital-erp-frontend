import { describe, it, expect } from 'vitest';
import { formStatus } from './form-status';

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
