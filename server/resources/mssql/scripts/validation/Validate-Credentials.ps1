[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DomainName,

    [Parameter(Mandatory = $false)]
    [string]$UserName,

    [Parameter(Mandatory = $true)]
    [boolean]$isSecretManagerSupported,

    [Parameter(Mandatory = $false)]
    [string]$DCName,

    [Parameter(Mandatory = $true)]
    [string]$Stackname,

    [Parameter(Mandatory = $true)]
    [string]$Parentstackname,

    [Parameter(Mandatory = $true)]
    [string]$ResourceID,

    [Parameter(Mandatory = $true)]
    [string]$WaitHandler,

    [Parameter(Mandatory = $false)]
    [boolean]$IsTerraform
)
    
$Failed = $false
$FailedUsers = @()
    
Start-Transcript -Path C:\cfn\log\validatecredentials.ps1.txt -Append

$env:PSModulePath += ';C:\Windows\system32\WindowsPowerShell\v1.0\Modules\aws_ssm'

#get Instance ID
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

try {
    # Verify Domain Join worked fine

    if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
        Install-WindowsFeature RSAT-AD-PowerShell -ErrorAction SilentlyContinue *>$null
    }
    if ($isSecretManagerSupported) {
        try {
            $secure = Get-SECSecretValue -secretId $DomainAdminSecretName -Select SecretString | ConvertFrom-Json | Select -ExpandProperty password
        }
        catch {
            $Failed = $true
            $FailureReason = '"{0}"' -f "Unable to fetch secret, check secret name $DomainAdminSecretName and access to Secrets Manager"
            Write-Output @{status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
            if ($IsTerraform) {
                throw $FailureReason
            }
            Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
            Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
            exit(1)
        }
    }
    else {
        try {
            $ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
            . "$ScriptsPath\common\InvokeRetryCommand.ps1" 
            $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
                
            $secure = $SsmParameter.domain.password

        }
        catch {
            $Failed = $true
            $FailureReason = '"{0}"' -f "Unable to fetch SSM parameter, /netapp/wlmdb/$Parentstackname and access to SSM parameter store"
            Write-Output @{status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
            if ($IsTerraform) {
                throw $FailureReason
            }
            Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
            Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
            exit(1)
        }
    }
    $pass = ConvertTo-SecureString $secure -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential -ArgumentList $UserName, $pass

    Import-Module ActiveDirectory *>$null

    if($DCName -eq "default" -or $DCName -eq "no-value") {
        $DCName = ''
    }

    if([string]::IsNullOrEmpty($DCName)) {
        #Try to fetch a Domain Controller name that can connect to the directory service if preferred DC is not passed 
        $DCName = (Get-ADDomainController -Discover -Domain $DomainName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty HostName)
        }       
    if([string]::IsNullOrEmpty($DCName)) {
        #If not able to fetch with Get-ADDomainController revert to using main domain DNS name as DC server
        $domain = (Get-ADDomain -Server $DomainName -Credential $cred).DNSRoot
    } else {
         $domain = (Get-ADDomain -Server $DCName -Credential $cred).DNSRoot
    }

}
catch {
    $FailureReason = '"{0}"' -f "Failed to fetch domain with provided Active Directory credentials(Domain:$DomainName,PreferredDC:$DCName). Exception: $_" 
    Write-Output @{ status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
    if ($IsTerraform) {
        throw $FailureReason
    }
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
    exit(1)
}

if ($Failed -ne $true) {
    $SuccessReason = '"{0}"' -f "Validation completed for Active Directory connectivity(Domain:$DomainName,PreferredDC:$DCName)"
    Write-Output @{ status = "Completed"; reason = $SuccessReason } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
}
else {
    $FailureReason = '"{0}"' -f "Incorrect credentials for $($FailedUsers -join ', ')" 
    Write-Output @{ status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
    if ($IsTerraform) {
        throw $FailureReason
    }       
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    exit(1)
}
