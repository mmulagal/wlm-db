const checkCommandStatus = `
    check_status() {
        if [ $? -ne 0 ]; then
        echo "$1"
        exit 1;
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
        
        # svmName=$(echo "$response" | grep -o '"svm":[^{]*{[^}]*"name":"[^"]*"' | sed 's/.*"name":"\\([^"]*\\)".*/\\1/')
        # Extract volume name (part after /vol/ and before the next /)
        # mountedVolume=$(echo "$response" | grep -o '"name":"\\/vol\\/[^/]*\\/[^"]*"' | sed 's/.*\\/vol\\/\\([^/]*\\)\\/.*/\\1/')
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
        # svmName=$(echo "$result" | grep -o '"name":"[^"]*"' | head -1 | sed 's/.*"name":"\\([^"]*\\)".*/\\1/')
        check_status "Failed to extract SVM name"

        volEndpoint="storage/volumes?svm.name=$svmName&nas.path=$junctionPath"
        response=$(ontap_request 'GET' $volEndpoint)
        check_status "Failed to fetch volume endpoint data"

        mountedVolume=$(echo "$response" | jq -r '.records[0].name')
        # mountedVolume=$(echo "$response" | grep -o '"name":"\\/vol\\/[^/]*\\/[^"]*"' | sed 's/.*\\/vol\\/\\([^/]*\\)\\/.*/\\1/')
        check_status "Failed to extract mounted volume name"
    fi
`;

const ontapRestApi = `
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value"  --output text)
     
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
    #!/bin/bash
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
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) <= 1 THEN 'Excellent (<=1 ms)'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 5 THEN 'Very Good (<5 ms)'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 10 THEN 'Good (<10 ms)'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 20 THEN 'Poor (<20 ms)'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 100 THEN 'Bad (<100 ms)'
            WHEN (SELECT avg_io_latency_ms FROM overall_latency) < 500 THEN 'Very Bad (<500 ms)'
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

    get_instance_details() {
        local ORACLE_SID="$1"
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
    }

    RESULTS="["  # start of the JSON array
    FIRST=1      # flag to determine the first object
    for sid in $SIDS; do
        # Check if the instance is running by checking for its PMON process.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            echo "Instance $sid is not active. Skipping."
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

    backup_sets=$(areBackupSetsAvailable)
    backup_pieces=$(areBackupPiecesAvailable)

    is_native_protection_enabled="false"
    if [[ "$backup_sets" == "true" ]] || [[ "$backup_pieces" == "true" ]]; then
        is_native_protection_enabled="true"
    fi
`;

export { getOracleProtectionData, ORACLE_PERFORMANCE_METRICS, getOracleInstanceData };
