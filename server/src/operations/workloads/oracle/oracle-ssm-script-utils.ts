const checkCommandStatus = `
    check_status() {
        if [ $? -ne 0 ]; then
        echo "{\\"error\\": \\"$1\\"}"
        exit 0;
        fi
    }
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

    if [ "$storageProtocol" == "iSCSI" ]; then
        lunEndpoint="storage/luns?serial_number=$junctionPath&fields=svm.name"
        response=$(ontap_request 'GET' $lunEndpoint)
        check_status "Failed to fetch LUN endpoint data"

        svmName=$(echo "$response" | jq -r '.records[0].svm.name')
        
        # Extract volume name (part after /vol/ and before the next /)
        mountedVolume=$(echo "$response" | jq -r '.records[0].name | capture("/vol/(?<vol>[^/]+)") | .vol')
        check_status "Failed to extract mounted volume name"
    else
        result=$(ontap_request 'GET' $svmEndpoint)
        check_status "Failed to fetch SVM endpoint data"

        svmResult=$(echo "$result" | jq --arg ip_address "$ipAddress" '
        .records[] |
        select(.ip_interfaces[] | select(.name == "nfs_smb_management_1" and .ip.address == $ip_address)) |
        {name: .name, uuid: .uuid}
        ')
        check_status "Failed to get matching SVM with IP address"

        svmName=$(echo "$svmResult" | jq -r '.name')
        check_status "Failed to extract SVM name"

        volEndpoint="storage/volumes?svm.name=$svmName&nas.path=$junctionPath"
        response=$(ontap_request 'GET' $volEndpoint)
        check_status "Failed to fetch volume endpoint data"

        mountedVolume=$(echo "$response" | jq -r '.records[0].name')
        check_status "Failed to extract mounted volume name"
    fi
`;

const ontapRestApi = `
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)
    check_status "Credentials not found for $filesystemid in SSM Parameter Store. Please ensure the credentials are stored in SSM Parameter Store with the name /netapp/wlmdb/$filesystemid"
     
    # First, replace single quotes with double quotes
    # Second sed is for adding quotes around keys, only if there are no quotes already
    creds=$(echo "$creds" | sed "s/'/\\"/g" | sed 's/\\([^"{},: ]\\+\\):/"\\1":/g')

    fsxusername=$(echo $creds | jq -r '.fsx.username')
    fsxpassword=$(echo $creds | jq -r '.fsx.password')
    
    certsUrl="https://fsx-aws-Certificates.s3.amazonaws.com/bundle-$region.pem"

    # Check for public IP
    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    public_ip=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/public-ipv4)
    if [ -n "$public_ip" ]; then
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
            USE_INSECURE=true
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
    dbSid: string
) => `
    #oracle protection script
 
    ${getMappedOntapDataVolume(fsxnId, region, mountIp, junctionPath, protocol)}

    endpoint="storage/volumes?fields=snapshot_count&name=$mountedVolume&svm=$svmName"
    ontapProtectionData=$(ontap_request 'GET' $endpoint)
    check_status "Failed to fetch protection data"

    ${isOracleNativeProtectionEnabled(dbSid)}
    result=$(printf '{ "ontapProtectionDetails": %s, "isNativeProtectionEnabled": "%s" }' "$ontapProtectionData" "$is_native_protection_enabled")
    echo $result
`;

const ORACLE_PERFORMANCE_METRICS = (dbSid: string) => `
oracleSid="${dbSid}"

