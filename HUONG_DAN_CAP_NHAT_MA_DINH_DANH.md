# Hướng dẫn cập nhật chức năng Mã định danh

## Tổng quan thay đổi

Đã thực hiện các thay đổi sau để cho phép mã định danh trùng lặp và tự động cập nhật mã geohash:

### 1. Thay đổi Backend (routes_spatial.js)

✅ **Đã hoàn thành:**
- Import thư viện `ngeohash`
- Cập nhật `generateGeohashParcelCode()` và `generateGeohashFromGeoJSON()` để tạo mã 12 ký tự (thay vì 15)
- Xóa hàm `generateUniqueParcelCode()` - không còn kiểm tra trùng lặp
- Cập nhật `syncTableSchema()` - không tạo UNIQUE index nữa
- Cập nhật endpoint `POST /data/:table` - tự động tạo mã geohash khi thêm mới
- Cập nhật endpoint `PUT /data/:table/:gid` - tự động cập nhật mã geohash khi chỉnh sửa
- Cập nhật endpoint `POST /data/:table/upload` - tự động tạo mã geohash khi upload
- Cập nhật endpoint `POST /data/:table/bulk` - tự động tạo mã geohash cho bulk import
- Cập nhật endpoint `POST /spatial-tables/import-geojson-parcels` - không kiểm tra trùng
- Xóa `UNIQUE` constraint khi tạo bảng mới

### 2. Scripts SQL

Đã tạo 2 file SQL:

#### `remove_unique_constraints.sql`
- Xóa tất cả UNIQUE constraints trên cột `madinhdanh`
- Xóa tất cả UNIQUE indexes trên cột `madinhdanh`
- Áp dụng cho tất cả bảng trong `spatial_tables_registry`

#### `update_geohash_12chars.sql`
- Cập nhật lại tất cả mã định danh hiện có thành geohash 12 ký tự
- Tự động xử lý các SRID khác nhau (4326, 9210, etc.)

## Các bước triển khai

### Bước 1: Backup Database
```bash
pg_dump -U postgres -d your_database > backup_before_update.sql
```

### Bước 2: Chạy script xóa trigger cũ
```bash
psql -U postgres -d your_database -f remove_old_triggers.sql
```

### Bước 3: Chạy script xóa UNIQUE constraints
```bash
psql -U postgres -d your_database -f remove_unique_constraints.sql
```

### Bước 4: Chạy script cập nhật mã geohash
```bash
psql -U postgres -d your_database -f update_geohash_12chars.sql
```

### Bước 5: Khởi động lại Backend
```bash
cd backend_guide
npm start
```

### Bước 6: Khởi động lại Frontend
```bash
npm run dev
```

## Kiểm tra sau khi triển khai

### 1. Kiểm tra UNIQUE constraints đã bị xóa
```sql
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE ccu.column_name = 'madinhdanh'
    AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name;
```
Kết quả phải trả về 0 rows.

### 2. Kiểm tra độ dài mã định danh
```sql
SELECT 
    table_name,
    MIN(LENGTH(madinhdanh)) as min_len,
    MAX(LENGTH(madinhdanh)) as max_len,
    COUNT(*) as total_rows
FROM (
    SELECT 'table1' as table_name, madinhdanh FROM table1
    UNION ALL
    SELECT 'table2' as table_name, madinhdanh FROM table2
    -- Thêm các bảng khác...
) combined
WHERE madinhdanh IS NOT NULL
GROUP BY table_name;
```
Tất cả phải có độ dài 12 ký tự.

### 3. Test thêm mới thửa đất
- Vào trang Quản lý thửa đất
- Thêm mới một thửa đất với file GeoJSON/Shapefile
- Kiểm tra mã định danh được tạo tự động (12 ký tự)
- Thêm một thửa đất khác cùng vị trí
- Xác nhận có thể lưu thành công (cho phép trùng)

### 4. Test chỉnh sửa thửa đất
- Chọn một thửa đất hiện có
- Chỉnh sửa geometry (thay đổi vị trí)
- Lưu lại
- Kiểm tra mã định danh đã được cập nhật theo vị trí mới

### 5. Test import GeoJSON
- Vào Admin > Layer Manager
- Import file GeoJSON với nhiều features
- Kiểm tra tất cả features đều có mã định danh 12 ký tự
- Kiểm tra có thể import cùng file nhiều lần (cho phép trùng)

## Lưu ý quan trọng

### ⚠️ Mã định danh có thể trùng lặp
- Mã định danh giờ đây **CHỈ phụ thuộc vào tọa độ** (geohash)
- Hai thửa đất ở cùng vị trí sẽ có cùng mã định danh
- Điều này là **BÌNH THƯỜNG** và được phép

### 🔄 Tự động cập nhật
- Mỗi khi **thêm mới** thửa đất → tạo mã geohash mới
- Mỗi khi **chỉnh sửa** geometry → cập nhật lại mã geohash
- Mỗi khi **import** dữ liệu → tạo mã geohash cho tất cả

### 📏 Độ chính xác Geohash 12 ký tự
- Độ chính xác: ~3.7cm x 1.9cm
- Phù hợp cho quản lý thửa đất
- Đủ để phân biệt các thửa đất gần nhau

## Rollback (nếu cần)

Nếu cần quay lại phiên bản cũ:

```bash
# 1. Restore database từ backup
psql -U postgres -d your_database < backup_before_update.sql

# 2. Revert code backend
git checkout HEAD~1 backend_guide/routes_spatial.js

# 3. Khởi động lại services
npm run dev:all
```

## Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Log backend: `backend_guide/server.js` console output
2. Log database: PostgreSQL logs
3. Browser console: F12 > Console tab

---

**Ngày cập nhật:** 2026-05-21  
**Phiên bản:** 2.0 - Cho phép mã định danh trùng lặp
