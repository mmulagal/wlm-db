[CmdletBinding()]
param(
[Parameter(Mandatory=$true)]
[string]$ResourceName
)

$credentials = $null
try
{     
   $credentials = (Get-SSMParameter -Name "/netapp/wlmdb/$ResourceName" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
} catch {
    Write-Output $_.Exception.Message
    if($_.Exception.Message -match "Rate Limit exceeded") {
        Write-Output "Encountered Rate Limit exceeded while fetching SSM parameter. Reattempting after 5 seconds..."
        Start-Sleep 5
        $credentials = (Get-SSMParameter -Name "/netapp/wlmdb/$ResourceName" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
    }
}

if([string]::IsNullOrEmpty($credentials)) {
    throw "Unable to fetch credentials from SSM parameter store for $ResourceName."
}

$credentials 
