'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical, ChevronDown, User, Stethoscope, Calendar, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useDoctorProfile } from '@/hooks/use-doctor';
import { DoctorScheduleManager } from '@/components/shared/doctor-schedule-manager';
import { fullName } from '@/lib/person-name';

type SettingsTab = 'profile' | 'schedule' | 'layout' | 'notes';

interface LayoutItem {
  id: string;
  systemName: string;
  customName: string;
  enabled: boolean;
}

const defaultLayoutItems: LayoutItem[] = [
  { id: '1', systemName: 'Symptoms', customName: 'Symptoms', enabled: true },
  { id: '2', systemName: 'Vitals', customName: 'Vitals', enabled: true },
  { id: '3', systemName: 'Allergies', customName: 'Allergies', enabled: true },
  { id: '4', systemName: 'Patient Category', customName: 'Patient Category', enabled: true },
  { id: '5', systemName: 'Examination', customName: 'Examination', enabled: true },
  { id: '6', systemName: 'Diagnosis', customName: 'Diagnosis', enabled: true },
  { id: '7', systemName: 'Prescription', customName: 'Prescription', enabled: true },
];

export default function DoctorSettingsPage() {
  const { user } = useAuthStore();
  const { data: doctorProfile, isLoading: profileLoading } = useDoctorProfile();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>(defaultLayoutItems);

  // Doctor Notes config state
  const [lockPeriod, setLockPeriod] = useState('30');
  const [prescriptionSearch, setPrescriptionSearch] = useState('both');
  const [autoFetchDrugs, setAutoFetchDrugs] = useState(true);
  const [homeLanding, setHomeLanding] = useState('all');
  const [singleCommentBox, setSingleCommentBox] = useState(false);

  const toggleLayoutItem = (id: string) => {
    setLayoutItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const updateCustomName = (id: string, name: string) => {
    setLayoutItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, customName: name } : item
      )
    );
  };

  const handleSaveLayout = () => {
    toast.success('Layout configuration saved');
  };

  const handleResetLayout = () => {
    setLayoutItems(defaultLayoutItems);
    toast.info('Layout reset to default');
  };

  const handleSaveNotes = () => {
    toast.success('Doctor notes configuration saved');
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Doctor Profile
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'schedule'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'layout'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Layout Configuration
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'notes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Doctor Notes Configuration
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          {profileLoading ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">Loading profile...</p>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-headline text-xl font-bold">
                      Dr. {user?.firstName} {user?.lastName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {doctorProfile?.specialization || 'General Medicine'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Professional Info */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Professional Information</h3>
                  </div>
                  <div className="space-y-3">
                    <InfoRow label="Specialization" value={doctorProfile?.specialization || '-'} />
                    <InfoRow label="Qualification" value={doctorProfile?.qualification || '-'} />
                    <InfoRow label="License Number" value={doctorProfile?.licenseNumber || '-'} />
                    <InfoRow
                      label="Consultation Fee"
                      value={doctorProfile?.consultationFee ? `Rs. ${doctorProfile.consultationFee}` : '-'}
                    />
                    <InfoRow
                      label="Availability"
                      value={doctorProfile?.isAvailable ? 'Available' : 'Not Available'}
                      valueClassName={doctorProfile?.isAvailable ? 'text-primary' : 'text-error'}
                    />
                  </div>
                </div>

                {/* Personal Info */}
                <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Personal Information</h3>
                  </div>
                  <div className="space-y-3">
                    <InfoRow label="Full Name" value={`${user?.firstName || ''} ${user?.lastName || ''}`} />
                    <InfoRow label="Email" value={user?.email || '-'} />
                    <InfoRow label="Phone" value={user?.phone || '-'} />
                    <InfoRow label="Role" value={user?.role?.name || '-'} />
                    <InfoRow
                      label="Status"
                      value={user?.isActive ? 'Active' : 'Inactive'}
                      valueClassName={user?.isActive ? 'text-primary' : 'text-error'}
                    />
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-5 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs text-foreground">
              <p className="font-medium">Your schedule & consultation fee are managed by the Hospital Admin / HR.</p>
              <p className="text-muted-foreground mt-1">
                To change working hours, shifts, or fees, please contact your administrator.
                You can <a href="/doctor/schedule" className="text-primary hover:underline">view your calendar</a> or <a href="/doctor/leaves" className="text-primary hover:underline">apply for leave</a>.
              </p>
            </div>
          </div>
          {doctorProfile?.id ? (
            <DoctorScheduleManager
              doctorId={doctorProfile.id}
              doctorName={`Dr. ${fullName(user)}`}
              readOnly
            />
          ) : profileLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No doctor profile found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your hospital administrator to set up your profile.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Layout Configuration Tab */}
      {activeTab === 'layout' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
          {/* Header */}
          <div className="grid grid-cols-2 bg-muted/50 border-b">
            <div className="px-4 py-3 font-medium text-sm text-muted-foreground">System Name</div>
            <div className="px-4 py-3 font-medium text-sm text-muted-foreground">Custom Name</div>
          </div>

          {/* Layout items */}
          {layoutItems.map((item) => (
            <div key={item.id} className="grid grid-cols-2 border-b last:border-0 items-center">
              <div className="px-4 py-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleLayoutItem(item.id)}
                    className="rounded border-border"
                  />
                  <span className={cn(
                    'text-sm font-medium',
                    item.enabled ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {item.systemName}
                  </span>
                </label>
              </div>
              <div className="px-4 py-3">
                <Input
                  value={item.customName}
                  onChange={(e) => updateCustomName(item.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex justify-center gap-3 p-4 border-t">
            <Button variant="outline" onClick={handleResetLayout}>RESET LAYOUT</Button>
            <Button onClick={handleSaveLayout}>SAVE LAYOUT</Button>
          </div>
        </div>
      )}

      {/* Doctor Notes Configuration Tab */}
      {activeTab === 'notes' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-6 shadow-sm ring-1 ring-foreground/5">
          <h3 className="font-semibold text-foreground text-lg">Doctor Notes Configuration</h3>

          <div className="space-y-5">
            {/* Lock period */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Duration for Doctor Notes Lock Period ?
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={lockPeriod}
                  onChange={(e) => setLockPeriod(e.target.value)}
                  className="w-20 h-8 text-sm text-right"
                />
                <span className="text-sm font-medium text-foreground">Days</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3 text-right">
              *3 days is the default lock period
            </p>

            {/* Prescription Search Based On */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Prescription Search Based On
              </label>
              <Select value={prescriptionSearch} onValueChange={(v) => setPrescriptionSearch(v ?? 'both')}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="brand">Brand Name</SelectItem>
                  <SelectItem value="generic">Generic Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-fetch Previous Drugs */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Prescription - Auto-fetch Previous Drugs
              </label>
              <input
                type="checkbox"
                checked={autoFetchDrugs}
                onChange={(e) => setAutoFetchDrugs(e.target.checked)}
                className="rounded border-border h-4 w-4"
              />
            </div>

            {/* Home Screen Landing */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Home Screen Landing Based On
              </label>
              <Select value={homeLanding} onValueChange={(v) => setHomeLanding(v ?? 'all')}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Print options */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Select default option for Print
              </label>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Single comment box */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">
                Complaints - Show individual comments in a single comment box
              </label>
              <input
                type="checkbox"
                checked={singleCommentBox}
                onChange={(e) => setSingleCommentBox(e.target.checked)}
                className="rounded border-border h-4 w-4"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setLockPeriod('30');
              setPrescriptionSearch('both');
              setAutoFetchDrugs(true);
              setHomeLanding('all');
              setSingleCommentBox(false);
              toast.info('Settings reset to defaults');
            }}>
              Reset
            </Button>
            <Button onClick={handleSaveNotes}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium text-foreground', valueClassName)}>{value}</span>
    </div>
  );
}
