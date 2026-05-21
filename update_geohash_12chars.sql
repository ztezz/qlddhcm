-- Script để cập nhật lại tất cả mã định danh thành geohash 12 ký tự
-- Chạy sau khi đã xóa ràng buộc UNIQUE

DO $$
DECLARE
    table_record RECORD;
    row_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting geohash update to 12 characters...';

    -- Duyệt qua tất cả các bảng đã đăng ký
    FOR table_record IN
        SELECT table_name FROM spatial_tables_registry
    LOOP
        RAISE NOTICE 'Processing table: %', table_record.table_name;

        -- Kiểm tra xem bảng có cột madinhdanh và geometry không
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = table_record.table_name
            AND column_name = 'madinhdanh'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = table_record.table_name
            AND column_name = 'geometry'
        ) THEN
            -- Cập nhật mã định danh thành geohash 12 ký tự
            EXECUTE format('
                UPDATE "%I"
                SET madinhdanh = ST_GeoHash(
                    CASE
                        WHEN ST_SRID(geometry) = 4326 THEN ST_Centroid(geometry)
                        WHEN ST_SRID(geometry) = 0 THEN ST_Centroid(ST_SetSRID(geometry, 4326))
                        ELSE ST_Centroid(ST_Transform(geometry, 4326))
                    END,
                    12
                )
                WHERE geometry IS NOT NULL
            ', table_record.table_name);

            GET DIAGNOSTICS row_count = ROW_COUNT;
            total_updated := total_updated + row_count;

            RAISE NOTICE 'Updated % rows in table %', row_count, table_record.table_name;
        ELSE
            RAISE NOTICE 'Skipped table % (missing madinhdanh or geometry column)', table_record.table_name;
        END IF;
    END LOOP;

    RAISE NOTICE 'Completed! Total rows updated: %', total_updated;
END $$;

-- Kiểm tra kết quả: Hiển thị một vài mã định danh mẫu từ mỗi bảng
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT table_name FROM spatial_tables_registry LIMIT 5
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = table_record.table_name
            AND column_name = 'madinhdanh'
        ) THEN
            RAISE NOTICE 'Sample from table %:', table_record.table_name;
            EXECUTE format('
                SELECT madinhdanh, LENGTH(madinhdanh) as len
                FROM "%I"
                WHERE madinhdanh IS NOT NULL
                LIMIT 3
            ', table_record.table_name);
        END IF;
    END LOOP;
END $$;
