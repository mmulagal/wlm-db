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

# Specify a custom output directory
python OracleDataCollector.py -s ORCL -o /data/collector-output
```

> **Tip:** On systems where `python` is not available (e.g. RHEL/OL 8+), use `python3` instead.

## Requirements

- Python 2.7+ or Python 3.x
- Oracle SQL*Plus on the host
- `/etc/oratab` for SID auto-detection (optional)

## Required Oracle Permissions

The database user running the collector needs **read access** to Oracle dictionary views. The recommended grant methods are:

| Method | Description |
|--------|-------------|
| **SYSDBA** | Connect as `/ as sysdba` (OS authentication) - recommended |
| **SELECT ANY DICTIONARY** | `GRANT SELECT ANY DICTIONARY TO <user>;` (recommended for non-SYSDBA) |

> **Important:** The collector uses PL/SQL dynamic SQL internally. Role-based grants like `SELECT_CATALOG_ROLE` may **not** be effective inside PL/SQL blocks. Use `SELECT ANY DICTIONARY` (a system privilege) or direct object grants instead.

### Mandatory (all setups)

- `v$instance`
- `v$database`
- `v$version`
- `v$option`
- `v$parameter`
- `v$sga`
- `v$pgastat`
- `v$osstat`
- `gv$instance`
- `dba_data_files`
- `dba_temp_files`
- `dba_free_space`
- `v$log`

### Mandatory (AWR - Enterprise Edition with Diagnostics Pack)

- `dba_hist_snapshot`
- `dba_hist_sysmetric_summary`

### Mandatory (Statspack - Standard Edition or Enterprise without Diagnostics Pack)

- `stats$snapshot`
- `stats$sysstat`
- `stats$osstat`

### Optional (setup-dependent)

- `v$pdbs` (CDB/multitenant only)
- `v$dataguard_config` (Data Guard only)
- `v$archive_dest_status` (Data Guard only)
- `v$asm_diskgroup` (ASM storage only)

For **CDB/PDB environments** (Container Databases with `C##` common users), both steps below are required:

```sql
GRANT SELECT ANY DICTIONARY TO C##WF_COLLECT CONTAINER=ALL;
ALTER USER C##WF_COLLECT SET CONTAINER_DATA = ALL CONTAINER = CURRENT;
```

## Sizing Scope

The sizing target is the entire CDB including all PDBs. The collector gathers metrics at the CDB level, so the resulting TCO analysis covers the full container database and all pluggable databases within it.

## Output Directory (`-o`)

By default, output files are written to the script directory. If the script directory is not writable by the target OS user (common when switching from `root` to `grid`/`oracle`), the collector automatically falls back to `/tmp/oracle-collector-<pid>/`.

Use `-o` / `--output-dir` to specify a custom output directory:

```bash
python OracleDataCollector.py -o /data/collector-output
```

The resolution order is:
1. User-specified path (`-o`) -- used if writable
2. Script directory -- used if writable
3. `/tmp/oracle-collector-<pid>/` -- guaranteed fallback

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
      "databaseInfo": { ... },
      "resourceUtilization": { ... },
      "performanceSnapshots": [ ... ],
      "performanceSummary": { ... },
      "storageInfo": { ... },
      "collectionMethod": "AWR"
    },
    {
      "databaseInfo": { ... },
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
