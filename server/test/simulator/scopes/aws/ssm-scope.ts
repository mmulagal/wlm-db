/* eslint-disable quotes */
// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable */

import {
    GetCommandInvocationCommand,
    SendCommandCommand,
    SSMClient,
    GetParametersByPathCommand,
    GetConnectionStatusCommand,
    PutParameterCommand,
    GetParameterCommand,
    DeleteParametersCommand,
    DescribeInstancePatchStatesCommand,
    DescribeInstancePatchesCommand,
    DescribeAvailablePatchesCommand,
    ListCommandsCommand,
    DescribeInstanceInformationCommand
} from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import {
    HOST_AND_SQL_INFO_PS1,
    CLUSTER_NETWORK_IP_INFO_PS1,
    GET_ACTIVE_DIRECTORY_DETAILS,
    CHECK_POWERSHELL7_AVAILABLE
} from '../../../../src/operations/workloads/mssql/discover-consts';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommands-response.json';
import getCommandInvocationResponse from '../../responses/aws/ssm-getCommand-invocation.json';
import listBedrockRegionsResponse from '../../responses/aws/list-bedrock-regions-response.json';
import listFsxOntapRegionsResponse from '../../responses/aws/list-fsx-ontap-regions.json';
import getConnectionStatusResponse from '../../responses/aws/ssm-connection-status.json';
import putParameterResponse from '../../responses/aws/ssm-put-parameter.json';
import getParameerResponse from '../../responses/aws/ssm-get-parameter.json';
import deleteParametersResponse from '../../responses/aws/ssm-delete-parameters.json';
import describePatchStatesResponse from '../../responses/aws/ssm-describe-patch-states.json';
import describeInstancePatchesResponse from '../../responses/aws/ssm-describe-patches.json';
import describeAvailablePatchesResponse from '../../responses/aws/ssm-describe-available-patches.json';
import listCommandsCommandResponse from '../../responses/aws/list-commands-command.json';
import getSsmInstanceInformationResponse from '../../responses/aws/ssm-instance-information.json';
import { DEFAULT_AWS_REGION } from '../../../utils/consts';
import {
    restGetUtilForOntap,
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_STANDBY_NODE_DRIVE_LIST,
    INSTANCE_DETAILS,
    RESOURCE_UTILIZATION,
    GET_DEFAULT_COLLATION,
    GET_DEFAULT_DRIVES,
    sqlQueryExecution,
    CHECK_SCRIPT_AVAILABILITY_AND_VERSION,
    sqlQueryExecutionWithAuth,
    GET_FQDN,
    GET_NODE_IP_ADDRESS
} from '../../../../src/operations/workloads/mssql/ssm-script-utils';
import {
    SERVER_DETAILS,
    PERFORMANCE_METRICS_WITH_LATENCY,
    INSTANCE_GUID,
    ENTERPRISE_CHECK_QUERY,
    DATABASES_COUNT_V2,
    NATIVE_SQL_BACKUPS,
    DATABASES,
    GET_SANDBOXES,
    SERVER_VERSION_EDITION_DETAILS,
    SQL_BACKUPS
} from '../../../../src/operations/workloads/mssql/queries';
import {
    createVolumeClone,
    getDbMappedOntapVolumes,
    createClonedDb,
    addExtendedProperties,
    cleanUpOntapResources,
    mountPointQuery,
    getStorageSavingsFromOntap,
    detachDbAndRemoveAccessPath,
    deleteExtendedPropertiesScript,
    checkDatabaseIntegrityScript,
    getSnapshotsToClone,
    readExtendedPropertiesOfSandbox,
    getConnectionInfo,
    invokeVirtualMountScript
} from '../../../../src/operations/workloads/mssql/sandbox-scripts';
import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME } from '../../../../src/utils/consts';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT } from '../../../../src/operations/workloads/mssql/drift-assessment-scripts';
import {
    CHECK_MPIO_POLICY,
    REMEDIATE_MPIO_POLICY,
    REMEDIATE_MPIO_ISCSI_SESSIONS,
    MPIO_ISCSI_SESSIONS,
    CHECK_IF_MPIO_INSTALLED,
    ENABLE_MPIO_AND_CONFIGURE,
    MPIO_TIMEOUT
} from '../../../../src/operations/workloads/mssql/mpio-remediation-scripts';
import {
    GET_RUNNING_SQL_SERVERS,
    GET_RSS_CONFIG_DETAILS,
    GET_VCPU_AND_MAXDOP_DETAILS,
    GET_INSTALLED_MSSQL_VERSION,
    GET_INSTALLED_SQL_PATCHES,
    GET_CLUSTER_SNAPSHOT_POLICIES
} from '../../../../src/operations/workloads/mssql/assessment-scripts';
import {
    CHECK_RUNNING_STATUS_WITH_RESTART,
    OPTIMIZE_STORAGE_PARAMS_SCRIPT,
    SET_MAXDOP
} from '../../../../src/operations/workloads/mssql/optimization-scripts';
import { clone, cloneDeep } from 'lodash-es';
import { getPgsqlInstanceData } from '../../../../src/operations/workloads/pgsql/pgsql-ssm-script-utils';
import {
    DATABASES_COUNT,
    LIST_DATABASES,
    PERFORMANCE_METRICS
} from '../../../../src/operations/workloads/pgsql/queries';
import { getSampleCommandResponse, getSampleCommandResponseWithOutput } from '../../../utils/ssm-utils';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../../../../src/operations/workloads/mssql/resiliency-scripts';
import {
    CLUSTER_QUORUM_TYPE,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS
} from '../../../../src/operations/workloads/mssql/high-availability-scripts';

const ssmMock = mockClient(SSMClient);

const cpuParams = {
    commands: [
        `sqlcmd -S "$env:computername" -Q \"SET NOCOUNT ON; set quoted_identifier ON;DECLARE @ts BIGINT;\n                                DECLARE @lastNmin TINYINT;\n                                SET @lastNmin = 1;\n                                SELECT @ts =(SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info); \n                                SELECT TOP(@lastNmin)\n                                        SQLProcessUtilization AS [percentUsed], \n                                        SQLProcessUtilization AS [used],\n                                        SQLProcessUtilization+SystemIdle+(100 - SystemIdle - SQLProcessUtilization) AS [total],\n                                        100-SQLProcessUtilization AS [remaining]\n                                FROM (SELECT record.value('(./Record/@id)[1]','int')AS record_id, \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int')AS [SystemIdle], \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int')AS [SQLProcessUtilization], \n                                [timestamp]      \n                                FROM (SELECT[timestamp], convert(xml, record) AS [record]             \n                                FROM sys.dm_os_ring_buffers             \n                                WHERE ring_buffer_type =N'RING_BUFFER_SCHEDULER_MONITOR'AND record LIKE'%%')AS x )AS y \n                                ORDER BY record_id DESC FOR JSON PATH\" -y 0`
    ]
};
const memeoryParams = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT\n                                    (processmem.physical_memory_in_use_kb * 1024) AS used,\n                                    (sysmem.total_physical_memory_kb * 1024) AS total,\n                                    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n                                    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n                                    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH" -y 0'
    ]
};
const dbCountParams = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id FOR JSON PATH" -y 0'
    ]
};

const dbCountParamasV2 = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], DATABASES_COUNT_V2, false)]
};

const dbSummaryParams1 = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 0 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams2 = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 75 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams3 = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 150 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams4 = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 225 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const noOfConnParams = {
    commands: [
        'sqlcmd -Q "SET NOCOUNT ON; SELECT COUNT(1) AS numberOfConnections FROM sys.dm_exec_sessions WHERE host_process_id is NOT NULL FOR JSON PATH" -y 0'
    ]
};
const serClusterParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT SERVERPROPERTY(\'IsClustered\') as isClustered FOR JSON PATH"'
    ]
};
const serNodesParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT SERVERPROPERTY(\'ComputerNamePhysicalNetBIOS\') as activeNode FOR JSON PATH"'
    ]
};
const clusterNameParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT cluster_name from sys.dm_hadr_cluster FOR JSON PATH"'
    ]
};
const clusterNodesParams = {
    commands: [
        'sqlcmd -Q "SET NOCOUNT ON; SELECT NodeName, is_current_owner FROM sys.dm_os_cluster_nodes FOR JSON PATH" -y 0'
    ]
};

const serStateParams = {
    commands: [
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SET NOCOUNT ON; EXEC master.dbo.xp_servicecontrol 'QUERYSTATE','MSSQLServer'\""
    ]
};
const serVerParams = {
    commands: ['C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT @@version AS serverDetails"']
};
const tablesCountParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Database RetailBanking -Query "SET NOCOUNT ON; SELECT COUNT(DISTINCT name) AS totalCount FROM sys.tables FOR JSON PATH"'
    ]
};
const tablesListParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Database RetailBanking -Query "SET NOCOUNT ON; SELECT \n                        t.NAME AS tableName,\n                        t.type_desc AS tableType,\n                        s.Name AS tableSchema,\n                        SUM(a.total_pages) * 8 * 1024 AS tableSize\n                    FROM \n                        sys.tables t\n                    INNER JOIN      \n                        sys.indexes i ON t.OBJECT_ID = i.object_id\n                    INNER JOIN \n                        sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id\n                    INNER JOIN \n                        sys.allocation_units a ON p.partition_id = a.container_id\n                    LEFT OUTER JOIN \n                        sys.schemas s ON t.schema_id = s.schema_id\n                    GROUP BY \n                        t.Name, s.Name, p.Rows, t.type_desc\n                    ORDER BY \n                        t.Name offset 0 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};
const diskSizeParams = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH" -y 0'
    ]
};

