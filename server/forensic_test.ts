
import { db } from './db';
import { runOrchestratedPipeline } from './orchestrator';

async function runForensics() {
  const projectId = 'forensic_test_project_' + Date.now();
  
  // Initialize minimal foundation for "Lahirnya Cahaya"
  await db.saveProject({
    id: projectId,
    title: 'Lahirnya Cahaya Forensic Test',
    raw_script: 'Cerita tentang Lahirnya Cahaya, 60 detik.',
    prompt_language: 'id',
    total_duration_target_sec: 60,
    status: 'processing',
    foundation_status: 'ready',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);

  const results = [];
  for (let i = 0; i < 10; i++) {
    console.log(`--- Iteration ${i + 1} ---`);
    const result = await runOrchestratedPipeline({ projectId });
    results.push(result);
    console.log(result);
  }
  
  console.log('Forensic run complete.');
}

runForensics();
