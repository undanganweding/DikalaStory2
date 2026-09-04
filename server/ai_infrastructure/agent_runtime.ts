import { AI_AGENT_REGISTRY, AgentDefinition } from './agent_registry';
import { aiGateway, AIGatewayResponse } from './ai_gateway';
import { contextManager } from './context_manager';
import { validationPipeline } from './validation_pipeline';

export interface AgentRunRequest {
  agentId: string;
  task: string;
  prompt: string;
  systemInstruction?: string;
  modelOverride?: string;
  temperature?: number;
  projectId?: string;
}

export const agentRuntime = {
  getAgent(agentId: string): AgentDefinition {
    const agent = AI_AGENT_REGISTRY[agentId];
    if (!agent) {
      throw new Error(`AgentRuntime: Agent ID '${agentId}' not found in registry.`);
    }
    return agent;
  },

  async executeAgent(req: AgentRunRequest): Promise<AIGatewayResponse & { validationStatus?: string }> {
    const agent = this.getAgent(req.agentId);

    // Enforce allowed models or default to agent's primary allowed model
    let model = req.modelOverride || agent.allowedModels[0];
    if (!agent.allowedModels.includes(model)) {
      model = agent.allowedModels[0];
    }

    // Load project context if projectId is provided
    let enrichedSystemInstruction = req.systemInstruction || '';
    if (req.projectId) {
      const contextData = await contextManager.buildAgentContext(req.agentId, req.projectId, req.task);
      const memorySnippet = JSON.stringify(contextData.memoryContext, null, 2);
      enrichedSystemInstruction = `${enrichedSystemInstruction}\n\n[Project Shared Memory Context]:\n${memorySnippet}`;
    }

    // Route through AI Gateway
    const response = await aiGateway.generate({
      agentName: agent.name,
      task: req.task,
      model,
      prompt: req.prompt,
      systemInstruction: enrichedSystemInstruction.trim() || undefined,
      maxTokens: agent.maxTokensPerRequest,
      temperature: req.temperature ?? 0.7,
    });

    // Run Validation Pipeline & Memory Update stage
    const validationResult = await validationPipeline.processAndValidate(req, response.text);

    return {
      ...response,
      text: validationResult.output,
      validationStatus: validationResult.status,
    };
  },
};
