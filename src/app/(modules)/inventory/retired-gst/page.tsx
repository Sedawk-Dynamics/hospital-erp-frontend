'use client';

import { RetiredGstPanel } from '@/components/pharmacy/retired-gst-panel';

// #262: medicines on a retired GST rate, and the rate-list import. The panel
// and the endpoints behind it are limited to the roles that edit GST rates.
export default function RetiredGstPage() {
  return <RetiredGstPanel />;
}
