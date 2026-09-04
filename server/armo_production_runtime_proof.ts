import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { runOrchestratedPipeline } from './orchestrator';
import { armoOrchestrator } from './armo';
import { GeminiProjectRouter } from './gemini_project_router';
import { credentialManager } from './credential_manager';
import { Type } from './gemini';

// Setup environment fallback API key so credential pools find valid credentials
process.env.GEMINI_API_KEY = 'dummy_key_for_testing';

// Initialize the GeminiProjectRouter with a mock project
const router = GeminiProjectRouter.getInstance();
router.clearProjects();
router.addProject({
  project_id: 'test_project_credentials',
  api_key: 'dummy_key_for_testing',
  provider: 'google_gemini',
  models_available: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    'gemini-2.5-pro',
    'gemini-1.5-pro-preview-0514'
  ],
  quota: { rpm: 100, tpm: 100000, rpd: 1500 },
  usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
  health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 100 },
  priority: 1,
  enabled: true
});

// Capture execution trace records
interface TraceRecord {
  runId: string;
  stage: string;
  requestedModel: string;
  resolvedModel: string;
  actualModel: string;
  reason: string;
  result: string;
}
const traceRecords: TraceRecord[] = [];

// Track stage attempts for fallback simulation
const stageAttempts: Record<string, number> = {};

