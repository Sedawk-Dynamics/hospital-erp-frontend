'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Plus, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/date-utils';
import { useTpaLogs, useCreateTpaLog, useTpas } from '@/hooks/use-insurance';

export default function TpaLogsPage() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [tpaFilter, setTpaFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    tpaId: '',
    claimId: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    communicationType: 'email' as 'email' | 'phone' | 'portal' | 'letter',
    subject: '',
    content: '',
  });

  const { data: tpas } = useTpas({ isActive: true, limit: 100 });
  const { data, isLoading } = useTpaLogs({
    search: search || undefined,
    direction: direction === 'all' ? undefined : direction,
    tpaId: tpaFilter || undefined,
  });

  const createMut = useCreateTpaLog();

  async function handleCreate() {
    if (!form.tpaId) return toast.error('Pick a TPA');
    try {
      await createMut.mutateAsync({
        tpaId: form.tpaId,
        claimId: form.claimId.trim() || undefined,
        direction: form.direction,
        communicationType: form.communicationType,
        subject: form.subject.trim() || undefined,
        content: form.content.trim() || undefined,
      });
      toast.success('Log recorded');
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Log failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">TPA Communication Logs</h1>
          <p className="text-sm text-on-surface-variant">
            Audit trail of every back-and-forth with third-party administrators.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> New Log
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Communication Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={direction}
                onValueChange={(v) => v && setDirection(v as typeof direction)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={tpaFilter || null}
                onValueChange={(v) => setTpaFilter((v as string) ?? '')}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All TPAs" />
                </SelectTrigger>
                <SelectContent>
                  {tpas?.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
                <Input
                  placeholder="Search subject / content"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            {data?.data?.length ?? 0} of {data?.meta?.total ?? 0} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>TPA</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-on-surface-variant">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.data?.length ? (
                data.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell>
                      {l.direction === 'inbound' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border">
                          <ArrowDown className="size-3" /> Inbound
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-100 text-sky-700 border-sky-300 border">
                          <ArrowUp className="size-3" /> Outbound
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{l.tpa?.name ?? '—'}</TableCell>
                    <TableCell>
                      {l.claim?.id ? (
                        <Link
                          href={`/insurance/claims/${l.claim.id}`}
                          className="text-primary hover:underline"
                        >
                          {l.claim.claimNumber ?? l.claim.id.slice(0, 8)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{l.communicationType ?? '—'}</TableCell>
                    <TableCell className="max-w-md truncate">{l.subject ?? '—'}</TableCell>
                    <TableCell>
                      {l.communicator
                        ? `${l.communicator.firstName} ${l.communicator.lastName ?? ''}`.trim()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-on-surface-variant">
                    No communication logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log TPA Communication</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>TPA</Label>
              <Select
                value={form.tpaId || null}
                onValueChange={(v) => v && setForm({ ...form, tpaId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick TPA" />
                </SelectTrigger>
                <SelectContent>
                  {tpas?.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Claim ID (optional)</Label>
              <Input
                placeholder="e.g. paste claim UUID, or leave blank for general"
                value={form.claimId}
                onChange={(e) => setForm({ ...form, claimId: e.target.value })}
              />
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(v) =>
                  v && setForm({ ...form, direction: v as 'inbound' | 'outbound' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select
                value={form.communicationType}
                onValueChange={(v) =>
                  v &&
                  setForm({
                    ...form,
                    communicationType: v as 'email' | 'phone' | 'portal' | 'letter',
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Content</Label>
              <Textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
