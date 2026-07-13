'use client';

import Link from 'next/link';
import { Settings, Building2, Users, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const ENTRIES = [
  {
    href: '/insurance/insurers',
    title: 'Insurers',
    description: 'Add or update insurance companies your hospital empanels.',
    icon: Building2,
  },
  {
    href: '/insurance/tpa',
    title: 'TPA Providers',
    description: 'Manage third-party administrators that process claims.',
    icon: Users,
  },
  {
    href: '/insurance/policies',
    title: 'Patient Policies',
    description: 'Assign policies to patients — multiple per patient is supported.',
    icon: ShieldCheck,
  },
];

export default function InsuranceSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Settings className="size-5 text-primary" /> Insurance Settings
        </h1>
        <p className="text-sm text-on-surface-variant">
          Master data and operational settings for the Insurance & TPA module.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ENTRIES.map((e) => (
          <Link key={e.href} href={e.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <e.icon className="size-4 text-primary" /> {e.title}
                </CardTitle>
                <CardDescription>{e.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-primary">Open →</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
