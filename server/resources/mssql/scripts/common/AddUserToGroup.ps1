param(
	[Parameter(Mandatory=$True)]
	[string]
	$GroupName,

	[Parameter(Mandatory=$True)]
	[string]
	$UserName
)

try {
    Start-Transcript -Path C:\cfn\log\AddUserToGroup.ps1.txt -Append

    $ErrorActionPreference = "Stop"
    net localgroup $GroupName $UserName /add
	
}
catch {
    $_ | Write-AWSLaunchWizardException
}