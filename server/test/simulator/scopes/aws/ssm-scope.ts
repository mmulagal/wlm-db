// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { GetCommandInvocationCommand, SendCommandCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommands-response.json';
import getCommandInvocationResponse from '../../responses/aws/ssm-getCommand-invocation.json';

const ssmMock = mockClient(SSMClient);

const dbCountParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id"'
    ]
};
const dbSummaryParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT databaseId = d.database_id, databaseName = d.name, creationDate = d.create_date, databaseStatus = d.state_desc, databaseSize = t.databaseSize FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name offset 0 rows fetch next 75 rows only"'
    ]
};
const noOfConnParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT COUNT(1) AS numberOfConnections FROM sys.dm_exec_sessions WHERE host_process_id is NOT NULL"'
    ]
};
const serClusterParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT\n                                SERVERPROPERTY(\'IsClustered\') as isClustered"'
    ]
};
const serNodesParams = {
    commands: [
        " C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"SELECT\n                        SERVERPROPERTY('ComputerNamePhysicalNetBIOS') as activeNode,\n                        SERVERPROPERTY('MachineName') as standbyNode\""
    ]
};
const serStateParams = {
    commands: [
        " C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query \"EXEC\n                        master.dbo.xp_servicecontrol 'QUERYSTATE','MSSQLServer'\""
    ]
};
const serVerParams = {
    commands: [' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT @@version AS serverDetails"']
};
const tablesCountParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "use Aaronview SELECT COUNT(DISTINCT name) AS totalCount FROM sys.tables"'
    ]
};
const tablesListParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "use Aaronview\n                    SELECT \n                        t.NAME AS tableName,\n                        t.type_desc AS tableType,\n                        s.Name AS tableSchema,\n                        SUM(a.total_pages) * 8 * 1024 AS tableSize\n                    FROM \n                        sys.tables t\n                    INNER JOIN      \n                        sys.indexes i ON t.OBJECT_ID = i.object_id\n                    INNER JOIN \n                        sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id\n                    INNER JOIN \n                        sys.allocation_units a ON p.partition_id = a.container_id\n                    LEFT OUTER JOIN \n                        sys.schemas s ON t.schema_id = s.schema_id\n                    GROUP BY \n                        t.Name, s.Name, p.Rows, t.type_desc\n                    ORDER BY \n                        t.Name offset 0 rows fetch next 75 rows only"'
    ]
};
const diskSizeParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files"'
    ]
};
const diskDataParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum\n                                FROM sys.master_files mf1)\n                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID\n                                FROM presel pr\n                                WHERE pr.RowNum = 1)\n\n                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining\n                                FROM roundtwo mf\n                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs"'
    ]
};
const serGUIDParams = {
    commands: [
        ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT service_broker_guid AS serverGuid FROM sys.databases \n                    WHERE name = \'msdb\'"'
    ]
};
const serNameParams = {
    commands: [' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT @@SERVERNAME as serverName;"']
};

ssmMock
    .on(SendCommandCommand)
    .resolves(listSendCommandCommandResponse.resourceCommandResponse)
    .on(SendCommandCommand, { Parameters: dbCountParams })
    .resolves(listSendCommandCommandResponse.dbCountCommandResponse)
    .on(SendCommandCommand, { Parameters: dbSummaryParams })
    .resolves(listSendCommandCommandResponse.dbSummaryCommandResponse)
    .on(SendCommandCommand, { Parameters: noOfConnParams })
    .resolves(listSendCommandCommandResponse.noOfConnCommandResponse)
    .on(SendCommandCommand, { Parameters: serClusterParams })
    .resolves(listSendCommandCommandResponse.serClusterCommandResponse)
    .on(SendCommandCommand, { Parameters: serNodesParams })
    .resolves(listSendCommandCommandResponse.serNodesCommandResponse)
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
    .resolves(listSendCommandCommandResponse.serNameCommandResponse);

ssmMock
    .on(GetCommandInvocationCommand)
    .resolves(getCommandInvocationResponse.resourceInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbSummary' })
    .resolves(getCommandInvocationResponse.dbSummaryInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-dbCount' })
    .resolves(getCommandInvocationResponse.dbCountInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-tablesCount' })
    .resolves(getCommandInvocationResponse.tablesCountInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-tablesList' })
    .resolves(getCommandInvocationResponse.tablesListInvocationResponse)
    .on(GetCommandInvocationCommand, { CommandId: 'f3cb24b5-725a-475c-bc46-serNodes' })
    .resolves(getCommandInvocationResponse.serNodesInvocationResponse)
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
    .resolves(getCommandInvocationResponse.serNameInvocationResponse);
