const DATABASES_COUNT = 'sudo -u postgres /usr/bin/psql -t -A -c "Select Count(*) from pg_database"';

const LIST_DATABASES = `sudo -u postgres /usr/bin/psql -t -A -c "
SELECT json_agg(row_to_json(t))
FROM (
    SELECT
        d.datname AS name,
        pg_database_size(d.datname) AS size,
        d.datcollate AS collation,
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = d.datname) THEN 'active'
            ELSE 'inactive'
        END AS status
    FROM
        pg_database d
) t;
" | jq -c '.'
`;

/*
 * PostgreSQL Performance Metrics with Research-Based Latency Calculations
 * READ_LATENCY Formula: (0.1ms x cache_hit_ratio + 10ms x cache_miss_ratio)
 * WRITE_LATENCY Formula: (0.2ms x cache_hit_ratio + 15ms x cache_miss_ratio)
 *
 * Research Sources:
 * - PostgreSQL Buffer Cache: https://www.postgresql.org/docs/current/runtime-config-resource.html
 * - PostgreSQL WAL: https://www.postgresql.org/docs/current/wal-intro.html
 * - SSD Performance: https://www.anandtech.com/show/2738/6
 * - Storage Write Penalties: https://www.usenix.org/conference/fast20/presentation/yang-jinhong
 * - Database System Concepts 7th Edition, Chapter 10
 * - High Performance MySQL 4th Edition, Chapter 8
 */
