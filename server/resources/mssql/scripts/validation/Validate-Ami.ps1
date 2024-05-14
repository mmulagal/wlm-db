  [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$IsCustomAmi,

        [Parameter(Mandatory=$true)]
        [string]$Region,
        
        [Parameter(Mandatory=$true)]
        [string]$Stackname,

        [Parameter(Mandatory=$true)]
        [string]$Parentstackname,

        [Parameter(Mandatory=$true)]
        [string]$ResourceID,

        [Parameter(Mandatory=$true)]
        [string]$WaitHandler 
)

Start-Transcript -Path C:\cfn\log\Validate-Ami.ps1.txt -Append

if (${IsCustomAmi} -ne 'true' ) {
    Write-Output @{ status= "Skipped"; reason= "AMI is AWS database licensed." } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
    exit(0)
}

#Validate Window version
$WindowsVersion =  (Get-WmiObject -class Win32_OperatingSystem).Caption
$ValidWindowsVersion = $WindowsVersion -match 'Microsoft Windows Server 201[6-9]|20[2-9][0-9]'
If($ValidWindowsVersion -ne $true) {
    $FailureReason = "Supported Windows versions are Microsoft Windows Server 2016 and above. Ami windows version: $WindowsVersion"
    Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}

#Validate SQL server version
$sqlServiceList = Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (*'}
$ValidSqlVersion = $false
ForEach ($sqlService in $sqlServiceList) {
$sqlServiceBinaryPath = $sqlService.PathName  -Replace "-s.*", ""
      If (Test-Path $sqlServiceBinaryPath.Replace('"', '')) {
        $SqlVersion = Invoke-Expression -Command "(dir $sqlServiceBinaryPath).VersionInfo"}
        $ValidSqlVersion = $SqlVersion.ProductVersion -match '^1[3-9]'
        If($ValidSqlVersion -eq $true) {
        break
        }    
        
 }
If($ValidSqlVersion -ne $true) {
    $FailureReason = "Supported SQL server versions are Microsoft SQL Server 2016 and above. Check if SQL server is installed and is of supported version."
    Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $InstanceId
    exit(1)
}

#Check if SSM Agent is installed
try {
Get-Service AmazonSSMAgent -ErrorAction Stop
}catch {
    [System.Net.ServicePointManager]::SecurityProtocol = 'TLS12'
    $progressPreference = 'silentlyContinue'
    Invoke-WebRequest `
        https://amazon-ssm-$Region.s3.$Region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe `
        -OutFile $env:USERPROFILE\Desktop\SSMAgent_latest.exe
    Start-Process ` -FilePath $env:USERPROFILE\Desktop\SSMAgent_latest.exe ` -ArgumentList "/S"
    rm -Force $env:USERPROFILE\Desktop\SSMAgent_latest.exe
   
}
 
 
