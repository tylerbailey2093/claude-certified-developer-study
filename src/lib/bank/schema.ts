// Question bank schema v2. One JSON array per objective lives at
// src/data/questions/<objective-id>.json. Shared by the site (runtime types),
// the content collection (build-time validation) and the lint scripts.
//
// Answers reference option ids, never positions, so shuffling at render can
// never desynchronise an explanation from its option. Explanations and option
// rationales must not mention positions ("option A", "the first option"):
// lint_questions enforces that.
import { z } from 'zod';

export const PATTERNS = [
  'buried-constraint',
  'must-means-deterministic',
  'wrong-place-mechanism',
  'scope-boundary',
  'tradeoff',
  'diagnosis',
  'sequence',
  'unclassified',
] as const;

export const STATUSES = ['active', 'needs-rationale', 'retired'] as const;

export const OptionSchema = z.object({
  id: z.string().regex(/^[a-f]$/),
  text: z.string().min(1),
  /** Why this option is right or wrong. Empty only on unrepaired legacy items. */
  why: z.string().default(''),
});

export const SourceSchema = z.object({ label: z.string(), url: z.string().url() });

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    objective: z.string(),
    domain: z.number().int().min(1).max(8),
    subskills: z.array(z.string()).default([]),
    type: z.enum(['single', 'multi']),
    select: z.number().int().min(1).max(3),
    stem: z.string().min(20),
    options: z.array(OptionSchema).min(4).max(6),
    answer: z.array(z.string().regex(/^[a-f]$/)).min(1),
    explanation: z.string().min(1),
    /** The deciding words. Must appear verbatim in the stem when present. */
    cue: z.string().default(''),
    pattern: z.enum(PATTERNS).default('unclassified'),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    tags: z.array(z.string()).default([]),
    sources: z.array(SourceSchema).default([]),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** Depends on behaviour that changed after the July 2026 guide. Excluded from the simulator. */
    postGuide: z.object({ note: z.string() }).optional(),
    author: z.string().default('legacy'),
    status: z.enum(STATUSES).default('active'),
  })
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: duplicate option ids` });
    }
    for (const a of q.answer) {
      if (!ids.includes(a)) ctx.addIssue({ code: 'custom', message: `${q.id}: answer "${a}" is not an option id` });
    }
    if (q.select !== q.answer.length) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: select=${q.select} but ${q.answer.length} answers` });
    }
    if (q.type === 'single' && (q.answer.length !== 1 || q.options.length !== 4)) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: single items need exactly 1 answer and 4 options` });
    }
    if (q.type === 'multi' && q.answer.length < 2) {
      ctx.addIssue({ code: 'custom', message: `${q.id}: multi items need 2+ answers` });
    }
  });

export type Option = z.infer<typeof OptionSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Pattern = (typeof PATTERNS)[number];

/** A question ready to render: options in display order. */
export type PresentedQuestion = Question & { order: string[] };

export function isDrawable(q: Question): boolean {
  return q.status !== 'retired';
}

export function isExamEligible(q: Question): boolean {
  return isDrawable(q) && !q.postGuide;
}

export function isCorrect(q: Question, chosen: string[]): boolean {
  if (chosen.length !== q.answer.length) return false;
  const want = new Set(q.answer);
  return chosen.every((c) => want.has(c));
}
