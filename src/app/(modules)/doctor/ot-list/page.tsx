'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const otStatItems = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'upcoming', label: 'Upcoming Appt', color: 'text-blue-600' },
  { key: 'booked', label: 'Booked', color: 'text-purple-600' },
  { key: 'approved', label: 'Approved', color: 'text-green-600' },
  { key: 'reschedule', label: 'Reschedule', color: 'text-amber-600' },
  { key: 'no_show', label: 'No Show', color: 'text-gray-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
  { key: 'completed', label: 'Completed', color: 'text-teal-600' },
];

export default function DoctorOTListPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">OT Appointments</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
          <Select value="today" onValueChange={() => {}}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Select Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date display */}
      <div className="text-xs text-muted-foreground text-right">
        {format(new Date(selectedDate), 'dd-MM-yyyy')}
      </div>

      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {otStatItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[90px] transition-all',
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

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs w-[160px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">OT Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgery/Speciality</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgery Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Surgeon Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Anaesthesiatist</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Package Details</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No Records To Be Shown
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <span className="font-medium">10</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>0–0 of 0</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled>‹</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled>›</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