const diskDataParams = {
    commands: [
        'sqlcmd -S "$env:computername" -Q "SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum\n                                FROM sys.master_files mf1)\n                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID\n                                FROM presel pr\n                                WHERE pr.RowNum = 1)\n                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining\n                                FROM roundtwo mf\n                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH" -y 0'
    ]
};
const serGUIDParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name = \'msdb\' FOR JSON PATH"'
    ]
};
const serNameParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT @@SERVERNAME as serverName FOR JSON PATH"'
    ]
};
const serverIOLatencyParams = {
    commands: [
        // eslint-disable-next-line quotes
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SET NOCOUNT ON; WITH DatabaseLatency as (SELECT \n                                            [ServerIOLatency] =\n                                                CASE WHEN (SUM(num_of_reads) = 0 AND SUM(num_of_writes) = 0)\n                                                    THEN 0 ELSE ROUND((CAST (SUM(io_stall) AS FLOAT) / (SUM(num_of_reads) + SUM(num_of_writes))), 2) END\n                                            FROM\n                                                sys.dm_io_virtual_file_stats (NULL,NULL)\n                                            )\n                                            select ServerIOLatency as latency,\n                                            [assessment] = \n                                                    CASE \n                                                        WHEN ServerIOLatency = 0 THEN 'N/A' \n                                                        ELSE \n                                                            CASE WHEN ServerIOLatency <= 1 THEN 'Excellent ( <=1 ms )'\n                                                                 WHEN ServerIOLatency < 5 THEN 'Very good ( <5 ms )'\n                                                                 WHEN ServerIOLatency < 10 THEN 'Good ( <10 ms )'\n                                                                 WHEN ServerIOLatency < 20 THEN 'Poor ( <20 ms )'\n                                                                 WHEN ServerIOLatency < 100 THEN 'Bad ( <100 ms )'\n                                                                 WHEN ServerIOLatency < 500 THEN 'Very bad ( <500 ms )'\n                                                                 WHEN ServerIOLatency >= 500 THEN 'Awful ( >=500 ms )'\n                                                            END \n                                                    END\n                                            from DatabaseLatency\n                                FOR JSON PATH\""
    ]
};

const nativeSqlBackupParams = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], NATIVE_SQL_BACKUPS)]
};

const nativeSqlBackupDatabasesParams = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], SQL_BACKUPS, false)]
};

const getOntapSnapshotCountParams = {
    commands: [
        restGetUtilForOntap(
            'test-fsx2345',
            'test-region',
            '/storage/volumes',
            'uuid=939a4ec9-7c14-11ee-b185-8329e8fcbf44',
            'fields=snapshot_count'
        )
    ]
};

const getStorageParams = {
    commands: [
        "C:\\SSM\\OntapRestGet.ps1 -FSxID test-fsx2345 -FSxRegion test-region -OntapResourceEndpoint 'storage/volumes' -OntapResourceFilter 'tiering.object_tags=\"wlmDeploymentId=undefined\"' -OntapResourceQuery 'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used'"
    ]
};

// const getPerformanceMetrics = {
//     commands: [
//         'sqlcmd -Q "SET NOCOUNT ON; DECLARE @SQLRestartDateTime Datetime\n    DECLARE @TimeInSeconds Float\n    SELECT @SQLRestartDateTime = create_date FROM sys.databases WHERE database_id = 2\n    SET @TimeInSeconds = Datediff(s,@SQLRestartDateTime,GetDate())\n    SELECT   ROUND(CAST(SUM(num_of_reads) AS FLOAT)/@TimeInSeconds,2) AS READ_IOPS\n        , ROUND(CAST(SUM(num_of_writes) AS FLOAT)/@TimeInSeconds,2) AS WRITE_IOPS\n        , ROUND(CAST(SUM(num_of_bytes_read) AS FLOAT)/@TimeInSeconds/1000000,3) AS READ_THROUGHPUT\n        , ROUND(CAST(SUM(num_of_bytes_written) AS FLOAT)/@TimeInSeconds/1000000,3) AS WRITE_THROUGHPUT\n        , CASE WHEN SUM(num_of_reads) = 0 THEN 0 ELSE ROUND((SUM(io_stall_read_ms) / SUM(num_of_reads)), 2) END AS READ_LATENCY\n        , CASE WHEN SUM(num_of_writes) = 0 THEN 0 ELSE ROUND((SUM(io_stall_write_ms) / SUM(num_of_writes)), 2) END AS WRITE_LATENCY\n    FROM sys.dm_io_virtual_file_stats(null,null)  FOR JSON PATH" -y 0'
//     ]
// };

const getPerformanceWithLatencyMetrics = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], PERFORMANCE_METRICS_WITH_LATENCY, false)]
};

const getServerInstallDate = {
    commands: [
        "sqlcmd -Q \"SET NOCOUNT ON; SELECT create_date AS creationDate FROM sys.server_principals WITH (NOLOCK) WHERE name = N'NT AUTHORITY\\SYSTEM' OR name = N'NT AUTHORITY\\NETWORK SERVICE' FOR JSON PATH\" -y 0"
    ]
};

const getServerEdition = {
    commands: [
        "sqlcmd -Q \" SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition') AS ServerEdition, SERVERPROPERTY('IsClustered') as isClustered, SERVERPROPERTY('ComputerNamePhysicalNetBIOS') as activeNode, @@version AS serverDetails, @@SERVERNAME as serverName FOR JSON PATH\" -y 0"
    ]
};

const getHostAndSqlServerInfo = {
    commands: HOST_AND_SQL_INFO_PS1
};

// const getDriveInfo = {
//     commands: [
//         "#Get the list of all used drive letters\n$disks = Get-Disk\n$usedDriveDetails = @()\n$deploymentType = 'FCI'\nforeach ($disk in $disks) {\n    $volume = Get-Partition | Where-Object { $_.DiskNumber -eq $disk.Number } | Get-Volume\n    if ($deploymentType -eq 'FCI') {\n        $labels = Get-ClusterResource | Where-Object { $_.ResourceType -eq \"Physical Disk\" } | Where-Object { $_.Name -eq $volume.FileSystemLabel }\n    }\n\n    $output = [PSCustomObject]@{\n        driveLetter = $volume.DriveLetter\n        availableSize = $volume.SizeRemaining\n        manufacturer = $disk.Manufacturer\n    }\n\n    if ($deploymentType -eq 'FCI') {\n        $output | Add-Member -NotePropertyName \"owner\" -NotePropertyValue $labels.OwnerGroup.Name\n    }\n\n    $usedDriveDetails += $output\n}\n\n$usedDrivesInfoJson = $usedDriveDetails | ConvertTo-Json\nWrite-Host $usedDrivesInfoJson\n\n"
//     ]
// };

const getDefaultDriveLetters = {
    commands: [GET_DEFAULT_DRIVES(DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME, true)]
};

const getActiveNodeDriveDetailsFCI = {
    commands: [GET_ACTIVE_NODE_DRIVE_INFO('FCI')]
};

const getStandbyNodeDriveList = {
    commands: [GET_STANDBY_NODE_DRIVE_LIST]
};

const configureLuns = {
    commands: [
        'C:\\SSM\\Configure-LUNs.ps1 -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataLunSize 1074  -FSxLogLunSize 1074 -LogNew false -DataNew false'
    ]
};

const createDatabase = {
    commands: [
        'C:\\SSM\\Create-Database.ps1 -SQLServer Draculla  -DBName tempdb9  -DataPath J:\\MSSQL\\data\\tempdb9_data.mdf  -LogPath K:\\MSSQL\\data\\tempdb9_log.ldf'
    ]
};

const newDBInitialize = {
    commands: [
        'C:\\SSM\\NewDB_Initialize-Iscsidisk.ps1 -DBName tempdb9  -IsClustered false  -DataDrive J  -LogDrive K -LogNew true -DataNew true'
    ]
};

const cleanUpDB = {
    commands: [
        'C:\\SSM\\Cleanup-ONTAP.ps1 -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataVolumeName wlmdb_sqldata_1708948249  -FSxLogVolumeName wlmdb_sqllog_1708948249 -IGROUP wlmdb_sqligroup_1708791218786'
    ]
};

const checkDBExists = {
    commands: [
        // prettier-ignore
        "sqlcmd -Q \"SET NOCOUNT ON; SELECT name FROM sys.databases WHERE name = 'tempdb18' FOR JSON PATH\" -y 0"
    ]
};

const serverDetails = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], SERVER_DETAILS, false)]
};

const clusterNetwokIpInfo = {
    commands: CLUSTER_NETWORK_IP_INFO_PS1
};

const resourceUtilization = {
    commands: [RESOURCE_UTILIZATION(['MSSQLSERVER'], false)]
};

