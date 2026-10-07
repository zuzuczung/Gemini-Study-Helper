const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const QUESTION = 'What is 2 + 2?\nA. 3\nB. 4\nC. 5\nD. 6';
const response = (text = '2', finishReason = 'STOP') => ({candidates: [{finishReason, content: {parts: [{text}]}}]});
function mockFetch(overrides = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({url, init});
    const suffix = url.includes(':') ? url.slice(url.lastIndexOf(':')) : '';
    const data = url.endsWith(':generateContent') ? response() : url.endsWith(':countTokens') ? {totalTokens: 200} : {inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent']};
    if (overrides[suffix]) return overrides[suffix](url, init);
    return {ok: true, json: async () => data};
  };
  fn.calls = calls;
  return fn;
}
function background(initial = {}, fetcher = mockFetch()) {
  const data = {...initial};
  const messages = [];
  let listener;
  let action;
  const storageListeners = [];
  const ext = {
    runtime: {id: 'our-extension', getURL: p => 'chrome-extension://our-extension/' + p, openOptionsPage: async () => {}, onMessage: {addListener(fn) { listener = fn; }}},
    action: {onClicked: {addListener(fn) { action = fn; }}, setBadgeText: async value => { messages.push(value); }, setTitle: async () => {}},
    storage: {onChanged: {addListener(fn) { storageListeners.push(fn); }}, local: {
      setAccessLevel: async value => { ext.access = value; },
      get: async keys => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(k => k in data).map(k => [k, data[k]])),
      set: async values => { Object.assign(data, values); storageListeners.forEach(fn => fn(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, {newValue: v}])), 'local')); },
      remove: async key => { delete data[key]; }
    }}
  };
  const context = {chrome: ext, fetch: fetcher, AbortController, TextEncoder, setTimeout, clearTimeout};
  vm.createContext(context);
  for (const file of ['src/core.js', 'src/documents.js', 'src/background.js']) vm.runInContext(source(file), context);
  const optionsSender = {id: 'our-extension', url: ext.runtime.getURL('options/options.html'), tab: {id: 9}};
  const contentSender = {id: 'our-extension', url: 'https://study.example/page', tab: {id: 1}, frameId: 0, documentId: 'doc1'};
  const send = (message, sender = optionsSender) => new Promise(resolve => { if (listener(message, sender, resolve) !== true) resolve(undefined); });
  return {api: context.StudyBackground, context, listener, send, data, ext, fetcher, contentSender, action};
}
function element(tag = 'div') {
  return {tagName: tag.toUpperCase(), children: [], value: '', textContent: '', handlers: {}, disabled: false,
    style: {setProperty(name, value, priority) { this[name] = {value, priority}; }},
    append(...nodes) { this.children.push(...nodes); nodes.forEach(n => { n.parent = this; n.isConnected = true; }); },
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.isConnected = false; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); },
    attachShadow() { this.shadow = element('shadow'); return this.shadow; }
  };
}
function page(sendMessage) {
  const document = element('document');
  document.documentElement = element('html');
  document.createElement = element;
  document.activeElement = null;
  let text = '';
  let now = 0;
  const timers = [];
  const window = element('window');
  window.getSelection = () => ({toString: () => text});
  const ctx = {document, window, chrome: {runtime: {sendMessage}}, crypto: {randomUUID}, Date: {now: () => now}, setTimeout: fn => timers.push(fn)};
  vm.createContext(ctx);
  vm.runInContext(source('src/core.js'), ctx);
  const run = () => vm.runInContext(source('src/content.js'), ctx);
  const fire = (name, props = {}) => { for (const fn of document.handlers[name] || []) fn({isTrusted: true, button: 0, pointerId: 1, ...props}); };
  const flush = () => { while (timers.length) timers.shift()(); };
  const select = (value, at = now, repeats = 5) => {
    now = at;
    fire('pointerdown');
    text = '';
    fire('selectionchange');
    for (let i = 0; i < repeats; i++) { text = value.slice(0, Math.ceil(value.length * (i + 1) / repeats)); fire('selectionchange'); }
    fire('pointerup'); flush();
  };
  run();
  return {document, window, fire, select, flush, run, setText: value => { text = value; }, advance: value => { now = value; }, overlay: () => document.documentElement.children[0]};
}
module.exports = {source, tick, QUESTION, response, mockFetch, background, element, page};
