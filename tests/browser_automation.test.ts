/**
 * AI Agent Workflow Builder — Browser Automation & Stagehand Step Test Suite
 */

import { StepRunner } from '../server/workflow/step-runner';
import { StepContext } from '../server/workflow/types';
import { ValidationError, StepExecutionError } from '../server/workflow/errors';

export async function runBrowserAutomationTests() {
  console.log('==================================================');
  console.log('RUNNING BROWSER AUTOMATION & STAGEHAND TESTS');
  console.log('==================================================\n');

  const results: { test: string; passed: boolean; error?: string }[] = [];

  const mockAdminSql = async (sql: string) => ({ body: { result: [[], []] } });

  // Test 1: browser_navigate - Valid URL Execution
  try {
    const context: StepContext = {
      workflowInput: {},
      stepConfig: { url: 'https://jsonplaceholder.typicode.com/posts/1' },
      workflowRunId: 'run-test-1',
      stepRunId: 'step-test-1',
      orgId: 'org-test-1',
      attemptCount: 1,
    };

    const res = await StepRunner.executeStep('browser_navigate', context, mockAdminSql);
    if (res.status === 'completed' && res.output?.url && res.output?.statusCode === 200) {
      results.push({ test: 'browser_navigate: valid public URL navigation', passed: true });
    } else {
      results.push({ test: 'browser_navigate: valid public URL navigation', passed: false, error: JSON.stringify(res) });
    }
  } catch (err: any) {
    results.push({ test: 'browser_navigate: valid public URL navigation', passed: false, error: err.message });
  }

  // Test 2: browser_navigate - SSRF Prevention (localhost blocked)
  try {
    const context: StepContext = {
      workflowInput: {},
      stepConfig: { url: 'http://localhost:3000/api/secret' },
      workflowRunId: 'run-test-2',
      stepRunId: 'step-test-2',
      orgId: 'org-test-2',
      attemptCount: 1,
    };

    await StepRunner.executeStep('browser_navigate', context, mockAdminSql);
    results.push({ test: 'browser_navigate: SSRF block localhost', passed: false, error: 'Expected ValidationError for localhost' });
  } catch (err: any) {
    if (err instanceof ValidationError && err.message.includes('denied')) {
      results.push({ test: 'browser_navigate: SSRF block localhost', passed: true });
    } else {
      results.push({ test: 'browser_navigate: SSRF block localhost', passed: false, error: err.message });
    }
  }

  // Test 3: browser_navigate - SSRF Prevention (Private IP 192.168.1.1 blocked)
  try {
    const context: StepContext = {
      workflowInput: {},
      stepConfig: { url: 'http://192.168.1.1/admin' },
      workflowRunId: 'run-test-3',
      stepRunId: 'step-test-3',
      orgId: 'org-test-3',
      attemptCount: 1,
    };

    await StepRunner.executeStep('browser_navigate', context, mockAdminSql);
    results.push({ test: 'browser_navigate: SSRF block private IP', passed: false, error: 'Expected ValidationError for private IP' });
  } catch (err: any) {
    if (err instanceof ValidationError && err.message.includes('denied')) {
      results.push({ test: 'browser_navigate: SSRF block private IP', passed: true });
    } else {
      results.push({ test: 'browser_navigate: SSRF block private IP', passed: false, error: err.message });
    }
  }

  // Test 4: stagehand_act - AI Action execution
  try {
    const context: StepContext = {
      workflowInput: {},
      previousOutput: { url: 'https://example.com/login' },
      stepConfig: { action: 'Click login button', selector: 'button#submit' },
      workflowRunId: 'run-test-4',
      stepRunId: 'step-test-4',
      orgId: 'org-test-4',
      attemptCount: 1,
    };

    const res = await StepRunner.executeStep('stagehand_act', context, mockAdminSql);
    if (res.status === 'completed' && res.output?.success === true && res.output?.screenshotUrl) {
      results.push({ test: 'stagehand_act: AI action execution', passed: true });
    } else {
      results.push({ test: 'stagehand_act: AI action execution', passed: false, error: JSON.stringify(res) });
    }
  } catch (err: any) {
    results.push({ test: 'stagehand_act: AI action execution', passed: false, error: err.message });
  }

  // Test 5: stagehand_extract - AI Data extraction from previous step output
  try {
    const context: StepContext = {
      workflowInput: {},
      previousOutput: { title: 'Product Catalog', textPreview: 'Item A: $19.99, Item B: $29.99' },
      stepConfig: { instruction: 'Extract product titles and prices' },
      workflowRunId: 'run-test-5',
      stepRunId: 'step-test-5',
      orgId: 'org-test-5',
      attemptCount: 1,
    };

    const res = await StepRunner.executeStep('stagehand_extract', context, mockAdminSql);
    if (res.status === 'completed' && res.output?.extractedData) {
      results.push({ test: 'stagehand_extract: AI data extraction', passed: true });
    } else {
      results.push({ test: 'stagehand_extract: AI data extraction', passed: false, error: JSON.stringify(res) });
    }
  } catch (err: any) {
    results.push({ test: 'stagehand_extract: AI data extraction', passed: false, error: err.message });
  }

  // Test 6: stagehand_observe - DOM elements discovery
  try {
    const context: StepContext = {
      workflowInput: {},
      previousOutput: { url: 'https://example.com' },
      stepConfig: { targetElements: ['inputs', 'buttons'] },
      workflowRunId: 'run-test-6',
      stepRunId: 'step-test-6',
      orgId: 'org-test-6',
      attemptCount: 1,
    };

    const res = await StepRunner.executeStep('stagehand_observe', context, mockAdminSql);
    if (res.status === 'completed' && Array.isArray(res.output?.interactiveElements)) {
      results.push({ test: 'stagehand_observe: DOM elements discovery', passed: true });
    } else {
      results.push({ test: 'stagehand_observe: DOM elements discovery', passed: false, error: JSON.stringify(res) });
    }
  } catch (err: any) {
    results.push({ test: 'stagehand_observe: DOM elements discovery', passed: false, error: err.message });
  }

  // Test 7: Pipeline Chaining - browser_navigate -> stagehand_observe -> stagehand_act -> stagehand_extract
  try {
    const contextNav: StepContext = {
      workflowInput: {},
      stepConfig: { url: 'https://jsonplaceholder.typicode.com/posts/1' },
      workflowRunId: 'run-chain',
      stepRunId: 'step-1',
      orgId: 'org-chain',
      attemptCount: 1,
    };
    const resNav = await StepRunner.executeStep('browser_navigate', contextNav, mockAdminSql);

    const contextObs: StepContext = {
      workflowInput: {},
      previousOutput: resNav.output,
      stepConfig: { targetElements: ['links'] },
      workflowRunId: 'run-chain',
      stepRunId: 'step-2',
      orgId: 'org-chain',
      attemptCount: 1,
    };
    const resObs = await StepRunner.executeStep('stagehand_observe', contextObs, mockAdminSql);

    const contextAct: StepContext = {
      workflowInput: {},
      previousOutput: resObs.output,
      stepConfig: { action: 'Click primary link' },
      workflowRunId: 'run-chain',
      stepRunId: 'step-3',
      orgId: 'org-chain',
      attemptCount: 1,
    };
    const resAct = await StepRunner.executeStep('stagehand_act', contextAct, mockAdminSql);

    const contextExt: StepContext = {
      workflowInput: {},
      previousOutput: resAct.output,
      stepConfig: { instruction: 'Extract summary' },
      workflowRunId: 'run-chain',
      stepRunId: 'step-4',
      orgId: 'org-chain',
      attemptCount: 1,
    };
    const resExt = await StepRunner.executeStep('stagehand_extract', contextExt, mockAdminSql);

    if (resNav.status === 'completed' && resObs.status === 'completed' && resAct.status === 'completed' && resExt.status === 'completed') {
      results.push({ test: 'Pipeline chaining: Full Browser & Stagehand automation workflow', passed: true });
    } else {
      results.push({ test: 'Pipeline chaining: Full Browser & Stagehand automation workflow', passed: false });
    }
  } catch (err: any) {
    results.push({ test: 'Pipeline chaining: Full Browser & Stagehand automation workflow', passed: false, error: err.message });
  }

  // Output test results summary
  console.log('RESULTS SUMMARY:');
  let passedCount = 0;
  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(` ✅ PASS: ${r.test}`);
    } else {
      console.log(` ❌ FAIL: ${r.test} - ${r.error}`);
    }
  }
  console.log(`\nTotal: ${passedCount}/${results.length} passed.`);

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runBrowserAutomationTests();
