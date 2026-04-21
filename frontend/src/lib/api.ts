const API_BASE = '/api';

export interface CreatedRoom {
  code: string;
  joinUrl: string;
  /** One-shot token — present it to `mintParticipantToken` to join as host. */
  creatorToken: string;
}

export interface ParticipantTokens {
  livekitToken: string;
  joinToken: string;
  identity: string;
  url: string;
}

export async function createRoom(): Promise<CreatedRoom> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to create room');
  const data = await res.json();
  return { code: data.code, joinUrl: data.join_url, creatorToken: data.creator_token };
}

/**
 * Mint a LiveKit + signalling token pair.
 *
 * - `authToken` is the creator_token (first time, minting the host) or a
 *   previously issued join_token (for re-auth on reconnect).
 */
export async function mintParticipantToken(
  roomCode: string,
  name: string,
  authToken: string,
): Promise<ParticipantTokens> {
  const res = await fetch(`${API_BASE}/rooms/${roomCode}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to get LiveKit token');
  const data = await res.json();
  return {
    livekitToken: data.livekit_token,
    joinToken: data.join_token,
    identity: data.identity,
    url: data.url,
  };
}

/**
 * Join a room as an unprivileged participant. Returns the same token shape as
 * `mintParticipantToken` but does NOT grant host rights.
 */
export async function joinRoomPublic(
  roomCode: string,
  name: string,
): Promise<ParticipantTokens> {
  const res = await fetch(`${API_BASE}/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to join room');
  const data = await res.json();
  return {
    livekitToken: data.livekit_token,
    joinToken: data.join_token,
    identity: data.identity,
    url: data.url,
  };
}

export async function checkRoomExists(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/rooms/${code}`);
    return res.ok;
  } catch {
    return false;
  }
}

export function getWsUrl(roomCode: string, joinToken: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const q = new URLSearchParams({ room: roomCode, token: joinToken });
  return `${proto}//${window.location.host}/ws?${q.toString()}`;
}
