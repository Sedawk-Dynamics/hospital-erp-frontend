'use client';

// Hospital admin Patient Forms management.
// Three tabs: Active (this hospital's published/draft forms), Templates
// (super-admin templates available to clone), Deleted (soft-deleted forms
// — submissions persist, can be restored).

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArchiveRestore,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  useHospitalForms,
  useFormTemplates,
  useCreateHospitalForm,
  useCloneTemplate,
  useArchiveHospitalForm,
  useRestoreHospitalForm,
  FORM_CATEGORIES,
  type HospitalForm,
  type FormCategory,
  type FormSchema,
  type FormTemplate,
} from '@/hooks/use-forms';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';

function categoryLabel(c: FormCategory): string {
  return FORM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export default function HospitalFormsSettingsPage() {
  const router = useRouter();
  const active = useHospitalForms({ status: 'active', limit: 200 });
  const archived = useHospitalForms({ status: 'archived', limit: 200 });
  const templates = useFormTemplates({ limit: 100, isPublished: true });

  const createForm = useCreateHospitalForm();
  const cloneTpl = useCloneTemplate();
  const archiveForm = useArchiveHospitalForm();
  const restoreForm = useRestoreHospitalForm();

  const [tab, setTab] = useState<'active' | 'templates' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<HospitalForm | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [preview, setPreview] = useState<{
    name: string;
    description: string | null;
    category: FormCategory;
    version: number;
    schema: FormSchema;
  } | null>(null);

  function openPreview(item: HospitalForm | FormTemplate) {
    setPreview({
      name: item.name,
      description: item.description,
      category: item.category,
      version: item.version,
      schema: item.schema,
    });
  }

  function filterByName<T extends { name: string }>(arr: T[]): T[] {
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter((x) => x.name.toLowerCase().includes(q));
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Please enter a form name');
      return;
    }
    try {
      const res = await createForm.mutateAsync({
        name: newName.trim(),
        description: null,
        category: 'other',
        schema: { fields: [], version: 1 },
        isPublished: false,
      });
      toast.success('Form created');
      setOpenNew(false);
      setNewName('');
      const id = res.data?.id;
      if (id) router.push(`/hospital/settings/forms/${id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  }

  async function handleClone(t: FormTemplate) {
    try {
      const res = await cloneTpl.mutateAsync({ templateId: t.id });
      toast.success(`Cloned "${t.name}"`);
      const id = res.data?.id;
      if (id) router.push(`/hospital/settings/forms/${id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await archiveForm.mutateAsync({ id: archiveTarget.id, reason: archiveReason || undefined });
      toast.success('Form archived. Past submissions remain readable.');
      setArchiveTarget(null);
      setArchiveReason('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  }

  async function handleRestore(f: HospitalForm) {
    try {
      await restoreForm.mutateAsync(f.id);
      toast.success('Form restored');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Patient Forms
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Build forms nurses can fill against patients. Clone from platform templates or build your own.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New form
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'templates' | 'archived')}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="active">Active ({active.data?.meta?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="archived">Deleted ({archived.data?.meta?.total ?? 0})</TabsTrigger>
        </TabsList>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search forms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* ─── Active ─────────────────────────────────── */}
        <TabsContent value="active" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            {active.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto my-8" />
            ) : (active.data?.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active forms. Build a new one or clone a template.
              </p>
            ) : (
              <ul className="divide-y">
                {filterByName(active.data?.data ?? []).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/hospital/settings/forms/${f.id}`}
                        className="font-semibold text-sm text-foreground hover:text-primary"
                      >
                        {f.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {categoryLabel(f.category)} · v{f.version} ·{' '}
                        {f.isPublished ? (
                          <span className="text-primary font-semibold">Published</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Draft</span>
                        )}{' '}
                        · {f._count?.submissions ?? 0} submission(s)
                        {f.template && (
                          <>
                            {' '}
                            · cloned from <span className="font-semibold">{f.template.name}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPreview(f)}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="p-1 rounded hover:bg-surface-container-high">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          render={
                            <Link href={`/hospital/settings/forms/${f.id}`}>
                              <ChevronRight className="h-3.5 w-3.5 mr-2" />
                              Open builder
                            </Link>
                          }
                        />
                        <DropdownMenuItem onClick={() => openPreview(f)}>
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setArchiveTarget(f)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete (archive)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ─── Templates ─────────────────────────────── */}
        <TabsContent value="templates" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Templates are built by the platform team. Cloning copies the schema into your hospital — later
              edits to the template don't affect your copy.
            </p>
            {templates.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto my-8" />
            ) : (templates.data?.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No published templates yet.
              </p>
            ) : (
              <ul className="divide-y">
                {filterByName(templates.data?.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {categoryLabel(t.category)} · v{t.version}
                        {t.description && ` · ${t.description}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPreview(t)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClone(t)}
                      disabled={cloneTpl.isPending}
                      className="gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Clone
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ─── Archived ─────────────────────────────── */}
        <TabsContent value="archived" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Deleted forms keep all their past submissions. Restore one to start accepting new submissions again.
            </p>
            {archived.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto my-8" />
            ) : (archived.data?.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No deleted forms.
              </p>
            ) : (
              <ul className="divide-y">
                {filterByName(archived.data?.data ?? []).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground line-through opacity-70">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {categoryLabel(f.category)} · {f._count?.submissions ?? 0} preserved submission(s)
                        {f.archivedAt && ` · deleted ${new Date(f.archivedAt).toLocaleDateString()}`}
                        {f.archiveReason && ` · "${f.archiveReason}"`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPreview(f)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(f)}
                      disabled={restoreForm.isPending}
                      className="gap-1.5"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      <FormPreviewDialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        name={preview?.name ?? ''}
        description={preview?.description}
        category={preview?.category ?? 'other'}
        version={preview?.version}
        schema={preview?.schema}
      />

      {/* New form */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
            <DialogDescription>
              Give it a name to start. You'll add fields on the next screen.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g. Pre-op checklist"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)} disabled={createForm.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createForm.isPending}>
              {createForm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this form?</DialogTitle>
            <DialogDescription>
              "{archiveTarget?.name}" will disappear from the nurse list and stop accepting new submissions.
              All {archiveTarget?._count?.submissions ?? 0} past submission(s) stay readable in the patient
              record. You can restore from the Deleted tab any time.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional: reason for deletion"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={2}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setArchiveTarget(null);
                setArchiveReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiveForm.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
