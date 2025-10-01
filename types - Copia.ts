
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export interface Settings {
  wakeWord: string;
  summaryTime: string; // HH:MM
}

// Discriminated union for AI actions for type safety
export type AIAssistantAction =
  | { type: 'CREATE_EVENT'; payload: { title: string; date: string; time: string; description?: string } }
  | { type: 'READ_EVENTS'; payload: { date: string } }
  | { type: 'SUMMARIZE_EVENTS'; payload: { period: 'today' | 'tomorrow' | 'this_week' } }
  | { type: 'OPEN_PROGRAM'; payload: { programName: string } }
  | { type: 'GENERAL_RESPONSE'; payload: { text: string } }
  | { type: 'ERROR'; payload: { message: string } };

