-- ===============================================================================
--         NETAPP CONSOLE WORKLOAD FACTORY - ORACLE DATA COLLECTOR CONTROLLER
--         Version 1.0.0
-- ===============================================================================

-- NOTE: WHENEVER SQLERROR CONTINUE is set intentionally here.
-- The shell script (OracleDataCollector.sh) sets WHENEVER SQLERROR EXIT,
-- but this controller overrides it because:
--   1. The PL/SQL analysis block has its own EXCEPTION handlers
--   2. If the child script (AWR/STATSPACK) fails, we still want the
--      controller to finish and produce diagnostic output
--   3. The shell script detects errors by counting ORA-/SP2- patterns
--      in the sqlplus output as a secondary safety net
WHENEVER SQLERROR CONTINUE
SET SERVEROUTPUT ON SIZE UNLIMITED;
SET FEEDBACK OFF;
SET VERIFY OFF;
SET ECHO OFF;
SET HEADING OFF;
SET LINESIZE 200;
SET PAGESIZE 0;
SET TRIMSPOOL ON;

PROMPT ===============================================================================
PROMPT || Starting Database Analysis...
PROMPT ===============================================================================

-- Check current user and privileges
SELECT '|| Connected as: ' || USER || ' (Session User: ' || SYS_CONTEXT('USERENV', 'SESSION_USER') || ')' FROM DUAL;

-- Single unified analysis block that both prints diagnostics AND sets the bind variable
VARIABLE v_script_action VARCHAR2(20)

DECLARE
  v_edition          VARCHAR2(100);
  v_pack_access      VARCHAR2(100);
  v_awr_snaps        NUMBER := 0;
  v_sp_snaps         NUMBER := 0;
  v_awr_time_span    NUMBER := 0;
  v_sp_time_span     NUMBER := 0;
  v_current_user     VARCHAR2(100);
  v_has_dba_access   NUMBER := 0;
  v_db_name          VARCHAR2(100);
  v_db_version       VARCHAR2(100);
  v_dbid             NUMBER := 0;
  v_db_status        VARCHAR2(20);
  -- Configurable parameters for TCO analysis validation
  v_lookback_days    NUMBER := 30;   -- How many days of history to check
  v_min_snaps        NUMBER := 10;   -- Minimum required snapshots
  v_min_hours        NUMBER := 12;   -- Minimum time span in hours
  -- CDB/PDB support (12c+)
  v_is_cdb           VARCHAR2(10) := 'NO';
  v_con_name         VARCHAR2(100) := 'N/A';
  v_con_id           NUMBER := 0;
  v_pdb_count        NUMBER := 0;
  -- RAC detection
  v_is_rac           VARCHAR2(10) := 'FALSE';
  v_rac_instances    NUMBER := 0;
