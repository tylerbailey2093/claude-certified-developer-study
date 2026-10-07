// Leitner spaced repetition. Every answer anywhere (practice, review, exam)
// goes through record(): correct moves a card up one box, wrong sends it back
// to box 1. A correct answer in the top box graduates the card.
//
// v1's bug was that the "correct" path was never called, so cards never moved.
// Here there is one entry point for both outcomes, so that cannot recur.
export const DAY = 24 * 60 * 60 * 1000;
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16]; // index = box; box 0 unused
export const TOP_BOX = 5;

export type Card = { box: number; due: number; lapses: number; last: number; graduated?: boolean };
export type Deck = Record<string, Card>;

/**
 * Interval in days for a box. With an exam date set, intervals are capped so
 * every card resurfaces at least once before exam day.
 */
export function intervalDays(box: number, now: number, examDate?: number): number {
  const base = INTERVAL_DAYS[Math.min(Math.max(box, 1), TOP_BOX)];
  if (!examDate) return base;
  const daysLeft = Math.floor((examDate - now) / DAY);
  if (daysLeft <= 1) return 1;
  return Math.max(1, Math.min(base, Math.floor(daysLeft / 2)));
}

/**
 * Apply one answer. Only wrong answers create a card: a question you get right
 * the first time is not worth scheduling. Returns a new deck.
 */
export function record(deck: Deck, qid: string, ok: boolean, now: number, examDate?: number): Deck {
  const card = deck[qid];
  const next = { ...deck };
  if (!ok) {
    next[qid] = { box: 1, due: now + intervalDays(1, now, examDate) * DAY, lapses: (card?.lapses ?? 0) + 1, last: now };
    return next;
  }
  if (!card || card.graduated) return deck;
  if (card.box >= TOP_BOX) {
    next[qid] = { ...card, graduated: true, last: now };
    return next;
  }
  const box = card.box + 1;
  next[qid] = { ...card, box, due: now + intervalDays(box, now, examDate) * DAY, last: now };
  return next;
}

export function due(deck: Deck, now: number): string[] {
  return Object.entries(deck)
    .filter(([, c]) => !c.graduated && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function boxCounts(deck: Deck): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // index 6 = graduated
  for (const c of Object.values(deck)) counts[c.graduated ? 6 : c.box]++;
  return counts;
}

/** Number of cards coming due on each of the next `days` days (index 0 = today, incl. overdue). */
export function forecast(deck: Deck, now: number, days = 7): number[] {
  const out = Array(days).fill(0);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (const c of Object.values(deck)) {
    if (c.graduated) continue;
    const idx = Math.max(0, Math.floor((c.due - startOfToday) / DAY));
    if (idx < days) out[idx]++;
  }
  return out;
}
