'use client';

import { useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, Beaker, Building2, RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  useDeleteLabTest,
} from '@/hooks/use-lab';
import type { LabDepartment, LabTestCatalog } from '@/hooks/use-lab';
import { SupervisorOnlyGuard } from '@/components/laboratory/supervisor-only-guard';

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

      <Tabs defaultValue="departments">
        <TabsList variant="line">
          <TabsTrigger value="departments">
            <Building2 className="mr-1.5 h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="tests">
            <Beaker className="mr-1.5 h-4 w-4" />
            Test Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="pt-4">
          <DepartmentsSection />
        </TabsContent>
        <TabsContent value="tests" className="pt-4">
          <TestCatalogSection />
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
          <DepartmentFormDialog
            onClose={() => setCreateOpen(false)}
          />
        </Dialog>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Department Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Description</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Head of Department</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
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
                    <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                      {dept.description ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{dept.headOfDepartment ?? '-'}</td>
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
  const [formData, setFormData] = useState({
    name: department?.name || '',
    description: department?.description || '',
    headOfDepartment: department?.headOfDepartment || '',
  });

  const createDept = useCreateLabDepartment();
  const updateDept = useUpdateLabDepartment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }
    try {
      if (isEdit && department) {
        await updateDept.mutateAsync({
          id: department.id,
          name: formData.name,
          description: formData.description || undefined,
          headOfDepartment: formData.headOfDepartment || undefined,
        });
        toast.success('Department updated');
      } else {
        await createDept.mutateAsync({
          name: formData.name,
          description: formData.description || undefined,
          headOfDepartment: formData.headOfDepartment || undefined,
        });
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
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Hematology"
          />
        </div>
        <div>
          <Label htmlFor="dept-desc">Description</Label>
          <Textarea
            id="dept-desc"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            placeholder="Department description..."
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="dept-head">Head of Department</Label>
          <Input
            id="dept-head"
            value={formData.headOfDepartment}
            onChange={(e) => setFormData((p) => ({ ...p, headOfDepartment: e.target.value }))}
            placeholder="e.g. Dr. Smith"
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
    } catch {
      toast.error('Failed to delete test');
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Test
          </DialogTrigger>
          <TestFormDialog onClose={() => setCreateOpen(false)} />
        </Dialog>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Test Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Code</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Department</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Sample Type</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">TAT</th>
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
                      <p className="text-muted-foreground">No tests found. Add tests to the catalog.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tests.map((test: LabTestCatalog) => (
                  <tr key={test.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{test.testName ?? test.name}</div>
                      {test.normalRange && (
                        <div className="text-xs text-muted-foreground">Range: {test.normalRange}{test.unit ? ` ${test.unit}` : ''}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{test.testCode ?? test.code ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(test.labDepartment ?? test.department)?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{test.sampleType || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{test.turnaroundHours ? `${test.turnaroundHours}h` : test.turnaroundTime || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {test.price?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '-'}
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
                          >
                            <Pencil className="h-4 w-4" />
                          </DialogTrigger>
                          {editingTest?.id === test.id && (
                            <TestFormDialog
                              test={editingTest}
                              onClose={() => setEditingTest(null)}
                            />
                          )}
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(test.id, test.testName ?? test.name ?? 'Test')}
                          disabled={deleteTest.isPending}
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

function TestFormDialog({
  test,
  onClose,
}: {
  test?: LabTestCatalog;
  onClose: () => void;
}) {
  const isEdit = !!test;
  const [formData, setFormData] = useState({
    testName: test?.testName ?? test?.name ?? '',
    testCode: test?.testCode ?? test?.code ?? '',
    labDepartmentId: test?.labDepartmentId ?? test?.departmentId ?? '',
    sampleType: test?.sampleType ?? '',
    description: test?.description ?? '',
    normalRange: test?.normalRange ?? '',
    unit: test?.unit ?? '',
    turnaroundHours: test?.turnaroundHours ?? 0,
    price: Number(test?.price ?? 0),
  });

  const createTest = useCreateLabTest();
  const updateTest = useUpdateLabTest();
  const { data: deptData } = useLabDepartments({ limit: 100 });
  const departments = deptData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const payload = {
      testName: formData.testName,
      testCode: formData.testCode || undefined,
      labDepartmentId: formData.labDepartmentId,
      sampleType: formData.sampleType || undefined,
      description: formData.description || undefined,
      normalRange: formData.normalRange || undefined,
      unit: formData.unit || undefined,
      turnaroundHours: formData.turnaroundHours || undefined,
      price: formData.price,
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
    } catch {
      toast.error(isEdit ? 'Failed to update test' : 'Failed to create test');
    }
  };

  const isPending = createTest.isPending || updateTest.isPending;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Test' : 'Add Test'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update test details in the catalog.' : 'Add a new test to the catalog.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="test-name">Test Name *</Label>
            <Input
              id="test-name"
              value={formData.testName}
              onChange={(e) => setFormData((p) => ({ ...p, testName: e.target.value }))}
              placeholder="e.g. Complete Blood Count"
            />
          </div>
          <div>
            <Label htmlFor="test-code">Code</Label>
            <Input
              id="test-code"
              value={formData.testCode}
              onChange={(e) => setFormData((p) => ({ ...p, testCode: e.target.value }))}
              placeholder="e.g. CBC"
            />
          </div>
          <div>
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
          <div>
            <Label htmlFor="test-sample">Sample Type</Label>
            <Input
              id="test-sample"
              value={formData.sampleType}
              onChange={(e) => setFormData((p) => ({ ...p, sampleType: e.target.value }))}
              placeholder="e.g. Blood, Urine"
            />
          </div>
          <div>
            <Label htmlFor="test-range">Reference Range</Label>
            <Input
              id="test-range"
              value={formData.normalRange}
              onChange={(e) => setFormData((p) => ({ ...p, normalRange: e.target.value }))}
              placeholder="e.g. 12-16, <5, >100"
            />
          </div>
          <div>
            <Label htmlFor="test-unit">Unit</Label>
            <Input
              id="test-unit"
              value={formData.unit}
              onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
              placeholder="e.g. g/dL"
            />
          </div>
          <div>
            <Label htmlFor="test-tat">TAT Hours</Label>
            <Input
              id="test-tat"
              type="number"
              min={0}
              value={formData.turnaroundHours}
              onChange={(e) => setFormData((p) => ({ ...p, turnaroundHours: parseInt(e.target.value, 10) || 0 }))}
              placeholder="e.g. 4"
            />
          </div>
          <div>
            <Label htmlFor="test-price">Price *</Label>
            <Input
              id="test-price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="test-desc">Description</Label>
            <Textarea
              id="test-desc"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Test description..."
              rows={2}
            />
          </div>
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
