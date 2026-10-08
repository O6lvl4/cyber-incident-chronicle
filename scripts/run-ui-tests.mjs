import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Collect all independent browser evidence; any failed suite still fails the gate.
const suites = ['ui-test.mjs', 'vulnerability-ui.mjs', 'classification-ui.mjs', 'classification-viewport-ui.mjs', 'mobile-webkit-ui.mjs', 'drawer-ui.mjs', 'list-navigation-ui.mjs', 'research-layout-ui.mjs', 'continuous-scroll-ui.mjs', 'sort-tabs-ui.mjs', 'package-severity-ui.mjs'];
const failures = [];
for (const name of suites) {
  console.log(`\n=== ${name} ===`);
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(name, import.meta.url))], { stdio: 'inherit', env: process.env });
  if (run.status !== 0) failures.push(name);
}
if (failures.length) {
  console.error(`Failed browser suites: ${failures.join(', ')}`);
  process.exitCode = 1;
}
