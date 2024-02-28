const SET_NOCOUNT = 'SET NOCOUNT ON;';
const FOR_JSON_PATH = 'FOR JSON PATH';

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
                                SELECT SUM(ovs.total_bytes) AS total, SUM(ovs.available_bytes) AS remaining
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

const SERVER_INSTALL_DATE = `${SET_NOCOUNT} SELECT create_date AS creationDate FROM sys.server_principals WITH (NOLOCK) WHERE name = N'NT AUTHORITY\\SYSTEM' OR name = N'NT AUTHORITY\\NETWORK SERVICE' ${FOR_JSON_PATH}`;

const SERVER_VERSION_DETAILS = `${SET_NOCOUNT} SELECT @@version AS serverDetails`;
const SERVER_EDITION = ` ${SET_NOCOUNT} SELECT SERVERPROPERTY('Edition') AS ServerEdition ${FOR_JSON_PATH}`;
const SERVER_STATE = `${SET_NOCOUNT} EXEC master.dbo.xp_servicecontrol 'QUERYSTATE','MSSQLServer'`;
const IS_SERVER_CLUSTERED = `${SET_NOCOUNT} SELECT SERVERPROPERTY('IsClustered') as isClustered ${FOR_JSON_PATH}`;
const SERVER_NODE = `${SET_NOCOUNT} SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') as activeNode ${FOR_JSON_PATH}`;
const CLUSTER_NODES = `${SET_NOCOUNT} SELECT NodeName, is_current_owner FROM sys.dm_os_cluster_nodes ${FOR_JSON_PATH}`;
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

const SERVER_IO_LATENCY = `${SET_NOCOUNT} WITH DatabaseLatency as (SELECT 
                                            [ServerIOLatency] =
                                                CASE WHEN (SUM(num_of_reads) = 0 AND SUM(num_of_writes) = 0)
                                                    THEN 0 ELSE ROUND((CAST (SUM(io_stall) AS FLOAT) / (SUM(num_of_reads) + SUM(num_of_writes))), 2) END
                                            FROM
                                                sys.dm_io_virtual_file_stats (NULL,NULL)
                                            )
                                            select ServerIOLatency as latency,
                                            [assessment] = 
                                                    CASE 
                                                        WHEN ServerIOLatency = 0 THEN 'N/A' 
                                                        ELSE 
                                                            CASE WHEN ServerIOLatency <= 1 THEN 'Excellent ( <=1 ms )'
                                                                 WHEN ServerIOLatency < 5 THEN 'Very good ( <5 ms )'
                                                                 WHEN ServerIOLatency < 10 THEN 'Good ( <10 ms )'
                                                                 WHEN ServerIOLatency < 20 THEN 'Poor ( <20 ms )'
                                                                 WHEN ServerIOLatency < 100 THEN 'Bad ( <100 ms )'
                                                                 WHEN ServerIOLatency < 500 THEN 'Very bad ( <500 ms )'
                                                                 WHEN ServerIOLatency >= 500 THEN 'Awful ( >=500 ms )'
                                                            END 
                                                    END
                                            from DatabaseLatency
                                ${FOR_JSON_PATH}`;

const NATIVE_SQL_BACKUPS = `${SET_NOCOUNT} SELECT
    COUNT(DISTINCT backupset.database_name) as backupCount
    FROM msdb.dbo.backupset AS backupset
    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia
    ON backupset.media_set_id = backupmedia.media_set_id
    WHERE backupmedia.device_type = 2
    AND backupset.type = 'D'
    AND backupset.database_name NOT IN ('msdb','tempdb','model','master') ${FOR_JSON_PATH}
`;

// Since TempDB is recreated every time, we can use that to calculate the our start up time hence database_id=2
const PERFORMANCE_METRICS = `${SET_NOCOUNT} DECLARE @SQLRestartDateTime Datetime
    DECLARE @TimeInSeconds Float
    SELECT @SQLRestartDateTime = create_date FROM sys.databases WHERE database_id = 2
    SET @TimeInSeconds = Datediff(s,@SQLRestartDateTime,GetDate())
    SELECT   ROUND(CAST(SUM(num_of_reads) AS FLOAT)/@TimeInSeconds,2) AS READ_IOPS
        , ROUND(CAST(SUM(num_of_writes) AS FLOAT)/@TimeInSeconds,2) AS WRITE_IOPS
        , ROUND(CAST(SUM(num_of_bytes_read) AS FLOAT)/@TimeInSeconds/1000000,3) AS READ_THROUGHPUT
        , ROUND(CAST(SUM(num_of_bytes_written) AS FLOAT)/@TimeInSeconds/1000000,3) AS WRITE_THROUGHPUT
        , CASE WHEN SUM(num_of_reads) = 0 THEN 0 ELSE ROUND((SUM(io_stall_read_ms) / SUM(num_of_reads)), 2) END AS READ_LATENCY
        , CASE WHEN SUM(num_of_writes) = 0 THEN 0 ELSE ROUND((SUM(io_stall_write_ms) / SUM(num_of_writes)), 2) END AS WRITE_LATENCY
    FROM sys.dm_io_virtual_file_stats(null,null)  ${FOR_JSON_PATH}`;

const SQL_BACKUPS = `${SET_NOCOUNT} SELECT
    DISTINCT backupset.database_name as backedupDatabases
    FROM msdb.dbo.backupset AS backupset
    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia
    ON backupset.media_set_id = backupmedia.media_set_id
    WHERE backupmedia.device_type = 2
    AND backupset.type = 'D' ${FOR_JSON_PATH}
`;

// Fetching the default data and log drives of the SQL server
const DEFAULT_SQL_DATA_DRIVE = `${SET_NOCOUNT} DECLARE @DataPath NVARCHAR(500);
EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultData', @DataPath OUTPUT;
SELECT LEFT(@DataPath,1) AS CurrentDataDrive
${FOR_JSON_PATH}`;

// Fetching the default data and log drives of the SQL server
const DEFAULT_SQL_LOG_DRIVE = `${SET_NOCOUNT} DECLARE @LogPath NVARCHAR(500);
EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;
SELECT LEFT(@LogPath,1) AS CurrentLogDrive 
${FOR_JSON_PATH}`;

const DATABASE_NAME_EXISTS = (databaseName: string) =>
    `${SET_NOCOUNT} SELECT name FROM sys.databases WHERE name = '${databaseName}' ${FOR_JSON_PATH}`;

export {
    DATABASES,
    DATABASES_COUNT,
    CPU_UTILISATION,
    DISK_UTILISATION,
    SERVER_VERSION_DETAILS,
    SERVER_EDITION,
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
    SERVER_IO_LATENCY,
    NATIVE_SQL_BACKUPS,
    SERVER_INSTALL_DATE,
    PERFORMANCE_METRICS,
    SQL_BACKUPS,
    DEFAULT_SQL_DATA_DRIVE,
    DEFAULT_SQL_LOG_DRIVE,
    DATABASE_NAME_EXISTS
};
