import { CLOUDFLARE_DNS_IP } from '../../../utils/consts';
import { LINUX_LOG_DIRECTORY } from '../../continuous-optimization/oracle/consts';

type ontapRequestParams = {
    fsxId?: string;
    region: string;
    apiEndpoint: string;
    apiQueryFields?: string;
    apiQueryFilter?: string;
    apiBody?: string;
    instances?: {
        name: string;
        fsxId: string;
        volumes?: string[];
    }[];
};

const checkCommandStatus = `
    check_status() {
        if [ $? -ne 0 ]; then
        echo "{\\"error\\": \\"$1\\"}"
        exit 0;
        fi
    }
`;

const getOracleHomePath = (dbSid: string) => `
    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi
    sid="${dbSid}"
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    if [ -z "$oratab_entries" ]; then
        echo "No entries found in /etc/oratab."
        exit 0
    fi 

    while IFS=: read -r sid home; do
        if [ "$sid" == "$1" ]; then
            echo "$home"
            exit 0;
            break
        fi
    done <<< "$oratab_entries"
    exit 1
`;

const getMappedOntapDataVolume = (
    fsxnId: string,
    region: string,
    mountIp: string,
    mountPath: string,
    protocol: string
) => `
    ${checkCommandStatus}
    filesystemid="${fsxnId}"
    region="${region}"
    ipAddress="${mountIp}"
    junctionPath="${mountPath}"
    storageProtocol="${protocol}"

    svmEndpoint='svm/svms?fields=ip_interfaces'

    if ! command -v aws &> /dev/null; then
        echo "aws command not found. Please install the AWS CLI."
        exit 1
    fi

    ${ontapRestApi}
    ${bashJsonUtils}


    if [ "$storageProtocol" == "iSCSI" ]; then
        encodedJunctionPath=$(url_encode "$junctionPath")
        lunEndpoint="storage/luns?serial_number=$encodedJunctionPath&fields=uuid,name,svm.name,svm.uuid,location.volume.name,location.volume.uuid"
        response=$(ontap_request 'GET' $lunEndpoint)
        check_status "Failed to fetch LUN endpoint data"

        lunId=$(extract_nested_value "$response" "records[0].uuid")
        lunName=$(extract_nested_value "$response" "records[0].name")
        svmName=$(extract_nested_value "$response" "records[0].svm.name")
        svmId=$(extract_nested_value "$response" "records[0].svm.uuid")
        mountedVolume=$(extract_nested_value "$response" "records[0].location.volume.name")
        mountedVolumeId=$(extract_nested_value "$response" "records[0].location.volume.uuid")
        
        check_status "Failed to extract mounted volume name"
    else
        result=$(ontap_request 'GET' $svmEndpoint)
        check_status "Failed to fetch SVM endpoint data"

        svmName=$(echo "$result" | awk -v ip="$ipAddress" '
            /ip_interfaces/ { in_interfaces = 1 }
            in_interfaces && /"ip"/ && /"address"/ && $0 ~ ip {
                # Found matching IP, now find the parent SVM name
                found = 1
            }
            found && /"name"/ && !/ip_interfaces/ && !/interface/ {
                match($0, /"name"[[:space:]]*:[[:space:]]*"([^"]*)"/, arr)
                if (arr[1]) {
                    print arr[1]
                    exit
                }
            }')
        
        svmId=$(echo "$result" | awk -v ip="$ipAddress" '
            /ip_interfaces/ { in_interfaces = 1 }
            in_interfaces && /"ip"/ && /"address"/ && $0 ~ ip {
                found = 1
            }
            found && /"uuid"/ && !/ip_interfaces/ && !/interface/ {
                match($0, /"uuid"[[:space:]]*:[[:space:]]*"([^"]*)"/, arr)
                if (arr[1]) {
                    print arr[1]
                    exit
                }
            }')

        volEndpoint="storage/volumes?svm.name=$svmName&nas.path=$junctionPath"
        response=$(ontap_request 'GET' $volEndpoint)
        check_status "Failed to fetch volume endpoint data"

        mountedVolume=$(extract_nested_value "$response" "records[0].name")
        mountedVolumeId=$(extract_nested_value "$response" "records[0].uuid")
        check_status "Failed to extract mounted volume name"
    fi
`;

const ontapRestApi = `
    # Function to make ONTAP REST API requests
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)
    check_status "Credentials not found for $filesystemid in SSM Parameter Store. Please ensure the credentials are stored in SSM Parameter Store with the name /netapp/wlmdb/$filesystemid"
     
    # First, replace single quotes with double quotes
    # Second sed is for adding quotes around keys, only if there are no quotes already
    creds=$(echo "$creds" | sed "s/'/\\"/g" | sed 's/\\([^"{},: ]\\+\\):/"\\1":/g')

    # Parse FSx credentials using sed
    fsxusername=$(echo "$creds" | sed -n 's/.*"fsx"[[:space:]]*:[[:space:]]*{[^}]*"username"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
    fsxpassword=$(echo "$creds" | sed -n 's/.*"fsx"[[:space:]]*:[[:space:]]*{[^}]*"password"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')

    
    certsUrl="https://fsx-aws-Certificates.s3.amazonaws.com/bundle-$region.pem"

    # Check for public network
    if ping -c 1 -W 1 ${CLOUDFLARE_DNS_IP} > /dev/null 2>&1; then
        # Public network: download the certificate
        if [ ! -f /tmp/fsx_bundle.pem ]; then
            curl -sS -o /tmp/fsx_bundle.pem "$certsUrl"
        fi
        cert_option="--cacert /tmp/fsx_bundle.pem"
    else
        # Private network: use --insecure
        cert_option="--insecure"
    fi
 
    ontap_request () {
        management_ip=management.$filesystemid.fsx.$region.amazonaws.com
        if ! ping -c 1 -W 2 "$management_ip" > /dev/null 2>&1; then
            management_ip=$(aws fsx describe-file-systems --file-system-id $filesystemid --region $region --query "FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]" --output text)
            cert_option="--insecure"
        fi
        auth=$(printf '%s:%s' $fsxusername $fsxpassword | base64)
        method=$1
        endpoint=$2
 
        if [ "$3" != "" ]; then
            request_body="--json $3"
        fi
 
        args=(
            --silent
            --show-error
            --header "Authorization: Basic $auth"
            --request $method
            $cert_option
            --location https://$management_ip/api/$endpoint
            $request_body
        )

        return_result=$(curl "\${args[@]}")
        echo $return_result
    }
`;

const getOracleProtectionData = (
    fsxnId: string,
    region: string,
    mountIp: string,
    junctionPath: string,
    protocol: string,
    dbSid: string,
    ec2InstanceId: string
) => `
    #oracle protection script
 
    literalJunctionPath='${junctionPath}'
    ${getMappedOntapDataVolume(fsxnId, region, mountIp, '$literalJunctionPath', protocol)}

    endpoint="storage/volumes?fields=snapshot_count&name=$mountedVolume&svm=$svmName"
    ontapProtectionData=$(ontap_request 'GET' $endpoint)
    check_status "Failed to fetch protection data"

    ${isOracleNativeProtectionEnabled(ec2InstanceId, dbSid)}
    result=$(printf '{ "ontapProtectionDetails": %s, "isNativeProtectionEnabled": "%s" }' "$ontapProtectionData" "$is_native_protection_enabled")
    echo $result
`;

