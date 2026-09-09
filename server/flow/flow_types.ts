export type FlowSessionState =
  | 'UNKNOWN'
  | 'CHECKING'
  | 'AUTHENTICATED'
  | 'EXPIRED'
  | 'REAUTH_REQUIRED'
  | 'BOT_CHALLENGE'
  | 'PAYWALL'
  | 'UNAVAILABLE';

export type CredentialDomain = 'API' | 'GOOGLE_FLOW_SESSION';
export type ResourceDomain = 'API_QUOTA' | 'GOOGLE_FLOW_CREDITS';

export interface FlowSession {
  sessionId: string;
  accountId: string;
  status: FlowSessionState;
  browserProfile?: string;
  transport: 'CDP' | 'PLAYWRIGHT' | 'PAGE_FETCH' | 'UNKNOWN';
  capabilities: string[];
  lastChecked?: string;
  activeProjectId?: string;
}

export interface ApiCredentialRef {
  credentialDomain: 'API';
  providerId: string;
  credentialId: string;
}

export interface FlowSessionCredentialRef {
  credentialDomain: 'GOOGLE_FLOW_SESSION';
  providerId: 'google-flow';
  sessionId: string;
}

export type CredentialRef = ApiCredentialRef | FlowSessionCredentialRef;

export interface ResourceRef {
  resourceDomain: ResourceDomain;
  resourceId: string;
  providerId: string;
}

export interface FlowResourceSnapshot {
  resourceDomain: 'GOOGLE_FLOW_CREDITS';
  resourceId: string;
  accountId: string;
  credits?: number;
  checkedAt: string;
}
