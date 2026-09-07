import { runEndToEndRoutingProof } from './server/ai_infrastructure/e2e_routing_and_fallback_proof';

async function main() {
  try {
    const ok = await runEndToEndRoutingProof();
    process.exit(ok ? 0 : 1);
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

main();
