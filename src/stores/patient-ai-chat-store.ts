import {create} from "zustand";
import {persist } from "zustand/middleware";

export interface StoredAiMessage {
  role: 'user' | 'assistant';
  content: string;
  excludeFromHistory?: boolean;
  kind?: 'summary' | 'blood-report';
}

interface PatientAiChatState {
  byVisit: Record<string, StoredAiMessage[]>;
  getMessages: (visitId: string) => StoredAiMessage[];
  setMessages: (visitId: string, messages: StoredAiMessage[]) => void;
  clear: (visitId: string) => void;
}

export const usePatientAiChatStore = create<PatientAiChatState>()(
  persist(
    (set, get) => ({
      byVisit: {},
      getMessages: (visitId) => get().byVisit[visitId] ?? [],
      setMessages: (visitId, messages) =>
        set((s) => ({ byVisit: { ...s.byVisit, [visitId]: messages } })),
      clear: (visitId) =>
        set((s) => {
          const next = { ...s.byVisit };
          delete next[visitId];
          return { byVisit: next };
        }),
    }),
    { name: 'patient-ai-chat' }, // localStorage key
  ),
);
