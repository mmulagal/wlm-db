/**
 * Common Python utilities for Oracle SSM scripts.
 *
 * This module exports reusable Python code blocks for:
 * - Logging setup
 * - EC2 metadata helpers
 * - OS information collection
 * - Credential prompting
 *
 * Compatible with Python 2.7+
 */

import { LINUX_LOG_DIRECTORY } from '../../consts';

/**
 * Common Python imports used across scripts.
 * Python 2.7+ compatible with fallbacks for Python 3.
 */
const pythonCommonImports = `
from __future__ import print_function, unicode_literals

import os
import re
import sys
import json
import base64
import socket
import subprocess
import logging
import datetime
import platform
import getpass
import math
import threading
from collections import namedtuple

# argparse is available in Python 2.7+
try:
    import argparse
except ImportError:
    argparse = None

# Python 2/3 compatible imports
try:
    # Python 3
    from urllib.parse import quote as url_encode
    import urllib.request as urllib_request
    import urllib.error as urllib_error
    import ssl
    PYTHON3 = True
except ImportError:
    # Python 2.7
    from urllib import quote as url_encode
    import urllib2 as urllib_request
    import urllib2 as urllib_error
    try:
        import ssl
    except ImportError:
        ssl = None
    PYTHON3 = False

# String/bytes compatibility
if PYTHON3:
    string_types = str
    text_type = str
    binary_type = bytes
else:
    string_types = basestring
    text_type = unicode
    binary_type = str

# Subprocess compatibility for Python 2.7
if not PYTHON3:
    # Create DEVNULL constant for Python 2.7
    try:
        subprocess.DEVNULL
    except AttributeError:
        subprocess.DEVNULL = open(os.devnull, 'w')
`;

/**
 * Python logging setup utilities.
 * Uses the standard LINUX_LOG_DIRECTORY for log files.
 * DEBUG logs go to file only, INFO/ERROR go to console and file.
 */
const pythonLoggingSetup = (logFileName: string) => `
# ========================================
# Logging Setup
# ========================================
LOG_DIR = "${LINUX_LOG_DIRECTORY}"
LOG_FILE = os.path.join(LOG_DIR, "${logFileName}")

def setup_logging():
    # Create log directory if it doesn't exist
    try:
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR)
    except (OSError, IOError):
        pass  # Will fail gracefully if can't create dir
    
    # Create root logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers
    logger.handlers = []
    
    # File handler - DEBUG and above (all levels)
    try:
        file_handler = logging.FileHandler(LOG_FILE)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '[%(levelname)s %(asctime)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    except (OSError, IOError):
        pass  # Continue without file logging if can't write
    
    # Console handler - INFO and above (no DEBUG)
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '[%(levelname)s] %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

logger = logging.getLogger(__name__)

def log(message):
    # type: (str) -> None
    logger.debug(message)

def log_info(message):
    # type: (str) -> None
    logger.info(message)

def log_error(message):
    # type: (str) -> None
    logger.error(message)

def log_warning(message):
    # type: (str) -> None
    logger.warning(message)
`;

/**
 * EC2 Metadata helpers as module-level functions.
 * Python 2.7+ compatible.
 */
