# QLDDHCM — Hệ thống WebGIS Quản lý Đất đai Hồ Chí Minh

Ứng dụng web full-stack cho phép tra cứu, quản lý và chỉnh sửa dữ liệu địa chính (thửa đất, bản đồ, giá đất) trên nền bản đồ tương tác OpenLayers.

## Tính năng chính

- **Bản đồ địa chính tương tác** — xem, tìm kiếm thửa đất, WMS/XYZ layers, đo đạc diện tích/khoảng cách
- **Editor vẽ thửa đất** — vẽ, chỉnh sửa, tách/gộp thửa đất, undo/redo
- **Import/Export** — DXF, Shapefile (.shp), GeoJSON, Excel (.xlsx)
- **OCR tọa độ** — trích xuất tọa độ từ ảnh scan bản đồ
- **Chuyển đổi tọa độ** — VN2000 ↔ WGS84
- **Xuất PDF** — giấy chứng nhận quyền sử dụng đất theo mẫu
- **QR Code** — tạo mã QR cho từng thửa đất
- **Thống kê & Dashboard** — biểu đồ tổng hợp dữ liệu đất đai
- **Tra cứu giá đất** — theo bảng giá đất khu vực
- **Nhắn tin nội bộ & thông báo** — giữa các tài khoản trong hệ thống
- **Phân quyền 3 cấp** — ADMIN / EDITOR / VIEWER

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4 |
| Bản đồ | OpenLayers 10, Turf.js, proj4, ngeohash |
| 3D Globe | Three.js, @react-three/fiber |
| Charts | Recharts |
| OCR | Tesseract.js |
| Backend | Node.js, Express.js |
| Database | PostgreSQL + PostGIS (Supabase) |
| Auth | JWT (HS256), Cloudflare Turnstile CAPTCHA |
| Deploy | Cloudflare Pages (frontend) + Hugging Face Spaces (backend) |

## Yêu cầu

- Node.js 18+ (khuyến nghị Node.js 20 LTS)
- npm 9+
- PostgreSQL với PostGIS (hoặc dùng Supabase)

## Cài đặt

```bash
npm install
```

## Cấu hình môi trường

### Frontend — tạo file `.env.local` ở thư mục gốc:

```env
VITE_API_URL=https://api.tenmien.com
VITE_DEV_API_PROXY_TARGET=http://localhost:3004
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_URL` | URL API backend (dùng khi build production) |
| `VITE_DEV_API_PROXY_TARGET` | Vite proxy chuyển tiếp `/api` và `/uploads` đến backend khi dev |
| `VITE_TURNSTILE_SITE_KEY` | Site key Cloudflare Turnstile cho CAPTCHA |

### Backend — tạo file `backend_guide/.env`:

```env
# Database
DB_USER=postgres.your_project
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_NAME=postgres
DB_PASSWORD=your_password
DB_PORT=6543

# JWT
JWT_SECRET=your_jwt_secret

# Email (Brevo/SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_smtp_key

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your_turnstile_secret
```

Tham khảo file mẫu tại `backend_guide/db_config.example.js`.

## Chạy dự án

### Chạy đồng thời frontend + backend (khuyến nghị)

```bash
npm run dev:all
```

### Chạy riêng từng phần

```bash
# Chỉ frontend — http://localhost:3000
npm run dev:frontend

# Chỉ backend — http://localhost:3004
npm run dev:backend
```

## Build & Deploy

```bash
# Build production
npm run build

# Preview với Wrangler (Cloudflare)
npm run preview

# Deploy lên Cloudflare Pages
npm run deploy
```

## Kiểm tra TypeScript

```bash
npm run lint
```

## Cấu trúc thư mục

```
qlddhcm/
├── pages/              # Các trang (MapPage, EditorPage, AdminPage, ...)
├── components/
│   ├── map/            # Bản đồ (LayerControl, SearchPanel, ParcelPopup, ...)
│   ├── editor/         # Editor vẽ thửa đất (Toolbar, Sidebar, Modals, ...)
│   ├── admin/          # Quản trị (UserManager, ParcelList, LayerManager, ...)
│   ├── tools/          # Công cụ (QRGenerator, CoordinateConverter)
│   └── common/         # Components dùng chung
├── hooks/              # Custom hooks (useMap, useEditorDraft, useEditorHistory, ...)
├── services/           # API client (authService, gisService, adminService, ...)
├── utils/              # Tiện ích (geometryUtils, parcelExport, editorStyles, ...)
├── backend_guide/      # Backend Express.js
│   ├── server.js       # Entry point backend
│   ├── routes_auth.js
│   ├── routes_spatial.js
│   ├── routes_config.js
│   ├── routes_users.js
│   ├── routes_stats.js
│   ├── routes_messages.js
│   ├── routes_notifications.js
│   ├── routes_proxy.js
│   ├── routes_conversion.js
│   ├── routes_map_admin.js
│   ├── routes_system.js
│   ├── middleware_auth.js
│   └── db_config.js    # Cấu hình kết nối PostgreSQL
├── public/             # Static assets
├── dist/               # Build output
├── vite.config.ts
├── tsconfig.json
└── wrangler.jsonc      # Cloudflare Pages config
```

## Phân quyền

| Role | Quyền |
|---|---|
| `ADMIN` | Toàn quyền: quản lý người dùng, cấu hình hệ thống, import/export, backup |
| `EDITOR` | Xem + chỉnh sửa thửa đất, import dữ liệu |
| `VIEWER` | Chỉ xem bản đồ và tra cứu thông tin |
| Guest | Xem bản đồ công khai (không đăng nhập) |

## Ghi chú vận hành

- File upload (avatar, shapefile) đi qua endpoint `/uploads`, proxy qua Vite trong môi trường dev.
- Backend tự động migrate schema (thêm cột/bảng) khi khởi động.
- Nếu backend không chạy, các chức năng dữ liệu và bản đồ sẽ báo lỗi do không gọi được `/api`.
- Tin nhắn trong thùng rác tự động xóa sau 30 ngày.
