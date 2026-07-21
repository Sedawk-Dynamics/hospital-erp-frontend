'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  Building2, Mail, Phone, MapPin, Briefcase, Eye, MessageSquare,
  Shield, Key, Calendar, Loader2, CreditCard, RotateCcw, User, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useDemoRequests,
  useApproveDemoRequest,
  useRejectDemoRequest,
  useEndTrial,
  useDeleteDemoRequest,
  type DemoRequest,
} from '@/hooks/use-demo-request';
import { useAllPlans, useAdminAssignPlan } from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate, formatDateTime } from '@/lib/date-utils';

// ============================================================
// Status config
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-600 border border-amber-200', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-500/10 text-blue-600 border border-blue-200', icon: CheckCircle2 },
  trial_active: { label: 'Trial Active', color: 'bg-green-500/10 text-green-600 border border-green-200', icon: CalendarCheck },
  trial_ended: { label: 'Trial Ended', color: 'bg-gray-500/10 text-gray-600 border border-gray-200', icon: AlertTriangle },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600 border border-red-200', icon: XCircle },
  converted: { label: 'Converted', color: 'bg-purple-500/10 text-purple-600 border border-purple-200', icon: CheckCircle2 },
};

const STATUS_TABS = ['all', 'pending', 'trial_active', 'trial_ended', 'rejected'];

// ============================================================
// Page
// ============================================================

