import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/engine/paint.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const platform = `const ROW_H=26,RADIUS={1:4,2:5.5,3:7},rowCenter=row=>20+26*row,CHIP_FONT='12px sans-serif';`;
const { drawChip } = await import(`data:text/javascript;base64,${Buffer.from(platform + compiled.replace(/^import .+ from .+;$/gm, '')).toString('base64')}`);
function fixture() {
  const operations = [];
  return { operations, beginPath() {}, arc() {}, moveTo() {}, arcTo() {}, closePath() {}, fillText() {},
    fill() { operations.push(['fill', this.fillStyle]); }, stroke() { operations.push(['stroke', this.strokeStyle]); } };
}
const style = { color: '#72549B', theme: { surface: '#ffffff', text: '#222222' }, title: 'advisory' };
test('dense unlabeled overview dots never erase previous dates with background outlines', () => {
  const ctx = fixture();
  for (let index = 0; index < 100; index++) {
    const x = 100 + index / 20;
    drawChip(ctx, { weight: 2, x, x0: x - 5.5, x1: x + 5.5, barEnd: x, row: 0, labeled: false }, style);
  }
  assert.equal(ctx.operations.length, 100);
  assert.ok(ctx.operations.every(([kind, color]) => kind === 'fill' && color === style.color));
});
test('isolated labeled chips preserve marker and label contrast', () => {
  const ctx = fixture();
  drawChip(ctx, { weight: 2, x: 100, x0: 94.5, x1: 200, barEnd: 100, row: 0, labeled: true }, style);
  assert.ok(ctx.operations.some(([kind, color]) => kind === 'stroke' && color === style.theme.surface));
  assert.ok(ctx.operations.some(([kind, color]) => kind === 'stroke' && color === style.color));
});
