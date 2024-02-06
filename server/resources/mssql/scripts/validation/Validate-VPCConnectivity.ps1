[CmdletBinding()]

param(
    [Parameter(Mandatory=$true)]
    [string]
    $subnet,

    [Parameter(Mandatory=$true)]
    [string]
    $region,

    [Parameter(Mandatory=$true)]
    [string]$Stackname,

    [Parameter(Mandatory=$true)]
    [string]$ResourceID,

    [Parameter(Mandatory=$true)]
    [string]$WaitHandler 
)

# Tries to enable TLS12
function enableTLS12 {
    try {
        if ([Net.ServicePointManager]::SecurityProtocol.ToString().Contains("Tls12") -eq $false) {
            [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12
        }
    } catch {
        # Ignore failure; there's nothing we can do about it anyway
    }
}

$failed = $false
$failedServices = @()
enableTLS12

# example for $serviceURLMap = '{"Cloudformation": "cloudformation.us-east-2.amazonaws.com", "S3": "s3.us-east-2.amazonaws.com"}'
# Convert input string to HashTable
# Keeping it compatible with older versions of Powershell. Powershell 6 onwards can use "ConvertFrom-Json -As hashtable"
$serviceURLMap = '{"S3": "s3.'+$region+'.amazonaws.com"}'
$serviceURlMapJson = ConvertFrom-Json $serviceURLMap
$serviceURLHashTable = @{}
foreach ($property in $serviceURlMapJson.PSObject.Properties) {
    $serviceURLHashTable[$property.Name] = $property.Value
}

foreach ($service in $serviceURLHashTable.keys) {

    try{
        $out = (Invoke-WebRequest $serviceURLHashTable[$service] -UseBasicParsing).StatusCode

        if (($out -ge 200 -and $out -lt 299) -or ($out -ge 500 -and $out-lt 600)) {
            # Was able to connect to service, continue testing
        } else {
            $failedServices += $service
            $failed = $true
        }
    } catch {
        $failedServices += $service
        $failed = $true
    }
}

if ($failed -eq $true) {
    $FailureReason = "Failed to connect to services $($failedServices -join ', ')"
    Write-Output @{status= "Failed"; reason= $FailureReason} | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
    Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId

    exit(1)
} else
{
    Write-Output @{ status = "Completed"; reason = "Done." } | ConvertTo-Json -Compress
    Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
}