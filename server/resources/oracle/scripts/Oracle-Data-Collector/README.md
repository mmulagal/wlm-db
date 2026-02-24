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

The database user running the collector needs **read access** to Oracle dictionary views. The recommended grant methods are:

| Method | Description |
|--------|-------------|
| **SYSDBA** | Connect as `/ as sysdba` (OS authentication) - recommended |
| **SELECT ANY DICTIONARY** | `GRANT SELECT ANY DICTIONARY TO <user>;` (recommended for non-SYSDBA) |

> **Important:** The collector uses PL/SQL dynamic SQL internally. Role-based grants like `SELECT_CATALOG_ROLE` may **not** be effective inside PL/SQL blocks. Use `SELECT ANY DICTIONARY` (a system privilege) or direct object grants instead.

For the full list of required Oracle views and tables -- grouped by category, with mandatory/optional flags and which Oracle setups they apply to -- see **[`OracleDataCollectorPermissions.json`](OracleDataCollectorPermissions.json)**.

For **CDB/PDB environments** (Container Databases with `C##` common users), both steps below are required:

```sql
GRANT SELECT ANY DICTIONARY TO C##WF_COLLECT CONTAINER=ALL;
ALTER USER C##WF_COLLECT SET CONTAINER_DATA = ALL CONTAINER = CURRENT;
```

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
| `OracleDataCollectorPermissions.json` | Required Oracle permissions (views/tables, mandatory/optional, per setup) |
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
