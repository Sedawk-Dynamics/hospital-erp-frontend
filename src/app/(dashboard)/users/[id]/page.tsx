'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageLoading } from '@/components/shared/loading';
import { ArrowLeft, Edit, Mail, Phone, Shield, Calendar } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatRoleName } from '@/lib/utils';
import type { User } from '@/types';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await apiClient.get(`/users/${id}`);
        setUser(data.data);
      } catch {
        toast.error('Failed to fetch user details');
        router.push('/users');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [id, router]);

  if (isLoading) return <PageLoading />;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.role?.name ? formatRoleName(user.role.name) : 'User'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="gap-2">
              <Edit className="h-4 w-4" />
              Edit User
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{user.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="secondary">
                    {user.role?.name ? formatRoleName(user.role.name) : 'No role'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium">
                    {(() => { try { return user.createdAt ? format(new Date(user.createdAt), 'MMMM dd, yyyy') : '—'; } catch { return user.createdAt || '—'; } })()}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <StatusBadge status={user.isActive ? 'active' : 'inactive'} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email Verified</p>
                <StatusBadge status={user.emailVerified ? 'active' : 'pending'} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            {user.role?.permissions && user.role.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.role.permissions.map((perm) => (
                  <Badge key={perm.id} variant="outline" className="text-xs">
                    {perm.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specific permissions assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
