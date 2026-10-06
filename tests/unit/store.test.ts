// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../../src/lib/store/index';

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/v1-localstorage.json'), 'utf8')
) as Record<string, unknown>;

function loadV1() {
  localStorage.clear();
  for (const [k, v] of Object.entries(fixture)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
}

describe('store v2 migration from v1', () => {
  beforeEach(() => {
    loadV1();
    Store.reset();
  });

  it('maps misses, confidence, checklist, mocks and theme', () => {
    Store.init(1_760_000_000_000);
    const srs = Store.get('srs');
    expect(srs['legacy-001']).toMatchObject({ box: 1, lapses: 1 });
    expect(srs['new-claude-application-design-03'].box).toBe(3);
    expect(Store.get('attempts')).toHaveLength(2);
    expect(Store.get('confidence')).toEqual({ 'claude-application-design': 4, 'claude-hooks': 2 });
    const ck = Store.get('checklist');
    expect(Object.keys(ck)).toHaveLength(2);
    expect(Object.keys(ck).every((k) => !/^ck-\d+-\d+$/.test(k))).toBe(true);
    expect(Store.get('exam:history')[0]).toMatchObject({ mode: 'legacy', correct: 17, total: 25, scaledEstimate: 694 });
    expect(Store.get('prefs').theme).toBe('dark');
    // v1 keys are left in place for rollback
    expect(localStorage.getItem('ccdvf:v1:misses')).not.toBeNull();
  });

  it('is idempotent', () => {
    Store.init(1);
    const first = JSON.stringify([Store.get('attempts'), Store.get('srs'), Store.get('exam:history')]);
    Store.reset(); // clears v2 only
    // simulate a second page load where v2 already exists
    Store.init(1);
    Store.init(2);
    const second = JSON.stringify([Store.get('attempts'), Store.get('srs'), Store.get('exam:history')]);
    expect(second).toBe(first);
  });
});

describe('recordAnswer', () => {
  beforeEach(() => {
    localStorage.clear();
    Store.reset();
    Store.init(0);
  });

  it('logs every attempt and advances SRS on correct review', () => {
    const q = { id: 'q1', objective: 'claude-hooks', domain: 7, difficulty: 2 as const };
    Store.recordAnswer(q, false, { src: 'practice', now: 0 });
    Store.recordAnswer(q, true, { src: 'review', now: 86_400_000 });
    expect(Store.get('attempts').map((a) => a.ok)).toEqual([0, 1]);
    expect(Store.get('srs').q1.box).toBe(2);
  });
});

describe('import validation', () => {
  beforeEach(() => {
    localStorage.clear();
    Store.reset();
    Store.init(0);
  });

  it('rejects malformed files with a message', () => {
    expect(Store.importJSON('not json')).toMatchObject({ ok: false });
    expect(Store.importJSON('{"hello":1}')).toMatchObject({ ok: false });
    expect(Store.importJSON('{"app":"ccdvf","version":2,"data":{"attempts":"x"}}')).toMatchObject({ ok: false });
  });

  it('round-trips a v2 export and merges without duplicating', () => {
    Store.recordAnswer({ id: 'q1', objective: 'claude-hooks', domain: 7, difficulty: 2 }, false, { src: 'practice', now: 5 });
    const json = Store.exportJSON(10);
    expect(Store.importJSON(json)).toMatchObject({ ok: true });
    expect(Store.get('attempts')).toHaveLength(1);
  });

  it('accepts a v1 export', () => {
    const v1 = { version: 1, misses: fixture['ccdvf:v1:misses'], confidence: { 'Claude Hooks': 3 } };
    expect(Store.importJSON(JSON.stringify(v1))).toMatchObject({ ok: true });
    expect(Store.get('confidence')['claude-hooks']).toBe(3);
  });
});
