interface NineRouterConfig {
  baseUrl: string;
  apiKey: string;
}

interface NineRouterTextRequest {
  combo: string;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: unknown;
  maxTokens?: number;
  temperature?: number;
}

interface NineRouterTextResponse {
  text: string;
  model?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
}

function getConfig(): NineRouterConfig | null {
  const baseUrl = process.env.NINE_ROUTER_URL?.trim();
  const apiKey = process.env.NINE_ROUTER_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

export function isNineRouterConfigured(): boolean {
  return getConfig() !== null;
}

export async function executeNineRouterText(request: NineRouterTextRequest): Promise<NineRouterTextResponse> {
  const config = getConfig();
  if (!config) {
    throw new Error('9Router is not configured: NINE_ROUTER_URL and NINE_ROUTER_API_KEY are required.');
  }

  const startedAt = Date.now();
  const userPrompt = request.responseSchema
    ? `${request.prompt}\n\nCRITICAL MANDATE: Output ONLY valid JSON matching the required schema. Do NOT wrap in markdown fences.`
    : request.prompt;
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: request.combo,
      messages: [
        ...(request.systemInstruction ? [{ role: 'system', content: request.systemInstruction }] : []),
        { role: 'user', content: userPrompt },
      ],
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(request.responseSchema ? { response_format: { type: 'json_object' } } : {}),
      stream: false,
    }),
  });

  const raw = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`9Router returned invalid JSON (${response.status}).`);
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`9Router execution failed (${response.status}): ${message}`);
  }

  const choice = payload?.choices?.[0];
  const text = choice?.message?.content || choice?.text || '';
  if (!text) throw new Error('9Router returned empty text response.');
  console.log(`[9Router] response status=${response.status} contentType=${response.headers.get('content-type') || 'unknown'} model=${payload?.model || 'unknown'} finish=${choice?.finish_reason || 'unknown'} length=${text.length} preview=${text.slice(0, 240)}`);

  return {
    text,
    model: payload.model,
    finishReason: choice?.finish_reason,
    promptTokens: payload.usage?.prompt_tokens,
    completionTokens: payload.usage?.completion_tokens,
    totalTokens: payload.usage?.total_tokens,
    latencyMs: Date.now() - startedAt,
  };
}
