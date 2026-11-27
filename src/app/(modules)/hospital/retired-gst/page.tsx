'use client';

import { RetiredGstPanel } from '@/components/pharmacy/retired-gst-panel';

// #262: the same screen for Finance (billing admin), who has no inventory module.
export default function HospitalRetiredGstPage() {
  return <RetiredGstPanel />;
}
