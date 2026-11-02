import { z } from 'zod/v4';

// Fields a patient may edit on their own / family profile. Mirrors the backend
// PUT /patient-portal/profile/:id body (all optional → partial update). Empty
// strings are allowed from the form and dropped before sending.
export const profileEditSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  phone: z.string().trim().max(20),
  dateOfBirth: z.string().trim(), // ISO date string (YYYY-MM-DD) or ''
  gender: z.enum(['male', 'female', 'other']).or(z.literal('')),
  bloodGroup: z.string().trim().max(5),
  addressLine1: z.string().trim().max(255),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
});

/** Values tracked by the edit-profile form. */
export type ProfileEditValues = z.infer<typeof profileEditSchema>;

/** Empty defaults for the form. */
export const PROFILE_EDIT_DEFAULTS: ProfileEditValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  addressLine1: '',
  city: '',
  state: '',
};
