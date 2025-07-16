import { execa } from 'execa';
import crypto from 'crypto';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import ms from 'ms';
import zlib from 'zlib';
import { join } from 'node:path';
import logger from './logging';

const GOOGLE_DNS = '8.8.8.8';

const getSqlCredentials = (sqlAuthEnabled: boolean) => `
    $ProgressPreference = 'SilentlyContinue'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlCredentials = $null
    if ($sqlAuthEnabled) {
        $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "60"} -Method PUT -Uri 'http://169.254.169.254/latest/api/token'
        $instanceType = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -Uri "http://169.254.169.254/latest/meta-data/instance-type" -ErrorAction Stop -UseBasicParsing).Content
        $isT3orT2 = (($instanceType.StartsWith("t3")) -or  ($instanceType.StartsWith("t2")))
        $ssmInstallationPath = (Get-Module -Name AWS.Tools.SimpleSystemsManagement -ListAvailable).Path

        if (($vcpus -ge 2) -and (-Not $isT3orT2) -and (-Not [string]::IsNullOrEmpty($ssmInstallationPath))) {
            try {
                $ec2InstanceId = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -Uri "http://169.254.169.254/latest/meta-data/instance-id" -ErrorAction Stop -UseBasicParsing).Content
                $connection = Test-Connection -ComputerName ${GOOGLE_DNS} -Quiet -Count 1
                if ($connection -eq $False) {
                    # Set the registry key to disable certificate revocation check in case of private subnet
                    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
                }
                $sqlCredentials = ((Get-SSMParameter -WithDecryption 1 -Name /netapp/wlmdb/$ec2InstanceId).Value | ConvertFrom-Json)
            } catch {
                $sqlCredentials = $null
            }
        }
    }
`;

const validateSQLInstanceCredentials = `
    $credential = $null
    $sqlCredential = @{}
    if(-Not [string]::IsNullOrEmpty($sqlCredentials)) {
        $credential =  $sqlCredentials.domain.Where({$_.sqlinstancename -eq $serverInstanceName -Or $_.sqlinstancename.toUpper() -eq 'MSSQLSERVER'})[0]
        if (-Not [string]::IsNullOrEmpty($credential) -And -Not [string]::IsNullOrEmpty($credential.username) -And -Not [string]::IsNullOrEmpty($credential.password)) {
            $sqlCredential.add('useDomainAuth', $True)
            $sqlCredential.add('username', $credential.username)
            $sqlCredential.add('password', $credential.password)
        }
        else {
            $sqlCredential.add('useDomainAuth', $False)
            $credential =  $sqlCredentials.sql.Where({$_.sqlinstancename -eq $serverInstanceName})[0] 
            if (-Not [string]::IsNullOrEmpty($credential) -And -Not [string]::IsNullOrEmpty($credential.username) -And -Not [string]::IsNullOrEmpty($credential.password)) {
                $sqlCredential.add('useSqlAuth', $True)
                $sqlCredential.add('username', $credential.username)
                $sqlCredential.add('password', $credential.password)
            }
            else {
                $sqlCredential.add('useSqlAuth', $False)
            }
        }
    }
    else {
        $sqlCredential.add('useDomainAuth', $False)
        $sqlCredential.add('useSqlAuth', $False)
    }
`;

const enableCredSSP = `
    Function Is-CredSSPEnabled {
        try {
            $credsspStatus = Get-WSManCredSSP
            if ($credsspStatus -match "The machine is configured to allow delegating fresh credentials") {
                return $true
            } else {
                return $false
            }
        } catch {
            Write-Information "Error checking CredSSP status: $($_.Exception.Message)"
            return $false
        }
    }

    # Enable CredSSP
    if (-not (Is-CredSSPEnabled)) {
        try {
            $ServerName = '*'
            Start-Transcript -Path C:\\cfn\\log\\EnableCredSSP.ps1.txt -Append | Out-Null
            Enable-WSManCredSSP -Role Client -DelegateComputer $ServerName -Force | Out-Null
            Enable-WSManCredSSP -Role Server -Force | Out-Null

            # Verify CredSSP is enabled
            if (-not (Is-CredSSPEnabled)) {
                throw "Failed to enable CredSSP."
            }
        } catch {
            Write-Error "Error enabling CredSSP: $($_.Exception.Message)"
        }
    }
`;

