const GET_SANDBOX_DETAILS = (instances: string[]) => ` 
$instances = (${instances})

$results = foreach ($instance in $instances) {
    try {
        $query = @"
        SET NOCOUNT ON;
        DROP TABLE IF EXISTS #properties;
        
        CREATE TABLE #properties (
            database_name nvarchar(255),
            name nvarchar(255),
            value sql_variant
        );
        
        INSERT INTO #properties
        EXEC sp_MSforeachdb '
            USE [?];
            SELECT database_name = DB_NAME(), l.name, l.value
            FROM sys.databases d
            OUTER APPLY fn_listextendedproperty(default, default, default, default, default, default, default) l
            WHERE d.name = DB_NAME()
            AND database_id > 4
            AND l.name IS NOT NULL
            AND l.value IS NOT NULL ';
        
        SELECT database_name, JSON_QUERY(properties) AS sandbox_properties
        FROM (
            SELECT database_name, JSON_QUERY((SELECT name, value FROM #properties AS p2 WHERE p2.database_name = p1.database_name AND p2.name IN ('source', 'initialCreationDate', 'tag', 'baseSnapshot') FOR JSON PATH)) AS properties
            FROM #properties AS p1
            WHERE name = 'cloned_by' AND value = 'netapp'
        ) AS grouped_properties
        GROUP BY database_name, properties
        FOR JSON PATH; 
"@

        $output = sqlcmd -S $instance -Q $query -y 0 2> $null

        if ($output) {
            [PSCustomObject]@{
                Instance = $instance
                Output = $output
            } | ConvertTo-Json
        }
        else {
            [PSCustomObject]@{
                Instance = $instance
                Output = "No sandboxes created for the instance"
            } | ConvertTo-Json
        }
    }
    catch {
        [PSCustomObject]@{
            Instance = $instance
            Error = "Error executing query on $instance  $_.Exception.Message"
        } | ConvertTo-Json
    }
}

$results
`;

// instances input instances = ['"computername\\instanceName"', '"."']; "." represents the default instance
// ('source', 'initialCreationDate', 'tag', 'baseSnapshot') are the extended properties saved during creation of sandbox

export { GET_SANDBOX_DETAILS };
