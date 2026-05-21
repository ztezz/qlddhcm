-- Script để xóa ràng buộc UNIQUE trên cột madinhdanh
-- Chạy script này trên database để cho phép mã định danh trùng lặp

-- Lấy danh sách tất cả các bảng trong spatial_tables_registry
DO $$
DECLARE
    table_record RECORD;
    constraint_record RECORD;
    index_record RECORD;
BEGIN
    -- Duyệt qua tất cả các bảng đã đăng ký
    FOR table_record IN
        SELECT table_name FROM spatial_tables_registry
    LOOP
        RAISE NOTICE 'Processing table: %', table_record.table_name;

        -- Xóa các UNIQUE constraint trên cột madinhdanh
        FOR constraint_record IN
            SELECT constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = table_record.table_name
                AND tc.constraint_type = 'UNIQUE'
                AND ccu.column_name = 'madinhdanh'
        LOOP
            EXECUTE format('ALTER TABLE "%I" DROP CONSTRAINT IF EXISTS "%I"',
                table_record.table_name, constraint_record.constraint_name);
            RAISE NOTICE 'Dropped constraint: % on table %',
                constraint_record.constraint_name, table_record.table_name;
        END LOOP;

        -- Xóa các UNIQUE index trên cột madinhdanh
        FOR index_record IN
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = table_record.table_name
                AND indexname LIKE '%madinhdanh%uniq%'
        LOOP
            EXECUTE format('DROP INDEX IF EXISTS "%I"', index_record.indexname);
            RAISE NOTICE 'Dropped index: % on table %',
                index_record.indexname, table_record.table_name;
        END LOOP;

    END LOOP;

    RAISE NOTICE 'Completed removing UNIQUE constraints on madinhdanh column';
END $$;

-- Kiểm tra kết quả
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
