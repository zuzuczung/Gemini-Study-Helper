// Browser-only fixture. No real API calls or real keys; never included in manifest.
const originalFetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.groq.com/')) return {ok: init.headers.Authorization !== 'Bearer test-permission', status: 401, json: async () => init.headers.Authorization === 'Bearer test-permission' ? {error: {message: 'Test unauthorized'}} : {choices: [{finish_reason: 'stop', message: {content: '2'}}], usage: {prompt_tokens: 210}}};
  if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(url, init);
  if (init.headers['x-goog-api-key'] === 'test-permission') return {ok: false, status: 403, json: async () => ({error: {message: 'Test permission failure'}})};
  return {ok: true, json: async () => String(url).endsWith(':countTokens') ? {totalTokens: 200} : String(url).endsWith(':generateContent') ? {candidates: [{finishReason: 'STOP', content: {parts: [{text: '2'}]}}]} : {inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent']}};
};
let listener;
const storageListeners = [];
const data = {};
window.chrome = {
  runtime: {
    id: 'browser-test', getURL: path => new URL('/' + path, location.origin).href,
    onMessage: {addListener(fn) { listener = fn; }},
    sendMessage: message => new Promise(resolve => listener(message, {id: 'browser-test', url: new URL('/options/options.html', location.origin).href, tab: {id: 1}}, resolve)),
    openOptionsPage: async () => {}
  },
  action: {onClicked: {addListener() {}}, setBadgeText: async () => {}, setTitle: async () => {}},
  storage: {onChanged: {addListener(fn) { storageListeners.push(fn); }}, local: {
    setAccessLevel: async () => {},
    get: async keys => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(k => k in data).map(k => [k, data[k]])),
    set: async values => { Object.assign(data, values); storageListeners.forEach(fn => fn(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, {newValue: v}])), 'local')); },
    remove: async key => { delete data[key]; }
  }}
};
