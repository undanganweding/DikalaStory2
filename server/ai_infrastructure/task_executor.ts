import { taskRouter, TaskExecutionPlan, AITaskId, TaskRouterRequest } from './task_router';
import { aiGateway } from './ai_gateway';
import { cleanJsonResponse } from '../llm_provider';
import { ReasoningConfig } from '../../src/types';
import { db } from '../db';
import { resolveProviderAdapter, normalizeLegacyProtocol } from './provider_adapter_registry';
import { createApiGenerationSnapshot, evaluateApiGenerationGate, CONSTRAINT_SET, PRICING_POLICY_VERSION, REGISTRY_VERSION } from './api_generation_gate';

export interface ExecuteTaskOptions {
  taskId: AITaskId | string;
  stageCode?: string;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
  projectPolicy?: {
    mode?: 'auto' | 'custom' | 'pin';
    quality?: 'critical' | 'high' | 'standard' | 'balanced' | 'fast';
    priority?: 'quality' | 'balanced' | 'speed' | 'cost';
    pinnedModelId?: string;
    pinnedProviderId?: string;
  };
  reasoningConfig?: ReasoningConfig | null;
  onProgress?: (message: string) => void;
  entityId?: string;
  projectId?: string;
  timeoutMs?: number;
}

export interface ExecuteTaskResult {
  text: string;
  plan: TaskExecutionPlan;
  latencyMs: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export const taskExecutor = {
  /**
   * Universal Task Execution Endpoint for Cinematic Pipeline
   * Resolves the optimal model & credential via Task Router and executes via AI Gateway
   */
  async executeTask(options: ExecuteTaskOptions): Promise<ExecuteTaskResult> {
    const startTime = Date.now();

    // 1. Build router request options respecting auto routing policy
    const isAutoMode =
      options.projectPolicy?.mode === 'auto' ||
      options.reasoningConfig?.execution_policy?.mode === 'auto' ||
      options.reasoningConfig?.model_id === 'auto';

    const routerRequest: TaskRouterRequest = {
      taskId: options.taskId as AITaskId,
      stageCode: options.stageCode,
      projectPolicy: {
        mode: isAutoMode ? 'auto' : (options.projectPolicy?.mode || 'auto'),
        quality: options.projectPolicy?.quality || options.reasoningConfig?.execution_policy?.quality || 'high',
        priority: options.projectPolicy?.priority || options.reasoningConfig?.execution_policy?.priority || 'quality',
        pinnedModelId: isAutoMode
          ? undefined
          : (options.projectPolicy?.pinnedModelId ||
             (options.reasoningConfig?.model_id !== 'auto' ? options.reasoningConfig?.model_id : undefined)),
        pinnedProviderId: isAutoMode
          ? undefined
          : (options.projectPolicy?.pinnedProviderId || options.reasoningConfig?.provider_type),
      },
    };

    // 2. Resolve authoritative Execution Plan
    const plan = await taskRouter.resolveTaskExecutionPlan(routerRequest);

    // 3. Bind immutable API registry snapshot to router decision.
    const provider = await db.getProvider(plan.providerId);
    const model = await db.getModel(plan.modelId, plan.providerId);
    if (!provider || !model) {
      throw new Error(`REGISTRY_REJECTED: Routed provider/model unavailable: ${plan.providerId}/${plan.modelId}`);
    }
    const adapterProtocol = normalizeLegacyProtocol(provider.protocol || provider.type);
    const snapshot = createApiGenerationSnapshot(provider, model, adapterProtocol);
    const registryRequest = {
      providerId: snapshot.providerId,
      modelId: snapshot.modelId,
      registryVersion: REGISTRY_VERSION,
      capability: 'text',
      modality: 'text',
      durationSeconds: 1,
      constraintSet: CONSTRAINT_SET,
      pricingPolicyVersion: PRICING_POLICY_VERSION,
    };
    const gate = evaluateApiGenerationGate(registryRequest, snapshot, {
      credentialAvailable: Boolean(plan.apiKey),
      providerEnabled: provider.enabled === true,
      adapterAvailable: Boolean(resolveProviderAdapter(provider)),
      requestValid: Boolean(options.prompt && options.prompt.trim()),
    });
    if (gate.status !== 'READY_FOR_EXECUTION') {
      throw new Error(`${gate.status}: ${gate.reason || 'API generation gate rejected request'}`);
    }

    // 4. User feedback / progress notification
    if (options.onProgress) {
      const entityPrefix = options.entityId ? `${options.entityId}: ` : '';
      options.onProgress(
        `${entityPrefix}Task [${plan.taskId}] routed to Model: ${plan.modelId} via Provider: ${plan.providerId} (Score: ${plan.score})`
      );
    }

    console.log(
      `[TaskExecutor] EXECUTING task=${plan.taskId} stage=${options.stageCode || 'N/A'} model=${plan.modelId} provider=${plan.providerId} credential=${plan.credentialId} score=${plan.score}`
    );

    // 4. Dispatch to AI Gateway with authoritative resolved route & sequential fallback plan
    const gatewayResponse = await aiGateway.generate({
      model: plan.modelId,
      providerId: plan.providerId,
      credentialId: plan.credentialId,
      apiKey: plan.apiKey,
      task: plan.taskId,
      agentName: options.stageCode || plan.taskId,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      responseSchema: options.responseSchema,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxOutputTokens,
      projectId: options.projectId,
      timeoutMs: options.timeoutMs,
      plan,
      fallbackPlan: plan.fallbackPlan,
      verifiedExecutionSnapshot: snapshot,
      verifiedRegistryRequest: registryRequest,
    });

    const latencyMs = Date.now() - startTime;
    console.log(`[TaskExecutor] Raw response length: ${gatewayResponse.text?.length || 0}`);
    if (gatewayResponse.text) {
      console.log(`[TaskExecutor] Raw response start: ${gatewayResponse.text.substring(0, 200)}`);
    }
    const cleanedText = cleanJsonResponse(gatewayResponse.text);
    console.log(`[TaskExecutor] Cleaned response length: ${cleanedText?.length || 0}`);

    return {
      text: cleanedText,
      plan,
      latencyMs,
      tokens: gatewayResponse.tokens,
    };
  },
};

export const executeTask = taskExecutor.executeTask;
