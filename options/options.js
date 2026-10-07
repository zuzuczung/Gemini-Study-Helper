(function () {
  'use strict';
  const ext = globalThis.browser || globalThis.chrome;
  const $ = id => document.getElementById(id);
  const keyInput = $('key');
  const modelInput = $('model');
  const groqKeyInput = $('groq-key');
  const controls = ['save', 'test-connection', 'delete-key', 'save-groq', 'test-groq', 'delete-groq-key', 'provider-mode'];
  let busy = false;
  let readBusy = false;
  function show(message) { $('status').textContent = message; }
  async function send(message) {
    const result = await ext.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.message || 'Không liên lạc được extension. Hãy reload extension.');
    return result;
  }
  function describe(status, fallback) {
    if (!status) return fallback;
    if (status.state === 'loading' && Date.now() - status.updatedAt > 130000) return 'Yêu cầu đã bị gián đoạn hoặc hết thời gian. Hãy thử lại.';
    const time = status.updatedAt ? ` (${new Date(status.updatedAt).toLocaleTimeString('vi-VN')})` : '';
    return `${status.code && status.code !== 'OK' ? `[${status.code}] ` : ''}${status.message}${time}`;
  }
  function renderStatus(settings) {
    $('connection-status').textContent = describe(settings.connectionStatus, 'Chưa kiểm tra kết nối.');
    $('groq-connection-status').textContent = describe(settings.groqConnectionStatus, 'Chưa kiểm tra Groq.');
    $('groq-key-status').textContent = settings.hasGroqKey ? 'Groq key đã lưu. Nhập khóa mới để thay thế.' : 'Chưa lưu Groq key.';
    $('lookup-status').textContent = describe(settings.lookupStatus, 'Chưa có yêu cầu.');
    const context = settings.lookupStatus?.context;
    $('context-status').textContent = context ? `${context.tokenMethod === 'utf8-upper-bound' ? 'Giới hạn ước tính an toàn theo byte UTF-8' : 'Token đầu vào của lượt này'}: ${context.inputTokens}/${context.budget}. Đây là độ dài ngữ cảnh, không phải quota còn lại. ${settings.lookupStatus.state === 'success' ? 'Đã gửi để trả lời.' : 'Xem trạng thái phía trên; chưa có đáp án hợp lệ.'}` : '';
    $('context-documents').replaceChildren();
    for (const doc of context?.documents || []) {
      const li = document.createElement('li');
      li.textContent = `${doc.name}: dùng ${doc.usedChunks.length}/${doc.totalChunks} đoạn (${doc.usedChars}/${doc.totalChars} ký tự). Đoạn: ${doc.usedChunks.join(', ') || 'không có'}. ${doc.readStatus || ''}`;
      $('context-documents').append(li);
    }
  }
  function renderDocuments(documents = []) {
    $('documents').replaceChildren();
    for (const doc of documents) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${doc.name} — ${doc.text.length.toLocaleString('vi-VN')} ký tự. ${doc.readStatus || 'Đã đọc văn bản.'}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Xóa';
      remove.setAttribute('aria-label', `Xóa ${doc.name}`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try { await send({type: 'REMOVE_DOCUMENT', id: doc.id}); await refresh(); }
        catch (error) { $('document-status').textContent = error.message; remove.disabled = false; }
      });
      li.append(text, remove);
      $('documents').append(li);
    }
  }
  async function refresh(initial = false) {
    const settings = await send({type: 'GET_SETTINGS'});
    if (initial) {
      modelInput.value = settings.geminiModel;
      $('provider-mode').value = settings.providerMode;
      show(settings.hasKey ? 'API key đã lưu. Nhập khóa mới để thay thế.' : 'Chưa lưu API key.');
    }
    renderStatus(settings);
    renderDocuments(settings.referenceDocuments);
  }
  async function saveSettings() {
    const model = modelInput.value.trim();
    if (!ExplainCore.validModel(model)) throw new Error(ExplainCore.failure('INVALID_MODEL').message);
    await send({type: 'SAVE_SETTINGS', model, key: keyInput.value.trim(), groqKey: groqKeyInput.value.trim(), providerMode: $('provider-mode').value});
    keyInput.value = '';
    groqKeyInput.value = '';
    show('Đã lưu cài đặt. Dùng kiểm tra kết nối để xác minh key và model.');
    await refresh();
  }
  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    controls.forEach(id => { $(id).disabled = true; });
    try { await fn(); }
    catch (error) { show(error.message); }
    finally { busy = false; controls.forEach(id => { $(id).disabled = false; }); }
  }
  $('save').addEventListener('click', () => withBusy(saveSettings));
  $('save-groq').addEventListener('click', () => withBusy(saveSettings));
  $('test-connection').addEventListener('click', () => withBusy(async () => {
    await saveSettings();
    $('connection-status').textContent = 'Đang kiểm tra kết nối…';
    try { await send({type: 'TEST_CONNECTION'}); }
    finally { await refresh(); }
  }));
  $('delete-key').addEventListener('click', () => withBusy(async () => {
    await send({type: 'DELETE_KEY'});
    keyInput.value = '';
    show('Đã xóa API key.');
    await refresh();
  }));
  $('test-groq').addEventListener('click', () => withBusy(async () => {
    await saveSettings();
    $('groq-connection-status').textContent = 'Đang kiểm tra Groq…';
    try { await send({type: 'TEST_GROQ_CONNECTION'}); }
    finally { await refresh(); }
  }));
  $('delete-groq-key').addEventListener('click', () => withBusy(async () => {
    await send({type: 'DELETE_GROQ_KEY'});
    groqKeyInput.value = '';
    show('Đã xóa Groq key.');
    await refresh();
  }));
  async function addDocument(name, result) {
    await send({type: 'ADD_DOCUMENT', document: {id: crypto.randomUUID(), name: name.slice(0, 180), ...result}});
  }
  async function loadPdf() {
    const pdfjs = await import('../vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = ext.runtime.getURL('vendor/pdfjs/pdf.worker.mjs');
    return {getDocument: config => pdfjs.getDocument({...config, cMapUrl: ext.runtime.getURL('vendor/pdfjs/cmaps/'), cMapPacked: true, standardFontDataUrl: ext.runtime.getURL('vendor/pdfjs/standard_fonts/')})};
  }
  $('add-text').addEventListener('click', async () => {
    if (readBusy) return;
    readBusy = true;
    $('add-text').disabled = true;
    try {
      const text = StudyDocuments.checkText($('document-text').value);
      await addDocument($('document-name').value.trim() || 'Văn bản tham khảo', {kind: 'text', text, readStatus: 'Đã đọc toàn bộ văn bản nhập.'});
      $('document-text').value = '';
      $('document-name').value = '';
      $('document-status').textContent = 'Đã đọc và lưu văn bản thành công.';
      await refresh();
    } catch (error) { $('document-status').textContent = error.message; }
    finally { readBusy = false; $('add-text').disabled = false; }
  });
  $('document-files').addEventListener('change', async () => {
    if (readBusy) return;
    readBusy = true;
    $('add-text').disabled = true;
    $('document-files').disabled = true;
    const results = [];
    try {
      for (const file of Array.from($('document-files').files || [])) {
        $('document-status').textContent = `Đang đọc ${file.name}…`;
        try {
          const result = await StudyDocuments.readFile(file, loadPdf);
          await addDocument(file.name, result);
          results.push(`${file.name}: đã lưu. ${result.readStatus}`);
        } catch (error) { results.push(`${file.name}: chưa lưu. ${error.message}`); }
      }
      await refresh();
    } catch (error) { results.push(error.message); }
    finally {
      $('document-status').textContent = results.join('\n');
      $('document-files').value = '';
      readBusy = false;
      $('add-text').disabled = false;
      $('document-files').disabled = false;
    }
  });
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ['lookupStatus', 'connectionStatus', 'groqConnectionStatus', 'referenceDocuments', 'configStatus'].some(key => key in changes)) refresh().catch(() => show('Không đọc được trạng thái extension.'));
  });
  refresh(true).then(() => {
    controls.concat(['add-text', 'document-files']).forEach(id => { $(id).disabled = false; });
  }).catch(() => show('Không đọc được cài đặt. Reload extension rồi mở lại trang này.'));
})();