const PERFORMANCE_METRICS = `sudo -u postgres /usr/bin/psql -c "
WITH bg_writer_stats AS (
    SELECT buffers_checkpoint + buffers_clean + buffers_backend AS total_buffers_written
    FROM pg_stat_bgwriter
),
uptime AS (
    SELECT EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())) AS uptime_seconds
),
cache_stats AS (
    SELECT 
        SUM(blks_read) AS total_blks_read,
        SUM(blks_hit) AS total_blks_hit,
        CASE 
            WHEN (SUM(blks_read) + SUM(blks_hit)) > 0 
            THEN (SUM(blks_hit) * 100.0) / (SUM(blks_read) + SUM(blks_hit))
            ELSE 0 
        END AS cache_hit_ratio
    FROM pg_stat_database
)
SELECT row_to_json(performance_data) AS result
FROM (
    SELECT 
        ROUND((
            CASE WHEN uptime.uptime_seconds > 0
                 THEN (cache_stats.total_blks_read / uptime.uptime_seconds) * 3600 / 3600
                 ELSE 0 END
        )::numeric, 2) AS READ_IOPS,
        ROUND((
            CASE WHEN uptime.uptime_seconds > 0
                 THEN (bg_writer_stats.total_buffers_written / uptime.uptime_seconds) * 3600 / 3600
                 ELSE 0 END
        )::numeric, 2) AS WRITE_IOPS,
        ROUND((
            CASE WHEN uptime.uptime_seconds > 0
                 THEN (cache_stats.total_blks_read / uptime.uptime_seconds) * 3600 * current_setting('block_size')::BIGINT / 3600 / 1000000
                 ELSE 0 END
        )::numeric, 3) AS READ_THROUGHPUT,
        ROUND((
            CASE WHEN uptime.uptime_seconds > 0
                 THEN (bg_writer_stats.total_buffers_written / uptime.uptime_seconds) * 3600 * current_setting('block_size')::BIGINT / 3600 / 1000000
                 ELSE 0 END
        )::numeric, 3) AS WRITE_THROUGHPUT,
        ROUND((
            CASE 
                WHEN (cache_stats.total_blks_read + cache_stats.total_blks_hit) = 0 THEN 0
                WHEN cache_stats.cache_hit_ratio >= 98 THEN 0.3
                WHEN cache_stats.cache_hit_ratio >= 95 THEN 0.6
                WHEN cache_stats.cache_hit_ratio >= 90 THEN 1.1
                WHEN cache_stats.cache_hit_ratio >= 80 THEN 2.1
                WHEN cache_stats.cache_hit_ratio >= 70 THEN 3.1
                WHEN cache_stats.cache_hit_ratio >= 60 THEN 4.1
                WHEN cache_stats.cache_hit_ratio >= 50 THEN 5.1
                ELSE 8.5
            END
        )::numeric, 2) AS READ_LATENCY,
        ROUND((
            CASE 
                WHEN (cache_stats.total_blks_read + cache_stats.total_blks_hit) = 0 THEN 0
                WHEN cache_stats.cache_hit_ratio >= 98 THEN 0.5
                WHEN cache_stats.cache_hit_ratio >= 95 THEN 0.9
                WHEN cache_stats.cache_hit_ratio >= 90 THEN 1.7
                WHEN cache_stats.cache_hit_ratio >= 80 THEN 3.2
                WHEN cache_stats.cache_hit_ratio >= 70 THEN 4.7
                WHEN cache_stats.cache_hit_ratio >= 60 THEN 6.2
                WHEN cache_stats.cache_hit_ratio >= 50 THEN 7.7
                ELSE 12.0
            END
        )::numeric, 2) AS WRITE_LATENCY,
        ROUND((
            CASE 
                WHEN (cache_stats.total_blks_read + bg_writer_stats.total_buffers_written) = 0 THEN 0
                ELSE (
                    (CASE 
                        WHEN (cache_stats.total_blks_read + cache_stats.total_blks_hit) = 0 THEN 0
                        WHEN cache_stats.cache_hit_ratio >= 98 THEN 0.3
                        WHEN cache_stats.cache_hit_ratio >= 95 THEN 0.6
                        WHEN cache_stats.cache_hit_ratio >= 90 THEN 1.1
                        WHEN cache_stats.cache_hit_ratio >= 80 THEN 2.1
                        WHEN cache_stats.cache_hit_ratio >= 70 THEN 3.1
                        WHEN cache_stats.cache_hit_ratio >= 60 THEN 4.1
                        WHEN cache_stats.cache_hit_ratio >= 50 THEN 5.1
                        ELSE 8.5
                    END) * cache_stats.total_blks_read +
                    (CASE 
                        WHEN (cache_stats.total_blks_read + cache_stats.total_blks_hit) = 0 THEN 0
                        WHEN cache_stats.cache_hit_ratio >= 98 THEN 0.5
                        WHEN cache_stats.cache_hit_ratio >= 95 THEN 0.9
                        WHEN cache_stats.cache_hit_ratio >= 90 THEN 1.7
                        WHEN cache_stats.cache_hit_ratio >= 80 THEN 3.2
                        WHEN cache_stats.cache_hit_ratio >= 70 THEN 4.7
                        WHEN cache_stats.cache_hit_ratio >= 60 THEN 6.2
                        WHEN cache_stats.cache_hit_ratio >= 50 THEN 7.7
                        ELSE 12.0
                    END) * bg_writer_stats.total_buffers_written
                ) / (cache_stats.total_blks_read + bg_writer_stats.total_buffers_written)
            END
        )::numeric, 2) AS SERVER_IO_LATENCY,
        ROUND(cache_stats.cache_hit_ratio::numeric, 2) AS CACHE_HIT_RATIO,
        CASE 
            WHEN (cache_stats.total_blks_read + bg_writer_stats.total_buffers_written) = 0 THEN 'Unknown'
            WHEN cache_stats.total_blks_read * 1.0 / (cache_stats.total_blks_read + bg_writer_stats.total_buffers_written) >= 0.8 THEN 'Read-heavy'
            WHEN cache_stats.total_blks_read * 1.0 / (cache_stats.total_blks_read + bg_writer_stats.total_buffers_written) <= 0.3 THEN 'Write-heavy'
            ELSE 'Balanced'
        END AS WORKLOAD_TYPE,
        CASE 
            WHEN (cache_stats.total_blks_read + cache_stats.total_blks_hit) = 0 THEN 'N/A - Insufficient data'
            WHEN cache_stats.cache_hit_ratio >= 98 THEN 'Excellent ( >=98% cache hit ratio)'
            WHEN cache_stats.cache_hit_ratio >= 95 THEN 'Very good ( >=95% cache hit ratio)'
            WHEN cache_stats.cache_hit_ratio >= 85 THEN 'Good ( >=85% cache hit ratio)'
            WHEN cache_stats.cache_hit_ratio >= 70 THEN 'Poor ( >=70% cache hit ratio)'
            WHEN cache_stats.cache_hit_ratio >= 50 THEN 'Bad ( >=50% cache hit ratio)'
            WHEN cache_stats.cache_hit_ratio >= 30 THEN 'Very bad ( >=30% cache hit ratio)'
            ELSE 'Awful ( <30% cache hit ratio)'
        END AS assessment
    FROM bg_writer_stats, uptime, cache_stats
) performance_data;
" -t -A
`;

export { DATABASES_COUNT, LIST_DATABASES, PERFORMANCE_METRICS };
