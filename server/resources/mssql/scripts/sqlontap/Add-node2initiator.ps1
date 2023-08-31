#Requires -Module AWS.Tools.FSX,netapp.ontap, AWs.Tools.SecretsManager
[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$AdminSecret,
    [Parameter(Mandatory=$true)]
    [string]$sqlvmname,
    [Parameter(Mandatory=$true)]
    [string]$igroup,
    [Parameter(Mandatory=$true)]
    [string]$FileSystemId
)
Start-Transcript -Path C:\cfn\log\ontapconfig.ps1.txt -Append
$ErrorActionPreference = "Stop"
$AdminUser = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId $AdminSecret).SecretString
$username = $AdminUser.username
$password = $AdminUser.Password
$fsxadmincreds = (New-Object PSCredential($username,(ConvertTo-SecureString $password -AsPlainText -Force)))
$fslist = Get-FSXFileSystem -FileSystemId $FileSystemId
$MgmtDNS = $fslist.ontapconfiguration.Endpoints.Management.DNSName
$nodeiqn = (Get-InitiatorPort).NodeAddress

try{
Connect-NcController -Name $MgmtDNS -Credential $fsxadmincreds -Vserver $sqlvmname
do{
    $ig = Get-NcIgroup -Name $igroup
}while($ig -eq $null)
Add-NcIgroupInitiator -Name $igroup -Initiator $nodeiqn
}catch{
    $_ | Write-AWSLaunchWizardException
    Write-Output "Adding Initiator failed"
}


