'use client';

import { useState } from 'react';
import { Building2, Landmark, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCorporatePayers, useCreateCorporatePayer, useCreateGovernmentScheme, useGovernmentSchemes } from '@/hooks/use-insurance-workflow';

type PayerKind = 'corporate' | 'government';
const EMPTY = { name: '', code: '', contactPerson: '', phone: '', email: '', address: '', gstin: '', creditDays: '30', portalUrl: '' };

export default function PayerMastersPage() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<PayerKind>('corporate');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const corporates = useCorporatePayers({ search: search || undefined, limit: 100 });
  const schemes = useGovernmentSchemes({ search: search || undefined, limit: 100 });
  const createCorporate = useCreateCorporatePayer();
  const createScheme = useCreateGovernmentScheme();

  async function save() {
    if (form.name.trim().length < 2) return toast.error('Payer name is required');
    try {
      if (kind === 'corporate') {
        await createCorporate.mutateAsync({ name: form.name, code: form.code || undefined, contactPerson: form.contactPerson || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, gstin: form.gstin || undefined, creditDays: Number(form.creditDays || 30) });
      } else {
        await createScheme.mutateAsync({ name: form.name, schemeCode: form.code || undefined, contactPerson: form.contactPerson || undefined, phone: form.phone || undefined, email: form.email || undefined, portalUrl: form.portalUrl || undefined });
      }
      toast.success(kind === 'corporate' ? 'Corporate payer created' : 'Government scheme created');
      setOpen(false); setForm(EMPTY);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Payer could not be created');
    }
  }

  function start(next: PayerKind) { setKind(next); setForm(EMPTY); setOpen(true); }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold font-headline">Payer Masters</h1><p className="text-sm text-on-surface-variant">Corporate payers and government schemes are separate from insurers and claim administrators.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => start('government')}><Landmark className="mr-1.5 size-4" /> Add Scheme</Button><Button onClick={() => start('corporate')}><Plus className="mr-1.5 size-4" /> Add Corporate</Button></div></div>
    <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payer master" className="pl-8" /></div>
    <Tabs defaultValue="corporate"><TabsList><TabsTrigger value="corporate">Corporate payers</TabsTrigger><TabsTrigger value="government">Government schemes</TabsTrigger></TabsList>
      <TabsContent value="corporate" className="mt-4"><Card><CardHeader><CardTitle>Corporate credit payers</CardTitle><CardDescription>Employers and organizations financially responsible for patient accounts.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{corporates.data?.data.length ? corporates.data.data.map((payer) => <Card key={payer.id}><CardHeader className="pb-2"><div className="flex items-start justify-between"><Building2 className="size-5 text-primary" /><Badge variant={payer.isActive ? 'default' : 'secondary'}>{payer.isActive ? 'Active' : 'Inactive'}</Badge></div><CardTitle className="text-base">{payer.name}</CardTitle><CardDescription>{payer.code ?? 'No internal code'}</CardDescription></CardHeader><CardContent className="text-sm text-on-surface-variant"><div>Credit: {payer.creditDays} days</div><div>{payer.contactPerson ?? 'No contact'}{payer.phone ? ` · ${payer.phone}` : ''}</div><div>{payer.gstin ?? 'GSTIN not recorded'}</div></CardContent></Card>) : <p className="text-sm text-on-surface-variant">No corporate payers found.</p>}</div></CardContent></Card></TabsContent>
      <TabsContent value="government" className="mt-4"><Card><CardHeader><CardTitle>Government schemes</CardTitle><CardDescription>Scheme identity and portal details used for authorizations and claims.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{schemes.data?.data.length ? schemes.data.data.map((payer) => <Card key={payer.id}><CardHeader className="pb-2"><div className="flex items-start justify-between"><Landmark className="size-5 text-primary" /><Badge variant={payer.isActive ? 'default' : 'secondary'}>{payer.isActive ? 'Active' : 'Inactive'}</Badge></div><CardTitle className="text-base">{payer.name}</CardTitle><CardDescription>{payer.schemeCode ?? 'No scheme code'}</CardDescription></CardHeader><CardContent className="text-sm text-on-surface-variant"><div>{payer.contactPerson ?? 'No contact'}{payer.phone ? ` · ${payer.phone}` : ''}</div><div className="truncate">{payer.portalUrl ?? 'Portal not recorded'}</div></CardContent></Card>) : <p className="text-sm text-on-surface-variant">No government schemes found.</p>}</div></CardContent></Card></TabsContent>
    </Tabs>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{kind === 'corporate' ? 'New corporate payer' : 'New government scheme'}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Name *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label={kind === 'corporate' ? 'Internal code' : 'Scheme code'} value={form.code} onChange={(value) => setForm({ ...form, code: value })} /><Field label="Contact person" value={form.contactPerson} onChange={(value) => setForm({ ...form, contactPerson: value })} /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />{kind === 'corporate' ? <><Field label="GSTIN" value={form.gstin} onChange={(value) => setForm({ ...form, gstin: value.toUpperCase() })} /><Field label="Credit days" type="number" value={form.creditDays} onChange={(value) => setForm({ ...form, creditDays: value })} /><div className="sm:col-span-2"><Label>Address</Label><Textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div></> : <div className="sm:col-span-2"><Field label="Scheme portal URL" type="url" value={form.portalUrl} onChange={(value) => setForm({ ...form, portalUrl: value })} /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={createCorporate.isPending || createScheme.isPending}>Create payer</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
