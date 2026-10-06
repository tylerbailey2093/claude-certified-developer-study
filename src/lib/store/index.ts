// Store v2: the only module islands use for persistence.
import type { Question } from '../bank/schema';
import { read, write, remove, readRaw, V1_NS, NS, allKeys } from './storage';
import { record, due as dueIds, type Deck } from './srs';
import { mapV1, mergeInto, type V1Data } from './migrate';
import type { ExamRecord, ExamSession } from './exam';
import {
  DEFAULTS,
  KEYS,
  SCHEMA_VERSION,
  type Attempt,
  type PracticeSession,
  type Prefs,
  type StoreShape,
} from './schema';

export * from './schema';
export const MAX_ATTEMPTS = 20000;
export const MAX_EXAMS = 40;

// Always returns a fresh object: callers mutate (push, spread-assign), and
// handing out the shared DEFAULTS would leak state between sessions.
function get<K extends keyof StoreShape>(k: K): StoreShape[K] {
  return read(k, structuredClone(DEFAULTS[k]));
}
function set<K extends keyof StoreShape>(k: K, v: StoreShape[K]): void {
  write(k, v);
}

function examDateMs(): number | undefined {
  const d = get('prefs').examDate;
  if (!d) return undefined;
  const t = Date.parse(d + 'T09:00:00');
  return Number.isFinite(t) ? t : undefined;
}

function snapshotAll(): StoreShape {
  const out = {} as StoreShape;
  for (const k of KEYS) (out as Record<string, unknown>)[k] = get(k);
  return out;
}

function writeAll(s: StoreShape): void {
  for (const k of KEYS) set(k, s[k]);
}

function readV1(): V1Data | null {
  const parse = (k: string) => {
    const raw = readRaw(V1_NS + k);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  const data: V1Data = {
    misses: parse('misses'),
    mockHistory: parse('mockHistory'),
    confidence: parse('confidence'),
    checklist: parse('checklist'),
    theme: readRaw(V1_NS + 'theme') ?? undefined,
  };
  return Object.values(data).some((v) => v !== undefined) ? data : null;
}

let initialised = false;

export const Store = {
  get,
  set,

  /** Idempotent: creates meta and migrates v1 data the first time it runs in a browser. */
  init(now = Date.now()): void {
    if (initialised || typeof window === 'undefined') return;
    initialised = true;
    const meta = get('meta');
    if (!meta.createdAt) set('meta', { ...meta, schema: SCHEMA_VERSION, createdAt: now });
    if (get('meta').migratedFromV1) return;
    const v1 = readV1();
    if (v1) writeAll(mergeInto(snapshotAll(), mapV1(v1, now)));
    set('meta', { ...get('meta'), migratedFromV1: now });
  },

  /** Every answered question goes through here: attempt log + spaced repetition. */
  recordAnswer(
    q: Pick<Question, 'id' | 'objective' | 'domain' | 'difficulty'>,
    ok: boolean,
    opts: { src: Attempt['src']; ms?: number; sid?: string; conf?: Attempt['conf']; now?: number }
  ): void {
    const now = opts.now ?? Date.now();
    const attempts = get('attempts');
    attempts.push({
      q: q.id,
      o: q.objective,
      d: q.domain,
      ok: ok ? 1 : 0,
      t: now,
      ...(opts.ms ? { ms: Math.round(opts.ms) } : {}),
      src: opts.src,
      ...(opts.sid ? { sid: opts.sid } : {}),
      ...(opts.conf ? { conf: opts.conf } : {}),
      diff: q.difficulty,
    });
    set('attempts', attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts);
    set('srs', record(get('srs'), q.id, ok, now, examDateMs()));
  },

  dueIds(now = Date.now()): string[] {
    return dueIds(get('srs'), now);
  },

  seenIds(): Set<string> {
    return new Set(get('attempts').map((a) => a.q));
  },

  setConfidence(objectiveId: string, rating: number): void {
    set('confidence', { ...get('confidence'), [objectiveId]: rating });
  },

  setChecklist(id: string, done: boolean): void {
    const c = { ...get('checklist') };
    if (done) c[id] = true;
    else delete c[id];
    set('checklist', c);
  },

  setPrefs(p: Partial<Prefs>): void {
    set('prefs', { ...get('prefs'), ...p });
  },

  addSession(s: PracticeSession): void {
    set('sessions', [...get('sessions'), s].slice(-200));
  },

  activeExam(): ExamSession | null {
    return get('exam:active');
  },
  saveExam(s: ExamSession | null): void {
    if (s) set('exam:active', s);
    else remove('exam:active');
  },
  archiveExam(r: ExamRecord): void {
    const hist = get('exam:history').filter((h) => h.id !== r.id);
    set('exam:history', [...hist, r].slice(-MAX_EXAMS));
    remove('exam:active');
  },

  exportJSON(now = Date.now()): string {
    const data = snapshotAll();
    set('meta', { ...get('meta'), lastExportAt: now });
    return JSON.stringify({ app: 'ccdvf', version: SCHEMA_VERSION, exportedAt: now, data }, null, 2);
  },

  /**
   * Import a v1 or v2 export. Validates shape first; merges rather than
   * overwrites, so importing an old backup cannot wipe newer progress.
   */
  importJSON(json: string, now = Date.now()): { ok: true; summary: string } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: 'Not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Expected a JSON object.' };
    const p = parsed as Record<string, unknown>;
    const cur = snapshotAll();
    if (p.version === 1) {
      const add = mapV1(p as V1Data, now);
      writeAll(mergeInto(cur, add));
      return { ok: true, summary: `Imported v1 backup: ${add.attempts?.length ?? 0} misses, ${add['exam:history']?.length ?? 0} mocks.` };
    }
    if (p.version === 2 && p.app === 'ccdvf' && p.data && typeof p.data === 'object') {
      const d = p.data as Partial<StoreShape>;
      const bad = (k: string) => ({ ok: false as const, error: `Field "${k}" has the wrong shape.` });
      if (d.attempts && !Array.isArray(d.attempts)) return bad('attempts');
      if (d['exam:history'] && !Array.isArray(d['exam:history'])) return bad('exam:history');
      if (d.srs && (typeof d.srs !== 'object' || Array.isArray(d.srs))) return bad('srs');
      const attempts = (d.attempts ?? []).filter(
        (a): a is Attempt => !!a && typeof a.q === 'string' && typeof a.t === 'number' && (a.ok === 0 || a.ok === 1)
      );
      writeAll(
        mergeInto(cur, {
          attempts,
          srs: (d.srs ?? {}) as Deck,
          confidence: d.confidence ?? {},
          checklist: d.checklist ?? {},
          prefs: d.prefs ?? {},
          'exam:history': d['exam:history'] ?? [],
        })
      );
      return { ok: true, summary: `Imported ${attempts.length} attempts and ${(d['exam:history'] ?? []).length} exams.` };
    }
    return { ok: false, error: 'Unrecognised file: not a CCDV-F progress export.' };
  },

  reset(): void {
    for (const k of allKeys(NS)) remove(k.slice(NS.length));
    initialised = false;
  },
};
