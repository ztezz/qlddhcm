import pg from 'pg';
import dbConfig from '../backend_guide/db_config.js';

const pool = new pg.Pool({ ...dbConfig, connectionTimeoutMillis: 10000 });

try {
  await pool.query(`
    CREATE OR REPLACE FUNCTION cap_nhat_madinhdanh_phuc_hop()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
        has_madinhdanh BOOLEAN;
        has_geometry   BOOLEAN;
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = TG_TABLE_NAME AND column_name = 'madinhdanh'
        ) INTO has_madinhdanh;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = TG_TABLE_NAME AND column_name = 'geometry'
        ) INTO has_geometry;

        IF NOT has_madinhdanh OR NOT has_geometry THEN
            RETURN NEW;
        END IF;

        IF NEW.geometry IS NOT NULL THEN
            NEW.madinhdanh := ST_GeoHash(ST_Transform(ST_Centroid(NEW.geometry), 4326), 12);
        END IF;

        RETURN NEW;
    END;
    $$
  `);

  await pool.query(`DROP TRIGGER IF EXISTS trg_cap_nhat_madinhdanh_insert_parcel_history ON parcel_history`);
  await pool.query(`DROP TRIGGER IF EXISTS trg_cap_nhat_madinhdanh_update_parcel_history ON parcel_history`);
  await pool.query(`ALTER TABLE parcel_history ADD COLUMN IF NOT EXISTS snapshot_before JSONB`);
  await pool.query(`ALTER TABLE parcel_history ADD COLUMN IF NOT EXISTS snapshot_after JSONB`);
  await pool.query(`
    UPDATE parcel_history
    SET snapshot_before = COALESCE(snapshot_before, CASE WHEN action <> 'CREATE' THEN snapshot ELSE NULL END),
        snapshot_after  = COALESCE(snapshot_after,  CASE WHEN action = 'CREATE' THEN snapshot ELSE NULL END)
    WHERE snapshot IS NOT NULL
      AND (snapshot_before IS NULL OR snapshot_after IS NULL)
  `);

  console.log('Fixed parcel_history geohash trigger issue and added before/after snapshots.');
} finally {
  await pool.end();
}
