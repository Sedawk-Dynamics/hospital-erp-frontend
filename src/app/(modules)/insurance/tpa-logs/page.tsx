'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { fullName } from '@/lib/person-name';
import {
  useTpaLogs,
  useTpas,
  type CommunicationDirection,
  type CommunicationType,
} from '@/hooks/use-insurance';

const TYPE_LABELS: Record<CommunicationType, string> = {
  phone: 'Phone call',
  email: 'Email',
  portal: 'Portal',
  letter: 'Letter',
};

export default function TpaLogsPage() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<CommunicationDirection | 'all'>('all');
  const [type, setType] = useState<CommunicationType | 'all'>('all');
  const [origin, setOrigin] = useState<'all' | 'system' | 'manual'>('all');
  const [tpaId, setTpaId] = useState<string>('all');

  const { data: tpaData } = useTpas({ limit: 200 });
  const { data, isLoading } = useTpaLogs({
    search: search || undefined,
    direction: direction === 'all' ? undefined : direction,
    communicationType: type === 'all' ? undefined : type,
    isSystem: origin === 'all' ? undefined : origin === 'system',
    tpaId: tpaId === 'all' ? undefined : tpaId,
    limit: 100,
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold">TPA Communications</h1>
        <p className="text-sm text-on-surface-variant">
          Every exchange with an insurer or TPA, across all claims and pre-authorizations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> Communication Log
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={direction}
                onValueChange={(v) => v && setDirection(v as CommunicationDirection | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Either way</SelectItem>
                  <SelectItem value="outbound">We contacted them</SelectItem>
                  <SelectItem value="inbound">They contacted us</SelectItem>
                </SelectContent>
              </Select>

              <Select value={type} onValueChange={(v) => v && setType(v as CommunicationType | 'all')}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any channel</SelectItem>
                  <SelectItem value="phone">Phone call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={origin}
                onValueChange={(v) => v && setOrigin(v as 'all' | 'system' | 'manual')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entries</SelectItem>
                  <SelectItem value="system">Automatic only</SelectItem>
                  <SelectItem value="manual">Logged by hand</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tpaId} onValueChange={(v) => v && setTpaId(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any TPA</SelectItem>
                  {(tpaData?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
                <Input
                  placeholder="Search subject or notes"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Way</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>TPA</TableHead>
                  <TableHead>Recorded by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-on-surface-variant">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-on-surface-variant">
                      Nothing recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const inbound = log.direction === 'inbound';
                    const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              inbound
                                ? 'inline-flex items-center gap-1 text-sm text-emerald-700'
                                : 'inline-flex items-center gap-1 text-sm text-sky-700'
                            }
                          >
                            <Icon className="size-3.5" />
                            {inbound ? 'In' : 'Out'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.subject}</span>
                            {log.isSystem ? (
                              <Badge variant="outline" className="text-xs">
                                Automatic
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                {log.communicationType
                                  ? TYPE_LABELS[log.communicationType]
                                  : 'By hand'}
                              </Badge>
                            )}
                          </div>
                          {log.content && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                              {log.content}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.claim ? (
                            <Link
                              href={`/insurance/claims/${log.claim.id}`}
                              className="text-primary hover:underline"
                            >
                              {log.claim.claimNumber ?? 'Claim'}
                            </Link>
                          ) : log.preAuth ? (
                            <span className="text-on-surface-variant">
                              {log.preAuth.procedureDescription}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">General enquiry</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.tpa?.name ?? (
                            <span className="text-on-surface-variant">Insurer direct</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {fullName(log.communicator, '—')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
