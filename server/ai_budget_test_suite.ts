import { GoogleGenAI } from '@google/genai';
import { secretVault } from './security/secret_vault';
import { quotaRouter } from './ai_infrastructure/quota_router';
import { aiGateway, dailyExhaustedRegistry } from './ai_infrastructure/ai_gateway';
import { aiBudgetRegistry, AIBudgetExhaustedError } from './ai_infrastructure/ai_budget_registry';
import { globalAIQueue } from './ai_infrastructure/rate_limiter_queue';

// Set queue interval to 0 for instant tests
(globalAIQueue as any).minIntervalMs = 0;

// Monkey patch GoogleGenAI prototype models.generateContent to control network behaviors in tests.
let mockGenerateContentCallback: (args: any) => Promise<any> = async () => ({ text: 'Mock Default' });

const dummyAI = new GoogleGenAI({ apiKey: 'x' });
const ModelsClass = dummyAI.models.constructor;
Object.defineProperty((ModelsClass as any).prototype, 'generateContentInternal', {
  value: async function(this: any, args: any) {
    return mockGenerateContentCallback(args);
  },
  writable: true,
  configurable: true,
});

// Mock secretVault to decrypt special secrets to run through the actual upstream block
const originalDecrypt = secretVault.decryptSecret;
secretVault.decryptSecret = (secret: string) => {
  if (secret === 'special-test-secret') {
    return 'real-gemini-key-test';
  }
  return originalDecrypt ? originalDecrypt(secret) : 'mock_api_key_test';
};

// Mock quotaRouter to score credentials
const originalScoreCredentials = quotaRouter.scoreCredentials;
quotaRouter.scoreCredentials = async (providerId: string) => {
  return [
    {
      credential: {
        id: 'test_cred_id',
        name: 'Test Credential Name',
        providerId,
        encryptedSecret: 'special-test-secret',
        priority: 1,
      } as any,
      healthStatus: 'HEALTHY' as const,
      successRate: 100,
      avgLatencyMs: 10,
      score: 100,
      state: 'ACTIVE' as const,
    }
  ];
};

