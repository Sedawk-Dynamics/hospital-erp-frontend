'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Save, FileText, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { resolveLogoUrl } from '@/hooks/use-branding';
import {
  useHospitalBranding, useUpdateHospitalBranding, useUploadBrandingLogo, useRemoveBrandingLogo,
  fetchBrandingPreviewUrl, DEFAULT_ACCENT, type HospitalBranding, type BrandingVisibility,
} from '@/hooks/use-hospital-branding';

const ALL_VISIBLE: BrandingVisibility = {
  tagline: true, address: true, phone: true, email: true, website: true,
  registrationNo: true, gstin: true, accreditation: true, footer: true,
};

const EMPTY: HospitalBranding = {
  name: '', tagline: null, logoUrl: null, showLogo: true, headerStyle: 'centered',
  addressLine1: null, addressLine2: null, city: null, state: null, pincode: null, country: null,
  phone: null, altPhone: null, email: null, website: null, registrationNo: null, gstin: null,
  accreditation: null, footerText: null, accentColor: DEFAULT_ACCENT, show: { ...ALL_VISIBLE },
};

// The fields the admin can hide, in display order.
const VISIBILITY_FIELDS: Array<{ key: keyof BrandingVisibility; label: string }> = [
  { key: 'tagline', label: 'Tagline' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone number(s)' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'registrationNo', label: 'Registration / License No' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'accreditation', label: 'Accreditation' },
  { key: 'footer', label: 'Footer note' },
];

export default function PdfBuilderPage() {
  const { data, isLoading } = useHospitalBranding();
  const update = useUpdateHospitalBranding();
  const uploadLogo = useUploadBrandingLogo();
  const removeLogo = useRemoveBrandingLogo();

  const [form, setForm] = useState<HospitalBranding>(EMPTY);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof HospitalBranding>(k: K, v: HospitalBranding[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setShow = (k: keyof BrandingVisibility, v: boolean) =>
    setForm((f) => ({ ...f, show: { ...f.show, [k]: v } }));
  const setStr = (k: keyof HospitalBranding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(k, (e.target.value || null) as HospitalBranding[typeof k]);

  // Debounced live PDF preview — reflects unsaved edits exactly as they'll print.
  const formKey = useMemo(() => JSON.stringify(form), [form]);
  useEffect(() => {
    if (isLoading) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPreviewing(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = await fetchBrandingPreviewUrl(form);
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch {
        /* keep last preview */
      } finally {
        setPreviewing(false);
      }
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, isLoading]);

  const onSave = async () => {
    try {
      await update.mutateAsync(form);
      toast.success('Branding saved — it now appears on every PDF and print.');
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not save branding.');
    }
  };

  const onPickLogo = async (file: File) => {
    try {
      const b = await uploadLogo.mutateAsync(file);
      set('logoUrl', b.logoUrl);
      toast.success('Logo uploaded.');
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not upload the logo.');
    }
  };

  const onRemoveLogo = async () => {
    try { await removeLogo.mutateAsync(); set('logoUrl', null); toast.success('Logo removed.'); }
    catch (e) { toast.error((e as Error)?.message || 'Could not remove the logo.'); }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading branding…</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold"><FileText className="h-5 w-5 text-primary" /> PDF &amp; Print Builder</h1>
          <p className="text-xs text-muted-foreground">Your hospital&apos;s letterhead — logo, name, address, contact &amp; colours. It appears on <strong>every</strong> PDF and print the system produces.</p>
        </div>
        <Button onClick={onSave} disabled={update.isPending} className="gap-1.5">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save branding
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- Left: editor ---- */}
        <div className="space-y-4">
          {/* Logo + appearance */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Logo &amp; appearance</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveLogoUrl(form.logoUrl)} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickLogo(f); e.currentTarget.value = ''; }} />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploadLogo.isPending}>
                    {uploadLogo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload logo
                  </Button>
                  {form.logoUrl && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={onRemoveLogo} disabled={removeLogo.isPending}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">PNG / JPG / WebP, max 10&nbsp;MB.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">Header layout</Label>
                  <select value={form.headerStyle} onChange={(e) => set('headerStyle', e.target.value as HospitalBranding['headerStyle'])}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="centered">Centered (logo above name)</option>
                    <option value="left">Left (logo beside name)</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Accent colour</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="h-9 w-11 cursor-pointer rounded border" />
                    <Input value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} className="h-9 flex-1" />
                    <Button
                      size="sm" variant="ghost" className="h-9 shrink-0 px-2 text-[11px]"
                      onClick={() => set('accentColor', DEFAULT_ACCENT)}
                      disabled={form.accentColor.toLowerCase() === DEFAULT_ACCENT}
                      title="Reset the accent colour to the default"
                    >
                      Default
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Hospital identity</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Hospital name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Tagline" className="sm:col-span-2"><Input value={form.tagline ?? ''} onChange={setStr('tagline')} placeholder="e.g. Caring for life" /></Field>
              <Field label="Registration / License No"><Input value={form.registrationNo ?? ''} onChange={setStr('registrationNo')} /></Field>
              <Field label="GSTIN"><Input value={form.gstin ?? ''} onChange={setStr('gstin')} /></Field>
              <Field label="Accreditation (e.g. NABH)" className="sm:col-span-2"><Input value={form.accreditation ?? ''} onChange={setStr('accreditation')} /></Field>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Address</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Address line 1" className="sm:col-span-2"><Input value={form.addressLine1 ?? ''} onChange={setStr('addressLine1')} /></Field>
              <Field label="Address line 2" className="sm:col-span-2"><Input value={form.addressLine2 ?? ''} onChange={setStr('addressLine2')} /></Field>
              <Field label="City"><Input value={form.city ?? ''} onChange={setStr('city')} /></Field>
              <Field label="State"><Input value={form.state ?? ''} onChange={setStr('state')} /></Field>
              <Field label="Pincode"><Input value={form.pincode ?? ''} onChange={setStr('pincode')} /></Field>
              <Field label="Country"><Input value={form.country ?? ''} onChange={setStr('country')} /></Field>
            </CardContent>
          </Card>

          {/* Contact + footer */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Contact &amp; footer</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone"><Input value={form.phone ?? ''} onChange={setStr('phone')} /></Field>
              <Field label="Alternate phone"><Input value={form.altPhone ?? ''} onChange={setStr('altPhone')} /></Field>
              <Field label="Email"><Input value={form.email ?? ''} onChange={setStr('email')} /></Field>
              <Field label="Website"><Input value={form.website ?? ''} onChange={setStr('website')} /></Field>
              <Field label="Footer note (shown at the bottom of every document)" className="sm:col-span-2">
                <Textarea rows={2} value={form.footerText ?? ''} onChange={setStr('footerText')} placeholder="e.g. This is a computer-generated document. In case of emergency, contact the hospital." className="resize-none" />
              </Field>
            </CardContent>
          </Card>

          {/* What shows on the PDF */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Show on the document</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Toggle label="Logo" checked={form.showLogo} onChange={(v) => set('showLogo', v)} />
              {VISIBILITY_FIELDS.map((f) => (
                <Toggle key={f.key} label={f.label} checked={form.show[f.key]} onChange={(v) => setShow(f.key, v)} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ---- Right: live PDF preview ---- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                Live preview {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </CardTitle>
              <a href={previewUrl ?? undefined} target="_blank" rel="noreferrer"
                className={cn('inline-flex items-center gap-1 text-[11px] text-primary hover:underline', !previewUrl && 'pointer-events-none opacity-40')}>
                <RefreshCw className="h-3 w-3" /> Open full PDF
              </a>
            </CardHeader>
            <CardContent className="p-0">
              {previewUrl ? (
                <iframe title="Branding preview" src={`${previewUrl}#toolbar=0`} className="h-[70vh] w-full border-0 bg-white" />
              ) : (
                <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering preview…</div>
              )}
            </CardContent>
          </Card>
          <p className="mt-2 text-[11px] text-muted-foreground">This is a sample document. The same letterhead &amp; footer apply to discharge summaries, bills, receipts, lab &amp; radiology reports, prescriptions and every other PDF/print.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
      <span className={checked ? 'text-foreground' : 'text-muted-foreground line-through'}>{label}</span>
    </label>
  );
}
