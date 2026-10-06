import { describe, expect, it } from 'vitest';
import { DAY, due, intervalDays, record, type Deck } from '../../src/lib/store/srs';

describe('Leitner SRS', () => {
  it('a miss creates a box-1 card due in one day', () => {
    const d = record({}, 'q1', false, 0);
    expect(d.q1).toMatchObject({ box: 1, due: DAY, lapses: 1 });
  });

  it('correct answers climb 1 -> 2 -> 4 -> 8 -> 16 days, then graduate (no repeated first interval)', () => {
    let d: Deck = record({}, 'q1', false, 0);
    const seen: number[] = [];
    let now = 0;
    for (let i = 0; i < 4; i++) {
      now = d.q1.due;
      d = record(d, 'q1', true, now);
      seen.push((d.q1.due - now) / DAY);
    }
    expect(seen).toEqual([2, 4, 8, 16]);
    d = record(d, 'q1', true, d.q1.due);
    expect(d.q1.graduated).toBe(true);
    expect(due(d, Number.MAX_SAFE_INTEGER)).toEqual([]);
  });

  it('a wrong answer resets to box 1 and counts a lapse', () => {
    let d = record({}, 'q1', false, 0);
    d = record(d, 'q1', true, DAY);
    d = record(d, 'q1', false, 3 * DAY);
    expect(d.q1).toMatchObject({ box: 1, lapses: 2 });
  });

  it('a correct first answer does not create a card', () => {
    expect(record({}, 'q1', true, 0)).toEqual({});
  });

  it('caps intervals so cards resurface before the exam date', () => {
    expect(intervalDays(5, 0, 6 * DAY)).toBe(3);
    expect(intervalDays(5, 0, 1 * DAY)).toBe(1);
    expect(intervalDays(2, 0, 100 * DAY)).toBe(2);
  });
});
