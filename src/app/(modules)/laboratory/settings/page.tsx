'use client';

// Hospital-side Lab Settings.
//
// Tabs:
//   • Test Catalog       — the actual lab test list; admin can edit fully
//                          (incl. structured parameters), supervisor can
//                          only update price + TAT.
//   • Import Templates   — pull super-admin platform templates into the
//                          catalog one-by-one or all-at-once.
//   • Units              — manage unit groups + units.
//
// Role behaviour:
//   admin / super_admin   → see all tabs + full edit
//   lab_supervisor        → see all tabs but Test Catalog edits are
//                           price-only; Import shows a read-only summary
//                           since clone-* endpoints require admin.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Plus, Pencil, Trash2, Beaker, RefreshCw,
  CopyPlus, Download, Loader2, CheckCircle2, Eye, Ruler, AlertTriangle, ShieldCheck, FileUp, Replace,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { LabUnitsManager } from '@/components/laboratory/lab-units-manager';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatINR } from '@/lib/money';
import { toast } from 'sonner';
import { apiErrorCode, useRangeStatus, type RangeFilter } from '@/hooks/use-lab-catalog';
import { RangeApprovalSection } from '@/components/laboratory/catalog/range-approval';
import { CatalogReviewSection, PriceReasonDialog, RetireDialog } from '@/components/laboratory/catalog/catalog-review';
import { CatalogImportSection } from '@/components/laboratory/catalog/catalog-import';
import {
  useLabTests,
  useCreateLabTest,
  useUpdateLabTest,
  useUpdateLabTestPrice,
  useDeleteLabTest,
} from '@/hooks/use-lab';
import type { LabTestCatalog, LabTestParameter, PriceConfirmation } from '@/hooks/use-lab';
import {
  useLabTemplates,
  useCloneOneLabTemplate,
  useCloneAllLabTemplates,
  type LabTestTemplate,
  type LabParameterSpec,
} from '@/hooks/use-lab-templates';
import { useLabRole } from '@/hooks/use-lab-role';
import { SupervisorOnlyGuard } from '@/components/laboratory/supervisor-only-guard';
import { LabParameterBuilder } from '@/components/laboratory/lab-parameter-builder';
import {
  LabTagsInput,
  mergeSynonyms,
  splitSynonyms,
  SYNONYMS_MAX,
} from '@/components/laboratory/lab-tags-input';
import {
  LabReportPreviewDialog,
  type LabReportPreviewSource,
} from '@/components/laboratory/lab-report-preview';

export default function LabSettingsPage() {
  return (
    <SupervisorOnlyGuard>
      <LabSettingsPageInner />
    </SupervisorOnlyGuard>
  );
}