async function runTest(name: string, fn: () => Promise<void>) {
  console.log(`\n==================================================`);
  console.log(`[TEST RUN] Starting Test: ${name}`);
  console.log(`==================================================`);
  try {
    await fn();
    console.log(`\n[TEST SUCCESS] Completed Test: ${name}\n`);
  } catch (error: any) {
    console.error(`\n[TEST FAILURE] Test ${name} failed:`, error);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting Cinematic AI Call Budget Guard Test Suite...');

  // =========================================================================
  // Test A: S1–S5 Happy Path (Budget Tracking)
  // =========================================================================
  await runTest('Test A: S1–S5 Happy Path (Budget Tracking)', async () => {
    const projectId = 'project-A';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    // Mock 5 successful stages calls
    mockGenerateContentCallback = async (args: any) => {
      return { text: `Success on ${args.model}` };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      for (let i = 1; i <= 5; i++) {
        const res = await aiGateway.generate({
          prompt: `Mock call stage ${i}`,
          task: 'story_analysis',
        });
        console.log(`Call ${i} outcome:`, res.text);
      }
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 5)`);
    if (budget?.callsUsed !== 5) {
      throw new Error(`Expected exactly 5 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test B: S1–S5 Happy Path + S5 1x Retry
  // =========================================================================
  await runTest('Test B: S1–S5 Happy Path + S5 1x Retry', async () => {
    const projectId = 'project-B';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Successful S5 JSON Response' };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      // S1-S4 successful dispatches
      for (let i = 1; i <= 4; i++) {
        await aiGateway.generate({ prompt: `Call ${i}`, task: 'story_analysis' });
      }

      // S5 attempt 1 (simulated duration/structural failure inside Orchestrator, but successful API call)
      await aiGateway.generate({ prompt: `S5 attempt 1`, task: 'scene_breakdown' });

      // S5 attempt 2 (orchestrator retry, successful API call)
      const res = await aiGateway.generate({ prompt: `S5 attempt 2`, task: 'scene_breakdown' });
      console.log('S5 attempt 2 result:', res.text);
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 6)`);
    if (budget?.callsUsed !== 6) {
      throw new Error(`Expected exactly 6 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test C: S1–S5 Happy Path + S5 2x Retry
  // =========================================================================
  await runTest('Test C: S1–S5 Happy Path + S5 2x Retry', async () => {
    const projectId = 'project-C';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Successful S5 JSON Response' };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      // S1-S4
      for (let i = 1; i <= 4; i++) {
        await aiGateway.generate({ prompt: `Call ${i}`, task: 'story_analysis' });
      }

      // S5 attempt 1 (validation failed)
      await aiGateway.generate({ prompt: `S5 attempt 1`, task: 'scene_breakdown' });

      // S5 attempt 2 (validation failed)
      await aiGateway.generate({ prompt: `S5 attempt 2`, task: 'scene_breakdown' });

      // S5 attempt 3 (succeeds)
      const res = await aiGateway.generate({ prompt: `S5 attempt 3`, task: 'scene_breakdown' });
      console.log('S5 attempt 3 result:', res.text);
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 7)`);
    if (budget?.callsUsed !== 7) {
      throw new Error(`Expected exactly 7 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test D: S5 Abort after 3x Retry failure
  // =========================================================================
  await runTest('Test D: S5 Abort after 3x Retry failure', async () => {
    const projectId = 'project-D';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Successful response' };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      // S1-S4
      for (let i = 1; i <= 4; i++) {
        await aiGateway.generate({ prompt: `Call ${i}`, task: 'story_analysis' });
      }

      // S5 attempts 1, 2, 3 all fail validation (3 physical calls to gateway)
      for (let attempt = 1; attempt <= 3; attempt++) {
        await aiGateway.generate({ prompt: `S5 attempt ${attempt}`, task: 'scene_breakdown' });
      }
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 7)`);
    if (budget?.callsUsed !== 7) {
      throw new Error(`Expected exactly 7 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test E: Budget Exhausted during S2 Character Detection
  // =========================================================================
  await runTest('Test E: Budget Exhausted during S2 Character Detection', async () => {
    const projectId = 'project-E';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Successful dispatch' };
    };

    let caughtError: any = null;

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      try {
        // Run 16 sequential dispatches (limit is 15)
        for (let i = 1; i <= 16; i++) {
          await aiGateway.generate({ prompt: `Call ${i}`, task: 'character_analysis' });
        }
      } catch (err: any) {
        caughtError = err;
      }
    });

    console.log('Caught error name:', caughtError?.name);
    console.log('Caught error message:', caughtError?.message);

    if (!caughtError) {
      throw new Error('Expected budget exhausted error but none was thrown');
    }
    if (!(caughtError instanceof AIBudgetExhaustedError) && caughtError.name !== 'AIBudgetExhaustedError') {
      throw new Error(`Expected AIBudgetExhaustedError, got: ${caughtError}`);
    }
    if (!caughtError.message.includes('AI Provider Call Budget Exhausted (15 requests maximum for this initialization run).')) {
      throw new Error(`Unexpected error message: ${caughtError.message}`);
    }

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 15)`);
    if (budget?.callsUsed !== 15) {
      throw new Error(`Expected exactly 15 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test F: Budget Exhausted inside S5 loop (attempt 3)
  // =========================================================================
  await runTest('Test F: Budget Exhausted inside S5 loop (attempt 3)', async () => {
    const projectId = 'project-F';
    // Initialize a tighter limit for this test scenario to guarantee exhaustion in S5 retry 3
    aiBudgetRegistry.initializeBudget(projectId, 6);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Successful dispatch' };
    };

    let caughtError: any = null;

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      try {
        // S1-S4 succeed (4 calls used)
        for (let i = 1; i <= 4; i++) {
          await aiGateway.generate({ prompt: `Call ${i}`, task: 'story_analysis' });
        }

        // S5 attempt 1 (5 calls used)
        await aiGateway.generate({ prompt: `S5 attempt 1`, task: 'scene_breakdown' });

        // S5 attempt 2 (6 calls used)
        await aiGateway.generate({ prompt: `S5 attempt 2`, task: 'scene_breakdown' });

        // S5 attempt 3 (should throw AIBudgetExhaustedError before dispatching call 7)
        await aiGateway.generate({ prompt: `S5 attempt 3`, task: 'scene_breakdown' });
      } catch (err: any) {
        caughtError = err;
      }
    });

    console.log('Caught error inside S5 retry loop:', caughtError?.message);
    if (!caughtError || caughtError.name !== 'AIBudgetExhaustedError') {
      throw new Error('Expected AIBudgetExhaustedError during S5 attempt 3');
    }

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 6)`);
    if (budget?.callsUsed !== 6) {
      throw new Error(`Expected exactly 6 calls used, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test G: Resume run starts with fresh budget
  // =========================================================================
  await runTest('Test G: Resume run starts with fresh budget', async () => {
    const projectId = 'project-G';

    // Simulate an earlier pipeline run that consumed 3 calls and then was cleaned up
    aiBudgetRegistry.initializeBudget(projectId, 15);
    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      await aiGateway.generate({ prompt: 'Old call 1', task: 'story_analysis' });
      await aiGateway.generate({ prompt: 'Old call 2', task: 'story_analysis' });
      await aiGateway.generate({ prompt: 'Old call 3', task: 'story_analysis' });
    });

    const firstRunBudget = aiBudgetRegistry.getBudget(projectId);
    if (firstRunBudget?.callsUsed !== 3) {
      throw new Error(`Expected 3 calls used in first run, got ${firstRunBudget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);

    // Simulate a resumed run
    aiBudgetRegistry.initializeBudget(projectId, 15);
    const resumedBudget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] Resumed run callsUsed=${resumedBudget?.callsUsed} (Expected: 0)`);
    if (resumedBudget?.callsUsed !== 0) {
      throw new Error(`Expected resumed budget to start at 0, got ${resumedBudget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test H: Dual concurrent projects do not interfere
  // =========================================================================
  await runTest('Test H: Dual concurrent projects do not interfere', async () => {
    const projA = 'project-H-A';
    const projB = 'project-H-B';

    aiBudgetRegistry.initializeBudget(projA, 15);
    aiBudgetRegistry.initializeBudget(projB, 15);

    mockGenerateContentCallback = async (args: any) => {
      return { text: 'Success' };
    };

    const taskA = aiBudgetRegistry.runWithProjectId(projA, async () => {
      for (let i = 0; i < 4; i++) {
        await aiGateway.generate({ prompt: `ProjA ${i}`, task: 'story_analysis' });
        // Yield execution to allow concurrency
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    });

    const taskB = aiBudgetRegistry.runWithProjectId(projB, async () => {
      for (let i = 0; i < 7; i++) {
        await aiGateway.generate({ prompt: `ProjB ${i}`, task: 'story_analysis' });
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    });

    await Promise.all([taskA, taskB]);

    const budgetA = aiBudgetRegistry.getBudget(projA);
    const budgetB = aiBudgetRegistry.getBudget(projB);

    console.log(`[Verification] ProjA used=${budgetA?.callsUsed} (Expected: 4), ProjB used=${budgetB?.callsUsed} (Expected: 7)`);
    if (budgetA?.callsUsed !== 4 || budgetB?.callsUsed !== 7) {
      throw new Error('Concurrent budgets interfered with each other!');
    }

    aiBudgetRegistry.cleanupBudget(projA);
    aiBudgetRegistry.cleanupBudget(projB);
  });

  // =========================================================================
  // Test I: Model fallback / Credential rotations consume budget units properly
  // =========================================================================
  await runTest('Test I: Model fallback / Credential rotations consume budget units properly', async () => {
    const projectId = 'project-I';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    let callCount = 0;
    mockGenerateContentCallback = async (args: any) => {
      callCount++;
      if (callCount === 1) {
        // Trigger a failure on primary model candidate to cause fallback attempt
        throw new Error('503 Service Unavailable on primary model');
      }
      return { text: `Success on fallback model: ${args.model}` };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      const res = await aiGateway.generate({
        prompt: 'Trigger model fallback',
        task: 'story_analysis',
      });
      console.log('Outcome:', res.text);
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 2)`);
    if (budget?.callsUsed !== 2) {
      throw new Error(`Expected exactly 2 budget units consumed due to fallback, got ${budget?.callsUsed}`);
    }
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  // =========================================================================
  // Test J: Daily quota skips consume 0 budget units
  // =========================================================================
  await runTest('Test J: Daily quota skips consume 0 budget units', async () => {
    const projectId = 'project-J';
    aiBudgetRegistry.initializeBudget(projectId, 15);

    // Seed the daily exhausted registry for the first candidate model
    const cacheKey = 'Test Credential Name:gemini-3.7-flash';
    dailyExhaustedRegistry.set(cacheKey, Date.now() + 3600000);

    mockGenerateContentCallback = async (args: any) => {
      return { text: `Resolved model is ${args.model}` };
    };

    await aiBudgetRegistry.runWithProjectId(projectId, async () => {
      const res = await aiGateway.generate({
        prompt: 'Quota skip test',
        task: 'story_analysis',
      });
      console.log('Outcome:', res.text);
    });

    const budget = aiBudgetRegistry.getBudget(projectId);
    // The primary model 'gemini-3.7-flash' should be skipped, so fallback model 'gemini-3.6-flash' is called.
    // This should result in exactly 1 budget unit.
    console.log(`[Verification] budgetUsed=${budget?.callsUsed} (Expected: 1)`);
    if (budget?.callsUsed !== 1) {
      throw new Error(`Expected 1 call because first candidate was skipped, got ${budget?.callsUsed}`);
    }

    dailyExhaustedRegistry.delete(cacheKey);
    aiBudgetRegistry.cleanupBudget(projectId);
  });

  console.log('\n==================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY! No errors detected.');
  console.log('==================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
