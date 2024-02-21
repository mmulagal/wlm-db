/* eslint-disable quotes */
// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import {
    GetCommandInvocationCommand,
    SendCommandCommand,
    SSMClient,
    GetParametersByPathCommand,
    GetConnectionStatusCommand
} from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { hostAndSqlInfoPowerShellScript } from '../../../../src/operations/workloads/mssql/discover-consts';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommands-response.json';
import getCommandInvocationResponse from '../../responses/aws/ssm-getCommand-invocation.json';
import listFsxOntapRegionsResponse from '../../responses/aws/list-fsx-ontap-regions.json';
import getConnectionStatusResponse from '../../responses/aws/ssm-connection-status.json';

const ssmMock = mockClient(SSMClient);

const cpuParams = {
    commands: [
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SET NOCOUNT ON; set quoted_identifier ON;DECLARE @ts BIGINT;\n                                DECLARE @lastNmin TINYINT;\n                                SET @lastNmin = 1;\n                                SELECT @ts =(SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info); \n                                SELECT TOP(@lastNmin)\n                                        SQLProcessUtilization AS [percentUsed], \n                                        SQLProcessUtilization AS [used],\n                                        SQLProcessUtilization+SystemIdle+(100 - SystemIdle - SQLProcessUtilization) AS [total],\n                                        100-SQLProcessUtilization AS [remaining]\n                                FROM (SELECT record.value('(./Record/@id)[1]','int')AS record_id, \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int')AS [SystemIdle], \n                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int')AS [SQLProcessUtilization], \n                                [timestamp]      \n                                FROM (SELECT[timestamp], convert(xml, record) AS [record]             \n                                FROM sys.dm_os_ring_buffers             \n                                WHERE ring_buffer_type =N'RING_BUFFER_SCHEDULER_MONITOR'AND record LIKE'%%')AS x )AS y \n                                ORDER BY record_id DESC FOR JSON PATH\""
    ]
};
const memeoryParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT\n                                    (processmem.physical_memory_in_use_kb * 1024) AS used,\n                                    (sysmem.total_physical_memory_kb * 1024) AS total,\n                                    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n                                    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n                                    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH"'
    ]
};
const dbCountParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id FOR JSON PATH"'
    ]
};
const dbSummaryParams1 = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 0 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};

const dbSummaryParams2 = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 75 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};

const dbSummaryParams3 = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 150 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};

const dbSummaryParams4 = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT databaseId = d.database_id,\n            databaseName = d.name,\n            creationDate = d.create_date,\n            databaseStatus = d.state_desc,\n            databaseSize = t.databaseSize\n            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),\n            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))\n            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name\n            offset 225 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};

const noOfConnParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT COUNT(1) AS numberOfConnections FROM sys.dm_exec_sessions WHERE host_process_id is NOT NULL FOR JSON PATH"'
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
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT NodeName, is_current_owner FROM sys.dm_os_cluster_nodes FOR JSON PATH"'
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
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Database Aaronview -Query "SET NOCOUNT ON; SELECT COUNT(DISTINCT name) AS totalCount FROM sys.tables FOR JSON PATH"'
    ]
};
const tablesListParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Database Aaronview -Query "SET NOCOUNT ON; SELECT \n                        t.NAME AS tableName,\n                        t.type_desc AS tableType,\n                        s.Name AS tableSchema,\n                        SUM(a.total_pages) * 8 * 1024 AS tableSize\n                    FROM \n                        sys.tables t\n                    INNER JOIN      \n                        sys.indexes i ON t.OBJECT_ID = i.object_id\n                    INNER JOIN \n                        sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id\n                    INNER JOIN \n                        sys.allocation_units a ON p.partition_id = a.container_id\n                    LEFT OUTER JOIN \n                        sys.schemas s ON t.schema_id = s.schema_id\n                    GROUP BY \n                        t.Name, s.Name, p.Rows, t.type_desc\n                    ORDER BY \n                        t.Name offset 0 rows fetch next 75 rows only FOR JSON PATH"'
    ]
};
const diskSizeParams = {
    commands: [
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query 'SET NOCOUNT ON; SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH'"
    ]
};

const diskDataParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum\n                                FROM sys.master_files mf1)\n                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID\n                                FROM presel pr\n                                WHERE pr.RowNum = 1)\n                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining\n                                FROM roundtwo mf\n                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH"'
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
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SET NOCOUNT ON; SELECT\n    COUNT(DISTINCT backupset.database_name) as backupCount\n    FROM msdb.dbo.backupset AS backupset\n    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia\n    ON backupset.media_set_id = backupmedia.media_set_id\n    WHERE backupmedia.device_type = 2\n    AND backupset.type = 'D'\n    AND backupset.database_name NOT IN ('msdb','tempdb','model','master') FOR JSON PATH\n\""
    ]
};

const nativeSqlBackupDatabasesParams = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; SELECT\n    DISTINCT backupset.database_name as backedupDatabases\n    FROM msdb.dbo.backupset AS backupset\n    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia\n    ON backupset.media_set_id = backupmedia.media_set_id\n    WHERE backupmedia.device_type = 2\n    AND backupset.type = \'D\' FOR JSON PATH\n"'
    ]
};

const getOntapSnapshotCountParams = {
    commands: [
        "C:\\SSM\\OntapRestGet.ps1 -FSxSecretName WLMDB-SqlStandaloneStack-1699407080711-fsx -FSxID fs-03773e21b2f0e39b4 -FSxRegion us-east-1 -OntapResourceEndpoint 'storage/volumes' -OntapResourceFilter 'uuid=939a4ec9-7c14-11ee-b185-8329e8fcbf44' -OntapResourceQuery 'fields=snapshot_count'"
    ]
};

const getOntapMappedVolumesParams = {
    commands: [
        'C:\\SSM\\Get-MappedOntapVolumes.ps1 -FSxSecretName WLMDB-SqlStandaloneStack-1699407080711-fsx -FSxID fs-03773e21b2f0e39b4 -FSxRegion us-east-1'
    ]
};

const getStorageParams = {
    commands: [
        "C:\\SSM\\OntapRestGet.ps1 -FSxSecretName undefined -FSxID test-fsx2345 -FSxRegion test-region -OntapResourceEndpoint 'storage/volumes' -OntapResourceFilter 'tiering.object_tags=\"wlmDeploymentId=undefined\"' -OntapResourceQuery 'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used'"
    ]
};

const getPerformanceMetrics = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SET NOCOUNT ON; DECLARE @SQLRestartDateTime Datetime\n    DECLARE @TimeInSeconds Float\n    SELECT @SQLRestartDateTime = create_date FROM sys.databases WHERE database_id = 2\n    SET @TimeInSeconds = Datediff(s,@SQLRestartDateTime,GetDate())\n    SELECT   ROUND(CAST(SUM(num_of_reads) AS FLOAT)/@TimeInSeconds,2) AS READ_IOPS\n        , ROUND(CAST(SUM(num_of_writes) AS FLOAT)/@TimeInSeconds,2) AS WRITE_IOPS\n        , ROUND(CAST(SUM(num_of_bytes_read) AS FLOAT)/@TimeInSeconds/1000000,3) AS READ_THROUGHPUT\n        , ROUND(CAST(SUM(num_of_bytes_written) AS FLOAT)/@TimeInSeconds/1000000,3) AS WRITE_THROUGHPUT\n        , CASE WHEN SUM(num_of_reads) = 0 THEN 0 ELSE ROUND((SUM(io_stall_read_ms) / SUM(num_of_reads)), 2) END AS READ_LATENCY\n        , CASE WHEN SUM(num_of_writes) = 0 THEN 0 ELSE ROUND((SUM(io_stall_write_ms) / SUM(num_of_writes)), 2) END AS WRITE_LATENCY\n    FROM sys.dm_io_virtual_file_stats(null,null)  FOR JSON PATH"'
    ]
};

const getServerInstallDate = {
    commands: [
        "C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SET NOCOUNT ON; SELECT create_date AS creationDate FROM sys.server_principals WITH (NOLOCK) WHERE name = N'NT AUTHORITY\\SYSTEM' OR name = N'NT AUTHORITY\\NETWORK SERVICE' FOR JSON PATH\""
    ]
};

