# 🌌 Gemini AI Translator

Tiện ích dịch thuật tiểu thuyết, truyện chữ và Light Novel chất lượng cao dành cho ứng dụng **e-novels** sử dụng sức mạnh trí tuệ nhân tạo từ **Google Gemini API**.

---

## ✨ Tính Năng Nổi Bật

- 🚀 **Trí tuệ nhân tạo tiên tiến**: Tích hợp các mô hình mới nhất của Google như `Gemini 2.5 Flash`, `Gemini 2.5 Pro`, `Gemini 2.0 Flash`, `Gemini 2.0 Flash Lite`, `Gemini 1.5 Flash` và `Gemini 1.5 Pro`.
- 📚 **Đa dạng phong cách dịch thuật (Novel Styles)**:
  - **Tiên Hiệp / Kiếm Hiệp**: Hán Việt chuẩn, xưng hô cổ trang kiếm hiệp sắc thái tự nhiên.
  - **Ngôn Tình / Tình Cảm**: Văn phong mượt mà, cảm xúc, tự nhiên, sâu lắng.
  - **Huyền Huyễn / Fantasy Phương Tây**: Phong cách kỳ ảo, hoành tráng, thuật ngữ chuẩn thần thoại.
  - **Tiểu Thuyết Văn Học Chung**: Chuẩn văn phong tiếng Việt hiện đại, trôi chảy.
  - **Chính Xác / Sát Nghĩa**: Bám sát từng câu chữ và cấu trúc ngữ pháp gốc.
- 🌐 **Hỗ trợ đa ngôn ngữ đích**: Dịch sang Tiếng Việt (`vi`), Tiếng Anh (`en`), Tiếng Trung (`zh`), Tiếng Nhật (`ja`), Tiếng Hàn (`ko`), Tiếng Pháp (`fr`), Tiếng Đức (`de`), Tiếng Nga (`ru`), Tiếng Tây Ban Nha (`es`), Tiếng Thái (`th`)...
- 🛡️ **Bảo toàn định dạng & Thẻ đặc biệt**: Tự động giữ nguyên 100% thẻ ảnh (`@{img:...}`), thẻ ngắt trang, phân cảnh (`***`, `---`) và dấu ngoặc thoại.
- 📖 **Bảng thuật ngữ nhân vật (Glossary)**: Tùy chỉnh danh sách tên nhân vật, chiêu thức, địa danh bắt buộc dịch theo ý bạn.
- 💬 **Chỉ dẫn tùy chỉnh (Custom Prompt)**: Nhập yêu cầu riêng cho AI (ví dụ: xưng hô huynh - muội, bối cảnh đặc biệt...).
- ⚙️ **Chia mẻ thông minh (Context-Aware Batching)**: Tùy chỉnh số đoạn mỗi lượt gọi (15 - 25 đoạn để phản hồi siêu tốc hoặc 0 để gửi toàn bộ chương).

---

## 🛠️ Hướng Dẫn Cấu Hình & Sử Dụng

### Bước 1: Lấy Google Gemini API Key (Miễn phí)
1. Truy cập [Google AI Studio](https://aistudio.google.com/).
2. Đăng nhập bằng tài khoản Google của bạn.
3. Nhấn vào nút **Get API key** và chọn **Create API key**.
4. Sao chép chuỗi mã khóa (bắt đầu bằng `AIzaSy...`).

### Bước 2: Nhập Cài Đặt Trong Ứng Dụng
1. Mở ứng dụng, vào mục **Quản lý Tiện ích** -> Chọn **Gemini AI Translator** -> **Cài đặt**.
2. Dán API Key vừa lấy vào ô **Google Gemini API Key**.
3. Tùy chỉnh các tùy chọn mong muốn:
   - **Mô hình Gemini**: Khuyên dùng `Gemini 2.5 Flash` (cân bằng hoàn hảo giữa tốc độ và chất lượng) hoặc `Gemini 2.0 Flash` (phản hồi siêu nhanh).
   - **Ngôn ngữ dịch đích mặc định**: Chọn ngôn ngữ bạn muốn dịch sang (mặc định: *Tiếng Việt*).
   - **Phong cách dịch**: Chọn phong cách phù hợp với thể loại truyện đang đọc.
   - **Số đoạn văn mỗi lượt gọi (Batch size)**:
     - Đặt `15 - 20`: Mỗi lượt gọi mất ~3 - 6 giây, tránh bị timeout khi mạng yếu.
     - Đặt `0`: Gửi toàn bộ chương trong 1 lượt gọi duy nhất (dành cho đường truyền mạng ổn định).
4. Nhấn **💾 Lưu cài đặt**.
5. Nhấn **⚡ Kiểm tra kết nối API** để xác nhận tiện ích kết nối thành công tới máy chủ Google Gemini.

### Bước 3: Thưởng Thức Truyện
- Mở bất kỳ chương truyện nào trong app và chọn tính năng Dịch — AI sẽ tự động chuyển ngữ theo đúng cài đặt của bạn!

---

## 💡 Mẹo & Lưu Ý

- **Bảo mật API Key**: API Key được lưu an toàn trong bộ nhớ cục bộ của ứng dụng. Khi cập nhật các cài đặt khác (như đổi Model hoặc Style), bạn có thể để trống ô API Key mà không sợ bị mất khóa đã lưu.
- **Bảng thuật ngữ (Glossary)**: Nhập mỗi từ trên một dòng theo định dạng `Từ gốc: Nghĩa dịch` (hoặc `Từ gốc = Nghĩa dịch`).
  *Ví dụ:*
  ```text
  Tiêu Viêm: Tiêu Viêm
  Dược Lão: Dược Lão
  Dị Hỏa: Dị Hỏa
  Đấu Khí: Đấu Khí
  ```
- **Khắc phục lỗi mạng / Timeout**: Nếu gặp thông báo lỗi timeout khi mạng chập chờn, hãy giảm `Batch size` xuống `15` hoặc chuyển sang mô hình `Gemini 2.0 Flash Lite`.

---

## 📄 Bản Quyền & Giấy Phép

Phát triển dành riêng cho hệ sinh thái **e-novels**. Sử dụng Google Gemini API theo điều khoản dịch vụ của Google LLC.