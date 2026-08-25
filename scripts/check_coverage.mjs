#!/usr/bin/env node
// Verify gate: per-objective question counts vs. the Stage C targets in the build plan,
// and the mock-pool-variance assertion — every domain's pool must exceed its
// mock_composition requirement by a margin, or repeat mocks draw an identical set.
// This is the specific defect the 150-item expansion exists to fix; this check exists
// so it can't silently regress.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'blueprint.json'), 'utf-8'));
const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/questions/all.json'), 'utf-8'));

const TARGETS = {
  'Claude Application Design': 13, 'Software Engineering Foundations': 11,
  'Claude API Mechanics': 10, 'Technical Fundamentals': 9,
  'Agent Construction with Claude': 8, 'LLM Fundamentals': 8,
  'Agent Patterns and Frameworks': 7, 'Prompt Engineering': 7,
  'Agent Architecture': 7, 'Tool Implementation': 7,
  'Configuration Management': 6, 'Agentic Customization': 6,
  'AI Application Security': 5, 'Claude Code Operation': 5,
  'Understanding Requirements': 5, 'Systems Life Cycle': 4,
  'Cost and Token Management': 4, 'Model Selection and Tradeoffs': 4,
  'Output Handling': 4, 'Debugging and Error Handling': 4,
  'Context Engineering': 6, 'Guardrails and Safe Deployment': 3,
  'MCP Server Development': 3, 'Identity, Secrets, and Key Management': 2,
  'Claude Hooks': 2,
};

const counts = {};
for (const q of all) counts[q.s] = (counts[q.s] ?? 0) + 1;

let failures = 0;
console.log('--- per-objective coverage (target ±1) ---');
for (const [name, target] of Object.entries(TARGETS)) {
  const have = counts[name] ?? 0;
  const ok = have >= target - 1;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}: ${have}/${target}`);
}

console.log('\n--- mock-pool variance (pool must exceed mock_composition need) ---');
const mockComp = blueprint.mock_composition;
const byDomain = {};
for (const q of all) byDomain[q.d] = (byDomain[q.d] ?? 0) + 1;
for (const [d, need] of Object.entries(mockComp)) {
  const have = byDomain[d] ?? 0;
  const margin = have / need;
  const ok = margin >= 1.5;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  D${d}: ${have} available / ${need} needed (${margin.toFixed(1)}x)`);
}

console.log(`\ntotal bank size: ${all.length} (target 150)`);

if (failures > 0) {
  console.error(`\n${failures} coverage check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS');
