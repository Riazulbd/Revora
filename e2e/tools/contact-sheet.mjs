#!/usr/bin/env node
/**
 * Pairs each artboard with the screenshot of the screen it specifies.
 *
 * The point is that nobody has to take an implementer's word for it. A board
 * and a screen sit side by side at the same height, captioned, and the reader
 * decides whether they match. Anything with no screenshot is rendered as an
 * explicit gap rather than quietly omitted — an untested screen must look
 * different from a passing one.
 *
 * Usage: node e2e/tools/contact-sheet.mjs <shots-dir> <out.html>
 *   shots-dir holds <board-slug>.png files named after design/redesign/boards.
 */
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const [, , shotsDir = 'design/redesign/compare/shots', out = 'design/redesign/compare/contact-sheet.html'] = process.argv;
const BOARDS = 'design/redesign/boards';

const boards = readdirSync(BOARDS).filter((f) => f.endsWith('.png')).sort();
const shots = existsSync(shotsDir) ? new Set(readdirSync(shotsDir).filter((f) => f.endsWith('.png'))) : new Set();

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const groupOf = (n) => n.split('--')[0].replace(/-/g, ' ');

let paired = 0;
const groups = new Map();
for (const board of boards) {
  const has = shots.has(board);
  if (has) paired += 1;
  const g = groupOf(board);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push({ board, has });
}

const caption = (n) =>
  basename(n, '.png').split('--')[1]?.replace(/^\d+-/, '').replace(/-/g, ' ') ?? n;

let html = `<!doctype html><meta charset="utf-8"><title>Revora 2.7 — board vs app</title>
<style>
 body{margin:0;padding:28px;background:#F5F6F8;color:#14171B;
      font:500 13px/1.5 'Google Sans Flex',-apple-system,system-ui,sans-serif}
 h1{font-size:26px;font-weight:800;margin:0 0 4px}
 .lede{color:#878E98;margin:0 0 22px}
 .tally{display:inline-block;background:#fff;border:1px solid #E9EBEF;border-radius:12px;
        padding:10px 14px;margin-bottom:26px}
 h2{font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#F4511E;
    margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid #E9EBEF}
 .row{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #E9EBEF;
      border-radius:16px;padding:14px;margin-bottom:12px}
 .cap{flex:0 0 150px;font-weight:700;font-size:12.5px}
 .cap small{display:block;color:#878E98;font-weight:500;margin-top:3px}
 img{height:520px;border-radius:10px;border:1px solid #E9EBEF;background:#fff}
 .pane{display:flex;flex-direction:column;gap:5px}
 .tag{font:700 9.5px/1 sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#878E98}
 .missing{height:520px;width:250px;border:1.5px dashed #E9EBEF;border-radius:10px;display:flex;
          align-items:center;justify-content:center;color:#878E98;font-size:12px;text-align:center;padding:16px}
</style>
<h1>Revora 2.7 — artboard vs app</h1>
<p class="lede">Left is the approved design. Right is the build, captured on the emulator. Judge each pair yourself.</p>
<div class="tally"><b>${paired}</b> of <b>${boards.length}</b> artboards captured${paired < boards.length ? ` · <b>${boards.length - paired}</b> not yet reached` : ''}</div>
`;

for (const [g, items] of groups) {
  html += `<h2>${g}</h2>`;
  for (const { board, has } of items) {
    html += `<div class="row">
      <div class="cap">${caption(board)}<small>${board}</small></div>
      <div class="pane"><span class="tag">Artboard</span><img src="${b64(join(BOARDS, board))}"></div>
      <div class="pane"><span class="tag">App 2.7</span>${
        has ? `<img src="${b64(join(shotsDir, board))}">` : `<div class="missing">not captured<br>— screen not reached</div>`
      }</div>
    </div>`;
  }
}

writeFileSync(out, html);
console.log(`${paired}/${boards.length} pairs -> ${out}`);
