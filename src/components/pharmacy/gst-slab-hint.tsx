'use client';

import { useGstSlabs } from '@/hooks/use-gst-slabs';

/**
 * #262: says, while the rate is being typed, that it is not one the law allows
 * today. The server refuses it on save; this only saves the round trip. Silent
 * when the slabs cannot be read.
 */
export function GstSlabHint({ value }: { value: string }) {
  const { data } = useGstSlabs();
  const rate = Number(value);
  const legal = [...new Set((data?.slabs ?? []).filter((s) => s.current).map((s) => Number(s.ratePercent)))].sort((a, b) => a - b);
  if (!value.trim() || !Number.isFinite(rate) || rate <= 0 || legal.length === 0) return null;
  if (legal.some((r) => Math.abs(r - rate) < 0.005)) return null;
  return (
    <p className="text-[11px] text-error" role="alert">
      {rate}% is not a legal GST rate today (allowed: {legal.map((r) => `${r}%`).join(', ')}). The medicine cannot be billed at it.
    </p>
  );
}