const ORACLE_PERFORMANCE_METRICS = (ec2InstanceId: string, dbSid: string) => `
oracleSid="${dbSid}"
ec2InstanceId="${ec2InstanceId}"

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}

result=$(sudo -i -u oracle bash <<EOF
    set -e
    export ORACLE_SID="$oracleSid"
    $sqlplus_command
    WHENEVER SQLERROR EXIT SQL.SQLCODE
    SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
    SET LINESIZE 500
    SET TRIMOUT ON
    SET TRIMSPOOL ON

    WITH io_stats AS (
    SELECT
        (SELECT value FROM v\\$sysstat WHERE name = 'physical reads') AS num_of_reads,
        (SELECT value FROM v\\$sysstat WHERE name = 'physical writes') AS num_of_writes
    FROM dual
    ),
    db_block AS (
        SELECT value AS db_block_size FROM v\\$parameter WHERE name = 'db_block_size'
    ),
    restart_time AS (
        SELECT startup_time FROM v\\$instance
    ),
    time_since_restart AS (
        -- SYSDATE - startup_time returns days; multiply by 86400 to obtain seconds.
        SELECT (SYSDATE - startup_time) * 86400 AS seconds_since_restart FROM restart_time
    ),
    read_latency AS (
        SELECT
            SUM(time_waited) AS total_read_wait_time,
            SUM(total_waits) AS total_read_waits
        FROM v\\$system_event
        WHERE event IN ('db file sequential read', 'db file scattered read')
    ),
    write_latency AS (
    SELECT
        SUM(time_waited) AS total_write_wait_time,
        SUM(total_waits) AS total_write_waits
    FROM v\\$system_event
    WHERE event = 'db file parallel write'
    ),
    overall_latency AS (
    SELECT NVL(ROUND(((rl.total_read_wait_time + wl.total_write_wait_time) /
        NULLIF((rl.total_read_waits + wl.total_write_waits), 0)) * 10, 2), 0) AS avg_io_latency_ms
    FROM read_latency rl, write_latency wl
    )
    SELECT JSON_OBJECT(
        'READ_IOPS' VALUE ROUND((num_of_reads) / seconds_since_restart, 2),
        'WRITE_IOPS' VALUE ROUND((num_of_writes) / seconds_since_restart, 2),
        'READ_THROUGHPUT' VALUE ROUND((num_of_reads * db_block_size) / seconds_since_restart / 1000000, 3),
        'WRITE_THROUGHPUT' VALUE ROUND((num_of_writes * db_block_size) / seconds_since_restart / 1000000, 3),
        'READ_LATENCY' VALUE 0,
        'WRITE_LATENCY' VALUE 0,
        'SERVER_IO_LATENCY' VALUE (SELECT avg_io_latency_ms FROM overall_latency),
        'assessment' VALUE (
        SELECT CASE
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) IS NULL THEN 'N/A'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) <= 1 THEN 'Excellent ( <=1 ms )'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 5 THEN 'Very Good ( <5 ms )'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 10 THEN 'Good ( <10 ms )'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 20 THEN 'Poor ( <20 ms )'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 100 THEN 'Bad ( <100 ms )'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 500 THEN 'Very Bad ( <500 ms )'
            ELSE 'Awful (>=500 ms)'
        END FROM dual
        )
    ) AS result
    FROM io_stats, db_block, time_since_restart;
    EXIT;
EOF
)

    if [ $? -ne 0 ]; then
        echo "Error: Failed to get Oracle performance metrics"
        exit 0
    fi
    echo $result
`;

const defaultAuthDetectModule = `
    is_default_auth() {
        local ORACLE_SID="$1"
        local result
        result=$(sudo -i -u oracle bash <<EOF
                export ORACLE_SID="$ORACLE_SID"
                sqlplus -S / as sysdba 2>/dev/null <<EOSQL
                WHENEVER SQLERROR EXIT SQL.SQLCODE
                SET HEADING OFF
                SET FEEDBACK OFF
                SET VERIFY OFF
                SET PAGESIZE 0
                SELECT 'OK' FROM dual;
                EXIT;
EOSQL
EOF
)
        if echo "$result" | grep -q "^OK"; then
            echo "true"
        else
            echo "false"
        fi
}
`;

const bashJsonUtils = `
    # Function to extract JSON value by key
    extract_json_value() {
        local json="$1"
        local key="$2"
        echo "$json" | sed -n 's/.*"'$key'"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p'
    }

    # Function to extract JSON value (handles numbers and strings)
    extract_json_any_value() {
        local json="$1"
        local key="$2"
        echo "$json" | sed -n 's/.*"'$key'"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p' | sed 's/^"\\|"$//g'
    }

    # Function to extract nested JSON value like records[0].uuid
    extract_nested_value() {
        local json="$1"
        local path="$2"
        
        if [[ "$path" == "records[0]."* ]]; then
            local key=\${path#records[0].}
            # Extract first record from records array
            local first_record=$(echo "$json" | sed -n '/\\"records\\"[[:space:]]*:[[:space:]]*\\[/{:a;N;/}[[:space:]]*]/!ba;p}' | sed -n '/{/,/}/p')
            extract_json_value "$first_record" "$key"
        else
            extract_json_value "$json" "$path"
        fi
    }

    # URL encode function
    url_encode() {
        local string="$1"
        local strlen=\${#string}
        local encoded=""
        local pos c o
        
        for (( pos=0 ; pos<strlen ; pos++ )); do
            c=\${string:$pos:1}
            case "$c" in
                [-_.~a-zA-Z0-9] ) o="\${c}" ;;
                * ) printf -v o '%%%02X' "'$c" ;;
            esac
            encoded+="\${o}"
        done
        echo "$encoded"
    }
`;

const oracleUserAuthLoginCommand = `
    get_oracle_user_auth_login_command() {
        local oracleSid="$1"
        local ec2InstanceId="$2"

        ${bashJsonUtils}

        instanceCreds=$(aws ssm get-parameter --name "/netapp/wlmdb/$ec2InstanceId" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)

        # Extract oracle array from JSON
        oracle_section=$(echo "$instanceCreds" | sed -n '/"oracle"[[:space:]]*:[[:space:]]*\\[/,/\\]/p')
        
        # Find matching oracle instance by oracleinstancename
        username=""
        password=""
        
        # Extract the specific oracle instance that matches the SID
        matching_instance=$(echo "$oracle_section" | sed -n '/oracleinstancename.*'$oracleSid'/,/}/p')
        
        if [ -n "$matching_instance" ]; then
            username=$(extract_json_value "$matching_instance" "username")
            password=$(extract_json_value "$matching_instance" "password")
        fi
        
        # Convert username to lowercase
        usernameLowercase=$(echo "$username" | tr '[:upper:]' '[:lower:]')
        if [ -z "$username" ] || [ -z "$password" ] || [ "$username" == "null" ] || [ "$password" == "null" ]; then
            oracleCredsAvailable="false"
        else
            oracleCredsAvailable="true"
            if [ "$usernameLowercase" == "sys" ]; then
                # For SYS user, we need to use AS SYSDBA
                sqlplus_command="sqlplus -S $username/$password as sysdba"
            else
                sqlplus_command="sqlplus -S $username/$password"
            fi
        fi
        echo "$sqlplus_command|$oracleCredsAvailable"
    }
`;

const getOracleDefaultOrUserAuthCommand = (ec2InstanceId: string, dbSid: string) => `
    oracleSid="${dbSid}"
    ec2InstanceId="${ec2InstanceId}"

    ${defaultAuthDetectModule}
    isDefaultAuth=$(is_default_auth "$oracleSid")

    if [ "$isDefaultAuth" == "true" ]; then
        sqlplus_command="sqlplus -S / as sysdba"
    elif [ "$isDefaultAuth" == "false" ]; then
        # If default auth is not used, we need to fetch the credentials from SSM.
        ${oracleUserAuthLoginCommand}
        
        result=$(get_oracle_user_auth_login_command "$oracleSid" "$ec2InstanceId")
        sqlplus_command=$(echo "$result" | cut -d'|' -f1)
        oracleCredsAvailable=$(echo "$result" | cut -d'|' -f2)
    else
        echo "Error: isDefaultAuth is undefined"
        exit 1
    fi
`;

