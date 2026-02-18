#!/usr/bin/env python
# -*- coding: utf-8 -*-
# ===============================================================================
#         NETAPP CONSOLE WORKLOAD FACTORY - ORACLE DATA COLLECTOR (Python)
#         Version 1.0.0
#         Copyright (c) 2025 NetApp, Inc. All rights reserved.
# ===============================================================================
#
# Python 2.7+ / 3.x compatible alternative to OracleDataCollector.sh
# Produces identical JSON output. Uses the same SQL scripts.
#
# USAGE:
#   python OracleDataCollector.py                          # Interactive mode
#   python OracleDataCollector.py -s "ORCL TESTDB"         # OS auth with specific SIDs
#   python OracleDataCollector.py -u system -s ORCL        # Prompt for password, specific SID
#   python OracleDataCollector.py -h                       # Show help
#
# ===============================================================================

from __future__ import print_function

import sys
import os
import json
import re
import socket
import subprocess
import tempfile
import argparse
import getpass
import glob
import time
import threading
from datetime import datetime
from collections import OrderedDict
from multiprocessing import cpu_count

# Python 2/3 compatibility
if sys.version_info[0] >= 3:
    get_input = input
else:
    get_input = raw_input  # noqa: F821


# ============================================================================
# Subprocess Utilities
# ============================================================================

def run_cmd_with_timeout(cmd, timeout_sec=10):
    """Run a command with timeout. Returns (returncode, stdout, stderr).
    
    Python 2/3 compatible implementation using threading.
    """
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    result = {"stdout": b"", "stderr": b"", "returncode": None, "timed_out": False}

    def target():
        result["stdout"], result["stderr"] = proc.communicate()
        result["returncode"] = proc.returncode

    thread = threading.Thread(target=target)
    thread.start()
    thread.join(timeout_sec)

    if thread.is_alive():
        try:
            proc.kill()
        except OSError:
            pass
        thread.join(1)
        result["timed_out"] = True
        result["returncode"] = -1

    return (
        result["returncode"],
        result["stdout"].decode("utf-8", errors="replace"),
        result["stderr"].decode("utf-8", errors="replace"),
        result["timed_out"],
    )


# ============================================================================
# JSON Utilities
# ============================================================================

def parse_per_sid_json(json_file):
    """Parse the per-SID JSON output from the SQL script and return a dict."""
    try:
        with open(json_file, "r") as f:
            content = f.read()

        if not content.strip().startswith("{"):
            print("WARNING: JSON file does not start with '{': %s" % json_file)
            return None

        return json.loads(content, object_pairs_hook=OrderedDict)
    except (IOError, OSError, ValueError, TypeError) as e:
        print("WARNING: Failed to parse JSON from %s: %s" % (json_file, e))
        return None


def build_combined_json(script_info, host_info, per_sid_dicts):
    """Build a single combined JSON dict with all SIDs in a databases[] array.

    Each per-SID dict produced by the SQL script has top-level keys like:
        scriptInfo, instanceInfo, resourceUtilization, performanceSnapshots,
        performanceSummary, storageInfo, sizingRecommendations

    The combined output groups per-SID data under 'databases[]' and lifts
    scriptInfo and hostInfo to the top level.
    """
    databases = []
    for sid_data in per_sid_dicts:
        entry = OrderedDict()
        for key in ("instanceInfo", "resourceUtilization", "performanceSnapshots",
                     "performanceSummary", "storageInfo", "sizingRecommendations"):
            if key in sid_data:
                entry[key] = sid_data[key]
        # Carry per-SID collectionMethod from its own scriptInfo (handles mixed AWR/STATSPACK)
        sid_script_info = sid_data.get("scriptInfo", {})
        if "collectionMethod" in sid_script_info:
            entry["collectionMethod"] = sid_script_info["collectionMethod"]
        databases.append(entry)

    combined = OrderedDict()
    combined["scriptInfo"] = script_info
    combined["hostInfo"] = host_info
    combined["databases"] = databases
    return combined


# ============================================================================
# Host Information Collection
# ============================================================================

def get_hostname():
    """Get the system hostname."""
    return socket.gethostname()


def get_os_info():
    """Get operating system information."""
    if os.path.isfile("/etc/os-release"):
        try:
            with open("/etc/os-release", "r") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"')
        except (IOError, OSError):
            pass
    try:
        rc, out, _, _ = run_cmd_with_timeout(["uname", "-s", "-r"], timeout_sec=5)
        if rc == 0 and out.strip():
            return out.strip()
    except (OSError, IOError):
        pass
    return "Unknown"


