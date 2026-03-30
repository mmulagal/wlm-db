/**
 * Oracle One-Time WAD (Workload Assessment and Discovery) Python Script
 *
 * This module exports a Python 2.7+ compatible script for collecting
 * Oracle assessment data including metadata and mapped ONTAP volumes.
 *
 * The script output is compatible with the MSSQL one-time WAD format, containing:
 * - metadata: Host and Oracle instance information
 * - rawdata.instanceLevelDetails: Per-instance assessment data including mappedOntapVolumes
 *
 * Usage:
 *   python3 NetApp_WF_Oracle_Assessment.py <storage_endpoint> <oracle_sid>
 *
 * Arguments:
 *   storage_endpoint: FSx filesystem ID (fs-xxxxx) or management IP
 *   oracle_sid: Oracle SID to assess
 */

import { pythonOntapUtilities } from './get-mapped-ontap-volumes';
import { pythonStorageConfigFunctions } from './volume-lun-configuration';
import { pythonNfsAssessmentFunctions, pythonIscsiAssessmentFunctions } from './protocol-assessment-functions';
import {
    pythonCommonImports,
    pythonLoggingSetup,
    pythonEC2Metadata,
    pythonOsInfo,
    pythonCredentialPrompts,
    pythonCredentialManager,
    pythonSubprocessHelper
} from './python-common-utils';
import {
    pythonOracleHelpers,
    pythonOracleInstanceFunctions,
    pythonOracleAssessmentFunctions
} from './oracle-collectors';
import { CHECK_SWAP_SPACE } from '../storage-assessment-scripts';

const ORACLE_ONETIMEWAD_SCRIPT_VERSION = '1.0.0';

/**
 * Python script for Oracle one-time WAD assessment.
 * Takes command line arguments: storage_endpoint and oracle_sid.
 * Response format matches MSSQL one-time WAD with metadata and instanceLevelDetails.
 */
