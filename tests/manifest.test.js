const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {source} = require('./helpers');
const manifest = JSON.parse(source('manifest.json'));
test('manifest auto-loads top-frame selection scripts and removes Alt+Q and injection permissions', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.commands, undefined);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
  assert.ok(manifest.host_permissions.includes('https://generativelanguage.googleapis.com/*'));
  assert.ok(manifest.host_permissions.includes('https://api.groq.com/*'));
  const files = [...manifest.content_scripts.flatMap(c => c.js), manifest.background.service_worker, ...manifest.background.scripts, manifest.options_ui.page];
  for (const file of files) assert.equal(fs.existsSync(path.join(__dirname, '..', file)), true, file);
});
test('service worker imports both shared modules in an initially empty global context', () => {
  const context = vm.createContext({});
  context.importScripts = (...files) => files.forEach(file => vm.runInContext(source('src/' + file), context));
  vm.runInContext(source(manifest.background.service_worker), context);
  assert.ok(context.ExplainCore); assert.ok(context.StudyDocuments); assert.ok(context.StudyBackground);
});
