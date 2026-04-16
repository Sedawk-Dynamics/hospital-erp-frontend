'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toInputDateStr } from '@/lib/date-utils';
import {
  useApplyDoctorLeave,
  type DoctorLeaveType,
  type DoctorLeaveDayType,
} from '@/hooks/use-doctor-leaves';

const LEAVE_TYPES: { value: DoctorLeaveType; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'sick', label: 'Sick' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'other', label: 'Other' },
];

const DAY_TYPES: { value: DoctorLeaveDayType; label: string }[] = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'half_day_morning', label: 'Half Day — Morning (00:00-13:00)' },
  { value: 'half_day_afternoon', label: 'Half Day — Afternoon (13:00-23:59)' },
  { value: 'custom_hours', label: 'Specific Hours' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctorId: string;
  /** Pre-select a date from a calendar click. */
  initialDate?: string;
}

export function ApplyLeaveDialog({ open, onOpenChange, doctorId, initialDate }: Props) {
  const today = toInputDateStr();
  const [startDate, setStartDate] = useState(initialDate ?? today);
  const [endDate, setEndDate] = useState(initialDate ?? today);
  const [leaveType, setLeaveType] = useState<DoctorLeaveType>('casual');
  const [dayType, setDayType] = useState<DoctorLeaveDayType>('full_day');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('11:00');
  const [reason, setReason] = useState('');

  const applyMutation = useApplyDoctorLeave(doctorId);

  const reset = () => {
    setStartDate(initialDate ?? today);
    setEndDate(initialDate ?? today);
    setLeaveType('casual');
    setDayType('full_day');
    setStartHour('09:00');
    setEndHour('11:00');
    setReason('');
  };

  // When caller changes initialDate (e.g. user clicks a different calendar cell), sync.
  useEffect(() => {
    if (initialDate && open) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    }
  }, [initialDate, open]);

  const isRange = dayType === 'full_day';
  const isCustomHours = dayType === 'custom_hours';
  const effectiveEndDate = isRange ? endDate : startDate;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    if (isRange && effectiveEndDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (isCustomHours && startHour >= endHour) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      await applyMutation.mutateAsync({
        startDate,
        endDate: effectiveEndDate,
        leaveType,
        dayType,
        reason: reason.trim(),
        ...(isCustomHours ? { startTime: startHour, endTime: endHour } : {}),
      });
      toast.success('Leave request submitted');
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit leave');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>
            Submit a leave request. It will be reviewed by HR / Hospital Admin before it takes effect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leaveType">Leave Type</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType((v as DoctorLeaveType) ?? 'casual')}>
                <SelectTrigger id="leaveType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dayType">Duration</Label>
              <Select value={dayType} onValueChange={(v) => setDayType((v as DoctorLeaveDayType) ?? 'full_day')}>
                <SelectTrigger id="dayType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">{isRange ? 'From' : 'Date'}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!isRange || e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            {isRange && (
              <div className="space-y-1.5">
                <Label htmlFor="endDate">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {isCustomHours && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed px-3 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="startHour">Start Time</Label>
                <Input
                  id="startHour"
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endHour">End Time</Label>
                <Input
                  id="endHour"
                  type="time"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Only slots overlapping this range will be blocked. Shifts outside this window remain bookable.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Briefly explain the reason for leave"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground text-right">{reason.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applyMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={applyMutation.isPending}>
            {applyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
