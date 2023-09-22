const PSSCRIPT = 'C:\\SSM\\ExecuteQueryFromSSM.ps1';
const SSM_RUN_POWERSHELL_SCRIPT_DOC = 'AWS-RunPowerShellScript';
const SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION = '1';
const DB_ROWS_COUNT = 75;
const SET_NOCOUNT = 'SET NOCOUNT ON;';
const FOR_JSON_PATH = 'FOR JSON PATH';
const SSM_QUERY_CONCURRENCY_LIMIT = 10;
const DATABASES = (offset: number, rowscount: number) =>
    `${SET_NOCOUNT} SELECT databaseId = d.database_id,
            databaseName = d.name,
            creationDate = d.create_date,
            databaseStatus = d.state_desc,
            databaseSize = t.databaseSize
            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))
            FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name
            offset ${offset} rows fetch next ${rowscount} rows only ${FOR_JSON_PATH}`;

const DATABASES_COUNT = () =>
    `${SET_NOCOUNT} SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id ${FOR_JSON_PATH}`;

const CPU_UTILISATION = `${SET_NOCOUNT} set quoted_identifier ON;DECLARE @ts BIGINT;
                                DECLARE @lastNmin TINYINT;
                                SET @lastNmin = 1;
                                SELECT @ts =(SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info); 
                                SELECT TOP(@lastNmin)
                                        SQLProcessUtilization AS [percentUsed], 
                                        SQLProcessUtilization AS [used],
                                        SQLProcessUtilization+SystemIdle+(100 - SystemIdle - SQLProcessUtilization) AS [total],
                                        100-SQLProcessUtilization AS [remaining]
                                FROM (SELECT record.value('(./Record/@id)[1]','int')AS record_id, 
                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int')AS [SystemIdle], 
                                record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int')AS [SQLProcessUtilization], 
                                [timestamp]      
                                FROM (SELECT[timestamp], convert(xml, record) AS [record]             
                                FROM sys.dm_os_ring_buffers             
                                WHERE ring_buffer_type =N'RING_BUFFER_SCHEDULER_MONITOR'AND record LIKE'%%')AS x )AS y 
                                ORDER BY record_id DESC ${FOR_JSON_PATH}`;
const DB_SIZE = `${SET_NOCOUNT} SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files ${FOR_JSON_PATH}`;
const DISK_UTILISATION = `${SET_NOCOUNT} WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum
                                FROM sys.master_files mf1)
                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID
                                FROM presel pr
                                WHERE pr.RowNum = 1)
                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining
                                FROM roundtwo mf
                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs ${FOR_JSON_PATH}`;

const MEMORY_UTILISATION = `${SET_NOCOUNT} SELECT
                                    (processmem.physical_memory_in_use_kb * 1024) AS used,
                                    (sysmem.total_physical_memory_kb * 1024) AS total,
                                    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,
                                    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed
                                    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem ${FOR_JSON_PATH}`;

const SERVER_GUID = `${SET_NOCOUNT} SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name = 'msdb' ${FOR_JSON_PATH}`;

const SERVER_NAME = `${SET_NOCOUNT} SELECT @@SERVERNAME as serverName ${FOR_JSON_PATH}`;

const SERVER_VERSION_DETAILS = `${SET_NOCOUNT} SELECT @@version AS serverDetails`;
const SERVER_STATE = `${SET_NOCOUNT} EXEC master.dbo.xp_servicecontrol 'QUERYSTATE','MSSQLServer'`;
const IS_SERVER_CLUSTERED = `${SET_NOCOUNT} SELECT SERVERPROPERTY('IsClustered') as isClustered ${FOR_JSON_PATH}`;
const SERVER_NODE = `${SET_NOCOUNT} SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') as activeNode ${FOR_JSON_PATH}`;
const CLUSTER_NODES = `${SET_NOCOUNT} SELECT NodeName, is_current_owner FROM sys.dm_os_cluster_nodes ${FOR_JSON_PATH}`;
const FCI_CLUSTER_NAME = `${SET_NOCOUNT} SELECT cluster_name from sys.dm_hadr_cluster ${FOR_JSON_PATH}`;
const NUMBER_OF_CONNECTIONS = `${SET_NOCOUNT} SELECT COUNT(1) AS numberOfConnections FROM sys.dm_exec_sessions WHERE host_process_id is NOT NULL ${FOR_JSON_PATH}`;

const TABLES_QUERY = (offset: number, rowscount: number) =>
    `${SET_NOCOUNT} SELECT 
                        t.NAME AS tableName,
                        t.type_desc AS tableType,
                        s.Name AS tableSchema,
                        SUM(a.total_pages) * 8 * 1024 AS tableSize
                    FROM 
                        sys.tables t
                    INNER JOIN      
                        sys.indexes i ON t.OBJECT_ID = i.object_id
                    INNER JOIN 
                        sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
                    INNER JOIN 
                        sys.allocation_units a ON p.partition_id = a.container_id
                    LEFT OUTER JOIN 
                        sys.schemas s ON t.schema_id = s.schema_id
                    GROUP BY 
                        t.Name, s.Name, p.Rows, t.type_desc
                    ORDER BY 
                        t.Name offset ${offset} rows fetch next ${rowscount} rows only ${FOR_JSON_PATH}`;
const TABLES_COUNT_QUERY = `${SET_NOCOUNT} SELECT COUNT(DISTINCT name) AS totalCount FROM sys.tables ${FOR_JSON_PATH}`;

export {
    DB_ROWS_COUNT,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION,
    DATABASES,
    DATABASES_COUNT,
    PSSCRIPT,
    CPU_UTILISATION,
    DISK_UTILISATION,
    SERVER_VERSION_DETAILS,
    NUMBER_OF_CONNECTIONS,
    TABLES_QUERY,
    TABLES_COUNT_QUERY,
    MEMORY_UTILISATION,
    SERVER_GUID,
    SERVER_NAME,
    SERVER_STATE,
    IS_SERVER_CLUSTERED,
    SERVER_NODE,
    CLUSTER_NODES,
    DB_SIZE,
    SSM_QUERY_CONCURRENCY_LIMIT,
    FCI_CLUSTER_NAME
};
