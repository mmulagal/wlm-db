param(
	[Parameter(Mandatory=$True)]
	[string]$GroupName,

    [Parameter(Mandatory=$False)]
    [string]$DomainAdminUser,

	[Parameter(Mandatory=$False)]
    [string]$ADGroup,

	[Parameter(Mandatory=$False)]
    [string]$DCName,

    [Parameter(Mandatory=$False)]
    [string]$IsManagedServiceAccount,

	[Parameter(Mandatory=$False)]
	[string]$Parentstackname,

	[Parameter(Mandatory=$True)]
	[string]$UserName
)

try {
	Start-Transcript -Path C:\cfn\log\AddUserToGroup.ps1.txt -Append
	if(-not [string]::IsNullOrEmpty($DomainAdminUser)) {
		$DomainNetBIOSName = $env:USERDOMAIN
        $DomainAdminFullUser = $DomainNetBIOSName + '\' + $DomainAdminUser
        $ScriptsPath =  Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent)
        . "$ScriptsPath\common\InvokeRetryCommand.ps1"
        $SsmParameter = Invoke-WithRetry -Command { (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json }
        $DomainAdminSecurePassword = $SsmParameter.domain.password
        $DomainAdminCreds = (New-Object PSCredential($DomainAdminFullUser,(ConvertTo-SecureString $DomainAdminSecurePassword -AsPlainText -Force)))

		if ($IsManagedServiceAccount -eq 'true') {
			$Computer = $env:COMPUTERNAME
			$InstallServiceAccount ={
				if(-not ([string]::IsNullOrEmpty($Using:ADGroup)) -and $Using:ADGroup -ne "default" -and $Using:ADGroup -ne "no-value") {
					Write-Host "Adding computer to specified AD group $Using:ADGroup"
					if(-not ([string]::IsNullOrEmpty($Using:DCName)) -and $Using:DCName -ne "default" -and $Using:DCName -ne "no-value") {
						Add-ADGroupMember -Identity $Using:ADGroup -Members $Using:Computer -Server $Using:DCName -ErrorAction SilentlyContinue
					} else {
						Add-ADGroupMember -Identity $Using:ADGroup -Members $Using:Computer -ErrorAction SilentlyContinue
					}
                }
                Write-Host "Installing managed service account $Using:Username"
                Install-ADServiceAccount -Identity $Using:Username -Force -ErrorAction SilentlyContinue
			}
			Invoke-Command -ScriptBlock $InstallServiceAccount -ComputerName $Computer -Credential $DomainAdminCreds -Authentication Credssp
		}
	}

    $ErrorActionPreference = "Stop"
    net localgroup $GroupName $UserName /add
	
}
catch {
    $_ | Write-AWSLaunchWizardException
}