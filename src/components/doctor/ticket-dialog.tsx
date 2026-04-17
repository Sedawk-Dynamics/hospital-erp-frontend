'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateTicket, useDoctorProfile } from '@/hooks/use-doctor';
import { useDoctorsList } from '@/hooks/use-hospital';
import {
  PatientVisitPicker,
  type SelectedPatient,
} from './patient-visit-picker';

type TicketType =
  | 'appointment_request'
  | 'op_to_ip'
  | 'complaint'
  | 'service_request'
  | 'equipment_fault'
  | 'general';

type Priority = 'low' | 'medium' | 'high' | 'critical';

const TICKET_TYPE_OPTIONS: { value: TicketType; label: string; description?: string }[] = [
  { value: 'op_to_ip', label: 'OP to IP', description: 'Refer / admit this OP patient to IP' },
  { value: 'appointment_request', label: 'Appointment Request' },
  { value: 'service_request', label: 'Service Request (Referral)' },
  { value: 'equipment_fault', label: 'Equipment Fault' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'general', label: 'General' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; activeBg: string; color: string }[] = [
  { value: 'low', label: 'Low', activeBg: 'bg-muted text-foreground', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', activeBg: 'bg-primary text-primary-foreground', color: 'text-foreground' },
  { value: 'high', label: 'High', activeBg: 'bg-secondary text-secondary-foreground', color: 'text-secondary' },
  { value: 'critical', label: 'Critical', activeBg: 'bg-destructive text-destructive-foreground', color: 'text-destructive' },
];

interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPatient?: SelectedPatient | null;
  initialType?: TicketType;
}

export function TicketDialog({
  open,
  onOpenChange,
  initialPatient = null,
  initialType = 'op_to_ip',
}: TicketDialogProps) {
  const { data: myDoctor } = useDoctorProfile();
  const { data: doctors } = useDoctorsList();

  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(initialPatient);
  const [ticketType, setTicketType] = useState<TicketType>(initialType);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState<string>('none');

  const createTicket = useCreateTicket();

  const reset = useCallback(() => {
    setSelectedPatient(initialPatient);
    setTicketType(initialType);
    setSubject('');
    setDescription('');
    setPriority('medium');
    setAssignedTo('none');
  }, [initialPatient, initialType]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Sensible default subject hints per ticket type
  useEffect(() => {
    if (!open || subject.trim()) return;
    if (ticketType === 'op_to_ip') setSubject('OP-to-IP admission request');
    else if (ticketType === 'service_request') setSubject('Cross-department referral');
  }, [ticketType, open, subject]);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    try {
      await createTicket.mutateAsync({
        ticketType,
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
        patientId: selectedPatient?.id,
        assignedTo: assignedTo && assignedTo !== 'none' ? assignedTo : undefined,
      });
      toast.success('Ticket raised');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to raise ticket');
    }
  };

  const otherDoctors = (doctors ?? []).filter((d) => d.id !== myDoctor?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Raise a Ticket
          </DialogTitle>
          <DialogDescription>
            Use tickets for OP-to-IP admissions, inter-department referrals, or operational requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Ticket Type
            </Label>
            <Select value={ticketType} onValueChange={(v) => v && setTicketType(v as TicketType)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.description && (
                      <span className="text-xs text-muted-foreground ml-2">— {opt.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <PatientVisitPicker
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            selectedVisitId=""
            onSelectVisitId={() => {}}
            requireVisit={false}
          />

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Subject
            </Label>
            <Input
              placeholder="Short summary of the request"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Description
            </Label>
            <Textarea
              placeholder="Clinical rationale, required action, timeline..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Priority
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-medium border transition-all duration-200',
                    priority === opt.value
                      ? opt.activeBg + ' border-transparent shadow-sm'
                      : 'bg-card border-border hover:border-primary/40 ' + opt.color,
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Assign To (optional)
            </Label>
            <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? 'none')}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {otherDoctors.map((d) => {
                  const name = d.user
                    ? `Dr. ${d.user.firstName ?? ''} ${d.user.lastName ?? ''}`.trim()
                    : d.id;
                  const spec = d.specialization ? ` — ${d.specialization}` : '';
                  const userId = d.user?.id;
                  if (!userId) return null;
                  return (
                    <SelectItem key={d.id} value={userId}>
                      {name}
                      {spec}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={createTicket.isPending || !subject.trim()}
          >
            {createTicket.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            Raise Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