const getOracleInstanceData = (ec2InstanceId: string) => `
    # oracle instance data script
    ec2InstanceId="${ec2InstanceId}"
    oracleCredsAvailable="false" 
    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi

    # Parse /etc/oratab, ignoring comment lines (#), lines starting with (+) and blank lines
    SIDS=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')

    if [ -z "$SIDS" ]; then
        echo "No SIDs found in /etc/oratab."
        exit 0
    fi

    ${defaultAuthDetectModule}
    ${oracleUserAuthLoginCommand}

    get_instance_details() {
        local ORACLE_SID="$1"
        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then

            sudo -i -u oracle bash <<EOF
                export ORACLE_SID="$ORACLE_SID"
                $sqlplus_command
                    SET HEADING OFF
                    SET LINESIZE 500
                    SELECT JSON_OBJECT(
                            'instance_id' value INSTANCE_NUMBER,
                            'instance_name' value INSTANCE_NAME,
                            'host_name' value HOST_NAME,
                            'version' value VERSION,
                            'instance_state' value STATUS
                        ) AS instance_info
                    FROM V\\$INSTANCE;
EOF
        else
            # instance name & id are same as ORACLE_SID, hostname is not available in /etc/oratab.
            # version is not available in /etc/oratab, so setting it to undefined. checking pgrep -f "ora_pmon_$sid" earlier to ensure the instance is running.

            local result="{\\"instance_name\\": \\"$ORACLE_SID\\", \\"instance_state\\": \\"OPEN\\", \\"version\\": \\"undefined\\", \\"instance_id\\": \\"$ORACLE_SID\\", \\"hostname\\": \\"undefined\\"}"
            echo $result
        fi
    }

    RESULTS="["  # start of the JSON array
    FIRST=1      # flag to determine the first object
    for sid in $SIDS; do
        # Check if the instance is running by checking for its PMON process.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        isDefaultAuth=$(is_default_auth "$sid")
        if [ "$isDefaultAuth" == "true" ]; then
            sqlplus_command="sqlplus -S / as sysdba"
        elif [ "$isDefaultAuth" == "false" ]; then
            # If default auth is not used, check if user auth credentials are available.
            result=$(get_oracle_user_auth_login_command "$sid" "$ec2InstanceId")
            sqlplus_command=$(echo "$result" | cut -d'|' -f1)
            oracleCredsAvailable=$(echo "$result" | cut -d'|' -f2)
        else
            continue
        fi

        { 
            INSTANCE_DETAILS=$(get_instance_details "$sid") 
        } || { 
            echo "Failed to get instance details for $sid"
            continue
        }
        JSON_OBJ="{\\"sid\\":\\"$sid\\", \\"instance_details\\": $INSTANCE_DETAILS }"
        if [ $FIRST -eq 1 ]; then
            RESULTS+="$JSON_OBJ"
            FIRST=0
        else
            RESULTS+=", $JSON_OBJ"
        fi
    done
    RESULTS+="]"  # end of the JSON array
    echo "$RESULTS"
`;

const isOracleNativeProtectionEnabled = (ec2InstanceId: string, dbSid: string) => `
    oracleSid="${dbSid}"
    ec2InstanceId="${ec2InstanceId}"
    oracleCredsAvailable="false"

    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}

    areBackupSetsAvailable () {
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            select case 
                when exists (select 1 from v\\$backup_set) then 'true' 
                else 'false' 
                end as has_rows
            from dual;
EOF
    }

    areBackupPiecesAvailable () {
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="${dbSid}"
            $sqlplus_command
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            select case 
                    when exists (
                        select 1 
                        from v\\$backup_piece 
                        where completion_time > sysdate - 30
                    ) 
                    then 'true' 
                    else 'false'
                end as has_rows
            from dual;
EOF
    }


    if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
        backup_sets=$(areBackupSetsAvailable)
        backup_pieces=$(areBackupPiecesAvailable)

        is_native_protection_enabled="false"
        if [[ "$backup_sets" == "true" ]] || [[ "$backup_pieces" == "true" ]]; then
            is_native_protection_enabled="true"
        fi
    else
        # If default auth isn't enabled or User Auth credentials aren't available, we cannot check for native protection status.
        is_native_protection_enabled="undefined"
    fi
`;

const initializeResultObject = `
    # Initialize result object if not already initialized
    if [ -z "$resultObject" ]; then
        resultObject='{ "instances": [], "fsxResults": [], "modulesInstallationResults": [], "missingOracleUserPermissions": [], "missingModules": [], "asmResult": "" }'
    fi
`;

const validateOracleInstanceConnectivity = (ec2InstanceId: string, dbSid: string) => `
    ec2InstanceId="${ec2InstanceId}"
    oracleSid="${dbSid}"
    oracleSid_temp="${dbSid}_temp"

    ${oracleUserAuthLoginCommand}
    if [ "$isAwsCliInstalled" == "true" ] && [ "$isJqInstalled" == "true" ]; then
        result=$(get_oracle_user_auth_login_command "$oracleSid_temp" "$ec2InstanceId")
        sqlplus_command=$(echo "$result" | cut -d'|' -f1)

        is_instance_connectivity_possible() {
            local cmd="\${sqlplus_command/sqlplus -S/sqlplus -S -L}"
            sudo -i -u oracle bash <<EOF
                set -e
                export ORACLE_SID="$oracleSid"
                $cmd
EOF
        }


        get_instance_db_version() {
            sudo -i -u oracle bash <<EOF
                set -e
                export ORACLE_SID="$oracleSid"
                $sqlplus_command
                WHENEVER SQLERROR EXIT SQL.SQLCODE
                SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
                SELECT version FROM v\\$instance;
EOF
        }

        oracleError="null"
        dbVersion="null"
        if is_instance_connectivity_possible >/dev/null 2>&1; then
            isInstanceConnectivityPossible="true"
        else
            isInstanceConnectivityPossible="false"
            oracleError="Failed to connect to Oracle instance, please ensure that the credentials are correct and the Oracle instance is running."
        fi

        if [ "$isInstanceConnectivityPossible" == "true" ]; then
            dbVersion=$(get_instance_db_version)
            if [ $? -ne 0 ]; then
                dbVersion="null"
                oracleError="Failed to fetch db version from Oracle instance"
            fi
        fi
        
        if [ "$isInstanceConnectivityPossible" == "false" ]; then
            result="{\\"oracleInstanceConnectivity\\": false, \\"oracleInstanceName\\": \\"$oracleSid_temp\\", \\"oracleEdition\\": \\"$dbVersion\\", \\"oracleError\\": \\"$oracleError\\"}"
        else
            result="{\\"oracleInstanceConnectivity\\": true, \\"oracleInstanceName\\": \\"$oracleSid\\", \\"oracleEdition\\": \\"$dbVersion\\", \\"oracleError\\": \\"$oracleError\\"}"
        fi
        # Add result to instances array inside resultObject
        resultObject=$(echo "$resultObject" | jq --argjson res "$(echo "$result" | jq '.')" '.instances += [$res]')
    fi
`;

const validateOracleInstanceFsxConnectivity = (fsxnId: string, region: string) => `
    filesystemid="${fsxnId}"
    region="${region}"
    
    ${checkCommandStatus}
    ${initializeResultObject}
    ${ontapRestApi}

    result=$(ontap_request 'GET' '/cluster?fields=version')
    if [ $? -ne 0 ] || [ -z "$result" ] || echo "$result" | grep -q 'error'; then
        fsxResult="{\\"ontapconnectivity\\": false, \\"ontaperror\\": \\"ONTAP connectivity check failed or returned error.\\", \\"fsxId\\": \\"${fsxnId}\\"}"
    else
        fsxResult="{\\"ontapconnectivity\\": true, \\"fsxId\\": \\"${fsxnId}\\"}"
    fi
    # Add fsxResult to fsxResults array inside resultObject
    resultObject=$(echo "$resultObject" | jq --argjson res "$fsxResult" '.fsxResults += [$res]')
`;

