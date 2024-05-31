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
    DeleteParametersCommand
} from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import {
    HOST_AND_SQL_INFO_PS1,
    CLUSTER_NETWORK_IP_INFO_PS1,
    GET_ACTIVE_DIRECTORY_DETAILS
} from '../../../../src/operations/workloads/mssql/discover-consts';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommands-response.json';
import getCommandInvocationResponse from '../../responses/aws/ssm-getCommand-invocation.json';
import listFsxOntapRegionsResponse from '../../responses/aws/list-fsx-ontap-regions.json';
import getConnectionStatusResponse from '../../responses/aws/ssm-connection-status.json';
import putParameterResponse from '../../responses/aws/ssm-put-parameter.json';
import getParameerResponse from '../../responses/aws/ssm-get-parameter.json';
import deleteParametersResponse from '../../responses/aws/ssm-delete-parameters.json';
import { DEFAULT_AWS_REGION } from '../../../utils/consts';
import {
    getMappedOntapVolumesScript,
    restGetUtilForOntap,
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_STANDBY_NODE_DRIVE_LIST,
    INSTANCE_DETAILS,
    RESOURCE_UTILIZATION,
    GET_DEFAULT_COLLATION,
    GET_DEFAULT_DRIVES
} from '../../../../src/operations/workloads/mssql/ssm-script-utils';
import { SERVER_DETAILS, PERFORMANCE_METRICS_WITH_LATENCY } from '../../../../src/operations/workloads/mssql/queries';
import {
    GET_SANDBOX_DETAILS,
    createVolumeClone,
    getDbMappedOntapVolumes,
    createClonedDb,
    addExtendedProperties,
    cleanUpOntapResources,
    mountPointQuery,
    getStorageSavingsFromOntap,
    detachDbAndRemoveAccessPath,
    deleteExtendedPropertiesScript
} from '../../../../src/operations/workloads/mssql/sandbox-scripts';
import { INVOKE_VIRTUAL_MOUNT } from '../../../../src/operations/workloads/mssql/const';

const ssmMock = mockClient(SSMClient);

const cpuParams = {
    commands: [
        `sqlcmd -S "." -Q \"SET NOCOUNT ON; set quoted_identifier ON;DECLARE @ts BIGINT;\n                                DECLARE @lastNmin TINYINT;\n                                SET @lastNmin = 1;\n                                SELECT @ts =(SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info); \n                                SELECT TOP(@lastNmin)\n                                        SQLProcessUtilization AS [percentUsed], \n                                        SQLProcessUtilization AS [used],\n                                        SQLProcessUtilization+SystemIdle+(100 - SystemIdle - SQLProcessUtilization) AS [total],\n                                        100-SQLProcessUtilization AS [remaining]\n                                FROM (SELECT record.value('(./Record/@id)[1]','int')AS record_id, \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int')AS [SystemIdle], \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int')AS [SQLProcessUtilization], \n                                [timestamp]      \n                                FROM (SELECT[timestamp], convert(xml, record) AS [record]             \n                                FROM sys.dm_os_ring_buffers             \n                                WHERE ring_buffer_type =N'RING_BUFFER_SCHEDULER_MONITOR'AND record LIKE'%%')AS x )AS y \n                                ORDER BY record_id DESC FOR JSON PATH\" -y 0`
    ]
};
const memeoryParams = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT\n                                    (processmem.physical_memory_in_use_kb * 1024) AS used,\n                                    (sysmem.total_physical_memory_kb * 1024) AS total,\n                                    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n                                    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n                                    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH" -y 0'
    ]
};
const dbCountParams = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id FOR JSON PATH" -y 0'
    ]
};
const dbSummaryParams1 = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 0 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams2 = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 75 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams3 = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 150 rows fetch next 75 rows only FOR JSON PATH" -y 0'
    ]
};

