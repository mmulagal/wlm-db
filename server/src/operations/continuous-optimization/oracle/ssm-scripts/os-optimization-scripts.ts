import { logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import {
    CHECK_TCP_FEATURES,
    CHECK_ISCSI_REPLACEMENT_TIMEOUT,
    CHECK_ISCSI_TARGETS_SESSIONS
} from '../../../workloads/oracle/os-iscsi-assessment-scripts';

const OPTIMIZE_TCP_OPTIONS = `
# Optimize TCP options for Oracle workloads
def optimize_tcp_options():
    log('Optimizing TCP advanced features')
    
    errorMessage = ''

    tcp_settings = [
        ("net.ipv4.tcp_timestamps", "1", "tcp-timestamps"),
        ("net.ipv4.tcp_sack", "1", "tcp-sack"),
        ("net.ipv4.tcp_window_scaling", "1", "tcp-window-scaling")
    ]
    
    # Step 1: Create directory if it doesn't exist
    log('Creating /etc/sysctl.d directory if it does not exist')
    result = subprocess.run(
        ['sudo', 'mkdir', '-p', '/etc/sysctl.d'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to create /etc/sysctl.d directory: {result.stderr.strip()}'
        log(error_msg)
        errorMessage = error_msg
        return {error: errorMessage}
    
    log('Successfully ensured /etc/sysctl.d directory exists')
    
    # Step 2: Create the config file with content
    log('Writing TCP options to /etc/sysctl.d/99-wlmdb-tcp-options.conf')
    config_lines = []
    for param, value, _ in tcp_settings:
        config_lines.append(f'{param} = {value}')
    config_text = '\\n'.join(config_lines) + '\\n'
    
    result = subprocess.run(
        ['sudo', 'tee', '/etc/sysctl.d/99-wlmdb-tcp-options.conf'],
        input=config_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to write config file: {result.stderr.strip()}'
        log(error_msg)
        return {"error":errorMessage}

    log('Successfully wrote TCP options to /etc/sysctl.d/99-wlmdb-tcp-options.conf')
    
    # Step 3: Apply settings using sudo sysctl --system
    log('Applying sysctl configuration with sudo sysctl --system')
    result = subprocess.run(
        ['sudo', 'sysctl', '--system'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to apply sysctl configuration: {result.stderr.strip()}'
        log(error_msg)
        return {"error":errorMessage}

    log('Successfully applied sysctl configuration')
    
    # Step 4: Verify each value with sudo sysctl -n param
    log('Verifying TCP options are correctly applied')

    statusAfterOptimization = check_tcp_features()

    return statusAfterOptimization
`;

const OPTIMIZE_ISCSI_REPLACEMENT_TIMEOUT = `
# Optimize ISCSI Replacement timeout
def set_iscsi_replacement_timeout():
    try:
        # Step 1: Check current timeout
        current = check_iscsi_replacement_timeout()

        # If error → fail immediately
        if current["error"] is not None:
            log(f'iSCSI replacement timeout check failed: {current["error"]}')
            print(json.dumps({"status": "failure", "error": current["error"]}))
            return

        # If already 5 → skip
        if current["replacement-timeout"] == 5:
            log('iSCSI replacement timeout is already set to 5, skipping optimization')
            print(json.dumps({"status": "skipped", "message": "iSCSI replacement timeout is already set to 5"}))
            return

        # Step 2: Backup original config
        log('Creating backup of iSCSI configuration file')
        shutil.copy(CONFIG_PATH, BACKUP_PATH)

        # Step 3: Modify timeout to 5
        log('Updating iSCSI replacement timeout to 5 seconds')
        config_lines = CONFIG_PATH.read_text().split('\\n')
        updated = False
        for i, line in enumerate(config_lines):
            if 'node.session.timeo.replacement_timeout' in line and not line.strip().startswith('#'):
                config_lines[i] = 'node.session.timeo.replacement_timeout = 5'
                updated = True
                break
        if not updated:
            config_lines.append('node.session.timeo.replacement_timeout = 5')

        CONFIG_PATH.write_text("\\n".join(config_lines))

        # Step 4: Validate change
        new_check = check_iscsi_replacement_timeout()
        if new_check["error"] is None and new_check["replacement-timeout"] == 5:
            BACKUP_PATH.unlink(missing_ok=True)
            log('iSCSI replacement timeout successfully set to 5')
            print(json.dumps({"status": "success"}))
        else:
            shutil.copy(BACKUP_PATH, CONFIG_PATH)
            log(f'iSCSI replacement timeout validation failed: {new_check["error"]}')
            print(json.dumps({"status": "failure", "error": new_check["error"]}))
    except Exception as e:
        log(f'Unexpected error during iSCSI replacement timeout optimization: {str(e)}')
        print(json.dumps({"status": "failure", "error": str(e)}))
        `;

const INCREASE_MULTIPATH_IO_SESSIONS_TO_4 = `
# Optimize iSCSI targets and sessions to 4
def increase_iscsi_sessions_to_4():
    log('Starting multipath IO sessions optimization to increase sessions to 4')
    result = check_iscsi_targets_sessions()
    targets = result.get("iscsi-targets", [])
    log(f'Found {len(targets)} iSCSI targets to process')
    summary = []

    # Step 1: Attempt updates
    for t in targets:
        try:
            portal_parts = t["portal"].split()
            portal_full = portal_parts[0]
            target_iqn = portal_parts[1]

            if t["active_sessions"] == 4:
                log(f'Target {target_iqn} already has 4 sessions, skipping')
                summary.append({
                    "target": target_iqn,
                    "portal": portal_full,
                    "status": "skipped",
                    "error": None
                })
                continue

            log(f'Updating iSCSI sessions for target {target_iqn} on portal {portal_full} to 4 sessions')
            update_cmd = [
                "sudo", "iscsiadm", "-m", "node",
                "-T", target_iqn, "-p", portal_full,
                "--op", "update",
                "-n", "node.session.nr_sessions",
                "-v", "4"
            ]
            subprocess.run(update_cmd, check=True, timeout=10)
            log(f'Successfully updated session configuration for target {target_iqn}')

            log(f'Logging in to target {target_iqn} to establish sessions')
            # Increased timeout to 25 seconds to account for potential delays when establishing multiple sessions
            login_cmd = [
                "sudo", "iscsiadm", "-m", "node",
                "-T", target_iqn, "-p", portal_full,
                "--login"
            ]
            subprocess.run(login_cmd, check=True, timeout=25)
            log(f'Successfully logged in to target {target_iqn}')

            summary.append({
                "target": target_iqn,
                "portal": portal_full,
                "status": "updated",
                "error": None
            })

        except IndexError as e:
            log(f'Failed to parse portal information for target: {str(e)}')
            portal_parts = t.get("portal", "").split()
            target_name = portal_parts[1] if len(portal_parts) > 1 else "unknown"
            summary.append({
                "target": target_name,
                "portal": None,
                "status": "failed",
                "error": f"Invalid portal format - expected 'IP:PORT IQN' but parsing failed: {str(e)}"
            })
        except subprocess.CalledProcessError as e:
            log(f'Failed to update iSCSI sessions for target {target_iqn}: {str(e)}')
            summary.append({
                "target": target_iqn,
                "portal": portal_full,
                "status": "failed",
                "error": str(e)
            })
        except Exception as e:
            log(f'Unexpected error updating target {target_iqn}: {str(e)}')
            summary.append({
                "target": target_iqn,
                "portal": portal_full,
                "status": "failed",
                "error": str(e)
            })

    # Step 2: Post-update verification — update summary to final state
    log('Performing post-update verification of iSCSI sessions')
    new_result = check_iscsi_targets_sessions()

    for entry in summary:
        final_target = None
        for t in new_result["iscsi-targets"]:
            portal_parts = t["portal"].split()
            if len(portal_parts) > 1 and portal_parts[1] == entry["target"]:
                final_target = t
                break
        if final_target:
            if final_target["active_sessions"] != 4:
                log(f'Post-verification failed for target {entry["target"]}: {final_target["active_sessions"]} sessions found, expected 4')
                entry["status"] = "failed"
                entry["error"] = f"Post-check failed: {final_target['active_sessions']} sessions found, expected 4"
            else:
                log(f'Post-verification successful for target {entry["target"]}: 4 sessions confirmed')

    # Step 3: Determine overall status
    statuses = [e["status"] for e in summary]
    if not summary:
        overall_status = "failed"
    elif all(s == "skipped" for s in statuses):
        overall_status = "skipped"
    elif all(s in ["updated", "skipped"] for s in statuses) and any(s == "updated" for s in statuses):
        overall_status = "success"
    elif any(s == "updated" for s in statuses):
        overall_status = "partial"
    else:
        overall_status = "failed"

    log(f'Multipath IO sessions optimization completed with status: {overall_status}')
    return {
        "overall_status": overall_status,
        "summary": summary
    }`;

const optimizeIscsiReplacementTimeoutTemplate = `
${CHECK_ISCSI_REPLACEMENT_TIMEOUT}
${OPTIMIZE_ISCSI_REPLACEMENT_TIMEOUT}

CONFIG_PATH = Path("/etc/iscsi/iscsid.conf")
BACKUP_PATH = Path("/etc/iscsi/wlmdb-backup-iscsid.conf")

set_iscsi_replacement_timeout()
`;

const optimizeOracleMultipathIoSessionsTemplate = `
${CHECK_ISCSI_TARGETS_SESSIONS}
${INCREASE_MULTIPATH_IO_SESSIONS_TO_4}

result = increase_iscsi_sessions_to_4()
log(result)
print(json.dumps(result))
`;

const optimizeTcpOptionsTemplate = `
${OPTIMIZE_TCP_OPTIONS}
${CHECK_TCP_FEATURES}

tcp_params = ["tcp-timestamps", "tcp-sack", "tcp-window-scaling"]

existing = check_tcp_features()
existing_tcp_features = existing.get("tcp-features", {})
all_optimized = all(existing_tcp_features.get(f"{param}-value") == "1" for param in tcp_params)

if all_optimized:
    log('All TCP options are already set to 1, no update needed')
    print(json.dumps({
        "tcp-features": {
            "tcp-timestamps": {"enabled": True, "error": None},
            "tcp-sack": {"enabled": True, "error": None},
            "tcp-window-scaling": {"enabled": True, "error": None}
        },
        "already-optimized": True
    }))
else:
    print(json.dumps(optimize_tcp_options()))    
`;

const optimizeTcpOptionsCommand = `
#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(optimizeTcpOptionsTemplate, 'wlmdb-os-configuration-tcp-optimization.log')}
`;

const optimizeIscsiReplacementTimeoutCommand = `
#!/bin/bash
${logFileCheck(false)}

${pythonScriptInit(optimizeIscsiReplacementTimeoutTemplate, 'wlmdb-iscsi-replacement-timeout-optimization.log')}
`;

const optimizeMultipathIoSessionsCommand = `#!/bin/bash
${logFileCheck(false)}

${pythonScriptInit(optimizeOracleMultipathIoSessionsTemplate, 'wlmdb-multipath-IO-sessions-optimization.log')}
`;

export { optimizeTcpOptionsCommand, optimizeIscsiReplacementTimeoutCommand, optimizeMultipathIoSessionsCommand };