const getCollationDetails = {
    commands: [GET_DEFAULT_COLLATION('MSSQLSERVER', '$env:computername', false)]
};

const getOntapSandboxVolumeSavingsParams = {
    commands: [getStorageSavingsFromOntap('test-fsx', 'us-east-1', 'netapp_wf_test_account_test_cred')]
};

const getSandboxDetails = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], GET_SANDBOXES, false)]
};

const instanceDetails = {
    commands: [INSTANCE_DETAILS]
};

const instanceDetailsWithFqdnAndIp = {
    commands: [INSTANCE_DETAILS, GET_FQDN, GET_NODE_IP_ADDRESS]
};

const getVolumeLunMappingsCommand = {
    commands: [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')]
};

const cloneVolumeCommand = {
    commands: [
        createVolumeClone(
            'test-fsx',
            'us-east-1',
            JSON.stringify({ volumeName: 'wlmdb_sqldata_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }),
            JSON.stringify({ volumeName: 'wlmdb_sqllog_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }),
            ['source=test-res-id', 'cloned_by=netapp_wf_test_account_test_cred'],
            'target-svm',
            'testdb'
        )
    ]
};

const invokeVirtualMountCommand = {
    commands: [
        invokeVirtualMountScript(
            'test-clone',
            JSON.stringify([
                {
                    filePath: 'D:\\MSSQL\\data\\testdb_data.mdf',
                    folderName: 'D:\\MSSQL\\data',
                    lun: 'lWB44?VEq9vf'
                },
                {
                    filePath: 'E:\\MSSQL\\log\\testdb_log.ldf',
                    folderName: 'E:\\MSSQL\\log',
                    lun: 'lWB44?VEq9ve'
                }
            ]),
            'MSSQLSERVER',
            true,
            'Sandbox'
        )
    ]
};

const createCloneDbCommand = {
    commands: [
        createClonedDb(
            'testdb',
            'MSSQLSERVER',
            '$env:computername',
            ['S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf'],
            ['L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'],
            '',
            '',
            false
        )
    ]
};

const addExtendedPropertiesCommand = {
    commands: [
        addExtendedProperties(
            'testdb',
            'MSSQLSERVER',
            '$env:computername',
            {
                tag: 'demo',
                cloned_by: 'netapp_wf',
                source: 'resource|instance|testdb'
            },
            false
        )
    ]
};

const cleanUpOntapResourcesCommand = {
    commands: [
        cleanUpOntapResources(
            'test-fsx',
            'us-east-1',
            JSON.stringify(['5c1075d2-03a0-11ef-a514-55070fbfcab1', '5ace31ea-03a0-11ef-a514-55070fbfcab1']),
            JSON.stringify([
                'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
            ]),
            'testdb'
        )
    ]
};

const mountPointQueryCommand = {
    commands: [sqlQueryExecution('MSSQLSERVER', '$env:computername', mountPointQuery('test-database'), true)]
};

const getInstanceGuidCommand = { commands: [`sqlcmd -S "$env:computername" -Q "${INSTANCE_GUID}" -y 0`] };

const detachDbAndRemoveAccessPathCommand = {
    commands: [
        detachDbAndRemoveAccessPath(
            'test-db',
            '["123456789", "987654321"]',
            '["S:\\test-db-Data", "L:\\test-db-Log"]',
            '$env:computername'
        )
    ]
};

const deleteExtendedPropertiesCommand = {
    commands: [
        deleteExtendedPropertiesScript(
            'test-db',
            DEFAULT_INSTANCE_NAME,
            '$env:computername',
            ['cloned_by', 'source', 'createdAt', 'updatedAt', 'tag', 'accountId'],
            false
        )
    ]
};

const getSplitEstimateCommand = {
    commands: [
        restGetUtilForOntap(
            'test-fsx',
            'us-east-1',
            '/storage/volumes',
            'uuid=5c1075d2-03a0-11ef-a514-55070fbfcab1|5ace31ea-03a0-11ef-a514-55070fbfcab1',
            'fields=clone.split_estimate'
        )
    ]
};

const getActiveDirectory = {
    commands: [
        '\n  $ErrorActionPreference = "Stop"\n  $responseObject = @{}\n  $scriptStartTime = Get-Date\n  $responseObject[\'activeDirectory\'] = ""\n\n  try {\n    $adDomainName = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).Domain\n    If ($adDomainName -ne "WORKGROUP") {\n      $adIpList = ([System.Net.Dns]::GetHostEntry($adDomainName)).AddressList.IpAddressToString\n      if ($adIpList -IsNot [System.Array]) {\n        $adIpList = @($adIpList)\n      }\n\n      $adObject = New-Object PSObject -Property @{ "domainName" = $adDomainName }\n      $adObject | Add-Member -MemberType NoteProperty -Name "ipAddresses" -Value $adIpList\n      $responseObject[\'activeDirectory\'] = $adObject\n    }\n  } catch {\n    $responseObject[\'failureInfo\'] = $_.Exception.Message\n  } finally {\n    $scriptEndTime = Get-Date\n    $responseObject[\'scriptExecutionTime\'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)\n    Echo $responseObject | ConvertTo-Json -Compress\n  } \n'
    ]
};

const enterpriseFeatureUsageCheck = {
    // prettier-ignore
    commands: [`sqlcmd -S "$env:computername" -Q "${ENTERPRISE_CHECK_QUERY}" -y 0`]
};

const checkDatabaseIntegirty = {
    commands: [checkDatabaseIntegrityScript('test-db', DEFAULT_INSTANCE_NAME, '.', '', false)]
};

const getSnapshotsToCloneCommand = {
    commands: [
        getSnapshotsToClone(
            'test-fsx',
            'us-east-1',
            JSON.stringify(['5c1075d2-03a0-11ef-a514-55070fbfcab1', '5ace31ea-03a0-11ef-a514-55070fbfcab1']),
            '5c1075d2-03a0-11ef-a514-55070fbfcab1',
            'testdb1_clone'
        )
    ]
};

const readExtendedPropertiesCommand = {
    commands: [readExtendedPropertiesOfSandbox('testdb1_clone')]
};

const getConnectionInforCommand = {
    commands: [getConnectionInfo('MSSQLSERVER')]
};

const checkScriptUpdate = {
    commands: [CHECK_SCRIPT_AVAILABILITY_AND_VERSION]
};

const dbSummary = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], DATABASES, false)]
};

const validateMpio = {
    commands: [CHECK_MPIO_POLICY]
};

const setMpioPolicy = {
    commands: [REMEDIATE_MPIO_POLICY]
};

const validateMpioSessionsSsm = {
    commands: [MPIO_ISCSI_SESSIONS]
};

const validateMpioInstallation = {
    commands: [CHECK_IF_MPIO_INSTALLED]
};

const enableMpioAndConfigure = {
    commands: [ENABLE_MPIO_AND_CONFIGURE]
};

const verifyMpioTimeout = {
    commands: [MPIO_TIMEOUT]
};

const pgsqlInstanceInfo = {
    commands: [getPgsqlInstanceData]
};

const rssConfigAssessmentSsm = {
    commands: [GET_RSS_CONFIG_DETAILS()]
};

const checkRunningStatus = {
    commands: [CHECK_RUNNING_STATUS_WITH_RESTART(['SQL Server (SQLSTD1)', 'SQL Server (MSSQLSERVER)'])]
};

const getRunningSqlServers = {
    commands: [GET_RUNNING_SQL_SERVERS()]
};

const getInstalledSQLPatches = {
    commands: [GET_INSTALLED_SQL_PATCHES()]
};

const getSqlServerVersionEditionDetails = {
    commands: [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], SERVER_VERSION_EDITION_DETAILS, false)]
};

const getPS7CheckDetails = {
    commands: CHECK_POWERSHELL7_AVAILABLE
};

const pgsqldbCount = { commands: [DATABASES_COUNT] };

const pgsqlDatabases = { commands: [LIST_DATABASES] };

const pgsqlPerformanceMetrics = { commands: [PERFORMANCE_METRICS] };

const clusterQuorumHeartBeat = {
    commands: [CLUSTER_QUORUM_TYPE, HEARTBEAT_SETTINGS]
};

const optimizeRegex = /#Storage Optimization Script/;
const rescanExtendRegex = /#Rescan and extend the LUN/;
const moveClusterGroupsRegex = /#Move Cluster Groups/;
const checkNodeStatusRegex = /#Check Node Status/;
const getMappedOntapVolumesRegex = /#Get Mapped Ontap Volumes/;
const getStorageAssessmentDataRegex = /#Get Storage Configuration Assessment/;
const getPgsqlStorageSavingsRegex = /#PG SQL Storage Savings/;
const remediateMpioSessions = /#Remediate MPIO iSCSI sessions/;
const getVCPUAndMaxDopDetails = /#Get vCPU and MAXDOP Details/;
const crrAssessmentDataRegex = /#Get CRR details/;
const pgsqlProtectionRegex = /pgsql protection script/;
const fetchMssqlInstanceMtuDetailsRegex = /#Get MSSQL Instance MTU Details/;
const fetchFsxMtuDetailsRegex = /#Get FSx MTU Details/;
const optimizeMtuRegex = /#Optimize Network Interface MTU Settings/;

