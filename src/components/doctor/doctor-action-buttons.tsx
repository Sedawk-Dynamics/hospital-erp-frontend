'use client';

import { useState } from 'react';
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
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useInboundTransfers,
  useAssignedTickets,
  useUnlockedProgressNotes,
  useDoctorProfile,
} from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import { PatientTransferDialog } from './patient-transfer-dialog';
import { OTRequestDialog } from './ot-request-dialog';
import { TicketDialog } from './ticket-dialog';
import { UnlockedNotesSheet } from './unlocked-notes-sheet';
import { DoctorRequestsSheet } from './doctor-requests-sheet';
import { PrintPrescriptionDialog } from './print-prescription-dialog';
import type { SelectedPatient } from './patient-visit-picker';

interface DoctorActionButtonsProps {
  telemedicineCount?: number;
  transferredCount?: number;
  /** When rendered inside a patient-in-context view, prefill the dialogs. */
  initialPatient?: SelectedPatient | null;
  initialVisitId?: string;
  /** Whether the parent is currently filtering to telemedicine appointments. */
  telemedicineActive?: boolean;
  /** Called when the Telemedicine button is clicked; parent should toggle filter. */
  onToggleTelemedicine?: () => void;
}

export function DoctorActionButtons({
  telemedicineCount = 0,
  transferredCount = 0,
  initialPatient = null,
  initialVisitId = '',
  telemedicineActive = false,
  onToggleTelemedicine,
}: DoctorActionButtonsProps) {
  const { user } = useAuthStore();
  const { data: myDoctor } = useDoctorProfile();

  const [transferOpen, setTransferOpen] = useState(false);
  const [otOpen, setOtOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [unlockedOpen, setUnlockedOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  // Live counts for the button badges
  const { data: unlockedNotes } = useUnlockedProgressNotes(true);
  const { data: inboundTransfers } = useInboundTransfers(myDoctor?.id, 'requested');
  const { data: assignedTickets } = useAssignedTickets(user?.id, 'open');

  const unlockedCount = unlockedNotes?.length ?? 0;
  const requestsCount =
    (inboundTransfers?.data?.length ?? 0) + (assignedTickets?.data?.length ?? 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Follow-up
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOtOpen(true)}
          title="Raise an OT request"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          OT Request
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setUnlockedOpen(true)}
          title="Notes temporarily unlocked for editing"
        >
          <Unlock className="h-3.5 w-3.5" />
          Unlocked Notes
          {unlockedCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
              {unlockedCount}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setTransferOpen(true)}
          title="Transfer patient to another doctor"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Transfer Patient
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setTicketOpen(true)}
          title="Raise a ticket (OP-to-IP / referral / service request)"
        >
          <Bell className="h-3.5 w-3.5" />
          Raise Ticket
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setRequestsOpen(true)}
          title="Inbound transfers and tickets assigned to you"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Doctor Requests
          {requestsCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {requestsCount}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setPrintOpen(true)}
          title="Print a prescription for a specific patient"
        >
          <Printer className="h-3.5 w-3.5" />
          Print Prescription
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5',
              telemedicineActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
            onClick={onToggleTelemedicine}
            disabled={!onToggleTelemedicine}
            title={
              telemedicineActive
                ? 'Showing only telemedicine appointments — click to clear'
                : 'Filter the table to telemedicine appointments'
            }
          >
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

      <PatientTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        initialPatient={initialPatient}
        initialVisitId={initialVisitId}
      />
      <OTRequestDialog
        open={otOpen}
        onOpenChange={setOtOpen}
        initialPatient={initialPatient}
        initialVisitId={initialVisitId}
      />
      <TicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        initialPatient={initialPatient}
      />
      <UnlockedNotesSheet open={unlockedOpen} onOpenChange={setUnlockedOpen} />
      <DoctorRequestsSheet open={requestsOpen} onOpenChange={setRequestsOpen} />
      <PrintPrescriptionDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        initialPatient={initialPatient}
      />
    </>
  );
}
