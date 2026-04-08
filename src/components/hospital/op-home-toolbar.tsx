'use client';

import { toInputDateStr } from '@/lib/date-utils';
import { Search, CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OPHomeToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedDoctor: string;
  onDoctorChange: (value: string) => void;
  selectedDate: string;
  onDateChange: (value: string) => void;
  doctors: { id: string; name: string }[];
}

export function OPHomeToolbar({
  searchQuery,
  onSearchChange,
  selectedDoctor,
  onDoctorChange,
  selectedDate,
  onDateChange,
  doctors,
}: OPHomeToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        {/* Doctor filter */}
        <Select value={selectedDoctor} onValueChange={(v) => onDoctorChange(v ?? 'all')}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Doctors</SelectItem>
            {doctors.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Patient search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient name, MRN, phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Date picker */}
        <div className="relative">
          <CalendarIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60 w-[160px]"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => onDateChange(toInputDateStr())}>
          Today
        </Button>
      </div>
    </div>
  );
}
