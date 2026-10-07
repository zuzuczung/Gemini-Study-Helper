# Bản 0.5.1 — Gemini 3.5 Flash-Lite (07/10/2026)

- Đổi default Gemini thành `gemini-3.5-flash-lite`, cấu hình thinking minimal theo tài liệu model. Nếu chủ động chọn lại 3.8 Flash thì dùng low; không gửi tùy chọn Gemini 3 cho model khác.
- Khi worker khởi động bản mới, chuyển một lần model mặc định cũ 3.8 Flash (hoặc model chưa lưu) sang 3.5 Flash-Lite. Không sửa key hay chế độ provider, không đụng model tùy chỉnh khác; lựa chọn model sau bước nâng cấp không bị đổi lại khi restart.
- Giữ Groq dự phòng và chế độ Tự động/Gemini/Groq. Trang cài đặt ghi model mặc định và bản 0.5.1.
- `node --test tests/*.test.js`: **90/90 đạt**, gồm endpoint/cấu hình minimal của model mới, migration một lần không đổi hai key, không đổi custom model, vẫn hỗ trợ low của 3.8, cùng 40 lượt giả lập/quota fallback/chống trùng và bỏ chọn.
- Chưa reload bản 0.5.1 trên Chrome hoặc thử API thật với model mới; không khẳng định quota tài khoản cho model mới. Cần Reload, chọn chế độ Tự động nếu muốn Gemini chính, bấm Lưu và kiểm tra Gemini.
- Đối chiếu [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) và [thinking levels](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

# Bản 0.5.0 — Gemini → Groq (07/10/2026)

- Thêm chế độ auto/Gemini/Groq; key Groq được lưu riêng, chỉ background đọc. Model Groq `qwen/qwen3.8-27b`, endpoint chat completions, header Bearer; `reasoning_effort: none`, `reasoning_format: hidden`, một lựa chọn, tối đa 64 token đầu ra.
- Auto chuyển tuần tự khi Gemini thiếu key hoặc báo quota/tốc độ/429 không rõ. Tạm bỏ qua Gemini 5 phút sau quota, 1 phút sau rate limit, không kéo dài cooldown khi dùng Groq. Không fallback timeout, mạng, key sai, thiếu quyền, dữ liệu/đáp án không hợp lệ. Hai test kết nối độc lập.
- Dùng cùng parser vị trí 1–4 và kiểm tra response; giữ khóa content/background qua cả fallback. Bỏ chọn vẫn vô hiệu hóa kết quả đến muộn.
- Tài liệu dùng cùng thuật toán chọn đoạn và báo độ phủ; Groq kiểm tra cận trên UTF-8 + phần dự phòng, không cắt ngầm; hiển thị token API thực tế khi có. Cập nhật giao diện ghi rõ con số ngữ cảnh không phải quota còn lại.
- `node --test tests/*.test.js`: **87/87 đạt**. Có ca 40 lượt liên tiếp: 1 lần Gemini bị quota + đúng 40 lượt Groq, cooldown hết hạn/đổi cấu hình, request/header, không rò key, validate response, context dài, fallback không trùng, response muộn, settings/lưu/xóa/test độc lập.
- Chrome, `/tests/fixtures/provider-debug.html`: thao tác kéo chuột thật một lần → 1 message, 1 lượt Gemini bị từ chối, 1 lượt Groq, 1 phản hồi, số 2 đen dưới trái; focus và selection PASS. Bỏ chọn ngay: 0 overlay. Chọn lần nữa rồi bỏ chọn khi chờ → tổng 2 message, Gemini vẫn 1, Groq 2, phản hồi 2, overlay vẫn 0. [Ảnh đáp án](groq-fallback-answer.png), [phản hồi muộn bị bỏ qua](groq-late-suppressed.png).
- Chrome, trang cài đặt với cầu nối API giả lập: lưu/test Groq thành công, password được xóa, mode Groq được lưu. Key giả `test-permission` trả HTTP 401; UI hiện `[INVALID_KEY] Groq…`, không có key thô. [Ảnh chẩn đoán](groq-options-diagnostics.png).
- **Chưa có Groq API key thật, chưa gọi Groq thật, chưa reload 0.5.0 vào extension đang cài của người dùng.** Bộ 40 lượt là kiểm thử mã với HTTP giả lập, không xác nhận quota thực tế hoặc độ chính xác của 40 câu. Bản 0.4.0 trước đó đã test API Gemini thật trên trang Canvas đã nộp; không dùng kết quả đó làm bằng chứng Groq hoạt động.
- Các file chính: `manifest.json`, `src/core.js`, `src/background.js`, `options/options.html`, `options/options.js`, `options/options.css`; cập nhật test/fixture và README. Không đổi content script. Thư mục tải về không có Git/AGENTS.md.

# Bản 0.4.0 — thứ tự lựa chọn 1–4 (07/10/2026)

- Đáp án luôn là vị trí 1/2/3/4 từ trên xuống, kể cả nhãn A/B/C/D đảo thứ tự. Prompt, parser response, bài kiểm tra kết nối và overlay đã đổi đồng bộ sang số.
- Không cần nhãn nếu vùng chọn gồm câu hỏi rồi đúng bốn lựa chọn, mỗi phần trên một dòng hoặc một khối cách nhau bằng dòng trống. Khối có dòng trống hỗ trợ xuống dòng bên trong câu hỏi/lựa chọn. Bỏ ký hiệu radio/bullet phổ biến ở đầu lựa chọn.
- Không tự chia đoạn gộp một dòng thành bốn lựa chọn; từ chối thiếu/thừa, nhãn lặp, nhãn pha trộn hoặc lựa chọn trống. Bố cục tùy ý, lựa chọn bằng hình ảnh và chọn nhiều câu cùng lúc chưa được hỗ trợ.
- Kiểm tra tự động: **70/70 đạt** qua `node --test tests/*.test.js`, gồm luồng không nhãn → request có vị trí → đáp án số, nhãn đảo thứ tự, một lần chọn chỉ gửi một lần, bỏ chọn ẩn đáp án, bỏ chọn khi đang chờ không hiện phản hồi muộn, focus và giới hạn bảo vệ key/tài liệu.
- Chrome với fixture trong iframe: kéo chọn câu không nhãn một lần gửi đúng 1 yêu cầu, hiện số 2 ở góc dưới trái; focus và vùng chọn PASS. Bỏ chọn sau đáp án: 0 overlay. Chọn lần nữa rồi bỏ chọn khi chờ: 2 yêu cầu, 2 hoàn tất, 0 overlay sau phản hồi muộn. Ảnh phản hồi muộn: [không hiện lại](numeric-late-suppressed.jpg). Ảnh: [đáp án số](numeric-unlabeled-answer.jpg).
- Kiểm tra này dùng Gemini giả lập. Chưa xác minh API thật hoặc bản 0.4.0 được reload trong Chrome của người dùng.

Phần dưới lưu lại các lần kiểm tra phiên bản trước; ký hiệu A/B/C/D trong kết quả cũ không phải định dạng đầu ra của bản 0.4.0.

# Bản 0.3.1 — chẩn đoán timeout theo từng bước — 06/10/2026

- Người dùng báo `[TIMEOUT]` sau 30 giây. Bản cũ dùng cùng một mã cho cả metadata model, countTokens và generateContent, không ghi tên bước nên chưa xác định được bước nào chậm hoặc nguyên nhân từ mạng/dịch vụ. Không kết luận key sai từ timeout.
- `src/background.js`: cập nhật trạng thái cài đặt khi chuyển bước; khi lỗi chỉ ghi tên bước có sẵn và thời gian chờ, không lưu exception thô, câu hỏi hoặc key. Giữ giới hạn HTTP 30 giây và tối đa một generateContent mỗi thao tác, không retry/fallback model âm thầm. `manifest.json`: 0.3.1. README bổ sung cách đọc lỗi.
- `tests/background.test.js`: giả lập HTTP treo riêng tại cả ba bước, thực sự kích hoạt AbortController ở mốc 30 giây; kiểm tra trạng thái, lỗi đúng bước, timer được dọn, message trùng không gọi thêm, không có dữ liệu nhạy cảm trong chẩn đoán. **66/66 tests đạt**.
- Thử lại một lần trên tab VietJack thật, câu 3 và đủ A/B/C/D được chọn đúng; giữ nguyên vùng chọn nhưng chưa có overlay. Chưa kiểm chứng kết nối của bản 0.3.1 vì Chrome cần người dùng Reload extension. Không đọc API key hoặc chẩn đoán trực tiếp trong trang nội bộ extension. Không tuyên bố đã sửa được nguyên nhân mạng/dịch vụ của lần timeout này.
- Đối chiếu [Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting) và [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): không tự tăng timeout dài hơn khi fetch có thể bị Chrome dừng. Người dùng Reload 0.3.1, tải lại VietJack, dùng Kiểm tra kết nối một lần và xem tên bước lỗi để tiếp tục xác minh.

# Bản 0.3.0 — bôi đen một lần, bỏ chọn để đóng — 06/10/2026

- Sửa `src/content.js`: gửi một message tra cứu sau khi kết thúc một thao tác chọn thật (pointerup hoặc kết thúc chọn bằng bàn phím). Không gửi trong các sự kiện selectionchange khi đang kéo; bỏ cơ chế chọn hai lần và bỏ thao tác tự xóa vùng chọn để chuẩn bị xác nhận.
- Vùng chọn của từng yêu cầu được ghi nhận bằng nội dung và anchor/focus cùng offset. Khi vùng chọn bị xóa hoặc đổi, xóa overlay và vô hiệu hóa phiên hiển thị ngay. Phản hồi kiểm tra lại vùng chọn trước khi hiển thị; bỏ chọn rồi chọn lại cùng nội dung không làm phản hồi cũ sống lại. Esc vẫn đóng/ngăn phản hồi đến muộn. Không sửa focus khi nhận kết quả.
- Giữ chữ đen, góc dưới trái, nền trong suốt, không khung/bóng/tiêu đề; chỉ A/B/C/D hợp lệ. Giữ khóa gửi khi có yêu cầu đang chạy và chống trùng phía background. Bỏ chọn không hủy HTTP đã gửi: kết quả bị bỏ qua nhưng dịch vụ có thể vẫn xử lý/dùng quota.
- `src/core.js`: xóa bộ xác nhận hai lần không còn dùng và cập nhật thông báo BUSY. `manifest.json`: 0.3.0. Cập nhật README, trang cài đặt và fixture; cập nhật kiểm tra content, core và luồng tích hợp.
- `node --test tests/*.test.js`: **65/65 đạt**. Ba tình huống yêu cầu được kiểm tra ở cả content và luồng content → messaging → background → Gemini giả lập. Có kiểm tra bỏ chọn ngay trước phản hồi dù sự kiện chưa đến, đổi range có cùng chữ, chọn lại khi đang chờ, pointerup trùng, sự kiện chọn liên tục, Shift/Cmd+A, focus, lỗi và kết quả không hợp lệ.
- Chrome, `/tests/fixtures/selection-debug.html` (API giả lập trong iframe; extension thật chỉ top frame): một lần kéo tạo bộ đếm **1**; sau phản hồi có overlay fixed tại left/bottom 16px, chỉ một đáp án; bỏ chọn làm số overlay về **0** ngay. Chọn một lần nữa rồi bỏ chọn trước phản hồi chậm 12 giây: bộ đếm yêu cầu **2**, hoàn tất **2**, số overlay vẫn **0** sau phản hồi đến muộn. Focus và vùng chọn báo PASS. Ảnh: [một lần chọn](single-selection-answer.jpg), [bỏ chọn sau đáp án](single-selection-cleared.jpg), [phản hồi muộn không hiện](single-selection-late-suppressed.jpg). Cả ba tình huống đã kiểm chứng bằng thao tác chuột thật; kênh/API được giả lập.
- Chưa kiểm tra gọi Gemini thật trên bản 0.3.0 hoặc xác nhận bản mới đã reload vào extension của người dùng. Không đọc API key của người dùng. Những lần thử API thật bên dưới thuộc các bản cũ, không phải bằng chứng kết nối của lần sửa này.

## Dùng thử 0.3.0

1. Vào `chrome://extensions`, Reload **Gemini Study Helper**, xác nhận **0.3.0** rồi tải lại trang câu hỏi. Không cần nhập lại key đã lưu.
2. Bôi đen đủ câu hỏi và A/B/C/D một lần rồi thả chuột, giữ vùng chọn để nhận đáp án.
3. Bấm vùng trống để bỏ chọn: đáp án biến mất. Chờ yêu cầu trước hoàn tất, chọn lại một lần rồi bỏ chọn ngay khi đang chờ: kết quả đến muộn không hiện. Nếu còn yêu cầu đang chạy, các lần chọn thêm bị bỏ qua; chọn lại khi hết dấu chờ.

Các mục bên dưới là lịch sử kiểm tra các phiên bản cũ, không mô tả cơ chế kích hoạt hiện tại.

# Bản 0.2.2 — chữ đen, chọn lại và độ trễ — 03/10/2026

- `src/content.js`: chữ đen, góc dưới trái, nền trong suốt; nhận kéo thật trên cùng vùng ngay cả khi sự kiện chọn được gộp. Trong cửa sổ xác nhận, khi nhấn vào vùng chữ đã chọn, bỏ vùng chọn cũ để Chrome bắt đầu chọn mới thay vì kéo thả văn bản. Không áp dụng cho liên kết, điều khiển nhập liệu hoặc khi đang gửi. `src/core.js` cung cấp kiểm tra cặp đang chờ.
- `src/background.js`: dùng lại metadata hợp lệ tối đa 10 phút trong bộ nhớ theo key/model, gộp bước metadata đang chạy; xóa khi thay cấu hình/xóa key. Kiểm tra kết nối luôn đọc mới. Mỗi câu vẫn đếm toàn bộ token và có tối đa một lần sinh đáp án. Gemini 3.8 Flash mặc định dùng `thinkingLevel: low` theo [tài liệu chính thức](https://ai.google.dev/gemini-api/docs/generate-content/thinking), model khác giữ cấu hình hiện có. Chưa đo mức cải thiện thời gian thật sau reload.
- `manifest.json` lên 0.2.2; cập nhật README, trang cài đặt và hướng dẫn fixture. Thêm fixture `selection-debug.html` đặt mô phỏng trong iframe để extension thật (chỉ top frame) không gửi thêm request khi thử mô phỏng.
- `node --test tests/*.test.js`: **66/66 đạt**; thêm ca kéo cùng vùng không có sự kiện chọn trung gian, bảo vệ focus/điều khiển/liên kết, bỏ qua lúc đang chờ, cache metadata theo key/model/hết hạn/lỗi, đọc mới khi kiểm tra kết nối/lưu cấu hình. Tài liệu, phản hồi không hợp lệ và phân loại lỗi vẫn đạt.
- Chrome, fixture trong iframe: câu toán tự gửi, thêm hai lần kéo trong lúc chờ không tăng bộ đếm (1); phản hồi giả lập B đen xuất hiện và focus/vùng chọn đều PASS, ô gõ vẫn TEXTAREA. [Ảnh kiểm chứng](black-answer-focus.jpg). Đây là ca mô phỏng trước bổ sung chuẩn bị vùng chọn ở pointerdown, không phải phép đo tốc độ Gemini thật của 0.2.2.
- VietJack thật, câu 3 “Trái Đất có dạng hình gì?”: kéo lại ngay có lần làm vùng chọn rỗng. Thử bỏ chọn giữa hai lần kéo: ghi nhận cả hai vùng chọn giống hệt nhau, đầy đủ câu hỏi và A/B/C/D, cách nhau **1.948 ms**. Sau **135 giây** chưa có overlay; không xác nhận thành công và chưa xác định được lỗi API hiện tại. [Ảnh lần thử](vietjack-live-pending-reload.jpg). Không đọc được trang cài đặt/service worker bằng công cụ; cần người dùng Reload extension và đọc trạng thái nếu vẫn lỗi. Chưa xác nhận Chrome đã nạp 0.2.2, nên không xem lần này là kiểm chứng mã mới hoặc độ trễ mới.
- Công cụ trình duyệt không thao tác được trang nội bộ quản lý extension; không dùng đường vòng để đọc key hoặc điều khiển service worker.

## Thử bản mới bằng tay

1. Trong `chrome://extensions`, Reload **Gemini Study Helper**, xác nhận phiên bản **0.2.2**, rồi tải lại tab VietJack.
2. Kéo chọn đủ một câu và bốn lựa chọn, thả chuột, kéo lại đúng đoạn trong 3 giây. Không cần Enter, nút gửi hoặc bấm chỗ trống. Kéo từ sát ngoài mép chữ giúp tránh thao tác kéo thả văn bản của trình duyệt.
3. Chờ dấu `…` hết trước khi chọn câu khác hai lần. Chọn lúc đang gửi bị bỏ qua, không xếp hàng. Nếu biểu tượng có `!`, xem Lần tra cứu gần nhất trong cài đặt.
4. Đáp án mới thay đáp án cũ, chữ đen cố định dưới trái; Esc đóng. Gõ trong ô nhập khi chờ để kiểm chứng focus không bị chuyển khi đáp án về.

# Kiểm tra sau khi người dùng lưu API key — 03/10/2026

- Người dùng đã tự tạo và lưu key trong cài đặt extension. Agent không đọc key, lấy key từ storage/profile hoặc đưa key vào log/ảnh/chat.
- Đã thử extension được nạp trong Chrome trên `real-extension.html`, trang không có script hoặc API giả lập: hai lần chọn đúng câu toán trong 3 giây tự hiện **B**, không nhấn Enter/nút gửi. Lần đầu chưa có overlay; lần hai gửi và sau khi chờ đã có overlay thật.
- Chọn câu hành tinh với thứ tự nhãn D/B/A/C: lần đầu giữ đáp án B, lần hai xóa kết quả cũ rồi tự hiện **D**, giữ nguyên ánh xạ nhãn.
- Sau lần xác nhận thứ hai, bấm ô thử và gõ; khi kiểm tra đáp án D đã xuất hiện, focus vẫn TEXTAREA và gõ tiếp được không cần click lại. Esc xóa overlay và focus vẫn TEXTAREA. Console trang thử không ghi nhận warning/error. Không đo được chính xác thời điểm phản hồi so với thao tác bấm ô nhập.
- Ảnh: [real-gemini-success.jpg](real-gemini-success.jpg). Đã xác minh luồng trả lời thật với cấu hình người dùng lưu; chưa đọc trực tiếp trạng thái options/service worker hoặc đếm HTTP thật vì công cụ không truy cập được trang nội bộ extension. Chống gọi trùng được kiểm tra trong bộ test 61/61 và fixture chậm, không khẳng định đã đếm request thật.
- Các ghi chú “chưa có key/chưa xác minh kết nối thật” bên dưới ghi lại kết quả trước khi người dùng lưu key; lần kiểm tra này bổ sung bằng chứng kết nối đã hoạt động.

# Bổ sung kiểm tra tự gửi và focus — 03/10/2026, v0.2.1

- Sửa `src/content.js`: khóa toàn bộ thao tác chọn khi đang gửi, xóa cặp xác nhận và thao tác dở khi hoàn tất/lỗi; không tính key repeat thành thao tác mới. Tự gọi runtime ở lần xác nhận thứ hai, không Enter/nút gửi. Esc chỉ đóng/ngăn hiện lại, không mở khóa yêu cầu đang chạy.
- Sửa `src/background.js`: một yêu cầu sinh đáp án đang chạy cho mỗi tài liệu/tab; ID trùng được trả cùng kết quả, cùng nội dung đang chờ được gộp, câu khác nhận BUSY và không xếp hàng. ID bị từ chối cũng được nhớ để không gửi muộn khi replay. Các tab độc lập.
- `src/core.js`: mô tả BUSY rõ hơn. `manifest.json`: 0.2.1. `options/options.html`, `README.md`: hướng dẫn tự gửi và chọn lại sau khi hoàn tất. Thêm/mở rộng `tests/automatic-flow.test.js`, `tests/content.test.js`, `tests/background.test.js` và `tests/fixtures/automatic-flow.html`.
- Nguyên nhân còn thiếu: khóa cũ theo nội dung cho phép câu khác chạy đồng thời; thao tác chọn phát sinh khi chờ có thể để lại nửa cặp xác nhận. Giao diện ChatGPT bên phải trong ảnh người dùng là giao diện riêng; mã extension này gọi Gemini API trực tiếp, không gửi qua thanh bên ChatGPT.

## Kết quả

- `node --test tests/*.test.js`: **61/61 đạt**. Bao gồm luồng content → messaging → background → metadata/token/generation giả lập → overlay; một lần chọn không gửi, lần thứ hai tự gửi; không có sự kiện Enter/nút gửi trong ca thử.
- Chrome, kéo chọn thật trên fixture phản hồi chậm 12 giây: lần đầu bộ đếm 0, lần hai 1; thêm hai lần chọn cùng câu và hai lần chọn câu khác lúc chờ vẫn là 1; tự hiện B ở góc dưới trái. Vùng chọn câu khác vẫn nguyên vẹn, focus BODY giữ nguyên. Cặp mới sau khi hoàn tất: lần đầu vẫn 1, lần hai tăng 2.
- Ca focus riêng: chọn câu có đáp án D hai lần rồi bấm ô nhập và gõ trong lúc chờ; đáp án D xuất hiện tự động, focus vẫn TEXTAREA và tiếp tục gõ được không cần click lại. Không bấm Enter/nút gửi. Esc xóa overlay, focus vẫn TEXTAREA. Console trang thử không có warning/error được ghi nhận.
- Ảnh kiểm chứng: [focus-chrome.jpg](focus-chrome.jpg). Fixture không gọi Gemini thật và không cần API key. Không thể suy từ console trang thử rằng service worker hoặc kết nối thật không có lỗi.
- Mỗi xác nhận có đúng một message tra cứu và tối đa một `generateContent`; metadata model và `countTokens` là hai HTTP request kiểm tra riêng, không phải gửi trùng sinh đáp án.

## Kiểm chứng thủ công trên extension thật

1. Mở `chrome://extensions`, tìm **Gemini Study Helper**, reload bản từ thư mục `Web-Question-Assistant-main`, xác nhận phiên bản **0.2.1**. Nếu chưa nạp: Developer mode → Load unpacked → chọn thư mục này. Công cụ điều khiển trình duyệt không cho truy cập trang nội bộ này; cần thao tác bằng tay.
2. Mở cài đặt qua biểu tượng extension, lưu API key và chọn **Lưu và kiểm tra kết nối**. Không nhập key vào trang thử HTTP hoặc gửi key trong chat. Chưa có key thật được sử dụng trong kiểm thử này.
3. Tải lại `http://127.0.0.1:4187/tests/fixtures/real-extension.html`. Chọn cả câu hỏi đầu và bốn lựa chọn một lần: chưa gọi; bỏ chọn rồi chọn lại trong 3 giây: tự gửi, không Enter hoặc nút gửi. Kết quả mong đợi B.
4. Trong lúc biểu tượng hiện dấu chờ, chọn lặp cùng/khác câu: không có lượt trả lời mới. Khi hoàn tất, chọn lại câu thứ hai đủ hai lần: D. Chọn khác đoạn hoặc quá 3 giây phải bắt đầu lại. Esc đóng kết quả.
5. Thử gõ ở ô nhập trong lúc chờ: nhận đáp án không được chuyển focus. Nếu không có đáp án, xem **Lần tra cứu gần nhất** trong cài đặt. Muốn đếm HTTP thật: mở Inspect service worker tại trang quản lý, Network, lọc `generateContent`; mỗi cặp xác nhận có tối đa một mục, không tính metadata/countTokens.

Chưa xác minh request thật với tài khoản/key/model của người dùng hoặc bản unpacked đã được reload trong hồ sơ Chrome. Tất cả kết quả tự động ở trên dùng phản hồi giả lập; thao tác chọn, hiển thị và focus là thao tác Chrome thật.

---

# Bàn giao và kiểm tra — 02/10/2026

Đã chỉnh trực tiếp thư mục bản tải về `Web-Question-Assistant-main`. Không có AGENTS.md trong thư mục hoặc thư mục cha đã kiểm tra; không có `.git`. Không commit/push lên GitHub.

## Phát hiện từ mã gốc

- Content script chỉ được inject từ toolbar/Alt+Q, chưa có cơ chế hai thao tác chọn. Overlay cũ hiện trạng thái tải và giải thích dạng thẻ góc trên phải.
- HTTP 403 bị gộp với key sai; HTTP 429 luôn bị gọi là giới hạn tốc độ; các lỗi model/request/server khác thiếu phân loại. Đây là lỗi chẩn đoán có thể xác nhận từ mã, không phải bằng chứng API key của người dùng sai.
- Options chỉ có lưu/xóa khóa, không có kiểm tra kết nối hoặc lịch sử trạng thái. Việc xác định options chỉ qua `!sender.tab` được thay bằng kiểm tra URL options thuộc extension, hoạt động cả khi options mở thành tab.
- Endpoint `v1beta/models/{model}:generateContent`, header `x-goog-api-key` và host permission của bản cũ đã đúng với tài liệu hiện hành. `gemini-3.8-flash` có trong danh sách model hiện hành. Không tự đổi model hoặc khẳng định đây là nguyên nhân lỗi.
- Prompt yêu cầu giải thích và không có system instruction riêng. Parser lấy candidate có chữ đầu tiên, không kiểm tra finish reason, thought parts hay định dạng đáp án. Chưa có tài liệu tham khảo.

## Đã thay đổi

- `manifest.json`, `src/content.js`, `src/core.js`: tự nhận hai lần chọn, giới hạn 3 giây, chuẩn hóa khoảng trắng, chặn trùng, kiểm tra cấu trúc câu hỏi/đáp án, kết quả trắng trong suốt góc dưới trái và Esc.
- `src/background.js`: kiểm tra người gửi, khóa chỉ ở background, lưu trạng thái an toàn, phân loại lỗi, metadata/countTokens/generateContent, kiểm tra kết nối, system instruction tách dữ liệu, lọc kết quả cũ.
- `src/documents.js` và `vendor/pdfjs/`: nhập văn bản/TXT/PDF, giới hạn rõ ràng, báo trang thiếu lớp văn bản/OCR, chọn đoạn theo từ khóa với báo cáo phạm vi.
- `options/options.*`: cấu hình, kiểm tra kết nối, xem trạng thái/error, thêm/xóa tài liệu và xem phạm vi tài liệu đã dùng.
- `tests/`: mở rộng unit/integration mocks, kiểm tra manifest/service-worker imports, fixture trình duyệt và PDF thật. `README.md`: hướng dẫn reload, quyền mới, giới hạn và tài liệu chính thức.

## Đã xác minh

- Bộ test cũ trước thay đổi: 20/20 đạt.
- Bộ test sau thay đổi: **55/55 đạt**, chạy bằng `node --test tests/*.test.js`; bao phủ một lần chưa gọi, hai lần cùng nội dung mới gọi, khác nội dung/timeout reset, nhiều selectionchange không xác nhận trùng, ID trùng, chờ request, phản hồi cũ, Esc, đầu vào thiếu, response không hợp lệ, lỗi API, lưu/xóa key, sender options ở tab, tài liệu, quota và ngữ cảnh.
- Trong Chromium của trình duyệt Codex, dùng fixture local và thao tác kéo chọn thật: lần đầu bộ đếm 0, bỏ chọn/chọn lại trong 3 giây bộ đếm 1; chữ B trắng xuất hiện ở góc dưới trái; Esc xóa overlay. Computed CSS: fixed, left/bottom 16px, nền rgba(0,0,0,0), border 0, shadow none, bất chấp CSS trang cố ẩn div.
- Trang options thật chạy qua cầu nối giả lập: lưu/test thành công, lỗi 403 hiện PERMISSION_DENIED, ô key trống sau lưu, nhập văn bản thành công; tải tệp qua file chooser thật.
- PDF.js đóng gói thực tế: PDF văn bản 1/1 trang đạt; PDF hỗn hợp 1/2 trang và báo trang 2 thiếu văn bản; PDF chỉ ảnh báo chưa OCR/không lưu; PDF hỏng bị từ chối. TXT UTF-8 được lưu đầy đủ.

## Chưa xác minh

- Không có API key thật được cung cấp hoặc sử dụng. Chưa xác minh thành công/chi phí/quota/model cho tài khoản của người dùng; không kết luận nguyên nhân mất kết nối thực tế. Dùng nút “Lưu và kiểm tra kết nối” trong extension đã nạp để lấy lỗi cụ thể.
- Trình duyệt fixture dùng messaging/storage/API giả lập, không thay thế kiểm thử cài extension thật. Chưa nạp unpacked vào hồ sơ Chrome của người dùng và chưa chạy trực tiếp trên Firefox/Cốc Cốc. Import service worker, manifest, message routes và trạng thái được kiểm tra tự động; cần smoke test thực tế sau reload.
- Không OCR, không đọc ý nghĩa ảnh/bảng biểu chỉ dưới dạng ảnh; văn bản trích xuất từ PDF nhiều cột có thể không giữ đúng thứ tự đọc. Tìm đoạn theo từ khóa là bản tối thiểu, chưa dùng embeddings. Việc model không bị prompt injection hoặc luôn trả lời đúng không thể được chứng minh chỉ bằng kiểm tra định dạng.

## Dùng thử

Reload extension ở trang quản lý, kiểm tra quyền truy cập site, tải lại trang câu hỏi, mở cài đặt bằng biểu tượng và lưu/kiểm tra key. Thêm tài liệu nếu cần, rồi bôi đen cả câu hỏi và A/B/C/D hai lần trong 3 giây. Khi không hiện đáp án, xem lỗi trong cài đặt; không cần nhấn Alt+Q.