result=$(sudo -i -u oracle bash <<EOF
    set -e
    export ORACLE_SID="$oracleSid"
    sqlplus -S / as sysdba
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

const getOracleInstanceData = `
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

    get_instance_details() {
        local ORACLE_SID="$1"
        if [ "$isDefaultAuth" == "true" ]; then

            sudo -i -u oracle bash <<EOF
                export ORACLE_SID="$ORACLE_SID"
                sqlplus -S / as sysdba
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

const isOracleNativeProtectionEnabled = (dbSid: string) => `
    oracleSid="${dbSid}"
    areBackupSetsAvailable () {
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$oracleSid"
            sqlplus -S / as sysdba
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
            sqlplus -S / as sysdba
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

    ${defaultAuthDetectModule}

    if [ "$isDefaultAuth" == "true" ]; then
        backup_sets=$(areBackupSetsAvailable)
        backup_pieces=$(areBackupPiecesAvailable)

        is_native_protection_enabled="false"
        if [[ "$backup_sets" == "true" ]] || [[ "$backup_pieces" == "true" ]]; then
            is_native_protection_enabled="true"
        fi
    else
        # If default auth is not used, we cannot check for native protection status.
        is_native_protection_enabled="undefined"
    fi
`;

const validateOracleInstanceConnectivity = (ec2InstanceId: string, dbSid: string) => `
    ec2InstanceId="${ec2InstanceId}"
    oracleSid="${dbSid}"
    oracleSid_temp="${dbSid}_temp"

    # Initialize result object if not already initialized
    if [ -z "$resultObject" ]; then
        resultObject='{ "instances": [], "fsxResults": [], modulesInstallationResults: [] }'
    fi
    
    instanceCreds=$(aws ssm get-parameter --name "/netapp/wlmdb/$ec2InstanceId" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)
    oracleInstances=$(echo "$instanceCreds" | jq -c '.oracle')
    matchingOracleInstance=$(echo "$oracleInstances" | jq -c --arg sid "$oracleSid_temp" '.[] | select(.oracleinstancename == $sid)')
    username=$(echo "$matchingOracleInstance" | jq -r '.username')
    password=$(echo "$matchingOracleInstance" | jq -r '.password')

    get_instance_db_version() {
        sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$oracleSid"
            sqlplus -S $username/$password as sysdba
            WHENEVER SQLERROR EXIT SQL.SQLCODE
            SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
            SELECT version FROM v\\$instance;
EOF
    }

    dbVersion=$(get_instance_db_version)
    if [ $? -ne 0 ]; then
        result="{\\"oracleInstanceConnectivity\\": false, \\"oracleError\\": \\"Failed to connect to Oracle instance $oracleSid\\", \\"oracleInstanceName\\": \\"$oracleSid\\"}"
    else
        result="{\\"oracleInstanceConnectivity\\": true, \\"oracleInstanceName\\": \\"$oracleSid\\", \\"oracleEdition\\": \\"$dbVersion\\"}"
    fi
    # Add result to instances array inside resultObject
    resultObject=$(echo "$resultObject" | jq --argjson res "$result" '.instances += [$res]')
`;

const validateOracleInstanceFsxConnectivity = (fsxnId: string, region: string) => `
    filesystemid="${fsxnId}"
    region="${region}"
    
    ${checkCommandStatus}

    # Initialize result object if not already initialized
    if [ -z "$resultObject" ]; then
        resultObject='{ "instances": [], "fsxResults": [], modulesInstallationResults: [] }'
    fi

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
    check_oracle_module_availability() {
        local isAwsCliInstalled="false"
        local isJqInstalled="false"

        if command -v aws >/dev/null 2>&1; then
            isAwsCliInstalled="true"
        fi

        if command -v jq >/dev/null 2>&1; then
            isJqInstalled="true"
        fi

        result="{\\"isAwsCliInstalled\\": \\"$isAwsCliInstalled\\", \\"isJqInstalled\\": \\"$isJqInstalled\\"}"
        echo $result
    }
`;

const installOracleDependentModules = (signedUrls: string[], modulesToInstall: string) => `

    if [ -z "$signedUrls" ]; then
        echo "Signed URL is empty. Cannot install $moduleName."
        exit 1
    fi

    awsCliSignedUrl="${signedUrls[0]}"
    jqSignedUrl="${signedUrls[1]}"
    makeSignedUrl="${signedUrls[2]}"
    moduleNames=("\${${modulesToInstall}[@]}")

    installationResults="["

    for moduleName in "\${moduleNames[@]}"; do
        if [ "$moduleName" == "AWS CLI" ]; then
            if [ "$isAwsCliInstalled" == "true" ]; then
                successMsg="AWS CLI already installed"
            else
                curl -sS -fSL "$awsCliSignedUrl" -o awscliv2.tar.gz
                download_dir=$(pwd)
                if [ $? -ne 0 ]; then
                    errorMsg="Failed to download AWS CLI from $awsCliSignedUrl"
                else
                    tar -xzf awscliv2.tar.gz
                    sudo ./aws/install
                    if [ $? -ne 0 ]; then
                        errorMsg="Failed to install AWS CLI"
                        cd $download_dir
                        rm -rf awscliv2.tar.gz aws
                    else
                        successMsg="AWS CLI installed"
                    fi
                fi
            fi
            installationResults="$installationResults{\\"success\\": \\"$successMsg\\", \\"error\\": \\"$errorMsg\\"},"

        elif [ "$moduleName" == "JQ" ]; then

            if [ "$isJqInstalled" == "true" ]; then
                successMsg="JQ already installed"
            else
                curl -sS -fSL "$jqSignedUrl" -o jq-1.8.0.tar.gz
                download_dir=$(pwd)
                if [ $? -ne 0 ]; then
                    errorMsg="Failed to download JQ from $jqSignedUrl"
                else
                    tar -xzf jq-1.8.0.tar.gz
                    if ! command -v make >/dev/null 2>&1; then
                        curl -sS -fSL "$makeSignedUrl" -o make-4.4.1.tar.gz
                        tar -xzf make-4.4.1.tar.gz
                        cd make-4.4.1/
                        ./configure --disable-dependency-tracking
                        sh build.sh
                        sudo mv make /usr/local/bin/
                        cd $download_dir
                    fi
                    cd jq-1.8.0/
                    ./configure --disable-dependency-tracking
                    make && sudo make install
                    if [ $? -ne 0 ]; then
                        errorMsg="Failed to install JQ"
                        cd $download_dir
                        rm -rf jq-1.8.0.tar.gz jq-1.8.0
                    else
                        successMsg="JQ installed"
                    fi
                fi
            fi
            installationResults="$installationResults{\\"success\\": \\"$successMsg\\", \\"error\\": \\"$errorMsg\\"},"
        else
            errorMsg="Unknown module: $moduleName"
            installationResults="$installationResults{\\"success\\": \\"\\", \\"error\\": \\"$errorMsg\\"},"
        fi
    done

    # Remove trailing comma and close array
    installationResults="\${installationResults%,}]"

    if [[ "$resultObject" =~ \\"modulesInstallationResults\\":\\ \\[\\] ]]; then
        resultObject="\${resultObject/\\"modulesInstallationResults\\": \\[\\]/\\"modulesInstallationResults\\": \\$installationResults}"
    else
        currentResults=$(echo "\\$resultObject" | grep -o '"modulesInstallationResults": \\[[^]]*' | sed 's/"modulesInstallationResults": \\[//')
        newResults="\${currentResults},\${installationResults:1:\${#installationResults}-2}" # remove [ and ] from installationResults
        resultObject=$(echo "\\$resultObject" | sed "s/\\"modulesInstallationResults\\": \\[[^]]*\\]/\\"modulesInstallationResults\\": [\\$newResults]/")
    fi
`;

const checkAndInstallRequiredOracleDependentModules = (signedUrls: string[]) => `

        if [ -z "$resultObject" ]; then
            resultObject='{ "instances": [], "fsxResults": [], "modulesInstallationResults": [] }'
        fi

        ${checkOracleModuleAvailability}
    
        modulesAvailability=$(check_oracle_module_availability)
    
        isAwsCliInstalled=$(echo "$modulesAvailability" | grep -o '"isAwsCliInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
        isJqInstalled=$(echo "$modulesAvailability" | grep -o '"isJqInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
        
        modulesToInstall=()
        if [ "$isAwsCliInstalled" != "true" ]; then
            modulesToInstall+=("AWS CLI")
        fi
        if [ "$isJqInstalled" != "true" ]; then
            modulesToInstall+=("JQ")
        fi
        if [ \${#modulesToInstall[@]} -eq 0 ]; then
            installationResults="[{\\"success\\": \\"All required modules are already installed\\", \\"error\\": \\"\\"}]"
            resultObject=$(echo "$resultObject" | jq --argjson res "$installationResults" '.modulesInstallationResults += $res')
        else 
            ${installOracleDependentModules(signedUrls, 'modulesToInstall')}
        fi
`;

export {
    getOracleProtectionData,
    ORACLE_PERFORMANCE_METRICS,
    getOracleInstanceData,
    validateOracleInstanceConnectivity,
    validateOracleInstanceFsxConnectivity,
    checkOracleModuleAvailability,
    installOracleDependentModules,
    checkAndInstallRequiredOracleDependentModules
};
