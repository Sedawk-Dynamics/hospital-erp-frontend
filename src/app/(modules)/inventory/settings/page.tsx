'use client';

import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

export default function InventorySettingsPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5" /> Inventory Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Module-level configuration.
        </p>
      </div>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <EmptyState
          icon={Settings}
          title="Settings coming soon"
          description="Department defaults, low-stock alert recipients, and reorder automation rules will appear here."
        />
      </div>
    </div>
  );
}