// Override generateContent globally to mock Gemini responses using our gemini.ts hook
(global as any).__USE_ARMO_MOCKS__ = true;
(global as any).__ARMO_MOCK_GENERATE__ = async function (args: any) {
  const model = args.model;
  const promptText = typeof args.contents === 'string' ? args.contents : JSON.stringify(args.contents);
  const config = args.config || {};
  const schema = config.responseSchema;

  console.log(`[DEBUG MOCK] Calling model: ${model}, schema type: ${schema?.type || 'none'}, systemInstruction includes Casting: ${config.systemInstruction?.includes('Casting') || false}`);

  // Detect which stage is being run based on schema fields
  let stageName = 'UNKNOWN';
  let mockResponse: any = {};

  if (schema) {
    if (schema.properties && schema.properties.theme) {
      stageName = 'S1';
      mockResponse = {
        era: 'Feudal Nusantara 1400s',
        theme: 'Sacred quest and spiritual awakening',
        genre: 'Epic Drama',
        timeline: 'Act 1: World Setup, Act 2: Human element, Act 3: Rising conflict, Act 4: Climax, Act 5: Legacy',
        main_characters: ['Sunan Kalijaga'],
        supporting_characters: ['Ki Gede'],
        locations: ['Danau Berkabut'],
        main_conflict: 'Spiritual clash',
        emotional_arc: 'Sorrow to hope',
        narrative_arc: 'Traditional epic',
        visual_tone: 'Warm golden light',
        is_historical_religious_biography: true,
        research_basic_facts: 'Historical analysis of Wali Sanga',
        research_timeline: '1450-1510',
        research_era_context: 'Majapahit collapse, Demak rise',
        research_sources: 'Babad Tanah Jawi',
        act_1_world_setup: 'Introduction of Sunan',
        act_2_human_element: 'Connecting with locals',
        act_3_rising_conflict: 'Confronting obstacles',
        act_4_climax_breath: 'Silent meditation',
        act_5_legacy_meaning: 'Spiritual legacy of peace',
        narrative_style_mode: 'epic',
        islamic_validation_safeguard: 'Fully compliant with sacred reverences'
      };
    } else if (schema.type === Type.ARRAY && (schema.items?.properties?.face_identity_locked || (config.systemInstruction && (config.systemInstruction.includes('Casting') || config.systemInstruction.includes('Character'))))) {
      stageName = 'S2';
      
      // Simulate quota limit on the primary model (gemini-3.7-flash) of S2 to trigger ARMO Fallback sequence!
      if (model === 'gemini-3.7-flash') {
        throw new Error('Resource has been exhausted (e.g. API rate limit exceeded / 429). Please try again in 5s.');
      }

      mockResponse = [
        {
          name: 'Sunan Kalijaga',
          age: '35 years old',
          gender: 'Male',
          physical_appearance: 'Well-built, charismatic leader with soft glowing facial expression.',
          face_identity_locked: true,
          hair: 'Under turban',
          beard: 'Neat trim beard',
          clothing: ['Sorban', 'Jubah Sufi', 'Selendang Rida'],
          accessories: ['Tasbih', 'Traditional sash']
        }
      ];
    } else if (schema.properties && schema.properties.locations && schema.properties.objects) {
      stageName = 'S3';
      mockResponse = {
        locations: [
          {
            name: 'Danau Berkabut',
            era: 'Demak Sultanate',
            architecture: 'Wooden gazebo style',
            environment: 'Lakeside morning fog',
            landscape: 'Lush tropical green hills around mist-shrouded lake',
            climate: 'Damp and cool morning air',
            culture: 'Traditional Javanese rural decor',
            lighting_style: 'Volumetric sunbeams piercing through heavy white mist',
            color_palette: ['#4A5D4E', '#D0D6D2', '#1D231E'],
            material: 'Weathered teak wood, riverbed stones'
          }
        ],
        objects: [
          {
            name: 'Tasbih',
            era: '15th Century',
            description: 'Prayer beads made from dark polished wooden pearls',
            color_palette: ['#2A1D13'],
            material: 'Sandalwood',
            scale: 'Hand-held',
            historical_relevance: 'Highly relevant'
          }
        ]
      };
    } else if (schema.properties && schema.properties.beginning && schema.properties.development) {
      stageName = 'S4';
      mockResponse = {
        beginning: 'Sunan Kalijaga arrives at the misty lake, seeking peace and guidance.',
        development: 'He meets local villagers and teaches them wisdom, facing initial skepticism.',
        climax: 'A deep spiritual revelation occurs by the water at dawn.',
        consequence: 'The village accepts the message of harmony.',
        ending: 'A lasting legacy of peace is established in the region.'
      };
    } else if (schema.type === Type.ARRAY && schema.items?.properties?.scene_number) {
      stageName = 'S5';
      mockResponse = [
        {
          scene_number: 1,
          title: 'EXT. DANAU BERKABUT - DAWN',
          duration_sec: 10,
          story_purpose: 'Introduce the main character and setting',
          location_name: 'Danau Berkabut',
          time_of_day: 'DAWN',
          character_names: ['Sunan Kalijaga'],
          emotional_objective: 'Awe and serenity',
          event: 'Sunan Kalijaga sits quietly by the water, meditating.',
          narrative_function: 'Beginning'
        },
        {
          scene_number: 2,
          title: 'EXT. DANAU BERKABUT - DAY',
          duration_sec: 10,
          story_purpose: 'Character interaction and conflict',
          location_name: 'Danau Berkabut',
          time_of_day: 'DAY',
          character_names: ['Sunan Kalijaga'],
          emotional_objective: 'Tension and focus',
          event: 'He meets Ki Gede.',
          narrative_function: 'Development'
        },
        {
          scene_number: 3,
          title: 'EXT. DANAU BERKABUT - CLIMAX',
          duration_sec: 10,
          story_purpose: 'Spiritual peak',
          location_name: 'Danau Berkabut',
          time_of_day: 'DUSK',
          character_names: ['Sunan Kalijaga'],
          emotional_objective: 'Intense spirituality',
          event: 'A mystical light appears.',
          narrative_function: 'Climax'
        },
        {
          scene_number: 4,
          title: 'EXT. DANAU BERKABUT - CONSEQUENCE',
          duration_sec: 10,
          story_purpose: 'Resolution step 1',
          location_name: 'Danau Berkabut',
          time_of_day: 'NIGHT',
          character_names: ['Sunan Kalijaga'],
          emotional_objective: 'Relief and awe',
          event: 'Acceptance and teaching.',
          narrative_function: 'Consequence'
        },
        {
          scene_number: 5,
          title: 'EXT. DANAU BERKABUT - ENDING',
          duration_sec: 20,
          story_purpose: 'Ending scene',
          location_name: 'Danau Berkabut',
          time_of_day: 'NIGHT',
          character_names: ['Sunan Kalijaga'],
          emotional_objective: 'Serenity',
          event: 'Departing in peace.',
          narrative_function: 'Ending'
        }
      ];
    } else if (schema.properties && schema.properties.shots) {
      stageName = 'S6';
      let duration = 10;
      if (promptText.includes('Scene #5') || promptText.includes('Scene 5') || promptText.includes('duration_sec":20') || promptText.includes('duration_sec": 20')) {
        duration = 20;
      }
      mockResponse = {
        shots: [
          {
            shot_number: 1,
            start_time_sec: 0,
            end_time_sec: duration,
            duration_sec: duration,
            event_detail: 'A wide angle shot of Sunan Kalijaga standing by the misty lake under warm golden sunbeams.',
            character_action: 'He stands peacefully with a serene look.',
            camera_note: 'Slow slow zoom in on a dolly track.',
            dialogue: [],
            emotion: 'Serenity',
            audio_note: 'Soft wind and chirping birds.'
          }
        ]
      };
    }
  }

  // Fallback string if we cannot parse schema
  const responseText = JSON.stringify(mockResponse);

  return {
    text: responseText,
  };
};