def get_cpu_count():
    """Get the number of logical CPUs."""
    try:
        return cpu_count()
    except NotImplementedError:
        pass
    if os.path.isfile("/proc/cpuinfo"):
        try:
            with open("/proc/cpuinfo", "r") as f:
                return sum(1 for line in f if line.startswith("processor"))
        except (IOError, OSError):
            pass
    # Try nproc command as final fallback
    try:
        rc, out, _, _ = run_cmd_with_timeout(["nproc"], timeout_sec=5)
        if rc == 0 and out.strip():
            return int(out.strip())
    except (OSError, IOError, ValueError):
        pass
    return 1


def get_total_ram_bytes():
    """Get total RAM in bytes."""
    if os.path.isfile("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal"):
                        parts = line.split()
                        return int(parts[1]) * 1024  # kB to bytes
        except (IOError, OSError, ValueError, IndexError):
            pass
    # Fallback: try free command
    try:
        rc, out, _, _ = run_cmd_with_timeout(["free", "-b"], timeout_sec=5)
        if rc == 0:
            for line in out.splitlines():
                if line.startswith("Mem:"):
                    return int(line.split()[1])
    except (OSError, IOError, ValueError, IndexError):
        pass
    return 0


def get_unique_host_id():
    """Get a unique host identifier."""
    for path in ["/sys/class/dmi/id/product_uuid", "/etc/machine-id"]:
        if os.path.isfile(path):
            if not os.access(path, os.R_OK):
                print("DEBUG: Cannot read %s (insufficient permissions)" % path)
                continue
            try:
                with open(path, "r") as f:
                    uid = f.read().strip()
                if uid and not uid.startswith("N/A"):
                    return uid
            except (IOError, OSError):
                pass
    return get_hostname()


def get_ip_addresses():
    """Get all configured IP addresses."""
    # Try hostname -I
    try:
        rc, out, _, _ = run_cmd_with_timeout(["hostname", "-I"], timeout_sec=5)
        if rc == 0 and out.strip():
            return out.strip()
    except (OSError, IOError):
        pass
    # Try ip command
    try:
        rc, out, _, _ = run_cmd_with_timeout(["ip", "-4", "addr", "show"], timeout_sec=5)
        if rc == 0:
            ips = re.findall(r"inet (\d+\.\d+\.\d+\.\d+)", out)
            ips = [ip for ip in ips if ip != "127.0.0.1"]
            if ips:
                return " ".join(ips)
    except (OSError, IOError):
        pass
    return "Unknown"


# ============================================================================
# Storage Protocol Detection
# ============================================================================

def detect_storage_protocol():
    """Detect storage protocol (NFS, iSCSI, ASM, Local)."""
    protocol = "Unknown"
    details = []
    nfs_mounts = ""

    # Check iSCSI
    iscsi_path = "/sys/class/iscsi_session"
    if os.path.isdir(iscsi_path):
        try:
            sessions = os.listdir(iscsi_path)
            if sessions:
                protocol = "iSCSI"
                details.append("Active iSCSI sessions: %d" % len(sessions))
                print("[OK] Detected: iSCSI (%d active sessions)" % len(sessions))
        except (OSError, IOError):
            pass

    # Check NFS
    try:
        rc, out, _, _ = run_cmd_with_timeout(["mount"], timeout_sec=10)
        if rc == 0:
            mount_lines = out.splitlines()
            nfs_lines = [l for l in mount_lines if "type nfs" in l or "type nfs4" in l]
            if nfs_lines:
                if protocol == "iSCSI":
                    protocol = "Mixed (iSCSI + NFS)"
                else:
                    protocol = "NFS"
                details.append("NFS mounts: %d" % len(nfs_lines))
                print("[OK] Detected: NFS (%d mounts)" % len(nfs_lines))
                mounts = []
                for line in nfs_lines:
                    parts = line.split()
                    if len(parts) >= 3:
                        mounts.append("%s -> %s" % (parts[0], parts[2]))
                nfs_mounts = "; ".join(mounts)
    except (OSError, IOError):
        pass

    # Check for Oracle ASM
    try:
        rc, out, _, _ = run_cmd_with_timeout(["asmcmd", "lsdg"], timeout_sec=15)
        if rc == 0 and out.strip():
            lines = out.splitlines()
            if len(lines) > 1:  # Header + data
                if protocol == "Unknown":
                    protocol = "ASM"
                else:
                    protocol = "Mixed (%s + ASM)" % protocol
                details.append("Oracle ASM disk groups detected")
                print("[OK] Detected: Oracle ASM")
    except (OSError, IOError):
        pass

    # Fallback to local storage
    if protocol == "Unknown":
        protocol = "Local/DAS"
        details.append("Local storage")
        print("[OK] Detected: Local/DAS storage")

    return {
        "protocol": protocol,
        "details": ", ".join(details),
        "nfs_mounts": nfs_mounts,
    }


