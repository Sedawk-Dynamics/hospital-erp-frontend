'use client';

import { useMemo } from 'react';
import { Bell, ArrowLeftRight, Check, X, Loader2, Inbox } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useInboundTransfers,
  useAssignedTickets,
  useApproveTransfer,
  useDoctorProfile,
} from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateTimeAmPm } from '@/lib/date-utils';

interface DoctorRequestsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DoctorRequestsSheet({ open, onOpenChange }: DoctorRequestsSheetProps) {
  const { user } = useAuthStore();
  const { data: myDoctor } = useDoctorProfile();

  const { data: transfersData, isLoading: transfersLoading, refetch: refetchTransfers } =
    useInboundTransfers(myDoctor?.id, 'requested');
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } =
    useAssignedTickets(user?.id, 'open');

  const transfers = useMemo(() => transfersData?.data ?? [], [transfersData]);
  const tickets = useMemo(() => ticketsData?.data ?? [], [ticketsData]);

  const approveMutation = useApproveTransfer();

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await approveMutation.mutateAsync({ id, status });
      toast.success(`Transfer ${status}`);
      refetchTransfers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${status} transfer`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Doctor Requests
          </SheetTitle>
          <SheetDescription>
            Inbound transfers and tickets assigned to you.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="transfers" className="mt-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="transfers" className="gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfers
              {transfers.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {transfers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Tickets
              {tickets.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {tickets.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Transfers */}
          <TabsContent value="transfers" className="mt-3 space-y-3">
            {transfersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : transfers.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <ArrowLeftRight className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No pending transfers.</p>
              </div>
            ) : (
              transfers.map((t) => {
                const anyT = t as any;
                const patient = anyT.patient;
                const fromDoctor = anyT.fromDoctor;
                const patientName = patient
                  ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
                  : '—';
                const fromName = fromDoctor?.user
                  ? `Dr. ${fromDoctor.user.firstName ?? ''} ${fromDoctor.user.lastName ?? ''}`.trim()
                  : 'Unknown';
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border bg-surface-container-lowest p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{patientName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          MRN: {patient?.mrn || '-'} · from {fromName}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                        {t.status}
                      </span>
                    </div>
                    {t.reason && (
                      <p className="mt-2 text-xs text-muted-foreground">Reason: {t.reason}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTimeAmPm(t.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleApprove(t.id, 'rejected')}
                          disabled={approveMutation.isPending}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApprove(t.id, 'approved')}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Tickets */}
          <TabsContent value="tickets" className="mt-3 space-y-3">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No open tickets assigned.</p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const anyTicket = ticket as any;
                const raisedByName = anyTicket.raiser
                  ? `${anyTicket.raiser.firstName ?? ''} ${anyTicket.raiser.lastName ?? ''}`.trim()
                  : 'Unknown';
                const patient = anyTicket.patient;
                const priorityStyles: Record<string, string> = {
                  low: 'bg-muted text-foreground',
                  medium: 'bg-primary/10 text-primary',
                  high: 'bg-secondary/10 text-secondary',
                  critical: 'bg-destructive/10 text-destructive',
                };
                const priorityStyle =
                  priorityStyles[ticket.priority] ?? 'bg-muted text-foreground';
                return (
                  <div
                    key={ticket.id}
                    className="rounded-lg border bg-surface-container-lowest p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                        <p className="text-[10px] text-muted-foreground">
                          #{ticket.ticketNumber} · {ticket.ticketType.replace(/_/g, ' ')} · from{' '}
                          {raisedByName}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityStyle}`}
                      >
                        {ticket.priority}
                      </span>
                    </div>
                    {ticket.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {ticket.description}
                      </p>
                    )}
                    {patient && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Patient: {patient.firstName} {patient.lastName ?? ''}
                        {patient.mrn ? ` (MRN: ${patient.mrn})` : ''}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateTimeAmPm(ticket.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchTransfers();
              refetchTickets();
            }}
          >
            Refresh
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
