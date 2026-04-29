'use client';

import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

export default function GSTUpdatePage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">GST Summary</h1>
        <p className="text-sm text-muted-foreground">
          GST reporting will appear here once HSN codes and GST rates are recorded
          per batch.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <EmptyState
          icon={Receipt}
          title="GST module coming next"
          description="HSN codes and GST rates are not yet captured in the formulary or batch schemas. This view will be wired up after the GST data model is finalised."
        />
      </div>
    </div>
  );
}
