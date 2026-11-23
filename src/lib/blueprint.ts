// Typed view of blueprint.json with stable objective ids. Objective ids are
// the slug of the official objective name and match the MDX filenames.
import raw from '../../blueprint.json';

export type BPObjective = {
  id: string;
  name: string;
  weight: number;
  domain: number;
  guide: string;
  subskills: { id: string; label: string }[];
  scope: string[];
  traps: string[];
};
export type BPDomain = { n: number; name: string; weight: number; approxItems: number; objectives: BPObjective[] };

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type RawObjective = {
  id?: string;
  name: string;
  weight: number;
  guide?: string;
  subskills?: { id: string; label: string }[];
  scope?: string[];
  traps?: string[];
};
type RawDomain = { n: number; name: string; weight: number; approx_items: number; objectives: RawObjective[] };

export const DOMAINS: BPDomain[] = (raw as unknown as { domains: RawDomain[] }).domains.map((d) => ({
  n: d.n,
  name: d.name,
  weight: d.weight,
  approxItems: d.approx_items,
  objectives: d.objectives.map((o) => ({
    id: o.id ?? slug(o.name),
    name: o.name,
    weight: o.weight,
    domain: d.n,
    guide: o.guide ?? '',
    subskills: o.subskills ?? [],
    scope: o.scope ?? [],
    traps: o.traps ?? [],
  })),
}));

export const OBJECTIVES: BPObjective[] = DOMAINS.flatMap((d) => d.objectives);

export const OBJECTIVE_BY_ID = new Map(OBJECTIVES.map((o) => [o.id, o]));

export const MOCK_COMPOSITION: Record<number, number> = Object.fromEntries(
  Object.entries((raw as unknown as { mock_composition: Record<string, number> }).mock_composition).map(([k, v]) => [
    Number(k),
    v,
  ])
);

export const EXAM = { items: 53, minutes: 120, cut: 720 } as const;

// Exam Guide v1.1 (effective 2026-12-07): 70 items (60 scored), per-domain
// weights only, objectives rewritten as 24 skills. The appointment date decides
// which version a candidate sits.
type V11 = {
  effective: string;
  format: { items: number; scored: number; unscored: number; minutes: number; cut: number };
  weights: Record<string, number>;
  mock_composition: Record<string, number>;
  skills: { domain: number; name: string; guide: string; maps_to: string[] }[];
};
const v11 = (raw as unknown as { v1_1: V11 }).v1_1;
export const V11_EFFECTIVE = v11.effective;
export const EXAM_V11 = { items: v11.format.items, scored: v11.format.scored, minutes: v11.format.minutes, cut: v11.format.cut } as const;
export const WEIGHTS_V11: Record<number, number> = Object.fromEntries(Object.entries(v11.weights).map(([k, v]) => [Number(k), v]));
export const MOCK_COMPOSITION_V11: Record<number, number> = Object.fromEntries(
  Object.entries(v11.mock_composition).map(([k, v]) => [Number(k), v])
);
export const V11_SKILLS = v11.skills;
/** Which guide version applies to an exam on this date (YYYY-MM-DD). */
export function guideVersionFor(date?: string): 'v1.0' | 'v1.1' {
  return date && date < V11_EFFECTIVE ? 'v1.0' : 'v1.1';
}

export function domainName(n: number): string {
  return DOMAINS.find((d) => d.n === n)?.name ?? `Domain ${n}`;
}

export const SUBSKILL_BY_ID = new Map(
  OBJECTIVES.flatMap((o) => o.subskills.map((s) => [s.id, { ...s, objective: o.id }] as const))
);
