import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import apiClient from '@/lib/api-client';

// Per-hospital PDF/print branding (the "PDF Builder"). Hospital-admin only.
// Everything the hospital configures here is inherited by every PDF and print
// the system produces.

export interface HospitalBranding {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  showLogo: boolean;
  headerStyle: 'centered' | 'left';
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  website: string | null;
  registrationNo: string | null;
  gstin: string | null;
  accreditation: string | null;
  footerText: string | null;
  accentColor: string;
}

export function useHospitalBranding() {
  return useQuery({
    queryKey: ['hospital-branding'],
    queryFn: async () => (await apiGet<HospitalBranding>('/hospital-branding')).data,
  });
}

export function useUpdateHospitalBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<HospitalBranding>) =>
      (await apiPut<HospitalBranding>('/hospital-branding', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-branding'] }),
  });
}

export function useUploadBrandingLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await apiClient.post('/hospital-branding/logo', fd, {
        headers: { 'Content-Type': undefined as unknown as string },
      });
      return (data as { data: HospitalBranding }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-branding'] }),
  });
}

export function useRemoveBrandingLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiDelete('/hospital-branding/logo')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-branding'] }),
  });
}

/** Fetch a live sample PDF (reflects unsaved edits) as an object URL for preview. */
export async function fetchBrandingPreviewUrl(branding: Partial<HospitalBranding>): Promise<string> {
  const res = await apiClient.post('/hospital-branding/preview.pdf', branding, { responseType: 'blob' });
  return URL.createObjectURL(res.data as Blob);
}
