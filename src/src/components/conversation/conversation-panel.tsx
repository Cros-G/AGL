'use client';

import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface ConversationPanelProps {
  onSend: (content: string, options?: { silent?: boolean }) => void;
  onAbort?: () => void;
}

export function ConversationPanel({ onSend, onAbort }: ConversationPanelProps) {
  return (
    <div className="flex h-full flex-col bg-surface-1">
      <MessageList onSendAnswer={(content) => onSend(content, { silent: true })} />
      <MessageInput onSend={onSend} onAbort={onAbort} />
    </div>
  );
}
