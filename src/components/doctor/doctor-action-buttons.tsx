'use client';

import { Button } from '@/components/ui/button';
import {
  CalendarClock,
  ClipboardList,
  Unlock,
  ArrowLeftRight,
  Bell,
  Printer,
  Monitor,
  UserX,
  OctagonAlert,
} from 'lucide-react';

interface DoctorActionButtonsProps {
  telemedicineCount?: number;
  transferredCount?: number;
}

export function DoctorActionButtons({
  telemedicineCount = 0,
  transferredCount = 0,
}: DoctorActionButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" />
        Follow-up
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" />
        Doctor Requests
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5">
        <Unlock className="h-3.5 w-3.5" />
        Unlocked Notes
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Transfer Request
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5">
        <Bell className="h-3.5 w-3.5" />
        Requests
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5">
        <Printer className="h-3.5 w-3.5" />
        Print
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Monitor className="h-3.5 w-3.5" />
          Telemedicine ({telemedicineCount})
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserX className="h-3.5 w-3.5" />
          Transferred ({transferredCount})
        </Button>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <OctagonAlert className="h-3.5 w-3.5" />
          STOP EMERGENCY
        </Button>
      </div>
    </div>
  );
}