function LabSettingsPageInner() {
  const { canEditCatalog } = useLabRole();
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Lab Settings</h1>
      </div>

      <Tabs defaultValue="tests">
        <TabsList variant="line">
          <TabsTrigger value="tests">
            <Beaker className="mr-1.5 h-4 w-4" />
            Test Catalog
          </TabsTrigger>
          <TabsTrigger value="templates">
            <CopyPlus className="mr-1.5 h-4 w-4" />
            Import Templates
          </TabsTrigger>
          <TabsTrigger value="ranges">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Reference Ranges
          </TabsTrigger>
          <TabsTrigger value="review">
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Price &amp; Duplicates
          </TabsTrigger>
          {canEditCatalog && (
            <TabsTrigger value="import">
              <FileUp className="mr-1.5 h-4 w-4" />
              Import File
            </TabsTrigger>
          )}
          <TabsTrigger value="units">
            <Ruler className="mr-1.5 h-4 w-4" />
            Units
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="pt-4">
          <TestCatalogSection />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesImportSection />
        </TabsContent>
        <TabsContent value="ranges" className="pt-4">
          <RangeApprovalSection />
        </TabsContent>
        <TabsContent value="review" className="pt-4">
          <CatalogReviewSection />
        </TabsContent>
        {canEditCatalog && (
          <TabsContent value="import" className="pt-4">
            <CatalogImportSection />
          </TabsContent>
        )}
        <TabsContent value="units" className="pt-4">
          <LabUnitsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Test Catalog Section
// ============================================================

interface CatalogIssue {
  kind: 'placeholder_text' | 'duplicate_name' | 'price_above_panel';
  testIds: string[];
  testNames: string[];
  field?: string;
  message: string;
}

const ISSUE_LABEL: Record<CatalogIssue['kind'], string> = {
  placeholder_text: 'Placeholder text',
  duplicate_name: 'Possible duplicate',
  price_above_panel: 'Price check',
};

// Gap 369: review flags for the Lab Admin — placeholder text, near-duplicate
// names, an analyte priced above a panel that includes it. Read-only: the
// lab owner decides what to change.
function CatalogReviewFlags() {
  const { data } = useQuery({
    queryKey: ['lab', 'tests', 'quality-flags'],
    queryFn: async () => (await apiGet<CatalogIssue[]>('/lab/tests/quality-flags')).data ?? [],
  });
  const [open, setOpen] = useState(false);
  if (!data || data.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <button type="button" className="flex w-full items-center gap-2 text-left font-semibold" onClick={() => setOpen((o) => !o)}>
        <AlertTriangle className="h-4 w-4" />
        {data.length} catalogue item(s) need review
        <span className="ml-auto font-normal underline">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {data.map((i, idx) => (
            <li key={`${i.kind}-${i.testIds.join('-')}-${i.field ?? ''}-${idx}`}>
              <Badge variant="outline" className="mr-2 border-amber-400 text-[10px]">{ISSUE_LABEL[i.kind]}</Badge>
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TestCatalogSection() {
  const { canEditCatalog } = useLabRole();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTestCatalog | null>(null);
  const [previewTest, setPreviewTest] = useState<LabTestCatalog | null>(null);
  const [retiring, setRetiring] = useState<LabTestCatalog | null>(null);
  const [rangeStatus, setRangeStatus] = useState<RangeFilter>('all');
  const [priceReview, setPriceReview] = useState(false);
  const ranges = useRangeStatus();
  const rangeByTest = new Map((ranges.data?.tests ?? []).map((t) => [t.testId, t]));

  const { data, isLoading, refetch } = useLabTests({
    search: search || undefined,
    page,
    limit: 20,
    ...(rangeStatus !== 'all' ? { rangeStatus } : {}),
    ...(priceReview ? { priceReview: true } : {}),
  } as Parameters<typeof useLabTests>[0]);
  const deleteTest = useDeleteLabTest();

  const tests = data?.data ?? [];
  const meta = data?.meta;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete test "${name}"? This cannot be undone.`)) return;
    try {
      await deleteTest.mutateAsync(id);
      toast.success('Test deleted');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete test');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder='Search tests, aliases, tags ("FBC", "hemoglobin"…)'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
        {canEditCatalog && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Custom Test
            </DialogTrigger>
            <TestFormDialog mode="create" onClose={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {([
          ['all', 'All tests'],
          ['not_signed_off', `Ranges not signed off (${ranges.data?.totals.testsNotSignedOff ?? 0})`],
          ['pending', 'Ranges awaiting approval'],
        ] as [RangeFilter, string][]).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            className="h-7 text-xs"
            variant={rangeStatus === value ? 'default' : 'outline'}
            onClick={() => { setRangeStatus(value); setPage(1); }}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          className="h-7 text-xs"
          variant={priceReview ? 'default' : 'outline'}
          onClick={() => { setPriceReview((v) => !v); setPage(1); }}
        >
          Needs price review
        </Button>
      </div>

      {canEditCatalog && <CatalogReviewFlags />}

      {!canEditCatalog && (
        <p className="text-[11px] text-muted-foreground italic">
          You can update price and turnaround time. Editing the parameter list or other catalog fields is reserved for hospital admins.
        </p>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Test Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Code</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Parameters</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Sample</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">TAT</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Price</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Beaker className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No tests in your catalog yet.</p>
                      <p className="text-[11px] text-muted-foreground">
                        Use <span className="font-semibold">Import Templates</span> to clone the platform-wide list.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tests.map((test: LabTestCatalog) => (
                  <tr key={test.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{test.testName ?? test.name}</div>
                      <div className="flex gap-1 mt-0.5">
                        {test.templateId && (
                          <Badge className="bg-primary/10 text-primary text-[9px]">From platform template</Badge>
                        )}
                        {test.isCustom && !test.templateId && (
                          <Badge className="bg-amber-100 text-amber-800 text-[9px]">Hospital custom</Badge>
                        )}
                        {(test.aliases?.length ?? 0) > 0 && (
                          <Badge className="bg-cyan-50 text-cyan-700 text-[9px]" title={test.aliases?.join(', ')}>
                            +{test.aliases!.length} alias{test.aliases!.length === 1 ? '' : 'es'}
                          </Badge>
                        )}
                        {(rangeByTest.get(test.id)?.notSignedOff ?? 0) > 0 && (
                          <Badge className="bg-amber-100 text-amber-900 text-[9px]">
                            Not signed off ({rangeByTest.get(test.id)!.notSignedOff})
                          </Badge>
                        )}
                        {(rangeByTest.get(test.id)?.pending ?? 0) > 0 && (
                          <Badge className="bg-sky-100 text-sky-900 text-[9px]">
                            {rangeByTest.get(test.id)!.pending} range{rangeByTest.get(test.id)!.pending === 1 ? '' : 's'} pending
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{test.testCode ?? test.code ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {(test.parameters?.length ?? 0) > 0 ? (
                        <Badge className="bg-cyan-100 text-cyan-800">
                          {test.parameters!.length} param{test.parameters!.length === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">no schema</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{test.sampleType || '-'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{test.turnaroundHours ? `${test.turnaroundHours}h` : '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {test.price != null ? formatINR(test.price) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        test.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800',
                      )}>
                        {test.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTest(test)}
                          title="Preview report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Dialog
                          open={editingTest?.id === test.id}
                          onOpenChange={(open) => !open && setEditingTest(null)}
                        >
                          <DialogTrigger
                            render={<Button variant="ghost" size="sm" />}
                            onClick={() => setEditingTest(test)}
                            title={canEditCatalog ? 'Edit test' : 'Edit price / TAT'}
                          >
                            <Pencil className="h-4 w-4" />
                          </DialogTrigger>
                          {editingTest?.id === test.id && (
                            <TestFormDialog
                              mode="edit"
                              test={editingTest}
                              onClose={() => setEditingTest(null)}
                            />
                          )}
                        </Dialog>
                        {test.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRetiring(test)}
                            title="Retire as a duplicate of another test"
                          >
                            <Replace className="h-4 w-4" />
                          </Button>
                        )}
                        {canEditCatalog && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(test.id, test.testName ?? test.name ?? 'Test')}
                            disabled={deleteTest.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {page} of {meta?.totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {retiring && (
        <RetireDialog
          retireId={retiring.id}
          retireName={retiring.testName ?? 'Test'}
          onClose={() => setRetiring(null)}
        />
      )}

      <LabReportPreviewDialog
        open={!!previewTest}
        onOpenChange={(open) => !open && setPreviewTest(null)}
        source={previewTest ? catalogToPreviewSource(previewTest) : null}
      />
    </div>
  );
}

function catalogToPreviewSource(test: LabTestCatalog): LabReportPreviewSource {
  return {
    name: test.testName ?? test.name ?? 'Test',
    code: test.testCode ?? test.code ?? null,
    sampleType: test.sampleType ?? null,
    specimen: test.specimen ?? null,
    instructions: test.instructions ?? null,
    description: test.description ?? null,
    interpretation: test.interpretation ?? null,
    defaultPrice: test.price ?? null,
    turnaroundHours: test.turnaroundHours ?? null,
    parameters: (test.parameters as LabParameterSpec[] | undefined) ?? [],
  };
}

// Role-aware edit/create dialog for catalog rows. Hospital admin gets the
// full editor (incl. structured parameters); lab_supervisor sees price + TAT
// only and submits via the narrow /price endpoint.
function TestFormDialog({
  mode,
  test,
  onClose,
}: {
  mode: 'create' | 'edit';
  test?: LabTestCatalog;
  onClose: () => void;
}) {
  const { canEditCatalog } = useLabRole();
  const isEdit = mode === 'edit' && !!test;
  const fullEdit = canEditCatalog;

  const [formData, setFormData] = useState({
    testName: test?.testName ?? test?.name ?? '',
    testCode: test?.testCode ?? test?.code ?? '',
    sampleType: test?.sampleType ?? '',
    specimen: test?.specimen ?? '',
    instructions: test?.instructions ?? '',
    description: test?.description ?? '',
    interpretation: test?.interpretation ?? '',
    turnaroundHours: test?.turnaroundHours ?? 0,
    price: Number(test?.price ?? 0),
  });

  const [parameters, setParameters] = useState<LabParameterSpec[]>(
    (test?.parameters as LabParameterSpec[] | undefined) ?? [],
  );
  // Single combined synonyms list. Backend keeps aliases + tags as two
  // columns; mergeSynonyms / splitSynonyms handle the load + save transform.
  const [synonyms, setSynonyms] = useState<string[]>(
    mergeSynonyms(
      (test as unknown as { aliases?: string[] })?.aliases,
      (test as unknown as { tags?: string[] })?.tags,
    ),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [priceQuestion, setPriceQuestion] = useState<string | null>(null);

  const createTest = useCreateLabTest();
  const updateTest = useUpdateLabTest();
  const updatePrice = useUpdateLabTestPrice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save({});
  };

  // The server refuses a price above a panel, or a rename that would carry a
  // reference range with it, until it is told to go ahead (gap 369).
  const save = async (extra: { priceConfirmation?: PriceConfirmation; confirmRangeReset?: boolean }) => {
    setPriceQuestion(null);
    if (!fullEdit && isEdit && test) {
      // Supervisor edit: price-only
      try {
        await updatePrice.mutateAsync({
          id: test.id,
          price: formData.price || undefined,
          turnaroundHours: formData.turnaroundHours || undefined,
          priceConfirmation: extra.priceConfirmation,
        });
        toast.success('Price updated');
        onClose();
      } catch (err: unknown) {
        if (apiErrorCode(err) === 'PRICE_ABOVE_PANEL' && !extra.priceConfirmation) {
          setPriceQuestion(getApiErrorMessage(err));
          return;
        }
        toast.error(getApiErrorMessage(err, 'Failed to update price'));
      }
      return;
    }

    // Admin: full create / update
    if (!formData.testName.trim()) {
      toast.error('Test name is required');
      return;
    }
    if (!formData.price || formData.price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    for (const [i, p] of parameters.entries()) {
      if (!p.name.trim()) {
        toast.error(`Parameter row ${i + 1} is missing a name`);
        return;
      }
    }

    const { aliases, tags } = splitSynonyms(synonyms);
    const payload = {
      testName: formData.testName,
      testCode: formData.testCode || undefined,
      sampleType: formData.sampleType || undefined,
      specimen: formData.specimen || undefined,
      instructions: formData.instructions || undefined,
      description: formData.description || undefined,
      interpretation: formData.interpretation || undefined,
      turnaroundHours: formData.turnaroundHours || undefined,
      price: formData.price,
      parameters: parameters as unknown as LabTestParameter[],
      aliases,
      tags,
      // Mode = create → mark as custom unless this catalog row was
      // explicitly cloned from a template (createTest path doesn't carry
      // a templateId). Edits don't change isCustom — preserved server-side.
      ...(mode === 'create' ? { isCustom: true } : {}),
      ...(extra.priceConfirmation ? { priceConfirmation: extra.priceConfirmation } : {}),
    };

    try {
      const saved =
        isEdit && test
          ? await updateTest.mutateAsync({
              id: test.id,
              ...payload,
              expectedRangeVersion: test.rangeVersion,
              ...(extra.confirmRangeReset ? { confirmRangeReset: true } : {}),
            })
          : await createTest.mutateAsync(payload);
      const waiting = saved?.rangeProposals ?? 0;
      toast.success(
        `${isEdit ? 'Test updated' : 'Test created'}${
          waiting ? `. ${waiting} reference range(s) sent for pathologist approval; not in use yet` : ''
        }`,
      );
      onClose();
    } catch (err: unknown) {
      const code = apiErrorCode(err);
      if (code === 'PRICE_ABOVE_PANEL' && !extra.priceConfirmation) {
        setPriceQuestion(getApiErrorMessage(err));
        return;
      }
      if (code === 'RANGE_RENAME' && !extra.confirmRangeReset) {
        if (window.confirm(getApiErrorMessage(err))) await save({ ...extra, confirmRangeReset: true });
        return;
      }
      toast.error(getApiErrorMessage(err, 'Failed to save'));
    }
  };

  const isPending = createTest.isPending || updateTest.isPending || updatePrice.isPending;

  return (
    <DialogContent className={fullEdit ? 'sm:max-w-4xl max-h-[92vh] overflow-y-auto' : 'sm:max-w-md'}>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? (fullEdit ? 'Edit Test' : 'Edit Price / TAT') : 'Create Custom Test'}
        </DialogTitle>
        <DialogDescription>
          {fullEdit
            ? (isEdit
                ? 'Configure the catalog row. Structured parameters drive the technician\'s result-entry grid.'
                : 'Author a hospital-specific test. It stays independent of the platform master data — a future Sync schemas will not touch it.')
            : 'Lab supervisors can update price and turnaround time. Parameter list is admin-only.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fullEdit ? (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8">
              <Label htmlFor="test-name">Test Name *</Label>
              <Input
                id="test-name"
                value={formData.testName}
                onChange={(e) => setFormData((p) => ({ ...p, testName: e.target.value }))}
                placeholder="e.g. Complete Blood Count"
              />
            </div>
            <div className="col-span-4">
              <Label htmlFor="test-code">Code</Label>
              <Input
                id="test-code"
                value={formData.testCode}
                onChange={(e) => setFormData((p) => ({ ...p, testCode: e.target.value }))}
                placeholder="CBC"
              />
            </div>
            <div className="col-span-8">
              <Label htmlFor="test-sample">Sample Type</Label>
              <Input
                id="test-sample"
                value={formData.sampleType}
                onChange={(e) => setFormData((p) => ({ ...p, sampleType: e.target.value }))}
                placeholder="Blood / Urine / Sputum"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="test-tat">TAT (hrs)</Label>
              <NumberInput
                id="test-tat"
                min={0}
                value={formData.turnaroundHours}
                onValueChange={(v) => setFormData((p) => ({ ...p, turnaroundHours: v }))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="test-price">Price *</Label>
              <NumberInput
                id="test-price"
                step="0.01"
                value={formData.price}
                onValueChange={(v) => setFormData((p) => ({ ...p, price: v }))}
              />
            </div>
            <div className="col-span-12">
              <Label htmlFor="test-specimen">Specimen / collection notes</Label>
              <Input
                id="test-specimen"
                value={formData.specimen}
                onChange={(e) => setFormData((p) => ({ ...p, specimen: e.target.value }))}
                placeholder="3 mL EDTA whole blood"
              />
            </div>
            <div className="col-span-12">
              <Label htmlFor="test-instr">Patient instructions</Label>
              <Input
                id="test-instr"
                value={formData.instructions}
                onChange={(e) => setFormData((p) => ({ ...p, instructions: e.target.value }))}
                placeholder="Fasting required, etc."
              />
            </div>
            <div className="col-span-12">
              <Label htmlFor="test-desc">Description</Label>
              <Textarea
                id="test-desc"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="col-span-12 grid grid-cols-12 gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <div className="col-span-12">
                <div className="text-[10px] uppercase font-semibold tracking-wide text-primary">
                  Search & synonyms (hospital-local)
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Alternative names and keywords that should surface this test in search — e.g.
                  &quot;FBC&quot;, &quot;Hemogram&quot;, &quot;hemoglobin&quot;, &quot;anemia&quot;. Edits here stay on your catalog and
                  don&apos;t touch the master template.
                </p>
              </div>
              <div className="col-span-12 space-y-1">
                <Label className="text-xs">Synonyms</Label>
                <LabTagsInput
                  value={synonyms}
                  onChange={setSynonyms}
                  valueMode="alias"
                  max={SYNONYMS_MAX}
                  placeholder='e.g. "FBC", "Hemogram", "hemoglobin"'
                />
              </div>
            </div>

            <div className="col-span-12">
              <Label className="block mb-1">Parameters ({parameters.length})</Label>
              <p className="mb-2 text-[11px] text-amber-800">
                Reference range and unit changes are sent to the pathologist and are not used on results or reports until
                approved. Ranges shown here are the ones in use.
              </p>
              <LabParameterBuilder value={parameters} onChange={setParameters} />
            </div>

            <div className="col-span-12">
              <Label htmlFor="test-interp">Clinical interpretation (printed at the foot of the branded report)</Label>
              <Textarea
                id="test-interp"
                value={formData.interpretation}
                onChange={(e) => setFormData((p) => ({ ...p, interpretation: e.target.value }))}
                rows={3}
                placeholder="Free-text clinical interpretation guidance for clinicians reading this report."
              />
            </div>
          </div>
        ) : (
          // Supervisor view — price & TAT only
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{test?.testName ?? test?.name}</span>
              {test?.testCode && <span className="ml-2 font-mono text-xs text-muted-foreground">({test.testCode})</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="test-price">Price (₹) *</Label>
                <NumberInput
                  id="test-price"
                  step="0.01"
                  value={formData.price}
                  onValueChange={(v) => setFormData((p) => ({ ...p, price: v }))}
                />
              </div>
              <div>
                <Label htmlFor="test-tat">Turnaround (hrs)</Label>
                <NumberInput
                  id="test-tat"
                  min={0}
                  value={formData.turnaroundHours}
                  onValueChange={(v) => setFormData((p) => ({ ...p, turnaroundHours: v }))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={isPending}
            className="gap-1 mr-auto"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview report
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>

      <PriceReasonDialog
        key={priceQuestion ?? 'closed'}
        message={priceQuestion}
        onCancel={() => setPriceQuestion(null)}
        onConfirm={(reason) => void save({ priceConfirmation: { confirmed: true, reason } })}
      />

      <LabReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        source={{
          name: formData.testName || 'Untitled test',
          code: formData.testCode || null,
          sampleType: formData.sampleType || null,
          specimen: formData.specimen || null,
          instructions: formData.instructions || null,
          description: formData.description || null,
          interpretation: formData.interpretation || null,
          defaultPrice: formData.price || null,
          turnaroundHours: formData.turnaroundHours || null,
          parameters: fullEdit ? parameters : ((test?.parameters as LabParameterSpec[] | undefined) ?? []),
        }}
      />
    </DialogContent>
  );
}

// ============================================================
// Templates Import Section
// ============================================================

function TemplatesImportSection() {
  const { canEditCatalog } = useLabRole();
  const [search, setSearch] = useState('');
  const [previewTpl, setPreviewTpl] = useState<LabTestTemplate | null>(null);
  const [priceQuestion, setPriceQuestion] = useState<{ tpl: LabTestTemplate; message: string } | null>(null);
  const { data, isLoading, refetch } = useLabTemplates({ limit: 200 });
  const cloneOne = useCloneOneLabTemplate();
  const cloneAll = useCloneAllLabTemplates();
  const { data: tests } = useLabTests({ limit: 200 });

  const templates = data?.data ?? [];
  // Build a set of templateIds already cloned by this tenant so we can flag
  // each row as "Already imported" instead of allowing duplicates.
  const importedTemplateIds = new Set(
    (tests?.data ?? []).map((t) => t.templateId).filter(Boolean) as string[],
  );

  const filtered = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    // Match against name/code AND the alias/tag arrays so a local search
    // for "FBC" or "hemoglobin" surfaces CBC even before the user re-fetches
    // with the server-side search.
    const haystack = [
      t.name,
      t.code ?? '',
      ...(t.aliases ?? []),
      ...(t.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const onCloneOne = async (tpl: LabTestTemplate, priceConfirmation?: PriceConfirmation) => {
    setPriceQuestion(null);
    try {
      const res = await cloneOne.mutateAsync({ templateId: tpl.id, priceConfirmation });
      if ((res as { status?: string })?.status === 'already_cloned') {
        toast.info(`Already imported — opened existing catalog entry`);
      } else {
        toast.success(`${tpl.name} added to catalog. Its reference ranges wait for pathologist approval.`);
      }
    } catch (e: unknown) {
      if (apiErrorCode(e) === 'PRICE_ABOVE_PANEL' && !priceConfirmation) {
        setPriceQuestion({ tpl, message: getApiErrorMessage(e) });
        return;
      }
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Clone failed');
    }
  };

  const onCloneAll = async (overwrite: boolean) => {
    if (!confirm(
      overwrite
        ? 'Re-import every template and overwrite parameter schemas for tests already cloned? Local price/TAT customisations are preserved. Reference ranges in use stay; different template ranges are sent for pathologist approval.'
        : 'Import every published template into your catalog? Already-imported tests are skipped. Reference ranges of new tests wait for pathologist approval.',
    )) return;
    try {
      const res = await cloneAll.mutateAsync({ overwriteExisting: overwrite });
      toast.success(
        `${res.created} added · ${res.updated} updated · ${res.skipped} skipped`,
      );
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Bulk clone failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder='Search by name, code, alias or tag…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
        {canEditCatalog && (
          <>
            <Button
              size="sm"
              onClick={() => onCloneAll(false)}
              disabled={cloneAll.isPending}
              className="gap-1.5"
            >
              {cloneAll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Clone all (skip existing)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCloneAll(true)}
              disabled={cloneAll.isPending}
              className="gap-1.5"
              title="Re-snapshot template schemas. Local price/TAT customisations preserved."
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Sync schemas
            </Button>
          </>
        )}
      </div>

      {!canEditCatalog && (
        <p className="text-[11px] text-muted-foreground italic">
          Cloning platform templates is reserved for hospital admins. You can browse the catalog from here.
        </p>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-3 pt-4 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Template</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Params</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Default ₹</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">TAT</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {templates.length === 0 ? 'No platform templates available.' : 'No templates match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isImported = importedTemplateIds.has(t.id);
                return (
                  <tr key={t.id} className="border-b hover:bg-surface-container-low">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.code ? <span className="font-mono">{t.code}</span> : null}
                        {t.code && t.sampleType ? ' · ' : ''}
                        {t.sampleType ?? ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge className="bg-cyan-100 text-cyan-800 text-[10px]">
                        {t.parameters?.length ?? 0}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {t.defaultPrice != null ? `₹ ${Number(t.defaultPrice).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">{t.turnaroundHours ? `${t.turnaroundHours}h` : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewTpl(t)}
                          className="gap-1 h-7 text-xs"
                          title="Preview report"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {isImported ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Imported
                          </span>
                        ) : canEditCatalog ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCloneOne(t)}
                            disabled={cloneOne.isPending}
                            className="gap-1 h-7 text-xs"
                          >
                            <Download className="h-3 w-3" />
                            Clone
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Admin only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PriceReasonDialog
        key={priceQuestion?.message ?? 'closed'}
        message={priceQuestion?.message ?? null}
        onCancel={() => setPriceQuestion(null)}
        onConfirm={(reason) => priceQuestion && void onCloneOne(priceQuestion.tpl, { confirmed: true, reason })}
      />

      <LabReportPreviewDialog
        open={!!previewTpl}
        onOpenChange={(open) => !open && setPreviewTpl(null)}
        source={
          previewTpl
            ? {
                name: previewTpl.name,
                code: previewTpl.code,
                sampleType: previewTpl.sampleType,
                specimen: previewTpl.specimen,
                instructions: previewTpl.instructions,
                description: previewTpl.description,
                interpretation: previewTpl.interpretation,
                defaultPrice: previewTpl.defaultPrice ?? null,
                turnaroundHours: previewTpl.turnaroundHours ?? null,
                parameters: previewTpl.parameters ?? [],
              }
            : null
        }
      />
    </div>
  );
}
