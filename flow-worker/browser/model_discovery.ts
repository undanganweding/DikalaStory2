export interface ModelEvidence {
  id: string;
  displayName?: string;
  capabilities: string[];
}

export interface ModelDiscoveryEvidence {
  models: ModelEvidence[];
  candidateCount: number;
  candidates: Array<{ text: string; attributes: Record<string, string>; path: string }>;
}

const identityAttributes = ['data-model-id', 'data-model', 'model-id', 'modelid', 'aria-controls'];

export function extractVerifiedModels(candidates: ModelDiscoveryEvidence['candidates']): ModelDiscoveryEvidence {
  const models = candidates.flatMap((candidate) => {
    const id = identityAttributes.map((attribute) => candidate.attributes[attribute]).find((value) => value && /^[A-Za-z][A-Za-z0-9._:-]{2,}$/.test(value));
    return id ? [{ id, ...(candidate.text ? { displayName: candidate.text } : {}), capabilities: ['MODEL_DISCOVERY'] }] : [];
  });
  return { models, candidateCount: candidates.length, candidates };
}
