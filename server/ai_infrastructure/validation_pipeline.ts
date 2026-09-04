import { evaluationEngine, EvaluationResult } from './evaluation_engine';
import { agentScorecardManager } from './agent_scorecard';
import { projectMemoryManager } from './agent_memory';
import { agentRuntime, AgentRunRequest } from './agent_runtime';

export interface ValidationPipelineResult {
  status: 'PASS' | 'WARNING' | 'REJECT';
  output: any;
  evaluation: EvaluationResult;
  retries: number;
  storedInMemory: boolean;
}

export const validationPipeline = {
  async processAndValidate(
    runRequest: AgentRunRequest,
    initialOutput: any,
    context?: any
  ): Promise<ValidationPipelineResult> {
    let currentOutput = initialOutput;
    let retries = 0;
    const maxRetries = 3;
    let evaluation: EvaluationResult;

    while (retries <= maxRetries) {
      evaluation = await evaluationEngine.evaluateAgentOutput(
        runRequest.agentId,
        runRequest.projectId || 'default_project',
        currentOutput,
        context
      );

      // Record scorecard
      await agentScorecardManager.recordEvaluation(
        runRequest.agentId,
        evaluation.score,
        evaluation.confidence,
        evaluation.status,
        evaluation.issues
      );

      if (evaluation.status !== 'REJECT' || retries >= maxRetries) {
        break;
      }

      // Revision loop: Retry agent with feedback
      retries++;
      const feedbackPrompt = `${runRequest.prompt}\n\n[Correction Feedback - Attempt ${retries}]:\nPrevious output failed quality validation due to:\n${evaluation.issues.join('\n')}\nPlease revise and correct these issues.`;
      
      try {
        const retryRes = await agentRuntime.executeAgent({
          ...runRequest,
          prompt: feedbackPrompt,
        });
        currentOutput = retryRes.text;
      } catch (err: any) {
        break;
      }
    }

    // Memory Integration Rules
    let storedInMemory = false;
    const projectId = runRequest.projectId;

    if (projectId) {
      if (evaluation!.status === 'PASS') {
        await projectMemoryManager.appendMemoryEntry(projectId, {
          id: `mem_${runRequest.agentId}_${Date.now()}`,
          type: 'DECISION_MEMORY',
          content: {
            agentId: runRequest.agentId,
            output: currentOutput,
            evaluationScore: evaluation!.score,
          },
          sourceAgent: runRequest.agentId,
          confidence: evaluation!.confidence,
        });
        storedInMemory = true;
      } else if (evaluation!.status === 'WARNING') {
        await projectMemoryManager.appendMemoryEntry(projectId, {
          id: `mem_warn_${runRequest.agentId}_${Date.now()}`,
          type: 'DECISION_MEMORY',
          content: {
            agentId: runRequest.agentId,
            output: currentOutput,
            evaluationScore: evaluation!.score,
            warnings: evaluation!.issues,
          },
          sourceAgent: runRequest.agentId,
          confidence: evaluation!.confidence,
        });
        storedInMemory = true;
      } else {
        // REJECT -> Do not store
        storedInMemory = false;
      }
    }

    return {
      status: evaluation!.status,
      output: currentOutput,
      evaluation: evaluation!,
      retries,
      storedInMemory,
    };
  },
};
