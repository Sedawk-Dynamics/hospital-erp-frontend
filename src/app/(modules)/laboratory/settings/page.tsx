'use client';

// Hospital-side Lab Settings.
//
// Three tabs:
//   • Departments        — manage in-hospital lab departments
//   • Test Catalog       — the actual lab test list; admin can edit fully
//                          (incl. structured parameters), supervisor can
//                          only update price + TAT.
//   • Import Templates   — pull super-admin platform templates into the
//                          catalog one-by-one or all-at-once.
//
// Role behaviour:
//   admin / super_admin   → see all three tabs + full edit
//   lab_supervisor        → see all three tabs but Test Catalog edits are
//                           price-only; Import shows a read-only summary
//                           since clone-* endpoints require admin.

import { useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, Beaker, Building2, RefreshCw,
  CopyPlus, Download, Loader2, CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useLabDepartments,
  useCreateLabDepartment,
  useUpdateLabDepartment,
  useDeleteLabDepartment,
  useLabTests,
  useCreateLabTest,
  useUpdateLabTest,
  useUpdateLabTestPrice,
  useDeleteLabTest,
} from '@/hooks/use-lab';
import type { LabDepartment, LabTestCatalog, LabTestParameter } from '@/hooks/use-lab';
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

export default function LabSettingsPage() {
  return (
    <SupervisorOnlyGuard>
      <LabSettingsPageInner />
    </SupervisorOnlyGuard>
  );
}

function LabSettingsPageInner() {
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
          <TabsTrigger value="departments">
            <Building2 className="mr-1.5 h-4 w-4" />
            Departments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="pt-4">
          <TestCatalogSection />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesImportSection />
        </TabsContent>
        <TabsContent value="departments" className="pt-4">
          <DepartmentsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Departments Section
// ============================================================

function DepartmentsSection() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<LabDepartment | null>(null);

  const { data, isLoading, refetch } = useLabDepartments({
    search: search || undefined,
    page,
    limit: 20,
  });
  const deleteDepartment = useDeleteLabDepartment();

  const departments = data?.data ?? [];
  const meta = data?.meta;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete department "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDepartment.mutateAsync(id);
      toast.success('Department deleted');
    } catch {
      toast.error('Failed to delete department');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Department
          </DialogTrigger>
          <DepartmentFormDialog onClose={() => setCreateOpen(false)} />
        </Dialog>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Department Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No departments found. Create one to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept: LabDepartment) => (
                  <tr key={dept.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-medium">{dept.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        dept.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800',
                      )}>
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={editingDept?.id === dept.id}
                          onOpenChange={(open) => !open && setEditingDept(null)}
                        >
                          <DialogTrigger
                            render={<Button variant="ghost" size="sm" />}
                            onClick={() => setEditingDept(dept)}
                          >
                            <Pencil className="h-4 w-4" />
                          </DialogTrigger>
                          {editingDept?.id === dept.id && (
                            <DepartmentFormDialog
                              department={editingDept}
                              onClose={() => setEditingDept(null)}
                            />
                          )}
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(dept.id, dept.name)}
                          disabled={deleteDepartment.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}

function DepartmentFormDialog({
  department,
  onClose,
}: {
  department?: LabDepartment;
  onClose: () => void;
}) {
  const isEdit = !!department;
  const [name, setName] = useState(department?.name || '');

  const createDept = useCreateLabDepartment();
  const updateDept = useUpdateLabDepartment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }
    try {
      if (isEdit && department) {
        await updateDept.mutateAsync({ id: department.id, name });
        toast.success('Department updated');
      } else {
        await createDept.mutateAsync({ name });
        toast.success('Department created');
      }
      onClose();
    } catch {
      toast.error(isEdit ? 'Failed to update department' : 'Failed to create department');
    }
  };

  const isPending = createDept.isPending || updateDept.isPending;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update department details.' : 'Create a new lab department.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="dept-name">Department Name *</Label>
          <Input
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hematology"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ============================================================
// Test Catalog Section
// ============================================================

