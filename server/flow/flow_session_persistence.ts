import fs from 'node:fs';
import path from 'node:path';
import { FlowSession } from './flow_types';

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'flow_sessions_meta.json');

function safeMetadata(session: FlowSession): FlowSession {
  return {
    sessionId: session.sessionId,
    accountId: session.accountId,
    status: session.status,
    transport: session.transport,
    capabilities: [...session.capabilities],
    lastChecked: session.lastChecked,
    activeProjectId: session.activeProjectId,
  };
}

export const flowSessionPersistence = {
  load(): FlowSession[] {
    try {
      if (!fs.existsSync(FILE)) return [];
      const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return Array.isArray(value) ? value.map(safeMetadata) : [];
    } catch {
      return [];
    }
  },

  save(sessions: FlowSession[]): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = `${FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(sessions.map(safeMetadata), null, 2), 'utf8');
    fs.renameSync(temp, FILE);
  },
};
