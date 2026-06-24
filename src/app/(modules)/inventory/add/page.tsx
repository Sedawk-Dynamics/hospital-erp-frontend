'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, PlusCircle, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedItemForm } from '@/components/inventory/unified-item-dialog';
import { BulkInwardPanel } from '@/components/pharmacy/bulk-inward-dialog';

// "New Item" and "Bulk Stock Inward" combined onto one full page (no popups). Both
// flows are preserved in full — a single-item add and the multi-line invoice
// wizard — selectable via tabs. Reached from the Storage page's header buttons.
type AddTab = 'item' | 'bulk';
const tabFromParam = (v: string | null): AddTab => (v === 'bulk' ? 'bulk' : 'item');

export default function AddToStoragePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromParam(searchParams.get('tab'));

  const setTab = (next: AddTab) =>
    router.replace(next === 'bulk' ? '/inventory/add?tab=bulk' : '/inventory/add', { scroll: false });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => router.push('/inventory')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Storage
        </Button>
        <div>
          <h1 className="font-headline text-xl font-bold">Add to Storage</h1>
          <p className="text-xs text-muted-foreground">
            Add a single item, or receive a whole invoice at once — medicines and supplies alike.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AddTab)}>
        <TabsList>
          <TabsTrigger value="item">
            <PlusCircle className="h-4 w-4" /> New item
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <PackageCheck className="h-4 w-4" /> Bulk stock inward
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item" className="mt-4">
          <div className="mx-auto max-w-3xl rounded-xl bg-surface-container-lowest p-5 shadow-sanctuary">
            {tab === 'item' && <UnifiedItemForm onCancel={() => router.push('/inventory')} />}
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sanctuary">
            {tab === 'bulk' && <BulkInwardPanel onClose={() => router.push('/inventory')} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
