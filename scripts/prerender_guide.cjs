/**
 * Pre-render the legacy single-file guide into a no-JS-safe snapshot.
 *
 * Why: the guide builds its entire domain nav, all 8 domain content sections,
 * the readiness checklist and the question bank in JavaScript at runtime. Any
 * viewer that does not execute JS (phone file previews, in-app webviews, some
 * offline readers, Reader modes) shows an empty DOMAINS nav and no study
 * content at all. Pre-rendering puts that content in the HTML itself.
 *
 * The output still ships the original <script>, so a browser that DOES run JS
 * rebuilds everything and the page stays fully interactive. That is safe
 * because the render paths are idempotent: they clear their containers first.
 *
 * The quiz is transformed to a readable Q&A bank (correct option marked,
 * explanation shown) so it is still useful without JS. With JS on, build()
 * wipes and replaces it with the interactive quiz.
 *
 * Usage: node scripts/prerender_guide.cjs <input.html> <output.html>
 */
const {chromium} = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function main() {
  const [inArg, outArg] = process.argv.slice(2);
  if (!inArg || !outArg) {
    console.error('usage: node scripts/prerender_guide.cjs <input.html> <output.html>');
    process.exit(2);
  }
  const inPath = path.resolve(inArg);
  const outPath = path.resolve(outArg);
  if (!fs.existsSync(inPath)) {
    console.error('input not found: ' + inPath);
    process.exit(2);
  }

  const launchOpts = fs.existsSync(CHROME) ? {executablePath: CHROME} : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + inPath, {waitUntil: 'load'});
  await page.waitForFunction(
    () => document.querySelectorAll('section[id^="dom"]').length >= 8,
    null,
    {timeout: 20000}
  );

  const html = await page.evaluate(() => {
    // Freeze the quiz into a readable answer key for no-JS readers.
    document.querySelectorAll('.q').forEach(card => {
      const ex = card.querySelector('.ex');
      if (ex) ex.hidden = false;
    });

    // Without JS the narrow-screen sidebar is stuck off-canvas (nothing can
    // toggle it). Marking the root .nojs lets CSS drop it back into normal
    // flow; an inline script removes the class the moment JS does run, so
    // JS-capable browsers keep the off-canvas drawer.
    const css = document.createElement('style');
    css.textContent =
      '@media(max-width:980px){' +
      'html.nojs aside{position:static;transform:none;height:auto;width:auto;' +
      'margin:0 0 18px;border-radius:0 0 22px 22px}' +
      'html.nojs .mtoggle{display:none}' +
      '}';
    document.head.appendChild(css);

    const un = document.createElement('script');
    un.textContent = "document.documentElement.classList.remove('nojs')";
    document.head.insertBefore(un, document.head.firstChild);

    document.documentElement.className =
      (document.documentElement.className + ' nojs').trim();

    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });

  if (errors.length) {
    console.error('page errors during render:');
    errors.forEach(e => console.error('  ' + e));
    await browser.close();
    process.exit(1);
  }

  fs.writeFileSync(outPath, html, 'utf8');
  await browser.close();

  // Report what actually made it into the static file.
  const counts = {
    domainSections: (html.match(/<section id="dom\d"/g) || []).length,
    navLinks: (html.match(/class="nl"/g) || []).length,
    quizCards: (html.match(/class="q"/g) || []).length,
  };
  console.log('wrote ' + outPath);
  console.log('  domain sections: ' + counts.domainSections);
  console.log('  nav links:       ' + counts.navLinks);
  console.log('  quiz cards:      ' + counts.quizCards);
  console.log('  size:            ' + (fs.statSync(outPath).size / 1024).toFixed(0) + ' KB');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
