import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete } from '@/lib/api';
import apiClient from '@/lib/api-client';

// ============================================================
// Platform branding — the super-admin's two logo variants.
//   logoLightUrl : logo for LIGHT backgrounds (login, sidebars, navbar)
//   logoDarkUrl  : logo for DARK backgrounds  (e.g. website footer)
// (About the surface the logo sits on — NOT an app light/dark theme.)
// ============================================================

export type LogoVariant = 'light' | 'dark';

export interface PlatformBranding {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  updatedAt: string | null;
}

/** Turn a stored `/uploads/x.png` into a browser-loadable absolute URL. */
export function resolveLogoUrl(fileUrl?: string | null): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, '');
  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

export function usePlatformBranding() {
  return useQuery({
    queryKey: ['platform-branding'],
    queryFn: async () => (await apiGet<PlatformBranding>('/platform-branding')).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadPlatformLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { variant: LogoVariant; file: File }) => {
      const fd = new FormData();
      fd.append('file', input.file);
      fd.append('variant', input.variant);
      // Force Content-Type undefined so axios sets the multipart boundary.
      const { data } = await apiClient.post('/platform-branding/logo', fd, {
        headers: { 'Content-Type': undefined as unknown as string },
      });
      return (data as { data: PlatformBranding }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-branding'] }),
  });
}

export function useDeletePlatformLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (variant: LogoVariant) =>
      (await apiDelete('/platform-branding/logo', { params: { variant } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-branding'] }),
  });
}