const disableCredSSP = `
    try {
        # Disable CredSSP
        Start-Transcript -Path C:\\cfn\\log\\DisableCredSSP.ps1.txt -Append | Out-Null
        $ErrorActionPreference = "Stop"

        Disable-WSManCredSSP Client | Out-Null
        Disable-WSManCredSSP Server | Out-Null
        # Verify CredSSP is disabled
        if (Is-CredSSPEnabled) {
            throw "Failed to disable CredSSP."
        }
    } catch {
        Write-Information "Error in DisableCredSSP: $($_.Exception.Message)"
    }
`;

const invokeCommandWithCredSSP = `
    Function Invoke-CommandWithCredSSP {
        param (
            [Parameter(Mandatory = $true)]
            [string]$sqlquery,
            [Parameter(Mandatory = $false)]
            [string]$extraArguments
        )

        if ($extraArguments -ne $null) {
            $extraArguments = $extraArguments
        } else {
            $extraArguments = ''
        }

        $securePassword = ConvertTo-SecureString -String $sqlCredential.password -AsPlainText -Force
        $Credential = New-Object Management.Automation.PSCredential ($sqlCredential.username, $securePassword)

        $scriptblock = {
            param ($sqlquery, $extraArguments)
            Sqlcmd -S $using:serverInstanceName -Q $sqlquery -y 0 $extraArguments 2> $null
        }

        $job = Invoke-Command -ScriptBlock $scriptblock -ArgumentList $sqlquery, $extraArguments -Credential $Credential -ComputerName $env:computername -Authentication credssp -AsJob

        # Check job status and wait for completion
        $timeout = 10 # Timeout in seconds
        $elapsedTime = 0
        $interval = 2 # Check every 2 seconds

        while ($job.State -eq 'Running' -and $elapsedTime -lt $timeout) {
            Wait-Job -Job $job -Timeout $interval | Out-Null
            $elapsedTime += $interval
        }

        if ($job.State -ne 'Completed') {
            # If the job is still running after the timeout, stop and remove it
            Stop-Job -Job $job | Out-Null
            Remove-Job -Job $job | Out-Null
            Throw "The Invoke-Command job did not complete successfully within the timeout period. This could be due to invalid credentials or other issues."
        }

        $sqlresult = Receive-Job -Job $job
        Remove-Job -Job $job | Out-Null
        return $sqlresult
    }
`;

const sqlQueryExecutionWithAuth = (sql: string[], databaseInstanceName: string, sqlAuthEnabled = false) => `
            $queries = @(
                ${
                    // eslint-disable-next-line quotes
                    sql.map(sqlQuery => `'${sqlQuery.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',\n  ')
                }
            )
       
            ${getSqlCredentials(sqlAuthEnabled)}

            $serverInstanceName = '${databaseInstanceName}'
            $instanceName = "$env:COMPUTERNAME"
            if ($serverInstanceName -ne 'MSSQLSERVER') {
                $instanceName = "$env:COMPUTERNAME\\$serverInstanceName"
            }
            try {
                ${validateSQLInstanceCredentials}
                $sqlError = $null
                if ($sqlCredential.useDomainAuth -eq $True) {
                    ${enableCredSSP}
                    ${invokeCommandWithCredSSP}
                }
                $queries | ForEach-Object {
                    try {
                        $query = $_
                        if ($sqlCredential.useDomainAuth -eq $True){
                            $sqlResponse = Invoke-CommandWithCredSSP -sqlquery $query
                        } elseif ($sqlCredential.useSqlAuth -eq $True) {
                            $sqlResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $instanceName -Q $query -y 0 2>> $sqlError
                        }

                        if ($LASTEXITCODE -ne 0 -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
                            $sqlResponse =  sqlcmd -S $instanceName -Q $query -y 0 2>> $sqlError
                        }

                        if ($LASTEXITCODE -ne 0) {
                            throw $sqlError
                        }
                        $results += [PSCustomObject]@{
                                Instance = $instanceName
                                Query = $query
                                Result = $sqlResponse
                            }
                    } catch {
                        $results += [PSCustomObject]@{
                            Instance = $instanceName
                            Query = $query
                            Error = $_.Exception.Message
                        }
                    }
                }
                
                if ($sqlCredential.useDomainAuth -eq $True) {
                    ${disableCredSSP}
                }
                if ([string]::IsNullOrEmpty($sqlResponse) -or $sqlResponse -eq "NULL") {
                    $errorMessage = "SQL response is null or empty. $sqlResponse"
                    Write-Information $errorMessage
                    throw $errorMessage
                }
            } catch {
                $results += [PSCustomObject]@{
                        Instance = $instanceName
                        Query = $query
                        Error = $_.Exception.Message
                    }
            } finally {
                if ($sqlCredential.useDomainAuth -eq $True) {
                    ${disableCredSSP}
                }
            }
