// One question rendered as a notebook cell. Fully controlled: the parent owns
// the selection, the reveal state and the strike-outs, so the same component
// serves practice (instant feedback), the exam (no feedback) and review.
import { Fragment, type ReactNode } from 'react';
import type { Question } from '../lib/bank/schema';
import { domainName, OBJECTIVE_BY_ID } from '../lib/blueprint';

export type CellMode = 'answer' | 'revealed';

type Props = {
  q: Question;
  order: string[];
  chosen: string[];
  onToggle?: (optionId: string) => void;
  mode: CellMode;
  struck?: string[];
  onStrike?: (optionId: string) => void;
  index?: number;
  total?: number;
  showMeta?: boolean;
  base?: string;
  footer?: ReactNode;
  /** Exam mode hides correctness even after selection. */
  exam?: boolean;
};

const LETTERS = 'ABCDEF';
// Legacy explanations name options by their original letter. Until those are
// rewritten, the revealed view labels options by original letter so the
// explanation still lines up (never before answering: original positions leak).
const POSITIONAL = /\b(option|answer|choice)s?\s+\(?[A-F]\)?\b|\b[A-F] and [A-F]\b|\boption \d\b/i;

function highlightCue(stem: string, cue: string): ReactNode {
  if (!cue) return stem;
  const i = stem.toLowerCase().indexOf(cue.toLowerCase());
  if (i < 0) return stem;
  return (
    <>
      {stem.slice(0, i)}
      <mark className="cue">{stem.slice(i, i + cue.length)}</mark>
      {stem.slice(i + cue.length)}
    </>
  );
}

export default function QuestionCell({
  q,
  order,
  chosen,
  onToggle,
  mode,
  struck = [],
  onStrike,
  index,
  total,
  showMeta = true,
  base = '/',
  footer,
  exam = false,
}: Props) {
  const revealed = mode === 'revealed';
  const byId = new Map(q.options.map((o) => [o.id, o]));
  const legacyLabels = revealed && POSITIONAL.test(q.explanation);
  const obj = OBJECTIVE_BY_ID.get(q.objective);
  const correctSet = new Set(q.answer);
  const ok = revealed && chosen.length === q.answer.length && chosen.every((c) => correctSet.has(c));
  const inputType = q.type === 'multi' ? 'checkbox' : 'radio';

  return (
    <article className="q cell" data-d={q.domain} aria-labelledby={`stem-${q.id}`}>
      <div className="cell-bar">
        <span className="cell-n">{index !== undefined ? `[${index + 1}${total ? `/${total}` : ''}]` : '[ ]'}</span>
        <span className="cell-lang">
          <span>%quiz</span>
        </span>
        {showMeta && (
          <span className="q-meta">
            <span className="tag tag-dom">D{q.domain}</span>
            {obj && (
              <a className="q-obj" href={`${base}objective/${obj.id}/`} tabIndex={exam ? -1 : 0}>
                {obj.name}
              </a>
            )}
          </span>
        )}
        {revealed && !exam && (
          <span className={`tag ${ok ? 'tag-ok' : 'tag-bad'} q-verdict`}>{ok ? '✓ correct' : '✗ incorrect'}</span>
        )}
      </div>

      <div className="q-body">
        <p className="q-stem" id={`stem-${q.id}`}>
          {revealed ? highlightCue(q.stem, q.cue) : q.stem}
        </p>
        {q.type === 'multi' && !/select (two|three|2|3)/i.test(q.stem) && (
          <p className="q-select">Select {q.select === 2 ? 'two' : q.select === 3 ? 'three' : q.select}.</p>
        )}

        <div className="q-opts" role={q.type === 'multi' ? 'group' : 'radiogroup'} aria-labelledby={`stem-${q.id}`}>
          {order.map((id, pos) => {
            const o = byId.get(id);
            if (!o) return null;
            const isChosen = chosen.includes(id);
            const isRight = correctSet.has(id);
            const isStruck = struck.includes(id);
            const cls = [
              'q-opt',
              isChosen && 'is-chosen',
              revealed && isRight && 'is-right',
              revealed && isChosen && !isRight && 'is-wrong',
              isStruck && !revealed && 'is-struck',
            ]
              .filter(Boolean)
              .join(' ');
            const label = legacyLabels ? id.toUpperCase() : LETTERS[pos];
            return (
              <div className={cls} key={id}>
                <label className="q-opt-main">
                  <input
                    type={inputType}
                    name={`q-${q.id}`}
                    checked={isChosen}
                    disabled={revealed || !onToggle}
                    onChange={() => onToggle?.(id)}
                  />
                  <span className="q-key" aria-hidden="true">
                    {label}
                  </span>
                  <span className="q-text">{o.text}</span>
                  {revealed && (isRight || isChosen) && (
                    <span className="sr-only">{isRight ? ' (correct answer)' : ' (your answer, incorrect)'}</span>
                  )}
                </label>
                {onStrike && !revealed && (
                  <button
                    type="button"
                    className="q-strike"
                    aria-pressed={isStruck}
                    aria-label={`${isStruck ? 'Restore' : 'Eliminate'} option ${LETTERS[pos]}`}
                    title={isStruck ? 'Restore option' : 'Eliminate option'}
                    onClick={() => onStrike(id)}
                  >
                    {isStruck ? '↺' : '⊘'}
                  </button>
                )}
                {revealed && o.why && (
                  <p className="q-why">
                    <b>{isRight ? 'Why it is right: ' : 'Why it fails: '}</b>
                    {o.why}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {revealed && (
        <div className="cell-out q-explain">
          <div className="cell-out-label">
            Explanation
            {q.pattern !== 'unclassified' && <span className="tag">{q.pattern}</span>}
            {q.cue && <span className="tag tag-accent">cue: {q.cue}</span>}
          </div>
          <p>{q.explanation}</p>
          {legacyLabels && (
            <p className="faint q-note">Letters in this explanation refer to the option labels shown above.</p>
          )}
          {q.sources.length > 0 && (
            <p className="q-sources">
              {q.sources.map((s, i) => (
                <Fragment key={s.url}>
                  {i > 0 && ' · '}
                  <a href={s.url} target="_blank" rel="noopener">
                    {s.label}
                  </a>
                </Fragment>
              ))}
            </p>
          )}
          <p className="faint q-dom">
            {domainName(q.domain)} · {obj?.name}
          </p>
        </div>
      )}
      {footer}
    </article>
  );
}
