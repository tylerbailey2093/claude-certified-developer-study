// Static endpoint: the full drawable bank as one JSON file. Islands fetch it
// at runtime (src/lib/bank/load.ts) and the service worker precaches it, so
// practice and the exam simulator work offline.
import type { APIRoute } from 'astro';
import { allQuestions } from '../../lib/bank/bank';

export const GET: APIRoute = () => {
  const items = allQuestions().filter((q) => q.status !== 'retired');
  return new Response(JSON.stringify({ version: 2, count: items.length, items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