export default function DemoRequestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useDemoRequests({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const { data: plans = [] } = useAllPlans();
  const approveMutation = useApproveDemoRequest();
  const rejectMutation = useRejectDemoRequest();
  const endTrialMutation = useEndTrial();
  const deleteMutation = useDeleteDemoRequest();
  const assignPlanMutation = useAdminAssignPlan();

  // Dialog states
  const [approveTarget, setApproveTarget] = useState<DemoRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DemoRequest | null>(null);
  const [endTrialTarget, setEndTrialTarget] = useState<DemoRequest | null>(null);
  const [detailTarget, setDetailTarget] = useState<DemoRequest | null>(null);
  const [assignTarget, setAssignTarget] = useState<DemoRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DemoRequest | null>(null);

  // Approve form
  const [trialDays, setTrialDays] = useState(14);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reject form
  const [rejectionNote, setRejectionNote] = useState('');

  // Assign plan form
  const [assignPlanIds, setAssignPlanIds] = useState<string[]>([]);


  const requests = data?.data ?? [];
  const meta = data?.meta;

  const handleApprove = async () => {
    if (!approveTarget || !selectedPlanId || !password || password.length < 8) return;
    try {
      await approveMutation.mutateAsync({
        id: approveTarget.id,
        trialDays,
        planId: selectedPlanId,
        password,
      });
      toast.success(`Demo trial approved for ${approveTarget.hospitalName}`);
      setApproveTarget(null);
      setPassword('');
      setSelectedPlanId('');
      setTrialDays(14);
    } catch {
      toast.error('Failed to approve demo request');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectTarget.id, rejectionNote });
      toast.success('Demo request rejected');
      setRejectTarget(null);
      setRejectionNote('');
    } catch {
      toast.error('Failed to reject');
    }
  };

  const handleEndTrial = async () => {
    if (!endTrialTarget) return;
    try {
      await endTrialMutation.mutateAsync(endTrialTarget.id);
      toast.success('Trial ended');
      setEndTrialTarget(null);
    } catch {
      toast.error('Failed to end trial');
    }
  };

  const handleAssignPlan = async () => {
    if (!assignTarget?.createdUserId || assignPlanIds.length === 0) return;
    try {
      await assignPlanMutation.mutateAsync({
        userId: assignTarget.createdUserId,
        planIds: assignPlanIds,
      });
      toast.success(`Plans offered to ${assignTarget.name}`);
      setAssignTarget(null);
      setAssignPlanIds([]);
    } catch {
      toast.error('Failed to offer plans');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Demo request deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete demo request');
    }
  };

  const toggleAssignPlan = (planId: string) => {
    setAssignPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId],
    );
  };

  const trialEndedCount = requests.filter((r) => r.status === 'trial_ended').length;
  const activeCount = requests.filter((r) => r.status === 'trial_active').length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-xl font-bold">Demo Requests</h1>
        <p className="font-label text-sm text-on-surface-variant">
          Manage demo requests, approve trials, and assign plans
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-500/10', Icon: Clock },
          { label: 'Active Trials', value: activeCount, color: 'text-green-600', bg: 'bg-green-500/10', Icon: CalendarCheck },
          { label: 'Trial Ended', value: trialEndedCount, color: 'text-gray-600', bg: 'bg-gray-500/10', Icon: AlertTriangle },
          { label: 'Total', value: meta?.total ?? 0, color: 'text-primary', bg: 'bg-primary/10', Icon: Building2 },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.Icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
              <p className={`font-headline text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search by name, email, hospital..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-surface-container-low border-none rounded-xl pl-4 pr-6 py-2.5 max-w-sm flex-1 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`px-3 py-1.5 rounded-full font-label text-xs font-bold transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container text-left">
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Contact</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Hospital</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold hidden md:table-cell">City</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Status</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold hidden lg:table-cell">Trial Info</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-container">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-shimmer" /></td>
                  ))}
                </tr>
              ))
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Building2 className="h-10 w-10 text-on-surface-variant/30 mx-auto mb-3" />
                  <p className="font-label text-sm text-on-surface-variant">No demo requests found.</p>
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                const isExpired = req.trialEndsAt && new Date(req.trialEndsAt) < new Date();
                return (
                  <tr key={req.id} className="border-b border-surface-container hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-label text-sm font-bold">{req.name}</p>
                      <p className="font-label text-[10px] text-on-surface-variant flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{req.email}</p>
                      <p className="font-label text-[10px] text-on-surface-variant flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{req.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-label text-sm font-medium">{req.hospitalName}</p>
                      <p className="font-label text-[10px] text-on-surface-variant">{req.designation}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-label text-sm">{req.city}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${statusConf.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {req.trialEndsAt ? (
                        <div>
                          <p className="font-label text-xs font-medium">{req.trialDays} days</p>
                          <p className={`font-label text-[10px] ${isExpired ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                            {isExpired ? 'Expired' : 'Ends'} {formatDate(req.trialEndsAt)}
                          </p>
                          {req.trialPlan && (
                            <Badge variant="secondary" className="text-[9px] mt-1 bg-primary/5 text-primary border-0">
                              {req.trialPlan.name}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-on-surface-variant text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {/* View Details */}
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setDetailTarget(req)}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>

                        {/* Pending: Approve / Reject */}
                        {req.status === 'pending' && (
                          <>
                            <Button size="sm" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700" onClick={() => {
                              setApproveTarget(req);
                              if (plans.length > 0 && !selectedPlanId) setSelectedPlanId(plans[0].id);
                            }}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button variant="destructive" size="sm" className="h-7 px-3 text-xs" onClick={() => setRejectTarget(req)}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}

                        {/* Trial Active: End Trial */}
                        {req.status === 'trial_active' && (
                          <Button variant="destructive" size="sm" className="h-7 px-3 text-xs" onClick={() => setEndTrialTarget(req)}>
                            End Trial
                          </Button>
                        )}

                        {/* Trial Ended: Assign Plan (re-activate) */}
                        {req.status === 'trial_ended' && req.createdUserId && (
                          <Button size="sm" className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700" onClick={() => {
                            setAssignTarget(req);
                            setAssignPlanIds([]);
                          }}>
                            <CreditCard className="h-3 w-3 mr-1" /> Assign Plan
                          </Button>
                        )}

                        {/* Trial Active: can also extend with Assign Plan */}
                        {req.status === 'trial_active' && req.createdUserId && (
                          <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => {
                            setAssignTarget(req);
                            setAssignPlanIds([]);
                          }}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Extend
                          </Button>
                        )}

                        {/* Delete */}
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-error hover:bg-error/10 hover:text-error border-error/30" onClick={() => setDeleteTarget(req)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl shadow-sanctuary p-3">
          <p className="font-label text-xs text-on-surface-variant">
            Page {meta.page} of {meta.totalPages} ({meta.total} requests)
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* ─── Detail Dialog ───────────────────────────────────── */}
      <Dialog open={!!detailTarget} onOpenChange={(open) => { if (!open) setDetailTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Demo Request Details
            </DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              {/* Contact card */}
              <div className="bg-surface-container-low rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-headline font-bold text-primary text-sm">
                    {detailTarget.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-label text-sm font-bold">{detailTarget.name}</p>
                    <p className="font-label text-[10px] text-on-surface-variant">{detailTarget.designation}</p>
                  </div>
                  {(() => {
                    const sc = STATUS_CONFIG[detailTarget.status] || STATUS_CONFIG.pending;
                    const Icon = sc.icon;
                    return (
                      <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${sc.color}`}>
                        <Icon className="h-3 w-3" />{sc.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 bg-surface-container-low rounded-lg p-3">
                  <Mail className="h-4 w-4 text-on-surface-variant shrink-0" />
                  <div className="min-w-0">
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Email</p>
                    <p className="font-label text-xs font-medium truncate">{detailTarget.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-surface-container-low rounded-lg p-3">
                  <Phone className="h-4 w-4 text-on-surface-variant shrink-0" />
                  <div>
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Phone</p>
                    <p className="font-label text-xs font-medium">{detailTarget.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-surface-container-low rounded-lg p-3">
                  <Building2 className="h-4 w-4 text-on-surface-variant shrink-0" />
                  <div>
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Hospital</p>
                    <p className="font-label text-xs font-medium">{detailTarget.hospitalName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-surface-container-low rounded-lg p-3">
                  <MapPin className="h-4 w-4 text-on-surface-variant shrink-0" />
                  <div>
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">City</p>
                    <p className="font-label text-xs font-medium">{detailTarget.city}</p>
                  </div>
                </div>
              </div>

              {/* Message */}
              {detailTarget.message && (
                <div className="bg-surface-container-low rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-on-surface-variant" />
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Message</p>
                  </div>
                  <p className="font-label text-sm text-on-surface leading-relaxed">{detailTarget.message}</p>
                </div>
              )}

              {/* Trial info */}
              {detailTarget.trialEndsAt && (
                <div className="bg-primary/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-label text-[10px] text-primary uppercase tracking-wider font-bold">Trial</p>
                    <p className="font-label text-sm font-bold">{detailTarget.trialDays} days &middot; {detailTarget.trialPlan?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Ends</p>
                    <p className="font-label text-sm font-medium">{formatDate(detailTarget.trialEndsAt)}</p>
                  </div>
                </div>
              )}

              <p className="font-label text-[10px] text-on-surface-variant text-center">
                Submitted {formatDateTime(detailTarget.createdAt)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTarget(null)} className="w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Approve Dialog ──────────────────────────────────── */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) setApproveTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Approve Demo Request
            </DialogTitle>
            <DialogDescription>
              This creates a hospital, admin account, and trial subscription.
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="space-y-4">
              {/* Request summary */}
              <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-headline font-bold text-primary text-sm">
                  {approveTarget.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold">{approveTarget.name}</p>
                  <p className="font-label text-[10px] text-on-surface-variant truncate">{approveTarget.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-label text-xs font-bold text-primary">{approveTarget.hospitalName}</p>
                  <p className="font-label text-[10px] text-on-surface-variant">{approveTarget.city}</p>
                </div>
              </div>

              {/* What will be created */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="font-label text-xs font-bold text-green-800 mb-2">This action will create:</p>
                <ul className="space-y-1 font-label text-xs text-green-700">
                  <li className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Hospital: {approveTarget.hospitalName}</li>
                  <li className="flex items-center gap-1.5"><User className="h-3 w-3" /> Admin account: {approveTarget.email}</li>
                  <li className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Free trial with selected plan for {trialDays} days</li>
                </ul>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-bold">Demo Plan <span className="text-error">*</span></Label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 font-label text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <option value="">Select a plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.maxUsers ? ` (${p.maxUsers} users)` : ' (Unlimited)'}
                      </option>
                    ))}
                  </select>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    User gets full access to this plan&apos;s features for free during the trial period.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-bold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Trial Duration (days) <span className="text-error">*</span>
                  </Label>
                  <NumberInput
                    min={1}
                    max={365}
                    value={trialDays}
                    onValueChange={setTrialDays}
                    className="rounded-xl bg-surface-container-low border-outline-variant/30"
                  />
                  <p className="font-label text-[10px] text-on-surface-variant">
                    Trial expires on {formatDate(new Date(Date.now() + trialDays * 86400000))}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-bold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" /> Admin Password <span className="text-error">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="rounded-xl bg-surface-container-low border-outline-variant/30 pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-label text-[10px] text-primary font-bold"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    The user will log in with <strong>{approveTarget.email}</strong> and this password.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveTarget(null)} className="flex-1">Cancel</Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!selectedPlanId || !password || password.length < 8 || approveMutation.isPending}
              onClick={handleApprove}
            >
              {approveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Creating...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve &amp; Create</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ───────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-error" />
              Reject Demo Request
            </DialogTitle>
            <DialogDescription>
              This will reject the request from <strong>{rejectTarget?.name}</strong> ({rejectTarget?.hospitalName}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="font-label text-xs font-bold">Rejection Note (optional)</Label>
              <textarea
                rows={3}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Reason for rejection..."
                className="flex w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 font-label text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={rejectMutation.isPending}
              onClick={handleReject}
            >
              {rejectMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Rejecting...</>
              ) : (
                <><XCircle className="h-4 w-4 mr-1.5" /> Reject Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── End Trial Dialog ────────────────────────────────── */}
      <Dialog open={!!endTrialTarget} onOpenChange={(open) => { if (!open) setEndTrialTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-error" />
              End Trial
            </DialogTitle>
            <DialogDescription>
              This will deactivate <strong>{endTrialTarget?.hospitalName}</strong> and expire the subscription immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-error/5 border border-error/20 rounded-xl p-4">
            <p className="font-label text-xs text-error font-bold mb-1">Warning: This action cannot be undone.</p>
            <ul className="space-y-1 font-label text-xs text-on-surface-variant">
              <li>- Hospital will be deactivated</li>
              <li>- Subscription will be expired</li>
              <li>- User will lose access to hospital modules</li>
            </ul>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEndTrialTarget(null)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={endTrialMutation.isPending}
              onClick={handleEndTrial}
            >
              {endTrialMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Ending...</>
              ) : (
                'End Trial Now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Offer Plans Dialog ────────────────────────────── */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              {assignTarget?.status === 'trial_active' ? 'Offer Plans (Extend)' : 'Offer Plans'}
            </DialogTitle>
            <DialogDescription>
              Select plans to offer. The user will choose their preferred plan, billing cycle, and pay.
            </DialogDescription>
          </DialogHeader>

          {assignTarget && (
            <div className="space-y-4">
              {/* User summary */}
              <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center font-headline font-bold text-purple-600 text-sm">
                  {assignTarget.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold">{assignTarget.name}</p>
                  <p className="font-label text-[10px] text-on-surface-variant truncate">{assignTarget.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-label text-xs font-medium">{assignTarget.hospitalName}</p>
                  {assignTarget.trialPlan && (
                    <Badge variant="secondary" className="text-[9px] bg-gray-100">{assignTarget.trialPlan.name} (current)</Badge>
                  )}
                </div>
              </div>

              {/* Multi-plan select */}
              <div className="space-y-1.5">
                <Label className="font-label text-xs font-bold">
                  Select Plans <span className="text-error">*</span>
                  <span className="text-on-surface-variant font-normal ml-1">(pick 1 or more)</span>
                </Label>
                <div className="rounded-xl border border-outline-variant/20 max-h-52 overflow-y-auto divide-y divide-surface-container">
                  {plans.filter((p) => p.isActive).map((plan) => {
                    const isSelected = assignPlanIds.includes(plan.id);
                    return (
                      <label
                        key={plan.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAssignPlan(plan.id)}
                          className="h-4 w-4 rounded border-input accent-purple-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm font-bold">{plan.name}</p>
                          {plan.description && <p className="font-label text-[10px] text-on-surface-variant truncate">{plan.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {plan.priceMonthly ? (
                            <p className="font-label text-xs font-bold">Rs {Number(plan.priceMonthly).toLocaleString()}<span className="text-on-surface-variant font-normal">/mo</span></p>
                          ) : (
                            <p className="font-label text-xs text-on-surface-variant">Custom</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {assignPlanIds.length > 0 && (
                  <p className="font-label text-[10px] text-purple-600 font-bold">
                    {assignPlanIds.length} plan{assignPlanIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="bg-surface-container-low rounded-lg p-3">
                <p className="font-label text-[10px] text-on-surface-variant">
                  User will be notified and can choose billing cycle (monthly/yearly) and pay via Razorpay. Hospitals will be re-activated so the user can log in.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssignTarget(null)} className="flex-1">Cancel</Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={assignPlanIds.length === 0 || assignPlanMutation.isPending}
              onClick={handleAssignPlan}
            >
              {assignPlanMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Sending...</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-1.5" /> Offer {assignPlanIds.length} Plan{assignPlanIds.length > 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-error">
              <Trash2 className="h-5 w-5" />
              Delete Demo Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the demo request from <strong>{deleteTarget?.name}</strong> ({deleteTarget?.hospitalName})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-1.5" /> Delete</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
