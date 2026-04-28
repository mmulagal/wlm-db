import { SQL_CASE_INSENSITIVE } from '../../../utils/consts';

const SET_NOCOUNT = 'SET NOCOUNT ON;';
const FOR_JSON_PATH = 'FOR JSON PATH';

// Parameterized DATABASES query - when includeAoag is true, adds LEFT JOINs for AOAG fields
const DATABASES = (includeAoag = false) => {
    const aoagSelectFields = includeAoag
        ? `,
            availabilityGroup = ag.name,
            replicaRole = ars.role_desc,
            synchronizationState = drs.synchronization_state_desc,
            isReadableSecondary = CASE WHEN ar.secondary_role_allow_connections > 0 THEN 1 ELSE 0 END`
        : '';

    const aoagJoins = includeAoag
        ? `
LEFT JOIN sys.dm_hadr_database_replica_states drs ON drs.database_id = d.database_id AND drs.is_local = 1
LEFT JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
LEFT JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = drs.replica_id AND ars.is_local = 1
LEFT JOIN sys.availability_groups ag ON ag.group_id = ar.group_id`
        : '';

    return `${SET_NOCOUNT} SELECT (SELECT 
            databaseId = d.database_id,
            databaseName = d.name,
            creationDate = d.create_date,
            databaseStatus = d.state_desc,
            databaseSize = t.databaseSize,
            collationName = d.collation_name${aoagSelectFields}
            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))
            FROM sys.master_files GROUP BY database_id ) t 
            JOIN sys.databases d ON d.database_id = t.database_id${aoagJoins}
            ORDER BY d.name
            ${FOR_JSON_PATH}) as databases`;
};

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

const SERVER_GUID = `${SET_NOCOUNT} SELECT service_broker_guid AS serverGuid FROM sys.databases WHERE name ${SQL_CASE_INSENSITIVE} = 'msdb' ${FOR_JSON_PATH}`;

const SERVER_NAME = `${SET_NOCOUNT} SELECT @@SERVERNAME as serverName ${FOR_JSON_PATH}`;

const SERVER_INSTALL_DATE = `${SET_NOCOUNT} SELECT create_date AS creationDate FROM sys.server_principals WITH (NOLOCK) WHERE name ${SQL_CASE_INSENSITIVE} = N'NT AUTHORITY\\SYSTEM' OR name ${SQL_CASE_INSENSITIVE} = N'NT AUTHORITY\\NETWORK SERVICE' ${FOR_JSON_PATH}`;
const SERVER_PROPERTIES = ` ${SET_NOCOUNT} SELECT SERVERPROPERTY('Edition') AS ServerEdition, SERVERPROPERTY('IsClustered') as isClustered, SERVERPROPERTY('ComputerNamePhysicalNetBIOS') as activeNode, @@version AS serverDetails, @@SERVERNAME as serverName ${FOR_JSON_PATH}`;
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
    AND backupset.type ${SQL_CASE_INSENSITIVE} = 'D' ${FOR_JSON_PATH}
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

