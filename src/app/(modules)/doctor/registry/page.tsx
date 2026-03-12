'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';

const registryTabs = [
  'Demographics',
  'Diagnosis',
  'Vitals',
  'Drug Name',
  'Allergies',
  'Immunization',
  'Category',
] as const;

const filterSections = [
  'Demographics',
  'Diagnosis',
  'Vitals',
  'Drug Name',
  'Allergies',
  'Patient Category',
] as const;

type RegistryTab = typeof registryTabs[number];

export default function DoctorRegistryPage() {
  const [activeTab, setActiveTab] = useState<RegistryTab>('Demographics');
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (section: string) => {
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Registry</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {registryTabs.map((tab, index) => (
          <div key={tab} className="flex items-center">
            <button
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-1 rounded transition-colors',
                activeTab === tab
                  ? 'text-primary font-medium'
                  : 'hover:text-foreground'
              )}
            >
              {tab}
            </button>
            {index < registryTabs.length - 1 && (
              <span className="text-muted-foreground/50 mx-1">/</span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Data table */}
        <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
          {/* Export button */}
          <div className="flex justify-end p-3 border-b">
            <Button variant="outline" size="icon" className="h-8 w-8" title="Export">
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact Details</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Address</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-4 py-16 text-center text-muted-foreground">
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

        {/* Right: Filter panel */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-foreground">Filter</h3>
          </div>

          <div className="divide-y">
            {filterSections.map((section) => (
              <div key={section}>
                <button
                  onClick={() => toggleFilter(section)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>{section}</span>
                  {expandedFilters.has(section) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedFilters.has(section) && (
                  <div className="px-4 pb-3">
                    <Input placeholder={`Search ${section.toLowerCase()}...`} className="h-8 text-xs" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-4 border-t">
            <Button variant="outline" className="flex-1">Clear</Button>
            <Button className="flex-1">Apply</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
