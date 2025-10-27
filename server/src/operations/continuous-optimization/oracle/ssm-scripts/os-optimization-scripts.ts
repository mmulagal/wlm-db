import { supportedOracleOsVersions } from '../../../workloads/oracle/consts';
import { logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import {
    CHECK_ISCSI_REPLACEMENT_TIMEOUT,
    CHECK_ISCSI_TARGETS_SESSIONS,
    CHECK_TCP_FEATURES,
    CHECK_TRANSPARENT_HUGEPAGE,
    GET_OS_INFO,
    CHECK_SANLUN,
    CHECK_MULTIPATH_IO_STATUS,
    CHECK_SELINUX
} from './os-iscsi-assessment-scripts';

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

const CHECK_MULTIPATHD_RUNNING_STATUS = `
def is_multipathd_running():
    try:
        result = subprocess.run(['systemctl', 'is-active', '--quiet', 'multipathd'], 
                              check=False, timeout=5)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        log(f'Exception while checking multipathd status: {str(e)}')
        return False
    except Exception as e:
        log(f'Unexpected error checking multipathd status: {str(e)}')
        return False`;

const RELOAD_MULTIPATHD_SERVICE = `
def reload_multipathd():
    try:
        result = subprocess.run(['sudo', 'systemctl', 'reload', 'multipathd'], 
                              check=False, timeout=10, 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                              universal_newlines=True)
        if result.returncode != 0:
            log(f'multipathd reload failed: {result.stderr.strip()}')
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        log('multipathd reload timed out after 10 seconds')
        return False
    except FileNotFoundError:
        log('systemctl command not found')
        return False
    except Exception as e:
        log(f'Unexpected error reloading multipathd: {str(e)}')
        return False`;

const VALIDATE_MULTIPATH_CONF = `
def validate_multipath_conf():
    try:
        # Comprehensive validation using multipath -d (checks both syntax and runtime)
        result = subprocess.run(['multipath', '-d'], 
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                               universal_newlines=True, timeout=15)
        
        if result.returncode != 0:
            # Command failed - log the error and return false
            error_output = result.stderr.strip() or result.stdout.strip()
            log(f"multipath -d validation failed: {error_output}")
            return False
        
        log("multipath -d validation passed")
        return True
        
    except subprocess.TimeoutExpired as e:
        log(f"multipath validation timed out: {str(e)}")
        return False
    except FileNotFoundError:
        log("multipath command not found")
        return False
    except Exception as e:
        log(f"Exception while validating multipath.conf: {str(e)}")
        return False
`;

const CHECK_NETAPP_BLOCK_EXISTS_IN_FILE = `
# Parse config text robustly to find NETAPP/LUN device block 
def check_netapp_block_exists_in_file(configText):
    if not configText or not configText.strip():
        log("Empty or invalid config text provided")
        return False
    
    try:
        devices_section = re.search(r'devices\\s*{.*}', configText, flags=re.DOTALL)
        if not devices_section:
            log("No devices section found in config")
            return False
        
        devices_text = devices_section.group(0)
        device_blocks = re.findall(r'device\\s*{.*?}', devices_text, flags=re.DOTALL)
        
        for block in device_blocks:
            vendor_match = re.search(r'vendor\\s+"NETAPP"', block, re.IGNORECASE)
            product_match = re.search(r'product\\s+"LUN"', block, re.IGNORECASE)
            if vendor_match and product_match:
                log("NETAPP LUN device block found")
                return True
        
        log("No NETAPP LUN device block found")
        return False
        
    except re.error as e:
        log(f"Regex error while parsing config: {str(e)}")
        return False
    except Exception as e:
        log(f"Error parsing multipath config: {str(e)}")
        return False
`;

const ENSURE_MULTIPATH_CONF = `
${CHECK_MULTIPATHD_RUNNING_STATUS}
${RELOAD_MULTIPATHD_SERVICE}
${VALIDATE_MULTIPATH_CONF}
${CHECK_NETAPP_BLOCK_EXISTS_IN_FILE}
# ensure multipath config is validated
def ensure_multipath_conf():
    log('Checking if multipathd is running')
    if not is_multipathd_running():
        log('multipathd daemon is not running. Exiting.')
        return {"status": "failed", "error": "multipathd daemon is not running"}
    # Early validation of existing config before making changes
    if Path('/etc/multipath.conf').exists():
        log("Validating existing multipath.conf before changes")
        if not validate_multipath_conf():
            return {"status": "failed", "error": "Existing multipath.conf has syntax/runtime errors. Fix it before running this script."}
    config_path = Path('/etc/multipath.conf')
    backup_path = Path('/etc/wlmdb-multipath-backup.conf')
    file_created = False
    # Single source of truth for key-values
    new_values = {
        'path_grouping_policy': '"group_by_prio"',
        'path_selector': '"service-time 0"',
        'prio': '"ontap"',
        'features': '"3 queue_if_no_path pg_init_retries 50"',
        'hardware_handler': '"0"',
        'failback': 'immediate',
        'rr_weight': '"uniform"',
        'no_path_retry': 'queue',
        'user_friendly_names': 'yes',
        'fast_io_fail_tmo': '5',
        'dev_loss_tmo': '"infinity"',
        'detect_prio': 'yes',
        'flush_on_last_del': '"yes"',
        'retain_attached_hw_handler': 'yes',
        'path_checker': '"tur"',
        'max_sectors_kb': '4096'
    }
    # Dynamically build NETAPP block
    netapp_block = "    device {\\n        vendor \\"NETAPP\\"\\n        product \\"LUN\\"\\n"
    for key, value in new_values.items():
        netapp_block += f"        {key} {value}\\n"
    netapp_block += "    }\\n"
    try:
        if config_path.exists():
            shutil.copy2(config_path, backup_path)
            config = config_path.read_text()
            if check_netapp_block_exists_in_file(config):
                log("NETAPP block found, updating keys if needed")
                def update_device_block(match):
                    block = match.group(0)
                    for key, value in new_values.items():
                        if re.search(rf'{key}\\s+.*', block):
                            block = re.sub(rf'{key}\\s+.*', f'{key} {value}', block)
                        else:
                            # Add the key only once before the closing brace
                            block = re.sub(r'(\\n\\s*}\\s*$)', f'\\n        {key} {value}\\1', block)
                    return block
                updated_config = re.sub(
                    r'(device\\s*{\\s*vendor\\s*"NETAPP"\\s*product\\s*"LUN".*?})',
                    update_device_block,
                    config,
                    flags=re.DOTALL
                )
                config_path.write_text(updated_config)
            else:
                log("NETAPP block not found, adding it")
                if "devices {" in config:
                    config = re.sub(r'(devices\\s*{)', r'\\1\\n' + netapp_block, config, 1)
                else:
                    config += "\\ndevices {\\n" + netapp_block + "}\\n"
                config_path.write_text(config)
        else:
            log('/etc/multipath.conf not found, creating new file')
            new_config_content = f"""defaults {{
    find_multipaths yes
    user_friendly_names no
    polling_interval 5
}}
blacklist {{
    devnode "^(ram|raw|loop|fd|md|dm-|sr|scd|st|hd|cciss|nvme|nvm)[0-9]*"
}}
devices {{
{netapp_block}}}
"""
            config_path.write_text(new_config_content)
            os.chown(config_path, 0, 0)
            os.chmod(config_path, 0o644)
            file_created = True
        # Validate config syntax & runtime after modifications
        if not validate_multipath_conf():
            log("Invalid multipath.conf after changes, rolling back")
            if file_created:
                config_path.unlink()
            else:
                shutil.copy2(backup_path, config_path)
            return {"status": "failed", "error": "Invalid multipath.conf after changes"}
        # Reload daemon and verify
        log('Reloading multipathd daemon')
        if reload_multipathd() and is_multipathd_running():
            log('multipathd daemon reloaded successfully')
            if backup_path.exists():
                backup_path.unlink()
        else:
            log('Failed to reload multipathd daemon')
            if file_created:
                config_path.unlink()
            else:
                shutil.copy2(backup_path, config_path)
            return {"status": "failed", "error": "Failed to reload multipathd daemon"}
        return {"status": "success", "error": None}
    except Exception as e:
        log(f'Exception: {str(e)}')
        return {"status": "failed", "error": str(e)}
`;

const ENSURE_MULTIPATH_FRIENDLY_NAMES = `
${CHECK_MULTIPATHD_RUNNING_STATUS}
${RELOAD_MULTIPATHD_SERVICE}
${VALIDATE_MULTIPATH_CONF}
${CHECK_NETAPP_BLOCK_EXISTS_IN_FILE}
# ensure multipath friendly names is set to yes
def ensure_multipath_friendly_names():
    #  Check file existence first
    config_path = Path('/etc/multipath.conf')
    if not config_path.exists():
        log('/etc/multipath.conf not found - cannot optimize friendly names without existing NETAPP LUN block')
        return {"status": "failed", "error": "multipath.conf not found - NETAPP LUN device block is required for optimization"}
    # Check multipathd status 
    log('Checking if multipathd is running')
    if not is_multipathd_running():
        log('multipathd daemon is not running. Exiting.')
        return {"status": "failed", "error": "multipathd daemon is not running"}
    # Early validation of existing config before making changes
    log("Validating existing multipath.conf before changes")
    if not validate_multipath_conf():
        return {"status": "failed", "error": "Existing multipath.conf has syntax/runtime errors. Fix it before running this script."}
    #  Check NETAPP block exists before proceeding
    config = config_path.read_text()
    if not check_netapp_block_exists_in_file(config):
        log('NETAPP LUN device block not found in multipath.conf')
        return {"status": "failed", "error": "NETAPP LUN device block not found in multipath.conf"}
    backup_path = Path('/etc/wlmdb-multipath-friendly-names-backup.conf')
    file_created = False
    try:
        defaults_pattern = re.compile(r'defaults\\s*{([\\s\\S]*?)}', re.DOTALL)
        friendly_names_pattern = re.compile(r'user_friendly_names\\s+(\\w+)')
        netapp_device_pattern = re.compile(
            r'device\\s*{\\s*vendor\\s*"NETAPP"\\s*product\\s*"LUN"[^}]*user_friendly_names\\s+(\\w+)[^}]*}',
            re.DOTALL | re.IGNORECASE
        )
        
        # Check defaults section once
        defaults_match = defaults_pattern.search(config)
        defaults_has_friendly_names_yes = False
        
        if defaults_match:
            defaults_content = defaults_match.group(1)
            friendly_names_match = friendly_names_pattern.search(defaults_content)
            if friendly_names_match:
                current_value = friendly_names_match.group(1).strip().lower()
                defaults_has_friendly_names_yes = (current_value == 'yes')
        
        # Check NETAPP device section once
        netapp_device_match = netapp_device_pattern.search(config)
        netapp_device_has_friendly_names_yes = False
        if netapp_device_match:
            device_friendly_names_value = netapp_device_match.group(1).strip().lower()
            netapp_device_has_friendly_names_yes = (device_friendly_names_value == 'yes')
        
        #  Skip if already optimized
        if defaults_has_friendly_names_yes and netapp_device_has_friendly_names_yes:
            log('user_friendly_names is already set to yes in both defaults and NETAPP device block, skipping optimization')
            return {"status": "skipped", "message": "user_friendly_names is already set to yes in both defaults and NETAPP device block"}
        # Create backup before any modifications
        shutil.copy2(config_path, backup_path)
        log("Created backup of existing multipath.conf")
        
        # Update user_friendly_names to yes in defaults section
        log("Setting user_friendly_names to yes in defaults section")
        
        updated_config = config
        if defaults_match:
            defaults_content = defaults_match.group(1)
            # Check if user_friendly_names exists in defaults
            if friendly_names_pattern.search(defaults_content):
                # Replace existing value
                updated_defaults = re.sub(r'user_friendly_names\\s+\\w+', 'user_friendly_names yes', defaults_content)
            else:
                # Add user_friendly_names to existing defaults
                updated_defaults = defaults_content.rstrip() + '\\n    user_friendly_names yes\\n'
            
            # Replace the defaults block
            updated_config = re.sub(
                r'(defaults\\s*{)[^}]*(})',
                f'\\\\1{updated_defaults}\\\\2',
                config,
                flags=re.DOTALL
            )
        else:
            # No defaults section exists, add one
            defaults_block = """defaults {
    user_friendly_names yes
}
"""
            updated_config = defaults_block + config
        
        # Write intermediate config and validate
        config_path.write_text(updated_config)
        
        # Also update user_friendly_names in NETAPP device block
        log("Updating user_friendly_names in NETAPP device block")
        
        def update_netapp_device_block(match):
            block = match.group(0)
            # Check if user_friendly_names exists in the device block
            if re.search(r'user_friendly_names\\s+', block):
                # Replace existing value
                block = re.sub(r'user_friendly_names\\s+\\w+', 'user_friendly_names yes', block)
            else:
                # Add user_friendly_names to the device block (before closing brace)
                block = re.sub(r'(\\n\\s*}\\s*$)', r'\\n        user_friendly_names yes\\1', block)
            return block
        
        # Update the NETAPP device block with user_friendly_names yes
        final_config = re.sub(
            r'(device\\s*{\\s*vendor\\s*"NETAPP"\\s*product\\s*"LUN".*?})',
            update_netapp_device_block,
            updated_config,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        config_path.write_text(final_config)
        # Validate config and handle reload with clear rollback logic
        if not validate_multipath_conf():
            log("Invalid multipath.conf after changes, rolling back")
            shutil.copy2(backup_path, config_path)
            return {"status": "failed", "error": "Invalid multipath.conf after changes"}
        # Reload daemon and verify with better error handling
        log('Reloading multipathd daemon')
        reload_success = reload_multipathd()
        daemon_running = is_multipathd_running()
        
        if reload_success and daemon_running:
            log('multipathd daemon reloaded successfully')
            # Clean up backup only after successful completion
            if backup_path.exists():
                backup_path.unlink()
                log('Removed backup file after successful optimization')
            return {"status": "success", "error": None}
        else:
            log('Failed to reload multipathd daemon or daemon not running after reload')
            # Rollback configuration
            shutil.copy2(backup_path, config_path)
            error_msg = "Failed to reload multipathd daemon" if not reload_success else "multipathd daemon not running after reload"
            return {"status": "failed", "error": error_msg}
    except Exception as e:
        log(f'Exception during friendly names optimization: {str(e)}')
        # Better error flow: Ensure rollback happens on any exception
        try:
            if backup_path.exists() and config_path.exists():
                shutil.copy2(backup_path, config_path)
                log('Configuration rolled back due to exception')
        except Exception as rollback_error:
            log(f'Failed to rollback configuration: {str(rollback_error)}')
        return {"status": "failed", "error": f"Exception during optimization: {str(e)}"}
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

const optimizeMultiPathConfigFriendlyNamesTemplate = `
${ENSURE_MULTIPATH_FRIENDLY_NAMES}
result = ensure_multipath_friendly_names()
log(result)
print(json.dumps(result))
`;

const optimizeMultiPathConfigTemplate = `
${ENSURE_MULTIPATH_CONF}
result = ensure_multipath_conf()
log(result)
print(json.dumps(result))
`;

const optimizeTcpOptionsCommand = `
#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(optimizeTcpOptionsTemplate, 'wlmdb-os-configuration-tcp-optimization.log')}
`;

const DOWNLOAD_AND_EXTRACT_TARGZ = `
def download_and_extract_targz(url, download_path, extract_dir):
    try:
        # Download tar.gz using urllib
        log(f'Downloading tar.gz file from URL to {download_path}')
        try:
            urlretrieve(url, download_path)
            log(f'Successfully downloaded file to {download_path}')
        except HTTPError as e:
            error_msg = f'HTTP {e.code}: {e.reason}'
            if e.code in [403, 404]:
                error_msg = f'URL expired or invalid: {error_msg}'
            log(f'Download failed: {error_msg}')
            return {"success": False, "error": error_msg, "extract_dir": None}
        except Exception as e:
            error_msg = f'Download failed: {str(e)}'
            log(error_msg)
            return {"success": False, "error": error_msg, "extract_dir": None}
        
        # Create extraction directory
        log(f'Creating extraction directory {extract_dir}')
        os.makedirs(extract_dir, exist_ok=True)
        
        # Extract tar.gz using tarfile module
        log(f'Extracting tar.gz file to {extract_dir}')
        try:
            with tarfile.open(download_path, 'r:gz') as tar:
                tar.extractall(path=extract_dir)
            log(f'Successfully extracted tar.gz to {extract_dir}')
            return {"success": True, "error": None, "extract_dir": extract_dir}
        except Exception as e:
            error_msg = f'Extraction failed: {str(e)}'
            log(error_msg)
            return {"success": False, "error": error_msg, "extract_dir": None}
            
    except Exception as e:
        error_msg = f'Unexpected error during download/extract: {str(e)}'
        log(error_msg)
        return {"success": False, "error": error_msg, "extract_dir": None}
`;

const INSTALL_HOST_UTILITIES = `
def install_linux_host_utilities(presigned_url):
    """
    Install NetApp Linux Host Utilities from S3 presigned URL.
    Returns InstallHostUtilitiesResponse format:
    {
        "os-version": string,
        "status": "optimised" | "failed" | "optimised-offline",
        "error": optional string
    }
    """
    
    existing_status = check_sanlun()
    distro = existing_status.get("os-version")
    
    # Check if OS is supported
    if distro not in ${JSON.stringify(supportedOracleOsVersions)}:
        log(f'Linux host utilities not supported on {distro}')
        return {
            "os-version": distro or "unknown",
            "status": "failed",
            "error": f"Host utilities not supported on {distro}"
        }
    
    # Check if already installed
    if existing_status.get("sanlun-installed"):
        log('NetApp host utilities already installed')
        return {
            "os-version": distro,
            "status": "optimised-offline"
        }
    
    # Select the correct presigned URL based on OS
    if not presigned_url:
        return {
            "os-version": distro,
            "status": "failed",
            "error": f"No presigned URL available for {distro}"
        }
    
    # Download and install
    tar_file = '/tmp/netapp-host-utilities.tar.gz'
    extract_dir = '/tmp/netapp-host-utilities-extract'
    rpm_file = None
    
    try:
        # Download and extract using reusable function
        log(f'Downloading NetApp host utilities for {distro} from S3')
        result = download_and_extract_targz(presigned_url, tar_file, extract_dir)
        
        if not result["success"]:
            return {
                "os-version": distro,
                "status": "failed",
                "error": result["error"]
            }
        
        # Find the RPM file in the extraction directory
        # Filter out macOS metadata files (._*) and hidden files
        rpm_files = [f for f in os.listdir(extract_dir) if f.endswith('.rpm') and not f.startswith('._') and not f.startswith('.')]
        if not rpm_files:
            error_msg = 'No RPM file found in extracted archive'
            log(error_msg)
            return {
                "os-version": distro,
                "status": "failed",
                "error": error_msg
            }
        
        rpm_file = os.path.join(extract_dir, rpm_files[0])
        log(f'Found RPM file: {rpm_file}')

        # Install RPM
        log('Installing NetApp host utilities RPM')
        result = subprocess.run(
            ['sudo', 'rpm', '-ivh', rpm_file],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            universal_newlines=True, timeout=120
        )
        
        if result.returncode != 0:
            return {
                "os-version": distro,
                "status": "failed",
                "error": f'Installation failed: {result.stderr.strip()}'
            }
        
        log('Successfully installed NetApp host utilities')
        
        # Verify installation
        verification = check_sanlun()
        if verification.get("sanlun-installed"):
            return {
                "os-version": distro,
                "status": "optimised"
            }
        else:
            return {
                "os-version": distro,
                "status": "failed",
                "error": "Installation completed but verification failed"
            }
        
    except Exception as e:
        return {
            "os-version": distro,
            "status": "failed",
            "error": str(e)
        }
    finally:
        # Cleanup - always executed
        try:
            if tar_file and os.path.exists(tar_file):
                os.remove(tar_file)
                log(f'Removed tar.gz file: {tar_file}')
        except:
            pass
        
        try:
            if extract_dir and os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
                log(f'Removed extraction directory: {extract_dir}')
        except:
            pass
`;

const installHostUtilitiesTemplate = (presignedUrl: string) => `
${GET_OS_INFO}
${CHECK_SANLUN}
${DOWNLOAD_AND_EXTRACT_TARGZ}
${INSTALL_HOST_UTILITIES}

result = install_linux_host_utilities("${presignedUrl}")
print(json.dumps(result))
`;

const installHostUtilitiesCommand = (preSignedUrl: string) => `
#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(installHostUtilitiesTemplate(preSignedUrl), 'wlmdb-os-configuration-host-utilities.log')}
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

const FIX_TRANSPARENT_HUGEPAGE = `
# Common utility functions for error checking and file operations
def check_for_error_and_return_failure(result_dict, context_message):
    """Check if result dictionary has an error and return failure response if found"""
    if result_dict.get("error"):
        error_msg = '{}: {}'.format(context_message, result_dict["error"])
        log(error_msg)
        return {"status": "failure", "error": error_msg}
    return None

def backup_file(file_path):
    """Create a timestamped backup of the given file"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = '{}.backup.{}'.format(file_path, timestamp)
    result = subprocess.run(['sudo', 'cp', file_path, backup_path], 
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
    if result.returncode == 0:
        log('Successfully created backup: {}'.format(backup_path))
        return True
    else:
        log('Failed to create backup: {}'.format(result.stderr))
        return False

def write_temp_file_and_move(temp_name, target_path, content):
    """Write content to a temporary file and move it to target location"""
    temp_path = '/tmp/{}'.format(temp_name)
    try:
        with open(temp_path, 'w') as f:
            f.write(content)
        
        result = subprocess.run(['sudo', 'mv', temp_path, target_path], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
        if result.returncode == 0:
            log('Successfully updated file: {}'.format(target_path))
            return True
        else:
            log('Failed to move temp file: {}'.format(result.stderr))
            return False
    except Exception as e:
        log('Error writing temporary file: {}'.format(str(e)))
        return False

def setup_grub_thp_persistence(thp_param):
    """Setup THP persistence using GRUB kernel parameters"""
    grub_file = '/etc/default/grub'
    
    if not os.path.exists(grub_file):
        log('GRUB configuration file not found, skipping GRUB method')
        return False
    
    if not backup_file(grub_file):
        return False
    
    try:
        with open(grub_file, 'r') as f:
            content = f.read()
        
        if thp_param in content:
            log('THP parameter already exists in GRUB configuration')
            return True
        
        # Update GRUB config
        lines = content.split('\\n')
        updated = False
        
        for i, line in enumerate(lines):
            if line.startswith(('GRUB_CMDLINE_LINUX=', 'GRUB_CMDLINE_LINUX_DEFAULT=')):
                if line.endswith('"') and '="' in line:
                    lines[i] = line[:-1] + ' {}"'.format(thp_param)
                    updated = True
                    break
        
        if not updated:
            lines.append('GRUB_CMDLINE_LINUX="{}"'.format(thp_param))
        
        # Write updated config
        updated_content = '\\n'.join(lines)
        if not write_temp_file_and_move('grub_updated', grub_file, updated_content):
            return False
        
        # Update GRUB for RHEL and SUSE systems
        grub_update_commands = [
            'sudo grub2-mkconfig -o /boot/grub2/grub.cfg',  # RHEL/SUSE BIOS
            'sudo grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg',  # RHEL UEFI
            'sudo grub2-mkconfig -o /boot/efi/EFI/sles/grub.cfg'     # SUSE UEFI
        ]
        
        grub_success = False
        for cmd in grub_update_commands:
            log('Trying GRUB update command: {}'.format(cmd))
            result = subprocess.run(['bash', '-c', cmd], 
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=60)
            if result.returncode == 0:
                log('Successfully updated GRUB configuration with command: {}'.format(cmd))
                grub_success = True
                break
            else:
                log('GRUB command failed ({}): {}'.format(cmd, result.stderr.strip()))
        
        if grub_success:
            log('Successfully configured GRUB for THP persistence')
            return True
        else:
            log('All GRUB update commands failed - THP persistence via GRUB may not work')
            return False
            
    except Exception as e:
        log('GRUB persistence setup failed: {}'.format(str(e)))
        return False

def setup_rc_local_thp_persistence():
    """Setup THP persistence using rc.local boot script"""
    rc_local_path = '/etc/rc.local'
    thp_commands = '''# Disable Transparent Huge Pages for Oracle
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
'''
    
    try:
        if os.path.exists(rc_local_path):
            with open(rc_local_path, 'r') as f:
                content = f.read()
            
            if 'transparent_hugepage' in content:
                log('THP commands already exist in rc.local')
                return True
            
            # Insert before exit 0 or at the end
            if 'exit 0' in content:
                updated_content = content.replace('exit 0', '{}\\nexit 0'.format(thp_commands))
            else:
                updated_content = content + '\\n{}'.format(thp_commands)
            
            if not write_temp_file_and_move('rc_local_updated', rc_local_path, updated_content):
                return False
        else:
            # Create new rc.local
            rc_content = '''#!/bin/bash
{}
exit 0
'''.format(thp_commands)
            if not write_temp_file_and_move('rc_local_new', rc_local_path, rc_content):
                return False
        
        # Make executable
        result = subprocess.run(['sudo', 'chmod', '+x', rc_local_path], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
        if result.returncode == 0:
            log('Successfully configured rc.local for THP persistence')
            return True
        else:
            log('Failed to make rc.local executable: {}'.format(result.stderr))
            return False
            
    except Exception as e:
        log('rc.local setup failed: {}'.format(str(e)))
        return False

def disable_thp_immediately():
    """Disable THP settings immediately in the current session"""
    # Disable THP enabled
    result = subprocess.run(['sudo', 'sh', '-c', 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'], 
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
    if result.returncode != 0:
        return False, 'Failed to disable THP enabled: {}'.format(result.stderr)
    
    # Disable THP defrag
    result = subprocess.run(['sudo', 'sh', '-c', 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'], 
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
    if result.returncode != 0:
        return False, 'Failed to set THP defrag to never: {}'.format(result.stderr)
    
    log('Successfully disabled THP and set defrag to never')
    return True, None

# Fix Transparent Huge Pages settings for Oracle workloads
def fix_transparent_hugepage():
    try:
        log('Starting Transparent Huge Pages (THP) optimization for Oracle workloads')
        
        # Step 1: Check current THP settings
        log('Checking current Transparent Huge Pages configuration')
        current = check_thp()
        
        error_response = check_for_error_and_return_failure(current, 'THP configuration check failed')
        if error_response:
            return error_response
        
        # Step 2: Check if already optimized
        thp_disabled = current.get("thp-disabled", False)
        thp_value = current.get("thp-value", "unknown")
        
        if thp_disabled:
            log('Transparent Huge Pages are already optimized (disabled)')
            return {"status": "already-optimized", "message": "THP is already disabled"}
        
        log('Current THP state - disabled: {}, value: {}'.format(thp_disabled, thp_value))
        
        # Step 3: Disable THP immediately
        log('Disabling Transparent Huge Pages')
        success, error_msg = disable_thp_immediately()
        if not success:
            log(error_msg)
            return {"status": "failure", "error": error_msg}
        
        # Step 4: Setup persistence
        log('Setting up THP persistence')
        thp_param = 'transparent_hugepage=never'
        persistence_success = False
        
        # Method 1: Try GRUB persistence
        log('Attempting GRUB persistence setup')
        if setup_grub_thp_persistence(thp_param):
            persistence_success = True
        
        # Method 2: rc.local as fallback
        if not persistence_success:
            log('Setting up rc.local for THP persistence')
            if setup_rc_local_thp_persistence():
                persistence_success = True
        
        if not persistence_success:
            log('Warning: Could not set up persistence mechanism, THP settings may not survive reboot')
        
        # Step 5: Verify the changes
        log('Verifying THP configuration changes')
        new_check = check_thp()
        
        error_response = check_for_error_and_return_failure(new_check, 'THP verification failed')
        if error_response:
            return error_response
        
        new_disabled = new_check.get("thp-disabled", False)
        new_value = new_check.get("thp-value", "unknown")
        
        if new_disabled and new_value == "disabled":
            if persistence_success:
                log('THP optimization successful - THP is disabled and persistence configured')
                return {"status": "success", "message": "THP successfully disabled with persistence"}
            else:
                log('THP optimization successful but persistence setup failed')
                return {"status": "success", "message": "THP successfully disabled (persistence setup failed - manual reboot configuration may be needed)"}
        else:
            error_msg = 'THP verification failed - disabled: {}, value: {}'.format(new_disabled, new_value)
            log(error_msg)
            return {"status": "failure", "error": error_msg}
    
    except subprocess.TimeoutExpired as e:
        error_msg = 'THP optimization timeout: {}'.format(str(e))
        log(error_msg)
        return {"status": "failure", "error": error_msg}
    except Exception as e:
        error_msg = 'Unexpected error during THP optimization: {}'.format(str(e))
        log(error_msg)
        return {"status": "failure", "error": error_msg}
`;

const fixTransparentHugepageTemplate = `
${CHECK_TRANSPARENT_HUGEPAGE}
${FIX_TRANSPARENT_HUGEPAGE}

result = fix_transparent_hugepage()
print(json.dumps(result))
`;

const fixTransparentHugepageCommand = `#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(fixTransparentHugepageTemplate, 'wlmdb-os-configuration-thp-optimization.log')}
`;

const ENABLE_MULTIPATH_IO = `
def enable_multipath_io():
    log('Starting multipath I/O enablement')
    
    try:
        # Check current status
        current = check_multipath_io()        
        if current.get("multipath-io-is-active") and current.get("multipath-io-is-enabled"):
            log('Multipath I/O already enabled')
            return {"status": "optimized-offline"}

        # Enable and start service
        os_info = get_os_info()
        os_version = os_info.get("os-version", "").lower()            
        if 'rhel' in os_version:
            result = subprocess.run(['sudo', 'mpathconf', '--enable', '--with_multipathd', 'y'],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=30)
            if result.returncode != 0:
                return {"status": "failed", "error": result.stderr.strip()}
        
        result = subprocess.run(['sudo', 'systemctl', 'enable', '--now', 'multipathd'],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=30)
        if result.returncode != 0:
            return {"status": "failed", "error": result.stderr.strip()}
        
        # Verify
        final = check_multipath_io()
        if final.get("error") or not (final.get("multipath-io-is-active") and final.get("multipath-io-is-enabled")):
            return {"status": "failed", "error": final.get("error", "Verification failed")}
        
        log('Multipath I/O successfully enabled')
        return {"status": "optimized"}
        
    except Exception as e:
        return {"status": "failed", "error": str(e)}
`;

const enableMultipathIoEnableTemplate = `
${CHECK_MULTIPATH_IO_STATUS}
${GET_OS_INFO}
${ENABLE_MULTIPATH_IO}

result = enable_multipath_io()
print(json.dumps(result))
`;

const enableMultipathIoCommand = `
#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(enableMultipathIoEnableTemplate, 'wlmdb-multipath-IO-enable.log')}
`;

const DISABLE_SELINUX = `
def disable_selinux():
    log('Disabling SELinux')
    
    try:
        current = check_selinux()
        if current.get("selinux-disabled") or current.get("selinux-value") == "permissive":
            return {"status": "optimized-offline"}
        
        # Set to permissive immediately
        if current.get("selinux-value") == "enforcing":
            result = subprocess.run(['sudo', 'setenforce', '0'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
            if result.returncode != 0:
                return {"status": "failed", "error": result.stderr.strip()}
        
        # Update config for persistence using sed
        config_file = '/etc/selinux/config'
        if os.path.exists(config_file):
            result = subprocess.run(
                ['sudo', 'sed', '-i', 's/^SELINUX=enforcing/SELINUX=disabled/', config_file],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10
            )
            if result.returncode != 0:
                return {"status": "failed", "error": result.stderr.strip()}
        
        # Verify
        final = check_selinux()
        if final.get("selinux-value") in ["disabled", "permissive"]:
            return {"status": "optimized"}
        
        return {"status": "failed", "error": "Verification failed"}
        
    except Exception as e:
        return {"status": "failed", "error": str(e)}
`;

const disableSelinuxTemplate = `
${CHECK_SELINUX}
${DISABLE_SELINUX}

result = disable_selinux()
print(json.dumps(result))
`;

const disableSelinuxCommand = `#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(disableSelinuxTemplate, 'wlmdb-os-configuration-disable-selinux.log')}
`;

const optimizeMultipathIoConfigCommand = `#!/bin/bash
${logFileCheck(false)}
${pythonScriptInit(optimizeMultiPathConfigTemplate, 'wlmdb-multipath-IO-config-optimization.log')}
`;

const optimizeMultiPathConfigFriendlyNamesCommand = `#!/bin/bash
${logFileCheck(false)}
${pythonScriptInit(optimizeMultiPathConfigFriendlyNamesTemplate, 'wlmdb-multipath-friendly-names-optimization.log')}
`;

export {
    optimizeTcpOptionsCommand,
    optimizeIscsiReplacementTimeoutCommand,
    optimizeMultipathIoSessionsCommand,
    optimizeMultipathIoConfigCommand,
    optimizeMultiPathConfigFriendlyNamesCommand,
    installHostUtilitiesCommand,
    fixTransparentHugepageCommand,
    enableMultipathIoCommand,
    disableSelinuxCommand,
    DOWNLOAD_AND_EXTRACT_TARGZ
};