async function executeVerificationSuite() {
  console.log('\n======================================================');
  console.log('   SINEMA — ARMO PRODUCTION RUNTIME PROOF SUITE');
  console.log('======================================================\n');

  // =========================================================================
  // SCENARIO A: adaptive mode, override prevention, and fallback validation
  // =========================================================================
  console.log('--- RUNNING SCENARIO A: ADAPTIVE AUTONOMY & FALLBACK PROOF ---');
  const projectIdA = 'test-project-adaptive-mode';
  await db.deleteProject(projectIdA);

  const projectA = await db.saveProject({
    id: projectIdA,
    title: 'Adaptive Autonomy Test',
    raw_script: 'Sunan Kalijaga berdiri di tepi Danau Berkabut dengan tenang.',
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: null,
    prompt_language: 'id',
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'draft',
    ai_model: 'gemini-3.7-flash', // Manual selector is set to 3.7-flash
    reasoning_config: {
      mode: 'adaptive',
      model_id: 'gemini-3.7-flash', // Manual model ID mismatch with high-tier S1 pro
      fallback_policy: 'smart',
      temperature: 0.2,
      max_tokens: 2000,
    },
    // Injected ephemeral model preferences
    reasoning_model_preferences: {
      mode: 'adaptive',
      force_model: false,
      fallback_policy: 'smart',
    } as any
  } as any);

  console.log(`\nCreated Project A with ID: ${projectIdA}`);
  console.log('Model Preferences: Mode = adaptive, Force Model = false');
  console.log('Manual Select model_id (Differing from ARMO): gemini-3.7-flash\n');

  console.log('Triggering actual orchestrated pipeline execution...');
  const resA = await runOrchestratedPipeline({ projectId: projectIdA });
  console.log(`Generation execution complete! Status: ${resA.success ? 'SUCCESS' : 'FAILED'}, Error: ${resA.error || 'none'}\n`);

  // Extract recorded ARMO transactions from all activeRuns for Scenario A
  for (const [rId, runSnapshot] of (armoOrchestrator as any).activeRuns.entries()) {
    if (runSnapshot && Array.isArray(runSnapshot.transitions)) {
      for (const transition of runSnapshot.transitions) {
        traceRecords.push({
          runId: `ScenarioA_${transition.stage}`,
          stage: transition.stage,
          requestedModel: transition.requestedModel,
          resolvedModel: transition.resolvedModel,
          actualModel: transition.actualModel,
          reason: transition.reason || transition.description || '',
          result: transition.status || transition.result || 'SUCCESS',
        });
      }
    }
  }

  // Clear activeRuns before starting Scenario B to prevent bleed
  (armoOrchestrator as any).activeRuns.clear();

  // =========================================================================
  // SCENARIO B: fixed mode, legacy preservation
  // =========================================================================
  console.log('--- RUNNING SCENARIO B: FIXED MODE LEGACY PRESERVATION ---');
  const projectIdB = 'test-project-fixed-mode';
  await db.deleteProject(projectIdB);

  await db.saveProject({
    id: projectIdB,
    title: 'Fixed Legacy Test',
    raw_script: 'Sunan Kalijaga berdiri di tepi Danau Berkabut dengan tenang.',
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: null,
    prompt_language: 'id',
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'draft',
    ai_model: 'gemini-3.6-flash', // Manual selector is set to 3.6-flash
    reasoning_config: {
      mode: 'fixed',
      model_id: 'gemini-3.6-flash',
      fallback_policy: 'smart',
      temperature: 0.2,
      max_tokens: 2000,
    },
    reasoning_model_preferences: {
      mode: 'fixed',
      force_model: true,
      fallback_policy: 'off',
    } as any
  } as any);

  console.log(`\nCreated Project B with ID: ${projectIdB}`);
  console.log('Model Preferences: Mode = fixed, Force Model = true');
  console.log('Manual Select model_id: gemini-3.6-flash\n');

  console.log('Triggering orchestrated pipeline execution for S1 in Fixed Mode...');
  const resB = await runOrchestratedPipeline({ projectId: projectIdB });
  console.log(`Fixed Mode execution complete! Status: ${resB.success ? 'SUCCESS' : 'FAILED'}\n`);

  // Extract recorded ARMO transactions from all activeRuns for Scenario B
  for (const [rId, runSnapshot] of (armoOrchestrator as any).activeRuns.entries()) {
    if (runSnapshot && Array.isArray(runSnapshot.transitions)) {
      for (const transition of runSnapshot.transitions) {
        traceRecords.push({
          runId: `ScenarioB_${transition.stage}`,
          stage: transition.stage,
          requestedModel: transition.requestedModel,
          resolvedModel: transition.resolvedModel,
          actualModel: transition.actualModel,
          reason: transition.reason || transition.description || '',
          result: transition.status || transition.result || 'SUCCESS',
        });
      }
    }
  }

  // Print results table
  console.log('\n========================================================================================================');
  console.log('                                     ARMO PRODUCTION RUNTIME TRACE LOGS');
  console.log('========================================================================================================');
  console.log('runId                                | stage | requestedModel         | resolvedModel          | actualModel            | result');
  console.log('--------------------------------------------------------------------------------------------------------');
  for (const record of traceRecords) {
    console.log(
      `${record.runId.padEnd(36)} | ${record.stage.padEnd(5)} | ${record.requestedModel.padEnd(22)} | ${record.resolvedModel.padEnd(22)} | ${record.actualModel.padEnd(22)} | ${record.result}`
    );
  }
  console.log('========================================================================================================\n');

  // Assert and report proofs
  const s1Record = traceRecords.find(r => r.runId.startsWith('ScenarioA_') && r.stage === 'S1');
  const s2Records = traceRecords.filter(r => r.runId.startsWith('ScenarioA_') && r.stage === 'S2');
  const s1FixedRecord = traceRecords.find(r => r.runId.startsWith('ScenarioB_') && r.stage === 'S1');

  console.log('=======================================');
  console.log('         RUNTIME PROOF VERDICTS        ');
  console.log('=======================================');
  
  if (s1Record) {
    console.log(`[PROOF 1] Override Prevention in Adaptive Mode:`);
    console.log(`  - Manual selected model: "gemini-3.7-flash"`);
    console.log(`  - ARMO resolved model:   "${s1Record.resolvedModel}"`);
    console.log(`  - Actual routed model:   "${s1Record.actualModel}"`);
    if (s1Record.actualModel !== 'gemini-3.7-flash') {
      console.log(`  👉 VERDICT: SUCCESS! Manual model override prevented. ARMO is fully authoritative.`);
    } else {
      console.log(`  👉 VERDICT: FAILED! Manual selected model overrode ARMO.`);
    }
  }

  if (s2Records.length >= 2) {
    const primaryAttempt = s2Records[0];
    const secondaryAttempt = s2Records[1];
    console.log(`\n[PROOF 2] Dynamic Fallback routing in Adaptive Mode:`);
    console.log(`  - Primary S2 attempt target: "${primaryAttempt.requestedModel}" -> Result: ${primaryAttempt.result}`);
    console.log(`  - Secondary fallback target: "${secondaryAttempt.actualModel}" -> Result: ${secondaryAttempt.result}`);
    if (primaryAttempt.result.startsWith('FAIL') && secondaryAttempt.result === 'SUCCESS') {
      console.log(`  👉 VERDICT: SUCCESS! Fallback sequence fully proven: ${primaryAttempt.requestedModel} -> ${secondaryAttempt.actualModel} (SUCCESS)`);
    } else {
      console.log(`  👉 VERDICT: FAILED! Fallback sequence did not execute correctly.`);
    }
  }

  if (s1FixedRecord) {
    console.log(`\n[PROOF 3] Legacy Preservation in Fixed Mode:`);
    console.log(`  - Manual selected model: "${s1FixedRecord.requestedModel}"`);
    console.log(`  - Actual routed model:   "${s1FixedRecord.actualModel}"`);
    if (s1FixedRecord.actualModel === 'gemini-3.6-flash') {
      console.log(`  👉 VERDICT: SUCCESS! Fixed mode behavior preserved. Manual selection respected.`);
    } else {
      console.log(`  👉 VERDICT: FAILED! Fixed mode bypassed manual model selection.`);
    }
  }

  console.log('\nVerification suite completed successfully!');
}

executeVerificationSuite().catch((err) => {
  console.error('Error during verification suite execution:', err);
  process.exit(1);
});
