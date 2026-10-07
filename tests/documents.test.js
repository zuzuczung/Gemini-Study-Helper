const test = require('node:test');
const assert = require('node:assert/strict');
const docs = require('../src/documents');
const file = (name, bytes) => ({name, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer});
const pdfFile = file('file.pdf', [1]);
function pdfLoader(pages) {
  return async () => ({getDocument: () => ({promise: Promise.resolve({numPages: pages.length, getPage: async i => ({getTextContent: async () => ({items: [{str: pages[i - 1], hasEOL: true}]}), cleanup() {}})}), destroy: async () => {}})});
}
test('TXT imports all UTF-8 content and rejects invalid encoding, empty, oversized or unsupported files', async () => {
  const text = 'Tiếng Việt\nđầy đủ';
  assert.equal((await docs.readFile(file('note.txt', Buffer.from(text)))).text, text);
  await assert.rejects(docs.readFile(file('bad.txt', [0xff])), /UTF-8/);
  await assert.rejects(docs.readFile(file('empty.txt', [])), /Không tìm thấy/);
  await assert.rejects(docs.readFile(file('note.docx', [1])), /PDF hoặc TXT/);
  await assert.rejects(docs.readFile({name: 'large.pdf', size: 11 * 1024 * 1024}), /10 MB/);
});
test('PDF text extraction reports every readable/unreadable page and OCR limitation', async () => {
  const result = await docs.readFile(pdfFile, pdfLoader(['Page one', '', 'Page three']));
  assert.equal(result.pages, 3); assert.deepEqual(result.emptyPages, [2]);
  assert.match(result.readStatus, /2\/3/); assert.match(result.readStatus, /OCR/);
  assert.match(result.text, /Page one/); assert.match(result.text, /Page three/);
  await assert.rejects(docs.readFile(pdfFile, pdfLoader(['', ''])), /Chưa hỗ trợ OCR/);
  await assert.rejects(docs.readFile(pdfFile, pdfLoader(Array(201).fill('Text'))), /200 trang/);
});
test('oversized extracted content is rejected, never truncated', async () => {
  await assert.rejects(docs.readFile(pdfFile, pdfLoader(['a'.repeat(300001)])), /300.000/);
  assert.throws(() => docs.checkText('x'.repeat(300001)), /300.000/);
});
test('chunks preserve exact full text; reference selection stays in budget with explicit coverage', () => {
  const text = 'alpha beta '.repeat(10000);
  assert.equal(docs.chunks(text).map(c => c.text).join(''), text);
  const doc = {id: '1', name: 'Large reference', text};
  const result = docs.selectReferences([doc], 'alpha', 4000);
  assert.ok(result.excerpts.reduce((sum, chunk) => sum + chunk.text.length, 0) <= 4000);
  assert.ok(result.report[0].usedChunks.length < result.report[0].totalChunks);
  for (const chunk of result.excerpts) assert.equal(chunk.text, text.slice(chunk.start, chunk.end));
});
test('relevance selects matching sections and reports unused documents', () => {
  const result = docs.selectReferences([{id: '1', name: 'No match', text: 'unrelated '.repeat(3000)}, {id: '2', name: 'Math', text: 'Addition gives four.'}], 'addition', 2000);
  assert.equal(result.excerpts.length, 1); assert.equal(result.excerpts[0].source, '2');
  assert.equal(result.report[0].usedChars, 0);
});
test('library limits prevent storage overflow', () => {
  assert.throws(() => docs.validateLibrary(Array.from({length: 13}, (_, i) => ({id: String(i), name: 'Doc', text: 'x'}))), /12/);
  assert.throws(() => docs.validateLibrary(Array.from({length: 4}, (_, i) => ({id: String(i), name: 'Doc', text: 'x'.repeat(300000)}))), /1.000.000/);
});
