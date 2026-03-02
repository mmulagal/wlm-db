REM ===============================================================================
REM         NETAPP CONSOLE WORKLOAD FACTORY - ORACLE DATA COLLECTOR (STATSPACK)
REM         Version 1.0.0
REM ===============================================================================
REM
REM DESCRIPTION:
REM This script collects performance metrics using STATSPACK for TCO (Total Cost
REM of Ownership) analysis. It generates a JSON output with performance data
REM for migration planning.
REM
REM OUTPUT FORMAT (TCO-Enhanced):
REM   - scriptInfo: Version, collection method, timestamp
REM   - hostInfo: Merged by shell script (CPU, RAM, storage protocol)
REM   - databaseInfo: Database details, edition, RAC, DataGuard status
REM   - performanceSnapshots[]: Raw per-snapshot metrics for backend processing
REM   - performanceSummary: Pre-computed min/avg/max/P50/P95 for quick access
REM   - resourceUtilization: CPU/Memory usage for instance right-sizing
REM   - storageInfo: Database size, tablespaces, redo logs
REM
REM This TCO edition enables:
REM   - Instance right-sizing based on actual resource utilization
REM   - Migration planning to cloud (AWS RDS, EC2)
REM
REM NOTE: STATSPACK uses 'physical reads/writes' (block I/O) rather than 
REM       'physical read/write total IO requests' used by AWR.
REM       CPU time is used as a proxy for active sessions.
REM
REM ===============================================================================

-- Setup and file naming
SET ECHO OFF
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 32767
SET PAGESIZE 0
SET TRIMSPOOL ON
SET TERMOUT OFF
SET SERVEROUTPUT ON SIZE UNLIMITED

COLUMN file_name NEW_VALUE file_name
SELECT 'OracleStatspackDataResponse-' || REPLACE(REPLACE(REPLACE(host_name, ' ', '_'), '/', '_'), '\', '_') || '-' || instance_name || '-' || TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS') || '.json' AS file_name
FROM v$instance;

SPOOL &file_name

