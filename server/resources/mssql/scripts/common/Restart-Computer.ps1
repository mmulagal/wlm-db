[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Count # used in terraform ps scripts to distinguish between the restart commands
}

Start-Transcript -Path C:\cfn\log\Restart-Computer.ps1.txt -Append
$ErrorActionPreference = "SilentlyContinue"

Start-Process -FilePath "shutdown.exe" -ArgumentList @("/r", "/t 10") -Wait -NoNewWindow