const checkOracleModuleAvailability = `
    is_module_installed() {
        local module="$1"
        local path
        path=$(command -v "$module" 2>/dev/null)
        if [ -n "$path" ] && [ -x "$path" ]; then
            # If symlink, check target
            if [ -L "$path" ]; then
                local target
                target=$(readlink -f "$path")
                if [ ! -f "$target" ] || [ ! -x "$target" ]; then
                    echo false
                    return
                fi
            fi
            # Try to run --version or -v
            if "$module" --version >/dev/null 2>&1 || "$module" -v >/dev/null 2>&1; then
                echo true
                return
            fi
        fi
        echo false
    }

    check_python_module_availability() {
        # echo "true"  if the *lowest* Python on $PATH is 3.6 or newer, "false" otherwise.

        declare -A versions          # set of version strings we discover

        # 1. Collect every Python interpreter in $PATH
        IFS=: read -ra path_dirs <<< "$PATH"
        for dir in "\${path_dirs[@]}"; do
            [[ -d $dir ]] || continue
            for exe in "$dir"/python*; do
                [[ -e $exe ]] || continue                     # glob may not match
                [[ -x $exe && ! -d $exe && $exe != *config ]] || continue
                ver=$("$exe" -V 2>/dev/null | awk '{print $2}')   # "Python 3.x.y" → 3.x.y
                [[ -n $ver ]] && versions["$ver"]=1
            done
        done

        # 2. Abort early if we found nothing
        (( \${#versions[@]} == 0 )) && { echo false; exit; }

        # 3. Determine the *smallest* version string
        min_version=$(printf '%s\n' "\${!versions[@]}" | sort -V | head -n1)

        # 4. Compare that minimum with 3.6
        if [[ $min_version =~ ^([0-9]+)\\.([0-9]+) ]]; then
            major=\${BASH_REMATCH[1]}
            minor=\${BASH_REMATCH[2]}

            if (( major > 3 )); then
                echo true
            elif (( major == 3 && minor >= 6 )); then
                echo true
            else
                echo false
            fi
        else
            # could not parse the version string
            echo false
        fi

    }

    check_oracle_module_availability() {
        isJqInstalled=$(is_module_installed jq)
        isAwsCliInstalled=$(is_module_installed aws)
        isPythonInstalled=$(check_python_module_availability)
        result="{\\"isAwsCliInstalled\\": \\"$isAwsCliInstalled\\", \\"isJqInstalled\\": \\"$isJqInstalled\\", \\"isPythonInstalled\\": \\"$isPythonInstalled\\"}"
        echo $result
    }
`;

const determinePlatform = `
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS_NAME="$ID"
            OS_VERSION="$VERSION_ID"
        else
            errorMsg="Unable to detect OS for Python RPM installation."
        fi
`;

const installOracleDependentModules = (signedUrls: string[], modulesToInstall: string) => `
    
    signedUrlsLen=${signedUrls.length}
    if [ $signedUrlsLen -eq 0 ]; then
        echo "Signed URL is empty. Cannot install $moduleName."
        exit 1
    fi

    awsCliSignedUrl="${signedUrls[0]}"
    jqSignedUrl="${signedUrls[1]}"
    makeSignedUrl="${signedUrls[2]}"
    pythonSignedUrls=(${signedUrls.map(url => `"${url}"`).join(' ')})
    moduleNames=("\${${modulesToInstall}[@]}")

    installationResults="["

    for moduleName in "\${moduleNames[@]}"; do
        if [ "$moduleName" == "AWS CLI" ]; then
            if [ "$isAwsCliInstalled" == "true" ]; then
                successMsg="AWS CLI already installed."
            else
                download_dir=$(pwd)
                curl -sS -fSL "$awsCliSignedUrl" -o awscliv2.tar.gz
                if [ $? -ne 0 ]; then
                    errorMsg="Failed to download AWS CLI from $awsCliSignedUrl."
                else
                    tar -xzf awscliv2.tar.gz > /dev/null 2>&1
                    sudo ./aws/install > /dev/null 2>&1
                    if [ $? -ne 0 ]; then
                        errorMsg="Failed to install AWS CLI."
                        cd $download_dir
                        sudo rm -rf awscliv2.tar.gz aws
                    else
                        successMsg="AWS CLI installed."
                        isAwsCliInstalled=true
                    fi
                fi
            fi
            installationResults="$installationResults{\\"success\\": \\"$successMsg\\", \\"error\\": \\"$errorMsg\\"},"

        elif [ "$moduleName" == "JQ" ]; then

            if [ "$isJqInstalled" == "true" ]; then
                successMsg="JQ already installed."
            else
                download_dir=$(pwd)
                curl -sS -fSL "$jqSignedUrl" -o jq-1.8.0.tar.gz
                if [ $? -ne 0 ]; then
                    errorMsg="Failed to download JQ from $jqSignedUrl."
                else
                    tar -xzf jq-1.8.0.tar.gz > /dev/null 2>&1
                    isMakeInstalled=$(is_module_installed make)
                    if [ "$isMakeInstalled" ]; then
                        curl -sS -fSL "$makeSignedUrl" -o make-4.4.1.tar.gz
                        tar -xzf make-4.4.1.tar.gz > /dev/null 2>&1
                        cd make-4.4.1/
                        sudo ./configure --disable-dependency-tracking > /dev/null 2>&1
                        sudo sh build.sh > /dev/null 2>&1
                        if [ $? -ne 0 ]; then
                            isMakeInstalled=false
                        fi
                        sudo mv make /usr/bin/
                        isMakeInstalled=true
                        cd $download_dir
                    fi
                    cd jq-1.8.0/
                    sudo ./configure --disable-dependency-tracking > /dev/null 2>&1
                    (sudo make > /dev/null 2>&1) && (sudo make install > /dev/null 2>&1)
                    if [ $? -ne 0 ]; then
                        errorMsg="Failed to install JQ."
                        cd $download_dir
                        rm -rf jq-1.8.0.tar.gz jq-1.8.0
                    else
                        successMsg="JQ installed."
                        isJqInstalled=true
                    fi
                fi
            fi
            installationResults="$installationResults{\\"success\\": \\"$successMsg\\", \\"error\\": \\"$errorMsg\\"},"
        elif [ "$moduleName" == "Python3" ]; then
            pythonRpmUrl=""
            for url in "\${pythonSignedUrls[@]}"; do
                filename=$(basename "$url" | cut -d'?' -f1)  # Remove query parameters
                case "$OS_NAME" in
                    "rhel")
                        if [[ "$filename" =~ rhel.*python.*\\.tar\\.gz$ ]]; then
                            pythonRpmUrl="$url"
                            break
                        fi
                        ;;
                    "sles")
                        if [[ "$filename" =~ suse.*python.*\\.tar\\.gz$ ]]; then
                            # Check version compatibility
                            if [[ "$OS_VERSION" =~ ^15 && "$filename" =~ suse15 ]]; then
                                pythonRpmUrl="$url"
                                break
                            fi
                        fi
                        ;;
                esac
            done

            if [ -z "$pythonRpmUrl" ]; then
                errorMsg="No matching Python RPM found for OS: $OS_NAME $OS_VERSION"
                installationSuccessful=false
            else
                download_dir=$(pwd)
                # Create a dedicated folder for Python downloads
                python_download_dir="/tmp/python_install_$$"
                mkdir -p "$python_download_dir"
                cd "$python_download_dir"

                pythonTarFile=$(basename "$pythonRpmUrl" | cut -d'?' -f1)

                # Download and extract Python RPMs
                curl -sS -fSL "$pythonRpmUrl" -o "$pythonTarFile"
                if [ $? -ne 0 ]; then
                    errorMsg="Failed to download Python RPMs from $pythonRpmUrl."
                    installationSuccessful=false
                else
                    tar -xzf "$pythonTarFile" > /dev/null 2>&1
                    if [ $? -ne 0 ]; then
                        errorMsg="Failed to extract Python RPM archive."
                        installationSuccessful=false
                    else
                        if ls *.rpm >/dev/null 2>&1; then
                            # RPMs extracted directly to current directory
                            sudo rpm -ivh --replacepkgs *.rpm > /dev/null 2>&1
                            if [ $? -ne 0 ]; then
                                errorMsg="Failed to install Python RPMs. There may be missing dependencies. Please check the system logs and install required dependencies before retrying."
                                installationSuccessful=false
                            else
                                successMsg="Python3 installed from RPMs."
                                isPythonInstalled=true
                                installationSuccessful=true
                            fi
                        else
                            errorMsg="RPM files not found after extraction."
                            installationSuccessful=false
                        fi
                    fi
                    # Cleanup - go back to original directory and remove download folder
                    cd "$download_dir"
                    sudo rm -rf "$python_download_dir"
                fi
            fi  # End of: if [ -z "$pythonRpmUrl" ]
            installationResults="$installationResults{\\"success\\": \\"$successMsg\\", \\"error\\": \\"$errorMsg\\"},"
        else
            errorMsg="Unknown module: $moduleName."
            installationResults="$installationResults{\\"success\\": \\"\\", \\"error\\": \\"$errorMsg\\"},"
        fi
    done

    # Remove trailing comma and close array
    installationResults="\${installationResults%,}]"

    if [[ "$resultObject" =~ \\"modulesInstallationResults\\":\\ \\[\\] ]]; then
        resultObject="\${resultObject/\\"modulesInstallationResults\\": \\[\\]/\\"modulesInstallationResults\\": \\"$installationResults\\"}"
    else
        currentResults=$(echo "\\$resultObject" | grep -o '"modulesInstallationResults": \\[[^]]*' | sed 's/"modulesInstallationResults": \\[//')
        newResults="\${currentResults},\${installationResults:1:\${#installationResults}-2}" # remove [ and ] from installationResults
        resultObject=$(echo "\\$resultObject" | sed "s/\\"modulesInstallationResults\\": \\[[^]]*\\]/\\"modulesInstallationResults\\": [\\$newResults]/")
    fi
`;

