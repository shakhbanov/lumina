import { useRef, useCallback, useEffect, useState } from 'react';
import { getWsUrl } from '../lib/api';
import type { WsMessage } from '../types';

type MessageHandler = (event: WsMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const authRef = useRef<{ room: string; token: string } | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const [connected, setConnected] = useState(false);

  const startPing = useCallback((ws: WebSocket) => {
    clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', payload: {} }));
      }
    }, 25000);
  }, []);

  const connectInternal = useCallback(() => {
    const auth = authRef.current;
    if (!auth) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl(auth.room, auth.token));
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      startPing(ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'pong') return;
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) handlers.forEach((handler) => handler(msg));
        const wildcard = handlersRef.current.get('*');
        if (wildcard) wildcard.forEach((handler) => handler(msg));
      } catch {
        /* ignore invalid JSON */
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      clearInterval(pingTimerRef.current);
      const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
      reconnectAttemptsRef.current++;
      reconnectTimerRef.current = setTimeout(connectInternal, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [startPing]);

  const connect = useCallback(
    (room: string, token: string) => {
      authRef.current = { room, token };
      connectInternal();
    },
    [connectInternal],
  );

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    clearInterval(pingTimerRef.current);
    reconnectAttemptsRef.current = 999;
    authRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const on = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, send, on, connected, ws: wsRef };
}
