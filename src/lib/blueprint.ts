// Typed view of blueprint.json with stable objective ids. Objective ids are
// the slug of the official objective name and match the MDX filenames.
import raw from '../../blueprint.json';

export type BPObjective = {
  id: string;
  name: string;
  weight: number;
  domain: number;
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

type RawObjective = { id?: string; name: string; weight: number; scope?: string[]; traps?: string[] };
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

export function domainName(n: number): string {
  return DOMAINS.find((d) => d.n === n)?.name ?? `Domain ${n}`;
}