const checkAndInstallRequiredOracleDependentModules = (signedUrls: string[]) => `
        ${checkOracleModuleAvailability}
    
        modulesAvailability=$(check_oracle_module_availability)
    
        isAwsCliInstalled=$(echo "$modulesAvailability" | grep -o '"isAwsCliInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
        isJqInstalled=$(echo "$modulesAvailability" | grep -o '"isJqInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
        isPythonInstalled=$(echo "$modulesAvailability" | grep -o '"isPythonInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')

        modulesToInstall=()
        missingModules="["
        if [ "$isAwsCliInstalled" != "true" ]; then
            modulesToInstall+=("AWS CLI")
            missingModules+="\\"awsCli\\","
        fi
        if [ "$isJqInstalled" != "true" ]; then
            modulesToInstall+=("JQ")
            missingModules+="\\"jq\\","
        fi

        if [ "$isPythonInstalled" != "true" ]; then
            missingModules+="\\"python\\","
        fi

        missingModules="\${missingModules%,}]" # remove trailing comma and close array
        if [ \${#modulesToInstall[@]} -eq 0 ]; then
            installationResults="[{\\"success\\": \\"All required modules are already installed\\", \\"error\\": \\"\\"}]"
            resultObject=$(echo "$resultObject" | jq --argjson res "$(echo "$installationResults" | jq '.')" '.modulesInstallationResults += $res')
        else 
            ${installOracleDependentModules(signedUrls, 'modulesToInstall')}
        fi

        resultObject=$(echo "$resultObject" | jq --argjson res "$(echo "$missingModules" | jq '.')" '.missingModules = $res')
`;

const installPythonOnLinuxHost = (pythonSignedUrls?: string[]) => `
    ${checkOracleModuleAvailability}    
    modulesAvailability=$(check_oracle_module_availability)
    isPythonInstalled=$(echo "$modulesAvailability" | grep -o '"isPythonInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')

    if [ "$isPythonInstalled" == "true" ]; then
        installationSuccessful=true
    else
        ${determinePlatform}
        # ping cloudflare to check internet connectivity
        if ping -c 1 -W 1 ${CLOUDFLARE_DNS_IP} > /dev/null 2>&1; then
            if [ "$OS_NAME" == "rhel" ]; then
                sudo yum install -y python3.12 > /dev/null 2>&1
            elif [[ "$OS_NAME" == "sles" && "$OS_VERSION" =~ ^15 ]]; then
                sudo zypper install -y python311 > /dev/null 2>&1
            fi
            if [ $? -ne 0 ]; then
                installationSuccessful=false
            else
                installationSuccessful=true
            fi
        else
            modulesToInstall=('Python3')
            ${installOracleDependentModules(pythonSignedUrls ?? [], 'modulesToInstall')}
        fi
    fi
    results="{\\"installationSuccessful\\": \\"$installationSuccessful\\"}"
    echo $results
`;

const trendGraphCreateScriptForOracle = (dbSid: string, ec2InstanceId: string) => `
    oracleSid="${dbSid}"
    ec2InstanceId="${ec2InstanceId}"

    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}

    jsonPayload=$(sudo -i -u oracle bash <<EOF
        set -e
        export ORACLE_SID="$oracleSid"
        $sqlplus_command
        WHENEVER SQLERROR EXIT SQL.SQLCODE
        SET HEADING OFF FEEDBACK OFF PAGESIZE 0 VERIFY OFF ECHO OFF TRIMSPOOL ON
        SET LINESIZE 32767
        SET LONG  1000000
        SET TRIMOUT ON
        SET TRIMSPOOL ON

        WITH
            sysMetric AS (
                SELECT
                    MAX(CASE WHEN METRIC_NAME='CPU Usage Per Sec'                 THEN VALUE END)   AS maxCpu,
                    MAX(CASE WHEN METRIC_NAME='Physical Read IO Requests Per Sec' THEN VALUE END)   AS readIops,
                    MAX(CASE WHEN METRIC_NAME='Physical Write IO Requests Per Sec' THEN VALUE END)  AS writeIops,
                    MAX(CASE WHEN METRIC_NAME='Physical Read Bytes Per Sec'       THEN VALUE END)/1024 AS readKBps,
                    MAX(CASE WHEN METRIC_NAME='Physical Write Bytes Per Sec'      THEN VALUE END)/1024 AS writeKBps
                FROM V\\$SYSMETRIC_HISTORY
                WHERE METRIC_NAME IN (
                'CPU Usage Per Sec',
                'Physical Read IO Requests Per Sec',
                'Physical Write IO Requests Per Sec',
                'Physical Read Bytes Per Sec',
                'Physical Write Bytes Per Sec'
                )
                AND BEGIN_TIME >= SYSDATE - INTERVAL '24' HOUR
            ),
            cpuCores AS (
                SELECT
                    MAX(CASE WHEN stat_name='NUM_CPU_CORES' THEN VALUE END) AS cores
                FROM V\\$OSSTAT
            ),
            ioStats AS (
                SELECT
                    NVL(SUM(readtim),0)/DECODE(NVL(SUM(phyrds),0),0,1,SUM(phyrds))   AS avgReadLat,
                    NVL(SUM(writetim),0)/DECODE(NVL(SUM(phywrts),0),0,1,SUM(phywrts)) AS avgWriteLat
                FROM V\\$FILESTAT
            )
            SELECT JSON_OBJECT(
                'maxCpuSec'    VALUE sysMetric.maxCpu,
                'numCores'     VALUE cpuCores.cores,
                'maxReadIops'  VALUE sysMetric.readIops,
                'maxWriteIops' VALUE sysMetric.writeIops,
                'maxReadKbps'  VALUE sysMetric.readKBps,
                'maxWriteKbps' VALUE sysMetric.writeKBps,
                'avgReadLatMs' VALUE ioStats.avgReadLat,
                'avgWriteLatMs' VALUE ioStats.avgWriteLat
            )
            FROM sysMetric
            CROSS JOIN cpuCores
            CROSS JOIN ioStats;
            EXIT;
EOF
)

    maxCpuSec=$(   echo "\${jsonPayload}" | jq -r '.maxCpuSec'   )
    numCores=$(    echo "\${jsonPayload}" | jq -r '.numCores'    )
    maxReadIops=$( echo "\${jsonPayload}" | jq -r '.maxReadIops' )
    maxWriteIops=$(echo "\${jsonPayload}" | jq -r '.maxWriteIops')
    maxReadKbps=$( echo "\${jsonPayload}" | jq -r '.maxReadKbps' )
    maxWriteKbps=$(echo "\${jsonPayload}" | jq -r '.maxWriteKbps')
    avgReadLatMs=$(echo "\${jsonPayload}" | jq -r '.avgReadLatMs')
    avgWriteLatMs=$(echo "\${jsonPayload}" | jq -r '.avgWriteLatMs')
    

    if [[ -z "\${numCores}" || \${numCores} -le 0 ]]; then
        echo "WARNING: invalid numCores='\${numCores}', defaulting to 1"
        numCores=1
    fi

    cpuUtilPct=$(echo "scale=2; \${maxCpuSec} / \${numCores}" | bc -l)

    namespace="netapp/wlmdb/performance"
    metricArgs=()

    addMetric(){
        local name=$1 val=$2 unit=$3
        metricArgs+=( "MetricName=\${name},Value=\${val},Unit=\${unit},Dimensions=[{Name=databaseHostId,Value=${ec2InstanceId}},{Name=sqlInstanceName,Value=${dbSid}}]" )
    }

    addMetric "cpuUsed"         "$(printf "%.2f" "\${cpuUtilPct}")"    "Percent"
    addMetric "readIops"        "$(printf "%.0f" "\${maxReadIops}")"   "Count"
    addMetric "writeIops"       "$(printf "%.0f" "\${maxWriteIops}")"  "Count"
    addMetric "readThroughput"  "$(printf "%.2f" "\${maxReadKbps}")"   "Kilobytes/Second"
    addMetric "writeThroughput" "$(printf "%.2f" "\${maxWriteKbps}")"  "Kilobytes/Second"
    addMetric "readLatency"     "$(printf "%.2f" "\${avgReadLatMs}")"  "Milliseconds"
    addMetric "writeLatency"    "$(printf "%.2f" "\${avgWriteLatMs}")" "Milliseconds"
    
    aws cloudwatch put-metric-data --namespace "\${namespace}" --metric-data "\${metricArgs[@]}"

    exit 0
  `;

