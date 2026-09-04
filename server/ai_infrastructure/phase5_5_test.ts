import { AGENT_CONTRACTS } from './agent_contract';
import { agentOrchestrationGraph } from './agent_orchestration_graph';
import { credentialService } from './credential_service';

async function runPhase5_5Tests() {
  console.log('Running Phase 5.4 & 5.5 Agent Contracts & Orchestration Graph Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-phase55-12345';
  }

  // Setup test credential
  const cred = await credentialService.addCredential({
    providerId: 'google',
    name: 'Phase 5.5 Test Key',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyPhase55TestApiKey1234567890',
  });

  // Verify contract definitions
  const researchContract = AGENT_CONTRACTS['research_agent'];
  if (!researchContract || researchContract.inputSchema.requiredFields[0] !== 'story') {
    throw new Error('Test Failed: Research Agent contract validation failed');
  }
  console.log('✅ Agent Contract validation passed for research_agent');

  // Test Orchestration Pipeline definition
  const pipelineResult = await agentOrchestrationGraph.executePipeline(
    'Cinematic Production Pipeline',
    [
      { agentId: 'research_agent' },
      { agentId: 'story_analyzer' },
      { agentId: 'film_director' },
      { agentId: 'prompt_engineer' },
    ],
    { story: 'The Journey to Freedom', scriptText: 'Act 1 opening scene in the desert.', scene: 'Desert sunrise', character: 'Traveler', location: 'Sahara' }
  );

  console.log('Orchestration Pipeline Result Status:', pipelineResult.status);
  console.log('Execution Log length:', pipelineResult.executionLog.length);

  if (!pipelineResult.pipelineId || !pipelineResult.outputs) {
    throw new Error('Test Failed: Pipeline execution output structure invalid');
  }

  console.log('✅ Agent Orchestration Graph pipeline executed successfully.');

  // Cleanup
  await credentialService.removeCredential(cred.id);

  console.log('🎉 Phase 5.4 & 5.5 Agent Contracts & Orchestration Graph tests passed successfully!');
}

runPhase5_5Tests().catch(err => {
  console.error('❌ Phase 5.5 Test Error:', err);
  process.exit(1);
});
