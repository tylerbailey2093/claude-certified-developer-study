// Checks every external URL cited by objective frontmatter and question
// sources. Needs network egress, so it is informational in CI (weekly) and
// never blocks a deploy. Network failures are "inconclusive", not broken.
//
//   npx tsx scripts/check_external_links.ts
import { loadBank, readObjectives } from './lib/load.ts';

const urls = new Map<string, Set<string>>();
const add = (u: string, by: string) => urls.set(u, (urls.get(u) ?? new Set()).add(by));
for (const { fm } of readObjectives()) for (const s of (fm.sources as { url: string }[]) ?? []) add(s.url, `objective:${fm.id}`);
for (const q of loadBank()) for (const s of q.sources) add(s.url, `question:${q.id}`);

type Result = { url: string; status: number | 'error'; note?: string };
async function check(url: string): Promise<Result> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    return { url, status: r.status };
  } catch (e) {
    return { url, status: 'error', note: String((e as Error).message).slice(0, 80) };
  }
}

const list = [...urls.keys()];
const results: Result[] = [];
for (let i = 0; i < list.length; i += 6) results.push(...(await Promise.all(list.slice(i, i + 6).map(check))));
const broken = results.filter((r) => typeof r.status === 'number' && r.status >= 400);
const inconclusive = results.filter((r) => r.status === 'error');
console.log(`${list.length} URLs · ok ${results.length - broken.length - inconclusive.length} · broken ${broken.length} · inconclusive ${inconclusive.length}`);
for (const b of broken) console.log(`  ✗ ${b.status} ${b.url}  (${[...urls.get(b.url)!].slice(0, 3).join(', ')})`);
for (const b of inconclusive.slice(0, 10)) console.log(`  ? ${b.url}  ${b.note}`);
process.exit(broken.length ? 1 : 0);
