export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  isHost: boolean;
  isConnecting?: boolean;
  audioLevel?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export type ViewMode = 'speaker' | 'grid';

export type SidebarPanel = 'chat' | 'participants' | 'copilot' | null;

export interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
}