// Since TempDB is recreated every time, we can use that to calculate the our start up time hence database_id=2
const PERFORMANCE_METRICS_WITH_LATENCY = `${SET_NOCOUNT} DECLARE @SQLRestartDateTime Datetime
DECLARE @TimeInSeconds Float
SELECT @SQLRestartDateTime = create_date FROM sys.databases WHERE database_id = 2
SET @TimeInSeconds = Datediff(s,@SQLRestartDateTime,GetDate())

SELECT   
    READ_IOPS,
    WRITE_IOPS,
    READ_THROUGHPUT,
    WRITE_THROUGHPUT,
    READ_LATENCY,
    WRITE_LATENCY,
    SERVER_IO_LATENCY,
    [assessment] = 
            CASE 
                WHEN SERVER_IO_LATENCY = 0 THEN 'N/A' 
                ELSE 
                    CASE WHEN SERVER_IO_LATENCY <= 1 THEN 'Excellent ( <=1 ms )'
                         WHEN SERVER_IO_LATENCY < 5 THEN 'Very good ( <5 ms )'
                         WHEN SERVER_IO_LATENCY < 10 THEN 'Good ( <10 ms )'
                         WHEN SERVER_IO_LATENCY < 20 THEN 'Poor ( <20 ms )'
                         WHEN SERVER_IO_LATENCY < 100 THEN 'Bad ( <100 ms )'
                         WHEN SERVER_IO_LATENCY < 500 THEN 'Very bad ( <500 ms )'
                         WHEN SERVER_IO_LATENCY >= 500 THEN 'Awful ( >=500 ms )'
                    END 
            END
FROM (
    SELECT   
        ROUND(CAST(SUM(num_of_reads) AS FLOAT)/@TimeInSeconds,2) AS READ_IOPS,
        ROUND(CAST(SUM(num_of_writes) AS FLOAT)/@TimeInSeconds,2) AS WRITE_IOPS,
        ROUND(CAST(SUM(num_of_bytes_read) AS FLOAT)/@TimeInSeconds/1000000,3) AS READ_THROUGHPUT,
        ROUND(CAST(SUM(num_of_bytes_written) AS FLOAT)/@TimeInSeconds/1000000,3) AS WRITE_THROUGHPUT,
        CASE WHEN SUM(num_of_reads) = 0 THEN 0 ELSE ROUND((SUM(io_stall_read_ms) / SUM(num_of_reads)), 2) END AS READ_LATENCY,
        CASE WHEN SUM(num_of_writes) = 0 THEN 0 ELSE ROUND((SUM(io_stall_write_ms) / SUM(num_of_writes)), 2) END AS WRITE_LATENCY,
        CASE WHEN (SUM(num_of_reads) = 0 AND SUM(num_of_writes) = 0) THEN 0 ELSE ROUND((CAST (SUM(io_stall) AS FLOAT) / (SUM(num_of_reads) + SUM(num_of_writes))), 2) END
        AS SERVER_IO_LATENCY
    FROM sys.dm_io_virtual_file_stats(null,null)
) AS subquery ${FOR_JSON_PATH}`;