const checkIfValidLinuxUser = (ec2InstanceId: string) => `
    ec2InstanceId="${ec2InstanceId}"

    instanceCreds=$(aws ssm get-parameter --name "/netapp/wlmdb/$ec2InstanceId" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)
    asmCredList=$(echo "$instanceCreds" | jq -c '.asm')

    asmresult="{\\"valid\\": false}"
    if [ -z "$asmCredList" ] || [ "$asmCredList" == "null" ]; then
        asmresult="{ \\"valid\\": false, \\"error\\": \\"No ASM credentials found.\\" }"
        echo $asmresult
        exit 1
    fi

    count=$(echo "$asmCredList" | jq 'length')
    for i in $(seq 0 $((count - 1))); do
        USERNAME=$(echo "$asmCredList" | jq -r ".[$i].username")
        PASSWORD=$(echo "$asmCredList" | jq -r ".[$i].password")
        INSTANCENAME=$(echo "$asmCredList" | jq -r ".[$i].oracleinstancename")

        if [[ "$INSTANCENAME" != *temp* ]]; then
            continue
        fi
        if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
            asmresult="{\\"valid\\": false, \\"error\\": \\"Missing username or password\\"}"
        else
            if command -v python3 >/dev/null 2>&1; then
                py_output=$(python3 -c "$(cat <<EOF
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

import spwd
import crypt
import sys

def check_password(username, password):
    try:
        shadow_entry = spwd.getspnam(username)
    except KeyError:
        print('{\\"valid\\": false, \\"error\\": \\"User not found.\\"}')
        return

    hashed_password = shadow_entry.sp_pwdp
    if hashed_password in ['*', '!', 'x']:
        print('{\\"valid\\": false, \\"error\\": \\"Account is locked or no password set.\\"}')
        return

    if crypt.crypt(password, hashed_password) == hashed_password:
        print('{\\"valid\\": true}')
    else:
        print('{\\"valid\\": false, \\"error\\": \\"Invalid password.\\"}')

if __name__ == '__main__':
    check_password(sys.argv[1], sys.argv[2])
EOF
)" "$USERNAME" "$PASSWORD")
                asmresult=$py_output
            else
                # Python3 is not available, assuming the credentials are valid
                asmresult="{\\"valid\\": true}"
            fi
        fi

        # Check if valid is true, break the flow
        is_valid=$(echo "$asmresult" | jq -r '.valid')
        if [ "$is_valid" == "true" ]; then
            break
        fi
    done
    resultObject=$(echo "$resultObject" | jq --argjson res "$(echo "$asmresult" | jq '.')" '.asmResult = $res')
`;

// Oracle User Permissions Detection Module
// Required privileges with a user in oracle, Permissions 3rd and 4th are only required for CDB instances.
// • CREATE SESSION — allows the user account to log in to sql shell.
// • SELECT_CATALOG_ROLE or SELECT ANY DICTIONARY CONTAINER = ALL   — read-only access to all dictionary views in every container.
// • SET CONTAINER CONTAINER = ALL       — enables ALTER SESSION SET CONTAINER = … for every PDB and the root.
//
//   Visibility setting (row filter for CDB views)
// • SET CONTAINER_DATA = ALL CONTAINER = CURRENT — required to get storage details & protection details for PDBs

const loadOracleUserPermissionsDetectionModule = `
    is_create_session_granted() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT 'OK' FROM dual;
            EXIT;
EOF
        )

        echo "$result" | grep -q "^OK" && echo "true" || echo "false"
}

    check_for_select_catalog_permission() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END
            FROM session_roles
            WHERE role = 'SELECT_CATALOG_ROLE';
            EXIT;
EOF
        )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
    }

    check_for_set_container_permission() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END
            FROM session_privs
            WHERE privilege = 'SET CONTAINER';
            EXIT;
EOF
        )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
}

    # returns true if the permission SET CONTAINER_DATA = ALL CONTAINER = CURRENT is granted to the user.
    # this is used to check if the user has permission to access data in all containers (i.e pdbs) in a CDB instance.
    check_for_container_data_permission() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT CASE WHEN COUNT(DISTINCT con_id) > 1 THEN 'true' ELSE 'false' END
            FROM cdb_objects;
            EXIT;
EOF
    )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
}

    is_cdb_instance() {
        local result=$(sudo -i -u oracle bash <<EOF
                set -e
                export ORACLE_SID="$oracleSid"
                $sqlplus_command
                WHENEVER SQLERROR EXIT SQL.SQLCODE
                SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
                SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END
                FROM v\\$database
                WHERE cdb = 'YES';
                EXIT;
EOF
        )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
    }

    check_for_alter_system_permission() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END
            FROM session_privs
            WHERE privilege = 'ALTER SYSTEM';
            EXIT;
EOF
        )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
}

    # Checks if there is more than one PDB in READ WRITE or READ ONLY state.
    # Note: PDB$SEED is always in READ ONLY state and is included in the count.
    # This function effectively checks if there is at least one user-created PDB in READ WRITE or READ ONLY state.
    check_for_pdb_read_write_state() {
        local result=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            $sqlplus_command
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT CASE WHEN COUNT(*) > 1 THEN 'true' ELSE 'false' END
            FROM v\\$pdbs
            WHERE open_mode = 'READ WRITE' or open_mode = 'READ ONLY';
            EXIT;
EOF
        )
        echo "$result" | grep -q "true" && echo "true" || echo "false"
}
`;

