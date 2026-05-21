-- Script để xóa các trigger cũ liên quan đến mã định danh
-- Chạy script này TRƯỚC khi chạy update_geohash_12chars.sql

DO $$
DECLARE
    table_record RECORD;
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'Starting removal of old triggers...';

    -- Duyệt qua tất cả các bảng đã đăng ký
    FOR table_record IN
        SELECT table_name FROM spatial_tables_registry
    LOOP
        RAISE NOTICE 'Processing table: %', table_record.table_name;

        -- Xóa các trigger liên quan đến mã định danh
        FOR trigger_record IN
            SELECT trigger_name
            FROM information_schema.triggers
            WHERE event_object_table = table_record.table_name
                AND (
                    trigger_name LIKE '%madinhdanh%'
                    OR trigger_name LIKE '%ma_dinh_danh%'
                    OR trigger_name LIKE '%parcel_code%'
                    OR trigger_name LIKE '%cap_nhat%'
                )
        LOOP
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON "%I"',
                trigger_record.trigger_name, table_record.table_name);
            RAISE NOTICE 'Dropped trigger: % on table %',
                trigger_record.trigger_name, table_record.table_name;
        END LOOP;

    END LOOP;

    RAISE NOTICE 'Completed removing old triggers';
END $$;

-- Xóa các function cũ liên quan đến trigger
DROP FUNCTION IF EXISTS cap_nhat_madinhdanh_phuc_hop() CASCADE;
DROP FUNCTION IF EXISTS update_madinhdanh() CASCADE;
DROP FUNCTION IF EXISTS generate_parcel_code() CASCADE;
DROP FUNCTION IF EXISTS auto_update_madinhdanh() CASCADE;

-- Kiểm tra kết quả
SELECT
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN (SELECT table_name FROM spatial_tables_registry)
    AND (
        trigger_name LIKE '%madinhdanh%'
        OR trigger_name LIKE '%ma_dinh_danh%'
        OR trigger_name LIKE '%parcel_code%'
    )
ORDER BY event_object_table, trigger_name;
