'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical, ChevronDown } from 'lucide-react';

type SettingsTab = 'layout' | 'notes';

interface LayoutItem {
  id: string;
  systemName: string;
  customName: string;
  enabled: boolean;
}

const defaultLayoutItems: LayoutItem[] = [
  { id: '1', systemName: 'Symptoms', customName: 'Symptoms', enabled: true },
  { id: '2', systemName: 'Vitals', customName: 'Vitals', enabled: true },
  { id: '3', systemName: 'Allergies', customName: 'Allergies', enabled: true },
  { id: '4', systemName: 'Patient Category', customName: 'Patient Category', enabled: true },
  { id: '5', systemName: 'Examination', customName: 'Examination', enabled: true },
  { id: '6', systemName: 'Diagnosis', customName: 'Diagnosis', enabled: true },
  { id: '7', systemName: 'Prescription', customName: 'Prescription', enabled: true },
];

export default function DoctorSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('layout');
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>(defaultLayoutItems);

  // Doctor Notes config state
  const [lockPeriod, setLockPeriod] = useState('30');
  const [prescriptionSearch, setPrescriptionSearch] = useState('both');
  const [autoFetchDrugs, setAutoFetchDrugs] = useState(true);
  const [homeLanding, setHomeLanding] = useState('all');
  const [singleCommentBox, setSingleCommentBox] = useState(false);

  const toggleLayoutItem = (id: string) => {
    setLayoutItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const updateCustomName = (id: string, name: string) => {
    setLayoutItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, customName: name } : item
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b">
        <button
          onClick={() => setActiveTab('layout')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'layout'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Layout Configuration
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'notes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Doctor Notes Configuration
        </button>
      </div>

      {activeTab === 'layout' && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-2 bg-muted/50 border-b">
            <div className="px-4 py-3 font-medium text-sm text-muted-foreground">System Name</div>
            <div className="px-4 py-3 font-medium text-sm text-muted-foreground">Custom Name</div>
          </div>

          {/* Layout items */}
          {layoutItems.map((item) => (
            <div key={item.id} className="grid grid-cols-2 border-b last:border-0 items-center">
              <div className="px-4 py-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleLayoutItem(item.id)}
                    className="rounded border-border"
                  />
                  <span className={cn(
                    'text-sm font-medium',
                    item.enabled ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {item.systemName}
                  </span>
                </label>
              </div>
              <div className="px-4 py-3">
                <Input
                  value={item.customName}
                  onChange={(e) => updateCustomName(item.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex justify-center gap-3 p-4 border-t">
            <Button variant="outline">RESET LAYOUT</Button>
            <Button>SAVE LAYOUT</Button>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="rounded-lg border bg-card p-6 space-y-6">
          <h3 className="font-semibold text-foreground text-lg">Doctor Notes Configuration</h3>

          <div className="space-y-5">
            {/* Lock period */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Duration for Doctor Notes Lock Period ?
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={lockPeriod}
                  onChange={(e) => setLockPeriod(e.target.value)}
                  className="w-20 h-8 text-sm text-right"
                />
                <span className="text-sm font-medium text-foreground">Days</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3 text-right">
              *3 days is the default lock period
            </p>

            {/* Prescription Search Based On */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Prescription Search Based On
              </label>
              <Select value={prescriptionSearch} onValueChange={(v) => setPrescriptionSearch(v ?? 'both')}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="brand">Brand Name</SelectItem>
                  <SelectItem value="generic">Generic Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-fetch Previous Drugs */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Prescription - Auto-fetch Previous Drugs
              </label>
              <input
                type="checkbox"
                checked={autoFetchDrugs}
                onChange={(e) => setAutoFetchDrugs(e.target.checked)}
                className="rounded border-border h-4 w-4"
              />
            </div>

            {/* Home Screen Landing */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Home Screen Landing Based On
              </label>
              <Select value={homeLanding} onValueChange={(v) => setHomeLanding(v ?? 'all')}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Print options */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Select default option for Print
              </label>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Single comment box */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Complaints - Show individual comments in a single comment box
              </label>
              <input
                type="checkbox"
                checked={singleCommentBox}
                onChange={(e) => setSingleCommentBox(e.target.checked)}
                className="rounded border-border h-4 w-4"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-4 border-t">
            <Button variant="outline">Reset</Button>
            <Button>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
