(function (root) {
  'use strict';
  const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  const GROQ_MODEL = 'qwen/qwen3.8-27b';
  const MESSAGES = {
    NO_SELECTION: 'Hãy bôi đen câu hỏi và đủ bốn lựa chọn theo thứ tự từ trên xuống.',
    TOO_LONG: 'Phần đã chọn vượt quá 8.000 ký tự; không gửi nội dung bị cắt.',
    MISSING_QUESTION: 'Chưa có nội dung câu hỏi. Hãy chọn cả câu hỏi và các lựa chọn.',
    MISSING_CHOICES: 'Cần đủ bốn lựa chọn. Nếu không có nhãn, chọn câu hỏi và bốn lựa chọn, mỗi phần trên một dòng hoặc cách nhau bằng dòng trống.',
    UNDETERMINED: 'AI chưa xác định được đáp án; không hiển thị phỏng đoán.',
    MULTIPLE_ANSWERS: 'Câu hỏi không có một đáp án duy nhất; chưa hỗ trợ hiển thị nhiều đáp án.',
    BAD_ANSWER: 'Phản hồi không đúng định dạng một số 1/2/3/4; đã từ chối hiển thị.',
    BLOCKED: 'Dịch vụ AI chặn nội dung hoặc dừng sinh kết quả; chưa có đáp án hợp lệ.',
    INCOMPLETE_RESPONSE: 'Dịch vụ AI hết giới hạn đầu ra trước khi hoàn tất; chưa có đáp án hợp lệ.',
    EMPTY_RESPONSE: 'Dịch vụ AI không trả về đáp án.',
    NO_KEY: 'Chưa có API key cho dịch vụ này. Nhập và lưu khóa trong cài đặt extension.',
    INVALID_PROVIDER: 'Chọn chế độ Tự động, Gemini hoặc Groq trong cài đặt.',
    INVALID_KEY: 'API key không hợp lệ, đã hết hạn hoặc bị vô hiệu hóa. Kiểm tra khóa trong trang quản lý API tương ứng.',
    PERMISSION_DENIED: 'Thiếu quyền truy cập dịch vụ AI. Kiểm tra quyền dự án, model và giới hạn áp dụng cho khóa.',
    QUOTA_EXCEEDED: 'Đã hết quota hoặc số dư. Kiểm tra hạn mức ngày và thanh toán trong trang quản lý API tương ứng.',
    RATE_LIMIT: 'Vượt giới hạn tốc độ gọi dịch vụ AI. Đợi một lúc rồi thử lại.',
    RESOURCE_EXHAUSTED: 'Dịch vụ AI trả lỗi 429 nhưng chưa phân biệt được hết quota hay giới hạn tốc độ. Kiểm tra hạn mức tại nhà cung cấp tương ứng.',
    MODEL_UNAVAILABLE: 'Model không tồn tại, không khả dụng với tài khoản hoặc không hỗ trợ sinh đáp án. Kiểm tra ID model.',
    INVALID_MODEL: 'ID model không hợp lệ. Chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',
    BAD_REQUEST: 'Dịch vụ AI từ chối cấu trúc/tham số yêu cầu. Đây không nhất thiết là lỗi API key.',
    PRECONDITION: 'Dự án chưa đáp ứng điều kiện của dịch vụ AI. Kiểm tra thanh toán, khu vực và trạng thái dịch vụ.',
    SERVICE_ERROR: 'Dịch vụ AI tạm thời gặp lỗi. Thử lại sau.',
    BAD_RESPONSE: 'Dịch vụ AI trả dữ liệu không hợp lệ.',
    NETWORK_ERROR: 'Không kết nối được dịch vụ AI. Kiểm tra mạng, proxy, DNS và quyền truy cập máy chủ của extension.',
    TIMEOUT: 'Dịch vụ AI không phản hồi trong 30 giây. Kiểm tra mạng hoặc thử lại sau.',
    CONTEXT_TOO_LONG: 'Nội dung vượt giới hạn ngữ cảnh cho phép; chưa gửi yêu cầu trả lời. Hãy rút gọn câu hỏi hoặc tài liệu.',
    STORAGE_ERROR: 'Không đọc/ghi được bộ nhớ extension. Kiểm tra dung lượng hoặc tải lại extension.',
    BAD_MESSAGE: 'Yêu cầu extension không hợp lệ.',
    BUSY: 'Trang này đang xử lý một yêu cầu. Khi hoàn tất, hãy bôi đen một lần để tra cứu câu khác.',
    CONNECTION_FAILED: 'Dịch vụ AI có phản hồi nhưng chưa hoàn tất bài kiểm tra trả lời.',
    EXTENSION_ERROR: 'Không liên lạc được service worker. Reload extension và tải lại trang web.',
    UNKNOWN_ERROR: 'Có lỗi nội bộ. Reload extension và thử lại.'
  };
  function failure(code) { return {ok: false, code, message: MESSAGES[code] || MESSAGES.UNKNOWN_ERROR}; }
  function issue(code) { return Object.assign(new Error(failure(code).message), {code}); }
  function normalizeSelection(raw) {
    const text = typeof raw === 'string' ? raw.replace(/\s+/gu, ' ').trim() : '';
    if (!text) return failure('NO_SELECTION');
    if (typeof raw === 'string' && raw.trim().length > 8000) return failure('TOO_LONG');
    return {ok: true, text};
  }
  function validModel(model) {
    return typeof model === 'string' && model.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model);
  }
  function parseQuestion(raw) {
    const normalized = normalizeSelection(raw);
    if (!normalized.ok) return normalized;
    const text = raw.trim();
    const heading = text.match(/^(?:câu(?:\s+hỏi)?|question)\s*\d+\s*[.:)]\s*/iu)?.[0] || '';
    const matches = [...text.matchAll(/(?:^|\s)(?:\(([ABCD1-4])\)|([ABCD1-4])[.):])(?=\s|$)/gu)].filter(m => m.index + m[0].length > heading.length);
    let question;
    let choices;
    if (matches.length) {
      // Explicit labels delimit choices, but answers always use display order.
      const labels = matches.map(m => m[1] || m[2]);
      const alphabet = labels.every(label => /^[ABCD]$/.test(label)) ? 'ABCD' : '1234';
      if (labels.length !== 4 || new Set(labels).size !== 4 || labels.some(label => !alphabet.includes(label))) return failure('MISSING_CHOICES');
      question = text.slice(0, matches[0].index).trim();
      choices = matches.map((m, i) => text.slice(m.index + m[0].length, matches[i + 1]?.index ?? text.length).trim());
    } else {
      // Without labels, only accept an unambiguous question + four text blocks.
      // Keep line boundaries: collapsing whitespace would lose choice order.
      const blocks = text.split(/\r?\n\s*\r?\n/u).map(block => block.trim()).filter(Boolean);
      const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
      const parts = blocks.length === 5 ? blocks : lines;
      if (parts.length !== 5) return failure('MISSING_CHOICES');
      [question, ...choices] = parts;
      choices = choices.map(choice => choice.replace(/^[○◯◉●•□☐]\s*/u, '').trim());
    }
    if (!question.replace(/^(?:câu(?:\s+hỏi)?|question)\s*\d*\s*[.:]?\s*/iu, '').trim()) return failure('MISSING_QUESTION');
    const options = choices.map((choice, i) => ({label: String(i + 1), text: choice}));
    if (options.some(o => !o.text)) return failure('MISSING_CHOICES');
    return {ok: true, question, options, text};
  }
  function parseAnswerText(text) {
    if (typeof text !== 'string' || !text.trim()) throw issue('EMPTY_RESPONSE');
    text = text.trim();
    if (['MISSING_QUESTION', 'MISSING_CHOICES', 'UNDETERMINED', 'MULTIPLE_ANSWERS'].includes(text)) throw issue(text);
    if (!/^[1-4]$/.test(text)) throw issue('BAD_ANSWER');
    return text;
  }
  function parseGroqAnswer(data) {
    if (!Array.isArray(data?.choices) || data.choices.length !== 1) throw issue('BAD_RESPONSE');
    const choice = data.choices[0];
    if (choice?.finish_reason === 'length') throw issue('INCOMPLETE_RESPONSE');
    if (choice?.finish_reason !== 'stop' || choice.message?.refusal || choice.message?.tool_calls?.length) throw issue('BLOCKED');
    return parseAnswerText(choice.message?.content);
  }
  function parseAnswer(data) {
    if (data?.promptFeedback?.blockReason) throw issue('BLOCKED');
    const candidates = data?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) throw issue('EMPTY_RESPONSE');
    if (candidates.length !== 1) throw issue('BAD_ANSWER');
    const candidate = candidates[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw issue('INCOMPLETE_RESPONSE');
    if (candidate?.finishReason !== 'STOP') throw issue('BLOCKED');
    const parts = candidate.content?.parts;
    const text = Array.isArray(parts) ? parts.filter(p => p && !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim() : '';
    return parseAnswerText(text);
  }
  const api = {DEFAULT_MODEL, GROQ_MODEL, failure, issue, normalizeSelection, validModel, parseQuestion, parseAnswer, parseGroqAnswer};
  root.ExplainCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
