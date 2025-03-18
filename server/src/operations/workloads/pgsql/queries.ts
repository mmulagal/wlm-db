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

const PERFORMANCE_METRICS = `sudo -u postgres /usr/bin/psql -c "
WITH io_stats AS (
    SELECT 
        SUM(blks_read) AS num_of_reads,
        SUM(blks_hit) AS num_of_writes, -- Adjust this based on your actual write activity tracking
        SUM(blks_read) * current_setting('block_size')::BIGINT AS num_of_bytes_read,
        SUM(blks_hit) * current_setting('block_size')::BIGINT AS num_of_bytes_written, -- Adjust this based on your actual write activity tracking
        0 AS io_stall_read_ms, -- Placeholder as pg_stat_database does not provide read stall time
        0 AS io_stall_write_ms, -- Placeholder as pg_stat_database does not provide write stall time
        0 AS io_stall -- Placeholder as pg_stat_database does not provide total stall time
    FROM pg_stat_database
),
server_start_time AS (
    SELECT pg_postmaster_start_time() AS restart_time
),
time_since_restart AS (
    SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - restart_time)) AS seconds_since_restart
    FROM server_start_time
)
SELECT json_build_object(
    'READ_IOPS', ROUND((CAST(num_of_reads AS numeric) / seconds_since_restart)::numeric, 2),
    'WRITE_IOPS', ROUND((CAST(num_of_writes AS numeric) / seconds_since_restart)::numeric, 2),
    'READ_THROUGHPUT', ROUND((CAST(num_of_bytes_read AS numeric) / seconds_since_restart / 1000000)::numeric, 3),
    'WRITE_THROUGHPUT', ROUND((CAST(num_of_bytes_written AS numeric) / seconds_since_restart / 1000000)::numeric, 3),
    'READ_LATENCY', CASE WHEN num_of_reads = 0 THEN 0 ELSE ROUND((io_stall_read_ms / num_of_reads)::numeric, 2) END,
    'WRITE_LATENCY', CASE WHEN num_of_writes = 0 THEN 0 ELSE ROUND((io_stall_write_ms / num_of_writes)::numeric, 2) END,
    'SERVER_IO_LATENCY', CASE WHEN (num_of_reads = 0 AND num_of_writes = 0) THEN 0 ELSE ROUND((CAST(io_stall AS numeric) / (num_of_reads + num_of_writes))::numeric, 2) END,
    'assessment', CASE 
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) IS NULL THEN 'N/A'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) <= 1 THEN 'Excellent ( <=1 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) < 5 THEN 'Very good ( <5 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) < 10 THEN 'Good ( <10 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) < 20 THEN 'Poor ( <20 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) < 100 THEN 'Bad ( <100 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) < 500 THEN 'Very bad ( <500 ms )'
        WHEN (CAST(io_stall AS numeric) / (num_of_reads + num_of_writes)) >= 500 THEN 'Awful ( >=500 ms )'
    END
) AS result
FROM io_stats, time_since_restart;
" -t -A
`;

export { DATABASES_COUNT, LIST_DATABASES, PERFORMANCE_METRICS };
