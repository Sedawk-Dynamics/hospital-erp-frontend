'use client';

import { useState } from 'react';
import {
  Settings, Plus, Pencil, MapPin, Monitor, CheckCircle2, XCircle, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

interface OperatingTheater {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  equipment: string[];
  capacity?: number;
}

// Demo data - will be replaced with API calls
const demoTheaters: OperatingTheater[] = [];

const statusIcon: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2,
  inactive: XCircle,
  maintenance: Wrench,
};

export default function OTSettingsPage() {
  const [theaters] = useState<OperatingTheater[]>(demoTheaters);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Settings"
        description="Configure operating theaters, equipment, and scheduling preferences"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Theater
          </Button>
        }
      />

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Operating Theaters */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold">Operating Theaters</h2>
                <p className="text-sm text-muted-foreground">Manage theater configurations, locations, and equipment</p>
              </div>
            </div>
          </div>

          {theaters.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Monitor}
                title="No Operating Theaters Configured"
                description="Add operating theaters to start managing OT schedules and equipment."
                action={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Theater
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {theaters.map((theater) => {
                const Icon = statusIcon[theater.status] || CheckCircle2;
                return (
                  <div
                    key={theater.id}
                    className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 hover:shadow-lg transition-all duration-150"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{theater.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {theater.location}
                        </div>
                      </div>
                      <StatusBadge status={theater.status} />
                    </div>

                    {theater.equipment.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Equipment</p>
                        <div className="flex flex-wrap gap-1.5">
                          {theater.equipment.map((eq) => (
                            <span
                              key={eq}
                              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                        <Settings className="h-3.5 w-3.5" />
                        Configure
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scheduling Preferences */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold">Scheduling Preferences</h2>
                <p className="text-sm text-muted-foreground">Configure default scheduling rules and time slots</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Default Surgery Duration (min)</label>
                <Input type="number" defaultValue={60} className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Buffer Time Between Surgeries (min)</label>
                <Input type="number" defaultValue={30} className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Max Surgeries Per Day</label>
                <Input type="number" defaultValue={10} className="mt-1.5" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button>Save Preferences</Button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold">Notification Settings</h2>
                <p className="text-sm text-muted-foreground">Configure alerts for OT scheduling and stock levels</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Surgery scheduling notifications', description: 'Notify when a new surgery is scheduled or rescheduled' },
              { label: 'Low stock alerts', description: 'Alert when OT consumable stock falls below reorder level' },
              { label: 'Surgery completion notifications', description: 'Notify when a surgery is completed or cancelled' },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
