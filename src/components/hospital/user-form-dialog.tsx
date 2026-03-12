'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserListItem, RoleOption } from '@/hooks/use-users';

// ============================================================
// Schema
// ============================================================

const userFormSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    password: z.string().optional(),
    roleIds: z.array(z.string()).min(1, 'At least one role is required'),
  })
  .refine(
    (data) => {
      // password required only for create mode (handled via context)
      return true;
    },
    { message: '' },
  );

type UserFormData = z.infer<typeof userFormSchema>;

// ============================================================
// Props
// ============================================================

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null; // null = create mode
  roles: RoleOption[];
  isSubmitting: boolean;
  onSubmit: (data: UserFormData) => void;
}

// ============================================================
// Component
// ============================================================

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  isSubmitting,
  onSubmit,
}: UserFormDialogProps) {
  const isEditMode = !!user;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      roleIds: [],
    },
  });

  const selectedRoleIds = watch('roleIds');

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          password: '',
          roleIds: user.userRoles.map((ur) => ur.role.id),
        });
      } else {
        reset({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          roleIds: [],
        });
      }
    }
  }, [open, user, reset]);

  const handleFormSubmit = (data: UserFormData) => {
    // Validate password for create mode
    if (!isEditMode && (!data.password || data.password.length < 8)) {
      return;
    }
    onSubmit(data);
  };

  const toggleRole = (roleId: string) => {
    const current = selectedRoleIds || [];
    if (current.includes(roleId)) {
      setValue(
        'roleIds',
        current.filter((id) => id !== roleId),
        { shouldValidate: true },
      );
    } else {
      setValue('roleIds', [...current, roleId], { shouldValidate: true });
    }
  };

  // Filter out super_admin and patient from assignable roles
  const assignableRoles = roles.filter(
    (r) => r.name !== 'super_admin' && r.name !== 'patient',
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update user details and role assignments.'
              : 'Create a new user for your hospital.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register('phone')} />
          </div>

          {/* Password - only in create mode */}
          {!isEditMode && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Min 8 characters"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}

          {/* Roles */}
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <div className="rounded-md border p-3 max-h-48 overflow-y-auto space-y-2">
              {assignableRoles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds?.includes(role.id) || false}
                    onChange={() => toggleRole(role.id)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="capitalize">
                    {role.name.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {role._count.userRoles} users
                  </span>
                </label>
              ))}
            </div>
            {errors.roleIds && (
              <p className="text-xs text-destructive">{errors.roleIds.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </span>
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
