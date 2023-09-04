[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$StackID = "",

    [Parameter(Mandatory=$false)]
    [string]$Resource = "",

    [Parameter(Mandatory=$false)]
    [string]$Region = "",

    [Parameter(Mandatory=$false)]
    [string]$Handler = "",

    [Parameter(Mandatory=$false)]
    [Boolean]$stockAMI = $True
)

Start-Transcript -Path C:\cfn\log\Reinstall-SSMAgent.ps1.txt -Append
$ErrorActionPreference = "stop"

if ($stockAMI) {
    Write-Output 'Stock AMI, no needs to reinstall SSM Agent'
    return
}

function Write-CFNSignal {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [string]$StackID = "",

        [Parameter(Mandatory=$false)]
        [string]$Resource = "",

        [Parameter(Mandatory=$false)]
        [string]$Region = "",

        [Parameter(Mandatory=$false)]
        [string]$Handler = "",

        [Parameter(Mandatory=$false)]
        [string]$ErrorMessage = ""
    )

    if ($Handler) {
        Invoke-Expression "cfn-signal.exe -e 1 --reason='$($ErrorMessage)' $($Handler)"
        throw $ErrorMessage
    } else {
        Invoke-Expression "cfn-signal.exe -e 1 --stack $($StackID) --resource $($Resource) --region $($Region)"
        throw "Failed to reinstall SSM Agent."
    }

}


$downloadSSMAgent = $true
try {
    iwr https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/windows_amd64/AmazonSSMAgentSetup.exe -UseBasicParsing -OutFile C:\AmazonSSMAgentSetup.exe
} catch {
    $downloadSSMAgent = $false
    $ErrorMessage = "Failed to download latest SSM agent : " + $_.Exception.Message
    if ((Get-Service -Name "*AmazonSSMAgent*") -eq $null) { 
        Write-Output 'Failed to download latest SSM agent'
        Write-CFNSignal -StackID $StackID -Resource $Resource -Region $Region -ErrorMessage $ErrorMessage -Handler "$($Handler)"
    } else {
        Write-Output "$($ErrorMessage), but SSM agent existed on mechine and keep going."
    }
}
Write-Output "Update SSM Agent"
if ($downloadSSMAgent) {
    try {
        $maxCount = 15
        $count = 1
        Write-Output "install SSM Agent"
        C:\AmazonSSMAgentSetup.exe /install /quiet
        # Jump starting the SSM agent post install
        Get-Service -Name "*AmazonSSMAgent*" | Start-Service
        $status = (Get-Service -Name "*AmazonSSMAgent*").Status
        while ( $status -ne "Running" ) {
            $ssmAgent = Get-Service -Name "*AmazonSSMAgent*"
            $ssmAgent| Start-Service
            $status = $ssmAgent.Status
            Write-Output "Installing SSM Agent: $($ssmAgent.Status)"
            Start-Sleep -s 5
            if ($count++ -gt $maxCount) {
                Write-Output "Install SSM Agent timeout"
                Write-CFNSignal -StackID $StackID -Resource $Resource -Region $Region -ErrorMessage "Install SSM Agent timeout" -Handler "$($Handler)"
                break
            }
        }

        Write-Output "finished installing SSM Agent."
    } catch {
        Write-CFNSignal -StackID $StackID -Resource $Resource -Region $Region -ErrorMessage "$($_.Exception.Message)" -Handler "$($Handler)"
    }
}