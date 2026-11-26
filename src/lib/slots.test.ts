import { describe, it, expect } from 'vitest';
import { withPastFlag } from './slots';

// Gap 330: at 13:30 IST the shift is still running — only slots that have
// ENDED are past; the rest of the afternoon stays bookable.
describe('withPastFlag', () => {
  const slot = (startTime: string, endTime: string, extra: Record<string, unknown> = {}) => ({
    startTime, endTime, available: true, ...extra,
  });

  it('marks ended slots past and keeps running/future ones bookable', () => {
    const out = withPastFlag(
      [slot('13:00', '13:30'), slot('13:15', '13:45'), slot('13:30', '14:00')],
      '2026-11-19', '2026-11-19', '13:30',
    );
    expect(out.map((s) => s.isPast)).toEqual([true, false, false]);
  });

  it('trusts the server past flag and shows it as past, not booked', () => {
    const [s] = withPastFlag([slot('09:00', '09:30', { available: false, past: true })], '2026-11-19', '2026-11-19', '08:00');
    expect(s).toMatchObject({ isPast: true, available: true });
  });

  it('treats every slot on an earlier day as past and none on a later day', () => {
    expect(withPastFlag([slot('16:00', '16:30')], '2026-11-18', '2026-11-19', '09:00')[0]!.isPast).toBe(true);
    expect(withPastFlag([slot('09:00', '09:30')], '2026-11-20', '2026-11-19', '23:00')[0]!.isPast).toBe(false);
  });

  it('keeps a booked future slot unavailable', () => {
    const [s] = withPastFlag([slot('15:00', '15:30', { available: false })], '2026-11-19', '2026-11-19', '13:30');
    expect(s).toMatchObject({ isPast: false, available: false });
  });
});
