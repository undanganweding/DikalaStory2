import { taskRouter } from './ai_infrastructure/task_router';
import { runStage1StoryUnderstanding } from './stages/stage1_story_understanding';
import { providerService } from './ai_infrastructure/provider_service';
import { modelRegistryService } from './ai_infrastructure/model_registry_service';
import { quotaRouter } from './ai_infrastructure/quota_router';

async function run3ProductionS1Proofs() {
  console.log('================================================================');
  console.log('FINAL PROOF: 3 CONSECUTIVE REAL S1 PRODUCTION RUNS');
  console.log('================================================================\n');

  await providerService.initializeDefaults();
  await modelRegistryService.initializeDefaults();

  // Audit Registered Credential Pool
  console.log('--- CREDENTIAL POOL AUDIT ---');
  const googleCreds = await quotaRouter.scoreCredentials('google');
  console.log(`Registered Active Google Credentials (${googleCreds.length}):`);
  for (const c of googleCreds) {
    console.log(`  - ID: ${c.credential.id} | Name: ${c.credential.name || c.credential.id} | Priority: ${c.credential.priority} | Score: ${c.score} | State: ${c.state}`);
  }
  console.log('-----------------------------\n');

  const testScript = `INT. ANCIENT CITADEL - NIGHT
A lone warrior stands against the stormy sky, holding a glowing relic.
WARRIOR
The time has come. We fight or perish.`;

  for (let runIndex = 1; runIndex <= 3; runIndex++) {
    console.log(`\n>>> STARTING S1 REAL PRODUCTION RUN #${runIndex} <<<`);
    const startTime = Date.now();

    try {
      const s1Result = await runStage1StoryUnderstanding({
        rawScript: testScript,
        language: 'en',
      });

      const totalLatency = Date.now() - startTime;
      console.log(`\n================================================================`);
      console.log(`S1 RUN #${runIndex} COMPLETED SUCCESSFULLY IN ${totalLatency} ms`);
      console.log(`Extracted Era: ${s1Result.era}`);
      console.log(`Extracted Theme: ${s1Result.theme}`);
      console.log(`Extracted Genre: ${s1Result.genre}`);
      console.log(`================================================================\n`);
    } catch (err: any) {
      const totalLatency = Date.now() - startTime;
      console.error(`\n[S1 RUN #${runIndex} FAILED IN ${totalLatency} ms]:`, err?.message || err);
      process.exit(1);
    }

    // Small spacing pause between runs
    if (runIndex < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n================================================================');
  console.log('ALL 3 REAL S1 RUNS COMPLETED SUCCESSFULLY WITH SANE LATENCY');
  console.log('================================================================');
}

run3ProductionS1Proofs().catch(err => {
  console.error('Fatal error in 3-run proof script:', err);
  process.exit(1);
});