const pythonEC2Metadata = `
# ========================================
# EC2 Metadata Helpers
# ========================================
_EC2_TOKEN_URL = "http://169.254.169.254/latest/api/token"
_EC2_METADATA_URL = "http://169.254.169.254/latest/meta-data"


def _get_ec2_token():
    # type: () -> Optional[str]
    try:
        if PYTHON3:
            req = urllib_request.Request(
                _EC2_TOKEN_URL,
                method='PUT',
                headers={'X-aws-ec2-metadata-token-ttl-seconds': '21600'}
            )
        else:
            req = urllib_request.Request(_EC2_TOKEN_URL)
            req.get_method = lambda: 'PUT'
            req.add_header('X-aws-ec2-metadata-token-ttl-seconds', '21600')
        response = urllib_request.urlopen(req, timeout=2)
        data = response.read()
        return data.decode('utf-8') if isinstance(data, binary_type) else data
    except Exception:
        return None


def _get_ec2_metadata(path):
    # type: (str) -> Optional[str]
    token = _get_ec2_token()
    if not token:
        return None
    try:
        url = "{}/{}".format(_EC2_METADATA_URL, path)
        if PYTHON3:
            req = urllib_request.Request(
                url, headers={'X-aws-ec2-metadata-token': token}
            )
        else:
            req = urllib_request.Request(url)
            req.add_header('X-aws-ec2-metadata-token', token)
        response = urllib_request.urlopen(req, timeout=2)
        data = response.read()
        return data.decode('utf-8') if isinstance(data, binary_type) else data
    except Exception:
        return None


def _aws_cli_text(cmd_args, timeout=15):
    # type: (list, int) -> Optional[str]
    """Run an AWS CLI command and return stripped text output, or None."""
    try:
        result = subprocess.run(
            cmd_args, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, timeout=timeout
        )
        if result.returncode != 0 or not result.stdout:
            return None
        output = result.stdout
        if isinstance(output, binary_type):
            output = output.decode('utf-8')
        output = output.strip()
        return output if output and output != 'None' else None
    except Exception as e:
        log("AWS CLI error: {}".format(e))
        return None


def get_ec2_metadata(region_fallback="us-east-1"):
    # type: (str) -> dict
    """Fetch all EC2 instance metadata in one call.

    Returns a dict with keys: instance_id, region, vm_name,
    vpc_id, vpc_name.  Missing values are None (except region
    which falls back to region_fallback).
    """
    info = {"instance_id": None, "region": None, "vm_name": None,
            "vpc_id": None, "vpc_name": None}

    az = _get_ec2_metadata("placement/availability-zone")
    info["region"] = az[:-1] if az else region_fallback

    info["instance_id"] = _get_ec2_metadata("instance-id")

    region = info["region"]

    # Instance Name tag (requires AWS CLI)
    if info["instance_id"] and region:
        info["vm_name"] = _aws_cli_text([
            'aws', 'ec2', 'describe-instances',
            '--instance-ids', info["instance_id"],
            '--region', region,
            '--query',
            'Reservations[0].Instances[0].Tags[?Key==\`Name\`].Value | [0]',
            '--output', 'text'])

    # VPC ID from IMDS (no AWS CLI needed)
    try:
        macs_raw = _get_ec2_metadata("network/interfaces/macs/")
        if macs_raw:
            mac = macs_raw.strip().splitlines()[0].strip().rstrip('/')
            if mac:
                vpc_id = _get_ec2_metadata(
                    "network/interfaces/macs/{}/vpc-id".format(mac))
                info["vpc_id"] = vpc_id.strip() if vpc_id else None
    except Exception as e:
        log("Could not get VPC ID from metadata: {}".format(e))

    # VPC Name tag (requires AWS CLI)
    if info["vpc_id"] and region:
        info["vpc_name"] = _aws_cli_text([
            'aws', 'ec2', 'describe-vpcs',
            '--vpc-ids', info["vpc_id"],
            '--region', region,
            '--query', 'Vpcs[0].Tags[?Key==\`Name\`].Value | [0]',
            '--output', 'text'])

    return info
`;

/**
 * OS information helper function.
 */
const pythonOsInfo = `
# ========================================
# OS Information Helper
# ========================================
def get_os_info():
    info = {
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine()
    }

    # Try to get Linux distribution info
    try:
        if os.path.exists('/etc/os-release'):
            with open('/etc/os-release', 'r') as f:
                for line in f:
                    if line.startswith('PRETTY_NAME='):
                        info["distribution"] = line.split('=')[1].strip().strip('"')
                        break
    except Exception:
        pass

    return info
`;

/**
 * Interactive credential prompting functions.
 * Python 2.7+ compatible.
 */
const pythonCredentialPrompts = `
# ========================================
# Interactive Credentials Prompt
# ========================================
def prompt_for_credentials(storage_endpoint):
    # type: (str) -> Tuple[str, str]
    print("")
    print("=" * 50)
    print("FSx ONTAP Credentials Required")
    print("=" * 50)
    print("Enter credentials for FSx filesystem: {}".format(storage_endpoint))
    print("")
    
    try:
        if PYTHON3:
            username = input("FSx Admin Username [fsxadmin]: ").strip() or "fsxadmin"
        else:
            username = raw_input("FSx Admin Username [fsxadmin]: ").strip() or "fsxadmin"
    except (EOFError, KeyboardInterrupt):
        username = "fsxadmin"
    
    try:
        password = getpass.getpass("FSx Admin Password: ")
    except (EOFError, KeyboardInterrupt):
        password = ""
    
    if not password:
        raise ValueError("Password is required")
    
    print("Credentials received.")
    print("")
    return username, password


def prompt_for_oracle_credentials(oracle_sid):
    # type: (str) -> Tuple[str, str, bool]
    print("")
    print("=" * 50)
    print("Oracle Database Credentials Required")
    print("=" * 50)
    print("OS Authentication failed. Enter password credentials.")
    print("Oracle SID: {}".format(oracle_sid))
    print("")

    try:
        if PYTHON3:
            username = input("Oracle Username [sys]: ").strip() or "sys"
        else:
            username = raw_input("Oracle Username [sys]: ").strip() or "sys"
    except (EOFError, KeyboardInterrupt):
        username = "sys"

    try:
        password = getpass.getpass("Oracle Password: ")
    except (EOFError, KeyboardInterrupt):
        password = ""

    if not password:
        raise ValueError("Password is required")

    use_sysdba = username.lower() in ('sys', 'sysdba')
    if use_sysdba:
        print("Connecting as {} with SYSDBA privilege...".format(username.upper()))

    print("Oracle credentials received.")
    print("")
    return username, password, use_sysdba
`;

