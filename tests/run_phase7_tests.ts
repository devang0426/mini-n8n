/**
 * Standalone Test Runner for Phase P7 — AI Workflow Assistant
 */

import { runPhase7Tests } from './phase7_ai_assistant.test';

async function main() {
  try {
    const result = await runPhase7Tests();
    if (result.failed > 0) {
      console.error(`❌ Phase P7 verification failed: ${result.failed} test(s) failed out of ${result.total}.`);
      process.exit(1);
    } else {
      console.log(`✅ All ${result.passed} Phase P7 verification tests passed successfully!`);
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal error during Phase P7 test execution:', err);
    process.exit(1);
  }
}

main();
