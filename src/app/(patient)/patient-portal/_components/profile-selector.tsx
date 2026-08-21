'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, Check, ChevronDown, Loader2, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientProfileStore, type PatientProfile } from '@/stores/patient-profile-store';
import { apiPost } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'guardian', label: 'Guardian / Ward' },
  { value: 'other', label: 'Other' },
] as const;

function relationshipLabel(rel: string) {
  const map: Record<string, string> = {
    self: 'Self',
    spouse: 'Spouse',
    child: 'Child',
    parent: 'Parent',
    sibling: 'Sibling',
    guardian: 'Guardian',
    other: 'Other',
  };
  return map[rel] ?? rel;
}

function fullName(p: PatientProfile) {
  return `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`;
}

export function ProfileSelector() {
  const queryClient = useQueryClient();
  const {
    profiles,
    selectedProfileId,
    isLoading,
    hydrate,
    fetchProfiles,
    selectProfile,
  } = usePatientProfileStore();

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    hydrate();
    fetchProfiles();
  }, [hydrate, fetchProfiles]);

  const selected = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0];

  const handleSelect = (id: string) => {
    selectProfile(id);
    setOpen(false);
    // Every portal query is keyed by profile; invalidate everything to refetch scoped data.
    queryClient.invalidateQueries({ queryKey: ['patient'] });
  };

  if (isLoading && profiles.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading profiles...
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add first profile
        </button>
        <AddProfileDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreated={fetchProfiles}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-left hover:border-primary/40 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              {selected ? fullName(selected) : 'Select profile'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {selected ? relationshipLabel(selected.relationship) : '—'}
              {selected?.mrn ? ` · ${selected.mrn}` : ''}
            </p>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border bg-card shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Users className="inline h-3 w-3 mr-1" />
                  Family Profiles
                </p>
                <span className="text-[10px] text-muted-foreground">{profiles.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y">
                {profiles.map((p) => {
                  const active = p.id === selectedProfileId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                        active ? 'bg-primary/5' : 'hover:bg-muted',
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {p.firstName?.[0]}{p.lastName?.[0] ?? ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{fullName(p)}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {relationshipLabel(p.relationship)}
                          {p.mrn ? ` · ${p.mrn}` : ''}
                          {p.tenant?.name ? ` · ${p.tenant.name}` : ''}
                        </p>
                        {/* One entry stands for the PERSON, so it has to be
                            able to say they are on file at more than one
                            hospital — otherwise the row looks like it belongs
                            to a single one. Guarded because a response from
                            before this existed omits the field entirely. */}
                        {(p.alsoAt?.length ?? 0) > 0 && (
                          <p className="truncate text-[10px] text-muted-foreground/80">
                            also at {p.alsoAt!.map((t) => t.name).join(', ')}
                          </p>
                        )}
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); setAddOpen(true); }}
                className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                Add Family Member
              </button>
            </div>
          </>
        )}
      </div>

      <AddProfileDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={async () => {
          await fetchProfiles();
          toast.success('Family member added');
        }}
      />
    </>
  );
}

// ─── Add Profile Dialog ─────────────────────────────────────

interface AddProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}

function AddProfileDialog({ open, onOpenChange, onCreated }: AddProfileDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [relationship, setRelationship] = useState<typeof RELATIONSHIPS[number]['value']>('child');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFirstName(''); setLastName(''); setRelationship('child');
      setDateOfBirth(''); setGender('male'); setPhone(''); setEmail('');
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/patient-portal/profiles', {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        relationship,
        dateOfBirth: dateOfBirth || undefined,
        gender,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      await onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Add Family Member
          </DialogTitle>
          <DialogDescription>
            Create a new patient profile under your account. You can switch between profiles anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Relationship *</Label>
            <Select
              value={relationship}
              onValueChange={(v: string | null) => v && setRelationship(v as typeof relationship)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v: string | null) => v && setGender(v as typeof gender)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
