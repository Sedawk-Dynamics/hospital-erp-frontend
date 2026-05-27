'use client';

// Single entry point for the radiology viewer system. Auto-detects the file
// type from MIME / extension and dispatches to the appropriate sub-viewer
// (DICOM / PDF / image / ECG / video). Accepts either a single file (most
// common) or a series of files (for DICOM multi-slice).
//
// Usage:
//   <RadiologyViewer fileUrl="/uploads/abc.dcm" />
//   <RadiologyViewer fileUrl="/uploads/report.pdf" fileName="X-ray report" />
//   <RadiologyViewer files={[{ fileUrl: '...' }, …]} fileType="dicom" />

import { useMemo } from 'react';
import { ViewerShell } from './viewer-shell';
import { DicomProViewer } from './dicom-pro-viewer';
import { PdfViewer } from './pdf-viewer';
import { ImageViewer } from './image-viewer';
import { EcgViewer } from './ecg-viewer';
import type { RadiologyFile, RadiologyFileType, RadiologyViewerProps } from './viewer-types';
import { detectFileType } from './viewer-utils';
import { FileQuestion, Download } from 'lucide-react';

export function RadiologyViewer({
  fileUrl, fileName, mimeType, files, fileType = 'auto',
  studyMetadata, userRole, canDownload, className, dense, events,
}: RadiologyViewerProps) {
  // Normalize `files` array — single file → 1-element array.
  const fileList: RadiologyFile[] = useMemo(() => {
    if (files && files.length > 0) return files;
    if (fileUrl) return [{ fileUrl, fileName, mimeType }];
    return [];
  }, [files, fileUrl, fileName, mimeType]);

  // Resolve final type — explicit override > auto-detect first file.
  const resolvedType: RadiologyFileType = useMemo(() => {
    if (fileType !== 'auto') return fileType;
    const first = fileList[0];
    if (!first) return 'unknown';
    return detectFileType(first.fileUrl, first.mimeType, first.fileName);
  }, [fileType, fileList]);

  if (fileList.length === 0) {
    return (
      <ViewerShell title="No file" dense={dense} className={className} onClose={events?.onClose}>
        <div className="flex h-full items-center justify-center text-zinc-400">
          <FileQuestion className="size-8 mr-2" />
          <span className="text-sm">No file to display.</span>
        </div>
      </ViewerShell>
    );
  }

  switch (resolvedType) {
    case 'dicom':
      return (
        <DicomProViewer
          files={fileList}
          studyMetadata={studyMetadata}
          userRole={userRole}
          canDownload={canDownload}
          dense={dense}
          events={events}
          className={className}
        />
      );
    case 'pdf':
      return (
        <PdfViewer
          file={fileList[0]}
          studyMetadata={studyMetadata}
          userRole={userRole}
          canDownload={canDownload}
          dense={dense}
          events={events}
          className={className}
        />
      );
    case 'image':
      return (
        <ImageViewer
          file={fileList[0]}
          studyMetadata={studyMetadata}
          userRole={userRole}
          canDownload={canDownload}
          dense={dense}
          events={events}
          className={className}
        />
      );
    case 'ecg':
      return (
        <EcgViewer
          file={fileList[0]}
          studyMetadata={studyMetadata}
          userRole={userRole}
          canDownload={canDownload}
          dense={dense}
          events={events}
          className={className}
        />
      );
    case 'video':
      return (
        <ViewerShell
          title={fileList[0].fileName ?? 'Video'}
          metadata={studyMetadata}
          sizeBytes={fileList[0].sizeBytes}
          downloadUrl={fileList[0].fileUrl}
          downloadFileName={fileList[0].fileName}
          userRole={userRole}
          canDownload={canDownload}
          onClose={events?.onClose}
          dense={dense}
          className={className}
        >
          <div className="flex h-full items-center justify-center bg-black">
            <video
              src={fileList[0].fileUrl}
              controls
              autoPlay={false}
              className="max-h-full max-w-full"
              onLoadedMetadata={() => events?.onLoaded?.({ fileType: 'video' })}
              onError={() => events?.onError?.({ message: 'Video failed to load' })}
            />
          </div>
        </ViewerShell>
      );
    default:
      return (
        <ViewerShell
          title={fileList[0].fileName ?? 'File'}
          metadata={studyMetadata}
          sizeBytes={fileList[0].sizeBytes}
          downloadUrl={fileList[0].fileUrl}
          downloadFileName={fileList[0].fileName}
          userRole={userRole}
          canDownload={canDownload}
          onClose={events?.onClose}
          dense={dense}
          className={className}
        >
          <div className="flex h-full flex-col items-center justify-center text-zinc-300 px-6 py-8 text-center">
            <FileQuestion className="size-10 mb-3 opacity-70" />
            <p className="text-sm font-medium">Preview not available for this file type</p>
            <p className="text-xs opacity-70 mt-1">
              {fileList[0].mimeType ?? 'Unknown MIME type'}
            </p>
            <a
              href={fileList[0].fileUrl}
              target="_blank"
              rel="noreferrer"
              download={fileList[0].fileName}
              className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs"
            >
              <Download className="size-3.5" /> Download
            </a>
          </div>
        </ViewerShell>
      );
  }
}