const oracleOneTimeWadPythonScript = `#!/usr/bin/env python
# -*- coding: utf-8 -*-

${pythonCommonImports}

${pythonSubprocessHelper}

# ========================================
# Configuration
# ========================================
SCRIPT_VERSION = "${ORACLE_ONETIMEWAD_SCRIPT_VERSION}"

# Parse command line arguments
parser = argparse.ArgumentParser(
    description='Oracle One-Time Workload Assessment and Discovery (WAD) Script'
)
parser.add_argument(
    '--StorageManagementAddress',
    required=True,
    help='FSx Management FQDN, Management IP, or FSx File System ID (fs-xxxxx)'
)
parser.add_argument(
    '--OracleSid',
    required=True,
    help='Oracle SID to assess'
)
parser.add_argument(
    '--OutputPath',
    default=None,
    help='Optional directory path where JSON output files should be created'
)

args = parser.parse_args()

STORAGE_ENDPOINT = args.StorageManagementAddress.strip()
ORACLE_SID = args.OracleSid.strip()
OUTPUT_PATH = args.OutputPath.strip() if args.OutputPath else None

${pythonLoggingSetup('oracle_onetimewad.log')}

${pythonEC2Metadata}

${pythonOsInfo}

${pythonCredentialPrompts}

${pythonCredentialManager}

${pythonOracleHelpers}

${pythonOracleInstanceFunctions}

${pythonNfsAssessmentFunctions}

${pythonOracleAssessmentFunctions}

${pythonOntapUtilities}

${pythonStorageConfigFunctions}

${pythonIscsiAssessmentFunctions}

# ========================================
# Storage Sizing Functions
# ========================================
${CHECK_SWAP_SPACE}

def extract_file_type_entries(ontap_volumes, is_cdb):
    """Extract (file_type_label, vol_list) pairs from ontap_volumes structure."""
    file_type_entries = []
    if not isinstance(ontap_volumes, dict):
        return file_type_entries
    
    if is_cdb:
        for pdb_name, pdb_file_types in ontap_volumes.items():
            if isinstance(pdb_file_types, dict):
                for file_type, vol_list in pdb_file_types.items():
                    file_type_entries.append(("{}/{}".format(pdb_name, file_type), vol_list))
    else:
        for file_type, vol_list in ontap_volumes.items():
            file_type_entries.append((file_type, vol_list))
    
    return file_type_entries


# ========================================
# Main Entry Point
# ========================================
def main():
    # type: () -> None
    setup_logging()

    print("")
    print("=" * 60)
    print("Oracle One-Time WAD Assessment v{}".format(SCRIPT_VERSION))
    print("=" * 60)
    print("Storage Endpoint: {}".format(STORAGE_ENDPOINT))
    print("Oracle SID: {}".format(ORACLE_SID))
    print("")

    # -------------------------------------------------------
    # Collect all EC2 metadata up-front (single helper call)
    # -------------------------------------------------------
    ec2 = get_ec2_metadata()  # returns dict with region, instance_id, vm_name, vpc_id, vpc_name
    region = ec2["region"]

    # -------------------------------------------------------
    # Pre-flight Check 1: Validate Oracle SID
    # -------------------------------------------------------
    log_info("Validating Oracle SID...")
    if not os.path.exists('/etc/oratab'):
        log_error("")
        log_error("=" * 60)
        log_error("Oracle SID Validation Failed")
        log_error("=" * 60)
        log_error("")
        log_error("Could not find /etc/oratab on this host.")
        log_error("Please verify that Oracle is installed "
                  "and configured.")
        log_error("=" * 60)
        sys.exit(1)

    _oratab_entries = parse_oratab()
    _available_sids = [sid for sid, _ in _oratab_entries]
    _oracle_home_preflight = None
    for _sid, _home in _oratab_entries:
        if _sid == ORACLE_SID:
            _oracle_home_preflight = _home
            break

    if _oracle_home_preflight is None:
        log_error("")
        log_error("=" * 60)
        log_error("Oracle SID '{}' Not Found".format(ORACLE_SID))
        log_error("=" * 60)
        log_error("")
        log_error("The Oracle SID '{}' was not found in "
                  "/etc/oratab.".format(ORACLE_SID))
        if _available_sids:
            log_error("")
            log_error("Available SIDs on this host:")
            for _s in _available_sids:
                log_error("  - {}".format(_s))
        log_error("")
        log_error("Please re-run with a valid --OracleSid value.")
        log_error("=" * 60)
        sys.exit(1)

    log_info("Oracle SID '{}' found (ORACLE_HOME: {})".format(
        ORACLE_SID, _oracle_home_preflight))

    # -------------------------------------------------------
    # Pre-flight Check 2: Validate Oracle Credentials
    # OS auth -> Secrets Manager -> interactive prompt.
    # Aborts on failure — no JSON is created.
    # -------------------------------------------------------
    log_info("Validating Oracle credentials...")
    oracle_username, oracle_password, use_sysdba = \\
        get_oracle_credentials(
            ORACLE_SID, oracle_home=_oracle_home_preflight, region=region, ec2_instance_id=ec2["instance_id"])

    # -------------------------------------------------------
    # Pre-flight Check 3: Validate ONTAP Credentials
    # Secrets Manager -> interactive prompt -> API validation.
    # Aborts on failure — no JSON is created.
    # -------------------------------------------------------
    log_info("Validating ONTAP credentials...")
    fsx_username, fsx_password = get_fsx_credentials(
        STORAGE_ENDPOINT, region=region)
    ontap_config = make_ontap_config(STORAGE_ENDPOINT, region, fsx_username, fsx_password)
    validate_ontap_connection(ontap_config, STORAGE_ENDPOINT)

    # -------------------------------------------------------
    # All pre-flight checks passed — begin full assessment
    # -------------------------------------------------------
    log_info("All pre-flight checks passed. Starting assessment...")
    print("")

    # Define output filename (similar to MSSQL one-time WAD)
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file_name = "Oracle_Assessment_v1_{}_{}.json".format(ORACLE_SID, timestamp)
    
    # Use OutputPath if provided, otherwise use current working directory
    if OUTPUT_PATH:
        try:
            if not os.path.exists(OUTPUT_PATH):
                os.makedirs(OUTPUT_PATH, mode=0o755)
            output_file_path = os.path.join(OUTPUT_PATH, output_file_name)
        except (OSError, IOError) as e:
            log_warning("Could not use specified output path '{}': {}. Using current directory instead.".format(OUTPUT_PATH, e))
            output_file_path = os.path.join(os.getcwd(), output_file_name)
    else:
        output_file_path = os.path.join(os.getcwd(), output_file_name)

    errors = []  # type: List[str]

    # Initialize result structure
    result = {
        "metadata": {
            "hostname": socket.gethostname(),
            "region": region,
            "storageEndpoint": STORAGE_ENDPOINT,
            "assessmentTimestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "scriptVersion": SCRIPT_VERSION,
            "osVersion": get_os_info().get("distribution", platform.platform()),
            "databaseType": "ORACLE"
        },
        "rawdata": {
            "hostLevelDetails": {
                "errors": {}
            },
            "instanceLevelDetails": {},
            "errors": []
        }
    }

    # EC2 instance metadata was already collected at startup
    ec2_instance_id = ec2["instance_id"]
    vm_name = ec2["vm_name"]
    virtual_network_id = ec2["vpc_id"]
    virtual_network_name = ec2["vpc_name"]

    # Collect number of Oracle instances on this host
    number_of_database_instances = len(_available_sids)
    log_info("Found {} Oracle instance(s) in /etc/oratab".format(number_of_database_instances))

    # Determine vmPlatform from OS distribution
    vm_platform = None
    try:
        os_info = get_os_info()
        distribution = os_info.get("distribution", "")
        if distribution:
            dist_lower = distribution.lower()
            if "red hat" in dist_lower or "rhel" in dist_lower:
                vm_platform = "Red Hat Enterprise Linux"
            elif "suse" in dist_lower or "sles" in dist_lower:
                vm_platform = "SUSE Linux"
    except Exception as e:
        log_warning("Could not determine vmPlatform: {}".format(e))

    # Update metadata with EC2 instance info
    result["metadata"]["ec2InstanceId"] = ec2_instance_id
    result["metadata"]["vmName"] = vm_name
    result["metadata"]["virtualNetworkId"] = virtual_network_id
    result["metadata"]["virtualNetworkName"] = virtual_network_name
    result["metadata"]["numberOfDatabaseInstances"] = number_of_database_instances
    if vm_platform:
        result["metadata"]["vmPlatform"] = vm_platform

    try:
        # Collect Oracle instance details
        log_info("Collecting Oracle instance details...")
        oracle_config = make_oracle_config(ORACLE_SID, oracle_username, oracle_password, use_sysdba)
        
        instance_running = is_instance_running(oracle_config)
        if not instance_running:
            log_info("Warning: Could not verify Oracle instance {} is running. Will attempt to connect anyway.".format(ORACLE_SID))

        instance_details = get_instance_details(oracle_config)
        
        if instance_details.get("error") and not instance_details.get("databaseVersion"):
            error_msg = "Failed to connect to Oracle instance {}: {}".format(ORACLE_SID, instance_details.get("error", "Unknown error"))
            log_error("")
            log_error("=" * 60)
            log_error("ERROR: Oracle Instance Connection Failed")
            log_error("=" * 60)
            log_error("")
            log_error(error_msg)
            log_error("")
            log_error("The Oracle credentials were validated but the instance")
            log_error("could not be reached. Please check:")
            log_error("  1. Oracle instance '{}' is running (ps -ef | grep ora_pmon_{})".format(ORACLE_SID, ORACLE_SID))
            log_error("  2. Oracle listener is running (lsnrctl status)")
            log_error("=" * 60)
            sys.exit(1)

        log_info("Instance details collected: {}".format(instance_details.get("databaseName", ORACLE_SID)))

        # Update metadata
        result["metadata"]["oracleSid"] = ORACLE_SID
        result["metadata"]["oracleHome"] = instance_details.get("oracleHome")
        result["metadata"]["deploymentType"] = instance_details.get("deploymentType")

        # Collect pluggable database details (if CDB)
        pluggable_databases = []
        if instance_details.get("isCDB"):
            log_info("Collecting pluggable database details...")
            try:
                pluggable_databases = get_pluggable_databases(oracle_config)
                log_info("Found {} pluggable database(s)".format(len(pluggable_databases)))
            except Exception as pdb_err:
                log_error("Failed to collect PDB details: {}".format(pdb_err))
                errors.append("PDB details: {}".format(pdb_err))

        # Detect and collect DataGuard details
        log_info("Checking DataGuard configuration...")
        dataguard_info = {"isDataGuardDeployed": False, "dataguardDetails": {}}
        try:
            dataguard_info = get_dataguard_details(oracle_config)
            if dataguard_info.get("isDataGuardDeployed"):
                log_info("DataGuard is deployed")
            else:
                log_info("DataGuard is not deployed")
        except Exception as dg_err:
            log_error("Failed to collect DataGuard details: {}".format(dg_err))
            dataguard_info = {"isDataGuardDeployed": False, "dataguardDetails": {"error": str(dg_err)}}
            errors.append("DataGuard: {}".format(dg_err))

        # Collect instance-level assessment data (reuses oracle_config)
        log_info("Collecting instance-level assessment data...")

        log_info("Checking FRA and RMAN status...")
        fra_rman_status = check_fra_rman_status(oracle_config)
        if fra_rman_status.get("error"):
            errors.append("FRA/RMAN status: {}".format(fra_rman_status["error"]))
        
        log_info("Collecting Oracle parameters...")
        oracle_parameters = check_oracle_parameters(oracle_config)
        if oracle_parameters.get("error"):
            errors.append("Oracle parameters: {}".format(oracle_parameters["error"]))

        # Resolve FSx ID from ONTAP cluster name when management IP or FQDN was provided
        is_fsx_id = STORAGE_ENDPOINT.startswith('fs-')
        if not is_fsx_id:
            log_info("Storage endpoint is not an FSx ID - attempting to resolve FSx ID from ONTAP cluster name...")
            resolved_fsx_id = resolve_fsx_id_from_cluster(ontap_config)
            if resolved_fsx_id:
                result["metadata"]["fsxId"] = resolved_fsx_id
                log_info("FSx ID resolved and added to metadata: {}".format(resolved_fsx_id))
            else:
                log_warning("Could not resolve FSx ID from ONTAP cluster name")
        else:
            result["metadata"]["fsxId"] = STORAGE_ENDPOINT

        # Collect Oracle mount point details (uses cached CDB/ASM/PDB from get_instance_details)
        log_info("Collecting Oracle mount point details...")
        mount_point_data = collect_mount_details(oracle_config)

        if mount_point_data.get("error"):
            errors.append(mount_point_data["error"])

        log_info("Collecting mapped ONTAP volumes...")
        mapped_volumes = get_mapped_volumes(ontap_config, ORACLE_SID, mount_point_data)

        # Extract volume/LUN UUIDs and SVM info
        volume_uuids = set()
        volume_names = set()
        svm_uuids = set()
        svm_names = set()
        lun_uuids = set()
        storage_protocol = mapped_volumes.get("protocol", "NFS")
        total_file_types = 0
        empty_file_types = 0
        
        """
        Flatten the nested volume mapping structure into a flat list of file type entries.
        
        The mapped_volumes structure is nested as:
        - volumeMappings: list of SID mappings
          - Each SID mapping contains ontapVolumes (dict)
            - For CDB: {pdb_name: {file_type: [volumes]}}
            - For non-CDB: {file_type: [volumes]}
        
        This section extracts all (file_type_label, vol_list) pairs into a single
        flat list for easier processing in the subsequent loop.
        """
        all_file_type_entries = []
        for sid_mapping in mapped_volumes.get("volumeMappings", []):
            for sid, sid_data in sid_mapping.items():
                ontap_volumes = sid_data.get("ontapVolumes", {})
                is_cdb = sid_data.get("isCDB", False)
                entries = extract_file_type_entries(ontap_volumes, is_cdb)
                all_file_type_entries.extend(entries)

        # Process all file type entries in a single loop
        for file_type_label, vol_list in all_file_type_entries:
            total_file_types += 1
            if isinstance(vol_list, list):
                if not vol_list:
                    empty_file_types += 1
                    log_info("File type {} has no mapped volumes".format(file_type_label))
                for vol in vol_list:
                    vol_uuid = vol.get("volumeId") or vol.get("ontapVolumeUuid")
                    vol_name = vol.get("volumeName") or vol.get("ontapVolumeName")
                    lun_uuid = vol.get("lunUuid") or vol.get("lunId")
                    
                    if vol_uuid:
                        volume_uuids.add(vol_uuid)
                    if vol_name:
                        volume_names.add(vol_name)
                    svm_id = vol.get("svmId")
                    if svm_id:
                        svm_uuids.add(svm_id)
                    svm_name = vol.get("svmName")
                    if svm_name:
                        svm_names.add(svm_name)
                    if lun_uuid:
                        lun_uuids.add(lun_uuid)
        
        # Convert sets to lists for downstream code compatibility
        volume_uuids = list(volume_uuids)
        volume_names = list(volume_names)
        svm_uuids = list(svm_uuids)
        svm_names = list(svm_names)
        lun_uuids = list(lun_uuids)
        
        log_info("Volume extraction summary: {} total file types, {} empty, {} volumes found".format(
            total_file_types, empty_file_types, len(volume_uuids)))

        # -------------------------------------------------------
        # Abort if no ONTAP volumes were mapped at all.
        # This is the strongest signal that Oracle data files are
        # NOT stored on FSxN — they may be on EBS, local disk,
        # FSx for Windows, or another storage system entirely.
        # -------------------------------------------------------
        if not volume_uuids and not lun_uuids:
            log_error("")
            log_error("=" * 60)
            log_error("FATAL: No ONTAP Volumes Mapped for Oracle SID '{}'".format(ORACLE_SID))
            log_error("=" * 60)
            log_error("")
            log_error("The assessment connected to ONTAP successfully but could")
            log_error("not map ANY Oracle data files to ONTAP volumes or LUNs.")
            log_error("")
            log_error("Most likely cause:")
            log_error("  Oracle data files are NOT stored on FSxN (FSx for")
            log_error("  NetApp ONTAP). This script only supports Oracle")
            log_error("  databases whose data files reside on FSxN storage.")
            log_error("")
            log_error("Other possible causes:")
            log_error("  - Wrong --StorageManagementAddress: the ONTAP system")
            log_error("    specified does not serve Oracle's data directories.")
            log_error("  - Oracle files are on EBS, local disk, FSx for")
            log_error("    Windows, or another non-FSxN storage backend.")
            log_error("  - Mount points could not be resolved to ONTAP")
            log_error("    junction paths (check NFS/iSCSI connectivity).")
            log_error("")
            log_error("Diagnostic summary:")
            log_error("  Storage endpoint : {}".format(STORAGE_ENDPOINT))
            log_error("  Detected protocol: {}".format(storage_protocol or "unknown"))
            log_error("  File types found : {}".format(total_file_types))
            log_error("  Empty file types : {}".format(empty_file_types))
            mount_summary = mount_point_data.get("mountDetails") or mount_point_data.get("pdbMountDetails")
            if not mount_summary:
                log_error("  Mount points     : none collected (mount detection failed)")
            log_error("")
            log_error("To confirm whether Oracle is on FSxN, run:")
            log_error("  mount | grep nfs")
            log_error("  sudo iscsiadm -m session")
            log_error("=" * 60)
            sys.exit(1)

        # Collect storage data
        storage = {
            "volumes": {"error": "", "data": [], "filesystemId": result["metadata"].get("fsxId") or STORAGE_ENDPOINT},
            "luns": {"error": "LUNs not applicable", "data": []},
            "binaryVolumes": {"error": "", "data": []},
            "fraEnabled": "yes" if fra_rman_status.get("fraEnabled") else "no",
            "rmanCompressionEnabled": "yes" if fra_rman_status.get("rmanCompressionEnabled") else "no",
            "errors": {}
        }

        os_assessment = {"os": {}}
        adr_info = {}
        iscsi_assessment = {}

        # ========================================
        # NFS Protocol-Specific Collection
        # ========================================
        if storage_protocol == "NFS":
            log_info("Collecting NFS OS assessment data...")

            try:
                dnfs_status = check_dnfs_servers(oracle_config)
                if dnfs_status.get("error"):
                    errors.append("dNFS status: {}".format(dnfs_status["error"]))
            except Exception as dnfs_err:
                dnfs_status = {"error": str(dnfs_err), "data": []}
                errors.append("dNFS status: {}".format(dnfs_err))

            try:
                os_assessment = collect_nfs_os_assessment(oracle_config)
                adr_info = os_assessment.pop("adr-info", {})
                if adr_info.get("error"):
                    errors.append("ADR info: {}".format(adr_info["error"]))
                log_info("NFS OS assessment data collected")
            except Exception as host_err:
                error_msg = "Failed to collect NFS OS assessment data: {}".format(host_err)
                log_error(error_msg)
                result["rawdata"]["hostLevelDetails"]["errors"]["general"] = error_msg
                errors.append(error_msg)

            storage["dnfsServers"] = dnfs_status
            storage["nfsv4DomainData"] = {"error": None, "data": {}}
            storage["nfsRootonly"] = []

            # Collect NFS protocol configuration
            if svm_uuids:
                log_info("Collecting NFS protocol configuration...")
                try:
                    nfs_config = get_nfs_configuration(ontap_config, svm_uuids, svm_names)
                    storage["nfsv4DomainData"] = nfs_config.get("nfsProtocol", {})
                    storage["nfsRootonly"] = nfs_config.get("nfsRootonly", [])
                    if storage["nfsv4DomainData"].get("error"):
                        storage["errors"]["nfsv4DomainData"] = storage["nfsv4DomainData"]["error"]
                except Exception as nfs_err:
                    storage["errors"]["nfsv4DomainData"] = str(nfs_err)
                    errors.append("NFS config: {}".format(nfs_err))

        # ========================================
        # iSCSI Protocol-Specific Collection
        # ========================================
        if storage_protocol == "iSCSI":
            log_info("Collecting iSCSI-specific assessment data...")
            # Extract ASM disk groups from mount point data
            iscsi_disk_groups = set()
            mount_details_src = mount_point_data.get("pdbMountDetails", {}) if mount_point_data.get("isCDB") else {"_root": mount_point_data.get("mountDetails", {})}
            for pdb_key, pdb_mounts in mount_details_src.items():
                if isinstance(pdb_mounts, dict):
                    for ft, mounts_list in pdb_mounts.items():
                        if isinstance(mounts_list, list):
                            for m in mounts_list:
                                dg = m.get("diskGroup")
                                if dg:
                                    iscsi_disk_groups.add(dg)
            try:
                iscsi_assessment = collect_iscsi_assessment(oracle_config, list(iscsi_disk_groups))
            except Exception as iscsi_err:
                log_error("Failed to collect iSCSI assessment: {}".format(iscsi_err))
                iscsi_assessment = {"error": str(iscsi_err)}

            # Collect LUN configuration
            if lun_uuids:
                log_info("Collecting storage LUN configuration...")
                try:
                    lun_result = get_lun_configuration(ontap_config, lun_uuids)
                    storage["luns"]["data"] = lun_result.get("data", [])
                    storage["luns"]["error"] = lun_result.get("error") or ""
                    if lun_result.get("error"):
                        storage["errors"]["luns"] = lun_result["error"]
                        errors.append("LUN config: {}".format(lun_result["error"]))
                except Exception as lun_err:
                    storage["errors"]["luns"] = str(lun_err)
                    storage["luns"]["error"] = str(lun_err)
                    errors.append("LUN config: {}".format(lun_err))

        # Collect swap space sizing
        log_info("Collecting swap space sizing...")
        try:
            swap_space = check_swap_space()
            storage["sizing"] = {"swapSpace": swap_space}
            if swap_space.get("error"):
                errors.append("Swap space: {}".format(swap_space["error"]))
        except Exception as swap_err:
            storage["sizing"] = {"swapSpace": {"error": str(swap_err)}}
            errors.append("Swap space: {}".format(swap_err))
        
        # Collect volume configuration
        if volume_uuids:
            log_info("Collecting storage volume configuration...")
            try:
                vol_result = get_volume_configuration(ontap_config, volume_uuids, volume_names)
                storage["volumes"]["data"] = vol_result.get("data", [])
                storage["volumes"]["error"] = vol_result.get("error") or ""
                if vol_result.get("error"):
                    storage["errors"]["volumes"] = vol_result["error"]
                    errors.append("Volume config: {}".format(vol_result["error"]))
            except Exception as vol_err:
                storage["errors"]["volumes"] = str(vol_err)
                storage["volumes"]["error"] = str(vol_err)
                errors.append("Volume config: {}".format(vol_err))
        
        # Collect binary volumes
        log_info("Collecting Oracle binary volumes...")
        try:
            oracle_home = oracle_config.get("oracle_home")
            if oracle_home:
                binary_vol_info = {
                    "volumeId": None,
                    "volumeName": "root",
                    "oracleHome": oracle_home,
                    "isNfsMount": False,
                    "hasBinaries": True,
                    "mountPath": None,
                    "nfsInfo": None,
                    "oracleSid": ORACLE_SID
                }
                try:
                    proc = subprocess.run(
                        ['stat', '-f', '-c', '%T', oracle_home],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        timeout=5
                    )
                    stdout_data = proc.stdout
                    if isinstance(stdout_data, binary_type):
                        stdout_data = stdout_data.decode('utf-8', errors='replace')
                    fs_type = (stdout_data or '').strip().lower()
                    if fs_type in ['nfs', 'nfs4']:
                        binary_vol_info["isNfsMount"] = True
                        df_proc = subprocess.run(
                            ['df', oracle_home],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            timeout=10
                        )
                        df_out = df_proc.stdout
                        if isinstance(df_out, binary_type):
                            df_out = df_out.decode('utf-8', errors='replace')
                        df_lines = (df_out or '').strip().split('\\n')
                        if len(df_lines) >= 2:
                            parts = df_lines[-1].split()
                            if len(parts) >= 6:
                                binary_vol_info["mountPath"] = parts[5]
                except Exception:
                    pass
                storage["binaryVolumes"]["data"].append(binary_vol_info)
        except Exception as bin_err:
            storage["binaryVolumes"]["error"] = str(bin_err)
            storage["errors"]["binaryVolumes"] = str(bin_err)

        # Merge iSCSI assessment into os section
        os_results = os_assessment.get("os", {})
        if iscsi_assessment:
            if "os" in iscsi_assessment:
                for key, value in iscsi_assessment["os"].items():
                    os_results[key] = value
            if "oracle-parameters" in iscsi_assessment:
                os_results["oracle-parameters"] = iscsi_assessment["oracle-parameters"]
            if "oracle-init-parameters" in iscsi_assessment:
                os_results["oracle-parameters-from-init"] = iscsi_assessment["oracle-init-parameters"]
            if "asm-os-config" in iscsi_assessment:
                os_results["asm-os-config"] = iscsi_assessment["asm-os-config"]

        # Collect headroom data
        log_info("Collecting ONTAP storage headroom data...")
        try:
            aggregate_response = ontap_request(
                ontap_config,
                "GET",
                "storage/aggregates?fields=space.block_storage.size,space.block_storage.used,space.block_storage.available"
            )
            
            if aggregate_response and aggregate_response.get("records"):
                total_size = 0
                total_used = 0
                total_available = 0
                
                for aggregate in aggregate_response["records"]:
                    space = aggregate.get("space", {}).get("block_storage", {})
                    total_size += space.get("size", 0)
                    total_used += space.get("used", 0)
                    total_available += space.get("available", 0)
                
                headroom_percent = int(math.ceil((float(total_size - total_used) / total_size) * 100)) if total_size > 0 else 0
                
                result["rawdata"]["hostLevelDetails"]["headroom"] = {
                    "ssdStorageCapacityInBytes": total_size,
                    "storageUsedInBytes": total_used,
                    "storageAvailableInBytes": total_available,
                    "headroomPercent": headroom_percent,
                    "aggregateCount": len(aggregate_response["records"])
                }
                
                log_info("Headroom data collected: {}% available".format(headroom_percent))
            else:
                log_warning("No aggregate data returned from ONTAP")
                result["rawdata"]["hostLevelDetails"]["headroom"] = {}
        except Exception as headroom_err:
            log_warning("Failed to get headroom data: {}".format(headroom_err))
            result["rawdata"]["hostLevelDetails"]["headroom"] = {}

        # Build instance level details
        instance_level = {
            "instanceDetails": instance_details,
            "mappedOntapVolumes": mapped_volumes,
            "storage": storage,
            "os": os_results,
            "pluggableDatabases": pluggable_databases,
            "isDataGuardDeployed": dataguard_info.get("isDataGuardDeployed", False),
            "dataguardDetails": dataguard_info.get("dataguardDetails", {})
        }
        if storage_protocol == "NFS":
            instance_level["adrInfo"] = adr_info
        result["rawdata"]["instanceLevelDetails"][ORACLE_SID] = instance_level

        if errors:
            result["rawdata"]["errors"] = errors

        print("")
        print("=" * 60)
        print("Oracle One-Time WAD Assessment completed successfully")
        print("=" * 60)
        print("")

        # Write the response to a JSON file in the current working directory
        with open(output_file_path, 'w') as f:
            json.dump(result, f)
        log_info("Assessment completed successfully")
        log_info("Assessment results written to: {}".format(output_file_path))
        print(output_file_path)

    except Exception as e:
        log_error("")
        log_error("=" * 60)
        log_error("ERROR: Assessment Failed")
        log_error("=" * 60)
        log_error("")
        log_error("An unexpected error occurred: {}".format(e))
        log_error("")
        log_error("Check the log file for more details.")
        log_error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
`;

export { oracleOneTimeWadPythonScript, ORACLE_ONETIMEWAD_SCRIPT_VERSION };
