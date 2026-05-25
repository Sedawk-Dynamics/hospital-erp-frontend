'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCreateLabOrder } from '@/hooks/use-doctor';
import { apiGet } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { X, Search, FlaskConical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabTest {
  id: string;
  name: string;
  code?: string;
  category?: string;
}

interface LabTestCatalogEntry {
  id: string;
  testName: string;
  testCode?: string;
  sampleType?: string;
}

interface LabOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  visitId: string;
}

type Urgency = 'routine' | 'urgent' | 'stat';

const urgencyOptions: { value: Urgency; label: string; color: string; activeBg: string }[] = [
  { value: 'routine', label: 'Routine', color: 'text-foreground', activeBg: 'bg-primary text-white' },
  { value: 'urgent', label: 'Urgent', color: 'text-secondary', activeBg: 'bg-secondary text-white' },
  { value: 'stat', label: 'STAT', color: 'text-error', activeBg: 'bg-error text-white' },
];

export function LabOrderDialog({ open, onOpenChange, patientId, visitId }: LabOrderDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LabTest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createLabOrder = useCreateLabOrder();

  // Search for tests with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiGet<LabTestCatalogEntry[]>('/lab/test-catalog', {
          params: { search: searchQuery, limit: 20, isActive: 'true' },
        });
        const results: LabTest[] = (response.data ?? []).map((t) => ({
          id: t.id,
          name: t.testName,
          code: t.testCode,
          category: t.sampleType,
        }));
        // Filter out already selected tests
        const filtered = results.filter(
          (t) => !selectedTests.some((s) => s.id === t.id)
        );
        setSearchResults(filtered);
        setShowDropdown(filtered.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, selectedTests]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTest = useCallback((test: LabTest) => {
    setSelectedTests((prev) => (prev.some((t) => t.id === test.id) ? prev : [...prev, test]));
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }, []);

  const handleRemoveTest = useCallback((testId: string) => {
    setSelectedTests((prev) => prev.filter((t) => t.id !== testId));
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      handleAddTest(searchResults[0]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }
    if (!visitId) {
      toast.error('A visit is required to order lab tests');
      return;
    }

    // LabOrder has only one `notes` field; merge clinical context in.
    const clinical = clinicalNotes.trim();
    const misc = notes.trim();
    const mergedNotes = [
      clinical ? `Clinical: ${clinical}` : '',
      misc ? `Notes: ${misc}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await createLabOrder.mutateAsync({
        patientId,
        visitId,
        items: selectedTests.map((t) => ({ testId: t.id })),
        urgency,
        notes: mergedNotes || undefined,
      });
      toast.success('Lab order created successfully');
      handleReset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create lab order');
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedTests([]);
    setUrgency('routine');
    setClinicalNotes('');
    setNotes('');
    setShowDropdown(false);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) handleReset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Order Lab Tests
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Test Search */}
          <div className="relative" ref={dropdownRef}>
            <Label className="text-sm font-medium">Search Tests</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by test name or code (Enter to add top result)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onKeyDown={handleSearchKeyDown}
                className="pl-8 text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddTest(test);
                    }}
                  >
                    <div>
                      <p className="font-medium text-foreground">{test.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {test.code && <span>{test.code}</span>}
                        {test.code && test.category && <span> &middot; </span>}
                        {test.category && <span>{test.category}</span>}
                      </p>
                    </div>
                    <span className="text-xs text-primary font-medium">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Tests */}
          <div>
            <Label className="text-sm font-medium">
              Selected Tests ({selectedTests.length})
            </Label>
            {selectedTests.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pick a test from the search results above to add it here. At least one test is required.
              </p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {selectedTests.map((test) => (
                  <Badge
                    key={test.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2.5 text-sm"
                  >
                    {test.name}
                    {test.code && (
                      <span className="text-xs text-muted-foreground">({test.code})</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveTest(test.id)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Urgency */}
          <div>
            <Label className="text-sm font-medium">Urgency</Label>
            <div className="mt-1.5 flex gap-2">
              {urgencyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUrgency(opt.value)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-medium border transition-all duration-200',
                    urgency === opt.value
                      ? opt.activeBg + ' border-transparent shadow-sm'
                      : 'bg-card border-border hover:border-primary/40 ' + opt.color
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Notes */}
          <div>
            <Label className="text-sm font-medium">Clinical Notes</Label>
            <Textarea
              placeholder="Relevant clinical information for the lab..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={3}
              className="mt-1.5 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              placeholder="Additional instructions or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1.5 text-sm"
            />
          </div>

          {/* Footer */}
          {!visitId && (
            <p className="text-xs text-error">
              No active visit — open this dialog from a patient with an active visit.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createLabOrder.isPending || selectedTests.length === 0 || !visitId}
              title={
                !visitId
                  ? 'No active visit'
                  : selectedTests.length === 0
                    ? 'Add at least one test from the search above'
                    : undefined
              }
              className="gap-1.5"
            >
              {createLabOrder.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Ordering...
                </>
              ) : (
                <>
                  <FlaskConical className="h-3.5 w-3.5" />
                  Order Tests ({selectedTests.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