BEGIN
  -- Initialize bind variable
  :v_script_action := 'NONE';

  -- Get current user
  SELECT USER INTO v_current_user FROM DUAL;

  -- =========================================================================
  -- DATABASE OPEN STATE VALIDATION (M6)
  -- =========================================================================
  BEGIN
    SELECT status INTO v_db_status FROM v$instance;
    IF v_db_status != 'OPEN' THEN
      DBMS_OUTPUT.PUT_LINE('|| ERROR: Database is not in OPEN state (current: ' || v_db_status || ').');
      DBMS_OUTPUT.PUT_LINE('|| Data collection requires the database to be OPEN.');
      DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:NONE');
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('|| WARNING: Could not determine database status.');
  END;

  -- Get database name and version
  BEGIN
    SELECT name INTO v_db_name FROM v$database;
    SELECT version INTO v_db_version FROM v$instance;
    DBMS_OUTPUT.PUT_LINE('|| Database: ' || v_db_name || ' (Version: ' || v_db_version || ')');
  EXCEPTION WHEN OTHERS THEN
    v_db_name := 'UNKNOWN';
    v_db_version := 'UNKNOWN';
  END;

  -- Check for CDB/PDB architecture (Oracle 12c+)
  BEGIN
    EXECUTE IMMEDIATE 'SELECT cdb FROM v$database' INTO v_is_cdb;
    EXECUTE IMMEDIATE 'SELECT SYS_CONTEXT(''USERENV'', ''CON_NAME'') FROM dual' INTO v_con_name;
    EXECUTE IMMEDIATE 'SELECT SYS_CONTEXT(''USERENV'', ''CON_ID'') FROM dual' INTO v_con_id;

    IF v_is_cdb = 'YES' THEN
      EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM v$pdbs WHERE con_id > 2' INTO v_pdb_count;
      DBMS_OUTPUT.PUT_LINE('|| Container Database: YES (CDB)');
      DBMS_OUTPUT.PUT_LINE('|| Current Container: ' || v_con_name || ' (CON_ID: ' || v_con_id || ')');
      DBMS_OUTPUT.PUT_LINE('|| PDBs in this CDB: ' || v_pdb_count);

      IF v_con_id = 1 THEN
        DBMS_OUTPUT.PUT_LINE('|| NOTE: Connected to CDB$ROOT - data collected will be CDB-level.');
        DBMS_OUTPUT.PUT_LINE('|| To collect PDB-specific data, connect directly to the PDB.');
      ELSIF v_con_id = 2 THEN
        -- H3: PDB$SEED - warn and halt
        DBMS_OUTPUT.PUT_LINE('|| WARNING: Connected to PDB$SEED - this is a template PDB.');
        DBMS_OUTPUT.PUT_LINE('|| Please connect to an application PDB instead.');
        DBMS_OUTPUT.PUT_LINE('|| No data collection will be performed.');
        DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:NONE');
        RETURN;
      ELSE
        DBMS_OUTPUT.PUT_LINE('|| NOTE: Connected to PDB - data collected will be PDB-level.');
      END IF;
    ELSE
      DBMS_OUTPUT.PUT_LINE('|| Container Database: NO (Non-CDB or pre-12c)');
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_is_cdb := 'NO';
      v_con_name := 'N/A';
      DBMS_OUTPUT.PUT_LINE('|| Container Database: N/A (Pre-12c version)');
  END;

  -- =========================================================================
  -- RAC DETECTION (M5: check active instances, not just option)
  -- =========================================================================
  BEGIN
    SELECT DECODE(value, 'TRUE', 'TRUE', 'FALSE') INTO v_is_rac
    FROM v$option WHERE parameter = 'Real Application Clusters';

    IF v_is_rac = 'TRUE' THEN
      -- Check actual active instances (M5)
      BEGIN
        SELECT COUNT(*) INTO v_rac_instances FROM gv$instance WHERE status = 'OPEN';
      EXCEPTION WHEN OTHERS THEN
        v_rac_instances := 1;
      END;

      -- Only block if actually running multi-instance RAC
      IF v_rac_instances > 1 THEN
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('||                    RAC DETECTED - NOT SUPPORTED');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| Real Application Clusters (RAC) has been detected on this database.');
        DBMS_OUTPUT.PUT_LINE('|| Active RAC Instances: ' || v_rac_instances);
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| This version of the Oracle TCO collector does not support RAC databases.');
        DBMS_OUTPUT.PUT_LINE('|| RAC requires special handling for:');
        DBMS_OUTPUT.PUT_LINE('||   - Cross-instance performance metrics aggregation');
        DBMS_OUTPUT.PUT_LINE('||   - Interconnect traffic analysis');
        DBMS_OUTPUT.PUT_LINE('||   - Global cache statistics');
        DBMS_OUTPUT.PUT_LINE('||   - Cluster-aware sizing recommendations');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| RECOMMENDATION:');
        DBMS_OUTPUT.PUT_LINE('|| Please contact NetApp support for RAC database TCO analysis.');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| No data collection will be performed.');
        DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:RAC_NOT_SUPPORTED');
        RETURN;
      ELSE
        DBMS_OUTPUT.PUT_LINE('|| RAC Status: RAC option enabled but running as Single Instance');
        v_is_rac := 'FALSE';
      END IF;
    ELSE
      DBMS_OUTPUT.PUT_LINE('|| RAC Status: Not enabled (Single Instance)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_is_rac := 'FALSE';
    DBMS_OUTPUT.PUT_LINE('|| RAC Status: Could not determine (assuming Single Instance)');
  END;

  -- H4: Privilege check (fixed: use ISDBA instead of broken osuser check)
  BEGIN
    -- Check system privileges
    SELECT COUNT(*) INTO v_has_dba_access
    FROM session_privs
    WHERE privilege IN ('SELECT ANY DICTIONARY', 'SELECT ANY TABLE');

    -- Also check granted roles
    IF v_has_dba_access = 0 THEN
      SELECT COUNT(*) INTO v_has_dba_access
      FROM user_role_privs
      WHERE granted_role IN ('DBA', 'SELECT_CATALOG_ROLE', 'OEM_MONITOR');
    END IF;

    -- Check if connected as SYSDBA
    IF v_has_dba_access = 0 THEN
      IF SYS_CONTEXT('USERENV', 'ISDBA') = 'TRUE' THEN
        v_has_dba_access := 1;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_has_dba_access := 0;
  END;

  IF v_has_dba_access = 0 THEN
    DBMS_OUTPUT.PUT_LINE('|| WARNING: Current user (' || v_current_user || ') may not have sufficient privileges.');
    DBMS_OUTPUT.PUT_LINE('|| Attempting to proceed with available permissions...');
  ELSE
    DBMS_OUTPUT.PUT_LINE('|| User has sufficient privileges for data collection.');
  END IF;

  -- Check the database edition
  BEGIN
    SELECT banner INTO v_edition FROM v$version WHERE banner LIKE 'Oracle Database%' AND ROWNUM = 1;
  EXCEPTION WHEN OTHERS THEN
    v_edition := 'Unknown Edition';
    DBMS_OUTPUT.PUT_LINE('|| WARNING: Could not determine database edition.');
  END;

  -- Check the license parameter
  BEGIN
    SELECT value INTO v_pack_access FROM v$parameter WHERE name = 'control_management_pack_access';
  EXCEPTION WHEN OTHERS THEN
    v_pack_access := 'NONE';
    DBMS_OUTPUT.PUT_LINE('|| WARNING: Could not read control_management_pack_access parameter.');
  END;

  -- H5: Get DBID - prefer CON_DBID for PDB-local AWR (12.2+)
  BEGIN
    EXECUTE IMMEDIATE 'SELECT con_dbid FROM v$database' INTO v_dbid;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT dbid INTO v_dbid FROM v$database;
    EXCEPTION WHEN OTHERS THEN
      v_dbid := 0;
    END;
  END;

  -- C1: AWR snapshot check - CAST timestamps to DATE before subtraction
  BEGIN
    EXECUTE IMMEDIATE
      'SELECT COUNT(*),
              NVL(ROUND((CAST(MAX(end_interval_time) AS DATE) - CAST(MIN(begin_interval_time) AS DATE)) * 24, 2), 0)
      FROM dba_hist_snapshot
      WHERE dbid = :1
        AND begin_interval_time > SYSDATE - :2'
    INTO v_awr_snaps, v_awr_time_span
    USING v_dbid, v_lookback_days;
  EXCEPTION
    WHEN OTHERS THEN
      v_awr_snaps := 0;
      v_awr_time_span := 0;
      IF SQLCODE = -942 THEN
        DBMS_OUTPUT.PUT_LINE('|| INFO: AWR tables not accessible or do not exist.');
      END IF;
  END;

  -- H6: STATSPACK query with date range and DBID filter
  BEGIN
    EXECUTE IMMEDIATE
      'SELECT COUNT(*),
              NVL(ROUND((MAX(snap_time) - MIN(snap_time)) * 24, 2), 0)
      FROM stats$snapshot
      WHERE snap_time > SYSDATE - :1
        AND dbid = :2'
    INTO v_sp_snaps, v_sp_time_span
    USING v_lookback_days, v_dbid;
  EXCEPTION
    WHEN OTHERS THEN
      v_sp_snaps := 0;
      v_sp_time_span := 0;
      IF SQLCODE = -942 THEN
        DBMS_OUTPUT.PUT_LINE('|| INFO: STATSPACK tables not accessible or do not exist.');
      END IF;
  END;

  DBMS_OUTPUT.PUT_LINE('|| ');
  DBMS_OUTPUT.PUT_LINE('|| Analysis Results:');
  DBMS_OUTPUT.PUT_LINE('|| - Edition: ' || v_edition);
  DBMS_OUTPUT.PUT_LINE('|| - Management Pack Access: ' || v_pack_access);
  DBMS_OUTPUT.PUT_LINE('|| - AWR Snapshots Available: ' || v_awr_snaps || ' (Time Span: ' || v_awr_time_span || ' hours)');
  DBMS_OUTPUT.PUT_LINE('|| - STATSPACK Snapshots Available: ' || v_sp_snaps || ' (Time Span: ' || v_sp_time_span || ' hours)');
  DBMS_OUTPUT.PUT_LINE('|| ');
  DBMS_OUTPUT.PUT_LINE('|| Minimum Requirements: ' || v_min_snaps || ' snapshots, ' || v_min_hours || ' hours of data');
  DBMS_OUTPUT.PUT_LINE('|| ');

  -- Decision logic: determine action and set bind variable
  IF INSTR(UPPER(v_edition), 'ENTERPRISE EDITION') > 0 THEN
    IF UPPER(v_pack_access) IN ('DIAGNOSTIC', 'DIAGNOSTIC+TUNING') THEN
      IF v_awr_snaps >= v_min_snaps AND v_awr_time_span >= v_min_hours THEN
        :v_script_action := 'AWR';
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Enterprise Edition with Diagnostics Pack detected.');
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: AWR snapshots validation passed (' || v_awr_snaps || ' snapshots, ' || v_awr_time_span || ' hours).');
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Running AWR collector...');
        DBMS_OUTPUT.PUT_LINE('|| ');
      ELSE
        :v_script_action := 'NONE';
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('||                    INSUFFICIENT AWR SNAPSHOT DATA');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| Current Status:');
        DBMS_OUTPUT.PUT_LINE('||   - Snapshots Found: ' || v_awr_snaps || ' (Required: >=' || v_min_snaps || ')');
        DBMS_OUTPUT.PUT_LINE('||   - Time Span: ' || v_awr_time_span || ' hours (Required: >=' || v_min_hours || ' hours)');
        DBMS_OUTPUT.PUT_LINE('|| ');

        IF v_awr_snaps < v_min_snaps THEN
          DBMS_OUTPUT.PUT_LINE('|| ISSUE: Insufficient number of snapshots');
        END IF;

        IF v_awr_time_span < v_min_hours THEN
          DBMS_OUTPUT.PUT_LINE('|| ISSUE: Insufficient time span between snapshots');
        END IF;

        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| RECOMMENDATION:');
        DBMS_OUTPUT.PUT_LINE('|| AWR is licensed but does not have sufficient historical data for analysis.');
        DBMS_OUTPUT.PUT_LINE('|| Please ensure AWR snapshots are enabled and have been running for at least');
        DBMS_OUTPUT.PUT_LINE('|| ' || v_min_hours || ' hours with regular snapshot intervals.');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| To check AWR snapshot configuration:');
        DBMS_OUTPUT.PUT_LINE('||   SELECT snap_interval, retention FROM dba_hist_wr_control;');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| To manually create an AWR snapshot (as SYSDBA):');
        DBMS_OUTPUT.PUT_LINE('||   BEGIN');
        DBMS_OUTPUT.PUT_LINE('||     DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT();');
        DBMS_OUTPUT.PUT_LINE('||   END;');
        DBMS_OUTPUT.PUT_LINE('||   /');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| Please wait for sufficient data collection and re-run this script.');
        DBMS_OUTPUT.PUT_LINE('|| No performance data collected at this time.');
        DBMS_OUTPUT.PUT_LINE('|| ');
      END IF;
    ELSE
      -- AWR is not licensed, fall back to STATSPACK
      IF v_sp_snaps >= v_min_snaps AND v_sp_time_span >= v_min_hours THEN
        :v_script_action := 'STATSPACK';
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Enterprise Edition without Diagnostics Pack license.');
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: STATSPACK snapshots validation passed (' || v_sp_snaps || ' snapshots, ' || v_sp_time_span || ' hours).');
        DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Running STATSPACK collector...');
        DBMS_OUTPUT.PUT_LINE('|| ');
      ELSE
        :v_script_action := 'NONE';
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('||                 INSUFFICIENT STATSPACK SNAPSHOT DATA');
        DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| Current Status:');
        DBMS_OUTPUT.PUT_LINE('||   - Snapshots Found: ' || v_sp_snaps || ' (Required: >=' || v_min_snaps || ')');
        DBMS_OUTPUT.PUT_LINE('||   - Time Span: ' || v_sp_time_span || ' hours (Required: >=' || v_min_hours || ' hours)');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| RECOMMENDATION:');
        DBMS_OUTPUT.PUT_LINE('|| This is Enterprise Edition without Diagnostics Pack license.');
        DBMS_OUTPUT.PUT_LINE('|| STATSPACK is not installed or does not have sufficient historical data.');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| Installation and Configuration Steps:');
        DBMS_OUTPUT.PUT_LINE('||   1. Connect as SYSDBA');
        DBMS_OUTPUT.PUT_LINE('||   2. Install STATSPACK: @?/rdbms/admin/spcreate.sql');
        DBMS_OUTPUT.PUT_LINE('||   3. Create initial snapshot: EXEC STATSPACK.SNAP;');
        DBMS_OUTPUT.PUT_LINE('||   4. Schedule regular snapshots (e.g., hourly via cron/dbms_scheduler)');
        DBMS_OUTPUT.PUT_LINE('||   5. Wait for at least ' || v_min_hours || ' hours of data collection');
        DBMS_OUTPUT.PUT_LINE('||   6. Re-run this collection script');
        DBMS_OUTPUT.PUT_LINE('|| ');
        DBMS_OUTPUT.PUT_LINE('|| No performance data collected at this time.');
        DBMS_OUTPUT.PUT_LINE('|| ');
      END IF;
    END IF;
  ELSE
    -- Standard Edition or unknown
    IF v_sp_snaps >= v_min_snaps AND v_sp_time_span >= v_min_hours THEN
      :v_script_action := 'STATSPACK';
      DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Standard Edition (or non-Enterprise) detected.');
      DBMS_OUTPUT.PUT_LINE('|| SUCCESS: STATSPACK snapshots validation passed (' || v_sp_snaps || ' snapshots, ' || v_sp_time_span || ' hours).');
      DBMS_OUTPUT.PUT_LINE('|| SUCCESS: Running STATSPACK collector...');
      DBMS_OUTPUT.PUT_LINE('|| ');
    ELSE
      :v_script_action := 'NONE';
      DBMS_OUTPUT.PUT_LINE('|| ');
      DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
      DBMS_OUTPUT.PUT_LINE('||                 INSUFFICIENT STATSPACK SNAPSHOT DATA');
      DBMS_OUTPUT.PUT_LINE('|| ============================================================================');
      DBMS_OUTPUT.PUT_LINE('|| ');
      DBMS_OUTPUT.PUT_LINE('|| Current Status:');
      DBMS_OUTPUT.PUT_LINE('||   - Snapshots Found: ' || v_sp_snaps || ' (Required: >=' || v_min_snaps || ')');
      DBMS_OUTPUT.PUT_LINE('||   - Time Span: ' || v_sp_time_span || ' hours (Required: >=' || v_min_hours || ' hours)');
      DBMS_OUTPUT.PUT_LINE('|| ');
      DBMS_OUTPUT.PUT_LINE('|| RECOMMENDATION:');
      DBMS_OUTPUT.PUT_LINE('|| This is Standard Edition (or non-Enterprise).');
      DBMS_OUTPUT.PUT_LINE('|| STATSPACK is not installed or does not have sufficient historical data.');
      DBMS_OUTPUT.PUT_LINE('|| ');
      DBMS_OUTPUT.PUT_LINE('|| Installation and Configuration Steps:');
      DBMS_OUTPUT.PUT_LINE('||   1. Connect as SYSDBA');
      DBMS_OUTPUT.PUT_LINE('||   2. Install STATSPACK: @?/rdbms/admin/spcreate.sql');
      DBMS_OUTPUT.PUT_LINE('||   3. Create initial snapshot: EXEC STATSPACK.SNAP;');
      DBMS_OUTPUT.PUT_LINE('||   4. Schedule regular snapshots (e.g., hourly via cron/dbms_scheduler)');
      DBMS_OUTPUT.PUT_LINE('||   5. Wait for at least ' || v_min_hours || ' hours of data collection');
      DBMS_OUTPUT.PUT_LINE('||   6. Re-run this collection script');
      DBMS_OUTPUT.PUT_LINE('|| ');
      DBMS_OUTPUT.PUT_LINE('|| No performance data collected at this time.');
      DBMS_OUTPUT.PUT_LINE('|| ');
    END IF;
  END IF;

  -- Log the final action
  IF :v_script_action = 'AWR' THEN
    DBMS_OUTPUT.PUT_LINE('|| Executing AWR data collector...');
    DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:AWR');
  ELSIF :v_script_action = 'STATSPACK' THEN
    DBMS_OUTPUT.PUT_LINE('|| Executing STATSPACK data collector...');
    DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:STATSPACK');
  ELSE
    DBMS_OUTPUT.PUT_LINE('|| No data collection script will be executed.');
    DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:NONE');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    :v_script_action := 'NONE';
    DBMS_OUTPUT.PUT_LINE('|| ERROR: An unexpected error occurred during analysis.');
    DBMS_OUTPUT.PUT_LINE('|| Error Code: ' || SQLCODE);
    DBMS_OUTPUT.PUT_LINE('|| Error Message: ' || SQLERRM);
    DBMS_OUTPUT.PUT_LINE('|| ');
    DBMS_OUTPUT.PUT_LINE('|| Please verify:');
    DBMS_OUTPUT.PUT_LINE('||   1. Database is accessible');
    DBMS_OUTPUT.PUT_LINE('||   2. User has necessary privileges');
    DBMS_OUTPUT.PUT_LINE('||   3. Database is in OPEN state');
    DBMS_OUTPUT.PUT_LINE('SCRIPT_ACTION:ERROR');
END;
/

PROMPT ===============================================================================

-- M9: Use COLUMN/NEW_VALUE to set substitution variable, then use @@ for relative path
COLUMN script_to_run NEW_VALUE script_to_run NOPRINT
SELECT CASE :v_script_action
        WHEN 'AWR' THEN 'OracleDataCollectorAWR.sql'
        WHEN 'STATSPACK' THEN 'OracleDataCollectorStatspack.sql'
        ELSE '_no_action.sql'
      END AS script_to_run
FROM DUAL;

-- H7: _no_action.sql is shipped as a static file with the package.
-- No dynamic creation needed.

-- L16: Reset formatting before executing child script
SET HEADING ON
SET PAGESIZE 50000

-- M9: Use @@ to resolve relative to this script's directory
@@&script_to_run

-- Note: Cleanup of _no_action.sql is handled by the shell script

PROMPT ===============================================================================
PROMPT || Database analysis finished. Check output above for status.
PROMPT ===============================================================================
