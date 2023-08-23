const DOCUMENTNAME = 'AWS-RunPowerShellScript';
const DATABASES = (offset: number, rowscount: number) =>
    `SELECT databaseId = d.database_id, databaseName = d.name, creationDate = d.create_date, databaseStatus = d.state_desc, databaseSize = t.databaseSize FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)), databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2)) FROM sys.master_files GROUP BY database_id ) t JOIN sys.databases d ON d.database_id = t.database_id order by name offset ${offset} rows fetch next ${rowscount} rows only`;
const PSSCRIPT = ' C:\\SSM\\ExecuteQueryFromSSM.ps1';

export { DOCUMENTNAME, DATABASES, PSSCRIPT };
