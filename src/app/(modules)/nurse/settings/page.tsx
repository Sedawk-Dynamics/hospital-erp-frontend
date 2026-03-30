'use client';

import { Settings } from 'lucide-react';

export default function NurseSettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-headline text-xl font-bold">Nurse Settings</h1>
          <p className="text-sm text-muted-foreground">Configure nurse module preferences</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h2 className="mt-4 font-headline text-lg font-semibold text-muted-foreground">Coming Soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nurse settings including notification preferences, default ward assignment, shift schedules, and alert thresholds will be available here.
        </p>
      </div>
    </div>
  );
}
