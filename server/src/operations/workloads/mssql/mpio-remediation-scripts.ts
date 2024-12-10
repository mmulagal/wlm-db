import { OptimizeMpioIscsiSessionsParams, OptimizeMpioPolicyParams } from '../../../utils/common-types';

const CHECK_MPIO_POLICY = `
$currentMpioPolicy = Get-MSDSMGlobalDefaultLoadBalancePolicy
if ($currentMpioPolicy -eq "RR") {
   return @{"remediated" = $true
             "policy" = $currentMpioPolicy} | ConvertTo-Json
}
   return @{"remediated" = $false
             "policy" = $currentMpioPolicy} | ConvertTo-Json

`;

const RESTART_INSTANCE = 'Start-Process -FilePath "shutdown.exe" -ArgumentList @("/r") -Wait -NoNewWindow';

const REMEDIATE_MPIO_POLICY = (mpioParams: OptimizeMpioPolicyParams, runningOnPrimaryNode: boolean) =>
    `
    Start-Transcript -Path "C:\\cfn\\log\\mpio-policy-remediation.log.txt" -Append | Out-Null
    $sqlDeploymentType = "${mpioParams.sqlDeploymentType}"
    $runningOnPrimaryNode = [System.Convert]::ToBoolean('${runningOnPrimaryNode}')
    $currentPolicy = "${
        runningOnPrimaryNode ? mpioParams.activeNodeCurrentPolicy : mpioParams.standbyNodeCurrentPolicy
    }"
    $changeClusterOwnership = [System.Convert]::ToBoolean('${mpioParams.changeClusterOwnership}')

    Write-output "SQL deployment mode is $sqlDeploymentType"
    Write-output "Running on primary node is $runningOnPrimaryNode"
    Write-output "Current MPIO policy is $currentPolicy"
    Write-output "Ownership change needed $changeClusterOwnership"

    if($currentPolicy -ne "RR") {
        Write-output "Setting MPIO policy to RR"
        Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR   
    }
   
    if($sqlDeploymentType -eq "fci")  {
        if($changeClusterOwnership -eq $true) {
            
            $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server (${mpioParams.instanceName})")
            Write-output "SQL Role group is $SQLRoleGroup"
            $SQLGroup = $SQLRoleGroup[0]
            Write-output "Moving cluster onwership to ${
                runningOnPrimaryNode ? mpioParams.standbyNodeName : mpioParams.activeNodeName
            }"
            Move-ClusterGroup -Name $SQLGroup -Node ${
                runningOnPrimaryNode ? mpioParams.standbyNodeName : mpioParams.activeNodeName
            }

        }     
    }
    Stop-Transcript | Out-Null
`;

const CHECK_IF_MPIO_INSTALLED = `
$mpioInstalled = Get-WindowsFeature -Name  Multipath-IO | Select-Object -ExpandProperty Installed

return @{"mpioInstalled" = $mpioInstalled} | ConvertTo-Json
`;

const ENABLE_MPIO_AND_CONFIGURE = (iscsiTargetAddresses: string[]) => `

    Start-Transcript -Path "C:\\cfn\\log\\mpio-installation.log.txt" -Append | Out-Null

    $TargetPortalAddresses = ${iscsiTargetAddresses}
    $ProgressPreference = "SilentlyContinue"
    $ErrorActionPreference = "Stop"
    $OptimizeResult = @{}
    try {
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
        $data = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing
        $LocaliSCSIAddress = $data.Content
        Foreach ($TargetPortalAddress in $TargetPortalAddresses) {
            New-IscsiTargetPortal -TargetPortalAddress $TargetPortalAddress -TargetPortalPortNumber 3260 -InitiatorPortalAddress $LocaliSCSIAddress
        }

        #Add MPIO support for iSCSI
        New-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9

        #Enable PathVerificationState
        Set-MPIOSetting -NewPathVerificationState Enabled

        #Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance
        1..5 | % { Foreach ($TargetPortalAddress in $TargetPortalAddresses) { Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $TargetPortalAddress -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true } }
        #Set the MPIO Policy to Round Robin
        Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR

        $OptimizeResult = @{"status" = "success", "error" = $null} | ConvertTo-Json
    }
    catch {
        $OptimizeResult = @{"status" = "failed", "error" = $_.Exception.Message} | ConvertTo-Json
    }
    `;