const dbSummaryParams4 = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize,\n            collationName = d.collation_name\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 225 rows fetch next 75 rows only FOR JSON PATH" -y 0'
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
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH" -y 0'
    ]
};

const diskDataParams = {
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum\n                                FROM sys.master_files mf1)\n                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID\n                                FROM presel pr\n                                WHERE pr.RowNum = 1)\n                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining\n                                FROM roundtwo mf\n                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH" -y 0'
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
    commands: [
        'sqlcmd -S "." -Q "SET NOCOUNT ON; SELECT\n    COUNT(DISTINCT backupset.database_name) as backupCount\n    FROM msdb.dbo.backupset AS backupset\n    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia\n    ON backupset.media_set_id = backupmedia.media_set_id\n    WHERE backupmedia.device_type = 2\n    AND backupset.type = \'D\' FOR JSON PATH\n" -y 0'
    ]
};

const nativeSqlBackupDatabasesParams = {
    commands: [
        'sqlcmd -Q "SET NOCOUNT ON; SELECT\n    DISTINCT backupset.database_name as backedupDatabases\n    FROM msdb.dbo.backupset AS backupset\n    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia\n    ON backupset.media_set_id = backupmedia.media_set_id\n    WHERE backupmedia.device_type = 2\n    AND backupset.type = \'D\' FOR JSON PATH\n" -y 0'
    ]
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

const getOntapMappedVolumesParams = {
    commands: [getMappedOntapVolumesScript('test-fsx', DEFAULT_AWS_REGION)]
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
    commands: [`sqlcmd -S "." -Q "${PERFORMANCE_METRICS_WITH_LATENCY}" -y 0`]
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
    commands: [GET_DEFAULT_DRIVES('.')]
};

const getActiveNodeDriveDetails = {
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
    commands: [`sqlcmd -S "." -Q "${SERVER_DETAILS}" -y 0`]
};

const clusterNetwokIpInfo = {
    commands: CLUSTER_NETWORK_IP_INFO_PS1
};

const resourceUtilization = {
    commands: [RESOURCE_UTILIZATION('.')]
};

const getCollationDetails = {
    commands: [GET_DEFAULT_COLLATION('.')]
};

const getOntapSandboxVolumeSavingsParams = {
    commands: [getStorageSavingsFromOntap('test-fsx', 'us-east-1', 'netapp_wf_test_account_test_cred')]
};

const getSandboxDetails = {
    commands: [GET_SANDBOX_DETAILS(['"."'], 'test-account')]
};

const instanceDetails = {
    commands: [INSTANCE_DETAILS]
};
const getVolumeLunMappingsCommand = {
    commands: [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')]
};

const cloneVolumeCommand = {
    commands: [
        createVolumeClone(
            'test-fsx',
            'us-east-1',
            'wlmdb_sqlsvm_1714090636810',
            JSON.stringify({ name: 'wlmdb_sqldata_1714098400' }),
            JSON.stringify({ name: 'wlmdb_sqllog_1714098400' }),
            'test-res-id',
            'netapp_wf_test_account_test_cred'
        )
    ]
};

const invokeVirtualMountCommand = {
    commands: [
        `${INVOKE_VIRTUAL_MOUNT} -DBName test-clone -DataFilePath D:\\MSSQL\\data\\testdb_data.mdf  -LogFilePath E:\\MSSQL\\log\\testdb_log.ldf  -DataSerial lWB44?VEq9vf -LogSerial lWB44?VEq9ve`
    ]
};

const createCloneDbCommand = {
    commands: [
        createClonedDb('testdb', '.', [
            'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
            'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
        ])
    ]
};

const addExtendedPropertiesCommand = {
    commands: [
        addExtendedProperties('testdb', '.', {
            tag: 'demo',
            cloned_by: 'netapp_wf',
            source: 'resource|instance|testdb',
            baseSnapshot: 'parentSnapshot'
        })
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

const mountPointQueryCommand = { commands: [mountPointQuery('.', 'test-database')] };

const detachDbAndRemoveAccessPathCommand = {
    commands: [
        detachDbAndRemoveAccessPath(
            'test-db',
            '["123456789", "987654321"]',
            '["S:\\test-db-Data", "L:\\test-db-Log"]',
            '.'
        )
    ]
};

const deleteExtendedPropertiesCommand = {
    commands: [
        deleteExtendedPropertiesScript('test-db', '.', [
            'cloned_by',
            'baseSnapshot',
            'source',
            'createdAt',
            'updatedAt',
            'tag',
            'accountId'
        ])
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
    commands: ["\n  $ErrorActionPreference = \"Stop\"\n  $responseObject = @{}\n  $scriptStartTime = Get-Date\n  $responseObject['activeDirectory'] = \"\"\n\n  try {\n    $adDomainName = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).Domain\n    If ($adDomainName -ne \"WORKGROUP\") {\n      $adIpList = ([System.Net.Dns]::GetHostEntry($adDomainName)).AddressList.IpAddressToString\n      if ($adIpList -IsNot [System.Array]) {\n        $adIpList = @($adIpList)\n      }\n\n      $adObject = New-Object PSObject -Property @{ \"domainName\" = $adDomainName }\n      $adObject | Add-Member -MemberType NoteProperty -Name \"ipAddresses\" -Value $adIpList\n      $responseObject['activeDirectory'] = $adObject\n    }\n  } catch {\n    $responseObject['failureInfo'] = $_.Exception.Message\n  } finally {\n    $scriptEndTime = Get-Date\n    $responseObject['scriptExecutionTime'] = (($scriptEndTime - $scriptStartTime).TotalMilliseconds)\n    Echo $responseObject | ConvertTo-Json -Compress\n  } \n"]
};

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
    .on(SendCommandCommand, { Parameters: getOntapMappedVolumesParams })
    .resolves(listSendCommandCommandResponse.getOntapMappedVolumesCommandResponse)
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
    .on(SendCommandCommand, { Parameters: getActiveNodeDriveDetails })
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
    .on(SendCommandCommand, { Parameters: detachDbAndRemoveAccessPathCommand })
    .resolves(listSendCommandCommandResponse.mountPointQuery)
    .on(SendCommandCommand, { Parameters: deleteExtendedPropertiesCommand })
    .resolves(listSendCommandCommandResponse.deleteExtendedProperties)
    .on(SendCommandCommand, { Parameters: getSplitEstimateCommand })
    .resolves(listSendCommandCommandResponse.getSplitEstimateCommand)
    .on(SendCommandCommand, { Parameters: getActiveDirectory })
    .resolves(listSendCommandCommandResponse.getActiveDirectoryCommand);

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
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-ontapMappedVolumes' })
    .resolves(getCommandInvocationResponse.ontapMappedVolumesInvocationResponse)
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
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-detachDbAndAcessPathQuery' })
    .resolves(getCommandInvocationResponse.detachDbAndAccessPathResp)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-deleteExtendedProperties' })
    .resolves(getCommandInvocationResponse.deleteExtendedPropertiesResp)
    .on(GetCommandInvocationCommand, { CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-getSplitEstimateCommand' })
    .resolves(getCommandInvocationResponse.getSplitEstimateResp)
    .on(GetCommandInvocationCommand, { CommandId: 'f171a4a7-3693-41bb-8c31-getActiveDirectory' })
    .resolves(getCommandInvocationResponse.getActiveDirectoryResp);

ssmMock.on(GetParametersByPathCommand).resolves(listFsxOntapRegionsResponse);
ssmMock.on(GetConnectionStatusCommand).resolves(getConnectionStatusResponse);
ssmMock.on(PutParameterCommand).resolves(putParameterResponse);
ssmMock.on(GetParameterCommand).resolves(getParameerResponse);
ssmMock.on(DeleteParametersCommand).resolves(deleteParametersResponse);