def collect_host_info(storage_info):
    """Collect all host information into an OrderedDict."""
    host_info = OrderedDict()
    host_info["collectionTimestamp"] = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    host_info["hostname"] = get_hostname()
    host_info["operatingSystem"] = get_os_info()
    host_info["cpuCount"] = get_cpu_count()
    host_info["totalRamBytes"] = get_total_ram_bytes()
    host_info["uniqueHostId"] = get_unique_host_id()
    host_info["ipAddresses"] = get_ip_addresses()
    host_info["storageProtocol"] = storage_info["protocol"]
    host_info["storageDetails"] = storage_info["details"]
    host_info["nfsMounts"] = storage_info["nfs_mounts"]
    return host_info


# ============================================================================
# Oracle SID and Environment
# ============================================================================

def auto_detect_sids():
    """Auto-detect Oracle SIDs from /etc/oratab."""
    sids = []
    oratab = "/etc/oratab"
    if not os.path.isfile(oratab):
        print("WARNING: /etc/oratab not found. Cannot auto-detect SIDs.")
        return sids
    try:
        with open(oratab, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("*"):
                    continue
                parts = line.split(":")
                if len(parts) >= 2 and parts[0]:
                    oracle_home = parts[1]
                    if os.path.isdir(oracle_home):
                        sids.append(parts[0])
    except (IOError, OSError) as e:
        print("WARNING: Could not read /etc/oratab: %s" % e)
    return sids


def get_oracle_home(sid):
    """Get ORACLE_HOME for a SID from /etc/oratab."""
    oratab = "/etc/oratab"
    if not os.path.isfile(oratab):
        return None
    try:
        with open(oratab, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("*"):
                    continue
                parts = line.split(":")
                if len(parts) >= 2 and parts[0] == sid:
                    if os.path.isdir(parts[1]):
                        return parts[1]
    except (IOError, OSError):
        pass
    return None


def set_oracle_env(sid, oracle_home):
    """Set Oracle environment variables for a SID."""
    os.environ["ORACLE_SID"] = sid
    if oracle_home:
        os.environ["ORACLE_HOME"] = oracle_home
        # Prepend to PATH
        bin_path = os.path.join(oracle_home, "bin")
        current_path = os.environ.get("PATH", "")
        if bin_path not in current_path:
            os.environ["PATH"] = bin_path + os.pathsep + current_path
        # Prepend to LD_LIBRARY_PATH
        lib_path = os.path.join(oracle_home, "lib")
        current_ld = os.environ.get("LD_LIBRARY_PATH", "")
        if lib_path not in current_ld:
            os.environ["LD_LIBRARY_PATH"] = lib_path + (":" + current_ld if current_ld else "")


# ============================================================================
# SQL*Plus Execution
# ============================================================================

def run_sqlplus(sid, db_user, db_pass):
    """Run SQL*Plus with the controller script. Returns (exit_code, output)."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    controller = os.path.join(script_dir, "OracleDataCollectorController.sql")

    if not os.path.isfile(controller):
        print("WARNING: OracleDataCollectorController.sql not found in %s" % script_dir)
        return (1, "")

    sqlplus_bin = "sqlplus"

    # Build SQL input
    sql_lines = [
        "WHENEVER SQLERROR EXIT SQL.SQLCODE",
        "WHENEVER OSERROR EXIT FAILURE",
    ]

    if db_user and db_pass:
        sql_lines.append('CONNECT %s/"%s"' % (db_user, db_pass))
    elif db_user:
        sql_lines.append("CONNECT %s" % db_user)
    else:
        sql_lines.append("CONNECT / AS SYSDBA")

    sql_lines.append("@%s" % controller)
    sql_input = "\n".join(sql_lines) + "\n"

    try:
        p = subprocess.Popen(
            [sqlplus_bin, "-s", "/nolog"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=script_dir,
        )
        output, _ = p.communicate(input=sql_input.encode("utf-8"))
        output_str = output.decode("utf-8", errors="replace")

        # Print sqlplus output (like tee in bash)
        print(output_str)

        # Count errors
        ora_errors = len(re.findall(r"ORA-", output_str))
        sp2_errors = len(re.findall(r"SP2-", output_str))

        if p.returncode != 0 or ora_errors > 0 or sp2_errors > 0:
            if p.returncode != 0:
                print("  - SQL*Plus exit code: %d" % p.returncode)
            if ora_errors > 0:
                print("  - ORA- errors found: %d" % ora_errors)
            if sp2_errors > 0:
                print("  - SP2- errors found: %d" % sp2_errors)
            return (1, output_str)

        return (0, output_str)

    except OSError as e:
        print("ERROR: Could not run sqlplus: %s" % e)
        return (1, "")


def find_output_json(sid, before_time):
    """Find the JSON output file generated by the SQL script for this SID."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pattern = os.path.join(script_dir, "Oracle*DataResponse*-%s-*.json" % sid)
    candidates = glob.glob(pattern)

    # Prefer files modified after before_time
    for f in sorted(candidates, key=os.path.getmtime, reverse=True):
        if os.path.getmtime(f) >= before_time:
            return f

    # Fallback: most recent file
    if candidates:
        return sorted(candidates, key=os.path.getmtime, reverse=True)[0]

    return None


# ============================================================================
# CLI and Main
# ============================================================================

def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="NetApp Console Workload Factory - Oracle Data Collector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python OracleDataCollector.py                          # Interactive mode
  python OracleDataCollector.py -s "ORCL TESTDB"         # OS auth with specific SIDs
  python OracleDataCollector.py -u system -s ORCL        # Prompt for password
  python OracleDataCollector.py -u system -p pass -s ORCL  # Non-interactive
""",
    )
    parser.add_argument("-u", "--user", default="", help="Database username (omit for OS authentication)")
    parser.add_argument("-p", "--password", default="", help="Database password (omit to be prompted)")
    parser.add_argument("-s", "--sids", default="", help="Space-separated list of Oracle SIDs")
    parser.add_argument(
        "--internal-phase2", dest="internal_phase2", default="",
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def get_credentials(args):
    """Get database credentials from args or interactive prompts."""
    db_user = args.user
    db_pass = args.password
    sid_list_str = args.sids
    interactive = not (db_user or db_pass or sid_list_str)

    if interactive:
        db_user = get_input("Enter the database username (press Enter for OS authentication): ").strip()
        if db_user:
            db_pass = getpass.getpass("Enter the password for %s: " % db_user)
        else:
            print("No username provided. Will use OS authentication (/ as sysdba).")

        sid_list_str = get_input(
            "Enter the list of Oracle SIDs (space-separated, or press Enter to auto-detect): "
        ).strip()
    else:
        print("Running in non-interactive mode...")
        if db_user:
            if not db_pass:
                db_pass = getpass.getpass("Enter the password for %s: " % db_user)
            print("  - Username: %s" % db_user)
        else:
            print("  - Authentication: OS authentication (/ as sysdba)")
        if sid_list_str:
            print("  - SIDs: %s" % sid_list_str)
        else:
            print("  - SIDs: Auto-detect")

    sid_list = sid_list_str.split() if sid_list_str else []
    return db_user, db_pass, sid_list


def write_phase2_data(host_info, storage_info, db_user, sid_list):
    """Write phase 1 data to a temp JSON file for phase 2 to read.
    
    Note: Password is passed via environment variable (ORACLE_COLLECTOR_DB_PASS)
    for security - not written to disk.
    """
    data = {
        "host_info": host_info,
        "storage_info": storage_info,
        "db_user": db_user,
        "sid_list": sid_list,
    }
    fd = tempfile.NamedTemporaryFile(
        prefix="oracle_collector_phase2_", suffix=".json", delete=False, mode="w"
    )
    json.dump(data, fd)
    fd.close()
    os.chmod(fd.name, 0o600)
    return fd.name


def read_phase2_data(filepath):
    """Read phase 1 data from the temp JSON file.
    
    Note: Password is read from environment variable (ORACLE_COLLECTOR_DB_PASS)
    for security - not stored in the file.
    """
    with open(filepath, "r") as f:
        data = json.load(f, object_pairs_hook=OrderedDict)
    host_info = OrderedDict(data["host_info"])
    storage_info = data["storage_info"]
    db_user = data["db_user"]
    db_pass = os.environ.get("ORACLE_COLLECTOR_DB_PASS", "")
    sid_list = data["sid_list"]
    return host_info, storage_info, db_user, db_pass, sid_list


def main():
    """Main entry point."""
    print("===============================================================================")
    print("|| NetApp Console Workload Factory - Oracle Data Collector (Python)")
    print("===============================================================================")
    print("")

    args = parse_args()

    # ------------------------------------------------------------------
    # Phase 2 fast-path: invoked internally as oracle user
    # ------------------------------------------------------------------
    if args.internal_phase2:
        phase2_file = args.internal_phase2
        if not os.path.isfile(phase2_file):
            print("ERROR: Phase 2 data file not found: %s" % phase2_file)
            sys.exit(1)
        print("[Phase 2] Running as %s user for database collection..." % _get_current_user())
        host_info, storage_info, db_user, db_pass, sid_list = read_phase2_data(phase2_file)
        print("[Phase 2] Host info and credentials loaded from phase 1.")
    else:
        # --------------------------------------------------------------
        # Phase 1: Collect host info as current user (root gets better data)
        # --------------------------------------------------------------
        db_user, db_pass, sid_list = get_credentials(args)

        # Auto-detect SIDs if not provided
        if not sid_list:
            print("")
            print("No SIDs provided. Auto-detecting from /etc/oratab...")
            sid_list = auto_detect_sids()
            if sid_list:
                print("[OK] Found SIDs: %s" % " ".join(sid_list))
            else:
                print("WARNING: No Oracle SIDs found.")
                print("Proceeding with host information collection only.")

        # Detect storage protocol
        print("")
        print("-------------------------------------------------------------------------------")
        print("|| Detecting Storage Protocol...")
        print("-------------------------------------------------------------------------------")
        storage_info = detect_storage_protocol()
        print("Storage Protocol Summary: %s" % storage_info["protocol"])

        # Collect host information
        print("")
        print("-------------------------------------------------------------------------------")
        print("|| Collecting Host System Information...")
        print("-------------------------------------------------------------------------------")
        host_info = collect_host_info(storage_info)
        print("[OK] Host information collected successfully.")

        # --- User switching: if not oracle, hand off to oracle for DB collection ---
        oracle_os_user = _detect_oracle_os_user()
        current_user = _get_current_user()

        if current_user != oracle_os_user:
            print("")
            print("-------------------------------------------------------------------------------")
            print("|| Switching to '%s' user for database collection..." % oracle_os_user)
            print("-------------------------------------------------------------------------------")
            print("  Current user: %s" % current_user)

            phase2_file = write_phase2_data(host_info, storage_info, db_user, sid_list)

            script_path = os.path.abspath(__file__)
            python_cmd = 'python "%s" --internal-phase2 "%s"' % (script_path, phase2_file)
            
            # Pass password via environment variable (not written to disk)
            # Escape single quotes in password for shell safety
            escaped_pass = db_pass.replace("'", "'\\''") if db_pass else ""
            inner_cmd = "export ORACLE_COLLECTOR_DB_PASS='%s'; %s" % (escaped_pass, python_cmd)

            if current_user == "root":
                full_cmd = ["su", "-", oracle_os_user, "-c", inner_cmd]
            else:
                full_cmd = ["sudo", "su", "-", oracle_os_user, "-c", inner_cmd]

            try:
                exit_code = subprocess.call(full_cmd)
            finally:
                try:
                    os.unlink(phase2_file)
                except OSError:
                    pass
            sys.exit(exit_code)

    # ------------------------------------------------------------------
    # DB collection (runs as oracle user — either directly or via phase 2)
    # ------------------------------------------------------------------

    # Save original PATH/LD_LIBRARY_PATH for reset between SIDs
    saved_path = os.environ.get("PATH", "")
    saved_ld_path = os.environ.get("LD_LIBRARY_PATH", "")

    per_sid_dicts = []
    per_sid_files = []
    failure_count = 0
    script_info_from_first = None

    if sid_list:
        print("")
        print("-------------------------------------------------------------------------------")
        print("|| Starting Database Collection for SIDs: %s" % " ".join(sid_list))
        print("-------------------------------------------------------------------------------")

        for sid in sid_list:
            # Reset environment for each SID
            os.environ["PATH"] = saved_path
            os.environ["LD_LIBRARY_PATH"] = saved_ld_path

            print("")
            print(">>> Processing SID: %s <<<" % sid)

            oracle_home = get_oracle_home(sid)
            if not oracle_home:
                print("ERROR: Could not find ORACLE_HOME for SID '%s' in /etc/oratab." % sid)
                failure_count += 1
                continue

            set_oracle_env(sid, oracle_home)
            print("Environment set. ORACLE_HOME is %s" % oracle_home)

            before_time = time.time()

            exit_code, output = run_sqlplus(sid, db_user, db_pass)

            # Clean up NUL file (sqlplus artifact)
            nul_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "NUL")
            if os.path.isfile(nul_path):
                try:
                    os.remove(nul_path)
                except OSError:
                    pass

            if exit_code == 0:
                print("[OK] Successfully processed SID: %s" % sid)

                json_file = find_output_json(sid, before_time)
                if json_file:
                    sid_data = parse_per_sid_json(json_file)
                    if sid_data:
                        per_sid_dicts.append(sid_data)
                        per_sid_files.append(json_file)
                        # Capture scriptInfo from the first successful SID
                        if script_info_from_first is None and "scriptInfo" in sid_data:
                            script_info_from_first = sid_data["scriptInfo"]
                        print("[OK] Parsed JSON for SID: %s" % sid)
                    else:
                        print("WARNING: Failed to parse JSON for SID: %s" % sid)
                        failure_count += 1
                else:
                    print("WARNING: Could not find generated JSON file for SID: %s" % sid)
                    failure_count += 1
            else:
                print("WARNING: Errors detected while processing SID: %s" % sid)
                failure_count += 1

        # Build combined JSON with all SIDs in databases[] array
        combined_output_file = None
        if per_sid_dicts:
            script_info = script_info_from_first or OrderedDict([
                ("scriptVersion", "1.0.0"),
                ("outputFormat", "JSON_V1"),
                ("lookbackDays", 7),
                ("collectionTimestamp", host_info.get("collectionTimestamp", "")),
                ("collectionMethod", "AWR"),
            ])
            combined = build_combined_json(script_info, host_info, per_sid_dicts)

            script_dir = os.path.dirname(os.path.abspath(__file__))
            epoch_ts = str(int(time.time()))
            combined_output_file = os.path.join(
                script_dir, "OracleDataResponse-%s.json" % epoch_ts
            )
            with open(combined_output_file, "w") as f:
                json.dump(combined, f, indent=2)
            print("")
            print("[OK] Combined output saved to: %s" % combined_output_file)

            # Remove individual per-SID files (they are now merged)
            for pf in per_sid_files:
                try:
                    os.remove(pf)
                except OSError:
                    pass
    else:
        print("")
        print("-------------------------------------------------------------------------------")
        print("|| Skipping Database Collection")
        print("-------------------------------------------------------------------------------")
        print("Reason: No Oracle SIDs found or provided.")
        print("Host information has been collected successfully.")

    # Print summary
    print("")
    print("===============================================================================")
    print("|| All processing complete.")
    print("===============================================================================")
    print("")
    print("Summary:")
    print("  - Hostname: %s" % host_info["hostname"])
    print("  - Storage Protocol: %s" % storage_info["protocol"])

    if sid_list:
        print("  - Database SIDs Processed: %s" % " ".join(sid_list))
        print("  - SIDs successfully collected: %d / %d" % (len(per_sid_dicts), len(sid_list)))
        if db_user:
            print("  - Authentication Method: User credentials (%s)" % db_user)
        else:
            print("  - Authentication Method: OS authentication")
        if combined_output_file:
            print("")
            print("Generated Output File (combined host + all SIDs):")
            print("  - %s" % combined_output_file)
        if failure_count > 0:
            print("")
            print("  WARNING: %d SID(s) had errors during processing." % failure_count)
    else:
        print("  - Database Collection: Skipped (No SIDs found)")

    print("")
    print("===============================================================================")

    sys.exit(1 if failure_count > 0 else 0)


def _get_current_user():
    """Get the current OS username."""
    try:
        import pwd
        return pwd.getpwuid(os.getuid()).pw_name
    except (ImportError, KeyError):
        return os.environ.get("USER", os.environ.get("USERNAME", "unknown"))


def _detect_oracle_os_user():
    """Detect Oracle OS user from /etc/oratab file ownership.
    
    Returns the username that owns /etc/oratab, which is typically the
    Oracle installation owner. Falls back to "oracle" if detection fails.
    """
    oratab = "/etc/oratab"
    if os.path.isfile(oratab):
        try:
            import pwd
            stat_info = os.stat(oratab)
            return pwd.getpwuid(stat_info.st_uid).pw_name
        except (ImportError, KeyError, OSError):
            pass
    return "oracle"


if __name__ == "__main__":
    main()
