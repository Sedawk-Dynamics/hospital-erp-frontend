'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BulkInwardPanel } from '@/components/pharmacy/bulk-inward-dialog';

// ONE place to add stock — define a single product and/or receive one or many.
// It's the bulk-inward flow generalised: add a line (or import/scan many), leave
// Qty blank to just register a product or fill it to also receive stock, expand a
// row for full product details. Replaces the separate "New Item" + "Bulk Stock
// Inward" popups entirely.
export default function AddToStoragePage() {
  const router = useRouter();

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => router.push('/inventory')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Storage
        </Button>
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <PackagePlus className="h-5 w-5" /> Add Stock
          </h1>
          <p className="text-xs text-muted-foreground">
            Add one product or many — medicines and supplies alike. Leave quantity blank to just
            register a product, or fill it to receive stock. Scan, paste, or upload an invoice.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sanctuary">
        <BulkInwardPanel onClose={() => router.push('/inventory')} />
      </div>
    </div>
  );
}
