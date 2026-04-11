'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemForms, useUpdateSystemForm } from '@/hooks/use-forms';
import {
  CATEGORY_LABELS,
  TRIGGER_LABELS,
  MODULE_LABELS,
  type SystemForm,
  type FormTrigger,
  type FormCategory,
} from '@/types/forms';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';

const CATEGORY_COLORS: Record<FormCategory, string> = {
  registration: 'bg-blue-100 text-blue-800',
  consent: 'bg-purple-100 text-purple-800',
  intake: 'bg-teal-100 text-teal-800',
  feedback: 'bg-amber-100 text-amber-800',
  checklist: 'bg-orange-100 text-orange-800',
  clinical: 'bg-rose-100 text-rose-800',
  discharge: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-700',
};

export default function SuperAdminFormsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [previewForm, setPreviewForm] = useState<SystemForm | null>(null);
  const [collapsedTriggers, setCollapsedTriggers] = useState<Set<string>>(
    new Set(),
  );

  const { data, isLoading } = useSystemForms({ limit: 100 });
  const updateMutation = useUpdateSystemForm();

  const forms = data?.data ?? [];

  // Filter by search term (name or category label)
  const filtered = useMemo(() => {
    if (!search.trim()) return forms;
    const q = search.toLowerCase();
    return forms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        CATEGORY_LABELS[f.category]?.toLowerCase().includes(q) ||
        TRIGGER_LABELS[f.trigger]?.toLowerCase().includes(q),
    );
  }, [forms, search]);

  // Group by trigger
  const grouped = useMemo(() => {
    const map = new Map<FormTrigger, SystemForm[]>();
    for (const f of filtered) {
      const list = map.get(f.trigger) ?? [];
      list.push(f);
      map.set(f.trigger, list);
    }
    // Sort triggers alphabetically by label
    return [...map.entries()].sort((a, b) =>
      TRIGGER_LABELS[a[0]].localeCompare(TRIGGER_LABELS[b[0]]),
    );
  }, [filtered]);

  const toggleCollapse = (trigger: string) => {
    setCollapsedTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(trigger)) next.delete(trigger);
      else next.add(trigger);
      return next;
    });
  };

  const handleToggleActive = async (form: SystemForm) => {
    try {
      await updateMutation.mutateAsync({
        id: form.id,
        data: { isActive: !form.isActive },
      });
      toast.success(
        `${form.name} ${form.isActive ? 'deactivated' : 'activated'}`,
      );
    } catch {
      toast.error('Failed to update form status');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">System Forms</h1>
        <p className="font-label text-xs text-muted-foreground">
          Manage the 40 fixed system forms. Toggle active state or edit the
          schema for each form.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, category, or trigger..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium">No forms found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search
              ? 'Try adjusting your search term.'
              : 'No system forms have been seeded yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([trigger, triggerForms]) => {
            const isCollapsed = collapsedTriggers.has(trigger);
            const activeCount = triggerForms.filter((f) => f.isActive).length;

            return (
              <Card key={trigger}>
                <CardHeader
                  className="cursor-pointer select-none py-3 px-4"
                  onClick={() => toggleCollapse(trigger)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <CardTitle className="text-sm font-semibold">
                        {TRIGGER_LABELS[trigger]}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px]">
                        {triggerForms.length}{' '}
                        {triggerForms.length === 1 ? 'form' : 'forms'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {activeCount} / {triggerForms.length} active
                    </span>
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="pt-0 px-4 pb-2">
                    <div className="divide-y">
                      {triggerForms.map((form) => (
                        <div
                          key={form.id}
                          className="flex items-center justify-between gap-4 py-2.5"
                        >
                          {/* Name + badges */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {form.name}
                              </p>
                              {form.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-lg">
                                  {form.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-0.5 text-[10px] text-muted-foreground">
                                {form.appearsAt && (
                                  <span><span className="font-semibold">Appears:</span> {form.appearsAt}</span>
                                )}
                                {form.resultsVisibleAt?.length > 0 && (
                                  <span><span className="font-semibold">Results in:</span> {form.resultsVisibleAt.join(' · ')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Category badge */}
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] font-medium',
                                CATEGORY_COLORS[form.category],
                              )}
                            >
                              {CATEGORY_LABELS[form.category]}
                            </Badge>

                            {/* Trigger badge */}
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium"
                            >
                              {TRIGGER_LABELS[form.trigger]}
                            </Badge>

                            {/* Module badge */}
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium bg-violet-50 text-violet-700 border-violet-200"
                            >
                              {MODULE_LABELS[form.module] || form.module}
                            </Badge>

                            {/* Active/Inactive toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(form)}
                              disabled={updateMutation.isPending}
                              className={cn(
                                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                form.isActive ? 'bg-primary' : 'bg-muted',
                              )}
                              title={form.isActive ? 'Active' : 'Inactive'}
                            >
                              <span
                                className={cn(
                                  'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                                  form.isActive
                                    ? 'translate-x-4'
                                    : 'translate-x-0',
                                )}
                              />
                            </button>

                            {/* Preview button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => setPreviewForm(form)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Button>

                            {/* Edit Schema button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() =>
                                router.push(`/super-admin/forms/${form.id}`)
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit Schema
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      {previewForm && (
        <FormPreviewDialog
          open={!!previewForm}
          onClose={() => setPreviewForm(null)}
          schema={previewForm.schema}
          title={previewForm.name}
          description={previewForm.description}
          meta={[
            { label: 'Trigger', value: TRIGGER_LABELS[previewForm.trigger] || previewForm.trigger },
            { label: 'Category', value: CATEGORY_LABELS[previewForm.category] || previewForm.category },
          ]}
        />
      )}
    </div>
  );
}