const MPIO_ISCSI_SESSIONS = (iscsiTargetAddresses: string[]) =>
    `
    Start-Transcript -Path "C:\\cfn\\log\\mpio-iscsci-sessions-remediation.log.txt" -Append | Out-Null
    $iscsiTargetAddresses = ${iscsiTargetAddresses}
    Write-Information "iSCSI Target Addresses: $iscsiTargetAddresses"
    $result = @()
    try{
        Foreach ($address in $iscsiTargetAddresses) {
            $sessions = Get-IscsiConnection | Where-Object {$_.TargetAddress -eq $address} 
            $sessionsCount = $sessions.Count 
            if($sessionsCount -eq $null) {
                $sessionsCount = 0}
            Write-Information "iSCSI Target Address: $address"
            Write-Information "Number of iSCSI Sessions: $sessionsCount"
            $countPerAddress = @{"address" = $address
                                "count" = $sessionsCount}
            $result += $countPerAddress
        }
    }catch{
        $result = @(@{ status = 'failed'; error = $_.Exception.Message })
    } finally {
        $result | ConvertTo-Json
    }
`;

const REMEDIATE_MPIO_ISCSI_SESSIONS = (mpioisSessionsParams: OptimizeMpioIscsiSessionsParams) => `
    Start-Transcript -Path "C:\\cfn\\log\\mpio-iscsci-sessions-remediation.log.txt" -Append | Out-Null
    $currentMpioSessionsCountPerTarget = '${JSON.stringify(
        mpioisSessionsParams.currentMpioSessionsCount
    )}' | ConvertFrom-Json
    Write-Information "iSCSI Target Addresses: $currentMpioSessionsCountPerTarget"
    $result = @()
    $sessions = Get-IscsiSession
    Foreach ($each in $currentMpioSessionsCountPerTarget) {
        $address = $each.address
        $sessionsCount = $each.count
        Write-Information "iSCSI Target Address: $address"
        Write-Information "Number of iSCSI Sessions: $sessionsCount"
        $perAddress = @{"address" = $address
                        "status" = "success"
                        "error" = $null}
        if($sessionsCount -gt 5) {
            $sessions = $sessions | Where-Object {$_.IsConnected -and $_.IsPersistent} | Select-Object -Last ($sessions.count - 5)
            Foreach ($session in $sessions) {
                $targetPortalAddress = (Get-IscsiTargetPortal -iSCSISession $session).TargetPortalAddress
                if($targetPortalAddress -eq $address) {
                    try {
                          Unregister-IscsiSession -SessionIdentifier $session.SessionIdentifier
                          $perAddress.status = "success"
                    } catch {
                          Write-Information "Failed to unregister iSCSI session for address $address and session $session.SessionIdentifier. Error message: $_.Exception.Message"
                          $perAddress.status = "failed"
                          $perAddress.error = $_.Exception.Message
                    }
                }
            }
        }
        elseif($sessionsCount -lt 5) {
            try{
            $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
            $data = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing
            $LocaliSCSIAddress = $data.Content
            #Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance
            1..(5 - $sessionsCount) | % { Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $address -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true }
            $perAddress.status = "success"
            } catch {
                Write-Information "Failed to create iSCSI session for address $address. Error message: $_.Exception.Message"
                $perAddress.status = "failed"
                $perAddress.error = $_.Exception.Message
                    }
            }
        $result += $perAddress
        }
    $result | ConvertTo-Json
`;

export {
    REMEDIATE_MPIO_POLICY,
    CHECK_MPIO_POLICY,
    RESTART_INSTANCE,
    CHECK_IF_MPIO_INSTALLED,
    ENABLE_MPIO_AND_CONFIGURE,
    MPIO_ISCSI_SESSIONS,
    REMEDIATE_MPIO_ISCSI_SESSIONS
};