const getServerEdition = {
    commands: [
        'C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query " SET NOCOUNT ON; SELECT SERVERPROPERTY(\'Edition\') AS ServerEdition FOR JSON PATH"'
    ]
};

const getHostAndSqlServerInfo = {
    commands: hostAndSqlInfoPowerShellScript
};

const getDriveInfo = {
    commands: [
        "#Get the list of all used drive letters\n$usedDriveLetters = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name\n\n#Updating manufacturer detail and availabble space of each existing drives\n$driveInfo = $usedDriveLetters | ForEach-Object {\n    $driveLetter = $_\n    $drive = Get-PSDrive -Name $driveLetter\n    $diskNumber = (Get-Partition -DriveLetter $driveLetter).DiskNumber\n    try{\n        if((Get-PhysicalDisk | Where-Object { $_.DeviceId -eq $diskNumber }).Manufacturer -eq 'NETAPP'){\n            $isNetappDrive = $true \n        }\n        else{\n            $isNetappDrive = $false \n        }\n    }\n    catch {\n        $isNetappDrive = $false \n    }\n    $freeSpace = $drive.Free\n    [PSCustomObject]@{\n        driveLetter = $driveLetter\n        availableSize = $freeSpace\n        isNetappDrive = $isNetappDrive \n    }\n}\n\nWrite-Output $driveInfo | ConvertTo-Json\n"
    ]
};

const getDefaultDriveLetters = {
    commands: [
        "\n#Get default data drive of SQL server\n$defaultDataDrive = sqlcmd -Q @\"\n    SET NOCOUNT ON;\n    DECLARE @DataPath NVARCHAR(500);\n    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultData', @DataPath OUTPUT;\n    SELECT LEFT(@DataPath,1) AS CurrentDataDrive FOR JSON PATH;\n\"@ -y 0\n\n#Get default log drive of SQL server\n$defaultLogDrive = sqlcmd -Q @\"\n    SET NOCOUNT ON;\n    DECLARE @LogPath NVARCHAR(500);\n    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;\n    SELECT LEFT(@LogPath,1) AS CurrentLogDrive FOR JSON PATH;\n\"@ -y 0\n\nWrite-Output $defaultDataDrive $defaultLogDrive | ConvertTo-Json\n"
    ]
};

ssmMock
    .on(SendCommandCommand)
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
    .on(SendCommandCommand, { Parameters: cpuParams })
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
    .on(SendCommandCommand, { Parameters: memeoryParams })
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
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
    .on(SendCommandCommand, { Parameters: getPerformanceMetrics })
    .resolves(listSendCommandCommandResponse.getPerformancemetricsCommandResponse)
    .on(SendCommandCommand, { Parameters: getServerInstallDate })
    .resolves(listSendCommandCommandResponse.getServerInstallDateCommandResponse)
    .on(SendCommandCommand, { Parameters: getServerEdition })
    .resolves(listSendCommandCommandResponse.getServerEdition)
    .on(SendCommandCommand, { Parameters: getHostAndSqlServerInfo })
    .resolves(listSendCommandCommandResponse.getHostAndSqlServerInfoResponse)
    .on(SendCommandCommand, { Parameters: getDriveInfo })
    .resolves(listSendCommandCommandResponse.getDriveInfoCommandResponse)
    .on(SendCommandCommand, { Parameters: getDefaultDriveLetters })
    .resolves(listSendCommandCommandResponse.getDefaultDriveLettersCommandResponse);

ssmMock
    .on(GetCommandInvocationCommand)
    .resolves(getCommandInvocationResponse.resourceInvocationResponse)
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
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getDriveInfo' })
    .resolves(getCommandInvocationResponse.getDriveInfoResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-getDefaultDriveLetters' })
    .resolves(getCommandInvocationResponse.getDefaultDrivesResponse);

ssmMock.on(GetParametersByPathCommand).resolves(listFsxOntapRegionsResponse);
ssmMock.on(GetConnectionStatusCommand).resolves(getConnectionStatusResponse);
