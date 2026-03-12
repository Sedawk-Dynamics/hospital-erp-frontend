'use client';

import { useRouter } from 'next/navigation';
import { Building2, UserCog, Wrench, Layout } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SettingsGroup {
  title: string;
  icon: LucideIcon;
  items: { label: string; href: string }[];
}

const settingsGroups: SettingsGroup[] = [
  {
    title: 'Clinic Configuration',
    icon: Building2,
    items: [
      { label: 'Hospital', href: '#' },
      { label: 'Referral', href: '#' },
      { label: 'Corporate', href: '#' },
      { label: 'Room', href: '#' },
      { label: 'Insurance', href: '#' },
      { label: 'MRD', href: '#' },
      { label: 'Membership', href: '#' },
      { label: 'Telemedicine', href: '#' },
    ],
  },
  {
    title: 'User Configuration',
    icon: UserCog,
    items: [
      { label: 'User Access Configuration', href: '/hospital/settings/users' },
    ],
  },
  {
    title: 'Service Configuration',
    icon: Wrench,
    items: [
      { label: 'Service Master Configuration', href: '#' },
    ],
  },
  {
    title: 'Layouts / Templates',
    icon: Layout,
    items: [
      { label: 'Layout', href: '#' },
      { label: 'Template', href: '#' },
      { label: 'Card Layout Configuration', href: '#' },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {settingsGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{group.title}</h3>
              </div>
              <div className="p-2">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => item.href !== '#' && router.push(item.href)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
