import { evaluationEngine } from './evaluation_engine';
import { agentScorecardManager } from './agent_scorecard';
import { validationPipeline } from './validation_pipeline';
import { projectMemoryManager } from './agent_memory';
import { credentialService } from './credential_service';

async function runPhase5_7QualityTests() {
  console.log('Running Phase 5.7 Agent Evaluation & Quality Control Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-phase57-12345';
  }

  const projectId = 'proj_quality_test_01';
  await projectMemoryManager.createProjectMemory(projectId);

  // 1. Valid research output returns PASS
  const validOutput = {
    sources: ['Sahih Al-Bukhari'],
    claims: ['Prophet Muhammad was born in Year of the Elephant'],
    confidence: 0.98,
    historical_notes: 'Verified historical context.',
  };
  const evalValid = await evaluationEngine.evaluateAgentOutput('research_agent', projectId, validOutput);
  console.log('Test 1 Evaluation Result:', evalValid);
  if (evalValid.status !== 'PASS') {
    throw new Error(`Test 1 Failed: Expected PASS, got ${evalValid.status}`);
  }
  console.log('✅ 1. Valid research output returns PASS passed');

  // 2. Missing required field / invalid format returns REJECT
  const invalidOutput = null;
  const evalInvalid = await evaluationEngine.evaluateAgentOutput('story_analyzer', projectId, invalidOutput);
  console.log('Test 2 Evaluation Result:', evalInvalid);
  if (evalInvalid.status !== 'REJECT') {
    throw new Error(`Test 2 Failed: Expected REJECT, got ${evalInvalid.status}`);
  }
  console.log('✅ 2. Missing required field returns REJECT passed');

  // 3. Historical claim without source returns WARNING/REJECT
  const claimWithoutSource = {
    claims: ['Unverified historical claim'],
    sources: [],
    confidence: 0.85,
  };
  const evalClaim = await evaluationEngine.evaluateAgentOutput('research_agent', projectId, claimWithoutSource);
  console.log('Test 3 Evaluation Result:', evalClaim);
  if (evalClaim.status === 'PASS') {
    throw new Error('Test 3 Failed: Expected WARNING or REJECT for historical claim without source');
  }
  console.log('✅ 3. Historical claim without source warning/reject passed');

  // 4. Character continuity conflict detected
  const characterOutput = {
    age: 25,
    name: 'Amina',
    confidence: 0.9,
  };
  const evalContinuity = await evaluationEngine.evaluateAgentOutput('film_director', projectId, characterOutput, { existingAge: 50 });
  console.log('Test 4 Evaluation Result:', evalContinuity);
  if (evalContinuity.issues.length === 0) {
    throw new Error('Test 4 Failed: Character continuity conflict not detected');
  }
  console.log('✅ 4. Character continuity conflict detected passed');

  // 5. Visual rule violation detected (modern elements in historical prompt)
  const visualViolation = {
    image_prompt: 'Ancient desert landscape with a modern smartphone and skyscraper.',
    confidence: 0.9,
  };
  const evalVisual = await evaluationEngine.evaluateAgentOutput('prompt_engineer', projectId, visualViolation);
  console.log('Test 5 Evaluation Result:', evalVisual);
  if (evalVisual.status !== 'REJECT') {
    throw new Error('Test 5 Failed: Visual rule violation did not result in REJECT');
  }
  console.log('✅ 5. Visual rule violation detected passed');

  // 6. Agent scorecard updates correctly
  await agentScorecardManager.recordEvaluation('research_agent', 95, 0.98, 'PASS', []);
  const scorecard = await agentScorecardManager.getAgentScorecard('research_agent');
  console.log('Agent Scorecard:', scorecard);
  if (scorecard.totalRuns === 0 || scorecard.averageScore < 90) {
    throw new Error('Test 6 Failed: Agent scorecard did not update correctly');
  }
  console.log('✅ 6. Agent scorecard updates correctly passed');

  // Setup test credential for gateway test in validation pipeline
  const cred = await credentialService.addCredential({
    providerId: 'google',
    name: 'Quality Test Key',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyQualityTestApiKey1234567890',
  });

  // 7 & 8. Validation pipeline & memory blocks rejected output
  const pipelineResult = await validationPipeline.processAndValidate(
    {
      agentId: 'prompt_engineer',
      task: 'prompt_gen',
      prompt: 'Create image prompt with smartphone.',
      projectId,
    },
    JSON.stringify(visualViolation)
  );

  console.log('Validation Pipeline Result:', pipelineResult.status, 'Stored in memory:', pipelineResult.storedInMemory);
  if (pipelineResult.storedInMemory) {
    throw new Error('Test 8 Failed: Memory stored rejected output!');
  }
  console.log('✅ 7 & 8. Validation pipeline revision loop and memory blocking passed');

  // Cleanup
  await credentialService.removeCredential(cred.id);

  console.log('🎉 All Phase 5.7 Agent Evaluation & Quality Control tests passed successfully!');
}

runPhase5_7QualityTests().catch(err => {
  console.error('❌ Phase 5.7 Test Error:', err);
  process.exit(1);
});
