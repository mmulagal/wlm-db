/**
 * MSSQL One-Time Assessment Script
 *
 * This script generates a standalone PowerShell script that can be run on Windows
 * hosts to collect MSSQL database and storage assessment data.
 */

import { SQL_CASE_INSENSITIVE } from '../../../../utils/consts';
import { OFFLINE_ASSESSMENT_LOG_PATH } from '../../../workloads/mssql/const';
import {
    invokeOntapRequestTemplate,
    mappedVolumesHelperFunctions,
    volumeDetailsAssessmentTemplate,
    lunDetailsAssessmentTemplate,
    osConfigAssessmentTemplate,
    storageLayoutAssessmentTemplate,
    maxDopAssessmentTemplate,
    highAvailabilityAssessmentTemplate,
    hostLevelHighAvailabilityAssessmentTemplate
} from '../../../workloads/mssql/common-templates';
import { slqcmdExecutionTemplate, buildAoagQuery } from '../../../workloads/mssql/ssm-script-utils';
import { TEST_ISCSI_SESSIONS } from '../../../workloads/mssql/storage-scripts';
import { GET_RSS_CONFIG_DETAILS } from '../../../workloads/mssql/assessment-scripts';
import { INSTANCE_GUID, SERVER_DETAILS, ENTERPRISE_CHECK_QUERY } from '../../../workloads/mssql/queries';

/**
 * Version of the offline assessment script.
 */
const OFFLINE_ASSESSMENT_SCRIPT_VERSION = '1.0.0';

