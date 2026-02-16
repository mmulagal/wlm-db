/**
 * MSSQL One-Time Workload Assessment and Discovery (WAD) Script
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
#Requires -Version 5.1
<#
.SYNOPSIS
    MSSQL Workload Assessment Script for NetApp ONTAP Storage
.DESCRIPTION
    This script performs a comprehensive assessment of your SQL Server environment
    and its storage configuration on NetApp ONTAP storage systems (Amazon FSx for
    NetApp ONTAP or Cloud Volumes ONTAP). It collects:
    - SQL Server instance configuration and version information
    - Mapped ONTAP volumes and LUN details
    - Storage configuration best practices analysis
    - High availability settings (FCI/AOAG)
    - Enterprise feature usage for license optimization
    
    The assessment results are saved to a JSON file. By default, files are saved
    in the current working directory. You can specify a custom output path using
    the -OutputPath parameter.
.PARAMETER StorageEndpoint
    The storage system identifier. For FSx for ONTAP, use the file system ID
    (e.g., fs-0123456789abcdef0). For Cloud Volumes ONTAP or direct connections,
    use the ONTAP management IP address.
.PARAMETER Instance
    The name of the SQL Server instance to assess. Use 'MSSQLSERVER' for the
    default instance, or the instance name for named instances.
.PARAMETER OutputPath
    Optional. The directory path where JSON output files should be created.
    If the path doesn't exist, it will be created. If the path cannot be used
    (e.g., permission denied), files will be created in the current working
    directory instead.
.EXAMPLE
    .\\MSSQL_Assessment.ps1 -StorageEndpoint fs-0123456789abcdef0 -Instance MSSQLSERVER
    Runs assessment using FSx for ONTAP file system ID for the default SQL instance.
.EXAMPLE
    .\\MSSQL_Assessment.ps1 -StorageEndpoint 10.0.1.100 -Instance SQLInstance1
    Runs assessment using ONTAP management IP for a named SQL instance.
.EXAMPLE
    .\\MSSQL_Assessment.ps1 -StorageEndpoint fs-0123456789abcdef0 -Instance MSSQLSERVER -OutputPath "C:\\AssessmentResults"
    Runs assessment and saves JSON files to the specified output directory.
.NOTES
    Version: ${OFFLINE_ASSESSMENT_SCRIPT_VERSION}
    Requires: PowerShell 5.1 or later, SQL Server sqlcmd utility
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$StorageEndpoint,

    [Parameter(Mandatory = $true)]
    [string]$Instance,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = $null
)

# Script Version
$ScriptVersion = "${OFFLINE_ASSESSMENT_SCRIPT_VERSION}"

# Determine if StorageEndpoint is an FSx ID or Management IP
# FSx IDs start with "fs-" followed by alphanumeric characters
$FSxID = $null
$ManagementIP = $null

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
    
    # Write to console with color based on level
    switch ($Level) {
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "DEBUG" { Write-Host $logMessage -ForegroundColor Gray }
        default { Write-Host $logMessage }
    }
    
    # Write to log file if path is set
    if ($script:LogFilePath) {
        Add-Content -Path $script:LogFilePath -Value $logMessage -ErrorAction SilentlyContinue
    }
}

if ($StorageEndpoint -match '^fs-[a-zA-Z0-9]+$') {
    $FSxID = $StorageEndpoint
    Write-Log "StorageEndpoint detected as FSx ID: $FSxID"
} else {
    $ManagementIP = $StorageEndpoint
    Write-Log "StorageEndpoint detected as Management IP: $ManagementIP"
}

# Validate Instance parameter
if ([string]::IsNullOrWhiteSpace($Instance)) {
    Write-Log -Level "ERROR" -Message "No SQL Server instance name provided. Please specify an instance name using the -Instance parameter."
    Write-Log -Level "ERROR" -Message "Usage: .\\MSSQL_OneTimeWAD.ps1 -StorageEndpoint <FSxID or ManagementIP> -Instance <InstanceName>"
    throw "No SQL Server instance name provided. Please specify an instance name using the -Instance parameter."
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
                }
            } catch {
                Write-Debug "Credential '$targetName' not found: $($_.Exception.Message)"
            }
        }
        return $null
    } catch {
        Write-Debug "Error accessing Windows Credential Manager: $($_.Exception.Message)"
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
        
        foreach ($secretName in $SecretNames) {
            try {
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
                    }
                }
            } catch {
                Write-Debug "Secret '$secretName' not found or inaccessible: $($_.Exception.Message)"
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
            Write-Log -Level "WARNING" -Message "$CredentialType username cannot be empty"
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
            $result = sqlcmd -S $ExecutableInstance -Q $testQuery -h -1 -W 2>&1
        } else {
            # SQL Authentication
            $result = sqlcmd -S $ExecutableInstance -U $Username -P $Password -Q $testQuery -h -1 -W 2>&1
        }
        
        if ($LASTEXITCODE -eq 0 -and $result -match "^1") {
            Write-Log "$authType Authentication successful for instance: $ExecutableInstance"
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
        $errorMsg = "$authType Authentication test error for instance $ExecutableInstance : $($_.Exception.Message)"
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
        [Parameter(Mandatory = $true)]
        [string]$ExecutableInstance,
        [Parameter(Mandatory = $false)]
        [string]$Region = $null,
        [Parameter(Mandatory = $false)]
        [string]$Hostname = $env:COMPUTERNAME,
        [Parameter(Mandatory = $false)]
        [int]$MaxRetries = 3
    )
    
    $windowsAuthResult = Test-SqlConnection -ExecutableInstance $ExecutableInstance
    if ($windowsAuthResult.Success) {
        return @{
            UseWindowsAuth = $true
            Username = $null
            Password = $null
            Source = "WindowsAuthentication"
        }
    }
    
    Write-Log "Windows Authentication not available, trying SQL Authentication..."
    
    $ValidateSqlCredentials = {
        param($Credentials, $Source)
        
        $testResult = Test-SqlConnection -ExecutableInstance $ExecutableInstance -Username $Credentials.Username -Password $Credentials.Password
        if ($testResult.Success) {
            Write-Log "SQL Authentication validated successfully (source: $Source)"
            return @{
                UseWindowsAuth = $false
                Username = $Credentials.Username
                Password = $Credentials.Password
                Source = $Source
            }
        } else {
            Write-Log -Level "WARNING" -Message "SQL credentials from $Source are invalid: $($testResult.ErrorMessage)"
            return $null
        }
    }
    
    if (-not [string]::IsNullOrEmpty($Region)) {
        $credentials = Get-CredentialFromSecretsManager -SecretNames @("$Hostname/$InstanceName") -Region $Region -CredentialType "SQL"
        if ($credentials) {
            $validatedCreds = & $ValidateSqlCredentials $credentials "SecretsManager"
            if ($validatedCreds) {
                return $validatedCreds
            }
        }
    } else {
        Write-Log -Level "WARNING" -Message "AWS region not available, skipping Secrets Manager lookup for SQL credentials"
    }
    
    $credentials = Get-CredentialFromWindowsCredentialManager -TargetNames @($InstanceName)
    if ($credentials) {
        $validatedCreds = & $ValidateSqlCredentials $credentials "WindowsCredentialManager"
        if ($validatedCreds) {
            return $validatedCreds
        }
    }
    
    $retryCount = 0
    while ($retryCount -lt $MaxRetries) {
        $retryCount++
        
        if ($retryCount -gt 1) {
            Write-Log -Level "WARNING" -Message "Invalid credentials. Attempt $retryCount of $MaxRetries"
        }
        
        $credentials = Get-CredentialInteractive -CredentialType "SQL" -UsernamePrompt "Enter SQL username (e.g., sa)" -AllowEmptyUsername $false
        if ($credentials) {
            $testResult = Test-SqlConnection -ExecutableInstance $ExecutableInstance -Username $credentials.Username -Password $credentials.Password
            if ($testResult.Success) {
                Write-Log "SQL Authentication validated successfully (source: Interactive)"
                return @{
                    UseWindowsAuth = $false
                    Username = $credentials.Username
                    Password = $credentials.Password
                    Source = "Interactive"
                }
            } else {
                Write-Log -Level "ERROR" -Message "Authentication failed: $($testResult.ErrorMessage)"
            }
        }
    }
    
    Write-Log -Level "ERROR" -Message "Failed to obtain valid SQL credentials after $MaxRetries attempts"
    return $null
}

Function Get-OntapCredentials {
    param(
        [Parameter(Mandatory = $true)]
        [string]$StorageEndpoint,
        [Parameter(Mandatory = $false)]
        [string]$Region = $null
    )
    
    $credentials = $null
    
    if (-not [string]::IsNullOrEmpty($Region)) {
        $credentials = Get-CredentialFromSecretsManager -SecretNames @($StorageEndpoint) -Region $Region -CredentialType "ONTAP"
        if ($credentials) {
            return $credentials
        }
    } else {
        Write-Log -Level "WARNING" -Message "AWS region not available, skipping Secrets Manager lookup for ONTAP credentials"
    }
    
    $credentials = Get-CredentialFromWindowsCredentialManager -TargetNames @($StorageEndpoint)
    if ($credentials) {
        return $credentials
    }
    
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
    }
    
    try {
        $ipInfo = [System.Net.Dns]::GetHostAddresses($ServerName) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
        if ($ipInfo) {
            $result.IpAddress = $ipInfo.IPAddressToString
            
            try {
                $ec2Instance = Get-EC2Instance -Filter @{Name='private-ip-address'; Values=$ipInfo.IPAddressToString} -ErrorAction SilentlyContinue
                if ($ec2Instance -and $ec2Instance.Instances -and $ec2Instance.Instances.Count -gt 0) {
                    $result.Ec2InstanceId = $ec2Instance.Instances[0].InstanceId
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
Write-Log "Starting MSSQL One-Time WAD Assessment"
Write-Log "StorageEndpoint: $StorageEndpoint"
Write-Log "Instance: $Instance"
Write-Log "=========================================="

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

Write-Log "Resolving ONTAP storage credentials..."
$ontapCreds = Get-OntapCredentials -StorageEndpoint $StorageEndpoint -Region $vmRegion

if (-not $ontapCreds) {
    throw "Failed to obtain ONTAP storage credentials"
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
} elseif (-not [string]::IsNullOrEmpty($FSxID)) {
    if ([string]::IsNullOrEmpty($vmRegion)) {
        throw "AWS region is required when using FSx ID. Could not retrieve region from EC2 instance metadata. Either run on an EC2 instance or provide the Management IP instead of FSx ID."
    }
    $OntapHostName = "management.$FSxID.fsx.$vmRegion.amazonaws.com"
    try {
        $OntapHTTP_Request = [System.Net.WebRequest]::Create("https://$OntapHostName")
        $OntapHTTP_Response = $OntapHTTP_Request.GetResponse()
        $OntapHTTP_Response.Close()
        Write-Log "Using FSx management domain: $OntapHostName"
    } catch {
        if ($_.Exception.Message -like "*remote server returned an error*") {
            Write-Log "ONTAP management endpoint validated"
        } else {
            Write-Log "FSx management domain not resolved. Switching to management IP."
            $FileSystemDetails = Get-FSXFileSystem -FileSystemId $FSxID
            $OntapHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
            if ($OntapHostName -is [array]) {
                $OntapHostName = $OntapHostName[0]
            }
            $OntapIPUsed = $true
        }
    }
}

if ([string]::IsNullOrEmpty($OntapHostName)) {
    throw "Could not determine ONTAP management endpoint from StorageEndpoint: $StorageEndpoint"
}

$OntapCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($OntapUsername + ':' + $OntapPassword))

$FSxCredentialsInBase64 = $OntapCredentialsInBase64
$FSxHostName = $OntapHostName
$FSxRegion = $vmRegion

$FinalResponse = @{}
$FinalResponse['metadata'] = @{
    ec2InstanceId = $ec2InstanceId
    ec2InstanceType = $ec2InstanceType
    ec2UsageOperation = $ec2UsageOperation
    vmName = $vmName
    virtualNetworkId = $virtualNetworkId
    virtualNetworkName = $virtualNetworkName
    region = $vmRegion
    storageEndpoint = $StorageEndpoint
    ontapHostName = $OntapHostName
    credentialSource = $ontapCreds.Source
    hostname = $env:COMPUTERNAME
    assessmentTimestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    osVersion = (Get-WmiObject -Class Win32_OperatingSystem).Caption
}
$FinalResponse['rawdata'] = @{
    hostLevelDetails = @{
        errors = @{}
    }
    instanceLevelDetails = @{}
}

# Define output filename once (used in both success and error paths)
$outputFileName = "MSSQL_Assessment_v1_$($Instance)_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

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

    $sqlInstances = @($Instance) | ForEach-Object {
        $serverInstanceName = $_
        $executableInstance = "$env:COMPUTERNAME"
        if ($serverInstanceName -ne 'MSSQLSERVER') {
            $executableInstance = "$env:COMPUTERNAME\\$serverInstanceName"
        }
        
        $sqlCreds = Get-SqlCredentials -InstanceName $serverInstanceName -ExecutableInstance $executableInstance -Region $vmRegion
        
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

    ${invokeOntapRequestTemplate}

    $visitedFileSystems = @{}
    $instanceRespones = @{}

    $sqlInstances | ForEach-Object {
        try {
            $sqlCredential = $_.sqlCredential
            $executableInstance = $_.executableInstance
            $serverInstanceName = $_.serverInstanceName

            $instanceLevelFsxnId = $($instanceLevelFsxnIds.$serverInstanceName.fsxId)
            if ([string]::IsNullOrEmpty($instanceLevelFsxnId)) {
                $instanceLevelFsxnId = if ([string]::IsNullOrEmpty($FSxID)) { $StorageEndpoint } else { $FSxID }
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
            $deploymentType = 'Standalone'
            if ($isClustered) {
                $deploymentType = 'FCI'
            } elseif ($isHadrEnabled) {
                $deploymentType = 'AOAG'
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
                
                if ($deploymentType -eq 'FCI') {
                    try {
                        $clusterServiceStatus = (Get-Service -Name "ClusSvc" -ErrorAction SilentlyContinue).Status
                        if ($clusterServiceStatus -eq "Running") {
                            $clusterObj = Get-Cluster -ErrorAction SilentlyContinue
                            if ($clusterObj -and $clusterObj.Name) {
                                $windowsClusterName = $clusterObj.Name
                                Write-Log "Found cluster name: $windowsClusterName"
                            }
                            
                            $clusterNodes = Get-ClusterNode -ErrorAction SilentlyContinue | ForEach-Object {
                                $ec2Info = Resolve-ServerToEC2Info -ServerName $_.Name
                                $nodeInfo = @{
                                    Node = $_.Name
                                    State = $_.State.ToString()
                                }
                                if ($ec2Info.IpAddress) {
                                    $nodeInfo['Address'] = $ec2Info.IpAddress
                                }
                                if ($ec2Info.Ec2InstanceId) {
                                    $nodeInfo['ec2InstanceId'] = $ec2Info.Ec2InstanceId
                                }
                                $nodeInfo
                            }
                            if ($clusterNodes) {
                                $windowsClusterNodes = @($clusterNodes)
                                Write-Log "Found $($windowsClusterNodes.Count) cluster nodes"
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
            $FinalResponse['rawdata']['instanceLevelDetails'][$serverInstanceName] = @{
                instanceDetails = @{
                    databaseInstanceId = $serverGuid
                    instanceName = $serverInstanceName
                    executableInstance = $executableInstance
                    databaseVersion = $databaseVersion
                    databaseEdition = $databaseEdition
                    sqlEngineEdition = $sqlEngineEdition
                    deploymentType = $deploymentType
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
                throw "Couldn't get database windows volumes"
            }

            $VolumeIds = Get-VolumeIdsList $SqlQueryResponse
            $Result = Get-SerialNumberOfWinVolumes $VolumeIds
            $SerialNumbers = $Result.Lunserialnumbers

            $LunResult = Get-LunFromSerialNumber $SerialNumbers $Result.VolumeSerialMapping $visitedFileSystems $instanceLevelFsxnId
            $VolumeNames = $LunResult.LunNames
            $VolumeLunMapping = $LunResult.VolumeLunMapping

            if (!($VolumeNames.count -gt 0)) {
                throw "Couldn't get associated Ontap LUN volume names"
            }

            $VolumeResult = Get-VolumeIdFromName $VolumeNames $VolumeLunMapping $visitedFileSystems $instanceLevelFsxnId $serverInstanceName
            $Volumes = $VolumeResult.Response
            $VolumeNameMapping = $VolumeResult.volumeNameMapping

            $ProcessedRecords = Process-Records $Volumes
            
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

            $MappedVolumesResponse = @{}
            $MappedVolumesResponse['volumes'] = $ProcessedRecords
            $MappedVolumesResponse['volumeDBMap'] = $VolumeDBMap
            $MappedVolumesResponse['luns'] = $LunResult.LunDetails
            $FinalResponse['rawdata']['instanceLevelDetails'][$serverInstanceName]['mappedVolumes'] = $MappedVolumesResponse

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

            $FinalResponse['rawdata']['instanceLevelDetails'][$serverInstanceName]['assessment'] = $DriftAssessmentData

        } catch {
            $FinalResponse['rawdata']['hostLevelDetails']['errors'][$serverInstanceName] = $_.Exception.Message
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
    # PART 5: Host-Level High Availability Assessment (FCI Only)
    # Cluster Quorum and Heartbeat are cluster-wide settings
    # ========================================
    # Check if any instance is FCI to determine if we need host-level HA assessment
    $hasFciInstance = $false
    foreach ($instanceName in $FinalResponse['rawdata']['instanceLevelDetails'].Keys) {
        $instanceDetails = $FinalResponse['rawdata']['instanceLevelDetails'][$instanceName]['instanceDetails']
        if ($instanceDetails -and $instanceDetails['deploymentType'] -eq 'FCI') {
            $hasFciInstance = $true
            $deploymentType = 'FCI'
            break
        }
    }

    if ($hasFciInstance) {
        ${hostLevelHighAvailabilityAssessmentTemplate}
    }

    # Write the output file with fallback to current directory if write fails
    if (-not (Write-JsonFile -Data $FinalResponse -FilePath $outputFilePath)) {
        $outputFilePath = Join-Path -Path (Get-Location).Path -ChildPath $outputFileName
        Write-JsonFile -Data $FinalResponse -FilePath $outputFilePath | Out-Null
    }
    
    Write-Log "Assessment completed successfully"
    return $outputFilePath

} catch {
    $errorResponse = @{ error = $_.Exception.Message }
    # Write error file with fallback to current directory if write fails
    if (-not (Write-JsonFile -Data $errorResponse -FilePath $outputFilePath)) {
        $outputFilePath = Join-Path -Path (Get-Location).Path -ChildPath $outputFileName
        Write-JsonFile -Data $errorResponse -FilePath $outputFilePath | Out-Null
    }
    
    Write-Log -Level "ERROR" -Message "Assessment failed: $($_.Exception.Message)"
    return $outputFilePath
}
`;

export { MSSQL_ONE_TIME_WAD, OFFLINE_ASSESSMENT_SCRIPT_VERSION };
