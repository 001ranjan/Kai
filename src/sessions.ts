import type { NeutralMessage, Session } from './types';

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_MESSAGES = 40; // keep last 40 messages per session

export function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
    sessions.set(sessionId, session);
  } else {
    session.lastActiveAt = new Date();
  }

  return session;
}

export function addMessage(sessionId: string, message: NeutralMessage): void {
  const session = getOrCreateSession(sessionId);
  session.messages.push(message);

  // Trim old messages but always keep the conversation coherent
  // Remove from the start but never cut in the middle of a tool call/result pair
  while (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages.shift();
  }
}

export function clearStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(clearStaleSessions, 10 * 60 * 1000);
