'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const statItems = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'upcoming', label: 'Upcoming', color: 'text-blue-600' },
  { key: 'booked', label: 'Booked', color: 'text-purple-600' },
  { key: 'approved', label: 'Approved', color: 'text-green-600' },
  { key: 'reschedule', label: 'Reschedule', color: 'text-amber-600' },
  { key: 'no_show', label: 'No Show', color: 'text-gray-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
  { key: 'completed', label: 'Completed', color: 'text-teal-600' },
];

export default function OTHomePage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">OT Home</h1>
        <Button>Book OT Appointment</Button>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[80px] transition-all',
              activeFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-card hover:border-border'
            )}
          >
            <span className={cn('text-lg font-bold', item.color)}>0</span>
            <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient, surgery..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">OT Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgery / Speciality</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgeon Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Anaesthetist</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No OT appointments found for the selected filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
