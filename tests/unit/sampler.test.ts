import { describe, expect, it } from 'vitest';
import { allQuestions } from '../../src/lib/bank/bank';
import { allocate, drawExam, drawWeighted } from '../../src/lib/bank/sampler';
import { mulberry32 } from '../../src/lib/bank/shuffle';
import { MOCK_COMPOSITION, OBJECTIVES } from '../../src/lib/blueprint';

const bank = allQuestions();

describe('allocate', () => {
  it('always sums to n and stays within one of the exact share', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const w = [8.6, 7.4, 6.8, 4.1, 3.4, 2.8];
      const a = allocate(17, w, rng);
      expect(a.reduce((s, x) => s + x, 0)).toBe(17);
      const total = w.reduce((s, x) => s + x, 0);
      a.forEach((x, j) => expect(Math.abs(x - (17 * w[j]) / total)).toBeLessThan(1));
    }
  });
});

describe('drawExam over 1,000 seeds', () => {
  const draws = Array.from({ length: 1000 }, (_, i) => drawExam(bank, { rng: mulberry32(i + 1) }));

  it('draws exactly 53 unique items with exact domain counts', () => {
    for (const d of draws) {
      expect(d).toHaveLength(53);
      expect(new Set(d.map((q) => q.id)).size).toBe(53);
      for (const [dom, n] of Object.entries(MOCK_COMPOSITION)) {
        expect(d.filter((q) => q.domain === Number(dom)).length).toBe(n);
      }
    }
  });

  it('gives Claude Application Design 4 or 5 items every time', () => {
    for (const d of draws) {
      const n = d.filter((q) => q.objective === 'claude-application-design').length;
      expect(n === 4 || n === 5).toBe(true);
    }
  });

  it('includes every objective weighted 2.5%+ in at least 95% of draws', () => {
    for (const o of OBJECTIVES.filter((o) => o.weight >= 2.5)) {
      const hits = draws.filter((d) => d.some((q) => q.objective === o.id)).length;
      expect(hits, o.id).toBeGreaterThanOrEqual(950);
    }
  });

  it('never draws retired items', () => {
    for (const d of draws) expect(d.every((q) => q.status !== 'retired')).toBe(true);
  });

  it('is reproducible from its seed', () => {
    const a = drawExam(bank, { rng: mulberry32(99) }).map((q) => q.id);
    const b = drawExam(bank, { rng: mulberry32(99) }).map((q) => q.id);
    expect(a).toEqual(b);
  });
});

describe('drawWeighted', () => {
  it('returns n distinct items', () => {
    const d = drawWeighted(bank, 20, { rng: mulberry32(3) });
    expect(new Set(d.map((q) => q.id)).size).toBe(20);
  });
});

describe('mini mock', () => {
  it('draws exactly the requested count for short exams', () => {
    for (let s = 1; s <= 300; s++) {
      expect(drawExam(bank, { rng: mulberry32(s) }, 20)).toHaveLength(20);
    }
  });
});
