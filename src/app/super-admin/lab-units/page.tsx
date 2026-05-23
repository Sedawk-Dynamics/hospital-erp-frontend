'use client';

// Super-admin Lab Unit Groups page. Renders the same <LabUnitsManager/>
// the hospital admin uses, but with `allowGlobal=true` so super_admin
// can author platform-wide groups.
//
// Per the 2026-05-23 meeting, units sit between parameters and the
// actual measurement value (parameter → unit group → unit). The list of
// 12 seeded groups ships via `npm run db:seed:lab-units`; this surface
// lets us add new ones (e.g. specialty-specific units for a new test
// vertical) without a code deploy.

import { Ruler } from 'lucide-react';
import { LabUnitsManager } from '@/components/laboratory/lab-units-manager';

export default function SuperAdminLabUnitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Ruler className="h-5 w-5 text-primary" />
          Lab Unit Groups
        </h1>
        <p className="font-label text-sm text-on-surface-variant">
          Platform-wide unit catalogue used by every lab test template. Hospital admins can add their own local
          groups + units on top — they don't need write access here.
        </p>
      </div>

      <LabUnitsManager allowGlobal />
    </div>
  );
}
