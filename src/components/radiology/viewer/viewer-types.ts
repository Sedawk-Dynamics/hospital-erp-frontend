// Shared types for the radiology viewer system.

export type RadiologyFileType = 'dicom' | 'pdf' | 'image' | 'ecg' | 'video' | 'unknown';

export interface RadiologyFile {
  /** Absolute URL to the file. Backend must serve it with permissive CORS. */
  fileUrl: string;
  /** Original filename — used to detect the type when MIME is missing. */
  fileName?: string;
  /** MIME type as reported by the backend; optional. */
  mimeType?: string;
  /** Optional file size for the metadata header. */
  sizeBytes?: number;
}

export interface StudyMetadata {
  /** Patient demographics shown in the viewer header. */
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  modality?: string;
  bodyPart?: string;
  studyDescription?: string;
  /** Free-form additional badges to render. */
  extras?: Array<{ label: string; value: string }>;
}

export interface ViewerEvents {
  /** Fired after the file has been fetched + parsed + first frame rendered. */
  onLoaded?: (payload: ViewerLoadedPayload) => void;
  /** Fired when the user adds/edits a measurement. */
  onMeasurement?: (payload: MeasurementPayload) => void;
  /** Fired when the user adds an annotation note. */
  onAnnotation?: (payload: AnnotationPayload) => void;
  /** Fired on any non-recoverable error. */
  onError?: (payload: { message: string; cause?: unknown }) => void;
  /** Fired when the user closes the viewer (modal mode). */
  onClose?: () => void;
}

export interface ViewerLoadedPayload {
  fileType: RadiologyFileType;
  /** For DICOM: number of frames/slices. For PDF: pages. */
  count?: number;
  metadata?: Record<string, unknown>;
}

export interface MeasurementPayload {
  kind: 'length' | 'angle';
  /** Display string e.g. "12.3 mm" or "47°". */
  display: string;
  /** Canvas-relative numeric value. */
  value: number;
  points: Array<{ x: number; y: number }>;
}

export interface AnnotationPayload {
  text: string;
  point: { x: number; y: number };
}

export interface RadiologyViewerProps {
  /** Single file (DICOM/PDF/image/ECG/video). Use `files` for a multi-slice series. */
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  /** Multi-slice series — array of DICOM URLs. Auto-enables stack-scroll + cine. */
  files?: RadiologyFile[];
  /** Type override. 'auto' (default) infers from extension/MIME. */
  fileType?: RadiologyFileType | 'auto';
  /** Study/patient header shown in the viewer toolbar. */
  studyMetadata?: StudyMetadata;
  /** Role hint — used to gate the Download button. Pass the auth store role. */
  userRole?: string;
  /** When false, the Download button is hidden regardless of role. */
  canDownload?: boolean;
  /** Render mode — modal handled by parent; component itself is layout-agnostic. */
  className?: string;
  /** Use a compact height (480px) instead of filling parent. Helpful for inline previews. */
  dense?: boolean;
  /** All event callbacks. */
  events?: ViewerEvents;
}

/** Window/level preset. Values are in HU for CT (rescaled). */
export interface WLPreset {
  name: string;
  shortLabel: string;
  wc: number;
  ww: number;
}
