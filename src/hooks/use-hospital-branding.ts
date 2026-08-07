import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import apiClient from '@/lib/api-client';

// Per-hospital PDF/print branding (the "PDF Builder"). Hospital-admin only.
// Everything the hospital configures here is inherited by every PDF and print
// the system produces.

export interface BrandingVisibility {
  tagline: boolean;
  address: boolean;
  phone: boolean;
  email: boolean;
  website: boolean;
  registrationNo: boolean;
  gstin: boolean;
  accreditation: boolean;
  footer: boolean;
}

export const DEFAULT_ACCENT = '#0f766e';

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
  show: BrandingVisibility;
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

// ── Per-document-type templates ────────────────────────────────────────────
// The letterhead above is one identity for the whole hospital. A TEMPLATE is
// how ONE document type presents it: page size, typography, colours, what the
// header/footer show, watermark, table style, signature block and any custom
// text the hospital wants on that document. `__all__` carries the defaults every
// type inherits, so "set it once" and "but the register is landscape" both work.

export const ALL_DOCUMENTS_KEY = '__all__';

export type PdfDocumentType =
  | 'prescription'
  | 'discharge_summary'
  | 'ip_bill'
  | 'payment_receipt'
  | 'salary_slip'
  | 'ndps_register'
  | 'ndps_daily';

export type TemplateKey = PdfDocumentType | typeof ALL_DOCUMENTS_KEY;

export interface PdfCustomBlock {
  id: string;
  position: 'before_body' | 'after_body';
  heading: string | null;
  text: string;
}

export interface PdfTemplate {
  page: { size: 'A4' | 'A5' | 'LETTER' | 'LEGAL'; orientation: 'portrait' | 'landscape'; margin: number };
  typography: { fontFamily: 'Helvetica' | 'Times' | 'Courier'; baseFontSize: number; lineGap: number };
  colors: { accent: string | null; ink: string; muted: string };
  header: {
    showLetterhead: boolean;
    headerStyle: 'inherit' | 'centered' | 'left';
    showTitleBar: boolean;
    titleOverride: string | null;
    showMetaStrip: boolean;
  };
  footer: {
    showFooter: boolean;
    footerTextOverride: string | null;
    showPageNumbers: boolean;
    showGeneratedAt: boolean;
  };
  watermark: { enabled: boolean; text: string; opacity: number; angle: number; color: string | null; fontSize: number };
  table: {
    density: 'compact' | 'normal' | 'comfortable';
    headerFill: 'accent' | 'muted' | 'none';
    zebraRows: boolean;
    gridLines: 'none' | 'horizontal' | 'all';
  };
  signature: { enabled: boolean; labels: string[]; height: number };
  blocks: PdfCustomBlock[];
}

export interface PdfDocumentMeta {
  key: PdfDocumentType;
  label: string;
  group: string;
  description: string;
  defaultTitle: string;
}

export interface PdfTemplatesResponse {
  all: PdfTemplate;
  templates: Record<string, PdfTemplate>;
  /** Keys the hospital has actually overridden — the UI marks these. */
  customised: string[];
  registry: PdfDocumentMeta[];
  defaults: PdfTemplate;
}

export function usePdfTemplates() {
  return useQuery({
    queryKey: ['hospital-branding', 'templates'],
    queryFn: async () => (await apiGet<PdfTemplatesResponse>('/hospital-branding/templates')).data,
  });
}

export function useSavePdfTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, template }: { key: TemplateKey; template: Partial<PdfTemplate> }) =>
      (await apiPut<PdfTemplate>(`/hospital-branding/templates/${key}`, template)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-branding', 'templates'] }),
  });
}

export function useResetPdfTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: TemplateKey) =>
      (await apiDelete<PdfTemplate>(`/hospital-branding/templates/${key}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-branding', 'templates'] }),
  });
}

/**
 * A live sample PDF as an object URL. Reflects UNSAVED edits to both the
 * letterhead and the template, so the preview tracks the form rather than the
 * database.
 */
export async function fetchBrandingPreviewUrl(
  branding: Partial<HospitalBranding>,
  documentType: PdfDocumentType = 'prescription',
  template?: Partial<PdfTemplate>,
): Promise<string> {
  const res = await apiClient.post(
    '/hospital-branding/preview.pdf',
    { ...branding, documentType, template },
    { responseType: 'blob' },
  );
  return URL.createObjectURL(res.data as Blob);
}
