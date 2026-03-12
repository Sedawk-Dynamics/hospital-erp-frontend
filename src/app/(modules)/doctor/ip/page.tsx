'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Search, CalendarIcon, Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ipStatItems = [
  { key: 'all', label: 'All', color: 'text-foreground' },
  { key: 'inIP', label: 'In IP', color: 'text-blue-600' },
  { key: 'admission', label: 'Admission', color: 'text-green-600' },
  { key: 'discharge', label: 'Discharge', color: 'text-amber-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
];

// Mock data for the IP list matching eMedHub screenshot
const mockIPPatients = [
  {
    id: '1',
    name: 'VALENTEENA',
    age: '24Y',
    gender: 'F',
    mrn: 'KEH000329',
    phone: '9999999999',
    admissionDate: '10-03-2026',
    ipNumber: 'KEH/2025-2026/IP/00024',
    complaints: 'Fracture',
    medicoLegal: 'No',
    consultant: 'Dr Teena',
    tag: 'ACCIDENT AND EMERGENCY',
    bedInfo: '3/3/DAY CARE/WEST BLOCK',
  },
  {
    id: '2',
    name: 'JINCY P P',
    age: '25Y',
    gender: 'F',
    mrn: 'KEH000353',
    phone: '5555555555',
    admissionDate: '24-02-2026',
    ipNumber: 'KEH/2025-2026/IP/00018',
    complaints: 'SUPRACONDYLAR FRACTURE-CORRECTED FO...',
    medicoLegal: 'No',
    consultant: 'Dr Teena',
    tag: '-',
    bedInfo: '12/100/OPT/SOUTH BLOCK',
  },
];

export default function DoctorIPHomePage() {
  const [activeFilter, setActiveFilter] = useState('inIP');
  const [selectedWard, setSelectedWard] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const stats = {
    all: 0,
    inIP: 2,
    admission: 0,
    discharge: 0,
    cancelled: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Appointment</h1>
        <div className="flex items-center gap-2">
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

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedWard} onValueChange={(v) => setSelectedWard(v ?? 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Ward" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select Ward</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBlock} onValueChange={(v) => setSelectedBlock(v ?? 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Block" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select Block</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedFloor} onValueChange={(v) => setSelectedFloor(v ?? 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select Floor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          {ipStatItems.map((item) => (
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
              <span className={cn('text-lg font-bold', item.color)}>
                {stats[item.key as keyof typeof stats] ?? 0}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* IP Home tab */}
      <div className="flex items-center gap-2 border-b pb-2">
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-2 px-2">
          IP Home
        </span>
      </div>

      {/* Date range + search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>From Date:</span>
          <span className="font-semibold text-foreground">{format(new Date(fromDate), 'dd-MM-yyyy')}</span>
          <span className="ml-2">To Date:</span>
          <span className="font-semibold text-foreground">{format(new Date(toDate), 'dd-MM-yyyy')}</span>
        </div>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP Records</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Consultant/Tag</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bed/Room/Ward/Block</th>
              </tr>
            </thead>
            <tbody>
              {mockIPPatients.map((patient) => (
                <tr key={patient.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {patient.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">
                          {patient.name} {patient.age}/{patient.gender}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {patient.mrn} | {patient.phone}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Admission Date&Time: {patient.admissionDate} | ...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-primary text-xs">IP :{patient.ipNumber}</p>
                      <p className="text-xs text-muted-foreground">Complaints :{patient.complaints}</p>
                      <p className="text-xs text-muted-foreground">Medico-Legal :{patient.medicoLegal}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{patient.consultant}</p>
                      {patient.tag !== '-' && (
                        <p className="text-xs font-medium text-green-600">Tag : {patient.tag}</p>
                      )}
                      {patient.tag === '-' && (
                        <p className="text-xs text-muted-foreground">Tag : -</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{patient.bedInfo}</p>
                  </td>
                </tr>
              ))}
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
            <span>1–{mockIPPatients.length} of {mockIPPatients.length}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled>‹</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled>›</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
