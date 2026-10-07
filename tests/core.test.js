const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');
const {QUESTION, response} = require('./helpers');

test('normalizes all whitespace and rejects empty or oversized selection', () => {
  assert.equal(core.normalizeSelection('  A\n\tB\u00a0 C  ').text, 'A B C');
  for (const input of ['', ' \n ', null]) assert.equal(core.normalizeSelection(input).code, 'NO_SELECTION');
  assert.equal(core.normalizeSelection('a'.repeat(8000)).ok, true);
  assert.equal(core.normalizeSelection('a'.repeat(8001)).code, 'TOO_LONG');
});
test('question parser assigns positions in display order, including reordered labels', () => {
  const result = core.parseQuestion('2 + 2?\nD. 5\nB. 4\nA. 3\nC. 6');
  assert.equal(result.ok, true);
  assert.deepEqual(result.options.map(o => o.label), ['1', '2', '3', '4']);
  assert.deepEqual(result.options.map(o => o.text), ['5', '4', '3', '6']);
  assert.equal(result.options[1].text, '4');
  assert.equal(core.parseQuestion('2+2? (A) 3 (B) 4 (C) 5 (D) 6').ok, true);
});
test('unlabeled choices receive positions from top to bottom without guessing boundaries', () => {
  for (const text of ['2 + 2?\n3\n4\n5\n6', '2 + 2?\r\n\r\n3\r\n\r\n4\r\n\r\n5\r\n\r\n6', '2 + 2?\n○ 3\n○ 4\n○ 5\n○ 6']) {
    const result = core.parseQuestion(text);
    assert.equal(result.ok, true);
    assert.equal(result.question, '2 + 2?');
    assert.deepEqual(result.options, [{label: '1', text: '3'}, {label: '2', text: '4'}, {label: '3', text: '5'}, {label: '4', text: '6'}]);
  }
  const wrapped = core.parseQuestion('Which\nplanet?\n\nEarth\nour planet\n\nMars\n\nVenus\n\nMercury');
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.options[0].text, 'Earth\nour planet');
  for (const text of ['2+2? 3 4 5 6', '2+2?\n3\n4\n5', '2+2?\n3\n4\n5\n6\n7', '2+2?\nA. 3\n4\n5\n6', '2+2?\n○\n4\n5\n6']) assert.equal(core.parseQuestion(text).code, 'MISSING_CHOICES');
});
test('numbered choices also use display order and reject duplicate or mixed labels', () => {
  const result = core.parseQuestion('Third planet? 4. Earth 2. Mars 1. Venus 3. Mercury');
  assert.equal(result.ok, true);
  assert.deepEqual(result.options.map(o => o.label), ['1', '2', '3', '4']);
  assert.equal(result.options[0].text, 'Earth');
  assert.equal(core.parseQuestion('Question 1: 2+2? 1. 3 2. 4 3. 5 4. 6').ok, true);
  for (const text of ['2+2? 1. 3 2. 4 3. 5 3. 6', '2+2? A. 3 2. 4 C. 5 D. 6']) assert.equal(core.parseQuestion(text).code, 'MISSING_CHOICES');
});
test('missing/ambiguous question or choices are rejected, never guessed', () => {
  for (const text of ['2+2?', QUESTION.replace('D. 6', ''), QUESTION.replace('D. 6', 'A. 6'), QUESTION.replace('D. 6', 'D.')]) assert.equal(core.parseQuestion(text).code, 'MISSING_CHOICES');
  assert.equal(core.parseQuestion('Câu 1:\nA. 3\nB. 4\nC. 5\nD. 6').code, 'MISSING_QUESTION');
});
test('only a complete, single literal answer is displayed', () => {
  for (const answer of ['1', '2', '3', '4']) assert.equal(core.parseAnswer(response(answer)), answer);
  for (const answer of ['A', 'B', 'C', 'D', '0', '5', '2.', '**2**', 'The answer is 2', '1, 2', '<b>2</b>']) assert.throws(() => core.parseAnswer(response(answer)), {code: 'BAD_ANSWER'});
  for (const answer of ['MISSING_QUESTION', 'MISSING_CHOICES', 'UNDETERMINED', 'MULTIPLE_ANSWERS']) assert.throws(() => core.parseAnswer(response(answer)), {code: answer});
  assert.throws(() => core.parseAnswer(response('2', 'MAX_TOKENS')), {code: 'INCOMPLETE_RESPONSE'});
  assert.throws(() => core.parseAnswer(response('2', 'SAFETY')), {code: 'BLOCKED'});
  assert.throws(() => core.parseAnswer({promptFeedback: {blockReason: 'SAFETY'}}), {code: 'BLOCKED'});
  assert.throws(() => core.parseAnswer({candidates: []}), {code: 'EMPTY_RESPONSE'});
  assert.throws(() => core.parseAnswer({candidates: [...response().candidates, ...response().candidates]}), {code: 'BAD_ANSWER'});
});
test('thought parts are not treated as final answers', () => {
  const data = response(); data.candidates[0].content.parts.unshift({thought: true, text: 'Thinking…'});
  assert.equal(core.parseAnswer(data), '2');
});
test('model IDs cannot alter the endpoint path', () => {
  assert.equal(core.validModel(core.DEFAULT_MODEL), true);
  for (const model of ['', 'models/other', 'a'.repeat(101), 'x?key=abc']) assert.equal(core.validModel(model), false);
});
