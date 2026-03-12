'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

type MRDTab = 'inbound' | 'outbound';

interface MRDDocument {
  id: string;
  patientName: string;
  mrn: string;
  phone: string;
  requestedTo: string;
  requestedDate: string;
  requestedTime: string;
  status: 'Initiated' | 'In Progress' | 'Completed' | 'Rejected';
}

const mockMRDDocuments: MRDDocument[] = [
  {
    id: '1',
    patientName: 'KANNAMAL B',
    mrn: 'KEH000328',
    phone: '9999999999',
    requestedTo: 'Mrd',
    requestedDate: '27-02-2026',
    requestedTime: '2:06 PM',
    status: 'Initiated',
  },
];

export default function DoctorMRDPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<MRDTab>('inbound');
  const [patientSearch, setPatientSearch] = useState('');
  const [locationFrom, setLocationFrom] = useState('');
  const [wardRoom, setWardRoom] = useState('general');
  const [search, setSearch] = useState('');

  const doctorName = user ? `Dr ${user.firstName}` : 'Doctor';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">MRD Transfers</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Request MRD Document form */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Request MRD Document</h3>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Patient"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Input
              placeholder="Location From *"
              value={locationFrom}
              onChange={(e) => setLocationFrom(e.target.value)}
            />

            <div>
              <label className="text-xs text-muted-foreground">Ward / Room No *</label>
              <Select value={wardRoom} onValueChange={(v) => setWardRoom(v ?? 'general')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Ward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="icu">ICU</SelectItem>
                  <SelectItem value="ot">OT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Doctor Name</label>
              <Select value="current" onValueChange={() => {}}>
                <SelectTrigger>
                  <SelectValue placeholder={doctorName} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">{doctorName}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Patient Details</h4>
              <div className="rounded-lg border p-4 min-h-[100px] text-xs text-muted-foreground">
                {patientSearch ? 'Searching...' : 'Select a patient to view details'}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1">Clear</Button>
            <Button className="flex-1">Request</Button>
          </div>
        </div>

        {/* Right: MRD Documents */}
        <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-foreground">MRD Documents</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('inbound')}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'inbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                Inbound
              </button>
              <button
                onClick={() => setActiveTab('outbound')}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                Outbound
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex justify-end p-3 border-b">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Requested To</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Requested Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'inbound' && mockMRDDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {doc.patientName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{doc.patientName}</p>
                          <div className="text-xs text-muted-foreground">
                            {doc.mrn} | {doc.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{doc.requestedTo}</td>
                    <td className="px-4 py-3 text-foreground">
                      {doc.requestedDate} | {doc.requestedTime}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        doc.status === 'Initiated' && 'bg-blue-100 text-blue-800',
                        doc.status === 'In Progress' && 'bg-amber-100 text-amber-800',
                        doc.status === 'Completed' && 'bg-green-100 text-green-800',
                        doc.status === 'Rejected' && 'bg-red-100 text-red-800',
                      )}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="outline" size="sm" disabled>
                        Pending
                      </Button>
                    </td>
                  </tr>
                ))}
                {activeTab === 'outbound' && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No outbound MRD requests found.
                    </td>
                  </tr>
                )}
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
              <span>1–{mockMRDDocuments.length} of {mockMRDDocuments.length}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>‹</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>›</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
