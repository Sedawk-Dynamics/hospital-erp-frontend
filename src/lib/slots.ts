import type { AvailableSlot } from '@/hooks/use-hospital';

/**
 * Gap 330: a slot is past once it has ENDED in IST — not once the server's UTC
 * clock passes it, and not as soon as it starts (a 13:15–13:30 slot can still
 * be booked at 13:20). Trusts the server's `past` flag and re-checks against
 * the live IST clock so a dialog left open does not offer slots that ended
 * since it loaded. A past slot reads as past, not as "Booked".
 */
export function withPastFlag<T extends AvailableSlot>(
  slots: T[],
  dateStr: string,
  todayIST: string,
  nowHHmm: string,
): Array<T & { isPast: boolean }> {
  return slots.map((slot) => {
    const isPast =
      !!slot.past || dateStr < todayIST || (dateStr === todayIST && slot.endTime <= nowHHmm);
    return { ...slot, isPast, available: isPast ? true : slot.available };
  });
}