ssmMock
    .on(SendCommandCommand)
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
    .on(SendCommandCommand, { Parameters: cpuParams })
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
    .on(SendCommandCommand, { Parameters: memeoryParams })
    .resolves(listSendCommandCommandResponse.memoryCommandResponse)
    .on(SendCommandCommand, { Parameters: dbCountParams })
    .resolves(listSendCommandCommandResponse.dbCountCommandResponse)
    .on(SendCommandCommand, { Parameters: dbSummaryParams1 })
    .resolves(listSendCommandCommandResponse.dbSummaryCommandResponse1)
    .on(SendCommandCommand, { Parameters: dbSummaryParams2 })
    .resolves(listSendCommandCommandResponse.dbSummaryCommandResponse2)
    .on(SendCommandCommand, { Parameters: dbSummaryParams3 })
    .resolves(listSendCommandCommandResponse.dbSummaryCommandResponse3)
    .on(SendCommandCommand, { Parameters: dbSummaryParams4 })
    .resolves(listSendCommandCommandResponse.dbSummaryCommandResponse4)
    .on(SendCommandCommand, { Parameters: noOfConnParams })
    .resolves(listSendCommandCommandResponse.noOfConnCommandResponse)
    .on(SendCommandCommand, { Parameters: serClusterParams })
    .resolves(listSendCommandCommandResponse.serClusterCommandResponse)
    .on(SendCommandCommand, { Parameters: serNodesParams })
    .resolves(listSendCommandCommandResponse.serNodesCommandResponse)
    .on(SendCommandCommand, { Parameters: clusterNameParams })
    .resolves(listSendCommandCommandResponse.clusterNameCommandResponse)
    .on(SendCommandCommand, { Parameters: clusterNodesParams })
    .resolves(listSendCommandCommandResponse.clusterNodesCommandResponse)
    .on(SendCommandCommand, { Parameters: serStateParams })
    .resolves(listSendCommandCommandResponse.serStateCommandResponse)
    .on(SendCommandCommand, { Parameters: serVerParams })
    .resolves(listSendCommandCommandResponse.serVerCommandResponse)
    .on(SendCommandCommand, { Parameters: tablesCountParams })
    .resolves(listSendCommandCommandResponse.tablesCountCommandResponse)
    .on(SendCommandCommand, { Parameters: tablesListParams })
    .resolves(listSendCommandCommandResponse.tablesListCommandResponse)
    .on(SendCommandCommand, { Parameters: diskSizeParams })
    .resolves(listSendCommandCommandResponse.diskSizeCommandResponse)
    .on(SendCommandCommand, { Parameters: diskDataParams })
    .resolves(listSendCommandCommandResponse.diskDataCommandResponse)
    .on(SendCommandCommand, { Parameters: serGUIDParams })
    .resolves(listSendCommandCommandResponse.serGUIDCommandResponse)
    .on(SendCommandCommand, { Parameters: serNameParams })
    .resolves(listSendCommandCommandResponse.serNameCommandResponse)
    .on(SendCommandCommand, { Parameters: serverIOLatencyParams })
    .resolves(listSendCommandCommandResponse.serverIoLatencyCommandResponse)
    .on(SendCommandCommand, { Parameters: nativeSqlBackupParams })
    .resolves(listSendCommandCommandResponse.nativeSqlBackupCommandResponse)
    .on(SendCommandCommand, { Parameters: nativeSqlBackupDatabasesParams })
    .resolves(listSendCommandCommandResponse.nativeSqlBackupDatabasesCommandResponse)
    .on(SendCommandCommand, { Parameters: getOntapSnapshotCountParams })
    .resolves(listSendCommandCommandResponse.getOntapSnapshotCommandResponse)
    .on(SendCommandCommand, { Parameters: getStorageParams })
    .resolves(listSendCommandCommandResponse.storageCommandResponse)
    .on(SendCommandCommand, { Parameters: getPerformanceWithLatencyMetrics })
    .resolves(listSendCommandCommandResponse.getPerformancemetricsCommandResponse)
    .on(SendCommandCommand, { Parameters: getServerInstallDate })
    .resolves(listSendCommandCommandResponse.getServerInstallDateCommandResponse)
    .on(SendCommandCommand, { Parameters: getServerEdition })
    .resolves(listSendCommandCommandResponse.getServerEdition)
    .on(SendCommandCommand, { Parameters: getHostAndSqlServerInfo })
    .resolves(listSendCommandCommandResponse.getHostAndSqlServerInfoResponse)
    .on(SendCommandCommand, { Parameters: getActiveNodeDriveDetailsFCI })
    .resolves(listSendCommandCommandResponse.getActiveNodeDriveDetails)
    .on(SendCommandCommand, { Parameters: getStandbyNodeDriveList })
    .resolves(listSendCommandCommandResponse.getStandbyNodeDriveList)
    .on(SendCommandCommand, { Parameters: getDefaultDriveLetters })
    .resolves(listSendCommandCommandResponse.getDefaultDriveLettersCommandResponse)
    .on(SendCommandCommand, { Parameters: createDatabase })
    .resolves(listSendCommandCommandResponse.createDBResponse)
    .on(SendCommandCommand, { Parameters: configureLuns })
    .resolves(listSendCommandCommandResponse.configureLunsResponse)
    .on(SendCommandCommand, { Parameters: newDBInitialize })
    .resolves(listSendCommandCommandResponse.newDBInitalizeResponse)
    .on(SendCommandCommand, { Parameters: cleanUpDB })
    .resolves(listSendCommandCommandResponse.cleanUpDBResponse)
    .on(SendCommandCommand, { Parameters: checkDBExists })
    .resolves(listSendCommandCommandResponse.checkDBExistsResponse)
    .on(SendCommandCommand, { Parameters: serverDetails })
    .resolves(listSendCommandCommandResponse.serverDetailsResponse)
    .on(SendCommandCommand, { Parameters: resourceUtilization })
    .resolves(listSendCommandCommandResponse.resourceUtilizationResponse)
    .on(SendCommandCommand, { Parameters: getCollationDetails })
    .resolves(listSendCommandCommandResponse.getCollationDetailsResponse)
    .on(SendCommandCommand, { Parameters: clusterNetwokIpInfo })
    .resolves(listSendCommandCommandResponse.clusterNetwokIpInfo)
    .on(SendCommandCommand, { Parameters: getOntapSandboxVolumeSavingsParams })
    .resolves(listSendCommandCommandResponse.ontapSandboxVolumesSavings)
    .on(SendCommandCommand, { Parameters: getSandboxDetails })
    .resolves(listSendCommandCommandResponse.getSandboxDetails)
    .on(SendCommandCommand, { Parameters: instanceDetails })
    .resolves(listSendCommandCommandResponse.instanceDetails)
    .on(SendCommandCommand, { Parameters: getVolumeLunMappingsCommand })
    .resolves(listSendCommandCommandResponse.getDbVolumeLunMapping)
    .on(SendCommandCommand, { Parameters: cloneVolumeCommand })
    .resolves(listSendCommandCommandResponse.createCloneVolume)
    .on(SendCommandCommand, { Parameters: invokeVirtualMountCommand })
    .resolves(listSendCommandCommandResponse.invokeVirtualMount)
    .on(SendCommandCommand, { Parameters: createCloneDbCommand })
    .resolves(listSendCommandCommandResponse.createCloneDb)
    .on(SendCommandCommand, { Parameters: addExtendedPropertiesCommand })
    .resolves(listSendCommandCommandResponse.addExtendedProperties)
    .on(SendCommandCommand, { Parameters: cleanUpOntapResourcesCommand })
    .resolves(listSendCommandCommandResponse.cleanupOntapResource)
    .on(SendCommandCommand, { Parameters: mountPointQueryCommand })
    .resolves(listSendCommandCommandResponse.mountPointQuery)
    .on(SendCommandCommand, { Parameters: getInstanceGuidCommand })
    .resolves(listSendCommandCommandResponse.getInstanceGuid)
    .on(SendCommandCommand, { Parameters: detachDbAndRemoveAccessPathCommand })
    .resolves(listSendCommandCommandResponse.mountPointQuery)
    .on(SendCommandCommand, { Parameters: deleteExtendedPropertiesCommand })
    .resolves(listSendCommandCommandResponse.deleteExtendedProperties)
    .on(SendCommandCommand, { Parameters: getSplitEstimateCommand })
    .resolves(listSendCommandCommandResponse.getSplitEstimateCommand)
    .on(SendCommandCommand, { Parameters: getActiveDirectory })
    .resolves(listSendCommandCommandResponse.getActiveDirectoryCommand)
    .on(SendCommandCommand, { Parameters: enterpriseFeatureUsageCheck })
    .resolves(listSendCommandCommandResponse.enterpriseFeatureUsageCheckCommand)
    .on(SendCommandCommand, { Parameters: dbCountParamasV2 })
    .resolves(listSendCommandCommandResponse.dbCountParamasV2Command)
    .on(SendCommandCommand, { Parameters: checkDatabaseIntegirty })
    .resolves(listSendCommandCommandResponse.checkDatabaseIntegrity)
    .on(SendCommandCommand, { Parameters: getSnapshotsToCloneCommand })
    .resolves(listSendCommandCommandResponse.getSnapshotsToCloneCommand)
    .on(SendCommandCommand, { Parameters: readExtendedPropertiesCommand })
    .resolves(listSendCommandCommandResponse.readExtendedPropertiesCommand)
    .on(SendCommandCommand, { Parameters: getConnectionInforCommand })
    .resolves(listSendCommandCommandResponse.getConnectionInfoCommand)
    .on(SendCommandCommand, { Parameters: checkScriptUpdate })
    .resolves(listSendCommandCommandResponse.checkSrciptUpdateCommand)
    .on(SendCommandCommand, { Parameters: dbSummary })
    .resolves(listSendCommandCommandResponse.dbSummaryCommand)
    .on(SendCommandCommand, { Parameters: pgsqlInstanceInfo })
    .resolves(listSendCommandCommandResponse.getPgsqlInstanceInfoCommand)
    .on(SendCommandCommand, params => {
        return getPgsqlStorageSavingsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getPgsqlStorageSavingsCommand)
    .on(SendCommandCommand, { Parameters: pgsqldbCount })
    .resolves(listSendCommandCommandResponse.getPgsqldbCountCommand)
    .on(SendCommandCommand, params => {
        return params.DocumentName === 'AWS-RunPatchBaseline';
    })
    .resolves(listSendCommandCommandResponse.getPatchBaselineCommand)
    .on(SendCommandCommand, params => {
        const newOptimizeRegex = optimizeRegex;
        const newOptimizeParams = params.Parameters.commands?.[0];
        return newOptimizeParams && newOptimizeRegex.test(newOptimizeParams);
    })
    .resolves(listSendCommandCommandResponse.optimizeStorageCommand)
    .on(SendCommandCommand, params => {
        return rescanExtendRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.rescanAndExtendLogLunCommand)
    .on(SendCommandCommand, params => {
        return checkNodeStatusRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.checkNodeStatusCommand)
    .on(SendCommandCommand, params => {
        return moveClusterGroupsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.moveClusterGroupsCommand)
    .on(SendCommandCommand, params => {
        const getLunDetailsRegex = /#Get ONTAP LUN details Script/;
        return getLunDetailsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getLunDetailsCommand)
    .on(SendCommandCommand, { Parameters: validateMpio })
    .resolves(listSendCommandCommandResponse.validateMpioCommand)
    .on(SendCommandCommand, { Parameters: setMpioPolicy })
    .resolves(listSendCommandCommandResponse.setMpioPolicyCommand)
    .on(SendCommandCommand, { Parameters: validateMpioSessionsSsm })
    .resolves(listSendCommandCommandResponse.validateMpioSessionsCommand)
    .on(SendCommandCommand, params => {
        return remediateMpioSessions.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.remediateMpioSessionsCommand)
    .on(SendCommandCommand, { Parameters: validateMpioInstallation })
    .resolves(listSendCommandCommandResponse.validateMpioInstallationCommand)
    .on(SendCommandCommand, { Parameters: enableMpioAndConfigure })
    .resolves(listSendCommandCommandResponse.enableMpioAndConfigureCommand)
    .on(SendCommandCommand, { Parameters: verifyMpioTimeout })
    .resolves(listSendCommandCommandResponse.verifyMpioTimeoutSetting)
    .on(SendCommandCommand, params => {
        const getLunDetailsRegex = /#Get ACTIVE NODE DRIVE INFO/;
        return getLunDetailsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getActiveNodeDriveDetails)
    .on(SendCommandCommand, params => {
        return getMappedOntapVolumesRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getOntapMappedVolumesCommandResponse)
    .on(SendCommandCommand, params => {
        return getStorageAssessmentDataRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getStorageAssessmentCommandResponse)
    .on(SendCommandCommand, params => {
        return /'Test-Connection -ComputerName "www.catalog.update.microsoft.com"/.test(
            params.Parameters.commands?.[0]
        );
    })
    .resolves(listSendCommandCommandResponse.testConnectionCommandResponse)
    .on(SendCommandCommand, params => {
        return /#Get cluster node names/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getClusterNodeNames'))
    .on(SendCommandCommand, { Parameters: rssConfigAssessmentSsm })
    .resolves(listSendCommandCommandResponse.getRssConfigAssessmentCommand)
    .on(SendCommandCommand, { Parameters: checkRunningStatus })
    .resolves(listSendCommandCommandResponse.checkRunningStatusCommand)
    .on(SendCommandCommand, { Parameters: getRunningSqlServers })
    .resolves(listSendCommandCommandResponse.getRunningSqlServersCommand)
    .on(SendCommandCommand, { Parameters: getInstalledSQLPatches })
    .resolves(listSendCommandCommandResponse.getInstalledSQLPatchesCommand)
    .on(SendCommandCommand, params => {
        const commentString = /# Get list of snapshot policies on cluster level/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('listSnapshotPolicies'))
    .on(SendCommandCommand, params => {
        const commentString = /# Set snapshot policy for volumes/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('setSnapshotPolicy'))
    .on(SendCommandCommand, params => {
        const commentString = /# Get list of creation dates for latest snapshot copies of each volume/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getSnapshotCopyDetails'))
    .on(SendCommandCommand, params => {
        return /#Set MAXDOP/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('setMaxDOP'))
    .on(SendCommandCommand, params => {
        return getVCPUAndMaxDopDetails.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getVCPUAndMaxDOPDetails'))
    .on(SendCommandCommand, params => {
        const commentString = /# Optimize Network Adapters/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('optimizeNetworkAdapters'))
    .on(SendCommandCommand, { Parameters: pgsqlDatabases })
    .resolves(listSendCommandCommandResponse.getPgsqldatabasesCommand)
    .on(SendCommandCommand, { Parameters: pgsqlPerformanceMetrics })
    .resolves(listSendCommandCommandResponse.getPgsqlPerformanceMetricsCommand)
    .on(SendCommandCommand, params => {
        return crrAssessmentDataRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getCRRAssessmentDataCommand)
    .on(SendCommandCommand, params => {
        return pgsqlProtectionRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('pgsqlProtection'))
    .on(SendCommandCommand, params => params.Comment === 'Discover PostgreSQL resources')
    .resolves(getSampleCommandResponse('discoverPgsqlResources'))
    .on(SendCommandCommand, params => {
        return /#Get sandbox Details/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getSandboxDetails'))
    .on(SendCommandCommand, params => {
        return /# Get running SQL Server instances/.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getRunningSqlServersCommand)
    .on(SendCommandCommand, params => {
        return /# Check running status and restart if not running/.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.checkRunningStatusCommand)
    .on(SendCommandCommand, params => {
        return /# Get running SQL Server instances/.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.getRunningSqlServersCommand)
    .on(SendCommandCommand, params => {
        return /# Check running status and restart if not running/.test(params.Parameters.commands?.[0]);
    })
    .resolves(listSendCommandCommandResponse.checkRunningStatusCommand)
    .on(SendCommandCommand, params => {
        return /SELECT path FROM sys.dm_os_server_diagnostics_log_configurations FOR JSON PATH/.test(
            params.Parameters.commands?.[0]
        );
    })
    .resolves(getSampleCommandResponse('logsPathCommand'))
    .on(SendCommandCommand, params => {
        return /# Bedrock Availability Check Script/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('bedrockAvailabilityCheck'))
    .on(SendCommandCommand, params => {
        return /# Logs Analysis Windows Prepare Script/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('logsAnalysisWindowsPrepare'))
    .on(SendCommandCommand, params => params.Comment === 'Discover Oracle resources')
    .resolves(getSampleCommandResponse('getOracleDiscoveryCommand'))
    .on(SendCommandCommand, params => params.Comment === 'oracle protection status')
    .resolves(getSampleCommandResponse('oracleProtectionDetails'))
    .on(SendCommandCommand, params => params.Comment === 'oracle performance metrics')
    .resolves(getSampleCommandResponse('oraclePerformanceMetrics'))
    .on(SendCommandCommand, params => params.Comment === 'oracle instance info')
    .resolves(getSampleCommandResponse('oracleInstanceInfo'))
    .on(SendCommandCommand, params => params.Comment === 'Get SQL server version and edition')
    .resolves(getSampleCommandResponse('getSqlServerVersionEditionDetails'))
    .on(SendCommandCommand, params => params.Comment === 'Check PowerShell 7 availability')
    .resolves(getSampleCommandResponse('getPS7CheckDetails'))
    .on(SendCommandCommand, params => params.Comment === 'Validate Oracle Credentials')
    .resolves(getSampleCommandResponse('validateOracleCredentials'))
    .on(SendCommandCommand, params => params.Comment === 'Install python on linux host')
    .resolves(getSampleCommandResponse('installPythonOnLinuxHost'))
    .on(SendCommandCommand, params => params.Comment === 'Get mapped volume details for Oracle db')
    .resolves(getSampleCommandResponse('oracleMappedVolumeDetails'))
    .on(SendCommandCommand, params => {
        const commentString = /# Get the installed SQL Server version/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getInstalledSqlServerVersionCommand'))
    .on(SendCommandCommand, { Parameters: instanceDetailsWithFqdnAndIp })
    .resolves(getSampleCommandResponse('instanceDetailsWithFqdnAndIp'))
    .on(SendCommandCommand, params => {
        return /# Get available drive letters/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getAvailableDriveLettersCommand'))
    .on(SendCommandCommand, { Parameters: clusterQuorumHeartBeat })
    .resolves(listSendCommandCommandResponse.clusterQuorumHeartBeat)
    .on(SendCommandCommand, params => {
        return /# Get LUN, igroup, initiator names and host IQN Script/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getLunIgroupInitiatorNamesCommand'))
    .on(SendCommandCommand, params => {
        return /# Get MSSQL Instance Volume LUN Drive Details/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getMssqlInstanceVolumeLunDriveDetailsCommand'))
    .on(SendCommandCommand, params => params.Comment === 'oracle database list')
    .resolves(getSampleCommandResponse('oracleDatabaseList'))
    .on(SendCommandCommand, params => params.Comment === 'Get Storage Configuration Assessment for Oracle instance')
    .resolves(getSampleCommandResponse('oracleStorageAssessment'))
    .on(SendCommandCommand, params => {
        return /# Get SQL Server services/.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getSqlServerServicesCommand'))
    .on(SendCommandCommand, params => {
        return fetchMssqlInstanceMtuDetailsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('fetchMssqlInstanceMtuDetails'))
    .on(SendCommandCommand, params => {
        return fetchFsxMtuDetailsRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('fetchFsxMtuDetails'))
    .on(SendCommandCommand, params => {
        return optimizeMtuRegex.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('optimizeMtu'))
    .on(SendCommandCommand, params => {
        const commentString = /# Get Oracle server details/;
        return commentString.test(params.Parameters.commands?.[0]);
    })
    .resolves(getSampleCommandResponse('getOracleServerDetails'))
    .on(SendCommandCommand, params => params.Comment === 'oracle database count')
    .resolves(getSampleCommandResponse('oracleDatabaseCount'));

ssmMock
    .on(GetCommandInvocationCommand)
    .resolves(getCommandInvocationResponse.resourceInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-memoryCommand' })
    .resolves(getCommandInvocationResponse.memoryInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbSummary1' })
    .resolves(getCommandInvocationResponse.dbSummaryInvocationResponse1)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbSummary2' })
    .resolves(getCommandInvocationResponse.dbSummaryInvocationResponse2)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbSummary3' })
    .resolves(getCommandInvocationResponse.dbSummaryInvocationResponse3)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbSummary4' })
    .resolves(getCommandInvocationResponse.dbSummaryInvocationResponse4)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbCount' })
    .resolves(getCommandInvocationResponse.dbCountInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-tablesCount' })
    .resolves(getCommandInvocationResponse.tablesCountInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-tablesList' })
    .resolves(getCommandInvocationResponse.tablesListInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serNodes' })
    .resolves(getCommandInvocationResponse.serNodesInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-clusterName' })
    .resolves(getCommandInvocationResponse.clusterNameInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-clusterNodes' })
    .resolves(getCommandInvocationResponse.clusterNodesInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serCluster' })
    .resolves(getCommandInvocationResponse.serIsClusteredInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serState' })
    .resolves(getCommandInvocationResponse.serStateInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-noOfConn' })
    .resolves(getCommandInvocationResponse.noOfConnInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serVer' })
    .resolves(getCommandInvocationResponse.serVersionInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-diskSize' })
    .resolves(getCommandInvocationResponse.diskSizeInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-diskData' })
    .resolves(getCommandInvocationResponse.diskDataInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serGUID' })
    .resolves(getCommandInvocationResponse.servGUIDInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serName' })
    .resolves(getCommandInvocationResponse.serNameInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serverIoLatency' })
    .resolves(getCommandInvocationResponse.serverIoLatencyInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-nativeSqlBackup' })
    .resolves(getCommandInvocationResponse.nativeSqlBackupInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-nativeSqlBackupDatabases' })
    .resolves(getCommandInvocationResponse.nativeSqlBackupDatabasesInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-ontapSnapshotCount' })
    .resolves(getCommandInvocationResponse.ontapSnapshotCountInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-ontapMappedVolumes' })
    .resolves(
        getSampleCommandResponseWithOutput(
            'ontapMappedVolumes',
            JSON.stringify(getCommandInvocationResponse.getMappedVolumesResponse)
        )
    )
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-storageSummary' })
    .resolves(getCommandInvocationResponse.storageInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-performanceMetrics' })
    .resolves(getCommandInvocationResponse.performanceInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-installDate' })
    .resolves(getCommandInvocationResponse.serverInstallDateInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-ServerEdition' })
    .resolves(getCommandInvocationResponse.serverEditionResponse)
    .on(GetCommandInvocationCommand, { Parameters: '7f937c8c-3f95-460b-ad99-788b354bffa8' })
    .resolves(getCommandInvocationResponse.getHostAndSqlServerInfoResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getActiveNodeDriveDetails' })
    .resolves(getCommandInvocationResponse.getActiveNodeDriveDetailsResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getStandbyNodeDriveList' })
    .resolves(getCommandInvocationResponse.getStandbyNodeDriveListResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getDefaultDriveLetters' })
    .resolves(getCommandInvocationResponse.getDefaultDrivesResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getClusterDriveLetters' })
    .resolves(getCommandInvocationResponse.getClusterdDrivesResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-bc46-createDB' })
    .resolves(getCommandInvocationResponse.createDBInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abc46-configureLuns' })
    .resolves(getCommandInvocationResponse.configureLunsInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abd46-newDBInitialise' })
    .resolves(getCommandInvocationResponse.newDBInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abd46-cleanUpDB' })
    .resolves(getCommandInvocationResponse.cleanUpDBInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abd46-checkDBExists' })
    .resolves(getCommandInvocationResponse.checkDBInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abd46-serverDetails' })
    .resolves(getCommandInvocationResponse.serverDetailsResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-2345-abd46-resourceUtilization' })
    .resolves(getCommandInvocationResponse.serverUtilizationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getCollationDetails' })
    .resolves(getCommandInvocationResponse.collationDetailsInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-clusterNetwokIpInfo' })
    .resolves(getCommandInvocationResponse.clusterNetwokIpInfoInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a271a4a7-3693-41bb-8c31-ontapSandboxVolumesSavings' })
    .resolves(getCommandInvocationResponse.ontapSandboxVolumesSavingsResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getSandboxDetailsInfo' })
    .resolves(getCommandInvocationResponse.getSandboxDetailsInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-instanceDetails' })
    .resolves(getCommandInvocationResponse.instanceDetailsInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: '551b3294-d372-4335-85df-b95a28de6f79-getDbVolumeLunMapping' })
    .resolves(getCommandInvocationResponse.getDbVolumeLunMapping)
    .on(GetCommandInvocationCommand, { CommandId: '585f55b2-3bea-474a-a29e-15532e59a314-createCloneVolume' })
    .resolves(getCommandInvocationResponse.createVolumeCloneResponse)
    .on(GetCommandInvocationCommand, { CommandId: '7a5f55b2-3bea-174a-a29e-15532e59a314-invokeVirtualMount' })
    .resolves(getCommandInvocationResponse.invokeVirtualMountResponse)
    .on(GetCommandInvocationCommand, { CommandId: '0b2f55b2-3bea-174a-a29e-15532e59a112-createCloneDb' })
    .resolves(getCommandInvocationResponse.createCloneDbResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a91f55b2-3bea-174a-a29e-15532e59a1b4-addExtendedProperties' })
    .resolves(getCommandInvocationResponse.addExtendedPropertiesResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-cleanupOntapResource' })
    .resolves(getCommandInvocationResponse.cleanupOntapResourceResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-mountPointQueryCommand' })
    .resolves(getCommandInvocationResponse.mountPointQueryCommandResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getInstanceGuid' })
    .resolves(getCommandInvocationResponse.getInstanceGuidResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-detachDbAndAcessPathQuery' })
    .resolves(getCommandInvocationResponse.detachDbAndAccessPathResp)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-deleteExtendedProperties' })
    .resolves(getCommandInvocationResponse.deleteExtendedPropertiesResp)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSplitEstimateCommand' })
    .resolves(getCommandInvocationResponse.getSplitEstimateResp)
    .on(GetCommandInvocationCommand, { CommandId: 'f171a4a7-3693-41bb-8c31-getActiveDirectory' })
    .resolves(getCommandInvocationResponse.getActiveDirectoryResp)
    .on(GetCommandInvocationCommand, { CommandId: 'k273a5y9-2143-82qe-6w13-enterpriseFeatureUsageCheckCommand' })
    .resolves(getCommandInvocationResponse.enterpriseCheckResp)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-dbCountParamasV2Command' })
    .resolves(getCommandInvocationResponse.getDbCount)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-checkDatabaseIntegrity' })
    .resolves(getCommandInvocationResponse.checkDatabaseIntegrityResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSnapshotsToCloneCommand' })
    .resolves(getCommandInvocationResponse.getSnapshotsToCloneResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-readExtendedPropertiesCommand'
    })
    .resolves(getCommandInvocationResponse.readExtendedPropertiesResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getConnectionInfoCommand'
    })
    .resolves(getCommandInvocationResponse.getConnectionInfoResp)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-checkSrciptUpdateCommand'
    })
    .resolves(getCommandInvocationResponse.checkScriptUpdateResp)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-dbSummaryCommand'
    })
    .resolves(getCommandInvocationResponse.dbSummaryResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-optimizeStorageCommand'
    })
    .resolves(getCommandInvocationResponse.optimizeStorageResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-rescanAndExtendLogLunCommand'
    })
    .resolves(getCommandInvocationResponse.rescanAndExtendLogLunResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-checkNodeStatusCommand'
    })
    .resolves(getCommandInvocationResponse.checkNodeStatusResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-moveClusterGroupsCommand'
    })
    .resolves(getCommandInvocationResponse.moveClusterGroupsResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-validateMpioCommand'
    })
    .resolvesOnce(getCommandInvocationResponse.validateMpioNotRRCommandResponse)
    .resolves(getCommandInvocationResponse.validateMpioCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-setMpioPolicyCommand'
    })
    .resolves(getCommandInvocationResponse.setMpioPolicyCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-validateMpioSessionsCommand'
    })
    .resolvesOnce(getCommandInvocationResponse.validateMpioSessionsViolationCommandResponse)
    .resolves(getCommandInvocationResponse.validateMpioSessionsCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-remediateMpioSessionsCommand'
    })
    .resolves(getCommandInvocationResponse.remediateMpioSessionsCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-validateMpioInstallationCommand'
    })
    .resolves(getCommandInvocationResponse.validateMpioInstallationCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-enableMpioAndConfigureCommand'
    })
    .resolves(getCommandInvocationResponse.enableMpioAndConfigureCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-verifyMpioTimeoutSetting'
    })
    .resolves(getCommandInvocationResponse.verifyMpioTimeoutSettingResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getLunDetailsCommand'
    })
    .resolves(getCommandInvocationResponse.getLunDetailsResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-assessmentConfigData'
    })
    .resolves(getCommandInvocationResponse.assessmentConfigData)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPatchBaselineCommand'
    })
    .resolves(getCommandInvocationResponse.getPatchBaselineCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPgsqlInstanceInfoCommand'
    })
    .resolves(getCommandInvocationResponse.getPgsqlInstanceInfoCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPgsqlStorageSavingsCommand'
    })
    .resolves(getCommandInvocationResponse.getPgsqlStorageSavingsCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPgsqldbCountCommand'
    })
    .resolves(getCommandInvocationResponse.getPgsqldbCountCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-testConnectionCommand'
    })
    .resolves(getCommandInvocationResponse.testConnectionCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getClusterNodeNames'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getClusterNodeNames',
            '{    "currentNode":  "sqlnode1-44317", "ownerNodes":  "sqlnode1-44317",    "clusterNodes":  [                         "sqlnode1-44317",                         "sqlnode2-44317"                     ]}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-rssConfigAssessmentDataCommand'
    })
    .resolves(getCommandInvocationResponse.rssConfigAssessmentDataCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-checkRunningStatusCommand'
    })
    .resolves(getCommandInvocationResponse.checkRunningStatusCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getRunningSqlServersCommand'
    })
    .resolves(getCommandInvocationResponse.getRunningSqlServersCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-installedSQLPatchesCommand'
    })
    .resolves(getCommandInvocationResponse.getInstalledSQLPatchesCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-crrAssessmentCommand'
    })
    .resolves(getCommandInvocationResponse.getCRRAssessmentCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-listSnapshotPolicies'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'listSnapshotPolicies',
            JSON.stringify(getCommandInvocationResponse.snapshotListResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-setSnapshotPolicy'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'setSnapshotPolicy',
            '{"errors":{},"response":[{"uuid":"18873848-d09c-11ef-a0ec-61a27a6bebc8"},{"uuid":"4155f74d-b1ff-11ef-b315-11b9ce95d982"},{"uuid":"61a6f6da-34d3-11ee-9989-a51720c855dc"}]}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSnapshotCopyDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getSnapshotCopyDetails',
            JSON.stringify(getCommandInvocationResponse.getSnapshotCopyDetailsResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-setMaxDOP'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'setMaxDOP',
            '{"status":"success","message":"MAXDOP set to 4 for instance STVYCUAMIUIG\\\\SIGMA, Configuration option \\u0027show advanced options\\u0027 changed from 1 to 1. Run the RECONFIGURE statement to install. Configuration option \\u0027max degree of parallelism\\u0027 changed from 4 to 4. Run the RECONFIGURE statement to install."}\r\n'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-discoverPgsqlResources'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'discoverPgsqlResources',
            JSON.stringify(getCommandInvocationResponse.discoverPgsqlServer)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getVCPUAndMaxDOPDetails'
    })
    .resolves(getSampleCommandResponseWithOutput('getVCPUAndMaxDOPDetails', '{"vcpuCount":4,"maxDOP":"4"}\r\n'))
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-optimizeNetworkAdapters'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'optimizeNetworkAdapters',
            JSON.stringify(getCommandInvocationResponse.optimizeNetworkAdaptersResponse)
        )
    )
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPgsqldatabasesCommand' })
    .resolves(getCommandInvocationResponse.getPgsqlDatabasesCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPgsqlPerformanceMetricsCommand'
    })
    .resolves(getCommandInvocationResponse.getPgsqlPerformanceMetricsCommandResponse)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-pgsqlProtection'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'pgsqlProtection',
            '{ "records": [ { "uuid": "65ce42b0-093b-11f0-9005-d94de70408b8", "name": "wlmdb_pgsqldata_1742880617685", "snapshot_count": 1, "_links": { "self": { "href": "/api/storage/volumes/65ce42b0-093b-11f0-9005-d94de70408b8" } } } ], "num_records": 1, "_links": { "self": { "href": "/api/storage/volumes?fields=snapshot_count&name=wlmdb_pgsqldata_1742880617685" } } }'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSandboxDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getSandboxDetails',
            '{"cloneResponse":"[{\\"database_name\\":\\"sandbox_1743487277979\\",\\"sandbox_properties\\":[{\\"name\\":\\"accountId\\",\\"value\\":\\"account-aHP3esT5\\"},{\\"name\\":\\"cloned_by\\",\\"value\\":\\"netapp_wf\\"},{\\"name\\":\\"createdAt\\",\\"value\\":1743487614964},{\\"name\\":\\"source\\",\\"value\\":\\"stvyar9|MSSQLSERVER|apr1\\"},{\\"name\\":\\"tag\\",\\"value\\":\\"Development\\"},{\\"name\\":\\"updatedAt\\",\\"value\\":1743487614964}]},{\\"database_name\\":\\"sandbox_ap90\\",\\"sandbox_properties\\":[{\\"name\\":\\"accountId\\",\\"value\\":\\"account-aHP3esT5\\"},{\\"name\\":\\"cloned_by\\",\\"value\\":\\"netapp_wf\\"},{\\"name\\":\\"createdAt\\",\\"value\\":1743486922070},{\\"name\\":\\"source\\",\\"value\\":\\"stvyar9|MSSQLSERVER|test1\\"},{\\"name\\":\\"tag\\",\\"value\\":\\"Development\\"},{\\"name\\":\\"updatedAt\\",\\"value\\":1743486922070}]},{\\"database_name\\":\\"sandbox_test234\\",\\"sandbox_properties\\":[{\\"name\\":\\"accountId\\",\\"value\\":\\"account-aHP3esT5\\"},{\\"name\\":\\"cloned_by\\",\\"value\\":\\"netapp_wf\\"},{\\"name\\":\\"createdAt\\",\\"value\\":1743487698523},{\\"name\\":\\"source\\",\\"value\\":\\"stvyar9|MSSQLSERVER|test1\\"},{\\"name\\":\\"tag\\",\\"value\\":\\"Development\\"},{\\"name\\":\\"updatedAt\\",\\"value\\":1743487698523}]}]"}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getOracleDiscoveryCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getOracleDiscoveryCommand',
            JSON.stringify(getCommandInvocationResponse.discoverOracleServer)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-logsPathCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'logsPathCommand',
            JSON.stringify({
                MSSQLSERVER: [{ path: 'C:\\Program Files\\Microsoft SQL Server\\MSSQL15.MSSQLSERVER\\MSSQL\\Log' }]
            })
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-logsAnalysisWindowsPrepare'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'logsAnalysisWindowsPrepare',
            JSON.stringify([{ status: 'success', error: '' }])
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-bedrockAvailabilityCheck'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'bedrockAvailabilityCheck',
            JSON.stringify([{ status: 'success', error: '' }])
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleProtectionDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oracleProtectionDetails',
            '{"ontapProtectionDetails":{"records":[{"uuid":"db3ed9f2-eee7-11ef-8fbb-837e18df6f7a","name":"oracledata2","snapshot_count":22,"svm":{"name":"wlmdb_sqlsvm_1735809893269"},"_links":{"self":{"href":"/api/storage/volumes/db3ed9f2-eee7-11ef-8fbb-837e18df6f7a"}}}],"num_records":1,"_links":{"self":{"href":"/api/storage/volumes?fields=snapshot_count&name=oracledata2&svm=wlmdb_sqlsvm_1735809893269"}}},"isNativeProtectionEnabled":"false"}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oraclePerformanceMetrics'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oraclePerformanceMetrics',
            '{"READ_IOPS":0.11,"WRITE_IOPS":0.6,"READ_THROUGHPUT":0.001,"WRITE_THROUGHPUT":0.005,"READ_LATENCY":0,"WRITE_LATENCY":0,"SERVER_IO_LATENCY":0,"assessment":"Excellent ( <=1 ms )"}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleInstanceInfo'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oracleInstanceInfo',
            '[{"sid":"ordbsdl","instance_details":{"instance_id":1,"instance_name":"ordbsdl","host_name":"ip-172-31-48-99.ap-southeast-1.compute.internal","version":"19.0.0.0.0","instance_state":"OPEN"},"modules_availability":{"isAwsCliInstalled":true,"isJqInstalled":true}},{"sid":"oraclesan1","instance_details":{"instance_id":1,"instance_name":"oraclesan1","host_name":"ip-172-31-48-99.ap-southeast-1.compute.internal","version":"19.0.0.0.0","instance_state":"STARTED"},"modules_availability":{"isAwsCliInstalled":true,"isJqInstalled":false}},{"sid":"oracle","instance_details":{"instance_id":1,"instance_name":"oracle","host_name":"ip-172-31-48-99.ap-southeast-1.compute.internal","version":"19.0.0.0.0","instance_state":"OPEN"},"modules_availability":{"isAwsCliInstalled":false,"isJqInstalled":true}}]'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSqlServerVersionEditionDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getSqlServerVersionEditionDetails',
            '{ "MSSQLSERVER": [ { "sqlServerEdition": "Standard Edition (64-bit)", "sqlServerEngineEdition": 2, "sqlServerName": "LessProvisionDB", "sqlServerVersion": "16.0.1000.6", "windowsAuthentication": 0, "isHadrEnabled": 0, "isClustered": 0 } ]}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getPS7CheckDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getPS7CheckDetails',
            '{"scriptExecutionTime":486.0067,"status":"success","isPS7Available":true}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-validateOracleCredentials'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'validateOracleCredentials',
            '{ "instances": [ { "oracleInstanceConnectivity": true, "oracleInstanceName": "ordbsdl", "oracleEdition": "19.0.0.0.0" } ], "fsxResults": [ { "ontapconnectivity": true, "fsxId": "fs-0d5efc3057c4f12cb" } ], "valid": true }'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleMappedVolumeDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oracleMappedVolumeDetails',
            '{"protocol":"NFS","lunRecords":[],"isASMManaged":false,"volumeMappings":[{"oradbsan":{"isCDB":false,"ontapVolumes":{"REDO_LOGS":[{"volumeId":"db3ed9f2-eee7-11ef-8fbb-837e18df6f7a", "volumeName":"oracleredo2","svmName":"wlmdb_sqlsvm_1733286308083", "svmId":"svmId1"}],"ARCHIVE_LOGS":[{"volumeId":"cc802ccc-eee7-11ef-8fbb-837e18df6f7a","volumeName":"oraclearch2","svmName":"wlmdb_sqlsvm_1733286308083", "svmId":"svmId2"}],"CONTROL_FILES":[{"volumeId":"db1ed9f2-eee7-11ef-8fbb-837e18df6f7a","volumeName":"oracledata2","svmName":"wlmdb_sqlsvm_1733286308083", "svmId":"svmId3"}],"TEMP_FILES":[{"volumeId":"db3ed9f2-eee7-11ef-8fbb-837e18df6f7a","volumeName":"oracleredo2","svmName":"wlmdb_sqlsvm_1733286308083", "svmId":"svmId5"}],"DATA_FILES":[{"volumeId":"db1ed9f2-eee7-11ef-8fbb-837e18df6f7a","volumeName":"oracledata2","svmName":"wlmdb_sqlsvm_1733286308083", "svmId":"svmId1"}]}}}]}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getInstalledSqlServerVersionCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'optimizeNetworkAdapters',
            JSON.stringify(getCommandInvocationResponse.getInstalledSqlVersion)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-instanceDetailsWithFqdnAndIp'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'instanceDetailsWithFqdnAndIp',
            `${JSON.stringify(getCommandInvocationResponse.getInstanceResponse)},${JSON.stringify({
                fqdn: 'dev.wlm.com'
            })},${JSON.stringify({
                ipAddress: '168.154.0.0'
            })}`
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getAvailableDriveLettersCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getAvailableDriveLettersCommand',
            JSON.stringify(getCommandInvocationResponse.getAvailableDriveLetters)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-clusterQuorumHeartBeat'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'clusterQuorumHeartBeat',
            '{"QuorumResourceName":"Quorum","QuorumType":2,"IsPhysicalDisk":false,"IsMajority":false,"IsPhysicalDiskAndMajority":false}{"CrossSubnetDelay":  1000,"SameSubnetThreshold":  10,"CrossSiteDelay":  8000,"SameSubnetDelay":  1000,"CrossSubnetThreshold":  20,"CrossSiteThreshold":  20}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSqlServerServicesCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getSqlServerServicesCommand',
            JSON.stringify(getCommandInvocationResponse.getSqlServerServicesCommand)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getLunIgroupInitiatorNamesCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getLunIgroupInitiatorNamesCommand',
            JSON.stringify(getCommandInvocationResponse.getLunIgroupInitiatorNamesCommand)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getMssqlInstanceVolumeLunDriveDetailsCommand'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getMssqlInstanceVolumeLunDriveDetailsCommand',
            JSON.stringify(getCommandInvocationResponse.getMssqlInstanceVolumeLunDriveDetailsCommand)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleDatabaseList'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oracleDatabaseList',
            '{"database_details":{"name": "ordbsdl","status": "online"}, "is_cdb": "no", "root_db_size": 2500000000}'
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleDatabaseCount'
    })
    .resolves(getSampleCommandResponseWithOutput('oracleDatabaseCount', '{"databases_count":"1"}'))
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-fetchMssqlInstanceMtuDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'fetchMssqlInstanceMtuDetails',
            JSON.stringify(getCommandInvocationResponse.fetchMssqlInstanceMtuDetailsInvocationResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-fetchFsxMtuDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'fetchFsxMtuDetails',
            JSON.stringify(getCommandInvocationResponse.fetchFsxMtuDetailsInvocationResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-oracleStorageAssessment'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'oracleStorageAssessment',
            JSON.stringify(getCommandInvocationResponse.getOracleStorageAssessmentData)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-optimizeMtu'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'optimizeMtu',
            JSON.stringify(getCommandInvocationResponse.getoptimizeMtuResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getOracleServerDetails'
    })
    .resolves(
        getSampleCommandResponseWithOutput(
            'getOracleServerDetails',
            JSON.stringify(getCommandInvocationResponse.getOracleServerDetailsResponse)
        )
    )
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-installPythonOnLinuxHost'
    })
    .resolves(getSampleCommandResponseWithOutput('installPythonOnLinuxHost', '{ "installationSuccessful": "true" }'));

ssmMock.on(GetParametersByPathCommand).callsFake(input => {
    if (input.Path && input.Path.includes('/aws/service/global-infrastructure/services/bedrock/regions')) {
        return Promise.resolve(listBedrockRegionsResponse);
    }
    return Promise.resolve(listFsxOntapRegionsResponse);
});
ssmMock.on(GetConnectionStatusCommand).resolves(getConnectionStatusResponse);
ssmMock.on(PutParameterCommand).resolves(putParameterResponse);
ssmMock.on(GetParameterCommand).resolves(getParameerResponse);
ssmMock.on(DeleteParametersCommand).resolves(deleteParametersResponse);
ssmMock.on(DescribeInstancePatchStatesCommand).callsFake(async (command: DescribeInstancePatchStatesCommand) => {
    const instanceIds = command.InstanceIds;
    const response = cloneDeep(describePatchStatesResponse);
    const instancePatchStates = [];
    instanceIds.forEach(instanceId => {
        const sampleinstancePatchState = describePatchStatesResponse.InstancePatchStates[0];
        sampleinstancePatchState.InstanceId = instanceId;
        instancePatchStates.push(sampleinstancePatchState);
    });

    response.InstancePatchStates = instancePatchStates;
    return response;
});
ssmMock.on(DescribeInstancePatchesCommand).resolves(describeInstancePatchesResponse);
ssmMock.on(DescribeAvailablePatchesCommand).resolves(describeAvailablePatchesResponse);
ssmMock.on(ListCommandsCommand).callsFake(async (command: ListCommandsCommand) => {
    const instanceId = command.InstanceId;
    if (instanceId?.includes('inProgress')) {
        return listCommandsCommandResponse;
    }
    const response = cloneDeep(listCommandsCommandResponse);
    response.Commands = [];
    return response;
});
ssmMock.on(DescribeInstanceInformationCommand).resolves(getSsmInstanceInformationResponse);
