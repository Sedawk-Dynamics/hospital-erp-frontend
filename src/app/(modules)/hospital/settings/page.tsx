'use client';

import { useRouter } from 'next/navigation';
import { Building2, UserCog, Wrench, Layout, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SettingsGroup {
  title: string;
  icon: LucideIcon;
  items: { label: string; href: string; comingSoon?: boolean }[];
}

const settingsGroups: SettingsGroup[] = [
  {
    title: 'Clinic Configuration',
    icon: Building2,
    items: [
      { label: 'Hospital', href: '/hospital/settings/hospital-info' },
      { label: 'Bank Account', href: '/hospital/settings/bank-account' },
      { label: 'Referral', href: '#', comingSoon: true },
      { label: 'Corporate', href: '#', comingSoon: true },
      { label: 'Room', href: '/hospital/settings/rooms' },
      { label: 'Insurance', href: '/hospital/settings/insurance' },
      { label: 'MRD', href: '#', comingSoon: true },
      { label: 'Membership', href: '#', comingSoon: true },
      { label: 'Telemedicine', href: '#', comingSoon: true },
    ],
  },
  {
    title: 'User Configuration',
    icon: UserCog,
    items: [
      { label: 'User Access Configuration', href: '/hospital/settings/users' },
      { label: 'Doctor Schedules', href: '/hospital/settings/doctor-schedules' },
    ],
  },
  {
    title: 'Service Configuration',
    icon: Wrench,
    items: [
      { label: 'Service Master Configuration', href: '/hospital/settings/services' },
    ],
  },
  {
    title: 'Layouts / Templates',
    icon: Layout,
    items: [
      { label: 'Layout', href: '#', comingSoon: true },
      { label: 'Template', href: '#', comingSoon: true },
      { label: 'Card Layout Configuration', href: '#', comingSoon: true },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Settings</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {settingsGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
              <div className="flex items-center gap-2 border-b border-surface-container px-4 py-3">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-headline text-lg font-bold">{group.title}</h3>
              </div>
              <div className="p-2">
                {group.items.map((item) => {
                  const isNavigable = item.href !== '#';
                  return (
                    <button
                      key={item.label}
                      onClick={() => isNavigable && router.push(item.href)}
                      disabled={!isNavigable}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-label text-sm hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>
                        {item.label}
                        {item.comingSoon && (
                          <span className="ml-2 font-label text-[10px] text-on-surface-variant">
                            (coming soon)
                          </span>
                        )}
                      </span>
                      {isNavigable && (
                        <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
