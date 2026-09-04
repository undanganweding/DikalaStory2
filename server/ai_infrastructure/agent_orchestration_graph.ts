import { agentRuntime } from './agent_runtime';
import { AGENT_CONTRACTS } from './agent_contract';

export interface GraphNode {
  agentId: string;
  dependsOn?: string[];
  inputTransformer?: (previousOutputs: Record<string, any>) => any;
}

export interface OrchestrationPipelineResult {
  pipelineId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  outputs: Record<string, any>;
  executionLog: { agentId: string; latencyMs: number; success: boolean; error?: string }[];
}

export const agentOrchestrationGraph = {
  async executePipeline(
    pipelineName: string,
    nodes: GraphNode[],
    initialInput: Record<string, any>
  ): Promise<OrchestrationPipelineResult> {
    const pipelineId = `pipe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputs: Record<string, any> = { input: initialInput };
    const executionLog: { agentId: string; latencyMs: number; success: boolean; error?: string }[] = [];

    for (const node of nodes) {
      const contract = AGENT_CONTRACTS[node.agentId];
      if (!contract) {
        throw new Error(`Orchestration Graph: Agent contract not found for ID '${node.agentId}'`);
      }

      // Prepare input based on dependencies
      let agentInput = { ...initialInput };
      if (node.inputTransformer) {
        agentInput = node.inputTransformer(outputs);
      }

      // Validate required input fields
      for (const field of contract.inputSchema.requiredFields) {
        if (agentInput[field] === undefined && initialInput[field] === undefined) {
          agentInput[field] = JSON.stringify(initialInput);
        }
      }

      const prompt = typeof agentInput === 'string' ? agentInput : JSON.stringify(agentInput);
      const startTime = Date.now();

      try {
        const res = await agentRuntime.executeAgent({
          agentId: node.agentId,
          task: `orchestrated_${node.agentId}`,
          prompt,
        });

        const latencyMs = Date.now() - startTime;
        outputs[node.agentId] = {
          text: res.text,
          tokens: res.tokens,
        };

        executionLog.push({
          agentId: node.agentId,
          latencyMs,
          success: true,
        });
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        executionLog.push({
          agentId: node.agentId,
          latencyMs,
          success: false,
          error: err.message,
        });

        if (contract.failureStrategy === 'FAIL_FAST') {
          return {
            pipelineId,
            status: 'FAILED',
            outputs,
            executionLog,
          };
        }

        outputs[node.agentId] = {
          error: err.message,
          fallbackUsed: true,
        };
      }
    }

    const hasFailures = executionLog.some(l => !l.success);
    return {
      pipelineId,
      status: hasFailures ? 'PARTIAL' : 'SUCCESS',
      outputs,
      executionLog,
    };
  },
};
