const PSSCRIPT = ' C:\\SSM\\ExecuteQueryFromSSM.ps1';
const SSM_RUN_POWERSHELL_SCRIPT_DOC = 'AWS-RunPowerShellScript';
const SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION = '1';
const DB_ROWS_COUNT = 75;

const DATABASES = (offset: number, rowscount: number) =>
    `SELECT databaseId = d.database_id, databaseName = d.name, creationDate = d.create_date, databaseStatus = d.state_desc, databaseSize = t.databaseSize FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name offset ${offset} rows fetch next ${rowscount} rows only`;

const DATABASES_COUNT = () =>
    'SELECT COUNT(DISTINCT d.database_id) AS totalCount FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id';

const CPU_UTILISATION = `DECLARE @ts BIGINT;
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
                                ORDER BY record_id DESC;`;

const DB_SIZE = 'SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files';

const DISK_UTILISATION = `WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum
                                FROM sys.master_files mf1)
                                ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID
                                FROM presel pr
                                WHERE pr.RowNum = 1)

                                SELECT ovs.total_bytes AS total, ovs.available_bytes AS remaining
                                FROM roundtwo mf
                                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs`;

const MEMORY_UTILISATION = `SELECT
                                (processmem.physical_memory_in_use_kb * 1024) AS used,
                                (sysmem.total_physical_memory_kb * 1024) AS total,
                                ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,
                                 ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed
                                 FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem;`;

const SERVER_GUID = `SELECT service_broker_guid AS serverGuid
                     FROM sys.databases
                     WHERE name = 'msdb'`;

const SERVER_NAME = 'SELECT @@SERVERNAME as serverName;';

export {
    DB_ROWS_COUNT,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION,
    DATABASES,
    DATABASES_COUNT,
    PSSCRIPT,
    CPU_UTILISATION,
    DISK_UTILISATION,
    DB_SIZE,
    MEMORY_UTILISATION,
    SERVER_GUID,
    SERVER_NAME
};