`;

function getPowershellScript(sql: string[], databaseInstanceName: string, sqlAuthEnabled: boolean = false) {
    return `
        # PowerShell script to run a set of SQL queries and return the output in user-readable format
        Write-Information "Starting SQL query execution script on instance: ${databaseInstanceName} with SQL Auth Enabled: ${sqlAuthEnabled}"

        $results = @()

        # Define the list of queries
        ${sqlQueryExecutionWithAuth(sql, databaseInstanceName, sqlAuthEnabled)}
        
        $jsonOutput = $results | ConvertTo-Json -Compress
        echo "$jsonOutput"
`;
}

function getBashScript(sql: string[]) {
    return `
        #!/bin/bash
        # Bash script to run a set of SQL queries on PostgreSQL and return the output in user-readable format

        # Define the list of queries
        queries=(
            ${
                // eslint-disable-next-line quotes
                sql.map(sqlQuery => `'${sqlQuery.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',\n  ')
            }
        )

        # Initialize an array to store the results
        results=()

        # Iterate over each query and execute it
        for query in "\${queries[@]}"; do
            result=$(psql -U postgres -d postgres -c "$query" 2>&1)
            if [ $? -eq 0 ]; then
                results+=("{\\"Query\\": \\"$query\\", \\"Result\\": \\"$result\\"}")
            else
                results+=("{\\"Query\\": \\"$query\\", \\"Error\\": \\"$result\\"}")
            fi
        done

        # Convert the results to JSON format
        json_output=$(printf "%s\n" "\${results[@]}" | jq -s .)

        # Write the output to a file or console
        echo "$json_output"
    `;
}

async function runPowerShellScript(scriptContent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const powershell = execa('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-']);

        let output = '';
        let errorOutput = '';

        powershell.stdout?.on('data', (data: Buffer) => {
            output += data.toString();
        });

        powershell.stderr?.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        powershell.on('close', (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`PowerShell script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        powershell.on('error', (err: Error) => {
            reject(err);
        });

        powershell.stdin?.write(scriptContent);
        powershell.stdin?.end();
    });
}

async function runBashScript(scriptContent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const bash = execa('/bin/bash', ['-c', scriptContent]);

        let output = '';
        let errorOutput = '';

        bash.stdout?.on('data', (data: Buffer) => {
            output += data.toString();
        });

        bash.stderr?.on('data', (data: Buffer) => {
            errorOutput += data.toString();
        });

        bash.on('close', (code: number) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Bash script failed with code ${code}: ${errorOutput.trim()}`));
            }
        });

        bash.on('error', (err: Error) => {
            reject(err);
        });
    });
}

// Function to deflate a string using zlib , currently not being used. But can be used in the future when we need to compress the data before sending it to cloud watch
function deflateString(stringToCompress: string) {
    if (!stringToCompress || stringToCompress.trim() === '') {
        logger.info('The string to compress is either null or empty.');
        return null;
    }

    // Compress the string using zlib's deflate method
    const buffer = Buffer.from(stringToCompress, 'utf-8');
    const compressedBuffer = zlib.deflateSync(buffer);

    // Convert the compressed buffer to a Base64-encoded string
    const encodedString = compressedBuffer.toString('base64');

    return encodedString;
}

function deleteOlderFilesInDirectory(directory: string, days: number = 3) {
    logger.info(`Deleting files older than ${days} days in directory: ${directory}`);

    try {
        const files = readdirSync(directory);
        const now = new Date();
        for (const file of files) {
            const filePath = join(directory, file);
            const stats = statSync(filePath);
            const fileAge = now.getTime() - stats.mtimeMs;
            if (fileAge > ms(`${days}d`)) {
                // days in milliseconds
                unlinkSync(filePath);
            }
        }
    } catch (error) {
        logger.error(`Error deleting older files in directory ${directory}:`, error);
    }
}

function generateHash(value: string) {
    const hash = crypto.createHash('shake256', { outputLength: 8 });
    hash.update(value);
    return hash.digest('hex');
}

function safeParseJson(jsonString: string) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        logger.warn(`Failed to parse JSON string: ${jsonString}`, error);
        return jsonString;
    }
}

function hoursAgoTimestamp(hours: number = 24): number {
    return Date.now() - 1000 * 60 * 60 * hours;
}

export {
    getPowershellScript,
    getBashScript,
    runPowerShellScript,
    runBashScript,
    deflateString,
    deleteOlderFilesInDirectory,
    generateHash,
    safeParseJson,
    hoursAgoTimestamp
};