const MSSQL_ONE_TIME_WAD = `
#=====================================================================================
#        NETAPP CONSOLE WORKLOAD FACTORY - MSSQL SERVER ONE TIME ASSESSMENT COLLECTOR
#        Version 1.0.0
#        Copyright (c) 2026 NetApp, Inc. All rights reserved.
#=====================================================================================

#Requires -Version 5.1
<#
.SYNOPSIS
    MSSQL One Time Assessment Script for NetApp ONTAP Storage
.DESCRIPTION
    This script performs a comprehensive assessment of your SQL Server environment
    and its storage configuration on NetApp ONTAP storage systems (Amazon FSx forNetApp ONTAP). 
    It collects:
    - SQL Server instance configuration and version information
    - Mapped ONTAP volumes and LUN details
    - Storage configuration best practices analysis
    - High availability settings (FCI/AOAG)
    - Enterprise feature usage for license optimization
    
    The assessment results are saved to a JSON file. By default, files are saved
    in the current working directory. You can specify a custom output path using
    the -OutputPath parameter.
.PARAMETER StorageManagementAddress
    The storage system identifier that uniquely identifies the Amazon FSx for NetApp
    ONTAP file system to be assessed. This parameter is required and must be provided
    in one of three formats:
    
    Option 1 - FSx Management FQDN (Fully Qualified Domain Name):
    - Format: Valid domain name (e.g., management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com)
    - Example: management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com
    - This is the fully qualified domain name of your FSx for ONTAP file system's
      management endpoint
    - The management FQDN is the DNS-resolvable hostname used to access the ONTAP REST API
      for administrative operations
    - You can find the management FQDN in the AWS Console under FSx file system
      details (ONTAP Configuration > Management Endpoint), or by using the AWS CLI:
      aws fsx describe-file-systems --file-system-id <fsx-id> --query
      'FileSystems[0].OntapConfiguration.Endpoints.Management.DNSName'
    - Ensure this FQDN is resolvable from the host where the script is running
      and that network connectivity is available on the management network
    - When a management FQDN is provided, the script will use it directly to connect
      to the FSx ONTAP storage system
    
    Option 2 - FSx Management IP Address:
    - Format: Valid IPv4 address (e.g., 10.0.1.100)
    - Example: 192.168.1.50
    - This is the management IP address of your FSx for ONTAP file system's
      management endpoint
    - The management IP is the network endpoint used to access the ONTAP REST API
      for administrative operations
    - You can find the management IP in the AWS Console under FSx file system
      details (ONTAP Configuration > Management Endpoint), or by using the AWS CLI:
      aws fsx describe-file-systems --file-system-id <fsx-id> --query
      'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]'
    - Ensure this IP address is reachable from the host where the script is running
      and that network connectivity is available on the management network
    - When a management IP is provided, the script will use it directly to connect
      to the FSx ONTAP storage system
    
    Option 3 - FSx File System ID:
    - Format: fs-xxxxxxxxxxxxxxxxx (where x is alphanumeric)
    - Example: fs-0123456789abcdef0
    - This is the AWS file system ID that uniquely identifies your FSx for ONTAP
      file system. You can find this ID in the AWS Console under FSx, or by using
      the AWS CLI command: aws fsx describe-file-systems
    - When an FSx ID is provided, the script will automatically construct the
      management endpoint using the format: management.<fsx-id>.fsx.<region>.amazonaws.com
    - If the management domain cannot be resolved, the script will fall back to
      retrieving the management IP address from AWS FSx API
    
    The script automatically detects which format you've provided by checking if
    the value matches a valid domain name pattern (FQDN), matches an IPv4 address pattern
    (management IP), or starts with "fs-" (FSx ID). The StorageManagementAddress
    is used to authenticate and connect to the FSx ONTAP storage system to retrieve volume
    details, LUN information, storage configuration, and aggregate capacity data during the assessment.
    
.PARAMETER SqlInstanceName
    The name of the SQL Server instance to assess. This parameter is required and
    specifies which SQL Server database instance on the local host should be
    evaluated for workload assessment and discovery.
    
    For the Default SQL Server Instance:
    - Use the literal string: 'MSSQLSERVER' (case-insensitive)
    - This is the standard name for the default SQL Server instance that was
      installed without specifying a custom instance name
    - The default instance listens on the standard SQL Server port (1433) and
      can be accessed using just the server hostname or IP address
    - Example: If your server is named "SQLSERVER01" and you installed SQL Server
      as the default instance, use: -SqlInstanceName MSSQLSERVER
    
    For Named SQL Server Instances:
    - Use the exact instance name as it was configured during SQL Server installation
    - Example: If you installed SQL Server with instance name "PROD", use: -SqlInstanceName PROD
    - Example: If you installed SQL Server with instance name "SQLInstance1", use:
      -SqlInstanceName SQLInstance1
    - Named instances can be accessed using the format: <hostname>\\<instancename>
      or <hostname>\\<instancename>,<port>
    
    The script uses this instance name to:
    - Connect to SQL Server using Windows Authentication (preferred) or SQL Authentication
    - Query SQL Server system views and dynamic management views (DMVs) to collect
      database configuration, version information, and volume mappings
    - Identify which databases and files are stored on ONTAP volumes
    - Assess high availability configurations (FCI, AOAG) for the specific instance
    - Collect enterprise feature usage for license optimization analysis
    
    Note: The script will attempt to connect using multiple instance name formats
    (e.g., COMPUTERNAME\\InstanceName) if the initial connection fails. Ensure
    the SQL Server instance is running and accessible before running the assessment.
.PARAMETER OutputPath
    Optional. The directory path where JSON output files should be created.
    If the path doesn't exist, it will be created. If the path cannot be used
    (e.g., permission denied), files will be created in the current working
    directory instead.
.EXAMPLE
    .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com -SqlInstanceName MSSQLSERVER
    Runs assessment using ONTAP management FQDN for the default SQL instance.
.EXAMPLE
    .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress 10.0.1.100 -SqlInstanceName SQLInstance1
    Runs assessment using ONTAP management IP for a named SQL instance.
.EXAMPLE
    .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress fs-0123456789abcdef0 -SqlInstanceName MSSQLSERVER
    Runs assessment using FSx for ONTAP file system ID for the default SQL instance.
.EXAMPLE
    .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress fs-0123456789abcdef0 -SqlInstanceName MSSQLSERVER -OutputPath "C:\\AssessmentResults"
    Runs assessment and saves JSON files to the specified output directory.
.NOTES
    Version: ${OFFLINE_ASSESSMENT_SCRIPT_VERSION}
    Requires: PowerShell 5.1 or later, SQL Server sqlcmd utility
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$StorageManagementAddress,

    [Parameter(Mandatory = $true)]
    [string]$SqlInstanceName,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = $null
)

$StorageManagementAddress = $StorageManagementAddress.Trim()
$SqlInstanceName = $SqlInstanceName.Trim()
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = $OutputPath.Trim()
}

# Script Version
$ScriptVersion = "${OFFLINE_ASSESSMENT_SCRIPT_VERSION}"

# Determine if StorageManagementAddress is an FSx ID, Management IP, or FQDN
# FSx IDs start with "fs-" followed by alphanumeric characters
$FSxID = $null
$ManagementIP = $null
$ManagementFQDN = $null

$script:LogFilePath = $null

Function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter(Mandatory = $false)]
        [ValidateSet("INFO", "WARNING", "ERROR", "DEBUG")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to console with color based on level (DEBUG messages skip console output)
    if ($Level -ne "DEBUG") {
        switch ($Level) {
            "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
            "ERROR" { Write-Host $logMessage -ForegroundColor Red }
            default { Write-Host $logMessage }
        }
    }
    
    # Write to log file if path is set
    if ($script:LogFilePath) {
        Add-Content -Path $script:LogFilePath -Value $logMessage -ErrorAction SilentlyContinue
    }
}

if ($StorageManagementAddress -match '^fs-[a-zA-Z0-9]+$') {
    $FSxID = $StorageManagementAddress
    Write-Log "StorageManagementAddress detected as FSx ID: $FSxID"
} else {
    # Check if it's a valid IP address (IPv4)
    $ipAddress = $null
    $isValidIP = [System.Net.IPAddress]::TryParse($StorageManagementAddress, [ref]$ipAddress)
    
    if ($isValidIP -and $ipAddress.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
        $ManagementIP = $StorageManagementAddress
        Write-Log "StorageManagementAddress detected as Management IP: $ManagementIP"
    } else {
        # FQDN pattern: alphanumeric, dots, hyphens, must contain at least one dot
        if ($StorageManagementAddress -match '^[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?)+$') {
            $ManagementFQDN = $StorageManagementAddress
            Write-Log "StorageManagementAddress detected as Management FQDN: $ManagementFQDN"
        } else {
            $errorMessage = "Invalid StorageManagementAddress format: '$StorageManagementAddress'. StorageManagementAddress must be either a valid FQDN (Fully Qualified Domain Name), a valid IPv4 Management IP address, or an FSx ID (format: fs-xxxxxxxxxxxxxxxxx)."
            Write-Log -Level "ERROR" -Message $errorMessage
            Write-Log -Level "ERROR" -Message "Usage: .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress <FQDN, ManagementIP, or FSxID> -SqlInstanceName <InstanceName>"
            throw $errorMessage
        }
    }
}

# Validate SqlInstanceName parameter
if ([string]::IsNullOrWhiteSpace($SqlInstanceName)) {
    Write-Log -Level "ERROR" -Message "No SQL Server instance name provided. Please specify an instance name using the -SqlInstanceName parameter."
    Write-Log -Level "ERROR" -Message "Usage: .\\NetApp_WF_MSSQL_Assessment_v${OFFLINE_ASSESSMENT_SCRIPT_VERSION}.ps1 -StorageManagementAddress <FQDN, ManagementIP, or FSxID> -SqlInstanceName <InstanceName>"
    throw "No SQL Server instance name provided. Please specify an instance name using the -SqlInstanceName parameter."
}

$extractedInstanceName = $SqlInstanceName
if ($SqlInstanceName -match '^[^\\\\/]+[\\\\/](.+)$') {
    $extractedInstanceName = $Matches[1]
    Write-Log -Level "DEBUG" -Message "Extracted instance name '$extractedInstanceName' from '$SqlInstanceName'"
}

Function Get-CredentialFromWindowsCredentialManager {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$TargetNames
    )
    
    try {
        foreach ($targetName in $TargetNames) {
            try {
                $storedCred = Get-StoredCredential -Target $targetName -ErrorAction SilentlyContinue
                if ($storedCred) {
                    Write-Log "Found credential for '$targetName' in Windows Credential Manager"
                    $password = $storedCred.GetNetworkCredential().Password
                    return @{
                        Username = $storedCred.UserName
                        Password = $password
                        Source = "WindowsCredentialManager"
                    }
                } else {
                    Write-Log -Level "DEBUG" -Message "Credential not found in Windows Credential Manager for target: $targetName"
                }
            } catch {
                Write-Log -Level "DEBUG" -Message "Error retrieving credential '$targetName' from Windows Credential Manager: $($_.Exception.Message)"
            }
        }
        return $null
    } catch {
        Write-Log -Level "DEBUG" -Message "Error accessing Windows Credential Manager: $($_.Exception.Message)"
        return $null
    }
}

Function Get-CredentialFromSecretsManager {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$SecretNames,
        [Parameter(Mandatory = $true)]
        [string]$Region,
        [Parameter(Mandatory = $true)]
        [string]$CredentialType
    )
    
    try {
        Write-Log "Attempting to retrieve $CredentialType credentials from AWS Secrets Manager..."
        
        if (-not (Get-Command -Name "Get-SECSecretValue" -ErrorAction SilentlyContinue)) {
            $awsSecretsManagerModule = "AWS.Tools.SecretsManager"
            if (Get-Module -ListAvailable -Name $awsSecretsManagerModule) {
                try {
                    Import-Module -Name $awsSecretsManagerModule -ErrorAction Stop
                    Write-Log -Level "DEBUG" -Message "Successfully imported AWS.Tools.SecretsManager module"
                    if (-not (Get-Command -Name "Get-SECSecretValue" -ErrorAction SilentlyContinue)) {
                        Write-Log -Level "WARNING" -Message "Get-SECSecretValue cmdlet not available after importing module. Cannot retrieve credentials from Secrets Manager."
                        return $null
                    }
                } catch {
                    Write-Log -Level "WARNING" -Message "Failed to import AWS.Tools.SecretsManager module: $($_.Exception.Message). Cannot retrieve credentials from Secrets Manager."
                    return $null
                }
            } else {
                Write-Log -Level "DEBUG" -Message "AWS.Tools.SecretsManager module not found. AWS PowerShell Tools may not be installed."
                return $null
            }
        }
        
        foreach ($secretName in $SecretNames) {
            try {
                Write-Log -Level "DEBUG" -Message "Attempting to retrieve secret: $secretName from region: $Region"
                $secret = Get-SECSecretValue -SecretId $secretName -Region $Region -ErrorAction SilentlyContinue
                if ($secret -and $secret.SecretString) {
                    $secretData = $secret.SecretString | ConvertFrom-Json
                    if ($secretData.username -and $secretData.password) {
                        Write-Log "Successfully retrieved $CredentialType credentials from Secrets Manager (secret: $secretName)"
                        return @{
                            Username = $secretData.username
                            Password = $secretData.password
                            Source = "SecretsManager"
                        }
                    } else {
                        Write-Log -Level "DEBUG" -Message "Secret '$secretName' does not contain required username/password fields"
                    }
                } else {
                    Write-Log -Level "DEBUG" -Message "Secret '$secretName' returned null or empty SecretString"
                }
            } catch {
                Write-Log -Level "DEBUG" -Message "Secret '$secretName' not found or inaccessible: $($_.Exception.Message)"
            }
        }
        
        Write-Log "$CredentialType credentials not found in AWS Secrets Manager"
        return $null
    } catch {
        Write-Log -Level "WARNING" -Message "Error accessing AWS Secrets Manager for $CredentialType credentials: $($_.Exception.Message)"
        return $null
    }
}

Function Get-CredentialInteractive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CredentialType,
        [Parameter(Mandatory = $false)]
        [string]$DefaultUsername = $null,
        [Parameter(Mandatory = $false)]
        [string]$UsernamePrompt = "Enter username",
        [Parameter(Mandatory = $false)]
        [bool]$AllowEmptyUsername = $false
    )
    
    Write-Log "Prompting user for $CredentialType credentials..."
    
    $promptText = $UsernamePrompt
    if (-not [string]::IsNullOrEmpty($DefaultUsername)) {
        $promptText = "$UsernamePrompt (default: $DefaultUsername)"
    }
    
    $username = Read-Host -Prompt $promptText
    if ([string]::IsNullOrEmpty($username)) {
        if (-not [string]::IsNullOrEmpty($DefaultUsername)) {
            $username = $DefaultUsername
        } elseif (-not $AllowEmptyUsername) {
            Write-Log -Level "WARNING" -Message "$CredentialType username cannot be empty. Please enter a valid username."
            return $null
        }
    }
    
    $password = Read-Host -Prompt "Enter $CredentialType password for user '$username'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    
    return @{
        Username = $username
        Password = $plainPassword
        Source = "Interactive"
    }
}

# ========================================
# SQL Credential Resolution Functions
# ========================================

Function Test-SqlConnection {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutableInstance,
        [Parameter(Mandatory = $false)]
        [string]$Username = $null,
        [Parameter(Mandatory = $false)]
        [string]$Password = $null
    )
    
    $authType = if ([string]::IsNullOrEmpty($Username)) { "Windows" } else { "SQL" }
    
    try {
        Write-Log "Testing $authType Authentication for SQL instance: $ExecutableInstance"
        $testQuery = "SELECT 1 AS test"
        
        if ([string]::IsNullOrEmpty($Username)) {
            # Windows Authentication
            Write-Log -Level "DEBUG" -Message "Executing sqlcmd with Windows Authentication: sqlcmd -S $ExecutableInstance -Q '$testQuery'"
            $result = sqlcmd -S $ExecutableInstance -Q $testQuery -h -1 -W 2>&1
        } else {
            # SQL Authentication
            Write-Log -Level "DEBUG" -Message "Executing sqlcmd with SQL Authentication: sqlcmd -S $ExecutableInstance -U $Username -Q '$testQuery'"
            $result = sqlcmd -S $ExecutableInstance -U $Username -P $Password -Q $testQuery -h -1 -W 2>&1
        }
        
        Write-Log -Level "DEBUG" -Message "sqlcmd exit code: $LASTEXITCODE, result: $($result -join ' ')"
        
        if ($LASTEXITCODE -eq 0 -and $result -match "^1") {
            Write-Log "$authType Authentication successful for instance: $ExecutableInstance"
            Write-Log -Level "DEBUG" -Message "Authentication test passed for instance: $ExecutableInstance"
            return @{
                Success = $true
                ErrorMessage = $null
            }
        }
        
        # Parse error message for clearer feedback
        $errorMsg = $result -join " "
        if ($errorMsg -match "Login failed") {
            $errorMsg = "SQL Server login failed. Invalid username or password for instance: $ExecutableInstance"
        } elseif ($errorMsg -match "Cannot open database") {
            $errorMsg = "Cannot open database. Check database permissions for instance: $ExecutableInstance"
        } elseif ($errorMsg -match "network-related|connection") {
            $errorMsg = "Network error connecting to SQL instance: $ExecutableInstance. Verify the instance name and that SQL Server is running."
        }
        
        Write-Log -Level "WARNING" -Message "$authType Authentication failed for instance: $ExecutableInstance - $errorMsg"
        return @{
            Success = $false
            ErrorMessage = $errorMsg
        }
    } catch {
        $errorMsg = "Failed to test $authType authentication for SQL instance '$ExecutableInstance'. Error: $($_.Exception.Message). Please verify the instance name and that SQL Server is running."
        Write-Log -Level "WARNING" -Message $errorMsg
        return @{
            Success = $false
            ErrorMessage = $errorMsg
        }
    }
}

Function Get-SqlCredentials {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstanceName,
        [Parameter(Mandatory = $false)]
        [string]$Region = $null,
        [Parameter(Mandatory = $false)]
        [string]$Hostname = $env:COMPUTERNAME
    )
    
    $serverInstanceName = $InstanceName
    
    # Determine initial executable instance based on serverInstanceName
    if ($serverInstanceName -eq 'MSSQLSERVER') {
        $executableInstance = $env:COMPUTERNAME
    } else {
        $executableInstance = $serverInstanceName
    }
    
    Write-Log -Level "DEBUG" -Message "Starting credential resolution for SQL instance: $serverInstanceName, Initial ExecutableInstance: $executableInstance, Region: $Region, Hostname: $Hostname"
    
    # Test connection with initial executable instance
    $windowsAuthResult = Test-SqlConnection -ExecutableInstance $executableInstance
    Write-Log -Level "DEBUG" -Message "Windows Authentication test result: Success=$($windowsAuthResult.Success), ErrorMessage=$($windowsAuthResult.ErrorMessage)"
    
    # If test-connection fails and this is a named instance (not MSSQLSERVER), try with COMPUTERNAME\\serverInstanceName format
    if (-not $windowsAuthResult.Success -and $serverInstanceName -ne 'MSSQLSERVER') {
        Write-Log -Level "DEBUG" -Message "Initial connection test failed for named instance, trying with COMPUTERNAME\\serverInstanceName format"
        $executableInstance = "$env:COMPUTERNAME\\$serverInstanceName"
        $windowsAuthResult = Test-SqlConnection -ExecutableInstance $executableInstance
        Write-Log -Level "DEBUG" -Message "Retry Windows Authentication test result: Success=$($windowsAuthResult.Success), ErrorMessage=$($windowsAuthResult.ErrorMessage)"
    }
    
    if ($windowsAuthResult.Success) {
        Write-Log -Level "DEBUG" -Message "Windows Authentication successful, returning credentials"
        return @{
            UseWindowsAuth = $true
            Username = $null
            Password = $null
            Source = "WindowsAuthentication"
            ExecutableInstance = $executableInstance
        }
    }
    
    Write-Log "Windows Authentication not available, trying SQL Authentication..."
    
    # Build array of executable instances to try for SQL auth
    # For default instance: single entry with $env:COMPUTERNAME
    # For named instance: $InstanceName first, then $env:COMPUTERNAME\\$InstanceName
    $execInstancesToTry = @()
    if ($InstanceName -eq 'MSSQLSERVER') {
        $execInstancesToTry = @($env:COMPUTERNAME)
    } else {
        if ($InstanceName -match '\\\\') {
            $execInstancesToTry = @($InstanceName)
        } else {
            $execInstancesToTry = @($InstanceName, "$env:COMPUTERNAME\\$InstanceName")
        }
    }
    
    $ValidateSqlCredentials = {
        param($Credentials, $Source, $ExecInstances)
        
        foreach ($execInstance in $ExecInstances) {
            $testResult = Test-SqlConnection -ExecutableInstance $execInstance -Username $Credentials.Username -Password $Credentials.Password
            if ($testResult.Success) {
                Write-Log "SQL Authentication validated successfully (source: $Source) with instance: $execInstance"
                return @{
                    UseWindowsAuth = $false
                    Username = $Credentials.Username
                    Password = $Credentials.Password
                    Source = $Source
                    ExecutableInstance = $execInstance
                }
            } else {
                Write-Log -Level "DEBUG" -Message "SQL auth failed for instance: $execInstance - $($testResult.ErrorMessage)"
            }
        }
        
        Write-Log -Level "WARNING" -Message "SQL credentials from $Source are invalid for all instance formats tried"
        return $null
    }
    
    if (-not [string]::IsNullOrEmpty($Region)) {
        Write-Log -Level "DEBUG" -Message "Region available ($Region), attempting Secrets Manager lookup for SQL credentials"
        # Build secret names: try with hostname prefix, and also try with backslashes replaced by forward slashes
        $secretNameWithSlashes = $serverInstanceName -replace '\\\\', '/'
        $secretNames = @("$Hostname/$serverInstanceName", $secretNameWithSlashes)
        $credentials = Get-CredentialFromSecretsManager -SecretNames $secretNames -Region $Region -CredentialType "SQL"
        if ($credentials) {
            Write-Log -Level "DEBUG" -Message "Credentials retrieved from Secrets Manager, validating..."
            $validatedCreds = & $ValidateSqlCredentials $credentials "SecretsManager" $execInstancesToTry
            if ($validatedCreds) {
                Write-Log -Level "DEBUG" -Message "Secrets Manager credentials validated successfully"
                return $validatedCreds
            } else {
                Write-Log -Level "DEBUG" -Message "Secrets Manager credentials failed validation"
            }
        } else {
            Write-Log -Level "DEBUG" -Message "No credentials found in Secrets Manager"
        }
    } else {
        Write-Log -Level "WARNING" -Message "AWS region not available, skipping Secrets Manager lookup for SQL credentials"
        Write-Log -Level "DEBUG" -Message "Region is null or empty, skipping Secrets Manager lookup"
    }
    
    Write-Log -Level "DEBUG" -Message "Attempting Windows Credential Manager lookup for SQL credentials"
    $credentials = Get-CredentialFromWindowsCredentialManager -TargetNames @($serverInstanceName)
    if ($credentials) {
        Write-Log -Level "DEBUG" -Message "Credentials retrieved from Windows Credential Manager, validating..."
        $validatedCreds = & $ValidateSqlCredentials $credentials "WindowsCredentialManager" $execInstancesToTry
        if ($validatedCreds) {
            Write-Log -Level "DEBUG" -Message "Windows Credential Manager credentials validated successfully"
            return $validatedCreds
        } else {
            Write-Log -Level "DEBUG" -Message "Windows Credential Manager credentials failed validation"
        }
    } else {
        Write-Log -Level "DEBUG" -Message "No credentials found in Windows Credential Manager"
    }
    
    $credentials = Get-CredentialInteractive -CredentialType "SQL" -UsernamePrompt "Enter SQL username (e.g., sa)" -AllowEmptyUsername $false
    if ($credentials) {
        $validatedCreds = & $ValidateSqlCredentials $credentials "Interactive" $execInstancesToTry
        if ($validatedCreds) {
            return $validatedCreds
        } else {
            Write-Log -Level "ERROR" -Message "SQL Server authentication failed for all instance formats. Please verify your username and password."
            throw "Failed to obtain valid SQL credentials. Cannot continue without valid SQL authentication."
        }
    } else {
        Write-Log -Level "ERROR" -Message "No SQL credentials provided"
        throw "Failed to obtain valid SQL credentials. Cannot continue without valid SQL authentication."
    }
}

Function Get-OntapCredentials {
    param(
        [Parameter(Mandatory = $true)]
        [string]$StorageManagementAddress,
        [Parameter(Mandatory = $false)]
        [string]$Region = $null
    )
    
    $credentials = $null
    Write-Log -Level "DEBUG" -Message "Starting ONTAP credential resolution: StorageManagementAddress=$StorageManagementAddress, Region=$Region"
    
    if (-not [string]::IsNullOrEmpty($Region)) {
        Write-Log -Level "DEBUG" -Message "Region available, attempting Secrets Manager lookup for ONTAP credentials"
        $credentials = Get-CredentialFromSecretsManager -SecretNames @($StorageManagementAddress) -Region $Region -CredentialType "ONTAP"
        if ($credentials) {
            Write-Log -Level "DEBUG" -Message "ONTAP credentials retrieved from Secrets Manager, source: $($credentials.Source)"
            return $credentials
        } else {
            Write-Log -Level "DEBUG" -Message "No ONTAP credentials found in Secrets Manager"
        }
    } else {
        Write-Log -Level "WARNING" -Message "AWS region not available, skipping Secrets Manager lookup for ONTAP credentials"
        Write-Log -Level "DEBUG" -Message "Region is null or empty, skipping Secrets Manager lookup"
    }
    
    Write-Log -Level "DEBUG" -Message "Attempting Windows Credential Manager lookup for ONTAP credentials"
    $credentials = Get-CredentialFromWindowsCredentialManager -TargetNames @($StorageManagementAddress)
    if ($credentials) {
        Write-Log -Level "DEBUG" -Message "ONTAP credentials retrieved from Windows Credential Manager, source: $($credentials.Source)"
        return $credentials
    } else {
        Write-Log -Level "DEBUG" -Message "No ONTAP credentials found in Windows Credential Manager"
    }
    
    Write-Log -Level "DEBUG" -Message "Falling back to interactive credential prompt for ONTAP"
    $credentials = Get-CredentialInteractive -CredentialType "ONTAP" -DefaultUsername "fsxadmin" -UsernamePrompt "Enter ONTAP admin username" -AllowEmptyUsername $false
    return $credentials
}

Function Resolve-ServerToEC2Info {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServerName
    )
    
    $result = @{
        IpAddress = $null
        Ec2InstanceId = $null
        Ec2Name = $null
    }
    
    try {
        $ipInfo = [System.Net.Dns]::GetHostAddresses($ServerName) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
        if ($ipInfo) {
            $result.IpAddress = $ipInfo.IPAddressToString
            
            try {
                $ec2Instance = Get-EC2Instance -Filter @{Name='private-ip-address'; Values=$ipInfo.IPAddressToString} -ErrorAction SilentlyContinue
                if ($ec2Instance -and $ec2Instance.Instances -and $ec2Instance.Instances.Count -gt 0) {
                    $result.Ec2InstanceId = $ec2Instance.Instances[0].InstanceId
                    
                    # Get EC2 instance name from tags
                    $nameTag = $ec2Instance.Instances[0].Tags | Where-Object { $_.Key -eq 'Name' } | Select-Object -First 1
                    if ($nameTag) {
                        $result.Ec2Name = $nameTag.Value
                    }
                }
            } catch {
                Write-Log -Level "WARNING" -Message "Could not resolve EC2 instance ID for $ServerName (IP: $($ipInfo.IPAddressToString)): $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Log -Level "WARNING" -Message "Could not resolve IP for server $ServerName : $($_.Exception.Message)"
    }
    
    return $result
}

# Use pre-resolved ONTAP credentials for this assessment
Function Get-FSxNDetails {
    param(
        [Parameter(Mandatory = $false)]
        [string]$fsxId = $FSxID
    )
    
    $localOntapHostName = $OntapHostName
    $localOntapCredentialsInBase64 = $OntapCredentialsInBase64
    $localOntapIPUsed = $OntapIPUsed
    
    if (-not [string]::IsNullOrEmpty($fsxId) -and $fsxId -ne $FSxID -and -not [string]::IsNullOrEmpty($FSxID)) {
        $localOntapHostName = "management.$fsxId.fsx.$vmRegion.amazonaws.com"
        try {
            $testRequest = [System.Net.WebRequest]::Create("https://$localOntapHostName")
            $testResponse = $testRequest.GetResponse()
            $testResponse.Close()
        } catch {
            if ($_.Exception.Message -notlike "*remote server returned an error*") {
                Write-Log "FSx management domain $localOntapHostName not resolved. Switching to management IP."
                $FileSystemDetails = Get-FSXFileSystem -FileSystemId $fsxId
                $localOntapHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
                if ($localOntapHostName -is [array]) {
                    $localOntapHostName = $localOntapHostName[0]
                }
                $localOntapIPUsed = $true
            }
        }
    }
    
    return @{
        FSxCredentialsInBase64 = $localOntapCredentialsInBase64
        FSxHostName = $localOntapHostName
        FSxCredentials = $null
        FSxIPUsed = $localOntapIPUsed
    }
}

Function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Data,
        
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )
    
    try {
        $jsonContent = $Data | ConvertTo-Json -Depth 10 -Compress
        $jsonContent | Out-File -FilePath $FilePath -Encoding UTF8 -ErrorAction Stop
        Write-Log "File written to: $FilePath"
        return $true
    } catch {
        Write-Log -Level "WARNING" -Message "Failed to write to '$FilePath': $($_.Exception.Message)"
        return $false
    }
}

${mappedVolumesHelperFunctions}

${TEST_ISCSI_SESSIONS}

${slqcmdExecutionTemplate}

# Collect the number of SQL Server instances on this host
$sqlServices = Get-Service | Where-Object { $_.DisplayName -like "*SQL Server (*)" }
$numberOfDatabaseInstances = @($sqlServices).Count
if ($numberOfDatabaseInstances -eq 0) {
    Write-Log -Level "WARNING" -Message "No SQL Server instances found on this host"
    throw "No SQL Server instances found on this host"
}
Write-Log "Found $numberOfDatabaseInstances SQL Server instance(s) on this host"
$sqlServiceNames = @($sqlServices.Name | ForEach-Object {
    $serviceName = $_.ToUpper()
    if ($serviceName -like 'MSSQL$*') {
        $serviceName = $serviceName -replace '^MSSQL\\$', ''
    }
    $serviceName
})
if($extractedInstanceName.ToUpper() -notin $sqlServiceNames) {
    Write-Log -Level "WARNING" -Message "SQL Server instance '$extractedInstanceName' not found on this host"
    throw "SQL Server instance '$extractedInstanceName' not found on this host"
}

# Initialize ONTAP storage variables
$OntapUsername = $null
$OntapPassword = $null

$WarningPreference = 'SilentlyContinue';
$ProgressPreference = 'SilentlyContinue'

# Define log directory and initialize log file path
$LogFilesPath = "C:\\ProgramData\\NetApp\\WorkloadFactory\\Logs"
if (-not (Test-Path -Path $LogFilesPath -PathType Container)) {
    New-Item -Path $LogFilesPath -ItemType Directory | Out-Null
}
$script:LogFilePath = "${OFFLINE_ASSESSMENT_LOG_PATH}"

Write-Log "=========================================="
Write-Log "Starting MSSQL One-Time Assessment"
Write-Log "StorageManagementAddress: $StorageManagementAddress"
Write-Log "SqlInstanceName: $SqlInstanceName"
Write-Log "=========================================="

# Initialize script-level global variable for FCI name
$script:FciName = ''

# Get EC2 instance metadata
$ec2InstanceId = $null
$ec2InstanceType = $null
$ec2UsageOperation = $null
$vmName = $null
$virtualNetworkId = $null
$virtualNetworkName = $null
$vmRegion = $null
try {
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri http://169.254.169.254/latest/api/token -ErrorAction Stop
    $ec2InstanceId = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id -ErrorAction Stop
    
    $vmRegion = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/placement/region -ErrorAction Stop
    
    if ($ec2InstanceId) {
        try {
            $ec2Instance = Get-EC2Instance -InstanceId $ec2InstanceId -ErrorAction SilentlyContinue
            if ($ec2Instance -and $ec2Instance.Instances -and $ec2Instance.Instances.Count -gt 0) {
                $ec2InstanceType = $ec2Instance.Instances[0].InstanceType
                $ec2UsageOperation = $ec2Instance.Instances[0].UsageOperation
                $virtualNetworkId = $ec2Instance.Instances[0].VpcId
                
                $nameTag = $ec2Instance.Instances[0].Tags | Where-Object { $_.Key -eq 'Name' } | Select-Object -First 1
                if ($nameTag) {
                    $vmName = $nameTag.Value
                }
                
                if ($virtualNetworkId) {
                    try {
                        $vpc = Get-EC2Vpc -VpcId $virtualNetworkId -ErrorAction SilentlyContinue
                        if ($vpc) {
                            $vpcNameTag = $vpc.Tags | Where-Object { $_.Key -eq 'Name' } | Select-Object -First 1
                            if ($vpcNameTag) {
                                $virtualNetworkName = $vpcNameTag.Value
                            }
                        }
                    } catch {
                        Write-Log -Level "WARNING" -Message "Could not get VPC details: $($_.Exception.Message)"
                    }
                }
            }
        } catch {
            Write-Log -Level "WARNING" -Message "Could not get EC2 instance details: $($_.Exception.Message)"
        }
    }
} catch {
    Write-Log -Level "WARNING" -Message "Could not retrieve EC2 instance metadata: $($_.Exception.Message). Some AWS-dependent features may not be available."
}

if (-not [string]::IsNullOrEmpty($vmRegion)) {
    Write-Log "Using AWS region from instance metadata: $vmRegion"
} else {
    Write-Log -Level "WARNING" -Message "AWS region not available. AWS Secrets Manager lookups will be skipped."
}

# Collect the number of SQL Server instances on this host
$numberOfDatabaseInstances = 0
try {
    $sqlServices = Get-Service | Where-Object { $_.DisplayName -like "*SQL Server (*)" }
    $numberOfDatabaseInstances = @($sqlServices).Count
    Write-Log "Found $numberOfDatabaseInstances SQL Server instance(s) on this host"
} catch {
    Write-Log -Level "WARNING" -Message "Could not enumerate SQL Server instances: $($_.Exception.Message)"
}

Write-Log "Resolving ONTAP storage credentials..."
$ontapCreds = Get-OntapCredentials -StorageManagementAddress $StorageManagementAddress -Region $vmRegion

if (-not $ontapCreds) {
    $errorMessage = "Failed to obtain ONTAP storage credentials. The script attempted to retrieve credentials from AWS Secrets Manager, Windows Credential Manager, and interactive prompts. Please ensure credentials are available in one of these sources or provide them when prompted."
    Write-Log -Level "ERROR" -Message $errorMessage
    throw $errorMessage
}

$OntapUsername = $ontapCreds.Username
$OntapPassword = $ontapCreds.Password
Write-Log "ONTAP credentials obtained from: $($ontapCreds.Source)"

# Determine ONTAP management endpoint
$OntapHostName = $null
$OntapIPUsed = $false

if (-not [string]::IsNullOrEmpty($ManagementIP)) {
    $OntapHostName = $ManagementIP
    $OntapIPUsed = $true
    Write-Log "Using provided management IP: $OntapHostName"
} elseif (-not [string]::IsNullOrEmpty($ManagementFQDN)) {
    $OntapHostName = $ManagementFQDN
    Write-Log "Using provided management FQDN: $OntapHostName"
} elseif (-not [string]::IsNullOrEmpty($FSxID)) {
    if ([string]::IsNullOrEmpty($vmRegion)) {
        throw "AWS region is required when using FSx ID. Could not retrieve region from EC2 instance metadata. Either run on an EC2 instance or provide the Management IP instead of FSx ID."
    }
    $OntapHostName = "management.$FSxID.fsx.$vmRegion.amazonaws.com"
    Write-Log -Level "DEBUG" -Message "Constructed FSx management domain: $OntapHostName"
    try {
        $OntapHTTP_Request = [System.Net.WebRequest]::Create("https://$OntapHostName")
        $OntapHTTP_Response = $OntapHTTP_Request.GetResponse()
        $OntapHTTP_Response.Close()
        Write-Log "Using FSx management domain: $OntapHostName"
        Write-Log -Level "DEBUG" -Message "FSx management domain connectivity test successful"
    } catch {
        Write-Log -Level "DEBUG" -Message "FSx management domain connectivity test failed: $($_.Exception.Message)"
        if ($_.Exception.Message -like "*remote server returned an error*") {
            Write-Log "ONTAP management endpoint validated"
            Write-Log -Level "DEBUG" -Message "Remote server error indicates endpoint is reachable (expected for HTTPS without valid cert)"
        } else {
            Write-Log "FSx management domain not resolved. Switching to management IP."
            Write-Log -Level "DEBUG" -Message "Calling Get-FSXFileSystem to retrieve management IP for FSxID: $FSxID"
            $FileSystemDetails = Get-FSXFileSystem -FileSystemId $FSxID
            $OntapHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
            Write-Log -Level "DEBUG" -Message "Retrieved management IP addresses: $($OntapHostName | ConvertTo-Json)"
            if ($OntapHostName -is [array]) {
                $OntapHostName = $OntapHostName[0]
                Write-Log -Level "DEBUG" -Message "Multiple IPs found, using first: $OntapHostName"
            }
            $OntapIPUsed = $true
            Write-Log -Level "DEBUG" -Message "Switched to management IP: $OntapHostName"
        }
    }
}

if ([string]::IsNullOrEmpty($OntapHostName)) {
    $errorMessage = "Could not determine ONTAP management endpoint from StorageManagementAddress: '$StorageManagementAddress'. Please verify that the StorageManagementAddress is either a valid FQDN (Fully Qualified Domain Name), a valid IPv4 management IP address, or a valid FSx ID (format: fs-xxxxxxxxxxxxxxxxx)."
    Write-Log -Level "ERROR" -Message $errorMessage
    throw $errorMessage
}

$OntapCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($OntapUsername + ':' + $OntapPassword))

$FSxCredentialsInBase64 = $OntapCredentialsInBase64
$FSxHostName = $OntapHostName
$FSxRegion = $vmRegion

$FinalResponse = @{}
$FinalResponse['metadata'] = @{
    databaseType = "MSSQL"
    ec2InstanceId = $ec2InstanceId
    ec2InstanceType = $ec2InstanceType
    ec2UsageOperation = $ec2UsageOperation
    vmName = $vmName
    virtualNetworkId = $virtualNetworkId
    virtualNetworkName = $virtualNetworkName
    region = $vmRegion
    storageEndpoint = $StorageManagementAddress
    fsxId = $FSxID
    ontapHostName = $OntapHostName
    credentialSource = $ontapCreds.Source
    hostname = $env:COMPUTERNAME
    numberOfDatabaseInstances = $numberOfDatabaseInstances
    assessmentTimestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    osVersion = (Get-WmiObject -Class Win32_OperatingSystem).Caption
}
$FinalResponse['rawdata'] = @{
    hostLevelDetails = @{
        errors = @{}
    }
    instanceLevelDetails = @{}
}
    
${invokeOntapRequestTemplate}

# ========================================
# Validate and resolve FSx ID from Management IP via ONTAP /api/cluster
# ========================================
try {
    $clusterResponse = Invoke-ONTAPRequest -ApiEndpoint "/cluster" -ApiQueryFields "fields=name"
    if ($clusterResponse -and $clusterResponse.name) {
        $clusterName = $clusterResponse.name
        Write-Log "ONTAP cluster name: $clusterName"
        # Cluster name format: FsxId0d5efc3057c4f12cb -> fs-0d5efc3057c4f12cb
        if ($clusterName -match '^FsxId([a-fA-F0-9]+)$') {
            $FSxID = "fs-" + $Matches[1]
            Write-Log "Resolved FSx file system ID from cluster name: $FSxID"
            $FinalResponse['metadata']['fsxId'] = $FSxID
        } else {
            Write-Log -Level "WARNING" -Message "Cluster name '$clusterName' does not match expected FsxId format"
        }
    } else {
        Write-Log -Level "WARNING" -Message "Could not retrieve cluster name from ONTAP API"
    }
} catch {
    $errorDetails = $_.Exception.Message
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            $errorDetails = "Failed to resolve FSx ID: Authentication failed (401 Unauthorized). Invalid ONTAP credentials. Please verify your ONTAP credentials are correct."
        } elseif ($statusCode -eq 404) {
            $errorDetails = "Failed to resolve FSx ID: Endpoint not found (404). The ONTAP management endpoint may be incorrect. Please verify the Management IP address: $ManagementIP"
        } elseif ($statusCode -ge 500) {
            $errorDetails = "Failed to resolve FSx ID: ONTAP server error ($statusCode). The storage system may be unavailable. Please verify the ONTAP storage system is operational."
        } else {
            $errorDetails = "Failed to resolve FSx ID: ONTAP API request failed with status code $statusCode. Error: $($_.Exception.Message)"
        }
    } 
    Write-Log -Level "ERROR" -Message $errorDetails
    throw $errorDetails
}

$outputFileName = "MSSQL_Assessment_v1_$($extractedInstanceName)_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

# Build output file path with fallback to current directory
$outputFilePath = Join-Path -Path (Get-Location).Path -ChildPath $outputFileName
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    try {
        $outputDirectory = [System.IO.Path]::GetFullPath($OutputPath)
        if (-not (Test-Path -Path $outputDirectory -PathType Container)) {
            New-Item -Path $outputDirectory -ItemType Directory -Force | Out-Null
        }
        $outputFilePath = Join-Path -Path $outputDirectory -ChildPath $outputFileName
    } catch {
        Write-Log -Level "WARNING" -Message "Invalid output path '$OutputPath': $($_.Exception.Message). Using current directory."
    }
}

try {
    $additionalFields = 'svm'
    $svmOntapUuid = ''
    $instanceLevelFsxnIds = @{}
    $includeLogVolumes = $true

    $sqlInstances = @($SqlInstanceName) | ForEach-Object {
        $serverInstanceName = $_
        
        $sqlCreds = Get-SqlCredentials -InstanceName $serverInstanceName -Region $vmRegion
        $executableInstance = $sqlCreds.ExecutableInstance
        
        $sqlCredential = @{}
        if ($sqlCreds.UseWindowsAuth) {
            $sqlCredential.add('useSqlAuth', $False)
            $sqlCredential.add('useDomainAuth', $False)
            Write-Log "Instance '$serverInstanceName': Using Windows Authentication"
        } else {
            $sqlCredential.add('useSqlAuth', $True)
            $sqlCredential.add('useDomainAuth', $False)
            $sqlCredential.add('username', $sqlCreds.Username)
            $sqlCredential.add('password', $sqlCreds.Password)
            Write-Log "Instance '$serverInstanceName': Using SQL Authentication (source: $($sqlCreds.Source))"
        }
        
        return @{
            sqlCredential = $sqlCredential
            executableInstance = $executableInstance
            serverInstanceName = $serverInstanceName
            credentialSource = if ($sqlCreds.UseWindowsAuth) { "WindowsAuth" } else { $sqlCreds.Source }
        }
    }

    $visitedFileSystems = @{}
    $instanceRespones = @{}

    $sqlInstances | ForEach-Object {
        try {
            $sqlCredential = $_.sqlCredential
            $executableInstance = $_.executableInstance
            $serverInstanceName = $_.serverInstanceName

            $instanceLevelFsxnId = $($instanceLevelFsxnIds.$serverInstanceName.fsxId)
            if ([string]::IsNullOrEmpty($instanceLevelFsxnId)) {
                $instanceLevelFsxnId = if ([string]::IsNullOrEmpty($FSxID)) { $StorageManagementAddress } else { $FSxID }
            }
            if ($instanceLevelFsxnId -ne $null -and -not $visitedFileSystems.ContainsKey($instanceLevelFsxnId)) {
                $FSxNDetails = Get-FSxNDetails -fsxId $instanceLevelFsxnId
                $visitedFileSystems += @{$instanceLevelFsxnId = @{
                    FSxCredentialsInBase64 = $FSxNDetails.FSxCredentialsInBase64
                    FSxHostName = $FSxNDetails.FSxHostName
                }}
            }

            # ========================================
            # Get Server GUID (Database Instance ID)
            # ========================================
            Write-Log "Getting server GUID for instance: $serverInstanceName"
            $serverGuidQuery = "${INSTANCE_GUID}"
            $serverGuidResult = Call-SqlCmd -SqlCredential $sqlCredential -Query $serverGuidQuery -InstanceName "$executableInstance"
            $serverGuid = $null
            if ($serverGuidResult) {
                try {
                    $guidJson = $serverGuidResult | ConvertFrom-Json
                    if ($guidJson -and $guidJson.Count -gt 0) {
                        $serverGuid = $guidJson[0].instance_guid
                    }
                } catch {
                    Write-Log -Level "WARNING" -Message "Could not parse server GUID result as JSON: $($_.Exception.Message)"
                }
            }

            # ========================================
            # Get SQL Server Version and Edition
            # ========================================
            Write-Log "Getting SQL Server version and edition for instance: $serverInstanceName"
            $sqlVersionQuery = @"
${SERVER_DETAILS}
"@
            $sqlVersionResult = Call-SqlCmd -SqlCredential $sqlCredential -Query $sqlVersionQuery -InstanceName "$executableInstance"
            $databaseVersion = $null
            $databaseEdition = $null
            $sqlEngineEdition = $null
            $isClustered = $false
            $isHadrEnabled = $false
            if ($sqlVersionResult) {
                try {
                    $versionJson = $sqlVersionResult | ConvertFrom-Json
                    # Handle both array and single object results from FOR JSON PATH
                    $versionData = if ($versionJson -is [array]) { $versionJson[0] } else { $versionJson }
                    if ($versionData) {
                        $databaseVersion = $versionData.serverDetails
                        $databaseEdition = $versionData.ServerEdition
                        $sqlEngineEdition = $versionData.sqlEngineEdition
                        $isClustered = $versionData.isClustered -eq 1
                        $isHadrEnabled = $versionData.isHadrEnabled -eq 1
                        
                        Write-Log "SQL Server: Edition=$databaseEdition, EngineEdition=$sqlEngineEdition, IsClustered=$isClustered, IsHadrEnabled=$isHadrEnabled"
                    }
                } catch {
                    Write-Log -Level "WARNING" -Message "Could not parse SQL version result as JSON: $($_.Exception.Message)"
                }
            }
            
            # Determine deployment type based on cluster and HADR settings
            # AOAG takes priority: if HADR is enabled, it's AOAG regardless of isClustered
            # baseDeploymentType indicates the underlying HA: 'FCI' if clustered, 'Standalone' if not
            $deploymentType = 'Standalone'
            $baseDeploymentType = $null
            if ($isHadrEnabled) {
                $deploymentType = 'AOAG'
                $baseDeploymentType = if ($isClustered) { 'FCI' } else { 'Standalone' }
                Write-Log "AOAG deployment detected. Base deployment type: $baseDeploymentType"
            } elseif ($isClustered) {
                $deploymentType = 'FCI'
            }
            
            # ========================================
            # Get Windows Cluster Information (for FCI/AOAG)
            # ========================================
            $windowsClusterName = $null
            $windowsClusterNodes = @()
            $availabilityGroups = @()
            $availabilityReplicas = @()
            
            if ($deploymentType -ne 'Standalone') {
                Write-Log "Getting Windows cluster information for instance: $serverInstanceName"
                
                # Gather cluster info for FCI deployments AND for AOAG deployments with FCI base (FCI+AOAG)
                if ($deploymentType -eq 'FCI' -or ($deploymentType -eq 'AOAG' -and $baseDeploymentType -eq 'FCI')) {
                    try {
                        $clusterServiceStatus = (Get-Service -Name "ClusSvc" -ErrorAction SilentlyContinue).Status
                        if ($clusterServiceStatus -eq "Running") {
                            $clusterObj = Get-Cluster -ErrorAction SilentlyContinue
                            if ($clusterObj -and $clusterObj.Name) {
                                $windowsClusterName = $clusterObj.Name
                                Write-Log "Found cluster name: $windowsClusterName"
                            }
                            
                            
                            $fciResource = $null
                            try {
                                Write-Log "Getting FCI name for instance: $extractedInstanceName"
                                $escapedInstanceName = [regex]::Escape($extractedInstanceName)
                                $matchedResource = Get-ClusterResource -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "SQL Network Name*" -and $_.OwnerGroup -match "\\($escapedInstanceName\\)" }
                                if ($matchedResource) {
                                    $script:FciName = $matchedResource.Name -replace '^SQL Network Name\\s+\\(([^)]+)\\)$', '$1'
                                    $fciResource = $matchedResource
                                    Write-Log "Found FCI name: $script:FciName for instance: $extractedInstanceName"
                                } else {
                                    Write-Log -Level "WARNING" -Message "No matching SQL Network Name resource found for instance: $extractedInstanceName"
                                }
                            } catch {
                                Write-Log -Level "WARNING" -Message "Could not get FCI name: $($_.Exception.Message)"
                            }
                            
                            # Get cluster nodes, but filter to only those belonging to this FCI
                            $fciOwnerNodeNames = @()
                            if ($fciResource) {
                                try {
                                    $fciOwnerNodes = Get-ClusterOwnerNode -InputObject $fciResource -ErrorAction SilentlyContinue
                                    if ($fciOwnerNodes -and $fciOwnerNodes.OwnerNodes) {
                                        $fciOwnerNodeNames = @($fciOwnerNodes.OwnerNodes.NodeName)
                                        Write-Log "Found $($fciOwnerNodeNames.Count) FCI owner nodes for FCI: $script:FciName"
                                    }
                                } catch {
                                    Write-Log -Level "WARNING" -Message "Could not get FCI owner nodes: $($_.Exception.Message)"
                                }
                            }
                            
                            # Get cluster nodes, but only if we have FCI owner nodes to filter by
                            $clusterNodes = @()
                            if ($fciOwnerNodeNames.Count -gt 0) {
                                $allClusterNodes = Get-ClusterNode -ErrorAction SilentlyContinue
                                # Filter to only nodes that belong to this FCI
                                $clusterNodes = $allClusterNodes | Where-Object { $fciOwnerNodeNames -contains $_.Name } | ForEach-Object {
                                    $ec2Info = Resolve-ServerToEC2Info -ServerName $_.Name
                                    $nodeInfo = @{
                                        State = $_.State.ToString()
                                    }
                                    if ($ec2Info.IpAddress) {
                                        $nodeInfo['Address'] = $ec2Info.IpAddress
                                    }
                                    if ($ec2Info.Ec2InstanceId) {
                                        $nodeInfo['ec2InstanceId'] = $ec2Info.Ec2InstanceId
                                    }
                                    if ($ec2Info.Ec2Name) {
                                        $nodeInfo['Node'] = $ec2Info.Ec2Name
                                    }
                                    $nodeInfo
                                }
                                Write-Log "Filtered cluster nodes to $($fciOwnerNodeNames.Count) nodes belonging to FCI: $script:FciName"
                            } else {
                                Write-Log -Level "WARNING" -Message "Could not determine FCI owner nodes, skipping cluster node collection"
                            }
                            
                            if ($clusterNodes) {
                                $windowsClusterNodes = @($clusterNodes)
                                Write-Log "Found $($windowsClusterNodes.Count) cluster nodes for FCI: $script:FciName"
                            }
                        }
                    } catch {
                        Write-Log -Level "WARNING" -Message "Could not get FCI cluster info from Windows cmdlets: $($_.Exception.Message)"
                    }
                }
                
                # ========================================
                # Get AOAG Information (if AOAG deployment)
                # ========================================
                if ($deploymentType -eq 'AOAG') {
                    Write-Log "Getting Availability Group information for instance: $serverInstanceName"
                    try {
                        $aoagQuery = ${buildAoagQuery}
                        $aoagResult = Call-SqlCmd -SqlCredential $sqlCredential -Query $aoagQuery -InstanceName "$executableInstance"
                        if ($aoagResult) {
                            $aoagJson = $aoagResult | ConvertFrom-Json
                            if ($aoagJson.availabilityGroups) {
                                $availabilityGroups = $aoagJson.availabilityGroups
                                
                                # Extract and enhance replica information with EC2 details
                                foreach ($ag in $availabilityGroups) {
                                    if ($ag.replicas) {
                                        foreach ($replica in $ag.replicas) {
                                            $availabilityReplicas += $replica
                                            
                                            if ($replica.replica) {
                                                $ec2Info = Resolve-ServerToEC2Info -ServerName $replica.replica
                                                if ($ec2Info.IpAddress) {
                                                    $replica | Add-Member -NotePropertyName 'IpAddress' -NotePropertyValue $ec2Info.IpAddress -Force
                                                }
                                                if ($ec2Info.Ec2InstanceId) {
                                                    $replica | Add-Member -NotePropertyName 'Ec2InstanceId' -NotePropertyValue $ec2Info.Ec2InstanceId -Force
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch {
                        Write-Log -Level "WARNING" -Message "Could not get AOAG information: $($_.Exception.Message)"
                    }
                }
            }
            
            # ========================================
            # License Assessment: Enterprise Feature Check
            # ========================================
            $enterpriseFeatures = @()
            $isUsingEnterpriseFeatures = $false
            
            if ($sqlEngineEdition -eq 3) {
                Write-Log "Checking enterprise feature usage for instance: $serverInstanceName"
                $enterpriseCheckQuery = "${ENTERPRISE_CHECK_QUERY}"
                try {
                    $enterpriseCheckResult = Call-SqlCmd -SqlCredential $sqlCredential -Query $enterpriseCheckQuery -InstanceName "$executableInstance"
                    if ($enterpriseCheckResult) {
                        $featuresJson = $enterpriseCheckResult | ConvertFrom-Json
                        if ($featuresJson) {
                            $enterpriseFeatures = $featuresJson | Where-Object { $_.IsUsingFeature -eq 1 } | ForEach-Object { $_.FeatureDescription }
                            $isUsingEnterpriseFeatures = ($enterpriseFeatures.Count -gt 0)
                        }
                    }
                } catch {
                    Write-Log -Level "WARNING" -Message "Could not check enterprise features: $($_.Exception.Message)"
                }
            }
            
            # Initialize instance-level data structure
            $FinalResponse['rawdata']['instanceLevelDetails'][$extractedInstanceName] = @{
                instanceDetails = @{
                    databaseInstanceId = $serverGuid
                    instanceName = $extractedInstanceName
                    executableInstance = $executableInstance
                    databaseVersion = $databaseVersion
                    databaseEdition = $databaseEdition
                    sqlEngineEdition = $sqlEngineEdition
                    deploymentType = $deploymentType
                    baseDeploymentType = $baseDeploymentType
                    isClustered = $isClustered
                    isHadrEnabled = $isHadrEnabled
                    windowsClusterName = $windowsClusterName
                    windowsClusterNodes = $windowsClusterNodes
                    availabilityGroups = $availabilityGroups
                    availabilityReplicas = $availabilityReplicas
                    enterpriseFeatures = $enterpriseFeatures
                    isUsingEnterpriseFeatures = $isUsingEnterpriseFeatures
                }
                mappedVolumes = @{}
                assessment = @{}
            }

            # ========================================
            # PART 1: Get Mapped ONTAP Volumes
            # ========================================
            Write-Log "Getting mapped ONTAP volumes for instance: $serverInstanceName"

            $sqlquery = @"
                SET NOCOUNT ON;
                DECLARE @JSONData nvarchar(max)
                SET @JSONData = (SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) ${SQL_CASE_INSENSITIVE} != 'TEMPDB'
                FOR JSON PATH)
                SELECT @JSONData;
"@

            $SqlQueryForDatabaseAndVolumeList = @"
                SET NOCOUNT ON;
                DECLARE @JSONData nvarchar(max)
                SET @JSONData = (SELECT DISTINCT 
                    DB_NAME(mf.database_id) AS DatabaseName,
                    vs.logical_volume_name as VolumeName,
                    vs.volume_id as VolumeId
                FROM 
                    sys.master_files AS mf
                CROSS APPLY 
                    sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                WHERE 
                    vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                FOR JSON PATH)
                SELECT @JSONData;
"@

            if ($sqlCredential.useSqlAuth -eq $True) {
                $SqlResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $executableInstance -Q $sqlquery -y 0;
                $SqlQueryResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $executableInstance -Q $SqlQueryForDatabaseAndVolumeList -y 0 -r1 2>&1
            } else {
                $SqlResponse = sqlcmd -S $executableInstance -Q $sqlquery -y 0;
                $SqlQueryResponse = sqlcmd -S $executableInstance -Q $SqlQueryForDatabaseAndVolumeList -y 0 -r1 2>&1
            }

            if ([string]::IsNullOrEmpty($SqlResponse)) {
                $errorMessage = "Failed to retrieve Windows volume information from SQL Server instance '$serverInstanceName'. This may indicate that SQL Server cannot access the volume information, or the SQL query failed. Please verify SQL Server is running and accessible, and that you have appropriate permissions."
                Write-Log -Level "ERROR" -Message $errorMessage
                throw $errorMessage
            }

            $VolumeIds = Get-VolumeIdsList $SqlQueryResponse
            Write-Log -Level "DEBUG" -Message "Extracted $($VolumeIds.Count) volume IDs from SQL query response"
            
            $Result = Get-SerialNumberOfWinVolumes $VolumeIds
            $SerialNumbers = $Result.Lunserialnumbers
            Write-Log -Level "DEBUG" -Message "Retrieved $($SerialNumbers.Count) LUN serial numbers from Windows volumes"

            $LunResult = Get-LunFromSerialNumber $SerialNumbers $Result.VolumeSerialMapping $visitedFileSystems $instanceLevelFsxnId
            $VolumeNames = $LunResult.LunNames
            $VolumeLunMapping = $LunResult.VolumeLunMapping
            Write-Log -Level "DEBUG" -Message "LUN resolution result: Found $($VolumeNames.Count) volume names, $($VolumeLunMapping.Count) volume-LUN mappings"

            if (!($VolumeNames.count -gt 0)) {
                $errorMessage = "Failed to retrieve ONTAP LUN volume names associated with the Windows volumes for SQL Server instance '$serverInstanceName'. This may indicate that the volumes are not properly mapped to ONTAP LUNs, or there was an error communicating with the ONTAP storage system. Please verify the storage configuration and ONTAP connectivity."
                Write-Log -Level "ERROR" -Message $errorMessage
                throw $errorMessage
            }

            $VolumeResult = Get-VolumeIdFromName $VolumeNames $VolumeLunMapping $visitedFileSystems $instanceLevelFsxnId $serverInstanceName
            $Volumes = $VolumeResult.Response
            $VolumeNameMapping = $VolumeResult.volumeNameMapping
            Write-Log -Level "DEBUG" -Message "Volume details retrieved: $($Volumes.Count) volumes, $($VolumeNameMapping.Count) name mappings"

            $ProcessedRecords = Process-Records $Volumes
            Write-Log -Level "DEBUG" -Message "Processed records: $($ProcessedRecords.records.Count) volume records processed"
            
            Function Update-VolumeMappings {
                param(
                    [Parameter(Mandatory = $true)]
                    $SqlQueryResponse,
                    [Parameter(Mandatory = $true)]
                    [hashtable]$VolumeNameMapping
                )
                try {
                    $sqlJsonResponse = $SqlQueryResponse | ConvertFrom-Json
                    $newArray = @()
                    
                    foreach ($dbMapping in $sqlJsonResponse) {
                        $cleanDbMapping = New-Object PSObject
            
                        foreach ($property in $dbMapping.PSObject.Properties) {
                            $cleanKey = $property.Name.Replace("\\\`r", "").Replace("\\\`n", "")
                            $cleanValue = $property.Value -replace "\\\`r", "" -replace "\\\`n", ""
                            $cleanDbMapping | Add-Member -NotePropertyName $cleanKey -NotePropertyValue $cleanValue
                        }
            
                        $volumeId = $cleanDbMapping.VolumeId
                        $volumeId = $volumeId.Replace(" ", "")

                        if ($null -ne $volumeId -and $null -ne $VolumeNameMapping -and $VolumeNameMapping.ContainsKey($volumeId)) {
                            $value = $VolumeNameMapping[$volumeId]
                            $newObject = @{
                                "databaseName" = $cleanDbMapping.DatabaseName
                                "ontapVolumeuuid" = $value["uuid"]
                                "ontapVolumeName" = $value["name"]
                            }
                            $newArray += $newObject
                        }
                    }
                    return $newArray
                } catch {
                    Write-Log -Level "WARNING" -Message "Error building volumeDBMap: $($_.Exception.Message)"
                    return @()
                }
            }
            
            $VolumeDBMap = Update-VolumeMappings -SqlQueryResponse $SqlQueryResponse -VolumeNameMapping $VolumeNameMapping
            Write-Log -Level "DEBUG" -Message "Volume-Database mapping created: $($VolumeDBMap.Count) mappings"

            $MappedVolumesResponse = @{}
            $MappedVolumesResponse['volumes'] = $ProcessedRecords
            $MappedVolumesResponse['volumeDBMap'] = $VolumeDBMap
            $MappedVolumesResponse['luns'] = $LunResult.LunDetails
            Write-Log -Level "DEBUG" -Message "Mapped volumes response assembled: $($ProcessedRecords.records.Count) volumes, $($VolumeDBMap.Count) DB mappings, $($LunResult.LunDetails.Count) LUNs"
            $FinalResponse['rawdata']['instanceLevelDetails'][$extractedInstanceName]['mappedVolumes'] = $MappedVolumesResponse

            # ========================================
            # PART 2: Storage Configuration Assessment
            # ========================================
            Write-Log "Getting storage configuration assessment for instance: $serverInstanceName"

            $DriftAssessmentData = @{}
            $DriftAssessmentData['errors'] = @{}
            $DriftAssessmentData['filesystemId'] = $FSxID

            $MappedVolumeUuids = @()
            $MappedVolumeNames = @()
            $MappedLunNames = @()

            foreach ($vol in $ProcessedRecords.records) {
                if ($vol.uuid) { $MappedVolumeUuids += $vol.uuid }
                if ($vol.name) { $MappedVolumeNames += $vol.name }
            }
            foreach ($lun in $LunResult.LunDetails) {
                if ($lun.name) { $MappedLunNames += $lun.name }
            }

            ${volumeDetailsAssessmentTemplate}

            ${lunDetailsAssessmentTemplate}

            ${osConfigAssessmentTemplate}

            ${storageLayoutAssessmentTemplate}

            ${maxDopAssessmentTemplate}

            ${highAvailabilityAssessmentTemplate}

            $FinalResponse['rawdata']['instanceLevelDetails'][$extractedInstanceName]['assessment'] = $DriftAssessmentData

        } catch {
            $errorMessage = "Error processing instance '$serverInstanceName': $($_.Exception.Message)"
            Write-Log -Level "ERROR" -Message $errorMessage
            $FinalResponse['rawdata']['hostLevelDetails']['errors'][$serverInstanceName] = $errorMessage
        }
    }

    # ========================================
    # PART 3: RSS Configuration (Host Level)
    # ========================================
    try {
        ${GET_RSS_CONFIG_DETAILS()}
        
        if ($rssConfigData) {
            $raw = $rssConfigData | ConvertFrom-Json
            $vcpu = $raw.vcpuCount
            $recvQueues = [Math]::Min($vcpu, 8)
            $recvBaseProc = if ($vcpu -ge 4) { 2 } else { 0 }
            $hasBaseProc2 = ($raw.adapters | Where-Object { $_.baseProcessorNumber -eq 2 }).Count -gt 0
            
            $unoptimized = @($raw.adapters | Where-Object {
                -not $_.rssEnabled -or $_.rssProfile -ne "NUMAStatic" -or 
                $_.numberOfReceiveQueues -ne $recvQueues -or
                ($vcpu -ge 4 -and $_.baseProcessorNumber -ne 2)
            } | ForEach-Object { @{ adapterName = $_.adapterName; rssEnabled = $_.rssEnabled; rssProfile = $_.rssProfile; baseProcessorNumber = $_.baseProcessorNumber; numberOfReceiveQueues = $_.numberOfReceiveQueues } })
            
            if ($vcpu -ge 4 -and $hasBaseProc2 -and $raw.adapters.Count -gt 1) {
                $unoptimized = @($unoptimized | Where-Object { 
                    -not ($_.rssEnabled -and $_.rssProfile -eq "NUMAStatic" -and $_.numberOfReceiveQueues -eq $recvQueues -and $_.baseProcessorNumber -ne 2)
                })
            }
            
            $isOptimized = $unoptimized.Count -eq 0 -and $raw.tcpOffloadState -eq "Disabled"
            
            $FinalResponse['rawdata']['hostLevelDetails']['rssConfig'] = @{
                rssConfigFinding = if ($isOptimized) { "optimized" } else { "not-optimized" }
                rssAdapters = $unoptimized
                recommendedAdapterSettings = if (-not $isOptimized) { @{ recommendedRssProfile = "NUMAStatic"; recommendedBaseProcessorNumber = $recvBaseProc; recommendedReceiveQueues = $recvQueues } } else { @{} }
                tcpOffloadState = $raw.tcpOffloadState
                totalObjectsInViolation = $unoptimized.Count
                totalObjectsAssessed = $raw.adapters.Count
            }
        } else {
            $FinalResponse['rawdata']['hostLevelDetails']['rssConfig'] = @{}
        }
    } catch {
        Write-Log -Level "WARNING" -Message "Failed to get RSS configuration details: $($_.Exception.Message)"
        $FinalResponse['rawdata']['hostLevelDetails']['rssConfig'] = @{}
    }

    # ========================================
    # PART 4: Headroom Assessment (FSx Storage Capacity)
    # Collects aggregate storage data from ONTAP for headroom calculation
    # ========================================
    try {
        Write-Log "Collecting ONTAP storage headroom data..."
        
        $aggregateResponse = Invoke-ONTAPRequest -ApiEndpoint "/storage/aggregates" -ApiQueryFields "fields=space.block_storage.size,space.block_storage.used,space.block_storage.available"
        
        if ($aggregateResponse -and $aggregateResponse.records) {
            $totalSize = 0
            $totalUsed = 0
            $totalAvailable = 0
            
            foreach ($aggregate in $aggregateResponse.records) {
                $totalSize += $aggregate.space.block_storage.size
                $totalUsed += $aggregate.space.block_storage.used
                $totalAvailable += $aggregate.space.block_storage.available
            }
            
            $headroomPercent = if ($totalSize -gt 0) { [Math]::Ceiling((($totalSize - $totalUsed) / $totalSize) * 100) } else { 0 }
            
            $FinalResponse['rawdata']['hostLevelDetails']['headroom'] = @{
                ssdStorageCapacityInBytes = $totalSize
                storageUsedInBytes = $totalUsed
                storageAvailableInBytes = $totalAvailable
                headroomPercent = $headroomPercent
                aggregateCount = $aggregateResponse.records.Count
            }
            
            Write-Log "Headroom data collected: $headroomPercent% available"
        } else {
            Write-Log -Level "WARNING" -Message "No aggregate data returned from ONTAP"
            $FinalResponse['rawdata']['hostLevelDetails']['headroom'] = @{}
        }
    } catch {
        Write-Log -Level "WARNING" -Message "Failed to get headroom data: $($_.Exception.Message)"
        $FinalResponse['rawdata']['hostLevelDetails']['headroom'] = @{}
    }

    # ========================================
    # PART 5: Host-Level High Availability Assessment (FCI and AOAG)
    # Cluster Quorum and Heartbeat are cluster-wide settings
    # ========================================
    # Check if any instance is FCI or AOAG  to determine if we need host-level HA assessment
    $hasHaInstance = $false

    foreach ($instanceName in $FinalResponse['rawdata']['instanceLevelDetails'].Keys) {
        $instanceDetails = $FinalResponse['rawdata']['instanceLevelDetails'][$instanceName]['instanceDetails']
        if ($instanceDetails -and ($instanceDetails['deploymentType'] -eq 'FCI' -or $instanceDetails['deploymentType'] -eq 'AOAG')) {
            $hasHaInstance = $true
            break
        }
    }

    if ($hasHaInstance) {
        ${hostLevelHighAvailabilityAssessmentTemplate}
    }

    # Add fciName to metadata from script global variable
    if ($script:fciName) {
        $FinalResponse['metadata']['fciName'] = $script:fciName
    }

    # Write the output file with fallback to current directory if write fails
    if (-not (Write-JsonFile -Data $FinalResponse -FilePath $outputFilePath)) {
        Write-Log -Level "DEBUG" -Message "Initial write failed, attempting fallback to current directory"
        $outputFilePath = Join-Path -Path (Get-Location).Path -ChildPath $outputFileName
        Write-JsonFile -Data $FinalResponse -FilePath $outputFilePath | Out-Null
        Write-Log -Level "DEBUG" -Message "Fallback write completed to: $outputFilePath"
    } else {
        Write-Log -Level "DEBUG" -Message "Output file written successfully to: $outputFilePath"
    }
    
    Write-Log "Assessment completed successfully"
    Write-Log -Level "DEBUG" -Message "Assessment completed, returning output file path: $outputFilePath"
    return $outputFilePath

} catch {
    $errorResponse = @{ error = $_.Exception.Message }
    # Write error file with fallback to current directory if write fails
    if (-not (Write-JsonFile -Data $errorResponse -FilePath $outputFilePath)) {
        $outputFilePath = Join-Path -Path (Get-Location).Path -ChildPath $outputFileName
        Write-JsonFile -Data $errorResponse -FilePath $outputFilePath | Out-Null
    }
    
    $errorMessage = "Assessment failed with error: $($_.Exception.Message). Check the log file for detailed information: $script:LogFilePath"
    Write-Log -Level "ERROR" -Message $errorMessage
    return $outputFilePath
}
`;

export { MSSQL_ONE_TIME_WAD, OFFLINE_ASSESSMENT_SCRIPT_VERSION };
