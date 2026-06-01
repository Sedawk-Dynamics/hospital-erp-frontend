// Public API for the radiology viewer.
//
// Architecture:
//   <RadiologyViewer>           — auto-detect + dispatcher (default export)
//     ├─ <DicomProViewer>       — DICOM (single + multi-slice), tools, cine
//     ├─ <PdfViewer>            — PDF.js
//     ├─ <ImageViewer>          — JPG/PNG/scan zoom+pan+rotate+invert
//     └─ <EcgViewer>            — routes by ext: PDF/img/raw → SVG plot
//   <ViewerShell>               — dark theme + toolbar slot (reused)
//
// Phase 2 (deferred):
//   Cornerstone3D integration for compressed transfer syntaxes (JPEG /
//   JPEG-2000 / RLE) and pro tools like MPR / volumetric MIP. The current
//   dicom-parser + canvas path covers all uncompressed exports which is
//   the bulk of what modalities emit.

export { RadiologyViewer } from './radiology-viewer';
export { DicomProViewer } from './dicom-pro-viewer';
export { DicomDetailedViewer } from './dicom-detailed-viewer';
export { OhifEmbed } from './ohif-embed';
export { PdfViewer } from './pdf-viewer';
export { ImageViewer } from './image-viewer';
export { EcgViewer } from './ecg-viewer';
export { ViewerShell } from './viewer-shell';
export { detectFileType, resolveFileUrl, formatFileSize } from './viewer-utils';
export type {
  RadiologyFile,
  RadiologyFileType,
  RadiologyViewerProps,
  StudyMetadata,
  ViewerEvents,
  MeasurementPayload,
  AnnotationPayload,
  ViewerLoadedPayload,
} from './viewer-types';
