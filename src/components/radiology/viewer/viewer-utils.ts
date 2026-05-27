// Type detection + small helpers shared across the radiology viewer.

import type { RadiologyFileType } from './viewer-types';

const EXT_TO_TYPE: Record<string, RadiologyFileType> = {
  dcm: 'dicom',
  dicom: 'dicom',
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  tif: 'image',
  tiff: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  xml: 'ecg',     // assume XML in radiology context = aECG (HL7)
  hl7: 'ecg',
  scp: 'ecg',     // SCP-ECG (proprietary, fallback to download)
  csv: 'ecg',     // CSV ECG export — heuristically treated as ECG
  json: 'ecg',    // muse/philips JSON ECG export
};

const MIME_TO_TYPE: Array<[RegExp, RadiologyFileType]> = [
  [/^application\/dicom/, 'dicom'],
  [/^application\/pdf$/, 'pdf'],
  [/^image\//, 'image'],
  [/^video\//, 'video'],
  [/^application\/(xml|hl7)/, 'ecg'],
  [/^text\/(csv|xml)/, 'ecg'],
  [/^application\/json/, 'ecg'],
];

/**
 * Auto-detect the radiology file type from MIME + filename. We prefer MIME
 * because some uploaders (multer) rewrite extensions; fall back to extension
 * only when MIME is generic (octet-stream) or missing.
 *
 * Note: JSON and CSV files are claimed by the ECG branch on purpose. In the
 * radiology context, the only structured-text files we expect ARE ECG
 * exports. If we add other tabular uploads later we'll need a more specific
 * signal (e.g., a category column on ImagingAttachment).
 */
export function detectFileType(
  fileUrl: string,
  mimeType?: string,
  fileName?: string,
): RadiologyFileType {
  // 1. MIME-driven path
  if (mimeType && mimeType !== 'application/octet-stream') {
    for (const [re, kind] of MIME_TO_TYPE) {
      if (re.test(mimeType)) return kind;
    }
  }

  // 2. Extension-driven path
  const name = (fileName || fileUrl).split('?')[0] ?? '';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext in EXT_TO_TYPE) return EXT_TO_TYPE[ext]!;

  return 'unknown';
}

export function isDicomMime(mime?: string): boolean {
  return !!mime && /^application\/dicom/.test(mime);
}

export function isPdfMime(mime?: string): boolean {
  return mime === 'application/pdf';
}

export function isImageMime(mime?: string): boolean {
  return !!mime && /^image\//.test(mime);
}

export function isVideoMime(mime?: string): boolean {
  return !!mime && /^video\//.test(mime);
}

/** Convert bytes → "1.2 MB" style. */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Resolve a relative /uploads/... URL against the API origin. */
export function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, '');
  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

/** Trigger a browser download via a hidden <a>. Used by the Download toolbar button. */
export function triggerDownload(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? '';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Whether the role (normalized) is allowed to download files. Defaults to true. */
export function canRoleDownload(role?: string): boolean {
  if (!role) return true;
  const r = role.toLowerCase().replace(/[\s-]+/g, '_');
  // Patient never sees download UI in the radiology toolbar — they download
  // from the patient portal which has its own gating.
  if (r === 'patient') return false;
  return true;
}
