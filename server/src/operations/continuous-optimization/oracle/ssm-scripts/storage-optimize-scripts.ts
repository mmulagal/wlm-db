// ************************************************* //
// ************ PYTHON TEMPLATES BEGIN ************* //
// ************************************************* //

import { OptimizeStorageParams } from '../../../../utils/common-types';
import {
    getFsxCredentials,
    ontapRestApiScript,
    logFileCheck,
    pythonScriptInit
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { UnOptimizedDiskGroups } from '../../assessment-utils';

const oracleStorageConfigurationPythonTemplate = (params: OptimizeStorageParams) => `
${getFsxCredentials}
${ontapRestApiScript}

# Optimize Oracle storage configuration using ONTAP REST API
fsxId = '${params.fsxId}'
region = '${params.region}'
apiPath = '${params.apiEndpoint}'[1:]
query = '${params.apiQueryFilter}'
body = '${params.apiBody}'
method = '${params.apiType || 'PATCH'}'
url = apiPath

if query:
    url = f"{apiPath}?{query}"

log(f"Sending {method} request to: {url} with body: {body}")
if method in ["GET"]:
    body = None
response, error = ontapRestApiRequest(fsxId, region, method, url, body)
if error:
    log(f"Error occurred: {error}")
    print(json.dumps(error))
    exit()

log(f"Response: {json.dumps(response)}")
print(json.dumps(response))
`;

const createOntapVols = (
    unOptimizedDiskGroups: UnOptimizedDiskGroups[],
    lunUuids: string[],
    fsxId: string,
    region: string
) => `
${getFsxCredentials}
${ontapRestApiScript}
unOptimizedDiskGroups = json.loads('${JSON.stringify(unOptimizedDiskGroups)}')
lunUuidString = '${lunUuids.join()}'
region = '${region}'
fsxId = '${fsxId}'

response, error = ontapRestApiRequest(fsxId, region, 'GET', f"/storage/luns?uuid={lunUuidString}&fields=space")
if error:
    log(f"Error fetching LUN sizes: {error}")
else:
    log(f"LUN sizes response: {response}")
    smallest_size = min(rec["space"]["size"] for rec in response["records"])
lunSize = smallest_size
volSize = lunSize * 1.1

initiator = None
with open('/etc/iscsi/initiatorname.iscsi') as f:
    for line in f:
        if 'InitiatorName' in line:
            parts = line.strip().split('=', 1)
            if len(parts) == 2:
                initiator = parts[1]
                break

result = {}
failedLuns = []
successfulLuns = []
for diskGrp in unOptimizedDiskGroups:
    payload = {}
    payload['size'] = str(volSize) + 'b'
    payload['type'] = 'RW'
    payload['svm'] = {'name': diskGrp['svmName']}
    payload['nas'] = {'security_style': 'UNIX'}
    payload['style'] = 'flexvol'
    payload['aggregates'] = [{'name': 'aggr1'}]
    
    result.setdefault(diskGrp['diskGroupName'], {})
    result[diskGrp['diskGroupName']]['error'] = ""
    result[diskGrp['diskGroupName']]['luns'] = []

    lunPayload = {
        "location": {"volume": {"name": ""}, "logical_unit": "lun1"},
        "space": {"size": str(lunSize) + 'b', "guarantee": {"requested": "true"}},
        "os_type": "linux",
        "svm": {"name": diskGrp['svmName']},

    }
    igrpName = ""
    iGrpResponse, iGrpError = ontapRestApiRequest(fsxId, region, 'GET', '/protocols/san/igroups?protocol=iscsi&svm.name='+diskGrp['svmName']+'&initiators.name='+initiator)
    if(iGrpError):
        log(f"Error fetching igroups for SVM {diskGrp['svmName']}: {iGrpError}")
        result[diskGrp['diskGroupName']]['error'] += str(iGrpError)
        continue
    elif iGrpResponse['num_records'] > 0:
        log(f"Found existing igroup for SVM {diskGrp['svmName']}: {iGrpResponse['records'][0]['name']}")
        igrpName = iGrpResponse['records'][0]['name']
    else:
        iGrpPayload = {
            "svm": {"name": diskGrp['svmName']},
            "name": initiator,
            "protocol": "iscsi",
            "initiators": [{"name": initiator}],
            "os_type": "linux"
        }
        iGrpResponse, iGrpError = ontapRestApiRequest(fsxId, region, 'POST', '/protocols/san/igroups', iGrpPayload)
        if(iGrpError):
            log(f"Error creating igroup for SVM {diskGrp['svmName']}: {iGrpError}")
            result[diskGrp['diskGroupName']]['error'] += str(iGrpError)
            continue
        else:
            log(f"Successfully created igroup {iGrpResponse['name']} for SVM {diskGrp['svmName']}")
            igrpName = initiator

    iscsiSessionResponse, iscsiSessionError = ontapRestApiRequest(fsxId, region, 'GET', f"network/ip/interfaces?svm.name={diskGrp['svmName']}&services=*iscsi*&fields=ip.address")
    if iscsiSessionError or iscsiSessionResponse['num_records'] == 0:
        log(f"Error fetching iSCSI session information: {iscsiSessionError}")
        result[diskGrp['diskGroupName']]['error'] += str(iscsiSessionError)
        continue
    else:
        log(f"Successfully fetched iSCSI session information: {iscsiSessionResponse}")
        iscsi_ip = iscsiSessionResponse['records'][0]['ip']['address']
        result[diskGrp['diskGroupName']]['iscsi_ip'] = iscsi_ip

    for volName in diskGrp['volumeNames']:
        log(f"Creating volume {volName} of size {volSize}B in SVM {diskGrp['svmName']}")
        payload['name'] = volName;
        response, error = ontapRestApiRequest(fsxId, region, 'POST', 'storage/volumes', payload)
        
        if error:
            log(f"Error creating volume {volName}: {error}")
            result[diskGrp['diskGroupName']]['error'] += str(error)
        else:
            log(f"Successfully created volume {volName}: {response}")
            lunPayload['location']['volume']['name'] = volName
            response, error = ontapRestApiRequest(fsxId, region, 'POST', '/storage/luns', lunPayload)
            
            if error:
                log(f"Error creating LUN in volume {volName}: {error}")
                result[diskGrp['diskGroupName']]['error'] += str(error)
            else:
                log(f"Successfully created LUN in volume {volName}: response: {response}")
                lunMapPayload = {
                    "svm": {"name": diskGrp['svmName']},
                    "lun": {"name": '/vol/' + volName + '/lun1'},
                    "igroup": {"name": igrpName}
                }
                lunMapResponse, lunMapError = ontapRestApiRequest(fsxId, region, 'POST', '/protocols/san/lun-maps', lunMapPayload)
                if lunMapError:
                    log(f"Error mapping LUN in volume {volName} to igroup {igrpName}: {lunMapError}")
                    result[diskGrp['diskGroupName']]['error'] += str(lunMapError)
                    failedLuns.append(volName)
                else:
                    log(f"Successfully mapped LUN in volume {volName} to igroup {igrpName}: response: {lunMapResponse}")
                    log(f"Fetching LUN serial for /vol/{volName}/lun1")
                    lunSerialResponse, lunSerialError = ontapRestApiRequest(fsxId, region, 'GET', f"storage/luns?svm.name={diskGrp['svmName']}&name=/vol/{volName}/lun1&fields=serial_number")
                    if lunSerialError or lunSerialResponse['num_records'] == 0:
                        log(f"Error fetching LUN serial for /vol/{volName}/lun1: {lunSerialError}")
                        result[diskGrp['diskGroupName']]['error'] += str(lunSerialError)
                    else:
                        log(f"Successfully fetched LUN serial for /vol/{volName}/lun1: {lunSerialResponse}")
                        result[diskGrp['diskGroupName']]['luns'].append(lunSerialResponse['records'][0]['serial_number'])
                        successfulLuns.append(lunSerialResponse['records'][0]['serial_number'])

log(f"Successfully created and mapped LUNs: {successfulLuns}")
log(f"Failed to create or map LUNs: {failedLuns}")
print(json.dumps(result))
`;

const mountLunsToDisksScript = (diskGroups: UnOptimizedDiskGroups[]) => `
diskGroups = json.loads('${JSON.stringify(diskGroups)}')
result = {}
def escape_to_hex(s, charset=':<>#$%*+=?@[!]^~/'):
    pattern = r'([{}])'.format(re.escape(charset))
    return re.sub(pattern, lambda m: '\\\\x{:02x}'.format(ord(m.group(1))), s)

def resolve_lun(serial, byid='/dev/disk/by-id'):
    esc = escape_to_hex(serial)
    # collect candidates that end with the escaped serial
    names = [n for n in os.listdir(byid) if n.endswith(esc)]
    if not names:
        return None
    names.sort(key=lambda n: ('-part' in n, n))
    link = os.path.join(byid, names[0])
    return os.path.realpath(link)

def run_shell(cmd, input_str=None):
    return subprocess.run(
        cmd,
        input=input_str,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )

def is_block_device(path):
    try:
        st = os.stat(path)
        return stat.S_ISBLK(st.st_mode)
    except FileNotFoundError:
        return False

def wait_for_device(path, timeout=20, interval=0.5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_block_device(path):
            return True
        time.sleep(interval)
    return False

def _partition_path(device, number=1):
   suffix = f"p{number}" if device[-1].isdigit() else f"{number}"
   return f"{device}{suffix}"

def create_partition_and_format(device="/dev/sdd", timeout=30):
    if os.geteuid() != 0:
        raise PermissionError("Must run as root.")

    if not is_block_device(device):
        raise FileNotFoundError(f"{device} not found or not a block device.")

    partition = _partition_path(device, 1)

    # fdisk script: new (n), primary (p), partition 1, accept defaults, write (w)
    fdisk_script = "n\\np\\n1\\n\\n\\nw\\n"
    try:
        run_shell(["fdisk", device], input_str=fdisk_script)
        run_shell(["partprobe", device])
        run_shell(["udevadm", "settle"])
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Partitioning failed: {' '.join(e.cmd)}\\n{e.stderr}") from e

    if not wait_for_device(partition, timeout=timeout):
        raise TimeoutError(f"{partition} did not appear within {timeout}s.")

    try:
        run_shell(["mkfs.ext4", "-F", partition])
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"mkfs.ext4 failed: {e.stderr}") from e
    if not is_block_device(partition):
        raise RuntimeError(f"{partition} not found after mkfs.")

    return partition

def add_oracle_asm_disk(target, diskname, oracleasm_bin="/usr/sbin/oracleasm"):

    if not (os.path.exists(oracleasm_bin) or shutil.which(oracleasm_bin)):
        raise FileNotFoundError(f"{oracleasm_bin} not found.")

    try:
        run_shell([oracleasm_bin, "init"])
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"oracleasm init failed: {e.stderr}") from e

    try:
        existing = run_shell([oracleasm_bin, "listdisks"]).stdout.splitlines()
    except subprocess.CalledProcessError:
        existing = []

    if diskname in existing:
        return {"device": target, "diskname": diskname, "status": "exists"}

    try:
        run_shell([oracleasm_bin, "createdisk", diskname, target])
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"oracleasm createdisk failed: {e.stderr}") from e

    try:
        out = run_shell([oracleasm_bin, "listdisks"]).stdout.splitlines()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"oracleasm listdisks failed: {e.stderr}") from e

    if diskname not in out:
        raise RuntimeError(f"ASM disk {diskname} not visible after creation.")

    return {"device": target, "diskname": diskname, "status": "created"}

for diskGrp in diskGroups:
    diskGrpName = diskGrp['diskGroupName']
    svmName = diskGrp['svmName']
    lunSerials = diskGrp.get('lunSerials', [])
    targetDevices = []
    targetPartitions = []
    log(f"getting ISCSI sesson IPs")
    result.setdefault(diskGrp['diskGroupName'], {})
    result[diskGrp['diskGroupName']]['error'] = ""
    result[diskGrp['diskGroupName']]['disks'] = []

    iscsiIp = diskGrp.get('iscsiIp')
    log(f"Found ISCSI IP for SVM {diskGrpName}: {iscsiIp}")

    cmd = f"sudo iscsiadm -m discovery -t st -p {iscsiIp}:3260 && sudo iscsiadm -m node -p {iscsiIp}:3260 --login && sudo iscsiadm -m session --rescan"
    iscsi_result = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    if iscsi_result.returncode == 0:
        log(f"Successfully executed ISCSI commands for SVM {diskGrpName}")
    else:
        log(f"Error executing ISCSI commands for SVM {diskGrpName}")
        result[diskGrp['diskGroupName']]['error'] += f"Error executing ISCSI commands for SVM {diskGrpName}"
        continue

    # Resolve LUNs with retry mechanism (3 attempts with rescan)
    for lunSerial in lunSerials:
        log(f"Resolving LUN with serial {lunSerial}")
        lunPath = None
        attempts = 0
        max_attempts = 2
        
        while attempts < max_attempts:
            attempts += 1
            log(f"Attempt {attempts} to resolve LUN {lunSerial}")
            
            lunPath = resolve_lun(lunSerial)
            if lunPath:
                log(f"Successfully resolved LUN {lunSerial} to path {lunPath} on attempt {attempts}")
                break
            
            log(f"Could not resolve LUN with serial {lunSerial} on attempt {attempts}")
            
            # If not the last attempt, rescan and wait
            if attempts < max_attempts:
                log(f"Rescanning ISCSI sessions before attempt {attempts + 1}")
                rescan_cmd = "sudo iscsiadm -m session --rescan"
                subprocess.run(rescan_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
                log(f"Waiting 10 seconds before next attempt...")
                time.sleep(10)
        
        if not lunPath:
            log(f"Could not resolve LUN with serial {lunSerial} after {max_attempts} attempts")
            result[diskGrp['diskGroupName']]['error'] += f"Could not resolve LUN with serial {lunSerial} after {max_attempts} attempts"
            continue
        
        targetDevices.append(lunPath)

    if len(targetDevices) != len(lunSerials):  
        log(f"Could not resolve all LUNs for disk group {diskGrpName}. Expected {len(lunSerials)}, got {len(targetDevices)}")  
        result[diskGrp['diskGroupName']]['error'] += f"Could not resolve all LUNs for disk group {diskGrpName}. Expected {len(lunSerials)}, got {len(targetDevices)}"  
        continue
    else:
        log(f"Successfully resolved all LUNs for disk group {diskGrpName}: {targetDevices}")

    diskCount = 1
    for device in targetDevices:
        try:
            partition = create_partition_and_format(device)
            log(f"Successfully created partition and formatted {device} as ext4: {partition}")
            log(f"Adding {partition} as ASM disk {diskGrpName}_DISK{len(result[diskGrp['diskGroupName']]['disks']) + 1}")
            diskName = f"WLMDB_{diskGrpName}_DISK{diskCount}"
            asmResponse = add_oracle_asm_disk(partition, diskName)

            result[diskGrp['diskGroupName']]['disks'].append(diskName)
            diskCount += 1
        except Exception as e:
            log(f"Error creating partition and formatting {device}: {e}")
            result[diskGrp['diskGroupName']]['error'] += str(e)

print(json.dumps(result))
`;

const addDiskToDiskGroupsScript = (diskGroups: UnOptimizedDiskGroups[]) => `
diskGroups = json.loads('${JSON.stringify(diskGroups)}')
oracle_home = os.environ.get("ORACLE_HOME")
asmca_path = os.path.join(oracle_home, "bin", "asmca")
result = {}
asmca_path = shutil.which("asmca") or asmca_path
for diskGrp in diskGroups:
    diskGroupName = diskGrp['diskGroupName']
    asmDisks = diskGrp.get('asmDisks', [])
    result.setdefault(diskGrp['diskGroupName'], {})
    result[diskGrp['diskGroupName']]['error'] = ""
    result[diskGrp['diskGroupName']]['addedDisks'] = []
    for diskName in asmDisks:
        cmd = [asmca_path, "-silent", "-addDisk", "-diskGroupName", diskGroupName, "-diskList", f"ORCL:{diskName}"]
        command_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,        
            check=False
        )
        if command_result.returncode == 0:
            log(f"Successfully added {diskName} to {diskGroupName}")
            result[diskGrp['diskGroupName']]['addedDisks'].append(diskName)
        else:
            log(f"Error adding {diskName} to {diskGroupName}")
            result[diskGrp['diskGroupName']]['error'] += f"Error adding {diskName} to {diskGroupName}"
            continue
`;

const oracleAsmLibOptimizeScript = `

config_file = "/etc/sysconfig/oracleasm"
result = {}

def restart_oracleasm_service():
    # Check if service is active
    cmd = ["systemctl", "is-active", "oracleasm"]
    is_active_result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        check=False
    )
    if is_active_result.returncode == 0:
        cmd = ["systemctl", "restart", "oracleasm"]
        restart_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=False
        )
        if restart_result.returncode == 0:
            result['success'] = "Oracle ASM service restarted successfully"
            log(f"Oracle ASM service restarted successfully")
        else:
            result['error'] = "Failed to restart Oracle ASM service"
            log(f"Error: Failed to restart Oracle ASM service - {restart_result.stderr}")
    else:
        result['error'] = "Oracle ASM service is not running."
        log(f"Oracle ASM service is not running.")

if os.path.exists(config_file):
    with open(config_file, 'r') as f:
        content = f.read()
    
    if "ORACLEASM_USE_LOGICAL_BLOCK_SIZE=false" in content:
        log(f"Found ORACLEASM_USE_LOGICAL_BLOCK_SIZE=false, changing to true...")
            
        # Create a backup of the original file
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{config_file}.backup.{timestamp}"
        shutil.copy2(config_file, backup_file)
        log(f"Created backup: {backup_file}")
            
        # Use sed to replace only that specific line
        cmd = ["sed", "-i", "s/^ORACLEASM_USE_LOGICAL_BLOCK_SIZE=false/ORACLEASM_USE_LOGICAL_BLOCK_SIZE=true/", config_file]
        command_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=False
        )

        if command_result.returncode == 0:
            log(f"Successfully modified ORACLEASM_USE_LOGICAL_BLOCK_SIZE to true in {config_file}")
            result['success'] = "Successfully modified ORACLEASM_USE_LOGICAL_BLOCK_SIZE to true"
            restart_oracleasm_service()
        else:
            result['error'] = "Failed to modify oracleasm lib config file"
            log(f"Error: Failed to modify file - {command_result.stderr}")
    
    else:
        result['success'] = "ORACLEASM_USE_LOGICAL_BLOCK_SIZE is already set to true, nothing to do."
        log(f"ORACLEASM_USE_LOGICAL_BLOCK_SIZE is already set to true, nothing to do.")

else:
    log(f"oracleasm lib config file does not exist.")
    result['error'] = "oracleasm lib config file does not exist."

print(json.dumps(result))
`;

const oracleAfdOptimizeScript = `

CONF_FILE = "/etc/modprobe.d/oracleafd.conf"
REQ_LINE = "options oracleafd oracleafd_use_logical_block_size=1"
result = {}

def restart_oracleafd_module():
    # Unload & reload the kernel module
    # Check if crsctl exists
    cmd = ["which", "crsctl"]
    crsctl_check = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        check=False
    )
    crsctl_exists = crsctl_check.returncode == 0
    
    if crsctl_exists:
        log(f"Grid Infrastructure detected, stopping Oracle services...")
        # Stop Oracle services first
        cmd = ["crsctl", "stop", "has", "-f"]
        stop_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=False
        )
        
        if stop_result.returncode != 0:
            log(f"Warning: Failed to stop Oracle services: {stop_result.stderr}")
    else:
        log(f"Grid Infrastructure not detected, proceeding without stopping services...")
    cmd = ["lsmod"]
    lsmod_result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        check=False
    )
    if lsmod_result.returncode == 0 and "oracleafd" in lsmod_result.stdout:
        cmd = ["modprobe", "-r", "oracleafd"]
        unload_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=False
        )
        if unload_result.returncode != 0:
            log(f"Warning: Failed to unload oracleafd module: {unload_result.stderr}")
    cmd = ["modprobe", "oracleafd"]
    load_result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        check=False
    )
    if load_result.returncode != 0:
        log(f"Error: Failed to load oracleafd module: {load_result.stderr}")
        result['error'] = f"Failed to reload AFD module: {load_result.stderr}"
    
    # Restart Oracle services if it exists
    if crsctl_exists:
        log(f"Restarting Oracle services...")
        cmd = ["crsctl", "start", "has"]
        start_result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            check=False
        )
        
        if start_result.returncode != 0:
            log(f"Warning: Failed to start Oracle services: {start_result.stderr}")
            result['error'] = f"Failed to start Oracle services: {start_result.stderr}"
        else:
            log(f"Oracle services restarted successfully.")
    
    result['success'] = "AFD driver reloaded successfully with logical-block-size option."
    
cmd = ["modinfo", "oracleafd"]
command_result = subprocess.run(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    universal_newlines=True,
    check=False
)

if command_result.returncode != 0:
    result['error'] = "AFD driver is not installed on this server, nothing to do."
    log(f"AFD driver is not installed on this server, nothing to do.")

if os.path.exists(CONF_FILE):
    with open(CONF_FILE, 'r') as f:
        content = f.read()
    
    if 'oracleafd_use_logical_block_size' in content:
        # option already present, correct it if the value is not 1
        if 'oracleafd_use_logical_block_size=1' not in content:
            # Use regex to replace the parameter value
            cmd = ["sed", "-i", "s/oracleafd_use_logical_block_size=[0-9]\\+/oracleafd_use_logical_block_size=1/", CONF_FILE]
            command_result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                check=False
            )
            
            if command_result.returncode == 0:
                restart_oracleafd_module()
                result['success'] = "Successfully updated oracleafd_use_logical_block_size to 1"
                log(f"Successfully updated oracleafd_use_logical_block_size to 1")
            else:
                result['error'] = f"Failed to update config file: {command_result.stderr}"
                log(f"Error updating config file: {command_result.stderr}")

        else:
            result['success'] = "Parameter already set correctly, nothing to do."
            log(f"Parameter already set correctly in config file, nothing to do.")
    else:
        log(f"Adding parameter to config file")
        with open(CONF_FILE, 'a') as f:
            f.write(f"\\n{REQ_LINE}\\n")
        restart_oracleafd_module()
        result['success'] = "Successfully added oracleafd_use_logical_block_size=1 to conf file"
        log(f"Successfully added oracleafd_use_logical_block_size=1 to config file")
else:
    result['error'] = "Config file oracleafd.conf does not exist."
    log(f"Config file oracleafd.conf does not exist.")


log(f"AFD driver reloaded successfully with logical-block-size option.")
print(json.dumps(result))
`;

// *********************************************** //
// ************ PYTHON TEMPLATES END ************* //
// *********************************************** //
const optimizeStorageConfigParamsOracle = (params: OptimizeStorageParams) => `
#!/bin/bash
${logFileCheck(true)}

sudo -i -u oracle bash <<'ORACLE_SHELL'
${pythonScriptInit(oracleStorageConfigurationPythonTemplate(params), 'wlmdb-oracle-storage-configuration')}
ORACLE_SHELL
`;

const createAndMapLunsForDiskGroups = (
    unOptimizedDiskGroups: UnOptimizedDiskGroups[],
    lunUuids: string[],
    fsxId: string,
    region: string
) => `
#!/bin/bash
${logFileCheck()}
${pythonScriptInit(
    createOntapVols(unOptimizedDiskGroups, lunUuids, fsxId, region),
    'wlmdb-oracle-storage-layout-fix-create-and-map-luns'
)}
`;

const mountLunsToDisks = (diskGroups: UnOptimizedDiskGroups[]) => `
#!/bin/bash
${logFileCheck()}
${pythonScriptInit(mountLunsToDisksScript(diskGroups), 'wlmdb-oracle-storage-layout-fix-mount-luns')}
`;

const addDiskToDiskGroups = (diskGroups: UnOptimizedDiskGroups[]) => `
#!/bin/bash
${logFileCheck(true, 'grid')}
sudo -i -u grid bash <<'ORACLE_SHELL'
export PATH=$PATH:$ORACLE_HOME/bin
export ORACLE_SID=+ASM
${pythonScriptInit(addDiskToDiskGroupsScript(diskGroups), 'wlmdb-oracle-storage-layout-fix-add-disks-to-diskgroups')}
ORACLE_SHELL
`;

const optimizeAsmLibDriftConfigParam = `
#!/bin/bash
${logFileCheck()}
${pythonScriptInit(oracleAsmLibOptimizeScript, 'wlmdb-oracle-asmlib-drift-optimization')}
`;

const optimizeAfdDriftConfigParam = `
#!/bin/bash
${logFileCheck()}
${pythonScriptInit(oracleAfdOptimizeScript, 'wlmdb-oracle-afd-drift-optimization')}
`;

export {
    optimizeStorageConfigParamsOracle,
    createAndMapLunsForDiskGroups,
    mountLunsToDisks,
    addDiskToDiskGroups,
    optimizeAsmLibDriftConfigParam,
    optimizeAfdDriftConfigParam
};