const SQL_BACKUPS = `${SET_NOCOUNT} SELECT
    DISTINCT backupset.database_name as backedupDatabases
    FROM msdb.dbo.backupset AS backupset
    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia
    ON backupset.media_set_id = backupmedia.media_set_id
    WHERE backupmedia.device_type = 2
    AND backupset.type ${SQL_CASE_INSENSITIVE} = 'D' ${FOR_JSON_PATH}
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

const SERVER_DETAILS = `
    ${SET_NOCOUNT}
    SELECT
        (
            SELECT NodeName, is_current_owner
            FROM sys.dm_os_cluster_nodes
            FOR JSON PATH
        ) AS clusterNodesInfo,
        (
        SELECT COUNT(1) 
        FROM sys.dm_exec_sessions 
        WHERE host_process_id is NOT NULL
        ) AS numberOfConnections,
        SERVERPROPERTY('Edition') AS ServerEdition,
        SERVERPROPERTY('EngineEdition') AS sqlEngineEdition,
        SERVERPROPERTY('IsClustered') AS isClustered,
        SERVERPROPERTY('IsHadrEnabled') AS isHadrEnabled,
        SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS activeNode,
        @@version AS serverDetails,
        @@SERVERNAME AS clusterName,
        (SELECT COUNT(*) FROM sys.databases) AS totalCount,
        SERVERPROPERTY('Collation') AS ServerCollation
        ${FOR_JSON_PATH}`;

const INSTANCE_GUID = `${SET_NOCOUNT} SELECT [service_broker_guid] as instance_guid FROM sys.databases WHERE [name] ${SQL_CASE_INSENSITIVE} = N'msdb' ${FOR_JSON_PATH}`;

const ENTERPRISE_CHECK_QUERY = ` ${SET_NOCOUNT} IF(SELECT CASE WHEN CONVERT(sysname, SERVERPROPERTY('EngineEdition')) = '3' THEN 1 ELSE 0 END )=1
    BEGIN
        -- SQL Server is Enterprise Edition
        IF OBJECT_ID('tempdb.dbo.#EnterpriseFeaturesDB') IS NOT NULL
        DROP TABLE #EnterpriseFeaturesDB
        
        CREATE TABLE #EnterpriseFeaturesDB
        (
        DatabaseName Varchar(100),
        Feature_Name Varchar(100)
        )
        EXEC sp_msforeachdb
        N' USE [?]
        IF (SELECT COUNT(*) FROM sys.dm_db_persisted_sku_features) >0
        BEGIN
        INSERT INTO #EnterpriseFeaturesDB
        SELECT DatabaseName=DB_NAME(),Feature_Name
        FROM sys.dm_db_persisted_sku_features
        END '
    
        -- Create a table to store the results
        CREATE TABLE #Results (IsUsingFeature INT, FeatureDescription VARCHAR(100))
    
        -- Modify each SELECT statement to insert into the results table
        INSERT INTO #Results
        SELECT IIF(count(1)>0,1,0),'User Databases are using Enterprise Level Features'
        FROM #EnterpriseFeaturesDB
        Union
        SELECT IIF(count(1)>0,1,0), 'You have Availability Groups with > 1 database' AS Enterprise_Feature
        FROM sys.availability_databases_cluster Databaselist
        INNER JOIN sys.availability_groups_cluster Groups ON Databaselist.group_id = Groups.group_id
        GROUP BY [name] HAVING COUNT([database_name]) >1
        UNION
        SELECT IIF(count(1)>0,1,0), 'You have read-only Replicas' AS Enterprise_Feature
        from sys.availability_replicas
        WHERE secondary_role_allow_connections <> 0
        UNION
        SELECT IIF(count(1)>0,1,0), 'You have Asynchronous commit Replicas'
        FROM sys.availability_replicas
        WHERE availability_mode=0
        UNION
        SELECT IIF(count(1)>0,1,0), 'You are using Resource Governor'
        FROM sys.dm_resource_governor_resource_pools
        WHERE name NOT IN ('internal','default')
        UNION
        SELECT IIF(count(1)>0,1,0), 'You are using peer-to-peer replication'
        FROM sys.dm_repl_articles
        WHERE intPublicationOptions = 0x1
        UNION
        SELECT IIF(count(1)>0,1,0), 'You are using R or Python extensions'
        FROM sys.dm_external_script_requests
        WHERE language IN ('R','Python')
        UNION
        SELECT IIF(count(1)>0,1,0), 'Tempdb metadata memory-optimized is enabled'
        FROM sys.configurations
        WHERE name = N'tempdb metadata memory-optimized'
        AND value_in_use = 1
        UNION
        SELECT IIF(count(1)>48,1,0),'SQL Server has > 48 vCPU'
        FROM sys.dm_os_schedulers WITH (NOLOCK)
        WHERE scheduler_id < 255 and [status] = 'VISIBLE ONLINE'
        UNION
        SELECT IIF(count(1)>0,1,0), 'SQL Server has > 128 GB Memory'
        FROM sys.dm_os_sys_memory
        WHERE total_physical_memory_kb/1024/1024 > 128
        UNION
        SELECT IIF(count(1)>0,1,0), 'You are using asynchronous mirroring'
        from sys.database_mirroring
        WHERE mirroring_safety_level = 1
    
        -- Finally, select from the results table using the FOR JSON clause
        SELECT * FROM #Results ${FOR_JSON_PATH}
    END`;

const DATABASES_COUNT_V2 = `${SET_NOCOUNT} SELECT COUNT(*) AS totalCount FROM sys.databases ${FOR_JSON_PATH}`;

const SERVER_VERSION = `${SET_NOCOUNT} SELECT @@VERSION AS version ${FOR_JSON_PATH}`;

// GH-2091: Replaced sp_MSforeachdb with cursor-based iteration.
// sp_MSforeachdb is undocumented and causes tempdb transaction log overflow
// on instances with 1000+ databases (Msg 9002: tempdb full due to ACTIVE_TRANSACTION).
// This cursor only iterates ONLINE user databases and queries sys.extended_properties
// directly per-database with TRY/CATCH isolation, avoiding tempdb pressure.
const GET_SANDBOXES = `
    ${SET_NOCOUNT}
    DROP TABLE IF EXISTS #properties;
    CREATE TABLE #properties (database_name NVARCHAR(255), name NVARCHAR(255), value SQL_VARIANT);

    DECLARE @dbName NVARCHAR(255);
    DECLARE @sql NVARCHAR(MAX);

    DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT name FROM sys.databases WHERE database_id > 4 AND state_desc = 'ONLINE';

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor INTO @dbName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'SELECT N''' + REPLACE(@dbName, '''', '''''') + ''' AS database_name, name, value FROM [' + REPLACE(@dbName, ']', ']]') + '].sys.extended_properties WHERE class = 0 AND major_id = 0 AND minor_id = 0 AND name IN (N''source'', N''createdAt'', N''tag'', N''updatedAt'', N''cloned_by'', N''accountId'')';
        BEGIN TRY
            INSERT INTO #properties EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
        END CATCH
        FETCH NEXT FROM db_cursor INTO @dbName;
    END

    CLOSE db_cursor;
    DEALLOCATE db_cursor;

    SELECT (SELECT database_name, JSON_QUERY(properties) AS sandbox_properties
    FROM (
        SELECT database_name, JSON_QUERY((SELECT name, CAST(value AS NVARCHAR(MAX)) AS value FROM #properties AS p2 WHERE p2.database_name = p1.database_name FOR JSON PATH)) AS properties
        FROM #properties AS p1
    ) AS grouped_properties
    GROUP BY database_name, properties
    ${FOR_JSON_PATH}) as sandboxes;

    DROP TABLE IF EXISTS #properties;
`;

const INSTANCE_DATA_DRIVES_QUERY = `${SET_NOCOUNT} 
        select (select distinct LEFT(physical_name, 2) as drives from sys.master_files where type_desc ${SQL_CASE_INSENSITIVE} = 'ROWS'  FOR JSON AUTO) as dataDrives`;

const DEFAULT_DATA_DRIVE_SIZE = `${SET_NOCOUNT}
        SELECT 
            DISTINCT (LEFT(mf.physical_name, 2)) AS dataDriveLetter,
            ISNULL(vs.total_bytes / 1048576, 0) AS dataDriveTotalSizeMB
        FROM 
            sys.master_files mf
       
        CROSS APPLY 
            sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
            
        WHERE mf.name ${SQL_CASE_INSENSITIVE} = 'master'
        
        ORDER BY 
            dataDriveLetter ${FOR_JSON_PATH}
`;

const DEFAULT_LOG_DRIVE_SIZE = `${SET_NOCOUNT}
        SELECT
        total_bytes/1024/1024 --/1024
        FROM sys.master_files mf 
        CROSS APPLY sys.dm_os_volume_stats(mf.database_id,mf.file_id)
        WHERE ((SELECT LEFT(volume_mount_point,1)) = (SELECT LEFT(CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS varchar(38)),1)))
        GROUP BY
        volume_mount_point
        ,total_bytes/1024/1024 --/1024
        ,available_bytes/1024/1024 --/1024
        ,CONVERT(INT,CONVERT(DECIMAL(15,2),available_bytes) / total_bytes * 100)
`;

const TEMPDB_DRIVE_SIZE = `${SET_NOCOUNT}
            SELECT 
                LEFT(d.filename, 2) AS tempdbDriveLetter,
                mf.physical_name AS tempdbDrivePath,
                ISNULL(vs.total_bytes / 1048576, 0) AS tempdbDriveTotalSizeMB
            FROM 
                tempdb.sys.sysfiles d
            JOIN
                sys.master_files mf ON d.name = mf.name AND d.name = 'tempdev'
            CROSS APPLY 
                sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
            ORDER BY 
                tempdbDriveLetter ${FOR_JSON_PATH}
`;

const INSTANCE_LOG_DRIVES_QUERY = `${SET_NOCOUNT}
        select (select distinct LEFT(physical_name, 2) as drives from sys.master_files where type_desc ${SQL_CASE_INSENSITIVE} = 'LOG'  FOR JSON AUTO) as logDrives`;

const INSTANCE_TEMPDB_DRIVES_QUERY = `${SET_NOCOUNT}
        SELECT DISTINCT(SELECT LEFT(physical_name, 1))FROM tempdb.sys.database_files;`;

const INSTANCE_USER_DB_DRIVE_SIZES = `
        ${SET_NOCOUNT}
        SELECT (SELECT 
            d.name AS databaseName,
            LEFT(mf.physical_name, 2) AS dataDriveLetter,
            ISNULL(vs.total_bytes / 1048576, 0) AS dataDriveTotalSizeMB
        FROM 
            sys.databases d
        JOIN 
            sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 0
        CROSS APPLY 
            sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
        WHERE 
            d.database_id > 4 or d.name ${SQL_CASE_INSENSITIVE} like '%msdb%'
        ORDER BY 
            d.name ${FOR_JSON_PATH}) as userDatabasesDriveSizes`;

const INSTANCE_LOG_DB_DRIVE_SIZES = `
            ${SET_NOCOUNT}
            SELECT (SELECT 
                d.name AS databaseName,
                LEFT(mf.physical_name, 2) AS logDriveLetter,
                mf.physical_name AS logDrivePath,
                ISNULL(vs.total_bytes / 1048576, 0) AS logDriveTotalSizeMB
            FROM 
                sys.databases d
            JOIN 
                sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 1
            CROSS APPLY 
                sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
            WHERE 
                d.database_id > 4 or d.name ${SQL_CASE_INSENSITIVE} like '%msdb%'
            ORDER BY 
                d.name ${FOR_JSON_PATH}) as userDatabasesLogDriveSizes`;

const SERVER_VERSION_EDITION_DETAILS = `
    ${SET_NOCOUNT}
    SELECT
        SERVERPROPERTY('Edition') AS sqlServerEdition,
        SERVERPROPERTY('EngineEdition') AS sqlServerEngineEdition,
        SERVERPROPERTY('MachineName') AS sqlServerName,
        SERVERPROPERTY('ProductVersion') AS sqlServerVersion,
        SERVERPROPERTY('IsIntegratedSecurityOnly') As windowsAuthentication,
        SERVERPROPERTY('IsHadrEnabled') AS isHadrEnabled,
        SERVERPROPERTY('IsClustered') AS isClustered
    ${FOR_JSON_PATH}
`;

export {
    DATABASES,
    DATABASES_COUNT,
    CPU_UTILISATION,
    DISK_UTILISATION,
    SERVER_PROPERTIES,
    NUMBER_OF_CONNECTIONS,
    TABLES_QUERY,
    TABLES_COUNT_QUERY,
    MEMORY_UTILISATION,
    SERVER_GUID,
    SERVER_NAME,
    CLUSTER_NODES,
    DB_SIZE,
    SERVER_IO_LATENCY,
    NATIVE_SQL_BACKUPS,
    SERVER_INSTALL_DATE,
    PERFORMANCE_METRICS,
    PERFORMANCE_METRICS_WITH_LATENCY,
    SQL_BACKUPS,
    DEFAULT_SQL_DATA_DRIVE,
    DEFAULT_SQL_LOG_DRIVE,
    DATABASE_NAME_EXISTS,
    SERVER_DETAILS,
    INSTANCE_GUID,
    ENTERPRISE_CHECK_QUERY,
    DATABASES_COUNT_V2,
    SERVER_VERSION,
    GET_SANDBOXES,
    INSTANCE_TEMPDB_DRIVES_QUERY,
    INSTANCE_DATA_DRIVES_QUERY,
    INSTANCE_LOG_DRIVES_QUERY,
    DEFAULT_DATA_DRIVE_SIZE,
    DEFAULT_LOG_DRIVE_SIZE,
    TEMPDB_DRIVE_SIZE,
    INSTANCE_USER_DB_DRIVE_SIZES,
    INSTANCE_LOG_DB_DRIVE_SIZES,
    SERVER_VERSION_EDITION_DETAILS
};
