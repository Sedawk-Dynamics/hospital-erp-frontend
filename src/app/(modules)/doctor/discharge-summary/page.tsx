'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useDoctorAdmissions,
  useGenerateDischargeSummary,
  useUpdateDischargeSummary,
  useSignDischargeSummary,
  usePublishDischargeSummary,
  type DischargeSummary,
} from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import { useActionFormsTrigger } from '@/hooks/use-action-forms-trigger';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  FileCheck,
  Printer,
  ArrowLeft,
  Save,
  PenLine,
  Send,
  Calendar,
  RefreshCw,
  Download,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { apiPost } from '@/lib/api';

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: DischargeSummary['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest',
        status === 'draft' && 'bg-secondary/10 text-secondary',
        status === 'finalized' && 'bg-primary-container/10 text-primary-container',
        status === 'published' && 'bg-primary/10 text-primary',
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DischargeSummaryPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  // -- Admission list state --
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // -- Editor state --
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(
    searchParams.get('admissionId'),
  );
  const [summaryData, setSummaryData] = useState<DischargeSummary | null>(null);

  // Local form fields
  const [diagnosesSummary, setDiagnosesSummary] = useState('');
  const [proceduresSummary, setProceduresSummary] = useState('');
  const [labResultsSummary, setLabResultsSummary] = useState('');
  const [medicationReconciliation, setMedicationReconciliation] = useState('');
  const [dischargeInstructions, setDischargeInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpInstructions, setFollowUpInstructions] = useState('');

  // -- Queries --
  const { data: admissionsData, isLoading: admissionsLoading } = useDoctorAdmissions({
    page,
    limit: 10,
    doctorId: user?.id,
    search: search || undefined,
  });

  const admissions = admissionsData?.data ?? [];
  const meta = admissionsData?.meta;

  // Generate / fetch discharge summary for selected admission
  const {
    data: generatedSummary,
    isLoading: generatingSum,
    isError: generateError,
  } = useGenerateDischargeSummary(selectedAdmissionId ?? '');

  const updateMutation = useUpdateDischargeSummary();
  const signMutation = useSignDischargeSummary();
  const publishMutation = usePublishDischargeSummary();
  const formsTrigger = useActionFormsTrigger();

  // Populate local form when summary loads
  useEffect(() => {
    if (generatedSummary) {
      setSummaryData(generatedSummary);
      setDiagnosesSummary(generatedSummary.diagnosesSummary ?? '');
      setProceduresSummary(generatedSummary.proceduresSummary ?? '');
      setLabResultsSummary(generatedSummary.labResultsSummary ?? '');
      setMedicationReconciliation(generatedSummary.medicationReconciliation ?? '');
      setDischargeInstructions(generatedSummary.dischargeInstructions ?? '');
      setFollowUpDate(generatedSummary.followUpDate ? toInputDateStr(generatedSummary.followUpDate) : '');
      setFollowUpInstructions(generatedSummary.followUpInstructions ?? '');
    }
  }, [generatedSummary]);

  // -- Handlers --

  const handleSelectAdmission = useCallback((admissionId: string) => {
    setSelectedAdmissionId(admissionId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedAdmissionId(null);
    setSummaryData(null);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!summaryData) return;
    try {
      const updated = await updateMutation.mutateAsync({
        id: summaryData.id,
        diagnosesSummary,
        proceduresSummary,
        labResultsSummary,
        medicationReconciliation,
        dischargeInstructions,
        followUpDate: followUpDate || undefined,
        followUpInstructions,
      });
      if (updated) setSummaryData(updated);
      toast.success('Draft saved successfully');
    } catch {
      toast.error('Failed to save draft');
    }
  }, [
    summaryData, updateMutation, diagnosesSummary, proceduresSummary,
    labResultsSummary, medicationReconciliation, dischargeInstructions,
    followUpDate, followUpInstructions,
  ]);

  // E-sign popup state
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  const requestSign = useCallback(() => {
    if (!summaryData) return;
    const defaultName = user ? `Dr. ${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
    setSignatureName(defaultName);
    setSignDialogOpen(true);
  }, [summaryData, user]);

  const confirmSign = useCallback(async () => {
    if (!summaryData) return;
    const expectedName = user ? `Dr. ${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
    if (!signatureName.trim() || (expectedName && signatureName.trim().toLowerCase() !== expectedName.toLowerCase())) {
      toast.error('Please type your full name exactly to sign');
      return;
    }
    try {
      const signed = await signMutation.mutateAsync({
        id: summaryData.id,
        signatureName: signatureName.trim(),
      });
      if (signed) setSummaryData(signed);
      toast.success('Discharge summary signed & finalized');
      setSignDialogOpen(false);
      setSignatureName('');
    } catch {
      toast.error('Failed to sign discharge summary');
    }
  }, [summaryData, signMutation, signatureName, user]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!summaryData) return;
    setIsRefreshing(true);
    try {
      const res = await apiPost<any>(`/mrd/discharge-summary/${summaryData.id}/refresh`);
      if (res.data) {
        setSummaryData(res.data);
        toast.success('Refreshed from pinned notes & source data');
      }
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [summaryData]);

  const handleDownloadPdf = useCallback(async () => {
    if (!summaryData) return;
    try {
      const res = await apiClient.get(`/mrd/discharge-summary/${summaryData.id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `discharge-summary-${summaryData.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  }, [summaryData]);

  const handlePublish = useCallback(async () => {
    if (!summaryData) return;
    try {
      const published = await publishMutation.mutateAsync(summaryData.id);
      if (published) setSummaryData(published);
      toast.success('Discharge summary published — patient notified via portal & email');

      // After successful publish, fire any forms assigned to the discharge trigger
      formsTrigger.fire('discharge', undefined, {
        admissionId: summaryData.admissionId,
        visitId: summaryData.visitId,
        patientId: summaryData.patientId,
      });
    } catch {
      toast.error('Failed to publish discharge summary');
    }
  }, [summaryData, publishMutation, formsTrigger]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // -- Editor view --
  if (selectedAdmissionId) {
    if (generatingSum) {
      return (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Generating discharge summary...</p>
        </div>
      );
    }

    if (generateError || !summaryData) {
      return (
        <div className="space-y-4 animate-fade-in-up">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Admissions
          </Button>
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-destructive">Failed to generate discharge summary.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleBack}>
              Go Back
            </Button>
          </div>
        </div>
      );
    }

    const patient = summaryData.patient;
    const admission = summaryData.admission;
    const doctor = summaryData.doctor;
    const isReadOnly = summaryData.status === 'published';

    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Top bar */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Admissions
          </Button>
          <div className="flex items-center gap-2">
            <StatusBadge status={summaryData.status} />
          </div>
        </div>

        <h1 className="font-headline text-xl font-bold">Discharge Summary</h1>

        {/* Patient Info Header */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                    {patient ? `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {patient ? `${patient.firstName} ${patient.lastName}`.toUpperCase() : 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MRN: {patient?.mrn ?? '-'} | {patient?.gender ?? '-'} | DOB: {patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : '-'}
                  </p>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Admission:</span> <span className="font-medium">{admission?.admissionDate ? formatDate(admission.admissionDate) : '-'}</span></p>
                <p><span className="text-muted-foreground">Discharge:</span> <span className="font-medium">{admission?.dischargeDate ? formatDate(admission.dischargeDate) : '-'}</span></p>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Ward:</span> <span className="font-medium">{admission?.ward?.name ?? '-'}</span> | <span className="text-muted-foreground">Bed:</span> <span className="font-medium">{admission?.bed?.bedNumber ?? '-'}</span></p>
                <p><span className="text-muted-foreground">Doctor:</span> <span className="font-medium">{doctor?.user ? `Dr. ${doctor.user.firstName} ${doctor.user.lastName}` : '-'}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Diagnoses Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Diagnoses Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={diagnosesSummary}
                onChange={(e) => setDiagnosesSummary(e.target.value)}
                placeholder="Diagnoses summary..."
                rows={4}
                disabled={isReadOnly}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Procedures Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Procedures Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={proceduresSummary}
                onChange={(e) => setProceduresSummary(e.target.value)}
                placeholder="Procedures summary..."
                rows={4}
                disabled={isReadOnly}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Lab Results Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Lab Results Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={labResultsSummary}
                onChange={(e) => setLabResultsSummary(e.target.value)}
                placeholder="Key lab results..."
                rows={4}
                disabled={isReadOnly}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Medication Reconciliation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Medication Reconciliation</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={medicationReconciliation}
                onChange={(e) => setMedicationReconciliation(e.target.value)}
                placeholder="Medications on discharge..."
                rows={4}
                disabled={isReadOnly}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Discharge Instructions — full width */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Discharge Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={dischargeInstructions}
              onChange={(e) => setDischargeInstructions(e.target.value)}
              placeholder="Instructions for the patient after discharge..."
              rows={5}
              disabled={isReadOnly}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Follow-up */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Follow-up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Follow-up Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    disabled={isReadOnly}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Follow-up Instructions</Label>
              <Textarea
                value={followUpInstructions}
                onChange={(e) => setFollowUpInstructions(e.target.value)}
                placeholder="Follow-up instructions for the patient..."
                rows={3}
                disabled={isReadOnly}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <StatusBadge status={summaryData.status} />
            {summaryData.signedAt && summaryData.signer && (
              <span className="text-xs text-muted-foreground">
                Signed by {summaryData.signer.firstName} {summaryData.signer.lastName} on {formatDate(summaryData.signedAt)}
                {summaryData.eSignatureUrl?.startsWith('typed:') && (
                  <>
                    {' — attested as '}
                    <em className="not-italic font-medium">
                      &ldquo;{summaryData.eSignatureUrl.replace(/^typed:/, '')}&rdquo;
                    </em>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {summaryData.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-1.5"
                title="Regenerate summary from pinned notes, diagnoses, labs, and prescriptions"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Refreshing...' : 'Refresh from Notes'}
              </Button>
            )}

            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={updateMutation.isPending}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {updateMutation.isPending ? 'Saving...' : 'Save Draft'}
              </Button>
            )}

            {summaryData.status !== 'draft' && (
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            )}

            {summaryData.status === 'draft' && (
              <Button
                variant="default"
                size="sm"
                onClick={requestSign}
                disabled={signMutation.isPending}
                className="gap-1.5"
              >
                <PenLine className="h-3.5 w-3.5" />
                {signMutation.isPending ? 'Signing...' : 'Sign & Finalize'}
              </Button>
            )}

            {summaryData.status === 'finalized' && (
              <Button
                variant="default"
                size="sm"
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* E-Sign Confirmation Dialog */}
        <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-4 w-4" /> Electronic Signature
              </DialogTitle>
              <DialogDescription>
                By typing your full name below and clicking <strong>Sign & Finalize</strong>, you
                certify that the information in this discharge summary is accurate and complete.
                This action is permanent.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="signature-name" className="text-xs">
                  Type your full name to sign
                </Label>
                <Input
                  id="signature-name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Dr. First Last"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Date & time of signature: {new Date().toLocaleString('en-IN')}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmSign}
                disabled={signMutation.isPending || !signatureName.trim()}
                className="gap-1.5"
              >
                <PenLine className="h-3.5 w-3.5" />
                {signMutation.isPending ? 'Signing...' : 'Sign & Finalize'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // -- Admission list view --
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Discharge Summary</h1>
      </div>

      {/* Search */}
      <div className="flex items-center justify-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name / MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-xs w-[280px]"
          />
        </div>
      </div>

      {/* Admissions Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">MRN</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Ward / Bed</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Admission Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {admissionsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading admissions...</p>
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-label text-on-surface-variant">
                    No admissions found.
                  </td>
                </tr>
              ) : (
                admissions.map((admission) => {
                  const patient = admission.patient;
                  const patientName = patient
                    ? `${patient.firstName} ${patient.lastName}`.toUpperCase()
                    : 'Unknown';
                  const initials = patient
                    ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                    : '?';

                  return (
                    <tr key={admission.id} className="group hover:bg-surface-container-low transition-colors">
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-sm">
                              {patientName}
                              {patient?.gender && (
                                <span className="font-normal text-muted-foreground ml-1 text-xs">
                                  {patient.gender === 'female' ? 'F' : patient.gender === 'male' ? 'M' : ''}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{patient?.phone || '-'}</p>
                          </div>
                        </div>
                      </td>

                      {/* MRN */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-primary text-xs">{patient?.mrn || patient?.uhid || '-'}</span>
                      </td>

                      {/* Ward / Bed */}
                      <td className="px-4 py-3">
                        <p className="text-sm">{admission.ward?.name ?? '-'} / {admission.bed?.bedNumber ?? '-'}</p>
                      </td>

                      {/* Admission Date */}
                      <td className="px-4 py-3">
                        <p className="text-sm">{formatDate(admission.admissionDate)}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-label text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                          admission.status === 'admitted' && 'bg-primary-container/10 text-primary-container',
                          admission.status === 'discharged' && 'bg-primary/10 text-primary',
                          admission.status === 'transferred' && 'bg-secondary/10 text-secondary',
                          admission.status === 'absconded' && 'bg-error/10 text-error',
                        )}>
                          {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => handleSelectAdmission(admission.id)}
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          Generate Summary
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <span className="font-medium">10</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {admissions.length > 0
                ? `${(page - 1) * 10 + 1}-${(page - 1) * 10 + admissions.length} of ${meta?.total ?? admissions.length}`
                : '0-0 of 0'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &#8249;
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= (meta?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              &#8250;
            </Button>
          </div>
        </div>
      </div>

      {/* Discharge forms — fires after Publish to capture any final
          discharge paperwork the hospital admin has assigned. */}
      <IntakeFormsModal
        open={formsTrigger.isOpen}
        trigger="discharge"
        tenantId={formsTrigger.tenantId}
        context={formsTrigger.context}
        onComplete={formsTrigger.close}
      />
    </div>
  );
}
