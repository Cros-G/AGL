import { create } from 'zustand';
import type { Message, DiagnosisUpdate, ToolCallData, QuestionsData } from '@/types/diagnosis';

interface ConversationStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  projectId: string | null;
  sessionId: string | null;

  setProject: (projectId: string, sessionId: string) => void;
  addUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamChunk: (chunk: string) => void;
  finalizeAgentMessage: (content: string, diagnosisUpdate: DiagnosisUpdate | null) => void;
  addSystemMessage: (content: string) => void;
  addToolMessage: (toolCall: ToolCallData) => void;
  updateLastToolMessage: (toolCall: ToolCallData) => void;
  addQuestionsMessage: (data: QuestionsData) => void;
  markQuestionsAnswered: (messageId: string, savedAnswers?: Record<string, string>) => void;
  loadMessages: (messages: Message[]) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  projectId: null,
  sessionId: null,

  setProject: (projectId, sessionId) => set({ projectId, sessionId }),

  addUserMessage: (content) => {
    const message: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  startStreaming: () => set({ isStreaming: true, streamingContent: '' }),

  appendStreamChunk: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),

  finalizeAgentMessage: (content, diagnosisUpdate) => {
    const message: Message = {
      id: `msg_${Date.now()}_agent`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      diagnosisUpdate: diagnosisUpdate ?? undefined,
    };
    set((state) => ({
      messages: [...state.messages, message],
      isStreaming: false,
      streamingContent: '',
    }));
  },

  addSystemMessage: (content) => {
    const message: Message = {
      id: `msg_${Date.now()}_system`,
      role: 'system',
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  addToolMessage: (toolCall) => {
    const message: Message = {
      id: `msg_${Date.now()}_tool`,
      role: 'tool',
      content: toolCall.summary,
      timestamp: Date.now(),
      toolCall,
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  updateLastToolMessage: (toolCall) => {
    set((state) => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'tool') {
          msgs[i] = { ...msgs[i], content: toolCall.summary, toolCall };
          break;
        }
      }
      return { messages: msgs };
    });
  },

  addQuestionsMessage: (data) => {
    const message: Message = {
      id: `msg_${Date.now()}_questions`,
      role: 'questions',
      content: data.context || '请回答以下问题',
      timestamp: Date.now(),
      questionsData: data,
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  markQuestionsAnswered: (messageId, savedAnswers?: Record<string, string>) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.questionsData
          ? { ...m, questionsData: { ...m.questionsData, answered: true, savedAnswers } }
          : m
      ),
    }));
  },

  loadMessages: (messages) => set({ messages }),

  reset: () =>
    set({
      messages: [],
      isStreaming: false,
      streamingContent: '',
      projectId: null,
      sessionId: null,
    }),
}));
