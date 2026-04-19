# qlddhcm

Hệ thống WebGIS quản lý đất đai, bao gồm:
- Frontend React + Vite
- Backend Node.js/Express trong thư mục `backend_guide`
- Proxy API nội bộ qua Vite trong môi trường development

## Yêu cầu

- Node.js 18+ (khuyến nghị Node.js 20 LTS)
- npm 9+

## Cài đặt

```bash
npm install
```

## Chạy dự án

### 1. Chạy frontend

```bash
npm run dev
```

hoặc

```bash
npm run dev:frontend
```

Frontend chạy tại: `http://localhost:3000`

### 2. Chạy backend

```bash
npm run dev:backend
```

Backend chạy tại: `http://localhost:3004`

### 3. Chạy đồng thời frontend + backend

```bash
npm run dev:all
```

Script này chạy 2 process độc lập bằng `concurrently`.

## Build và preview

```bash
npm run build
npm run preview
```

## Kiểm tra TypeScript

```bash
npm run lint
```



### Tùy chỉnh bằng biến môi trường

Tạo file `.env.local` ở root dự án:

```env
VITE_API_URL=https://api.tenmien.com
VITE_DEV_API_PROXY_TARGET=https://api.tenmien.com
```

Ý nghĩa:

1. `VITE_API_URL`: frontend gọi trực tiếp host API này.
2. `VITE_DEV_API_PROXY_TARGET`: Vite proxy chuyển tiếp `/api` và `/uploads` đến host này trong lúc dev.

## Cấu trúc chính

- `components/`: UI components
- `pages/`: các trang chính
- `hooks/`: logic dùng lại (map, editor, export)
- `services/`: API client
- `backend_guide/`: backend Express, routes, middleware

## Ghi chú vận hành

- Upload tệp dùng endpoint `/uploads` (đi qua proxy trong dev).
- Nếu backend không chạy, các chức năng dữ liệu/map sẽ lỗi do không gọi được `/api`.
