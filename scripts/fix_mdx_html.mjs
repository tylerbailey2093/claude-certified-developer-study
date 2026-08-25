#!/usr/bin/env node
// Repair pass for agent-authored .mdx content. Two problems, both from the
// legacy guide's hand-rolled callout convention tripping MDX's micromark
// HTML-block parser (which is far stricter about nesting/line-boundaries
// than a browser's HTML parser):
//
// 1. Dense single-line HTML (a whole <table> or <div> on one line) —
//    give every block-level tag its own line.
// 2. <div class="box KEY"><div class="bt">TITLE</div><p>...</p></div>
//    callouts — MDX's paragraph/HTML-block boundary tracking breaks on this
//    nesting shape reliably. Converted to native Markdown blockquotes, which
//    MDX handles natively with no ambiguity, and theme.css already styles
//    blockquote to look like a callout.
//
// Idempotent — safe to re-run as more agent output lands.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../src/content/objectives');
const BLOCK_TAGS = 'div|table|thead|tbody|tr|td|th|h3|h4|h5|ul|ol|li|section|p';
const lineSplitRe = new RegExp(`(<\\/?(?:${BLOCK_TAGS})(?:\\s[^>]*)?>)(?=<)`, 'g');

const TITLE_WORDS = { key: 'Key point', warn: 'Watch out', tip: 'Tip', note: 'Note', good: 'Good', info: 'Info' };

function convertBoxes(src) {
  const boxRe = /<div class="box (\w+)">\s*<div class="bt">\s*(?:<span[^>]*>[^<]*<\/span>)?\s*([^<]*?)\s*<\/div>\s*([\s\S]*?)<\/div>/g;
  return src.replace(boxRe, (_m, kind, title, inner) => {
    const cleanTitle = (title || TITLE_WORDS[kind] || 'Note').trim();
    let body = inner
      .replace(/<\/?p>/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n> \n> ');
    return `> **${cleanTitle}**\n> \n> ${body}\n`;
  });
}

let touched = 0;
for (const file of fs.readdirSync(DIR)) {
  if (!file.endsWith('.mdx')) continue;
  const p = path.join(DIR, file);
  const before = fs.readFileSync(p, 'utf-8');
  let after = convertBoxes(before);
  // Bare <p>/</p> around raw-HTML prose is a recurring MDX/micromark paragraph-
  // boundary trip. Markdown doesn't need them at all -- blank-line-separated
  // text is already a paragraph -- so strip the tags and let blank lines do
  // the job instead of fighting the parser's HTML-block heuristics.
  after = after.replace(/<p>\s*/g, '\n\n').replace(/\s*<\/p>/g, '\n\n');
  after = after.replace(lineSplitRe, '$1\n');
  after = after.replace(/\n{3,}/g, '\n\n');
  if (after !== before) {
    fs.writeFileSync(p, after);
    touched++;
  }
}
console.log(`reformatted ${touched} file(s)`);
