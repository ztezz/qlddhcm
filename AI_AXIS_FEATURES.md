# Axis AI Assistant

`Axis` là trợ lý AI tích hợp trong hệ thống QLDDHCM, hỗ trợ người dùng tra cứu dữ liệu đất đai, phân tích biến động thửa đất, thao tác bản đồ và mở thửa trực tiếp trong Editor.

## Mục tiêu

Axis không chỉ là OCR. Trợ lý này được thiết kế để trở thành lớp tương tác thông minh cho hệ thống WebGIS:

- Hỏi đáp nghiệp vụ đất đai bằng tiếng Việt tự nhiên.
- Tra cứu thửa đất từ câu hỏi như `tìm thửa 125 tờ 32`.
- Phân tích lịch sử biến động trước/sau của thửa đất.
- Zoom tới thửa trên bản đồ từ kết quả AI.
- Mở thửa vào Editor để chỉnh sửa/cập nhật.
- Hỗ trợ fallback nội bộ nếu chưa cấu hình API key AI.

## Thành phần chính

| Thành phần | File |
|---|---|
| Floating chat UI | `components/ai/FloatingAiAssistant.tsx` |
| Frontend AI API | `services/aiApi.ts` |
| Backend AI routes | `backend_guide/routes_ai.js` |
| Mount backend route | `backend_guide/server.js` |
| Phân tích biến động trong Editor | `components/editor/ParcelHistoryPanel.tsx` |
| Phân tích biến động trong Admin | `components/admin/ParcelHistoryManager.tsx` |
| Zoom AI trên MapPage | `pages/MapPage.tsx` |
| Mở thửa AI trong Editor | `pages/EditorPage.tsx` |

## Cấu hình AI Provider

Axis dùng lại nhóm cấu hình AI hiện có trong `system_settings`.

### 9router

| Key | Ý nghĩa |
|---|---|
| `ocr_use_9router` | Bật/tắt 9router |
| `ocr_9router_key` | API key 9router |
| `ocr_9router_model` | Model name, ví dụ `9router/google/gemini-1.5-flash` |
| `ocr_9router_endpoint` | Endpoint API, mặc định `https://thzi-chinraoto.hf.space/v1` |

### Gemini

| Key | Ý nghĩa |
|---|---|
| `ocr_use_gemini` | Bật/tắt Gemini |
| `ocr_gemini_key` | Google Gemini API key |
| `ocr_gemini_model` | Model name, ví dụ `gemini-flash-latest` |

### Thứ tự ưu tiên

1. 9router nếu bật và có API key.
2. Gemini nếu bật và có API key.
3. Fallback nội bộ nếu chưa cấu hình hoặc AI cloud lỗi.

## Floating Chat

Axis xuất hiện dưới dạng nút nổi ở góc dưới bên phải sau khi người dùng đăng nhập.

Người dùng có thể hỏi:

```text
Tìm thửa 125 tờ 32
```

```text
Thửa 125 tờ 32 có lịch sử biến động gì?
```

```text
Cách xuất báo cáo biến động?
```

```text
Cách chỉnh sửa thửa trong Editor?
```

Chat có sẵn các quick prompts:

- Hướng dẫn tra cứu thửa đất
- Cách xem lịch sử biến động?
- Cách xuất báo cáo biến động?
- Cách chỉnh sửa thửa trong Editor?

## Tra Cứu Dữ Liệu Thật

Endpoint `/api/ai/chat` có khả năng tự nhận diện intent tra cứu thửa đất.

Ví dụ:

```text
Tìm thửa 55 tờ 12
```

Backend sẽ:

1. Parse `số tờ` và `số thửa` từ câu tiếng Việt.
2. Lấy danh sách bảng từ `spatial_tables_registry`.
3. Tự dò các tên cột phổ biến như `sodoto`, `so_to`, `shbando`, `sothua`, `so_thua`, `shthua`.
4. Query các bảng đã đăng ký.
5. Trả kết quả gồm thuộc tính và `geometry`.

Nếu người dùng hỏi lịch sử/biến động, backend sẽ lấy thêm lịch sử gần nhất từ bảng `parcel_history`.

## Hành Động Bản Đồ

Khi Axis tìm thấy thửa, khung chat hiển thị các hành động:

### Zoom tới thửa

Nút này phát event:

```ts
window.dispatchEvent(new CustomEvent('ai:zoom-parcel', { detail: parcel }))
```

`MapPage` lắng nghe event này để:

- Highlight thửa trên bản đồ.
- Fit view tới geometry.
- Set selected parcel để popup/thao tác bản đồ hoạt động như kết quả tra cứu bình thường.

### Mở trong Editor

Nút này lưu parcel vào `sessionStorage`:

```ts
sessionStorage.setItem('ai_editor_parcel', JSON.stringify(parcel));
```

Sau đó chuyển sang:

```text
/chinhsuabanve
```

`EditorPage` tự nạp thửa vào `editSource`, set đúng:

- `gid`
- `madinhdanh`
- `sodoto`
- `sothua`
- `loaidat`
- `dientich`
- `targetTable`
- geometry
- selection hiện tại
- danh sách đỉnh

## AI Phân Tích Biến Động

Endpoint:

```http
POST /api/ai/analyze-parcel-history
```

Payload:

```ts
{
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  before: Record<string, any> | null,
  after: Record<string, any> | null,
  context?: Record<string, any>
}
```

Axis phân tích:

- Tóm tắt biến động.
- Field nào thay đổi.
- Diện tích trước/sau.
- Cảnh báo nếu diện tích thay đổi lớn.
- Gợi ý kiểm tra tiếp theo.

Tính năng này có trong:

- Editor sidebar, tab `Lịch sử`.
- Quản trị, trang `Lịch sử biến động`.

## Fallback Nội Bộ

Nếu không có API key hoặc AI provider lỗi, Axis vẫn hoạt động bằng fallback rule-based.

Fallback có thể:

- Hướng dẫn thao tác cơ bản.
- Trả kết quả tra cứu thửa nếu backend tìm thấy dữ liệu thật.
- Tóm tắt biến động dựa trên `snapshot_before` và `snapshot_after`.
- Cảnh báo khi diện tích thay đổi trên 20%.

## Quyền Truy Cập

Các endpoint AI yêu cầu đăng nhập qua JWT:

- `/api/ai/chat`
- `/api/ai/analyze-parcel-history`

Các thao tác phục hồi/xóa lịch sử vẫn được kiểm soát riêng bằng quyền:

| Quyền | Ý nghĩa |
|---|---|
| `RESTORE_PARCEL_HISTORY` | Phục hồi lịch sử biến động |
| `DELETE_PARCEL_HISTORY` | Xóa lịch sử biến động |

## Logging

Các hành động AI được ghi vào `system_logs`:

| Action | Khi nào |
|---|---|
| `AI_CHAT` | Người dùng hỏi Axis |
| `AI_ANALYZE_PARCEL_HISTORY` | Axis phân tích biến động thửa đất |

## Gợi Ý Phát Triển Tiếp

- AI tạo báo cáo biến động theo khoảng thời gian bằng ngôn ngữ tự nhiên.
- AI lọc bản đồ theo câu hỏi như `hiển thị các thửa ODT trên 200m2`.
- AI tự tạo truy vấn nâng cao cho bảng giá đất.
- AI đọc hồ sơ PDF và đối chiếu với dữ liệu thửa.
- AI cảnh báo rủi ro hình học/topology theo lô dữ liệu.
