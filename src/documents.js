(function (root) {
  'use strict';
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_DOCUMENT_CHARS = 300000;
  const MAX_TOTAL_CHARS = 1000000;
  const MAX_DOCUMENTS = 12;
  function checkText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Không tìm thấy văn bản để đọc.');
    if (text.length > MAX_DOCUMENT_CHARS) throw new Error('Tài liệu vượt 300.000 ký tự. Chưa lưu; hãy chia nhỏ tài liệu, không cắt ngầm.');
    return text;
  }
  function validateLibrary(documents) {
    if (!Array.isArray(documents) || documents.length > MAX_DOCUMENTS) throw new Error('Tối đa 12 tài liệu.');
    let total = 0;
    for (const doc of documents) {
      if (!doc || typeof doc.id !== 'string' || doc.id.length > 100 || typeof doc.name !== 'string' || doc.name.length > 180) throw new Error('Thông tin tài liệu không hợp lệ.');
      total += checkText(doc.text).length;
    }
    if (total > MAX_TOTAL_CHARS) throw new Error('Tổng tài liệu vượt 1.000.000 ký tự. Hãy xóa bớt trước khi thêm.');
    return documents;
  }
  async function readFile(file, loadPdf) {
    if (file.size > MAX_FILE_BYTES) throw new Error('Tệp vượt 10 MB. Chưa đọc hoặc lưu tệp.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.txt$/i.test(file.name)) {
      let text;
      try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
      catch (_) { throw new Error('TXT phải dùng mã hóa UTF-8. Hãy chuyển mã rồi tải lại.'); }
      return {text: checkText(text), kind: 'txt', readStatus: 'Đã đọc toàn bộ văn bản TXT (UTF-8).'};
    }
    if (!/\.pdf$/i.test(file.name)) throw new Error('Chỉ hỗ trợ tệp PDF hoặc TXT.');
    const pdfjs = await loadPdf();
    const task = pdfjs.getDocument({data: bytes, isEvalSupported: false, useSystemFonts: true, stopAtErrors: true});
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 200) throw new Error('PDF vượt 200 trang. Chưa đọc hoặc lưu; hãy chia nhỏ tệp.');
      const texts = [];
      const emptyPages = [];
      let size = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (!text) emptyPages.push(i);
        texts.push(text ? `[Trang ${i}]\n${text}` : '');
        size += texts[texts.length - 1].length + 2;
        if (size > MAX_DOCUMENT_CHARS) throw new Error('PDF vượt 300.000 ký tự. Chưa lưu; không cắt ngầm.');
        page.cleanup();
      }
      if (emptyPages.length === pdf.numPages) throw new Error('PDF không có lớp văn bản đọc được (có thể là bản scan/ảnh). Chưa hỗ trợ OCR; chưa lưu tài liệu.');
      const readStatus = `Đã trích xuất lớp văn bản ở ${pdf.numPages - emptyPages.length}/${pdf.numPages} trang. ` +
        (emptyPages.length ? `Trang không đọc được văn bản: ${emptyPages.join(', ')}. ` : '') +
        'Chưa hỗ trợ OCR: ảnh, biểu đồ và chữ trong ảnh chưa được đọc.';
      return {text: checkText(texts.join('\n\n')), kind: 'pdf', pages: pdf.numPages, emptyPages, readStatus};
    } catch (error) {
      if (error?.name === 'PasswordException') throw new Error('PDF được bảo vệ bằng mật khẩu. Hãy dùng bản đã mở khóa.');
      if (error?.name === 'InvalidPDFException') throw new Error('Tệp PDF không hợp lệ hoặc đã hỏng.');
      throw error;
    } finally { await task.destroy(); }
  }
  function chunks(text) {
    const result = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + 1800, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(' ', end));
        if (boundary > start + 900) end = boundary + 1;
      }
      result.push({start, end, text: text.slice(start, end)});
      start = end;
    }
    return result;
  }
  function words(text) { return new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []); }
  function selectReferences(documents, question, maxChars = 24000) {
    validateLibrary(documents);
    const terms = words(question);
    const all = documents.flatMap(doc => chunks(doc.text).map((chunk, index) => ({...chunk, source: doc.id, name: doc.name, index: index + 1,
      score: [...words(chunk.text)].filter(term => terms.has(term)).length})));
    const fitsAll = all.reduce((sum, chunk) => sum + chunk.text.length, 0) <= maxChars;
    const ranked = [...all].sort((a, b) => b.score - a.score);
    let remaining = maxChars;
    const chosen = new Set();
    for (const chunk of ranked) {
      if ((fitsAll || chunk.score > 0) && chunk.text.length <= remaining) { chosen.add(chunk); remaining -= chunk.text.length; }
    }
    const selected = all.filter(chunk => chosen.has(chunk));
    return {
      excerpts: selected.map(({score, ...chunk}) => chunk),
      report: documents.map(doc => ({name: doc.name, totalChunks: all.filter(c => c.source === doc.id).length,
        usedChunks: selected.filter(c => c.source === doc.id).map(c => c.index),
        usedChars: selected.filter(c => c.source === doc.id).reduce((sum, c) => sum + c.text.length, 0),
        totalChars: doc.text.length, readStatus: doc.readStatus}))
    };
  }
  const api = {MAX_DOCUMENT_CHARS, MAX_TOTAL_CHARS, MAX_DOCUMENTS, checkText, validateLibrary, readFile, chunks, selectReferences};
  root.StudyDocuments = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