const checkRequiredOracleUserPermissions = (ec2InstanceId: string, dbSid: string) => `
    ec2InstanceId="${ec2InstanceId}"
    oracleSid="${dbSid}"
    oracleSid_temp="${dbSid}_temp"

    ${initializeResultObject}
    ${oracleUserAuthLoginCommand}
    ${loadOracleUserPermissionsDetectionModule}
    result=$(get_oracle_user_auth_login_command "$oracleSid_temp" "$ec2InstanceId")
    sqlplus_command=$(echo "$result" | cut -d'|' -f1)

    # Extract username from sqlplus_command
    username=$(sed -n 's/.* -S \\([^/]*\\)\\/.*/\\1/p' <<< "$sqlplus_command")
    isCreateSessionRoleGranted=$(is_create_session_granted)
    remediationMissingPermissions="[]"
    errors="[]"

    if [ "$username" == "sys" ]; then
        # SYS user has all privileges, so we don't need to check for permissions.
        missingPermissions="[]"
        remediationMissingPermissions="[]"
    elif [ "$isCreateSessionRoleGranted" == "false" ]; then
        missingPermissions="[\\"CREATE SESSION\\"]"
        remediationMissingPermissions="[\\"ALTER SYSTEM\\"]"
    else
        isSelectCatalogRoleGranted=$(check_for_select_catalog_permission)
        isAlterSystemGranted=$(check_for_alter_system_permission)

        if [ "$isAlterSystemGranted" == "false" ]; then
            remediationMissingPermissions="[\\"ALTER SYSTEM\\"]"
        fi

        isCDBInstance=$(is_cdb_instance)

        if [ $isCDBInstance == "true" ]; then
            # Perform actions specific to CDB instances
            isSetContainerRoleGranted=$(check_for_set_container_permission)
            isContainerDataPermissionGranted=$(check_for_container_data_permission)
            arePDBsInReadWriteState=$(check_for_pdb_read_write_state)

            missingPermissions="["
            errors="["
            if [ "$isSetContainerRoleGranted" == "false" ]; then
                missingPermissions="$missingPermissions\\"SET CONTAINER ROLE\\","
            fi
            if [ "$isContainerDataPermissionGranted" == "false" ]; then
                missingPermissions="$missingPermissions\\"SET CONTAINER_DATA\\","
                errors="$errors\\"either SET CONTAINER_DATA privilege is not granted or PDBs are not in READ WRITE or READ ONLY state\\","
            elif [ "$isContainerDataPermissionGranted" == "true" ] && [ "$arePDBsInReadWriteState" == "false" ]; then
                errors="$errors\\"Not all PDBs are in READ WRITE or READ ONLY state\\","
            fi

            if [ "$isSelectCatalogRoleGranted" == "false" ]; then
                missingPermissions="$missingPermissions\\"SELECT CATALOG ROLE\\","
            fi
            # Remove trailing comma if any
            missingPermissions="\${missingPermissions%,}]"
            errors="\${errors%,}]"
        else
            # Perform actions specific to non-CDB instances
            if [ "$isSelectCatalogRoleGranted" == "false" ]; then
                missingPermissions="[\\"SELECT CATALOG ROLE\\"]"
            else
                missingPermissions="[]"
            fi
        fi
    fi

    missingOracleUserPermissions="{\\"instanceSid\\": \\"$oracleSid\\", \\"missingPermissions\\": $missingPermissions, \\"remediationMissingPermissions\\": $remediationMissingPermissions, \\"errors\\": $errors}"

    resultObject=$(echo "$resultObject" | jq --argjson permissions "$(echo "$missingOracleUserPermissions" | jq '.')" '.missingOracleUserPermissions += [$permissions]')
`;
const isASMManagedCheck = `
    check_asm_managed() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF;
            SET FEEDBACK OFF;
            SET VERIFY OFF;
            SET PAGESIZE 0;
            SELECT CASE 
                    WHEN COUNT(*) > 0 THEN 'TRUE'
                    ELSE 'FALSE'
                END
            FROM dba_data_files
            WHERE file_name LIKE '+%';
            EXIT;
EOSQL
EOF
}

    is_setup_asm_managed() {
        if pgrep -lf '^asm_pmon_+' >/dev/null 2>&1 ; then
            echo "true"
        else
            echo "false"
        fi
    }
`;

const isStorageASMmanaged = (dbSid: string) => `
    ${isASMManagedCheck}
    isASMManaged='false'
    if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
        if [[ "$(check_asm_managed "${dbSid}"  | tr -d '\n' | tr -d ' ')" == "TRUE" ]]; then
            isASMManaged='true'
        else
            isASMManaged='false'
        fi
    else
        if [[ "$is_setup_asm_managed" == "true" ]]; then  
            isASMManaged='true'
        else
            isASMManaged='false'
        fi
    fi
`;

const GET_ORACLE_SERVER_DETAILS = (oracleSids: string[], ec2InstanceId: string) => `
# Get oracle server details script
oracleSids=(${oracleSids.map(sid => `"${sid}"`).join(' ')})
ec2InstanceId="${ec2InstanceId}"
resultObject="{}"
for oracleSid in "\${oracleSids[@]}"; do
    # Get Oracle server details
${getOracleDefaultOrUserAuthCommand('$ec2InstanceId', '$oracleSid')}
${isStorageASMmanaged('$oracleSid')}
    isDefaultAuth=$(is_default_auth "$oracleSid")

    prettyName=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
    osName=$(grep ^NAME= /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")
    osVersion=$(grep ^VERSION= /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "")

    # Execute all SQL queries in a single connection
    sqlResults=$(sudo -i -u oracle bash <<EOF 2>/dev/null
    export ORACLE_SID="$oracleSid"
    $sqlplus_command <<'EOSQL'
    SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
    SELECT REGEXP_SUBSTR(BANNER, '(Standard|Enterprise) Edition') AS edition, 
        REGEXP_SUBSTR(BANNER, '[0-9]{2}c') AS version 
    FROM v\\$version 
    WHERE BANNER LIKE 'Oracle%';
    SELECT COUNT(*) FROM v\\$session WHERE status = 'ACTIVE';
    SELECT to_char(created, 'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') FROM v\\$database;
    EXIT
EOSQL
EOF
    )

    serverEdition=$(echo "$sqlResults" | sed -n '1p' | xargs 2>/dev/null || echo "")
    serverVersion=$(echo "$sqlResults" | sed -n '2p' | xargs 2>/dev/null || echo "")
    activeConnections=$(echo "$sqlResults" | sed -n '4p' | xargs 2>/dev/null || echo "0")
    creationDate=$(echo "$sqlResults" | sed -n '5p' | xargs 2>/dev/null || echo "")
    activeNode=$ec2InstanceId

    if ! [[ "$activeConnections" =~ ^[0-9]+$ ]]; then
        activeConnections="0"
    fi
    sidResponse=$(jq -n     --arg prettyName "$prettyName"     --arg name "$osName"     --arg version "$osVersion"     --arg serverEdition "$serverEdition"     --arg serverVersion "$serverVersion"     --arg activeNode "$activeNode"     --arg activeConnections "$activeConnections"     --arg creationDate "$creationDate"    --arg isASMManaged "$isASMManaged" '{
        prettyName: $prettyName,
        name: $name,
        version: $version,
        serverEdition: $serverEdition,
        serverVersion: $serverVersion,
        activeNode: $activeNode,
        nodeNames: $activeNode,
        activeConnections: ($activeConnections | tonumber),
        creationDate: $creationDate,
        isASMManaged: $isASMManaged
    }')

    if [ $? -eq 0 ]; then
        resultObject=$(echo "$resultObject" | jq --arg key "$oracleSid" --argjson val "$sidResponse" '. + {($key): $val}')
    else
        echo "Error processing SID $oracleSid"
    fi

done
echo "$resultObject"
`;

const getFsxCredentials = `
def getFsxCredentials(fileSystemId):
    name = f"/netapp/wlmdb/{fileSystemId}"
    try:
        raw = subprocess.check_output(
            [aws_path,"ssm","get-parameter","--name",name,"--with-decryption","--query","Parameter.Value","--output","text"],
            universal_newlines=True
        ).strip()
    except Exception as e:
        log(f"Failed to get FSx credentials: SSM param {name} not found or empty. Exception: {e}")
        return None, f"SSM param {name} not found or empty: {e}"

    txt = re.sub(r"'", '"', raw)
    txt = re.sub(r'([{,])\\s*([a-zA-Z0-9_]+)\\s*:', r'\\1"\\2":', txt)
    try:
        creds = json.loads(txt)
    except Exception:
        log(f"Failed to parse FSx credentials JSON for {fileSystemId}")
        return None, f"Failed to parse FSx credentials for {fileSystemId}"

    return creds.get("fsx"), None
`;

const pythonImports = `
import sys
import os
import datetime
import json
import ssl
import base64
import http.client
import subprocess
import re
import shutil
import time
import stat
import textwrap
from urllib.parse import urlparse
from urllib.request import urlopen, Request, urlretrieve
from urllib.error import HTTPError
from pathlib import Path
`;

