[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Username,

    [Parameter(Mandatory=$false)]
    [string]$DCName,

    [Parameter(Mandatory=$false)]
    [switch]$Wait,

    [Parameter(Mandatory=$false)]
    [int]$TimeoutMinutes=30,

    [Parameter(Mandatory=$false)]
    [int]$IntervalMinutes=1
)

if($DCName -eq "default" -or $DCName -eq "no-value") {
        $DCName = ''
    }

try {    
    Start-Transcript -Path C:\cfn\log\Test-ADUser.ps1.txt -Append
    $ErrorActionPreference = "Stop"

    $elapsedMinutes = 0.0
    $startTime = Get-Date
    $userFound = $false
    if (-not $Wait) {
        $TimeoutMinutes = 0
        $IntervalMinutes = 0
    }

    if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
        Install-WindowsFeature RSAT-AD-PowerShell -ErrorAction SilentlyContinue *>$null
    }

    do {
        if (-not [string]::IsNullOrEmpty($DCName)) {
            if (Get-ADUser -Filter {sAMAccountName -eq $Username} -Server $DCName) {
                $userFound = $true
                break
            }
        } else {
            if (Get-ADUser -Filter {sAMAccountName -eq $Username}) {
                $userFound = $true
                break
            }
        }
        Start-Sleep -Seconds $($IntervalMinutes * 60)
        $elapsedMinutes = ($(Get-Date) - $startTime).TotalMinutes
    } while (($elapsedMinutes -lt $TimeoutMinutes))

    if (-not $userFound) {
        if ($Wait) {
            throw "User account was not found within the timeout of $TimeoutMinutes minutes."
        } else {
            throw "User account was not found."
        }
    }
}
catch {
    $_ | Write-AWSLaunchWizardException
}
