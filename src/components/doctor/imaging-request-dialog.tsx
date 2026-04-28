'use client';

import { useState, useEffect } from 'react';
import { useCreateImagingRequest } from '@/hooks/use-doctor';
import { useActionFormsTrigger } from '@/hooks/use-action-forms-trigger';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ScanLine, Loader2 } from 'lucide-react';
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

const urgencyOptions: { value: Urgency; label: string; color: string; activeBg: string }[] = [
  { value: 'routine', label: 'Routine', color: 'text-foreground', activeBg: 'bg-primary text-white' },
  { value: 'urgent', label: 'Urgent', color: 'text-secondary', activeBg: 'bg-secondary text-white' },
  { value: 'stat', label: 'STAT', color: 'text-error', activeBg: 'bg-error text-white' },
];

export function ImagingRequestDialog({ open, onOpenChange, patientId, visitId }: ImagingRequestDialogProps) {
  const [imagingType, setImagingType] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [notes, setNotes] = useState('');

  const filteredTypes = typeSearch.trim()
    ? imagingTypes.filter((t) =>
        t.label.toLowerCase().includes(typeSearch.trim().toLowerCase()),
      )
    : imagingTypes;

  const createImagingRequest = useCreateImagingRequest();
  const formsTrigger = useActionFormsTrigger();

  const handleSubmit = async () => {
    if (!imagingType) {
      toast.error('Please select an imaging type');
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
      });
      toast.success('Imaging request created successfully');
      handleReset();
      onOpenChange(false);
      // Fire any forms assigned to imaging_request_created trigger
      formsTrigger.fire('imaging_request_created', undefined, {
        patientId,
        visitId,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create imaging request');
    }
  };

  const handleReset = () => {
    setImagingType('');
    setTypeSearch('');
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
          {/* Imaging Type */}
          <div>
            <Label className="text-sm font-medium">Imaging Type</Label>
            <Input
              placeholder="Search imaging type..."
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
              className="mt-1.5 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {filteredTypes.length === 0 ? (
                <span className="text-xs text-muted-foreground">No types match.</span>
              ) : (
                filteredTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setImagingType(type.value)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium border transition-all duration-200',
                      imagingType === type.value
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'bg-card border-border hover:border-primary/40 text-foreground',
                    )}
                  >
                    {type.label}
                  </button>
                ))
              )}
            </div>
          </div>

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

      {/* Forms assigned to imaging_request_created trigger fire after request creation */}
      <IntakeFormsModal
        open={formsTrigger.isOpen}
        trigger="imaging_request_created"
        tenantId={formsTrigger.tenantId}
        context={formsTrigger.context}
        onComplete={formsTrigger.close}
      />
    </Dialog>
  );
}
