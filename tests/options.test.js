const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const {background, element, source, tick} = require('./helpers');
function options(initial = {}) {
  const b = background(initial);
  const ids = [...source('options/options.html').matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const nodes = Object.fromEntries(ids.map(id => [id, element()]));
  const ctx = {document: {getElementById: id => nodes[id], createElement: element}, chrome: {...b.ext, runtime: {...b.ext.runtime, sendMessage: b.send}}, crypto: {randomUUID}, TextDecoder, Uint8Array};
  vm.createContext(ctx);
  for (const file of ['src/core.js', 'src/documents.js', 'options/options.js']) vm.runInContext(source(file), ctx);
  const click = async id => { for (const fn of nodes[id].handlers.click || []) await fn(); };
  return {nodes, b, click};
}
test('saved key is never returned to options or echoed in the password field', async () => {
  const {nodes} = options({geminiApiKey: 'secret'}); await tick();
  assert.equal(nodes.key.value, ''); assert.match(nodes.status.textContent, /đã lưu/i);
  assert.equal(Object.values(nodes).some(n => n.textContent.includes('secret')), false);
});
test('save trims config, clears input and rejects invalid model', async () => {
  const {nodes, b, click} = options(); await tick();
  nodes.key.value = '  key  '; nodes.model.value = ' gemini-3.8-flash ';
  await click('save'); assert.equal(b.data.geminiApiKey, 'key'); assert.equal(nodes.key.value, '');
  nodes.model.value = 'bad/model'; await click('save'); assert.equal(b.data.geminiModel, 'gemini-3.8-flash');
  assert.match(nodes.status.textContent, /không hợp lệ/);
});
test('delete removes saved key and connection testing reports success', async () => {
  const {nodes, b, click} = options({geminiApiKey: 'key'}); await tick();
  await click('test-connection'); await tick(); assert.match(nodes['connection-status'].textContent, /thành công/);
  await click('delete-key'); assert.equal('geminiApiKey' in b.data, false);
});
test('pasted reference is stored and shown as text with read status', async () => {
  const {nodes, b, click} = options(); await tick();
  nodes['document-name'].value = '<script>name</script>'; nodes['document-text'].value = 'Reference content';
  await click('add-text');
  assert.equal(b.data.referenceDocuments[0].text, 'Reference content');
  assert.match(nodes.documents.children[0].children[0].textContent, /Đã đọc toàn bộ/);
  assert.equal(nodes['document-text'].value, '');
});
test('API error diagnostics are visible and stale loading is described as interrupted', async () => {
  const {nodes} = options({lookupStatus: {state: 'error', code: 'PERMISSION_DENIED', message: 'Thiếu quyền'}, connectionStatus: {state: 'loading', message: 'Loading', updatedAt: 1}});
  await tick(); assert.match(nodes['lookup-status'].textContent, /PERMISSION_DENIED/); assert.match(nodes['connection-status'].textContent, /gián đoạn/);
});
test('Groq key is saved privately, blank saves preserve it and delete affects Groq only', async () => {
  const {nodes,b,click}=options({geminiApiKey:'gemini-secret',groqApiKey:'groq-secret',providerMode:'auto'});await tick();
  assert.equal(nodes['groq-key'].value,'');assert.match(nodes['groq-key-status'].textContent,/đã lưu/);
  assert.equal(Object.values(nodes).some(n=>n.textContent.includes('groq-secret')),false);
  nodes['groq-key'].value=' replacement ';nodes['provider-mode'].value='groq';await click('save-groq');
  assert.equal(b.data.groqApiKey,'replacement');assert.equal(b.data.providerMode,'groq');assert.equal(nodes['groq-key'].value,'');
  await click('save');assert.equal(b.data.groqApiKey,'replacement');
  await click('delete-groq-key');assert.equal(b.data.groqApiKey,undefined);assert.equal(b.data.geminiApiKey,'gemini-secret');
});
test('Groq diagnostics and context distinguish usage from remaining quota', async()=>{
  const {nodes}=options({groqConnectionStatus:{state:'error',code:'INVALID_KEY',message:'Groq: key không hợp lệ'},lookupStatus:{state:'success',provider:'groq',message:'Groq: Đã nhận đáp án',context:{inputTokens:360,budget:16000,tokenMethod:'provider-usage'}}});await tick();
  assert.match(nodes['groq-connection-status'].textContent,/INVALID_KEY/);assert.match(nodes['context-status'].textContent,/không phải quota/);
});
