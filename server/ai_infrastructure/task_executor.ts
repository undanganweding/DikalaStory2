import { taskRouter, TaskExecutionPlan, AITaskId, TaskRouterRequest } from './task_router';
import { aiGateway } from './ai_gateway';
import { cleanJsonResponse } from '../llm_provider';
import { ReasoningConfig } from '../../src/types';

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

    // 3. User feedback / progress notification
    if (options.onProgress) {
      const entityPrefix = options.entityId ? `${options.entityId}: ` : '';
      options.onProgress(
        `${entityPrefix}Task [${plan.taskId}] routed to Model: ${plan.modelId} via Provider: ${plan.providerId} (Score: ${plan.score})`
      );
    }

    console.log(
      `[TaskExecutor] EXECUTING task=${plan.taskId} stage=${options.stageCode || 'N/A'} model=${plan.modelId} provider=${plan.providerId} credential=${plan.credentialId} score=${plan.score}`
    );

    // 4. Dispatch to AI Gateway
    const gatewayResponse = await aiGateway.generate({
      model: plan.modelId,
      providerId: plan.providerId,
      task: plan.taskId,
      agentName: options.stageCode || plan.taskId,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      responseSchema: options.responseSchema,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxOutputTokens,
    });

    const latencyMs = Date.now() - startTime;
    const cleanedText = cleanJsonResponse(gatewayResponse.text);

    return {
      text: cleanedText,
      plan,
      latencyMs,
      tokens: gatewayResponse.tokens,
    };
  },
};

export const executeTask = taskExecutor.executeTask;
