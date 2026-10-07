const test = require('node:test');
const assert = require('node:assert/strict');
const {page, background, mockFetch, response, tick, QUESTION} = require('./helpers');

test('one drag runs content → messaging → Gemini → overlay; deselection removes the answer', async () => {
  const finish = [];
  const fetcher = mockFetch({':generateContent': async () => new Promise(resolve => finish.push(resolve))});
  const b = background({geminiApiKey: 'fake-test-key'}, fetcher);
  const messages = [];
  const p = page(message => { messages.push(message); return b.send(message, b.contentSender); });
  p.select(QUESTION, 0, 60); await tick();
  assert.equal(messages.length, 1); assert.equal(finish.length, 1); assert.equal(b.data.lookupStatus.state, 'loading');
  for (let i = 0; i < 30; i++) { p.fire('selectionchange'); p.fire('pointerup'); }
  p.flush(); assert.equal(messages.length, 1);
  finish[0]({ok: true, json: async () => response('2')}); await tick();
  assert.equal(p.overlay().shadow.children[0].textContent, '2'); assert.equal(b.data.lookupStatus.state, 'success');
  p.setText(''); p.fire('selectionchange'); assert.equal(p.overlay(), undefined);
  p.select('Third planet? D. Earth B. Mars A. Venus C. Mercury', 400); await tick();
  assert.equal(messages.length, 2); assert.equal(finish.length, 2);
  const request = JSON.parse(fetcher.calls.at(-1).init.body);
  assert.deepEqual(JSON.parse(request.contents[0].parts[0].text).choices, [
    {label: '1', text: 'Earth'}, {label: '2', text: 'Mars'}, {label: '3', text: 'Venus'}, {label: '4', text: 'Mercury'}
  ]);
  finish[1]({ok: true, json: async () => response('1')}); await tick();
  assert.equal(p.overlay().shadow.children[0].textContent, '1');
  assert.equal(fetcher.calls.filter(c => c.url.endsWith(':generateContent')).length, 2);
});
test('unlabeled selection sends four positional choices and displays one numeric answer', async () => {
  const b = background({geminiApiKey: 'fake-test-key'});
  const p = page(message => b.send(message, b.contentSender));
  p.select('2 + 2?\n3\n4\n5\n6', 0, 40); await tick();
  assert.equal(p.overlay().shadow.children[0].textContent, '2');
  const generations = b.fetcher.calls.filter(c => c.url.endsWith(':generateContent'));
  assert.equal(generations.length, 1);
  const request = JSON.parse(generations[0].init.body);
  assert.deepEqual(JSON.parse(request.contents[0].parts[0].text).choices.map(o => o.label), ['1', '2', '3', '4']);
  assert.match(request.systemInstruction.parts[0].text, /Không trả A\/B\/C\/D/);
  p.setText(''); p.fire('selectionchange'); assert.equal(p.overlay(), undefined);
});
test('deselection during background flow suppresses the late answer without another generation', async () => {
  let finish;
  const fetcher = mockFetch({':generateContent': async () => new Promise(resolve => { finish = resolve; })});
  const b = background({geminiApiKey: 'fake-test-key'}, fetcher);
  const p = page(message => b.send(message, b.contentSender));
  p.select(QUESTION); await tick(); p.setText(''); p.fire('selectionchange'); assert.equal(p.overlay(), undefined);
  finish({ok: true, json: async () => response('2')}); await tick(); assert.equal(p.overlay(), undefined);
  assert.equal(b.data.lookupStatus.state, 'success');
  assert.equal(fetcher.calls.filter(c => c.url.endsWith(':generateContent')).length, 1);
});
