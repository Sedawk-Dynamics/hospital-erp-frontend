'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  emergencyIntakeSchema,
  EMERGENCY_INTAKE_DEFAULTS,
  type EmergencyIntakeDetails,
} from '../../lib/schema/emergency-intake-schema';

// Re-exported so existing imports from this module keep working.
export type { EmergencyIntakeDetails } from '../../lib/schema/emergency-intake-schema';

/** ESI triage priority options. */
const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'resuscitation', label: '🔴 Priority 1 – Resuscitation' },
  { value: 'emergent', label: '🟠 Priority 2 – Emergent (<15 min)' },
  { value: 'urgent', label: '🟡 Priority 3 – Urgent (<60 min)' },
  { value: 'non_urgent', label: '🟢 Priority 4 – Non-urgent' },
];

/** Who/what brought the patient in. */
const BROUGHT_BY_OPTIONS: { value: string; label: string }[] = [
  { value: 'cat_108', label: 'CAT 108 Emergency Ambulance' },
  { value: 'private_ambulance', label: 'Private ALS/BLS Ambulance' },
  { value: 'police', label: 'Police Escort / PCR Van' },
  { value: 'good_samaritan', label: 'Good Samaritan (Bystander)' },
  { value: 'relative', label: 'Relative / Family Member' },
  { value: 'self', label: 'Self Walk-in' },
];

interface EmergencyIntakeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (details: EmergencyIntakeDetails) => void;
}

export function EmergencyIntakeDialog({ open, setOpen, onSave }: EmergencyIntakeDialogProps) {
  const emergencyForm = useForm<EmergencyIntakeDetails>({
    resolver: zodResolver(emergencyIntakeSchema),
    defaultValues: EMERGENCY_INTAKE_DEFAULTS,
  });

  const { errors } = emergencyForm.formState;

  // Reset the form whenever the dialog is closed so it never reopens dirty.
  useEffect(() => {
    if (!open) emergencyForm.reset(EMERGENCY_INTAKE_DEFAULTS);
  }, [open, emergencyForm]);

  const submit = emergencyForm.handleSubmit((data) => {
    onSave(data);
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emergency Intake</DialogTitle>
          <DialogDescription>
            Capture the triage and arrival details for this temporary patient.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency Severity Index (ESI) Triage Classification
            </p>

            <div className="space-y-1.5">
              <Label>Triage Priority *</Label>
              <Controller
                control={emergencyForm.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select triage priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority && (
                <p className="text-xs text-destructive">{errors.priority.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ei-chief-complaint">Chief Complaint</Label>
              <Textarea
                id="ei-chief-complaint"
                rows={2}
                placeholder="e.g. Chest pain, RTA with head injury, breathlessness"
                {...emergencyForm.register('chiefComplaint')}
              />
              {errors.chiefComplaint && (
                <p className="text-xs text-destructive">{errors.chiefComplaint.message}</p>
              )}
            </div>
          </div>

          {/* ── Section 2 — Brought-By Provenance & Transport Registry ── */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Brought-By Provenance &amp; Transport Registry
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Brought-By Entity *</Label>
                <Controller
                  control={emergencyForm.control}
                  name="broughtBy"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select who brought the patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {BROUGHT_BY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.broughtBy && (
                  <p className="text-xs text-destructive">{errors.broughtBy.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ei-informant-name">Informant / Escort Name *</Label>
                <Input
                  id="ei-informant-name"
                  placeholder="Enter informant / escort name"
                  {...emergencyForm.register('informantName')}
                />
                {errors.informantName && (
                  <p className="text-xs text-destructive">{errors.informantName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ei-contact-phone">Informant Contact Phone *</Label>
                <Input
                  id="ei-contact-phone"
                  placeholder="Enter contact number"
                  {...emergencyForm.register('contactPhone')}
                />
                {errors.contactPhone && (
                  <p className="text-xs text-destructive">{errors.contactPhone.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ei-relationship">Relationship to Patient</Label>
                <Input
                  id="ei-relationship"
                  placeholder='e.g. "CAT Paramedic / Good Samaritan"'
                  {...emergencyForm.register('relationship')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ei-ambulance-number">Ambulance Vehicle Number</Label>
                <Input
                  id="ei-ambulance-number"
                  placeholder="e.g. DL-01-AX-9942"
                  {...emergencyForm.register('ambulanceNumber')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ei-police-badge">Police PCR Badge / Station (if applicable)</Label>
                <Input
                  id="ei-police-badge"
                  placeholder="e.g. PCR South 14"
                  {...emergencyForm.register('policeBadgeStation')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
