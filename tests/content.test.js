const test = require('node:test');
const assert = require('node:assert/strict');
const {page, tick, QUESTION} = require('./helpers');

test('one completed drag sends once; intermediate and repeated selectionchange never send', async () => {
  const calls = [];
  const p = page(async message => { calls.push(message); return {ok: true, answer: '2'}; });
  p.fire('pointerdown');
  for (let i = 1; i <= 50; i++) { p.setText(QUESTION.slice(0, Math.ceil(QUESTION.length * i / 50))); p.fire('selectionchange'); }
  assert.equal(calls.length, 0);
  p.fire('pointerup');
  for (let i = 0; i < 10; i++) { p.fire('pointerup'); p.fire('selectionchange'); }
  p.flush(); await tick();
  assert.equal(calls.length, 1);
  assert.equal(p.overlay().shadow.children[0].textContent, '2');
  for (let i = 0; i < 10; i++) p.fire('selectionchange');
  assert.equal(calls.length, 1);
});
test('clearing after an answer removes it immediately, without another request', async () => {
  const calls = [];
  const p = page(async message => { calls.push(message); return {ok: true, answer: '2'}; });
  p.select(QUESTION); await tick();
  assert.equal(p.overlay().shadow.children[0].textContent, '2');
  p.setText(''); p.fire('selectionchange');
  assert.equal(p.overlay(), undefined);
  p.fire('pointerdown'); p.fire('pointerup'); p.flush(); await tick();
  assert.equal(calls.length, 1); assert.equal(p.overlay(), undefined);
});
test('clearing while pending prevents a late answer even after reselecting the same text', async () => {
  const pending = [];
  const p = page(() => new Promise(resolve => pending.push(resolve)));
  p.select(QUESTION);
  p.setText(''); p.fire('selectionchange'); assert.equal(p.overlay(), undefined);
  p.select(QUESTION); // Busy: cannot revive the old request or send twice.
  assert.equal(pending.length, 1);
  pending[0]({ok: true, answer: '2'}); await tick(); assert.equal(p.overlay(), undefined);
  p.select(QUESTION); assert.equal(pending.length, 2);
  pending[1]({ok: true, answer: '2'}); await tick();
  assert.equal(p.overlay().shadow.children[0].textContent, '2');
});
test('response checks the range even if selectionchange has not been delivered yet', async () => {
  let finish;
  const p = page(() => new Promise(resolve => { finish = resolve; }));
  p.select(QUESTION); p.setText('');
  finish({ok: true, answer: '2'}); await tick(); assert.equal(p.overlay(), undefined);
});
test('same text in a different range invalidates the previous answer', async () => {
  let finish, offset = 0;
  const p = page(() => new Promise(resolve => { finish = resolve; }));
  const getSelection = p.window.getSelection;
  const node = {parentElement: null};
  p.window.getSelection = () => ({...getSelection(), anchorNode: node, anchorOffset: offset, focusNode: node, focusOffset: offset + 10});
  p.select(QUESTION); offset = 100; p.fire('selectionchange');
  finish({ok: true, answer: '2'}); await tick(); assert.equal(p.overlay(), undefined);
});
test('clearing before deferred pointerup commits does not send', () => {
  const calls = [];
  const p = page(async message => { calls.push(message); });
  p.fire('pointerdown'); p.setText(QUESTION); p.fire('selectionchange'); p.fire('pointerup');
  p.setText(''); p.fire('selectionchange'); p.flush(); assert.equal(calls.length, 0);
});
test('unchanged clicks, synthetic gestures and duplicate installation never send again', async () => {
  const calls = [];
  const p = page(async message => { calls.push(message); return {ok: true, answer: '2'}; });
  p.run(); p.select(QUESTION); await tick();
  p.fire('pointerdown'); p.fire('pointerup'); p.flush();
  p.fire('pointerdown', {isTrusted: false}); p.setText('other'); p.fire('selectionchange'); p.fire('pointerup', {isTrusted: false}); p.flush();
  assert.equal(calls.length, 1); assert.equal(p.document.handlers.pointerup.length, 1);
});
test('new drag of the same range sends once without intermediate events; jitter does not', async () => {
  const calls = [];
  const p = page(async message => { calls.push(message); return {ok: true, answer: '2'}; });
  p.select(QUESTION); await tick();
  const drag = props => {
    p.fire('pointerdown', {clientX: 10, clientY: 10});
    p.fire('pointermove', {buttons: 1, clientX: 50, clientY: 30, ...props});
    p.fire('pointerup'); p.flush();
  };
  for (const props of [{clientX: 12, clientY: 10}, {isTrusted: false}, {pointerId: 2}, {buttons: 0}]) drag(props);
  assert.equal(calls.length, 1); drag({}); await tick(); assert.equal(calls.length, 2);
});
test('busy lookup ignores further gestures and never displays a stale reply', async () => {
  let finish;
  const calls = [];
  const p = page(message => { calls.push(message); return new Promise(resolve => { finish = resolve; }); });
  p.select(QUESTION); p.select(QUESTION); p.select(QUESTION.replace('2 + 2', '2 + 3'));
  assert.equal(calls.length, 1); assert.equal(p.overlay(), undefined);
  finish({ok: true, answer: '2'}); await tick(); assert.equal(p.overlay(), undefined);
});
test('new result replaces old result; Escape closes and prevents late reopening', async () => {
  const pending = [];
  const p = page(() => new Promise(resolve => pending.push(resolve)));
  p.select(QUESTION); pending[0]({ok: true, answer: '2'}); await tick(); const old = p.overlay();
  p.select(QUESTION.replace('2 + 2', '2 + 3')); assert.equal(p.overlay(), undefined);
  pending[1]({ok: true, answer: '3'}); await tick();
  assert.notEqual(p.overlay(), old); assert.equal(p.overlay().shadow.children[0].textContent, '3');
  p.fire('keydown', {key: 'Escape'}); assert.equal(p.overlay(), undefined);
  p.select(QUESTION); p.fire('keydown', {key: 'Escape'});
  pending[2]({ok: true, answer: '2'}); await tick(); assert.equal(p.overlay(), undefined);
});
test('gestures started busy cannot send when they end after a response or error', async () => {
  for (const outcome of [{ok: true, answer: '2'}, {ok: false, code: 'NETWORK_ERROR'}, new Error('channel closed')]) {
    const pending = [];
    const p = page(message => message.type === 'CONTENT_ERROR' ? Promise.resolve({ok: true}) : new Promise((resolve, reject) => pending.push({resolve, reject})));
    p.select(QUESTION); p.fire('pointerdown'); p.setText(''); p.fire('selectionchange');
    if (outcome instanceof Error) pending[0].reject(outcome); else pending[0].resolve(outcome);
    await tick();
    p.setText(QUESTION); p.fire('selectionchange'); p.fire('pointerup'); p.flush();
    assert.equal(pending.length, 1); assert.equal(p.overlay(), undefined);
    p.select(QUESTION); assert.equal(pending.length, 2);
    pending[1].resolve({ok: true, answer: '2'}); await tick();
  }
});
test('reply preserves input focus and the still-present page selection', async () => {
  let finish;
  const p = page(() => new Promise(resolve => { finish = resolve; }));
  const focused = {tagName: 'TEXTAREA'};
  p.select(QUESTION); p.document.activeElement = focused;
  finish({ok: true, answer: '2'}); await tick();
  assert.equal(p.document.activeElement, focused);
  assert.equal(p.window.getSelection().toString(), QUESTION);
  assert.equal(p.overlay().shadow.children[0].textContent, '2');
});
test('one held Shift gesture sends only on completion, ignoring key repeats', async () => {
  let calls = 0;
  const p = page(async () => { calls++; return {ok: true, answer: '2'}; });
  p.fire('keydown', {key: 'ArrowRight', shiftKey: true}); p.setText(QUESTION); p.fire('selectionchange');
  p.fire('keyup', {key: 'ArrowRight'}); p.fire('keydown', {key: 'ArrowRight', shiftKey: true, repeat: true});
  p.flush(); assert.equal(calls, 0);
  p.fire('keyup', {key: 'Shift'}); p.flush(); await tick(); assert.equal(calls, 1);
  p.setText(''); p.fire('selectionchange'); assert.equal(p.overlay(), undefined);
});
test('Ctrl/Cmd+A sends automatically on selection key release', async () => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    let calls = 0;
    const p = page(async () => { calls++; return {ok: true, answer: '2'}; });
    p.fire('keydown', {key: 'a', [modifier]: true}); p.setText(QUESTION); p.fire('selectionchange');
    p.fire('keyup', {key: 'a'}); p.flush(); await tick(); assert.equal(calls, 1);
  }
});
test('form fields are excluded and errors, explanations and HTML never appear', async () => {
  let calls = 0;
  const field = page(async () => { calls++; }); field.document.activeElement = {tagName: 'TEXTAREA'};
  field.select(QUESTION); assert.equal(calls, 0);
  for (const result of [{ok: false, message: 'PRIVATE ERROR'}, {ok: true, answer: 'B'}, {ok: true, answer: '0'}, {ok: true, answer: '5'}, {ok: true, answer: '<b>2</b>'}, {ok: true, answer: 'Answer: 2'}]) {
    const p = page(async () => result); p.select(QUESTION); await tick(); assert.equal(p.overlay(), undefined);
  }
});
test('result remains fixed lower-left transparent unframed black text', async () => {
  const p = page(async () => ({ok: true, answer: '1'})); p.select(QUESTION); await tick();
  const host = p.overlay();
  for (const [key, value] of Object.entries({position: 'fixed', left: '16px', bottom: '16px', background: 'transparent', border: 'none', 'box-shadow': 'none'})) assert.deepEqual(host.style[key], {value, priority: 'important'});
  assert.match(host.shadow.children[0].style.cssText, /color:#000/); assert.equal(host.shadow.children.length, 1);
});
test('oversized selection reports a local error without a lookup', () => {
  const calls = [];
  const p = page(async message => { calls.push(message); return {ok: true}; }); p.select('x'.repeat(8001));
  assert.equal(calls.length, 1); assert.equal(calls[0].type, 'CONTENT_ERROR'); assert.equal(calls[0].code, 'TOO_LONG');
  assert.equal(p.overlay(), undefined);
});
