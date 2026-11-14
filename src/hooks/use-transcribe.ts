import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Audio → text for the doctor consultation voice recording. The browser records
// webm/opus (MediaRecorder); we post the blob as multipart to POST /transcribe,
// and the backend hands it to the STT provider and returns the transcript.

export interface TranscribeInput {
  /** Recorded audio blob from MediaRecorder (audio/webm). */
  audio: Blob;
  /** Optional file name sent with the upload. */
  fileName?: string;
}

export function useTranscribe() {
  return useMutation({
    mutationFn: async ({ audio, fileName = 'recording.webm' }: TranscribeInput) => {
      const formData = new FormData();
      formData.append('audio', audio, fileName);

      const { data } = await apiClient.post('/transcribe', formData, {
        headers: { 'Content-Type': undefined as any },
      });
      return (data as { data: string }).data;
    },
  });
}
