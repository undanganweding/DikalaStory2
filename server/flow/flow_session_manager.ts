import { FlowSession, FlowSessionState } from './flow_types';
import { flowSessionPersistence } from './flow_session_persistence';

const sessions = new Map<string, FlowSession>(flowSessionPersistence.load().map((session) => [session.sessionId, session]));

function persist(): void {
  flowSessionPersistence.save([...sessions.values()]);
}

export const flowSessionManager = {
  register(session: FlowSession): FlowSession {
    const safeSession = { ...session, capabilities: [...session.capabilities] };
    sessions.set(session.sessionId, safeSession);
    persist();
    return { ...safeSession, capabilities: [...safeSession.capabilities] };
  },

  get(sessionId: string): FlowSession | undefined {
    const session = sessions.get(sessionId);
    return session ? { ...session } : undefined;
  },

  updateStatus(sessionId: string, status: FlowSessionState, checkedAt = new Date().toISOString()): FlowSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Flow session not found: ${sessionId}`);
    const updated = { ...session, status, lastChecked: checkedAt };
    sessions.set(sessionId, updated);
    persist();
    return { ...updated };
  },

  markChecked(sessionId: string, checkedAt = new Date().toISOString()): FlowSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Flow session not found: ${sessionId}`);
    const updated = { ...session, lastChecked: checkedAt };
    sessions.set(sessionId, updated);
    persist();
    return { ...updated };
  },

  list(): FlowSession[] {
    return [...sessions.values()].map((session) => ({ ...session }));
  },
};
