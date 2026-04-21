import { useState, useCallback, useRef, useEffect } from 'react';
import { t } from '../lib/i18n';
import type { Participant, ChatMessage, WsMessage } from '../types';

interface UseRoomOptions {
  roomCode: string;
  myParticipantId: string;
  onWs: (type: string, handler: (msg: WsMessage) => void) => () => void;
  sendWs: (type: string, payload: Record<string, unknown>) => void;
}

export function useRoom({ roomCode, myParticipantId, onWs, sendWs }: UseRoomOptions) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [meetingStartTime] = useState(() => Date.now());

  // Register WS event handlers
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onWs('meeting.peer_joined', (msg) => {
        const p = msg.payload as {
          participant_id: string;
          name: string;
          is_host: boolean;
          participants: Array<{
            id: string;
            name: string;
            is_host: boolean;
            is_muted: boolean;
            is_camera_off: boolean;
          }>;
        };

        // Rebuild participant list from authoritative server state.
        // This also cleans up ghost entries after a WS reconnect.
        setParticipants((prev) => {
          const next = new Map<string, Participant>();
          for (const part of p.participants) {
            const existing = prev.get(part.id);
            if (existing) {
              next.set(part.id, { ...existing, isHost: part.is_host });
            } else {
              next.set(part.id, {
                id: part.id,
                name: part.name,
                isMuted: part.is_muted,
                isCameraOff: part.is_camera_off,
                isHandRaised: false,
                isSpeaking: false,
                isScreenSharing: false,
                isHost: part.is_host,
              });
            }
          }
          // Keep entries not in server list only if they came from a different
          // source (shouldn't happen, but defensive)
          return next;
        });

        // Check if I'm host
        if (p.participant_id === myParticipantId && p.is_host) {
          setIsHost(true);
        }
      })
    );

    unsubs.push(
      onWs('meeting.peer_left', (msg) => {
        const p = msg.payload as { participant_id: string };
        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(p.participant_id);
          return next;
        });
      })
    );

    unsubs.push(
      onWs('meeting.chat', (msg) => {
        const p = msg.payload as {
          sender_id: string;
          sender_name: string;
          content: string;
          timestamp: number;
        };
        const chatMsg: ChatMessage = {
          id: `${p.timestamp}-${p.sender_id}`,
          senderId: p.sender_id,
          senderName: p.sender_name,
          content: p.content,
          timestamp: p.timestamp,
        };
        setMessages((prev) => [...prev, chatMsg]);
        if (p.sender_id !== myParticipantId) {
          setUnreadCount((c) => c + 1);
        }
      })
    );

    unsubs.push(
      onWs('meeting.hand_raise', (msg) => {
        const p = msg.payload as { participant_id: string; raised: boolean };
        setParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(p.participant_id);
          if (existing) {
            next.set(p.participant_id, { ...existing, isHandRaised: p.raised });
          }
          return next;
        });
      })
    );

    unsubs.push(
      onWs('meeting.host_transfer', (msg) => {
        const p = msg.payload as { new_host_id: string };
        setIsHost(p.new_host_id === myParticipantId);
        setParticipants((prev) => {
          const next = new Map(prev);
          for (const [id, part] of next) {
            next.set(id, { ...part, isHost: id === p.new_host_id });
          }
          return next;
        });
      })
    );

    unsubs.push(
      onWs('meeting.mute_participant', (msg) => {
        const p = msg.payload as { target_id: string; muted: boolean };
        if (p.target_id === myParticipantId) {
          // Host muted/unmuted us — update local state
          setParticipants((prev) => {
            const next = new Map(prev);
            const existing = next.get(p.target_id);
            if (existing) {
              next.set(p.target_id, { ...existing, isMuted: p.muted });
            }
            return next;
          });
        }
      })
    );

    unsubs.push(
      onWs('meeting.screen_share', (msg) => {
        const p = msg.payload as { participant_id: string; active: boolean };
        setParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(p.participant_id);
          if (existing) {
            next.set(p.participant_id, { ...existing, isScreenSharing: p.active });
          }
          return next;
        });
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [onWs, myParticipantId]);

  const sendChat = useCallback(
    (content: string) => {
      sendWs('meeting.chat', {
        room_code: roomCode,
        sender_id: myParticipantId,
        sender_name: participants.get(myParticipantId)?.name || t('meeting.anonymous'),
        content,
        timestamp: Date.now(),
      });
    },
    [roomCode, myParticipantId, participants, sendWs]
  );

  const toggleHandRaise = useCallback(
    (raised: boolean) => {
      sendWs('meeting.hand_raise', {
        room_code: roomCode,
        participant_id: myParticipantId,
        raised,
      });
    },
    [roomCode, myParticipantId, sendWs]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      sendWs('meeting.reaction', {
        room_code: roomCode,
        participant_id: myParticipantId,
        emoji,
      });
    },
    [roomCode, myParticipantId, sendWs]
  );

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return {
    participants,
    setParticipants,
    messages,
    unreadCount,
    clearUnread,
    isHost,
    meetingStartTime,
    sendChat,
    toggleHandRaise,
    sendReaction,
  };
}
