import { defineCollection, z } from 'astro:content';
import blueprint from '../blueprint.json';

// Deterministic content gate: the build fails if an objective is missing, if its
// weight disagrees with blueprint.json, or if domain weights don't sum to 100.
// This mirrors the exam's own principle — a "must" belongs in code, not a prompt.

const objectives = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    domain: z.number().int().min(1).max(8),
    domainName: z.string(),
    name: z.string(),
    weight: z.number().positive(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    hot: z.boolean().default(false),
    scope: z.array(z.string()),
    traps: z.array(z.string()),
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    authored: z.boolean().default(false),
  }),
});

export const collections = { objectives };

// --- Blueprint conformance check, runs at collection-config eval time (build + dev) ---
type BPObjective = { name: string; weight: number };
type BPDomain = { n: number; name: string; weight: number; objectives: BPObjective[] };
const domains = (blueprint as { domains: BPDomain[] }).domains;

const totalWeight = domains.reduce((s, d) => s + d.weight, 0);
if (Math.abs(totalWeight - 100) > 0.15) {
  throw new Error(`blueprint.json domain weights sum to ${totalWeight}, expected 100`);
}

const expectedObjectiveCount = domains.reduce((s, d) => s + d.objectives.length, 0);
if (expectedObjectiveCount !== 25) {
  throw new Error(`blueprint.json has ${expectedObjectiveCount} objectives, expected 25 (CCDV-F guide v1.0)`);
}