function TestCatalogSection() {
  const { canEditCatalog } = useLabRole();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTestCatalog | null>(null);

  const { data, isLoading, refetch } = useLabTests({
    search: search || undefined,
    page,
    limit: 20,
  });
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
            placeholder="Search tests..."
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
              Add Test
            </DialogTrigger>
            <TestFormDialog mode="create" onClose={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

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
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Department</th>
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
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
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
                      {test.templateId && (
                        <Badge className="mt-0.5 bg-primary/10 text-primary text-[9px]">From platform template</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{test.testCode ?? test.code ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(test.labDepartment ?? test.department)?.name ?? '-'}</td>
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
                      {test.price != null
                        ? Number(test.price).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                        : '-'}
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
    </div>
  );
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
    labDepartmentId: test?.labDepartmentId ?? test?.departmentId ?? '',
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

  const createTest = useCreateLabTest();
  const updateTest = useUpdateLabTest();
  const updatePrice = useUpdateLabTestPrice();
  const { data: deptData } = useLabDepartments({ limit: 100 });
  const departments = deptData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullEdit && isEdit && test) {
      // Supervisor edit: price-only
      try {
        await updatePrice.mutateAsync({
          id: test.id,
          price: formData.price || undefined,
          turnaroundHours: formData.turnaroundHours || undefined,
        });
        toast.success('Price updated');
        onClose();
      } catch (err: unknown) {
        toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update price');
      }
      return;
    }

    // Admin: full create / update
    if (!formData.testName.trim()) {
      toast.error('Test name is required');
      return;
    }
    if (!formData.labDepartmentId) {
      toast.error('Department is required');
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

    const payload = {
      testName: formData.testName,
      testCode: formData.testCode || undefined,
      labDepartmentId: formData.labDepartmentId,
      sampleType: formData.sampleType || undefined,
      specimen: formData.specimen || undefined,
      instructions: formData.instructions || undefined,
      description: formData.description || undefined,
      interpretation: formData.interpretation || undefined,
      turnaroundHours: formData.turnaroundHours || undefined,
      price: formData.price,
      parameters: parameters as unknown as LabTestParameter[],
    };

    try {
      if (isEdit && test) {
        await updateTest.mutateAsync({ id: test.id, ...payload });
        toast.success('Test updated');
      } else {
        await createTest.mutateAsync(payload);
        toast.success('Test created');
      }
      onClose();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save');
    }
  };

  const isPending = createTest.isPending || updateTest.isPending || updatePrice.isPending;

  return (
    <DialogContent className={fullEdit ? 'sm:max-w-4xl max-h-[92vh] overflow-y-auto' : 'sm:max-w-md'}>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? (fullEdit ? 'Edit Test' : 'Edit Price / TAT') : 'Add Test'}
        </DialogTitle>
        <DialogDescription>
          {fullEdit
            ? 'Configure the catalog row. Structured parameters drive the technician\'s result-entry grid.'
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
            <div className="col-span-4">
              <Label htmlFor="test-dept">Department *</Label>
              <select
                id="test-dept"
                value={formData.labDepartmentId}
                onChange={(e) => setFormData((p) => ({ ...p, labDepartmentId: e.target.value }))}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
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
              <Input
                id="test-tat"
                type="number"
                min={0}
                value={formData.turnaroundHours}
                onChange={(e) => setFormData((p) => ({ ...p, turnaroundHours: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="test-price">Price *</Label>
              <Input
                id="test-price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
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

            <div className="col-span-12">
              <Label className="block mb-2">Parameters ({parameters.length})</Label>
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
                <Input
                  id="test-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="test-tat">Turnaround (hrs)</Label>
                <Input
                  id="test-tat"
                  type="number"
                  min={0}
                  value={formData.turnaroundHours}
                  onChange={(e) => setFormData((p) => ({ ...p, turnaroundHours: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ============================================================
// Templates Import Section
// ============================================================

function TemplatesImportSection() {
  const { canEditCatalog } = useLabRole();
  const [search, setSearch] = useState('');
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

  const filtered = templates.filter((t) =>
    !search.trim()
      ? true
      : `${t.name} ${t.code ?? ''} ${t.departmentName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const onCloneOne = async (tpl: LabTestTemplate) => {
    try {
      const res = await cloneOne.mutateAsync({ templateId: tpl.id });
      if ((res as { status?: string })?.status === 'already_cloned') {
        toast.info(`Already imported — opened existing catalog entry`);
      } else {
        toast.success(`${tpl.name} added to catalog`);
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Clone failed');
    }
  };

  const onCloneAll = async (overwrite: boolean) => {
    if (!confirm(
      overwrite
        ? 'Re-import every template and overwrite parameter schemas for tests already cloned? Local price/TAT customisations are preserved.'
        : 'Import every published template into your catalog? Already-imported tests are skipped.',
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
            placeholder="Search platform templates…"
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
              <th className="px-4 pb-3 pt-4 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Department</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Params</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Default ₹</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">TAT</th>
              <th className="px-4 pb-3 pt-4 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
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
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.departmentName}</td>
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
