// Persisted shapes for store v2 (keys under ccdvf:v2:).
import type { Deck } from './srs';
import type { ExamRecord, ExamSession } from './exam';

export const SCHEMA_VERSION = 2;

export type Meta = { schema: number; createdAt: number; migratedFromV1?: number; lastExportAt?: number };

/** One answered question. Kept compact because there can be thousands. */
export type Attempt = {
  q: string; // question id
  o: string; // objective id
  d: number; // domain
  ok: 0 | 1;
  t: number; // epoch ms
  ms?: number; // time spent
  src: 'practice' | 'review' | 'exam' | 'objective' | 'v1';
  sid?: string; // session id
  conf?: 'sure' | 'unsure' | 'guess';
  diff?: number; // difficulty at time of attempt
};

export type Prefs = {
  theme?: 'dark' | 'light';
  motion?: 'auto' | 'on' | 'off';
  codeLang?: 'python' | 'typescript';
  examDate?: string; // YYYY-MM-DD
};

export type PracticeSession = {
  id: string;
  mode: string;
  label: string;
  startedAt: number;
  endedAt: number;
  correct: number;
  total: number;
  ms: number;
};

export type StoreShape = {
  meta: Meta;
  attempts: Attempt[];
  srs: Deck;
  confidence: Record<string, number>;
  checklist: Record<string, boolean>;
  prefs: Prefs;
  sessions: PracticeSession[];
  'exam:active': ExamSession | null;
  'exam:history': ExamRecord[];
};

export const KEYS: (keyof StoreShape)[] = [
  'meta',
  'attempts',
  'srs',
  'confidence',
  'checklist',
  'prefs',
  'sessions',
  'exam:active',
  'exam:history',
];

export const DEFAULTS: StoreShape = {
  meta: { schema: SCHEMA_VERSION, createdAt: 0 },
  attempts: [],
  srs: {},
  confidence: {},
  checklist: {},
  prefs: {},
  sessions: [],
  'exam:active': null,
  'exam:history': [],
};
