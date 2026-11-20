import { describe, it, expect } from 'vitest';
import { canOpenModule, getModulesForRole } from './role-modules';

// Gap 178/179: Front Desk could open the Counsellor portal by URL.
describe('canOpenModule', () => {
  it('lets only Counsellor and hospital admins into the Counsellor portal', () => {
    expect(canOpenModule('front_desk', 'counsellor')).toBe(false);
    expect(canOpenModule('Front Desk', 'counsellor')).toBe(false);
    expect(canOpenModule('pharmacist', 'counsellor')).toBe(false);
    expect(canOpenModule(undefined, 'counsellor')).toBe(false);
    expect(canOpenModule('counsellor', 'counsellor')).toBe(true);
    expect(canOpenModule('admin', 'counsellor')).toBe(true);
    expect(canOpenModule('super_admin', 'counsellor')).toBe(true);
  });

  it('leaves portals without an allowlist open as before', () => {
    expect(canOpenModule('front_desk', 'hospital')).toBe(true);
    expect(canOpenModule('doctor', 'hospital')).toBe(true);
  });

  it('does not offer the Counsellor portal to an unmapped role', () => {
    expect(getModulesForRole('some_custom_role')).not.toContain('counsellor');
    expect(getModulesForRole('admin')).toContain('counsellor');
    expect(getModulesForRole('counsellor')).toEqual(['counsellor']);
  });
});
