import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

describe('useSeedOnChange', () => {
  it('seeds when the record first arrives', () => {
    const seed = vi.fn();
    renderHook(({ id }) => useSeedOnChange(id, seed), {
      initialProps: { id: 'rec-1' as string | null },
    });
    expect(seed).toHaveBeenCalledTimes(1);
  });

  // The whole point: a refetch re-renders with a new object, but the record is
  // the same one the user is editing, so the form must be left alone.
  it('does not re-seed when the same record is fetched again', () => {
    const seed = vi.fn();
    const { rerender } = renderHook(({ id }) => useSeedOnChange(id, seed), {
      initialProps: { id: 'rec-1' as string | null },
    });
    rerender({ id: 'rec-1' });
    rerender({ id: 'rec-1' });
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it('seeds again when a different record is opened', () => {
    const seed = vi.fn();
    const { rerender } = renderHook(({ id }) => useSeedOnChange(id, seed), {
      initialProps: { id: 'rec-1' as string | null },
    });
    rerender({ id: 'rec-2' });
    expect(seed).toHaveBeenCalledTimes(2);
  });

  // Callers gate on the data having arrived by passing null while it is in
  // flight. If null latched as "already seeded", the form would never fill.
  it('waits while the identity is null, then seeds once it resolves', () => {
    const seed = vi.fn();
    const { rerender } = renderHook(({ id }) => useSeedOnChange(id, seed), {
      initialProps: { id: null as string | null },
    });
    expect(seed).not.toHaveBeenCalled();
    rerender({ id: 'rec-1' });
    expect(seed).toHaveBeenCalledTimes(1);
  });

  // An unmemoised inline callback is the normal call style; it must not cause
  // the effect to re-seed on every render.
  it('is not fooled by a fresh callback identity each render', () => {
    const inner = vi.fn();
    const { rerender } = renderHook(({ id }) => useSeedOnChange(id, () => inner()), {
      initialProps: { id: 'rec-1' as string | null },
    });
    rerender({ id: 'rec-1' });
    rerender({ id: 'rec-1' });
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
