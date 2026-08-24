'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCreateLabOrder, usePatientDiagnoses } from '@/hooks/use-doctor';
import { useOrderSuggestions } from '@/hooks/use-cdss';
import { apiGet } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { X, Search, FlaskConical, Loader2, Sparkles } from 'lucide-react';
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

/**
 * How many catalog rows to pull at once. A hospital's lab catalog runs to a few
 * hundred at most, so one page holds it — and holding it is what lets the
 * already-selected filter and the ranking below work on the whole set rather
 * than on an arbitrary slice of it.
 */
const CATALOG_PAGE_SIZE = 200;

/**
 * Put the test the doctor most likely meant at the top.
 *
 * The server matches with `contains`, so typing "cbc" can return "Absolute CBC
 * differential" above "CBC" on an alphabetical sort. Exact match first, then a
 * name or code that STARTS with what was typed, then everything else — each
 * group kept alphabetical. With no query this is a plain alphabetical browse.
 */
function rankTests(tests: LabTest[], query: string): LabTest[] {
  const q = query.trim().toLowerCase();
  if (!q) return tests;

  const rank = (t: LabTest): number => {
    const name = t.name.toLowerCase();
    const code = (t.code ?? '').toLowerCase();
    if (name === q || code === q) return 0;
    if (name.startsWith(q) || code.startsWith(q)) return 1;
    return 2;
  };

  return [...tests].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function LabOrderDialog({ open, onOpenChange, patientId, visitId }: LabOrderDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LabTest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  // What the catalog actually holds for this query, so a trimmed list can say so.
  const [totalMatches, setTotalMatches] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createLabOrder = useCreateLabOrder();

  // ── CDSS diagnosis-based order suggestions ──
  const { data: diagnoses } = usePatientDiagnoses(patientId);
  const primaryDx = diagnoses?.[0];
  const { data: suggestions } = useOrderSuggestions(primaryDx?.icdCode, primaryDx?.diagnosisName);
  // Suggested labs not already added (by case-insensitive name).
  const suggestedLabs = (suggestions?.labs ?? []).filter(
    (name) => !selectedTests.some((t) => t.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(t.name.toLowerCase())),
  );

  // Look tests up, and — with an empty box — simply LIST them.
  //
  // This used to bail out under two characters, so there was no way to see the
  // catalog at all: a doctor had to already know the name of the test they
  // wanted before anything appeared. That is what "the search does not show
  // all the lab tests" meant. An empty query now browses.
  useEffect(() => {
    if (!open) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Browsing wants no debounce (it runs once on open); typing does.
    const delay = searchQuery.trim() ? 300 : 0;

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiGet<LabTestCatalogEntry[]>('/lab/test-catalog', {
          params: {
            ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            // Was 20 — enough to silently cut a catalog of any size, with
            // nothing on screen saying so. A hospital's list is hundreds at
            // most, and the response says how many there really are.
            limit: CATALOG_PAGE_SIZE,
            isActive: 'true',
          },
        });
        const results: LabTest[] = (response.data ?? []).map((t) => ({
          id: t.id,
          name: t.testName,
          code: t.testCode,
          category: t.sampleType,
        }));
        setTotalMatches(response.meta?.total ?? results.length);
        setSearchResults(rankTests(results, searchQuery));
      } catch {
        setSearchResults([]);
        setTotalMatches(0);
      } finally {
        setIsSearching(false);
      }
    }, delay);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // Deliberately NOT keyed on selectedTests: adding a test used to re-run the
    // whole search, and because already-selected tests were then filtered out
    // of a 20-row page, the list visibly shrank as the doctor worked.
  }, [searchQuery, open]);

  // Selected tests are hidden from the list here, not in the query — so
  // removing one brings it straight back without another round trip.
  const visibleResults = searchResults.filter(
    (t) => !selectedTests.some((s) => s.id === t.id),
  );

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

  // Add a CDSS-suggested test by resolving its name against the lab catalog.
  const handleAddSuggested = useCallback(async (name: string) => {
    try {
      // Ask for a handful and rank them, rather than taking whatever came
      // first: the server matches on `contains` and sorts by name, so asking
      // for one row and trusting it would add "Absolute CBC differential"
      // when the suggestion said "CBC".
      const response = await apiGet<LabTestCatalogEntry[]>('/lab/test-catalog', {
        params: { search: name, limit: 10, isActive: 'true' },
      });
      const candidates = (response.data ?? []).map((t) => ({
        id: t.id, name: t.testName, code: t.testCode, category: t.sampleType,
      }));
      const hit = rankTests(candidates, name)[0];
      if (!hit) {
        toast.message(`“${name}” isn’t in your lab catalog — search and add it manually.`);
        return;
      }
      handleAddTest(hit);
    } catch {
      toast.error('Could not add the suggested test');
    }
  }, [handleAddTest]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter takes the top of what is ON SCREEN — adding a test the doctor
    // cannot see, because it was already selected, would be a surprise.
    if (e.key === 'Enter' && visibleResults.length > 0) {
      e.preventDefault();
      handleAddTest(visibleResults[0]);
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
                placeholder="Search by test name or code, or browse the catalog..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                // Opens the list on focus even with an empty box — browsing the
                // catalog is the point, not a fallback. Also on CLICK, because
                // adding a test closes the list while leaving the input
                // focused: clicking it again then fires no focus event, and the
                // list would never come back without clicking away first.
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                onKeyDown={handleSearchKeyDown}
                className="pl-8 text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* The catalog: everything when the box is empty, matches when not.
                Opening this ALWAYS shows something once focused. It used to
                render nothing at all when there was nothing to show, so a
                doctor whose hospital had no catalog clicked the field, watched
                nothing happen, and reported the search as broken — which is
                indistinguishable from it being broken. */}
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-64 overflow-y-auto">
                {isSearching && visibleResults.length === 0 && (
                  <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading your hospital’s tests…
                  </p>
                )}
                {!isSearching && visibleResults.length === 0 && searchQuery.trim() && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    No test matches “{searchQuery.trim()}”. It may not be in your hospital’s lab
                    catalog yet — an admin can add it under Laboratory settings.
                  </p>
                )}
                {/* Nothing typed and nothing to list: the catalog itself is
                    empty. That is a provisioning problem with a known fix, and
                    saying so beats leaving the doctor to guess. */}
                {!isSearching && visibleResults.length === 0 && !searchQuery.trim() && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {selectedTests.length > 0
                      ? 'Every test in your catalog is already on this order.'
                      : 'Your hospital’s lab catalog is empty — an admin can add tests, or clone the standard set, under Laboratory settings.'}
                  </p>
                )}
                {visibleResults.map((test) => (
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
                {/* A trimmed list used to look like the whole catalog. */}
                {totalMatches > searchResults.length && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Showing {visibleResults.length} of {totalMatches} — keep typing to narrow it down.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* CDSS diagnosis-based suggestions */}
          {primaryDx?.diagnosisName && suggestedLabs.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Suggested for {primaryDx.diagnosisName}
                {primaryDx.icdCode ? <span className="text-muted-foreground">({primaryDx.icdCode})</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestedLabs.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddSuggested(name)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card px-2.5 py-1 text-xs hover:bg-primary/10 transition-colors"
                  >
                    + {name}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Recommended based on the patient&apos;s diagnosis. Click to add; review before ordering.
              </p>
            </div>
          )}

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
