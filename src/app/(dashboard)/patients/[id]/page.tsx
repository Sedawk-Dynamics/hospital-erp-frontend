'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageLoading } from '@/components/shared/loading';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  Droplets,
  AlertTriangle,
  Contact,
  FileText,
  Stethoscope,
} from 'lucide-react';
import { PatientPoliciesPanel } from '@/components/insurance/patient-policies-panel';
import apiClient from '@/lib/api-client';
import type { Patient } from '@/types';

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const { data } = await apiClient.get(`/patients/${id}`);
        setPatient(data.data);
      } catch {
        toast.error('Failed to fetch patient details');
        router.push('/patients');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPatient();
  }, [id, router]);

  if (isLoading) return <PageLoading />;
  if (!patient) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={`MRN: ${patient.mrn}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Patient
            </Button>
          </div>
        }
      />

      {/* Patient Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Gender</p>
              <p className="text-sm font-medium capitalize">{patient.gender}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Date of Birth</p>
              <p className="text-sm font-medium">
                {(() => {
                  try { return formatDate(patient.dateOfBirth); }
                  catch { return patient.dateOfBirth; }
                })()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Droplets className="h-3 w-3" /> Blood Group
              </p>
              <p className="text-sm font-medium">{patient.bloodGroup || 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={patient.isActive ? 'active' : 'inactive'} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone
              </p>
              <p className="text-sm font-medium">{patient.phone}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </p>
              <p className="text-sm font-medium">{patient.email || 'Not provided'}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Address
              </p>
              <p className="text-sm font-medium">
                {[patient.address, patient.city, patient.state, patient.zipCode]
                  .filter(Boolean)
                  .join(', ') || 'Not provided'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Contacts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="visits">Visit History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Insurance Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="text-sm font-medium">{patient.insuranceProvider || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Policy Number</p>
                  <p className="text-sm font-medium">{patient.insurancePolicyNumber || 'Not provided'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registration Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Registered On</p>
                  <p className="text-sm font-medium">
                    {(() => {
                      try { return formatDate(patient.createdAt); }
                      catch { return patient.createdAt; }
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">
                    {(() => {
                      try { return formatDate(patient.updatedAt); }
                      catch { return patient.updatedAt; }
                    })()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <PatientPoliciesPanel patientId={id} />
        </TabsContent>

        <TabsContent value="allergies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Allergies
              </CardTitle>
              <CardDescription>Known allergies and reactions</CardDescription>
            </CardHeader>
            <CardContent>
              {patient.allergies && patient.allergies.length > 0 ? (
                <div className="space-y-3">
                  {patient.allergies.map((allergy) => (
                    <div key={allergy.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{allergy.allergen}</p>
                        {allergy.reaction && (
                          <p className="text-xs text-muted-foreground">Reaction: {allergy.reaction}</p>
                        )}
                        {allergy.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{allergy.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize">{allergy.severity}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={AlertTriangle}
                  title="No Allergies Recorded"
                  description="No known allergies have been recorded for this patient."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Contact className="h-4 w-4" />
                Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.emergencyContacts && patient.emergencyContacts.length > 0 ? (
                <div className="space-y-3">
                  {patient.emergencyContacts.map((contact) => (
                    <div key={contact.id} className="rounded-lg border p-3">
                      <p className="font-medium text-sm">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </span>
                        {contact.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {contact.email}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Contact}
                  title="No Emergency Contacts"
                  description="No emergency contacts have been added for this patient."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={FileText}
                title="No Documents"
                description="No documents have been uploaded for this patient."
                action={<Button variant="outline" size="sm">Upload Document</Button>}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Visit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Stethoscope}
                title="No Visit History"
                description="No visits have been recorded for this patient yet."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
