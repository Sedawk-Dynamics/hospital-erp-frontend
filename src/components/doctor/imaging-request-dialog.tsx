'use client';

import { useState, useEffect } from 'react';
import { useCreateImagingRequest } from '@/hooks/use-doctor';
import { useImagingCatalog, type ImagingCatalogItem } from '@/hooks/use-imaging-catalog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanLine, Loader2, Search, X, IndianRupee, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  visitId: string;
}

type Urgency = 'routine' | 'urgent' | 'stat';

const imagingTypes = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'mri', label: 'MRI' },
  { value: 'ct_scan', label: 'CT Scan' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'ecg', label: 'ECG' },
  { value: 'echo', label: 'Echo' },
  { value: 'other', label: 'Other' },
];

const MODALITY_LABELS: Record<string, string> = Object.fromEntries(
  imagingTypes.map((t) => [t.value, t.label]),
);

// The common studies shown as one-tap buttons (everything else is via search).
const QUICK_MODALITIES = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'ct_scan', label: 'CT Scan' },
  { value: 'mri', label: 'MRI' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'ecg', label: 'ECG' },
  { value: 'echo', label: 'Echo' },
];

const urgencyOptions: { value: Urgency; label: string; color: string; activeBg: string }[] = [
  { value: 'routine', label: 'Routine', color: 'text-foreground', activeBg: 'bg-primary text-white' },
  { value: 'urgent', label: 'Urgent', color: 'text-secondary', activeBg: 'bg-secondary text-white' },
  { value: 'stat', label: 'STAT', color: 'text-error', activeBg: 'bg-error text-white' },
];

export function ImagingRequestDialog({ open, onOpenChange, patientId, visitId }: ImagingRequestDialogProps) {
  // Catalog-pick path (preferred) — the admin-maintained imaging catalog.
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selected, setSelected] = useState<ImagingCatalogItem | null>(null);

  // Manual / ad-hoc path (fallback for studies not in the catalog).
  const [imagingType, setImagingType] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [notes, setNotes] = useState('');

  // Fetch the whole catalog once while the dialog is open; search filters it
  // client-side so quick-pick buttons always resolve to their tariff (and
  // there's no long default list to scroll).
  const catalogQ = useImagingCatalog(open && !selected ? { limit: 100 } : undefined);
  const catalogItems = catalogQ.data ?? [];

  const search = catalogSearch.trim().toLowerCase();
  const searchResults = search
    ? catalogItems.filter(
        (i) =>
          i.serviceName.toLowerCase().includes(search) ||
          (i.modality ? (MODALITY_LABELS[i.modality] ?? i.modality).toLowerCase().includes(search) : false),
      )
    : [];

  const createImagingRequest = useCreateImagingRequest();

  const pickService = (item: ImagingCatalogItem) => {
    setSelected(item);
    setImagingType(item.modality ?? 'other');
    // The doctor writes the body part themselves — never auto-fill it.
    setCatalogSearch('');
  };

  // Resolve a quick-button modality to its catalog tariff (so the price +
  // serviceTariffId carry through). Prefer the base row whose serviceCode equals
  // the modality; otherwise the first tariff with that modality.
  const findItemForModality = (mod: string) => {
    const matches = catalogItems.filter((i) => i.modality === mod);
    if (matches.length === 0) return null;
    return matches.find((i) => (i.serviceCode ?? '').toLowerCase() === mod) ?? matches[0];
  };

  const pickModality = (mod: string) => {
    const item = findItemForModality(mod);
    if (item) {
      pickService(item);
    } else {
      // Ad-hoc fallback if the admin hasn't configured this modality.
      setImagingType(mod);
      setSelected(null);
      setCatalogSearch('');
    }
  };

  const clearSelection = () => {
    setSelected(null);
    setImagingType('');
    setBodyPart('');
  };

  const handleSubmit = async () => {
    if (!imagingType) {
      toast.error('Pick a study from the catalog or choose an imaging type');
      return;
    }
    if (!visitId) {
      toast.error('A visit is required to request imaging');
      return;
    }

    try {
      await createImagingRequest.mutateAsync({
        patientId,
        visitId,
        imagingType,
        bodyPart: bodyPart.trim() || undefined,
        clinicalIndication: clinicalIndication.trim() || undefined,
        urgency,
        notes: notes.trim() || undefined,
        serviceTariffId: selected?.id,
      });
      toast.success('Imaging request created successfully');
      handleReset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create imaging request');
    }
  };

  const handleReset = () => {
    setCatalogSearch('');
    setSelected(null);
    setImagingType('');
    setBodyPart('');
    setClinicalIndication('');
    setUrgency('routine');
    setNotes('');
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) handleReset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Request Imaging
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* ── Catalog search / selection ── */}
          {selected ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{selected.serviceName}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {selected.modality && (
                      <Badge variant="outline" className="text-[10px]">
                        {MODALITY_LABELS[selected.modality] ?? selected.modality}
                      </Badge>
                    )}
                    <span className="inline-flex items-center">
                      <IndianRupee className="h-3 w-3" />
                      {Number(selected.basePrice).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={clearSelection} title="Change study">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium">Imaging Modality</Label>

              {/* Quick-pick buttons for the common studies */}
              <div className="mt-1.5 flex flex-wrap gap-2">
                {QUICK_MODALITIES.map((m) => {
                  const item = findItemForModality(m.value);
                  const active = !selected && imagingType === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => pickModality(m.value)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium border transition-all duration-200',
                        active
                          ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                          : 'bg-card border-border hover:border-primary/40 text-foreground',
                      )}
                    >
                      {m.label}
                      {item && (
                        <span className={cn('ml-1.5 text-[10px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          ₹{Number(item.basePrice).toLocaleString('en-IN')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search for anything else */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search other studies…"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              {/* Results — only while searching, so there's no long default list to scroll */}
              {search.length >= 1 && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-surface-container divide-y">
                  {catalogQ.isLoading ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline-block" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pickService(item)}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{item.serviceName}</span>
                          <span className="text-xs text-muted-foreground inline-flex items-center shrink-0">
                            <IndianRupee className="h-3 w-3" />
                            {Number(item.basePrice).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No modality matches your search.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Body Part */}
          <div>
            <Label className="text-sm font-medium">Body Part / Region</Label>
            <Input
              placeholder="e.g., Chest, Left Knee, Abdomen..."
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              className="mt-1.5 text-sm"
            />
          </div>

          {/* Clinical Indication */}
          <div>
            <Label className="text-sm font-medium">Clinical Indication</Label>
            <Textarea
              placeholder="Reason for imaging, symptoms, suspected condition..."
              value={clinicalIndication}
              onChange={(e) => setClinicalIndication(e.target.value)}
              rows={3}
              className="mt-1.5 text-sm"
            />
          </div>

          {/* Urgency */}
          <div>
            <Label className="text-sm font-medium">Urgency</Label>
            <div className="mt-1.5 flex gap-2">
              {urgencyOptions.map((opt) => (
                <button
                  key={opt.value}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createImagingRequest.isPending || !imagingType}
              className="gap-1.5"
            >
              {createImagingRequest.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <ScanLine className="h-3.5 w-3.5" />
                  Request Imaging
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