/**
 * Credential helpers — retrieves credentials from AWS Secrets Manager
 * (via AWS CLI) with fallback to interactive prompts.
 *
 * For Oracle: OS Auth (default) -> Secrets Manager -> prompt, with sqlplus validation.
 * For FSx/ONTAP: Secrets Manager -> prompt, with API validation post-connection.
 *
 * Python 2.7+ compatible. Uses AWS CLI.
 */
const pythonCredentialManager = `
# ========================================
# Credential Helpers
# ========================================
def _run_aws_cli(cmd_args, timeout=30):
    # type: (list, int) -> dict
    try:
        result = subprocess.run(
            cmd_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout
        )
        if result.returncode != 0:
            stderr = result.stderr
            if isinstance(stderr, binary_type):
                stderr = stderr.decode('utf-8', errors='replace')
            log("AWS CLI error (rc={}): {}".format(
                result.returncode, stderr.strip()[:200]))
            return None
        stdout = result.stdout
        if isinstance(stdout, binary_type):
            stdout = stdout.decode('utf-8', errors='replace')
        return json.loads(stdout)
    except Exception as e:
        log("AWS CLI execution error: {}".format(e))
        return None


def _get_secret(secret_name, region=None):
    # type: (str, str) -> dict
    cmd = ['aws', 'secretsmanager', 'get-secret-value',
           '--secret-id', secret_name, '--output', 'json']
    if region:
        cmd.extend(['--region', region])

    log("Trying AWS Secrets Manager: {}".format(secret_name))
    response = _run_aws_cli(cmd)
    if not response:
        return None

    secret_string = response.get('SecretString')
    if not secret_string:
        log("Secret '{}' has no SecretString".format(secret_name))
        return None
    try:
        return json.loads(secret_string)
    except (ValueError, TypeError):
        log("Secret '{}' is not valid JSON".format(secret_name))
        return None


def _try_secrets(candidates, region=None):
    # type: (list, str) -> tuple
    for name in candidates:
        secret = _get_secret(name, region)
        if secret and secret.get('password'):
            return secret, name
    return None, None


def _validate_sqlplus(oracle_sid, oracle_home, username=None,
                      password=None, use_sysdba=True):
    # type: (str, str, str, str, bool) -> bool
    """Validate Oracle credentials by running a test query via sqlplus.

    Delegates to the shared run_sqlplus() helper to avoid duplicating
    the sqlplus invocation logic.
    """
    if not oracle_home:
        oracle_home = get_oracle_home(oracle_sid)
    if not oracle_home:
        log("Cannot validate: ORACLE_HOME not found for SID "
            "{}".format(oracle_sid))
        return False

    test_sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SELECT 'CRED_OK' FROM DUAL;
EXIT;'''

    config = {
        "oracle_sid": oracle_sid,
        "oracle_home": oracle_home,
        "oracle_username": username,
        "oracle_password": password,
        "use_sysdba": use_sysdba,
        "use_os_auth": username is None,
        "_cache": {}
    }

    try:
        output = run_sqlplus(config, test_sql)
        is_valid = 'CRED_OK' in output
        if not is_valid:
            log("Oracle validation failed. Output: {}".format(
                repr(output[:300])))
        return is_valid
    except Exception as e:
        log("Oracle validation error: {}".format(e))
        return False


def get_fsx_credentials(storage_endpoint, region=None,
                        secret_name=None):
    # type: (str, str, str) -> tuple
    log_info("Retrieving FSx/ONTAP credentials...")

    # 1. Try AWS Secrets Manager
    if secret_name:
        candidates = [secret_name]
    else:
        candidates = [
            "netapp-wf/ontap/{}".format(storage_endpoint),
            "netapp-wf/fsx/credentials"
        ]

    secret, matched = _try_secrets(candidates, region)
    if secret:
        username = secret.get('username', 'fsxadmin')
        password = secret.get('password')
        log_info("FSx credentials retrieved from AWS Secrets "
                 "Manager (secret: {})".format(matched))
        return username, password

    log_info("FSx credentials not found in AWS Secrets Manager, "
             "prompting interactively...")

    # 2. Fall back to interactive prompt
    return prompt_for_credentials(storage_endpoint)


def get_oracle_credentials(oracle_sid, oracle_home=None,
                           region=None, secret_name=None):
    # type: (str, str, str, str) -> tuple
    if not oracle_home:
        oracle_home = get_oracle_home(oracle_sid)

    # 1. Try OS Authentication first (default)
    log_info("Attempting Oracle OS Authentication (default)...")
    if _validate_sqlplus(oracle_sid, oracle_home):
        log_info("Oracle OS Authentication successful")
        return None, None, True
    log_warning("Oracle OS Authentication failed, trying "
                "alternative methods...")

    # 2. Try AWS Secrets Manager
    if secret_name:
        candidates = [secret_name]
    else:
        candidates = [
            "netapp-wf/oracle/{}".format(oracle_sid),
            "netapp-wf/oracle/credentials"
        ]

    secret, matched = _try_secrets(candidates, region)
    if secret:
        username = secret.get('username', 'sys')
        password = secret.get('password')
        use_sysdba = username.lower() in ('sys', 'sysdba')
        log_info("Oracle credentials found in Secrets Manager "
                 "({}), validating...".format(matched))
        if _validate_sqlplus(
                oracle_sid, oracle_home, username, password,
                use_sysdba):
            log_info("Oracle credentials from Secrets Manager "
                     "validated successfully")
            return username, password, use_sysdba
        log_warning("Oracle credentials from Secrets Manager "
                    "failed validation")

    # 3. Fall back to interactive prompt (password auth only)
    log_info("Prompting for Oracle password credentials...")
    username, password, use_sysdba = \\
        prompt_for_oracle_credentials(oracle_sid)

    # Validate prompted credentials
    if not _validate_sqlplus(
            oracle_sid, oracle_home, username, password,
            use_sysdba):
        log_error("")
        log_error("=" * 60)
        log_error("FATAL: Oracle Credential Validation Failed")
        log_error("=" * 60)
        log_error("")
        log_error("Could not connect to Oracle instance '{}' "
                  "with the provided credentials.".format(
                      oracle_sid))
        log_error("")
        log_error("Please verify:")
        log_error("  1. Oracle SID '{}' is correct and the "
                  "instance is running".format(oracle_sid))
        log_error("  2. The username and password are correct")
        log_error("  3. The user has SYSDBA privileges "
                  "(required for SYS)")
        log_error("  4. ORACLE_HOME '{}' is "
                  "valid".format(oracle_home or 'not set'))
        log_error("")
        log_error("Manual test:")
        log_error("  sqlplus {}/[password] as sysdba".format(
            username or 'sys'))
        log_error("=" * 60)
        sys.exit(1)

    log_info("Oracle credentials validated successfully")
    return username, password, use_sysdba


def validate_ontap_connection(ontap_config, storage_endpoint):
    # type: (dict, str) -> bool
    log_info("Validating ONTAP API credentials...")
    auth_hint = ""
    try:
        response = ontap_request(ontap_config, 'GET', 'cluster')
        if response and (response.get('name') or
                         response.get('uuid')):
            log_info("ONTAP API credentials validated "
                     "successfully (cluster: {})".format(
                         response.get('name', 'unknown')))
            return True
        auth_hint = ("Unexpected API response. The endpoint may "
                     "not be an ONTAP system.")
        log("ONTAP cluster response missing expected fields: "
            "{}".format(repr(response)[:200]))
    except Exception as e:
        error_msg = str(e)
        log("ONTAP validation exception: {}".format(error_msg))

        if '401' in error_msg or 'Unauthorized' in error_msg:
            auth_hint = ("The username or password is incorrect. "
                         "Please verify your FSx admin "
                         "credentials.")
        elif '403' in error_msg or 'Forbidden' in error_msg:
            auth_hint = ("Access denied. The provided user may "
                         "not have sufficient permissions.")
        elif 'Connection refused' in error_msg:
            auth_hint = ("Connection refused. The ONTAP "
                         "management interface may not be "
                         "reachable from this host.")
        elif 'timed out' in error_msg.lower():
            auth_hint = ("Connection timed out. Check network "
                         "connectivity to the storage endpoint.")
        elif 'Name or service not known' in error_msg:
            auth_hint = ("DNS resolution failed. Verify the "
                         "storage endpoint address.")
        else:
            auth_hint = "Error: {}".format(error_msg)

    log_error("")
    log_error("=" * 60)
    log_error("FATAL: ONTAP API Credential Validation Failed")
    log_error("=" * 60)
    log_error("")
    log_error("Could not authenticate to the ONTAP storage "
              "system at: {}".format(storage_endpoint))
    log_error("")
    if auth_hint:
        log_error("Reason: {}".format(auth_hint))
        log_error("")
    log_error("Please verify:")
    log_error("  1. The storage endpoint '{}' is "
              "correct".format(storage_endpoint))
    log_error("  2. The FSx admin username and password are "
              "correct")
    log_error("  3. The ONTAP management interface is reachable "
              "from this host")
    log_error("  4. The ONTAP REST API is enabled")
    log_error("")
    log_error("If using AWS Secrets Manager, verify the secret "
              "contains valid credentials.")
    log_error("=" * 60)
    sys.exit(1)
`;