const ontapRestApiScript = `
def ontapRestApiRequest(fileSystemId, region, method, url, body=None):
    # Getting auth token
    fsx_creds, error = getFsxCredentials(fileSystemId)
    if error:
        log("Failed to get FSx credentials: error: {error}")
        return None, error

    username = fsx_creds['username']
    password = fsx_creds['password']
    if not username or not password:
        log("FSx credential is empty")
        return None, "FSx credential is empty"

    auth_raw = f"{username}:{password}".encode("utf-8")
    auth_b64 = base64.b64encode(auth_raw).decode("ascii")
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Accept": "application/json",
    }

    cert_option = ""
    cert_url = f"https://fsx-aws-Certificates.s3.amazonaws.com/bundle-{region}.pem"
    cert_path = "/tmp/fsx_bundle.pem"
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "1", "${CLOUDFLARE_DNS_IP}"],
            stdout=subprocess.DEVNULL,
        )
        public_network = result.returncode == 0
    except Exception as e:
        public_network = False
        log(f"Failed to get public network; Exception:{e}")


    if public_network:
        if not os.path.isfile(cert_path):
            try: urlretrieve(cert_url, cert_path)
            except: pass
        cert_option = cert_path

    management_ip = f"management.{fileSystemId}.fsx.{region}.amazonaws.com"
    if os.system(f"ping -c 1 -W 2 {management_ip} > /dev/null 2>&1") != 0:
        management_ip = subprocess.check_output([
            aws_path, "fsx", "describe-file-systems",
            "--file-system-id", fileSystemId,
            "--region", region,
            "--query", "FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]",
            "--output", "text"
        ], universal_newlines=True).strip()
        use_insecure = True
    else:
        use_insecure = False

    if body:
        if isinstance(body, dict):
            body_str = json.dumps(body)
            headers["Content-Type"] = "application/json"
        else:
            body_str = str(body)
    else:
        body_str = None

    try:
        if cert_option and not use_insecure:
            ssl_ctx = ssl.create_default_context(cafile=cert_option)
        else:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE

        url = f"https://{management_ip}/api/{url}"
        parsed_url = urlparse(url)
        path_with_query = parsed_url.path
        if parsed_url.query:
            path_with_query += "?" + parsed_url.query
        conn = http.client.HTTPSConnection(parsed_url.hostname, parsed_url.port or 443, context=ssl_ctx, timeout=10)
        conn.request(method.upper(), path_with_query, body=body_str, headers=headers)
        resp = conn.getresponse()
        raw = resp.read()
        status = resp.status
        log(f"ONTAP rest api response: {status} {resp.reason}")
        if not (200 <= status < 300):
            return None, {
                "error": {
                    "status": f"HTTP {status} {resp.reason}",
                    "message": raw.decode("utf-8", errors="replace")
                }
            }
        ct = resp.getheader("Content-Type", "")
        if "application/json" in ct.lower():
            try:
                return json.loads(raw.decode("utf-8")), None
            except Exception as je:
                return None, f"JSON parse error: {je}"
        else:
            return None, raw.decode("utf-8", errors="replace")
    except Exception as e:
        return None, {"error": str(e)}
    finally:
        try:
            conn.close()
        except:
            pass
`;

const pythonLogger = (logFileName: string) => `
def log(msg):
    LOG_FILE = f"${LINUX_LOG_DIRECTORY}/${logFileName}"
    if not os.path.exists(f"${LINUX_LOG_DIRECTORY}"):
        os.makedirs(f"${LINUX_LOG_DIRECTORY}", exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}\\n") 

log("Starting Python Logging")
`;

const pythonScriptInit = (pythonTemplate: string, fileName: string) => `
export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

$PYTHON_LATEST <<'PYTHON'
${pythonImports}

aws_path = shutil.which("aws") or '/usr/local/bin/aws'

${pythonLogger(fileName)}
${pythonTemplate}
PYTHON
`;

const logFileCheck = (changeOwner = false, user = 'oracle', group = 'oinstall') => `
# Ensure log directory exists
sudo mkdir -p "${LINUX_LOG_DIRECTORY}"
${changeOwner ? `sudo chown ${user}:${group} "${LINUX_LOG_DIRECTORY}"` : ''}
`;

const oracleStorageInfoFromOntapPythonTemplate = (params: ontapRequestParams) => `

${getFsxCredentials}
${ontapRestApiScript}
region = '${params.region}'
apiPath = '${params.apiEndpoint}'
query = '${params.apiQueryFields}'
instances = json.loads('${JSON.stringify(params.instances)}')
visited = {}
final_results = {}

for instance in instances:
    fsx_id = instance.get("fsxId")
    volumes = instance.get("volumes", [])
    name = instance.get("name")
    if not fsx_id or not name:
        continue

    # Build query_filter as uuid=<comma separated volumes>
    query_filter = ""
    if volumes and isinstance(volumes, list) and len(volumes) > 0:
        joined_uuids = ",".join(volumes)
        query_filter = f"uuid={joined_uuids}"

    # Compose full query string
    full_query = query
    if query_filter:
        if full_query:
            full_query = f"{query_filter}&{full_query}"
        else:
            full_query = query_filter

    if fsx_id in visited:
        result = visited[fsx_id]
    else:
        # Fetch credentials and make ONTAP API request
        creds, error = getFsxCredentials(fsx_id)
        if error:
            result = {"error": error}
        else:
            url = f"{apiPath}?{full_query}" if full_query else apiPath
            response, error = ontapRestApiRequest(fsx_id, region, 'GET', url)
            if error:
                result = {"error": error}
            else:
                result = response
        visited[fsx_id] = result

    final_results[name] = result

print(json.dumps(final_results))
`;

const oracleStorageInfoFromOntap = (params: ontapRequestParams) => `
#!/bin/bash
${logFileCheck()}
${pythonScriptInit(oracleStorageInfoFromOntapPythonTemplate(params), 'wlmdb-oracle-storage-information')}
`;

const parseSqlplusOutput = `
# capture the first line of sqlplus output or the first ORA- error encountered
# exit code 0 if no error, 1 if error
parse_sqlplus_output() {
    local sqlplus_out
    if [ $# -eq 0 ]; then
        sqlplus_out=$(cat) || return 1
    else
        sqlplus_out="$1"
        shift
        while [ $# -gt 0 ]; do
            sqlplus_out=$sqlplus_out$'\n'"$1"
            shift
        done
    fi
    if printf '%s' "$sqlplus_out" | grep -q 'ORA-'; then
        local err
        err=$(printf '%s' "$sqlplus_out" | sed -n '/ORA-/ { s/^[[:space:]]*//; s/[[:space:]]*$//; p; q }')
        printf '%s' "$err"
        return 1
    fi
    local output
    output=$(printf '%s' "$sqlplus_out" | sed -n '/[^[:space:]]/ { s/^[[:space:]]*//; s/[[:space:]]*$//; p; q }')
    printf '%s' "$output"
    return 0
}
`;

export {
    getFsxCredentials,
    getOracleProtectionData,
    ORACLE_PERFORMANCE_METRICS,
    getOracleInstanceData,
    validateOracleInstanceConnectivity,
    validateOracleInstanceFsxConnectivity,
    getOracleDefaultOrUserAuthCommand,
    checkOracleModuleAvailability,
    installOracleDependentModules,
    checkAndInstallRequiredOracleDependentModules,
    ontapRestApi,
    checkCommandStatus,
    trendGraphCreateScriptForOracle,
    getMappedOntapDataVolume,
    checkIfValidLinuxUser,
    checkRequiredOracleUserPermissions,
    GET_ORACLE_SERVER_DETAILS,
    oracleUserAuthLoginCommand,
    loadOracleUserPermissionsDetectionModule,
    installPythonOnLinuxHost,
    initializeResultObject,
    pythonScriptInit,
    pythonImports,
    pythonLogger,
    ontapRestApiScript,
    logFileCheck,
    getOracleHomePath,
    oracleStorageInfoFromOntap,
    isASMManagedCheck,
    isStorageASMmanaged,
    parseSqlplusOutput
};
