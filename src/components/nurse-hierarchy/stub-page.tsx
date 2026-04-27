import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

/**
 * Lightweight placeholder for pages in the nurse-hierarchy modules that have
 * been scaffolded but not yet fleshed out. Shows the page title + description
 * so a user landing on the route understands what they'll see here once built.
 */
export function StubPage({
  title,
  description,
  phaseHint,
}: {
  title: string;
  description: string;
  phaseHint?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Construction className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Coming soon</div>
            <div className="text-xs text-muted-foreground">
              This view is wired into the module shell. UI and backend-driven data will land in the
              next delivery.
              {phaseHint ? ` ${phaseHint}` : ''}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
