import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Exercise the production class with small rendering/platform fixtures, without a browser.
const source = readFileSync(new URL('../src/engine/tileLayer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const dependencies = `const AXIS_H=44,TILE_W=512,tileCount=()=>20,tileKey=(level,row,ix)=>level+'/'+row+'/'+ix,noteTile=()=>{};`;
const { TileLayer } = await import(`data:text/javascript;base64,${Buffer.from(dependencies + compiled.replace(/^import .+ from .+;$/gm, '')).toString('base64')}`);
function fixture() {
  const mounted = new Set();
  let wants = 0;
  let unsubscribed = 0;
  let receive;
  const host = { appendChild(canvas) { mounted.add(canvas); } };
  const document = { createElement() { return { dataset: {}, style: {}, remove() { mounted.delete(this); }, getContext() { return { setTransform() {}, clearRect() {}, drawImage() {} }; } }; } };
  const source = { subscribe(callback) { receive = callback; return () => { receive = undefined; unsubscribed++; }; }, want(requests) { wants++; for (const request of requests) receive?.({ key: request.key, ms: 1, image: new ImageBitmap() }); } };
  return { document, source, host, mounted, get wants() { return wants; }, get unsubscribed() { return unsubscribed; } };
}
test('disposing a populated tile layer releases canvases without remounting or requesting tiles', () => {
  const oldDocument = globalThis.document;
  const oldImageBitmap = globalThis.ImageBitmap;
  let closed = 0;
  globalThis.ImageBitmap = class { close() { closed++; } };
  const setup = fixture(); globalThis.document = setup.document;
  try {
    for (let index = 0; index < 5; index++) {
      const layer = new TileLayer(setup.source, { axis: setup.host, body: setup.host }, 1);
      layer.setRows(0, [{ id: 'axis', top: 0, height: 44, color: '#000', axis: true }, { id: 'incidents', top: 44, height: 200, color: '#000', axis: false }]);
      layer.update({ x: 0, y: 0, w: 800, h: 400 });
      assert.ok(setup.mounted.size > 0);
      const previousWants = setup.wants;
      layer.dispose();
      assert.equal(setup.mounted.size, 0, 'filter changes must not accumulate blank orphan canvases');
      assert.equal(setup.wants, previousWants, 'disposal must never ask a stopped source to paint');
    }
    assert.equal(setup.unsubscribed, 5);
    assert.ok(closed > 0, 'cached bitmap resources are released');
  } finally {
    globalThis.document = oldDocument; globalThis.ImageBitmap = oldImageBitmap;
  }
});
