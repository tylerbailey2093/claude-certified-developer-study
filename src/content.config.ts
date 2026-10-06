import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { OBJECTIVES, DOMAINS } from './lib/blueprint';

// Build-time gate: an objective whose frontmatter disagrees with blueprint.json
// (id, domain, name or weight) fails the build. scripts/check_blueprint.ts runs
// the same checks with a fuller report, plus content-structure rules.

const objectives = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/objectives' }),
  schema: z
    .object({
      id: z.string(),
      domain: z.number().int().min(1).max(8),
      domainName: z.string(),
      name: z.string(),
      weight: z.number().positive(),
      tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      hot: z.boolean().default(false),
      summary: z.string().optional(),
      subskills: z.array(z.string()).default([]),
      related: z.array(z.string()).default([]),
      scope: z.array(z.string()),
      traps: z.array(z.string()),
      sources: z
        .array(z.object({ label: z.string(), url: z.string().url(), verified: z.string().optional() }))
        .default([]),
      lastReviewed: z.string().optional(),
      authored: z.boolean().default(true),
    })
    .superRefine((o, ctx) => {
      const bp = OBJECTIVES.find((b) => b.id === o.id);
      if (!bp) {
        ctx.addIssue({ code: 'custom', message: `objective "${o.id}" is not in blueprint.json` });
        return;
      }
      if (bp.domain !== o.domain) ctx.addIssue({ code: 'custom', message: `${o.id}: domain ${o.domain} != blueprint ${bp.domain}` });
      if (bp.name !== o.name) ctx.addIssue({ code: 'custom', message: `${o.id}: name "${o.name}" != blueprint "${bp.name}"` });
      if (Math.abs(bp.weight - o.weight) > 1e-9)
        ctx.addIssue({ code: 'custom', message: `${o.id}: weight ${o.weight} != blueprint ${bp.weight}` });
    }),
});

const labs = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/labs' }),
  schema: z.object({
    n: z.number().int(),
    title: z.string(),
    minutes: z.number(),
    proves: z.string(),
    domains: z.array(z.number().int().min(1).max(8)),
    objectives: z.array(z.string()),
    apiKeyNeeded: z.boolean(),
    top3: z.boolean().default(false),
    notebook: z.string(),
    cost: z.string().optional(),
  }),
});

export const collections = { objectives, labs };

// Blueprint-level invariants.
const total = DOMAINS.reduce((s, d) => s + d.weight, 0);
if (Math.abs(total - 100) > 0.15) throw new Error(`blueprint.json domain weights sum to ${total}, expected 100`);
if (OBJECTIVES.length !== 25) throw new Error(`blueprint.json has ${OBJECTIVES.length} objectives, expected 25`);
for (const d of DOMAINS) {
  const sum = d.objectives.reduce((s, o) => s + o.weight, 0);
  if (Math.abs(sum - d.weight) > 0.15) throw new Error(`D${d.n} objective weights sum to ${sum}, domain says ${d.weight}`);
}