/**
 * Python 2.7+ compatible subprocess helper.
 * Provides subprocess.run() compatibility for Python 2.7.
 */
const pythonSubprocessHelper = `
# ========================================
# Subprocess Helper (Python 2.7+ compatible)
# ========================================
SubprocessResult = namedtuple(
    'SubprocessResult', ['returncode', 'stdout', 'stderr'])


def run_subprocess(cmd, shell=False, stdout=None, stderr=None, timeout=None,
                   input_data=None, env=None):
    """Python 2.7 compatible subprocess.run replacement.

    Uses communicate() for safe I/O and threading.Timer for timeout
    handling to avoid race conditions between input and timeout.
    DEVNULL file descriptors are properly closed in a finally block.
    """

    # Handle DEVNULL for Python 2.7
    devnull_fds = []
    if stdout == subprocess.DEVNULL:
        stdout_fd = open(os.devnull, 'w')
        devnull_fds.append(stdout_fd)
    elif stdout == subprocess.PIPE:
        stdout_fd = subprocess.PIPE
    else:
        stdout_fd = None

    if stderr == subprocess.DEVNULL:
        stderr_fd = open(os.devnull, 'w')
        devnull_fds.append(stderr_fd)
    elif stderr == subprocess.PIPE:
        stderr_fd = subprocess.PIPE
    else:
        stderr_fd = None

    try:
        proc = subprocess.Popen(
            cmd,
            shell=shell,
            stdout=stdout_fd,
            stderr=stderr_fd,
            stdin=subprocess.PIPE if input_data else None,
            env=env
        )

        # Prepare input bytes
        input_bytes = None
        if input_data:
            if isinstance(input_data, text_type):
                input_bytes = input_data.encode('utf-8')
            else:
                input_bytes = input_data

        # Use communicate() with timeout via threading.Timer
        timed_out = [False]
        timer = None
        if timeout:
            def kill_on_timeout():
                timed_out[0] = True
                try:
                    proc.kill()
                except OSError:
                    pass
            timer = threading.Timer(timeout, kill_on_timeout)
            timer.start()

        try:
            stdout_data, stderr_data = proc.communicate(
                input=input_bytes)
        finally:
            if timer is not None:
                timer.cancel()

        if timed_out[0]:
            return SubprocessResult(
                1, None,
                "Command timed out after {} seconds".format(timeout))

        # Decode output
        if stdout_data and isinstance(stdout_data, binary_type):
            stdout_data = stdout_data.decode('utf-8', errors='replace')
        if stderr_data and isinstance(stderr_data, binary_type):
            stderr_data = stderr_data.decode('utf-8', errors='replace')

        return SubprocessResult(proc.returncode, stdout_data, stderr_data)

    except Exception as e:
        return SubprocessResult(1, None, str(e))
    finally:
        for fd in devnull_fds:
            try:
                fd.close()
            except Exception:
                pass


# Monkey patch subprocess.run if Python 2.7
if not PYTHON3:
    subprocess.run = run_subprocess
`;

export {
    pythonCommonImports,
    pythonLoggingSetup,
    pythonEC2Metadata,
    pythonOsInfo,
    pythonCredentialPrompts,
    pythonCredentialManager,
    pythonSubprocessHelper
};
