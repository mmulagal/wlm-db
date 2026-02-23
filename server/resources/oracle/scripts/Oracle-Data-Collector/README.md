# Oracle Data Collector

Python-based collector for gathering Oracle database configuration, performance, and storage metrics from on-premises hosts. Produces a single combined JSON file per host containing all SIDs.

## Quick Start

Use `python` or `python3` depending on what is available on your system:

```bash
# Interactive mode (prompts for credentials and SIDs)
python OracleDataCollector.py

# OS authentication with specific SIDs
python OracleDataCollector.py -s "ORCL TESTDB DGDB"

# Username/password authentication
python OracleDataCollector.py -u system -p password -s "ORCL TESTDB"
```

> **Tip:** On systems where `python` is not available (e.g. RHEL/OL 8+), use `python3` instead.

## Requirements

- Python 2.7+ or Python 3.x
- Oracle SQL*Plus on the host
- `/etc/oratab` for SID auto-detection (optional)

## Required Oracle Permissions

The database user running the collector needs **read access** to Oracle dictionary views. Use one of the following:

| Method | Description |
|--------|-------------|
| **SYSDBA** | Connect as `/ as sysdba` (OS authentication) - recommended |
| **DBA role** | `GRANT DBA TO <user>;` |
| **SELECT_CATALOG_ROLE** | `GRANT SELECT_CATALOG_ROLE TO <user>;` (read-only, least privilege) |

**Minimum required views:**
- `v$instance`, `v$database`, `v$version`, `v$parameter`
- `v$osstat`, `v$sga`, `v$pgastat`, `v$log`
- `dba_data_files`, `dba_temp_files`, `dba_free_space`
- **For AWR:** `dba_hist_snapshot`, `dba_hist_sysstat`, `dba_hist_sys_time_model`, `dba_hist_osstat`
- **For STATSPACK:** `stats$snapshot`, `stats$sysstat`, `stats$sys_time_model`

**Note:** AWR access requires a valid Diagnostics Pack license (Enterprise Edition only).

## Output

A single combined JSON file per host:

```
OracleDataResponse-<epoch_timestamp>.json
```

The file contains host-level info and a `databases` array with one entry per SID:

```json
{
  "scriptInfo": { ... },
  "hostInfo": { ... },
  "databases": [
    {
      "instanceInfo": { ... },
      "resourceUtilization": { ... },
      "performanceSnapshots": [ ... ],
      "performanceSummary": { ... },
      "storageInfo": { ... },
      "collectionMethod": "AWR"
    },
    {
      "instanceInfo": { ... },
      "collectionMethod": "STATSPACK",
      ...
    }
  ]
}
```

Each database entry carries its own `collectionMethod` to handle mixed AWR/STATSPACK environments.

## File Structure

| File | Description |
|------|-------------|
| `OracleDataCollector.py` | Main Python collector script |
| `OracleDataCollectorController.sql` | SQL*Plus controller script (called by Python) |
| `OracleDataResponse-<epoch>.json` | Combined output (all SIDs on one host) |

## How It Works

1. Collects host system info (CPU, RAM, storage protocol, network)
2. Detects Oracle SIDs from `/etc/oratab` (or uses provided list)
3. For each SID, runs SQL*Plus with the controller script to gather instance, performance, and storage data
4. Parses each per-SID JSON output into memory
5. Merges all SID data into a single `databases[]` array with shared `hostInfo` and `scriptInfo`
6. Writes one combined output file: `OracleDataResponse-<epoch_timestamp>.json`

## User Switching

If not running as the `oracle` OS user, the script automatically switches via `su` (if root) or `sudo su` to run the SQL*Plus database collection phase as `oracle`.

## Next Steps

After the script completes successfully:

1. Upload the generated JSON file (e.g. `OracleDataResponse-<epoch_timestamp>.json`) to **Workload Factory**.
2. Select your host and explore the potential savings and recommended **FSxN** configuration.