-- Main PL/SQL block for data collection and JSON generation
DECLARE
  -- =========================================================================
  -- CONFIGURABLE PARAMETERS - Adjust these values as needed
  -- =========================================================================
  c_lookback_days CONSTANT NUMBER := 30;   -- Days of STATSPACK history to analyze
  c_min_snapshots CONSTANT NUMBER := 10;   -- Minimum snapshots required
  c_min_hours     CONSTANT NUMBER := 12;   -- Minimum time span in hours
  -- =========================================================================

  -- Variables for CDB/PDB support (must be declared before functions)
  v_is_cdb VARCHAR2(10) := 'NO';
  v_con_name VARCHAR2(100) := 'N/A';
  v_con_id NUMBER := 0;
  
  -- DBID for STATSPACK queries
  v_dbid NUMBER := 0;
  
  -- DataGuard/RAC status (pre-computed in isolated blocks)
  v_is_dataguard VARCHAR2(10) := 'false';
  v_is_rac_flag VARCHAR2(10) := 'false';
  
  -- Variables for license/edition information
  v_edition VARCHAR2(200) := 'Unknown';
  v_edition_short VARCHAR2(50) := 'Unknown';
  
  -- Variables for snapshot iteration
  v_first_snap BOOLEAN := TRUE;
  
  -- Track whether root JSON '{' has been printed (for exception handler safety)
  v_json_started BOOLEAN := FALSE;
  
  -- Variables for validation
  v_snap_time_span NUMBER := 0;
  v_actual_snap_count NUMBER := 0;
  v_first_error BOOLEAN := TRUE;
  
  -- Variables for standby hosts (DataGuard)
  v_first_standby BOOLEAN := TRUE;
  
  -- Variables for PDB list
  v_first_pdb BOOLEAN := TRUE;
  
  -- Track open JSON structures for exception handler
  v_in_snapshots_array BOOLEAN := FALSE;

  -- Helper function to escape JSON special characters
  FUNCTION escape_json(p_str VARCHAR2) RETURN VARCHAR2 IS
    v_result VARCHAR2(32767);
  BEGIN
    IF p_str IS NULL THEN RETURN 'null'; END IF;
    v_result := p_str;
    v_result := REPLACE(v_result, '\', '\\');   -- Backslash first
    v_result := REPLACE(v_result, '"', '\"');   -- Double quote
    v_result := REPLACE(v_result, CHR(8), '\b');  -- Backspace
    v_result := REPLACE(v_result, CHR(9), '\t');  -- Tab
    v_result := REPLACE(v_result, CHR(10), '\n'); -- Newline
    v_result := REPLACE(v_result, CHR(12), '\f'); -- Form feed
    v_result := REPLACE(v_result, CHR(13), '\r'); -- Carriage return
    RETURN '"' || v_result || '"';
  END escape_json;

  -- Helper function to format numbers for JSON (ensures leading zero for decimals)
  FUNCTION fmt_num(p_num NUMBER, p_decimals NUMBER DEFAULT 2) RETURN VARCHAR2 IS
  BEGIN
    IF p_num IS NULL THEN RETURN '0'; END IF;
    IF p_decimals = 0 THEN
      RETURN TRIM(TO_CHAR(ROUND(p_num), 'FM99999999999999990'));
    END IF;
    RETURN TRIM(TO_CHAR(p_num, 'FM99999999999999990.' || RPAD('0', p_decimals, '0')));
  END fmt_num;

BEGIN
  -- C4b: Force decimal point as decimal separator for JSON output
  EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_NUMERIC_CHARACTERS = ''.,''';

  -- Get DBID for STATSPACK queries
  BEGIN
    EXECUTE IMMEDIATE 'SELECT con_dbid FROM v$database' INTO v_dbid;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT dbid INTO v_dbid FROM v$database;
    EXCEPTION WHEN OTHERS THEN
      v_dbid := 0;
    END;
  END;

  -- Pre-compute DataGuard status in isolated block (M11)
  BEGIN
    SELECT DECODE(SIGN(count(*) - 1), 1, 'true', 'false') INTO v_is_dataguard FROM v$dataguard_config;
  EXCEPTION WHEN OTHERS THEN v_is_dataguard := 'false';
  END;

  -- Pre-compute RAC status in isolated block
  BEGIN
    SELECT DECODE(value, 'TRUE', 'true', 'false') INTO v_is_rac_flag
    FROM v$option WHERE parameter = 'Real Application Clusters';
  EXCEPTION WHEN OTHERS THEN v_is_rac_flag := 'false';
  END;

  -- JSON Start
  DBMS_OUTPUT.PUT_LINE('{');
  v_json_started := TRUE;

  -- Pre-calculate validation data for validationErrors
  BEGIN
    SELECT COUNT(*), 
           NVL(ROUND((MAX(snap_time) - MIN(snap_time)) * 24, 2), 0)
    INTO v_actual_snap_count, v_snap_time_span
    FROM stats$snapshot
    WHERE snap_time > SYSDATE - c_lookback_days
      AND dbid = v_dbid;
  EXCEPTION WHEN OTHERS THEN
    v_actual_snap_count := 0;
    v_snap_time_span := 0;
  END;

  -- Metadata
  DBMS_OUTPUT.PUT_LINE('"scriptInfo": {');
  DBMS_OUTPUT.PUT_LINE('"scriptVersion": "1.0.0",');
  DBMS_OUTPUT.PUT_LINE('"outputFormat": "tco-enhanced",');
  DBMS_OUTPUT.PUT_LINE('"lookbackDays": ' || c_lookback_days || ',');
  DBMS_OUTPUT.PUT_LINE('"collectionTimestamp": ' || escape_json(TO_CHAR(SYS_EXTRACT_UTC(SYSTIMESTAMP), 'YYYYMMDDHH24MISS')) || ',');
  DBMS_OUTPUT.PUT_LINE('"collectionMethod": "STATSPACK",');
  DBMS_OUTPUT.PUT_LINE('"peakEstimationMethod": "same_as_average"');
  DBMS_OUTPUT.PUT_LINE('},');
  
  -- Validation Errors array
  DBMS_OUTPUT.PUT('"validationErrors": [');
  v_first_error := TRUE;
  
  -- Check if STATSPACK has sufficient snapshots
  IF v_actual_snap_count < c_min_snapshots THEN
    IF v_first_error THEN v_first_error := FALSE; ELSE DBMS_OUTPUT.PUT(', '); END IF;
    DBMS_OUTPUT.PUT('"Only ' || v_actual_snap_count || ' snapshots found (need at least ' || c_min_snapshots || ')"');
  END IF;
  
  -- Check if snapshots span sufficient time
  IF v_snap_time_span < c_min_hours THEN
    IF v_first_error THEN v_first_error := FALSE; ELSE DBMS_OUTPUT.PUT(', '); END IF;
    DBMS_OUTPUT.PUT('"Snapshots span only ' || v_snap_time_span || ' hours (need at least ' || c_min_hours || ' hours)"');
  END IF;
  
  -- Check for RAC (will be checked after databaseInfo query, but we can pre-check)
  DECLARE
    v_rac_check VARCHAR2(10) := 'FALSE';
  BEGIN
    SELECT DECODE(value, 'TRUE', 'TRUE', 'FALSE') INTO v_rac_check
    FROM v$option WHERE parameter = 'Real Application Clusters';
    IF v_rac_check = 'TRUE' THEN
      IF v_first_error THEN v_first_error := FALSE; ELSE DBMS_OUTPUT.PUT(', '); END IF;
      DBMS_OUTPUT.PUT('"RAC detected (not fully supported in this version - single instance metrics only)"');
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  DBMS_OUTPUT.PUT_LINE('],');

  -- Try to get CDB info (12c+)
  BEGIN
    EXECUTE IMMEDIATE 'SELECT cdb FROM v$database' INTO v_is_cdb;
    EXECUTE IMMEDIATE 'SELECT SYS_CONTEXT(''USERENV'', ''CON_NAME'') FROM dual' INTO v_con_name;
    EXECUTE IMMEDIATE 'SELECT SYS_CONTEXT(''USERENV'', ''CON_ID'') FROM dual' INTO v_con_id;
  EXCEPTION WHEN OTHERS THEN
    v_is_cdb := 'NO';
    v_con_name := 'N/A';
    v_con_id := 0;
  END;

  -- Get Oracle Edition for licensing/TCO
  BEGIN
    SELECT banner INTO v_edition 
    FROM v$version 
    WHERE banner LIKE 'Oracle Database%' AND ROWNUM = 1;
    
    -- Extract short edition name for easier processing
    IF INSTR(UPPER(v_edition), 'ENTERPRISE') > 0 THEN
      v_edition_short := 'Enterprise Edition';
    ELSIF INSTR(UPPER(v_edition), 'STANDARD') > 0 THEN
      v_edition_short := 'Standard Edition';
    ELSIF INSTR(UPPER(v_edition), 'EXPRESS') > 0 THEN
      v_edition_short := 'Express Edition';
    ELSIF INSTR(UPPER(v_edition), 'PERSONAL') > 0 THEN
      v_edition_short := 'Personal Edition';
    ELSE
      v_edition_short := 'Unknown';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_edition := 'Unknown';
    v_edition_short := 'Unknown';
  END;

  -- Instance Info
  FOR r IN (
    SELECT
      i.instance_name, i.host_name, i.version,
      d.name as db_name, d.dbid, d.log_mode, d.database_role,
      (SELECT value FROM v$parameter WHERE name = 'cpu_count') as vcpus,
      (SELECT GREATEST(
        NVL(TO_NUMBER((SELECT value FROM v$parameter WHERE name = 'sga_target')), 0),
        NVL(TO_NUMBER((SELECT value FROM v$parameter WHERE name = 'sga_max_size')), 0)
      ) FROM dual)/1024/1024/1024 as sga_gb,
      (SELECT GREATEST(
        NVL(TO_NUMBER((SELECT value FROM v$parameter WHERE name = 'pga_aggregate_target')), 0),
        NVL(TO_NUMBER((SELECT value FROM v$parameter WHERE name = 'pga_aggregate_limit')), 0)
      ) FROM dual)/1024/1024/1024 as pga_gb
    FROM v$instance i CROSS JOIN v$database d
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('"databaseInfo": {');
    DBMS_OUTPUT.PUT_LINE('"dbName": ' || escape_json(r.db_name) || ',');
    DBMS_OUTPUT.PUT_LINE('"dbId": ' || r.dbid || ',');
    DBMS_OUTPUT.PUT_LINE('"instanceName": ' || escape_json(r.instance_name) || ',');
    DBMS_OUTPUT.PUT_LINE('"hostName": ' || escape_json(r.host_name) || ',');
    DBMS_OUTPUT.PUT_LINE('"oracleVersion": ' || escape_json(r.version) || ',');
    DBMS_OUTPUT.PUT_LINE('"isRacEnabled": ' || v_is_rac_flag || ',');
    DBMS_OUTPUT.PUT_LINE('"isDataGuardEnabled": ' || v_is_dataguard || ',');
    DBMS_OUTPUT.PUT_LINE('"databaseRole": ' || escape_json(r.database_role) || ',');
    DBMS_OUTPUT.PUT_LINE('"logMode": ' || escape_json(r.log_mode) || ',');
    DBMS_OUTPUT.PUT_LINE('"isCDB": ' || CASE WHEN v_is_cdb = 'YES' THEN 'true' ELSE 'false' END || ',');
    DBMS_OUTPUT.PUT_LINE('"containerName": ' || escape_json(v_con_name) || ',');
    DBMS_OUTPUT.PUT_LINE('"containerId": ' || v_con_id || ',');
    DBMS_OUTPUT.PUT_LINE('"vCPUs": ' || NVL(TO_NUMBER(r.vcpus), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('"sgaTargetGB": ' || fmt_num(r.sga_gb, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('"pgaTargetGB": ' || fmt_num(r.pga_gb, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('"oracleEdition": ' || escape_json(v_edition_short) || ',');
    DBMS_OUTPUT.PUT_LINE('"oracleEditionFull": ' || escape_json(v_edition) || ',');
    
    -- Add standbyDatabases array if DataGuard is enabled
    DBMS_OUTPUT.PUT('"standbyDatabases": [');
    IF v_is_dataguard = 'true' THEN
      v_first_standby := TRUE;
      DECLARE
        v_standby_dbname VARCHAR2(256);
        v_standby_dest   VARCHAR2(256);
        v_standby_destid NUMBER;
        v_standby_status VARCHAR2(64);
        v_standby_error  VARCHAR2(512);
        TYPE ref_cur IS REF CURSOR;
        standby_cur ref_cur;
      BEGIN
        OPEN standby_cur FOR
          'SELECT db_unique_name, destination, dest_id, status, error'
          || ' FROM v$archive_dest_status'
          || ' WHERE db_unique_name IS NOT NULL'
          || ' AND db_unique_name != ''NONE'''
          || ' AND type != ''LOCAL'''
          || ' ORDER BY dest_id';
        LOOP
          FETCH standby_cur INTO v_standby_dbname, v_standby_dest, v_standby_destid, v_standby_status, v_standby_error;
          EXIT WHEN standby_cur%NOTFOUND;
          IF v_first_standby THEN
            v_first_standby := FALSE;
          ELSE
            DBMS_OUTPUT.PUT(', ');
          END IF;
          DBMS_OUTPUT.PUT('{');
          DBMS_OUTPUT.PUT('"dbUniqueName": ' || escape_json(v_standby_dbname));
          DBMS_OUTPUT.PUT(', "destination": ' || escape_json(v_standby_dest));
          DBMS_OUTPUT.PUT(', "destId": ' || v_standby_destid);
          DBMS_OUTPUT.PUT(', "status": ' || escape_json(v_standby_status));
          DBMS_OUTPUT.PUT(', "error": ' || escape_json(v_standby_error));
          DBMS_OUTPUT.PUT('}');
        END LOOP;
        CLOSE standby_cur;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    DBMS_OUTPUT.PUT_LINE('],');
    
    -- Add partnerNodes array: primary hostname + standby hosts extracted from LOG_ARCHIVE_DEST_n.
    -- The HOST is parsed from inline connect descriptors or easy-connect strings in v$parameter.
    -- Falls back gracefully when only TNS aliases are configured (no standby hosts emitted).
    DBMS_OUTPUT.PUT('"partnerNodes": [');
    DBMS_OUTPUT.PUT(escape_json(r.host_name));
    IF v_is_dataguard = 'true' THEN
      DECLARE
        v_dest_value     VARCHAR2(4000);
        v_extracted_host VARCHAR2(256);
        v_added_hosts    VARCHAR2(4000) := '|';
        TYPE ref_cur IS REF CURSOR;
        dest_cur ref_cur;
      BEGIN
        OPEN dest_cur FOR
          'SELECT value FROM v$parameter'
          || ' WHERE REGEXP_LIKE(name, ''^log_archive_dest_[0-9]+$'')'
          || ' AND value IS NOT NULL'
          || ' AND UPPER(value) LIKE ''%SERVICE=%'''
          || ' AND UPPER(value) LIKE ''%DB_UNIQUE_NAME=%''';
        LOOP
          FETCH dest_cur INTO v_dest_value;
          EXIT WHEN dest_cur%NOTFOUND;
          
          v_extracted_host := REGEXP_SUBSTR(v_dest_value, '\(HOST=([^)]+)\)', 1, 1, 'i', 1);
          
          IF v_extracted_host IS NULL THEN
            v_extracted_host := REGEXP_SUBSTR(v_dest_value, 'SERVICE=([^:( ]+)', 1, 1, 'i', 1);
            IF v_extracted_host IS NOT NULL AND INSTR(v_extracted_host, '.') = 0 THEN
              v_extracted_host := NULL;
            END IF;
          END IF;
          
          IF v_extracted_host IS NOT NULL
             AND UPPER(v_extracted_host) != UPPER(r.host_name)
             AND INSTR(v_added_hosts, '|' || UPPER(v_extracted_host) || '|') = 0 THEN
            DBMS_OUTPUT.PUT(', ' || escape_json(v_extracted_host));
            v_added_hosts := v_added_hosts || UPPER(v_extracted_host) || '|';
          END IF;
        END LOOP;
        CLOSE dest_cur;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    DBMS_OUTPUT.PUT_LINE('],');
    
    -- Add pdbList array if CDB (uses dynamic SQL to avoid compile-time
    -- failures and to surface privilege errors instead of silently returning 0)
    DBMS_OUTPUT.PUT('"pdbList": [');
    DECLARE
      v_pdb_count NUMBER := 0;
      v_pdb_name  VARCHAR2(256);
      TYPE ref_cur IS REF CURSOR;
      pdb_cur ref_cur;
    BEGIN
      IF v_is_cdb = 'YES' THEN
        v_first_pdb := TRUE;
        BEGIN
          OPEN pdb_cur FOR
            'SELECT name FROM v$pdbs WHERE con_id > 2 ORDER BY name';
          LOOP
            FETCH pdb_cur INTO v_pdb_name;
            EXIT WHEN pdb_cur%NOTFOUND;
            IF v_first_pdb THEN
              v_first_pdb := FALSE;
            ELSE
              DBMS_OUTPUT.PUT(', ');
            END IF;
            DBMS_OUTPUT.PUT(escape_json(v_pdb_name));
            v_pdb_count := v_pdb_count + 1;
          END LOOP;
          CLOSE pdb_cur;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
      DBMS_OUTPUT.PUT_LINE('],');
      DBMS_OUTPUT.PUT_LINE('"pdbCount": ' || v_pdb_count);
    END;
    DBMS_OUTPUT.PUT_LINE('},');
  END LOOP;

  -- =========================================================================
  -- RESOURCE UTILIZATION (CPU and Memory for Instance Right-Sizing)
  -- =========================================================================
  DBMS_OUTPUT.PUT_LINE('"resourceUtilization": {');
  
  -- CPU Utilization from STATSPACK (H3b: historical stats$osstat for AWR parity)
  BEGIN
    FOR cpu_r IN (
      WITH os_data AS (
        SELECT
          s.snap_id,
          SUM(CASE WHEN sn.stat_name = 'BUSY_TIME' THEN st.value END) as busy,
          SUM(CASE WHEN sn.stat_name = 'IDLE_TIME' THEN st.value END) as idle
        FROM stats$snapshot s
        JOIN stats$osstat st ON s.snap_id = st.snap_id
          AND s.instance_number = st.instance_number
          AND s.dbid = st.dbid
        JOIN stats$osstatname sn ON st.osstat_id = sn.osstat_id
        WHERE s.snap_time > SYSDATE - c_lookback_days
          AND s.dbid = v_dbid
          AND sn.stat_name IN ('BUSY_TIME', 'IDLE_TIME')
        GROUP BY s.snap_id
        ORDER BY s.snap_id
      ),
      cpu_deltas AS (
        SELECT
          snap_id,
          busy - LAG(busy) OVER (ORDER BY snap_id) as delta_busy,
          idle - LAG(idle) OVER (ORDER BY snap_id) as delta_idle
        FROM os_data
      ),
      cpu_pct AS (
        SELECT
          snap_id,
          ROUND((delta_busy / NULLIF(delta_busy + delta_idle, 0)) * 100, 2) as pct
        FROM cpu_deltas
        WHERE delta_busy IS NOT NULL
          AND delta_busy >= 0
          AND delta_idle >= 0
      )
      SELECT
        NVL(ROUND(MIN(pct), 2), 0) as min_cpu,
        NVL(ROUND(AVG(pct), 2), 0) as avg_cpu,
        NVL(ROUND(MAX(pct), 2), 0) as max_cpu,
        NVL(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pct), 2), 0) as p50_cpu,
        NVL(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pct), 2), 0) as p95_cpu
      FROM cpu_pct
    ) LOOP
      DBMS_OUTPUT.PUT_LINE('"cpuUtilization": {');
      DBMS_OUTPUT.PUT_LINE('  "min": ' || fmt_num(cpu_r.min_cpu, 2) || ',');
      DBMS_OUTPUT.PUT_LINE('  "avg": ' || fmt_num(cpu_r.avg_cpu, 2) || ',');
      DBMS_OUTPUT.PUT_LINE('  "max": ' || fmt_num(cpu_r.max_cpu, 2) || ',');
      DBMS_OUTPUT.PUT_LINE('  "p50": ' || fmt_num(cpu_r.p50_cpu, 2) || ',');
      DBMS_OUTPUT.PUT_LINE('  "p95": ' || fmt_num(cpu_r.p95_cpu, 2));
      DBMS_OUTPUT.PUT_LINE('},');
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: stats$osstat may not be available on older versions
    DBMS_OUTPUT.PUT_LINE('"cpuUtilization": {');
    DBMS_OUTPUT.PUT_LINE('  "min": 0, "avg": 0, "max": 0, "p50": 0, "p95": 0');
    DBMS_OUTPUT.PUT_LINE('},');
  END;
  
  -- Memory Utilization
  DECLARE
    v_sga_size NUMBER := 0;
    v_pga_size NUMBER := 0;
    v_total_memory NUMBER := 0;
    v_memory_target NUMBER := 0;
  BEGIN
    -- Get current SGA allocation
    SELECT NVL(SUM(value), 0) / 1024 / 1024 / 1024 INTO v_sga_size 
    FROM v$sga;
    
    -- Get current PGA allocation (handle NO_DATA_FOUND)
    BEGIN
      SELECT NVL(value, 0) / 1024 / 1024 / 1024 INTO v_pga_size 
      FROM v$pgastat 
      WHERE name = 'total PGA allocated';
    EXCEPTION WHEN NO_DATA_FOUND THEN v_pga_size := 0;
    END;
    
    -- Get memory_target if AMM is enabled
    BEGIN
      SELECT NVL(value, 0) / 1024 / 1024 / 1024 INTO v_memory_target 
      FROM v$parameter 
      WHERE name = 'memory_target';
    EXCEPTION WHEN OTHERS THEN v_memory_target := 0; END;
    
    -- Get total physical memory from OS stats
    BEGIN
      SELECT NVL(value, 0) / 1024 / 1024 / 1024 INTO v_total_memory 
      FROM v$osstat 
      WHERE stat_name = 'PHYSICAL_MEMORY_BYTES';
    EXCEPTION WHEN OTHERS THEN v_total_memory := 0; END;
    
    DBMS_OUTPUT.PUT_LINE('"memoryUtilization": {');
    DBMS_OUTPUT.PUT_LINE('  "sgaAllocatedGB": ' || fmt_num(v_sga_size, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "pgaAllocatedGB": ' || fmt_num(v_pga_size, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "totalOracleMemoryGB": ' || fmt_num(v_sga_size + v_pga_size, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "memoryTargetGB": ' || fmt_num(v_memory_target, 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "hostPhysicalMemoryGB": ' || fmt_num(v_total_memory, 2));
    DBMS_OUTPUT.PUT_LINE('},');
  END;
  
  -- DB Time from STATSPACK for workload sizing
  FOR db_time_r IN (
    WITH sp_dbtime AS (
      SELECT
        s.snap_id,
        st.value as current_value,
        LAG(st.value) OVER (PARTITION BY s.instance_number ORDER BY s.snap_id) as prev_value,
        (s.snap_time - LAG(s.snap_time) OVER (PARTITION BY s.instance_number ORDER BY s.snap_id)) * 86400 as interval_secs
      FROM stats$snapshot s
      JOIN stats$sysstat st ON s.snap_id = st.snap_id 
        AND s.instance_number = st.instance_number
        AND s.dbid = st.dbid
      WHERE s.snap_time > SYSDATE - c_lookback_days
        AND st.name = 'DB time'
    ),
    db_time_per_sec AS (
      SELECT
        snap_id,
        ROUND((current_value - prev_value) / 1000000 / interval_secs, 2) as db_time_sec
      FROM sp_dbtime
      WHERE prev_value IS NOT NULL
        AND current_value >= prev_value
        AND interval_secs > 0
    )
    SELECT
      ROUND(MIN(db_time_sec), 2) as min_db_time,
      ROUND(AVG(db_time_sec), 2) as avg_db_time,
      ROUND(MAX(db_time_sec), 2) as max_db_time,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY db_time_sec), 2) as p50_db_time,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY db_time_sec), 2) as p95_db_time
    FROM db_time_per_sec
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('"dbTimePerSec": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || NVL(db_time_r.min_db_time, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || NVL(db_time_r.avg_db_time, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || NVL(db_time_r.max_db_time, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || NVL(db_time_r.p50_db_time, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || NVL(db_time_r.p95_db_time, 0));
    DBMS_OUTPUT.PUT_LINE('}');
  END LOOP;
  
  DBMS_OUTPUT.PUT_LINE('},');

  -- =========================================================================
  -- PERFORMANCE SUMMARY (Statistics with Sizing Algorithm Support)
  -- =========================================================================
  -- STATSPACK Note: STATSPACK does not track sub-interval peaks (no MAXVAL equivalent).
  -- Peak values are set equal to averages. The sizing algorithm MAX(P95 of Averages,
  -- P50 of Peaks) will effectively use P95 of Averages for STATSPACK data.
  -- For accurate peak tracking, use AWR with Enterprise Edition.
  -- =========================================================================
  FOR r IN (
    WITH sp_data AS (
      SELECT
        s.snap_id,
        s.instance_number,
        s.snap_time,
        st.name as stat_name,
        st.value as current_value,
        LEAD(s.snap_time) OVER (PARTITION BY st.name, st.instance_number ORDER BY s.snap_id) as next_snap_time,
        LEAD(st.value) OVER (PARTITION BY st.name, st.instance_number ORDER BY s.snap_id) as next_value
      FROM stats$snapshot s
      JOIN stats$sysstat st ON s.snap_id = st.snap_id 
        AND s.instance_number = st.instance_number 
        AND s.dbid = st.dbid
      WHERE s.snap_time > SYSDATE - c_lookback_days
        AND s.dbid = v_dbid
        AND st.name IN (
          'physical reads', 
          'physical writes', 
          'physical read bytes', 
          'physical write bytes', 
          'DB time'
        )
    ),
    delta_data AS (
      SELECT
        snap_id,
        instance_number,
        snap_time,
        next_snap_time,
        stat_name,
        next_value - current_value as delta_value
      FROM sp_data
      WHERE next_snap_time IS NOT NULL
        AND next_value >= current_value
    ),
    snap_metrics AS (
      SELECT
        snap_id,
        instance_number,
        (next_snap_time - snap_time) * 86400 as interval_seconds,
        SUM(CASE WHEN stat_name = 'physical reads' THEN delta_value ELSE 0 END) as read_ios,
        SUM(CASE WHEN stat_name = 'physical writes' THEN delta_value ELSE 0 END) as write_ios,
        SUM(CASE WHEN stat_name = 'physical read bytes' THEN delta_value ELSE 0 END) as read_bytes,
        SUM(CASE WHEN stat_name = 'physical write bytes' THEN delta_value ELSE 0 END) as write_bytes,
        SUM(CASE WHEN stat_name = 'DB time' THEN delta_value ELSE 0 END) / 1000000 as db_time_seconds
      FROM delta_data
      GROUP BY snap_id, instance_number, snap_time, next_snap_time
      HAVING (next_snap_time - snap_time) * 86400 > 0
    ),
    rate_metrics AS (
      SELECT
        snap_id,
        interval_seconds,
        -- Average values
        read_ios / interval_seconds as avg_read_iops,
        write_ios / interval_seconds as avg_write_iops,
        (read_ios + write_ios) / interval_seconds as avg_total_iops,
        read_bytes / interval_seconds / 1024 / 1024 as avg_read_mbps,
        write_bytes / interval_seconds / 1024 / 1024 as avg_write_mbps,
        (read_bytes + write_bytes) / interval_seconds / 1024 / 1024 as avg_total_mbps,
        db_time_seconds / interval_seconds as avg_active_sessions,
        -- Peak values = averages (STATSPACK has no sub-interval peak tracking)
        read_ios / interval_seconds as peak_read_iops,
        write_ios / interval_seconds as peak_write_iops,
        (read_ios + write_ios) / interval_seconds as peak_total_iops,
        read_bytes / interval_seconds / 1024 / 1024 as peak_read_mbps,
        write_bytes / interval_seconds / 1024 / 1024 as peak_write_mbps,
        (read_bytes + write_bytes) / interval_seconds / 1024 / 1024 as peak_total_mbps,
        db_time_seconds / interval_seconds as peak_active_sessions
      FROM snap_metrics
    )
    SELECT
      COUNT(*) as snapshot_count,
      -- ===== Traditional Statistics (backward compatible) =====
      -- Read IOPS
      ROUND(MIN(avg_read_iops)) as min_read_iops,
      ROUND(AVG(avg_read_iops)) as avg_read_iops,
      ROUND(MAX(avg_read_iops)) as max_read_iops,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_read_iops)) as p50_read_iops,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_read_iops)) as p95_read_iops,
      -- Write IOPS
      ROUND(MIN(avg_write_iops)) as min_write_iops,
      ROUND(AVG(avg_write_iops)) as avg_write_iops,
      ROUND(MAX(avg_write_iops)) as max_write_iops,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_write_iops)) as p50_write_iops,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_write_iops)) as p95_write_iops,
      -- Read Throughput
      ROUND(MIN(avg_read_mbps), 2) as min_read_mbps,
      ROUND(AVG(avg_read_mbps), 2) as avg_read_mbps_val,
      ROUND(MAX(avg_read_mbps), 2) as max_read_mbps,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_read_mbps), 2) as p50_read_mbps,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_read_mbps), 2) as p95_read_mbps,
      -- Write Throughput
      ROUND(MIN(avg_write_mbps), 2) as min_write_mbps,
      ROUND(AVG(avg_write_mbps), 2) as avg_write_mbps_val,
      ROUND(MAX(avg_write_mbps), 2) as max_write_mbps,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_write_mbps), 2) as p50_write_mbps,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_write_mbps), 2) as p95_write_mbps,
      -- Active Sessions (CPU-based)
      ROUND(MIN(avg_active_sessions), 4) as min_active_sessions,
      ROUND(AVG(avg_active_sessions), 4) as avg_active_sessions_val,
      ROUND(MAX(avg_active_sessions), 4) as max_active_sessions,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_active_sessions), 4) as p50_active_sessions,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_active_sessions), 4) as p95_active_sessions,
      
      -- ===== Sizing Statistics: P95 of Averages =====
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_read_iops)) as p95_avg_read_iops,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_write_iops)) as p95_avg_write_iops,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_total_iops)) as p95_avg_total_iops,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_read_mbps), 2) as p95_avg_read_mbps,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_write_mbps), 2) as p95_avg_write_mbps,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_total_mbps), 2) as p95_avg_total_mbps,
      
      -- ===== Sizing Statistics: P50 of Peaks (estimated) =====
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_read_iops)) as p50_peak_read_iops,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_write_iops)) as p50_peak_write_iops,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_total_iops)) as p50_peak_total_iops,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_read_mbps), 2) as p50_peak_read_mbps,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_write_mbps), 2) as p50_peak_write_mbps,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_total_mbps), 2) as p50_peak_total_mbps,
      
      -- ===== Additional Peak Statistics =====
      ROUND(AVG(peak_read_iops)) as avg_peak_read_iops,
      ROUND(AVG(peak_write_iops)) as avg_peak_write_iops,
      ROUND(AVG(peak_total_iops)) as avg_peak_total_iops,
      ROUND(MAX(peak_read_iops)) as max_peak_read_iops,
      ROUND(MAX(peak_write_iops)) as max_peak_write_iops,
      ROUND(MAX(peak_total_iops)) as max_peak_total_iops,
      ROUND(AVG(peak_read_mbps), 2) as avg_peak_read_mbps,
      ROUND(AVG(peak_write_mbps), 2) as avg_peak_write_mbps,
      ROUND(AVG(peak_total_mbps), 2) as avg_peak_total_mbps,
      ROUND(MAX(peak_read_mbps), 2) as max_peak_read_mbps,
      ROUND(MAX(peak_write_mbps), 2) as max_peak_write_mbps,
      ROUND(MAX(peak_total_mbps), 2) as max_peak_total_mbps
    FROM rate_metrics
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('"performanceSummary": {');
    DBMS_OUTPUT.PUT_LINE('"snapshotCount": ' || r.snapshot_count || ',');
    
    -- Traditional statistics (backward compatible)
    -- Read IOPS
    DBMS_OUTPUT.PUT_LINE('"readIOPS": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || NVL(r.min_read_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || NVL(r.avg_read_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || NVL(r.max_read_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || NVL(r.p50_read_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || NVL(r.p95_read_iops, 0));
    DBMS_OUTPUT.PUT_LINE('},');
    
    -- Write IOPS
    DBMS_OUTPUT.PUT_LINE('"writeIOPS": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || NVL(r.min_write_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || NVL(r.avg_write_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || NVL(r.max_write_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || NVL(r.p50_write_iops, 0) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || NVL(r.p95_write_iops, 0));
    DBMS_OUTPUT.PUT_LINE('},');
    
    -- Read Throughput
    DBMS_OUTPUT.PUT_LINE('"readThroughputMBps": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || fmt_num(NVL(r.min_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || fmt_num(NVL(r.avg_read_mbps_val, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || fmt_num(NVL(r.max_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || fmt_num(NVL(r.p50_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || fmt_num(NVL(r.p95_read_mbps, 0), 2));
    DBMS_OUTPUT.PUT_LINE('},');
    
    -- Write Throughput
    DBMS_OUTPUT.PUT_LINE('"writeThroughputMBps": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || fmt_num(NVL(r.min_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || fmt_num(NVL(r.avg_write_mbps_val, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || fmt_num(NVL(r.max_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || fmt_num(NVL(r.p50_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || fmt_num(NVL(r.p95_write_mbps, 0), 2));
    DBMS_OUTPUT.PUT_LINE('},');
    
    -- Active Sessions (CPU-based)
    DBMS_OUTPUT.PUT_LINE('"activeSessions": {');
    DBMS_OUTPUT.PUT_LINE('  "min": ' || fmt_num(NVL(r.min_active_sessions, 0), 4) || ',');
    DBMS_OUTPUT.PUT_LINE('  "avg": ' || fmt_num(NVL(r.avg_active_sessions_val, 0), 4) || ',');
    DBMS_OUTPUT.PUT_LINE('  "max": ' || fmt_num(NVL(r.max_active_sessions, 0), 4) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p50": ' || fmt_num(NVL(r.p50_active_sessions, 0), 4) || ',');
    DBMS_OUTPUT.PUT_LINE('  "p95": ' || fmt_num(NVL(r.p95_active_sessions, 0), 4));
    DBMS_OUTPUT.PUT_LINE('},');
    
    -- =========================================================================
    -- SIZING STATISTICS for algorithm: MAX(P95 of Averages, P50 of Peaks)
    -- =========================================================================
    DBMS_OUTPUT.PUT_LINE('"sizingStats": {');
    
    -- Read IOPS Sizing
    DBMS_OUTPUT.PUT_LINE('  "readIOPS": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_read_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_read_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_read_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_read_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_read_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_read_iops, 0), NVL(r.p50_peak_read_iops, 0)), 0));
    DBMS_OUTPUT.PUT_LINE('  },');
    
    -- Write IOPS Sizing
    DBMS_OUTPUT.PUT_LINE('  "writeIOPS": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_write_iops, 0), NVL(r.p50_peak_write_iops, 0)), 0));
    DBMS_OUTPUT.PUT_LINE('  },');
    
    -- Total IOPS Sizing
    DBMS_OUTPUT.PUT_LINE('  "totalIOPS": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_read_iops + r.avg_write_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_total_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_total_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_total_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_total_iops, 0), 0) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_total_iops, 0), NVL(r.p50_peak_total_iops, 0)), 0));
    DBMS_OUTPUT.PUT_LINE('  },');
    
    -- Read Throughput Sizing
    DBMS_OUTPUT.PUT_LINE('  "readThroughputMBps": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_read_mbps_val, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_read_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_read_mbps, 0), NVL(r.p50_peak_read_mbps, 0)), 2));
    DBMS_OUTPUT.PUT_LINE('  },');
    
    -- Write Throughput Sizing
    DBMS_OUTPUT.PUT_LINE('  "writeThroughputMBps": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_write_mbps_val, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_write_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_write_mbps, 0), NVL(r.p50_peak_write_mbps, 0)), 2));
    DBMS_OUTPUT.PUT_LINE('  },');
    
    -- Total Throughput Sizing
    DBMS_OUTPUT.PUT_LINE('  "totalThroughputMBps": {');
    DBMS_OUTPUT.PUT_LINE('    "avgOfAverages": ' || fmt_num(NVL(r.avg_read_mbps_val + r.avg_write_mbps_val, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p95OfAverages": ' || fmt_num(NVL(r.p95_avg_total_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "avgOfPeaks": ' || fmt_num(NVL(r.avg_peak_total_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "p50OfPeaks": ' || fmt_num(NVL(r.p50_peak_total_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "maxOfPeaks": ' || fmt_num(NVL(r.max_peak_total_mbps, 0), 2) || ',');
    DBMS_OUTPUT.PUT_LINE('    "recommendedValue": ' || fmt_num(GREATEST(NVL(r.p95_avg_total_mbps, 0), NVL(r.p50_peak_total_mbps, 0)), 2));
    DBMS_OUTPUT.PUT_LINE('  }');
    
    DBMS_OUTPUT.PUT_LINE('}');
    
    DBMS_OUTPUT.PUT_LINE('},');
  END LOOP;

  -- =========================================================================
  -- STORAGE INFO
  -- =========================================================================
  DBMS_OUTPUT.PUT_LINE('"storageInfo": {');
  
  -- Total size including data files and temp files
  FOR r IN (
    SELECT ROUND(
      ((SELECT NVL(SUM(bytes), 0) FROM dba_data_files) + 
       (SELECT NVL(SUM(bytes), 0) FROM dba_temp_files))
      / 1024/1024/1024, 2) as total_db_size_gb FROM dual
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('"totalDatabaseSizeGB": ' || fmt_num(r.total_db_size_gb, 2) || ',');
  END LOOP;
  
  -- Temp tablespace size
  FOR r IN (SELECT NVL(ROUND(SUM(bytes)/1024/1024/1024, 2), 0) as temp_size_gb FROM dba_temp_files) LOOP
    DBMS_OUTPUT.PUT_LINE('"tempTablespaceSizeGB": ' || fmt_num(r.temp_size_gb, 2) || ',');
  END LOOP;
  
  -- Redo log info for throughput estimation
  FOR r IN (
    SELECT 
      COUNT(*) as log_count,
      ROUND(SUM(bytes)/1024/1024, 2) as total_redo_mb
    FROM v$log
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('"redoLogCount": ' || r.log_count || ',');
    DBMS_OUTPUT.PUT_LINE('"totalRedoSizeMB": ' || fmt_num(r.total_redo_mb, 2) || ',');
  END LOOP;
  
  DBMS_OUTPUT.PUT_LINE('"tablespaces": [');
  
  DECLARE
    v_first_ts BOOLEAN := TRUE;
  BEGIN
    FOR r IN (
      SELECT
        t.tablespace_name,
        ROUND(t.total_space / 1024 / 1024 / 1024, 2) as size_gb,
        ROUND((t.total_space - NVL(fs.free_space, 0)) / 1024 / 1024 / 1024, 2) as used_gb
      FROM
        (SELECT tablespace_name, SUM(bytes) as total_space FROM dba_data_files GROUP BY tablespace_name) t
        LEFT OUTER JOIN
        (SELECT tablespace_name, SUM(bytes) as free_space FROM dba_free_space GROUP BY tablespace_name) fs
        ON t.tablespace_name = fs.tablespace_name
      ORDER BY t.tablespace_name
    ) LOOP
      IF v_first_ts THEN v_first_ts := FALSE; ELSE DBMS_OUTPUT.PUT_LINE(','); END IF;
      DBMS_OUTPUT.PUT('{"name": ' || escape_json(r.tablespace_name) || ', "sizeGB": ' || fmt_num(r.size_gb, 2) || ', "usedGB": ' || fmt_num(r.used_gb, 2) || '}');
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('');
  END;
  
  DBMS_OUTPUT.PUT_LINE('],');
  
  -- =========================================================================
  -- ASM STORAGE INFO (if ASM is in use)
  -- =========================================================================
  DECLARE
    v_asm_used VARCHAR2(10) := 'NO';
    v_asm_count NUMBER := 0;
    v_first_dg BOOLEAN := TRUE;
  BEGIN
    -- Check if any datafiles are on ASM (start with +)
    BEGIN
      SELECT COUNT(*) INTO v_asm_count 
      FROM dba_data_files 
      WHERE file_name LIKE '+%';
      
      IF v_asm_count > 0 THEN
        v_asm_used := 'YES';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_asm_used := 'NO';
    END;
    
    DBMS_OUTPUT.PUT_LINE('"asmInfo": {');
    DBMS_OUTPUT.PUT_LINE('"isAsmUsed": ' || CASE WHEN v_asm_used = 'YES' THEN 'true' ELSE 'false' END || ',');
    DBMS_OUTPUT.PUT('"diskgroups": [');
    
    IF v_asm_used = 'YES' THEN
      -- Query ASM diskgroups from v$asm_diskgroup
      BEGIN
        FOR dg IN (
          SELECT 
            name,
            type,
            state,
            ROUND(total_mb / 1024, 2) as total_gb,
            ROUND(free_mb / 1024, 2) as free_gb,
            ROUND((total_mb - free_mb) / 1024, 2) as used_gb,
            ROUND(((total_mb - free_mb) / NULLIF(total_mb, 0)) * 100, 2) as pct_used
          FROM v$asm_diskgroup
          WHERE state = 'MOUNTED'
          ORDER BY name
        ) LOOP
          IF v_first_dg THEN
            v_first_dg := FALSE;
          ELSE
            DBMS_OUTPUT.PUT(', ');
          END IF;
          
          DBMS_OUTPUT.PUT('{');
          DBMS_OUTPUT.PUT('"name": ' || escape_json(dg.name) || ', ');
          DBMS_OUTPUT.PUT('"redundancy": ' || escape_json(dg.type) || ', ');
          DBMS_OUTPUT.PUT('"state": ' || escape_json(dg.state) || ', ');
          DBMS_OUTPUT.PUT('"totalGB": ' || fmt_num(NVL(dg.total_gb, 0), 2) || ', ');
          DBMS_OUTPUT.PUT('"freeGB": ' || fmt_num(NVL(dg.free_gb, 0), 2) || ', ');
          DBMS_OUTPUT.PUT('"usedGB": ' || fmt_num(NVL(dg.used_gb, 0), 2) || ', ');
          DBMS_OUTPUT.PUT('"percentUsed": ' || fmt_num(NVL(dg.pct_used, 0), 2));
          DBMS_OUTPUT.PUT('}');
        END LOOP;
      EXCEPTION 
        WHEN OTHERS THEN
          -- v$asm_diskgroup not accessible (not connected to ASM instance)
          NULL;
      END;
    END IF;
    
    DBMS_OUTPUT.PUT_LINE(']');
    DBMS_OUTPUT.PUT_LINE('}');
  END;
  
  DBMS_OUTPUT.PUT_LINE('},');

  -- =========================================================================
  -- PERFORMANCE SNAPSHOTS (Raw Data with Average and Estimated Peak Values)
  -- =========================================================================
  -- STATSPACK Note: Unlike AWR, STATSPACK does not track sub-interval peaks.
  -- Peak values are set equal to averages since STATSPACK only records cumulative
  -- counters per snapshot. For accurate peak tracking, use AWR with Enterprise Edition.
  -- =========================================================================
  DBMS_OUTPUT.PUT_LINE('"performanceSnapshots": [');
  v_in_snapshots_array := TRUE;
  
  v_first_snap := TRUE;
  FOR r IN (
    WITH sp_data AS (
      SELECT
        s.snap_id,
        s.instance_number,
        s.snap_time,
        st.name as stat_name,
        st.value as current_value,
        LEAD(s.snap_time) OVER (PARTITION BY st.name, st.instance_number ORDER BY s.snap_id) as next_snap_time,
        LEAD(st.value) OVER (PARTITION BY st.name, st.instance_number ORDER BY s.snap_id) as next_value
      FROM stats$snapshot s
      JOIN stats$sysstat st ON s.snap_id = st.snap_id 
        AND s.instance_number = st.instance_number 
        AND s.dbid = st.dbid
      WHERE s.snap_time > SYSDATE - c_lookback_days
        AND s.dbid = v_dbid
        AND st.name IN (
          'physical reads', 
          'physical writes', 
          'physical read bytes', 
          'physical write bytes', 
          'DB time'
        )
    ),
    delta_data AS (
      SELECT
        snap_id,
        instance_number,
        snap_time,
        next_snap_time,
        stat_name,
        next_value - current_value as delta_value
      FROM sp_data
      WHERE next_snap_time IS NOT NULL
        AND next_value >= current_value
    ),
    snap_metrics AS (
      SELECT
        snap_id,
        instance_number,
        TO_CHAR(SYS_EXTRACT_UTC(CAST(snap_time AS TIMESTAMP)), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as begin_time,
        TO_CHAR(SYS_EXTRACT_UTC(CAST(next_snap_time AS TIMESTAMP)), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as end_time,
        (next_snap_time - snap_time) * 86400 as interval_seconds,
        SUM(CASE WHEN stat_name = 'physical reads' THEN delta_value ELSE 0 END) as read_ios,
        SUM(CASE WHEN stat_name = 'physical writes' THEN delta_value ELSE 0 END) as write_ios,
        SUM(CASE WHEN stat_name = 'physical read bytes' THEN delta_value ELSE 0 END) as read_bytes,
        SUM(CASE WHEN stat_name = 'physical write bytes' THEN delta_value ELSE 0 END) as write_bytes,
        SUM(CASE WHEN stat_name = 'DB time' THEN delta_value ELSE 0 END) / 1000000 as db_time_seconds
      FROM delta_data
      GROUP BY snap_id, instance_number, snap_time, next_snap_time
      HAVING (next_snap_time - snap_time) * 86400 > 0
    )
    SELECT
      snap_id,
      instance_number,
      begin_time,
      end_time,
      ROUND(interval_seconds) as interval_seconds,
      -- Average values
      ROUND(read_ios / interval_seconds) as read_iops,
      ROUND(write_ios / interval_seconds) as write_iops,
      ROUND(read_bytes / interval_seconds / 1024 / 1024, 2) as read_mbps,
      ROUND(write_bytes / interval_seconds / 1024 / 1024, 2) as write_mbps,
      ROUND(db_time_seconds / interval_seconds, 4) as active_sessions,
      -- Peak values = averages (STATSPACK has no sub-interval peak tracking)
      ROUND(read_ios / interval_seconds) as peak_read_iops,
      ROUND(write_ios / interval_seconds) as peak_write_iops,
      ROUND(read_bytes / interval_seconds / 1024 / 1024, 2) as peak_read_mbps,
      ROUND(write_bytes / interval_seconds / 1024 / 1024, 2) as peak_write_mbps,
      ROUND(db_time_seconds / interval_seconds, 4) as peak_active_sessions
    FROM snap_metrics
    ORDER BY snap_id, instance_number
  ) LOOP
    IF v_first_snap THEN
      v_first_snap := FALSE;
    ELSE
      DBMS_OUTPUT.PUT_LINE(',');
    END IF;
    
    DBMS_OUTPUT.PUT('{');
    DBMS_OUTPUT.PUT('"snapId": ' || r.snap_id || ', ');
    DBMS_OUTPUT.PUT('"instanceNumber": ' || r.instance_number || ', ');
    DBMS_OUTPUT.PUT('"beginTime": ' || escape_json(r.begin_time) || ', ');
    DBMS_OUTPUT.PUT('"endTime": ' || escape_json(r.end_time) || ', ');
    DBMS_OUTPUT.PUT('"intervalSeconds": ' || r.interval_seconds || ', ');
    -- Average values
    DBMS_OUTPUT.PUT('"readIOPS": ' || fmt_num(NVL(r.read_iops, 0), 0) || ', ');
    DBMS_OUTPUT.PUT('"writeIOPS": ' || fmt_num(NVL(r.write_iops, 0), 0) || ', ');
    DBMS_OUTPUT.PUT('"readMBps": ' || fmt_num(NVL(r.read_mbps, 0), 2) || ', ');
    DBMS_OUTPUT.PUT('"writeMBps": ' || fmt_num(NVL(r.write_mbps, 0), 2) || ', ');
    DBMS_OUTPUT.PUT('"activeSessions": ' || fmt_num(NVL(r.active_sessions, 0), 4) || ', ');
    -- Estimated peak values (STATSPACK limitation note in comment above)
    DBMS_OUTPUT.PUT('"peakReadIOPS": ' || fmt_num(NVL(r.peak_read_iops, 0), 0) || ', ');
    DBMS_OUTPUT.PUT('"peakWriteIOPS": ' || fmt_num(NVL(r.peak_write_iops, 0), 0) || ', ');
    DBMS_OUTPUT.PUT('"peakReadMBps": ' || fmt_num(NVL(r.peak_read_mbps, 0), 2) || ', ');
    DBMS_OUTPUT.PUT('"peakWriteMBps": ' || fmt_num(NVL(r.peak_write_mbps, 0), 2) || ', ');
    DBMS_OUTPUT.PUT('"peakActiveSessions": ' || fmt_num(NVL(r.peak_active_sessions, 0), 4));
    DBMS_OUTPUT.PUT('}');
  END LOOP;
  
  DBMS_OUTPUT.PUT_LINE('');
  DBMS_OUTPUT.PUT_LINE(']');
  v_in_snapshots_array := FALSE;

  -- JSON End
  DBMS_OUTPUT.PUT_LINE('}');

EXCEPTION
  WHEN OTHERS THEN
    -- Ensure JSON output is structurally valid even on unhandled errors.
    -- Close any open array structures first
    IF v_in_snapshots_array THEN
      DBMS_OUTPUT.PUT_LINE('');
      DBMS_OUTPUT.PUT_LINE('],');
    END IF;
    -- If '{' was never printed, emit it now so the output is a valid JSON object.
    IF NOT v_json_started THEN
      DBMS_OUTPUT.PUT_LINE('{');
    END IF;
    DBMS_OUTPUT.PUT_LINE('"collectionError": {');
    DBMS_OUTPUT.PUT_LINE('"errorCode": ' || SQLCODE || ',');
    DBMS_OUTPUT.PUT_LINE('"errorMessage": ' || escape_json(SQLERRM));
    DBMS_OUTPUT.PUT_LINE('}}');
END;
/

SPOOL OFF
SET TERMOUT ON
PROMPT || STATSPACK data collection complete (hybrid format).
