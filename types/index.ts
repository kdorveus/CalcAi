export interface ChatBubble {
  id: string;
  type: 'user' | 'result' | 'error' | 'speech' | 'calc' | 'result-input';
  content: string;
}
