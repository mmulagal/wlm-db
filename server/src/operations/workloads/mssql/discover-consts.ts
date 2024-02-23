const hostAndSqlInfoPowerShellScript = [
    `
    $body = @{}

    (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}) | SELECT Name, State, PathName | ForEach {
    
        $instance = $_.Name -Replace "MSSQL\\$", ""
        $state = $_.State
        $path = $_.PathName  -Replace "-s.*",""
    
        If (Get-Command sqlcmd) {
            $serverInstance = If ($instance -ne "MSSQLSERVER") { "$Env:ComputerName\\$instance" } Else { "$Env:ComputerName" }
            sqlcmd -Q "SELECT @@serviceName" -C -S $serverInstance -l 1 2> Out-Null | Out-Null
            $body['windowsAuthentication'] = $?
        } else {
            $body['windowsAuthentication'] = $False
        }

        $info = Invoke-Expression -Command "(dir $path).VersionInfo"
        $productversion = $info.ProductVersion
        $sqlversion = $info.FileVersionRaw.Major
    
        $body['sqlServerInstance'] = $instance
        $body['sqlServerState'] = $state
        $body['sqlServerVersion'] = $productversion
        $body['sqlServerEdition'] = $sqlversion
    
        Echo $body | ConvertTo-Json
    } | ConvertFrom-Json | ConvertTo-Json
    `
];

// eslint-disable-next-line import/prefer-default-export
export { hostAndSqlInfoPowerShellScript };
