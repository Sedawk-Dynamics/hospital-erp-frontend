'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/date-utils';
import { fullName } from '@/lib/person-name';
import {
  useTpaLogs,
  useCreateTpaLog,
  type CommunicationDirection,
  type CommunicationType,
  type TpaCommunicationLog,
} from '@/hooks/use-insurance';

interface Props {
  /** The claim this log belongs to. Give this or `preAuthId`, not both. */
  claimId?: string;
  /** The pre-authorization this log belongs to. */
  preAuthId?: string;
  /**
   * Drop the card chrome, for when the panel already sits inside one — a
   * dialog, say. A card nested in a dialog reads as a box inside a box.
   */
  embedded?: boolean;
}

const TYPE_LABELS: Record<CommunicationType, string> = {
  phone: 'Phone call',
  email: 'Email',
  portal: 'Portal',
  letter: 'Letter',
};

interface FormState {
  communicationType: CommunicationType;
  direction: CommunicationDirection;
  subject: string;
  content: string;
}

const EMPTY_FORM: FormState = {
  communicationType: 'phone',
  direction: 'outbound',
  subject: '',
  content: '',
};

/**
 * The running record of what has passed between the hospital and the insurer
 * over one claim or pre-authorization.
 *
 * Most entries write themselves as the claim moves; the button is for the ones
 * that do not leave a trace on their own — a phone call, an emailed query.
 */
export function CommunicationLogPanel({ claimId, preAuthId, embedded = false }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useTpaLogs({ claimId, preAuthId, limit: 100 });
  const createMut = useCreateTpaLog();

  const logs = data?.data ?? [];

  async function handleSubmit() {
    if (!form.subject.trim()) {
      toast.error('Give the entry a subject');
      return;
    }
    try {
      await createMut.mutateAsync({
        claimId,
        preAuthId,
        communicationType: form.communicationType,
        direction: form.direction,
        subject: form.subject.trim(),
        content: form.content.trim() || undefined,
      });
      toast.success('Communication logged');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Could not log the communication');
    }
  }

  const addButton = (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={() => {
        setForm(EMPTY_FORM);
        setDialogOpen(true);
      }}
    >
      <Plus className="size-4" /> Log communication
    </Button>
  );

  const body = isLoading ? (
    <p className="py-6 text-center text-sm text-on-surface-variant">Loading…</p>
  ) : logs.length === 0 ? (
    <p className="py-6 text-center text-sm text-on-surface-variant">
      Nothing recorded yet. Steps such as submission and approval are logged automatically; use
      the button above for a call or an email.
    </p>
  ) : (
    <ol className="space-y-3">
      {logs.map((log) => (
        <LogEntry key={log.id} log={log} />
      ))}
    </ol>
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-3">
          <div className="flex justify-end">{addButton}</div>
          <div className="max-h-[50vh] overflow-y-auto pr-1">{body}</div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" /> Communication Log
                </CardTitle>
                <CardDescription>
                  Everything sent to and received from the insurer, in order.
                </CardDescription>
              </div>
              {addButton}
            </div>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a communication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>How</Label>
                <Select
                  value={form.communicationType}
                  onValueChange={(v) =>
                    v && setForm((f) => ({ ...f, communicationType: v as CommunicationType }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Which way</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    v && setForm((f) => ({ ...f, direction: v as CommunicationDirection }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">We contacted them</SelectItem>
                    <SelectItem value="inbound">They contacted us</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                maxLength={255}
                placeholder="Chased the settlement"
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>What was said</Label>
              <Textarea
                rows={4}
                value={form.content}
                placeholder="Spoke to the claims desk; the transfer goes out on Friday."
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Save entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LogEntry({ log }: { log: TpaCommunicationLog }) {
  const inbound = log.direction === 'inbound';
  const Icon = inbound ? ArrowDownLeft : ArrowUpRight;

  return (
    <li className="flex gap-3 rounded-lg border border-outline-variant p-3">
      <div
        className={
          inbound
            ? 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700'
            : 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700'
        }
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{log.subject}</span>
          {log.isSystem ? (
            <Badge variant="outline" className="text-xs">
              Automatic
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {log.communicationType ? TYPE_LABELS[log.communicationType] : 'Logged by hand'}
            </Badge>
          )}
        </div>
        {log.content && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">{log.content}</p>
        )}
        <p className="mt-1.5 text-xs text-on-surface-variant">
          {formatDateTime(log.createdAt)}
          {log.communicator && ` · ${fullName(log.communicator, 'Unknown user')}`}
          {log.tpa && ` · ${log.tpa.name}`}
        </p>
      </div>
    </li>
  );
}
