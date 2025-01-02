import { OptimizeMpioPolicyParams, SessionsCountPerIscsiTarget } from '../../../utils/common-types';

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

const ENABLE_MPIO_AND_CONFIGURE = (iscsiTargetAddresses: string[], flow: string = 'optimize') => `

    Start-Transcript -Path "C:\\cfn\\log\\mpio-installation.log.txt" -Append | Out-Null

    $TargetPortalAddresses =  '${JSON.stringify(iscsiTargetAddresses)}' | ConvertFrom-Json
    Write-Information "TargetPortalAddresses: $TargetPortalAddresses"
    $flow = '${flow}'
    $ProgressPreference = "SilentlyContinue"
    $ErrorActionPreference = "Stop"
    $WarningPreference = 'SilentlyContinue'

    try {
        if($flow -eq 'optimize') {
        #Add MPIO support for iSCSI
        Write-Information "Adding MPIO support for iSCSI"
        $null = New-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9
        }
        #Enable PathVerificationState
        Write-Information "Enabling PathVerificationState"
        $null = Set-MPIOSetting -NewPathVerificationState Enabled

        # Check if session is already established
        $RunConfigure = $false
        Foreach ($address in $TargetPortalAddresses) {
                $sessions = Get-IscsiConnection | Where-Object {$_.TargetAddress -eq $address} 
                $sessionsCount = $sessions.Count 
                if($sessionsCount -gt 0) {
                    $RunConfigure = $false
                    break}
                $RunConfigure = $true
            }
        if($RunConfigure -eq $false) {
            Write-Information "iSCSI sessions are already established"
            return @{"status" = "success"
                 "error" = $null} | ConvertTo-Json
        }
        
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
        $data = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing
        $LocaliSCSIAddress = $data.Content
        Write-Information "Adding iSCSI Target Portals"
        Foreach ($TargetPortalAddress in $TargetPortalAddresses) {
            $null = New-IscsiTargetPortal -TargetPortalAddress $TargetPortalAddress -TargetPortalPortNumber 3260 -InitiatorPortalAddress $LocaliSCSIAddress
        }


        #Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance
        Write-Information "Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance"
        1..5 | % { Foreach ($TargetPortalAddress in $TargetPortalAddresses) { $null = Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $TargetPortalAddress -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true } }
        
        if($flow -eq 'optimize') {
        #Set the MPIO Policy to Round Robin
        Write-Information "Set the MPIO Policy to Round Robin"
        Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR
        }
        return @{"status" = "success"
                 "error" = $null} | ConvertTo-Json
    }
    catch {
        return @{"status" = "failed"
                 "error" = $_.Exception.Message} | ConvertTo-Json
    }


    `;

const MPIO_ISCSI_SESSIONS = (iscsiTargetAddresses: string[]) =>
    `
    Start-Transcript -Path "C:\\cfn\\log\\mpio-iscsci-sessions-remediation.log.txt" -Append | Out-Null
    $iscsiTargetAddresses = '${JSON.stringify(iscsiTargetAddresses)}' | ConvertFrom-Json
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
       ConvertTo-Json -InputObject $result
    }
`;

const REMEDIATE_MPIO_ISCSI_SESSIONS = (sessionsCountPerTarget: SessionsCountPerIscsiTarget[]) => `
    #Remediate MPIO iSCSI sessions
    Start-Transcript -Path "C:\\cfn\\log\\mpio-iscsci-sessions-remediation.log.txt" -Append | Out-Null
    $currentMpioSessionsCountPerTarget = '${JSON.stringify(sessionsCountPerTarget)}' | ConvertFrom-Json
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

        $sessionsPersistentConnected = $sessions | Where-Object {$_.IsConnected -and $_.IsPersistent}
        $sessionsPersistentConnectedCount = $sessionsPersistentConnected.Count
        $sessionsNonPersistentConnected = $sessions | Where-Object {$_.IsConnected -and (-Not($_.IsPersistent))}
        $sessionsNonPersistentConnectedCount = $sessionsNonPersistentConnected.Count

        Write-Information "Connected and persistent iSCSI sessions: $sessionsPersistentConnected"
        Write-Information "Connected and persistent iSCSI sessions Count: $sessionsPersistentConnectedCount"
        Write-Information "Connected and non-persistent iSCSI sessions: $sessionsNonPersistentConnected"
        Write-Information "Connected and non-persistent iSCSI sessions Count: $sessionsNonPersistentConnectedCount"

        if($sessionsCount -gt 5) {

            # Case when persistent sessions are less than 5
            if($sessionsPersistentConnectedCount -lt 5) {
                $sessionsToConnect = 5 - $sessionsPersistentConnectedCount
                $count = 0
                Foreach ($session in $sessionsNonPersistentConnected) {
                    $targetPortalAddress = (Get-IscsiTargetPortal -iSCSISession $session).TargetPortalAddress
                    if($targetPortalAddress -eq $address) {
                        try {
                            Register-IscsiSession -SessionIdentifier $session.SessionIdentifier
                            $perAddress.status = "success"
                            Write-Information "Successfully registered iSCSI session for address $address and session $session.SessionIdentifier"
                            $count++
                        } catch {
                            Write-Information "Failed to register iSCSI session for address $address and session $session.SessionIdentifier. Error message: $_.Exception.Message"
                            $perAddress.status = "failed"
                            $perAddress.error = $_.Exception.Message
                        }
                    }
                    if($count -eq $sessionsToConnect) {
                        $perAddress.status = "success"
                        $perAddress.error = $null
                        break }
                }
            } elseif($sessionsPersistentConnectedCount -gt 5) {
                # Case when persistent sessions are more than 5
                $count = 0
                Foreach ($session in $sessionsPersistentConnected) {
                    $targetPortalAddress = (Get-IscsiTargetPortal -iSCSISession $session).TargetPortalAddress
                    if($targetPortalAddress -eq $address) {
                        try {
                            Unregister-IscsiSession -SessionIdentifier $session.SessionIdentifier -ErrorAction SilentlyContinue
                            $perAddress.status = "success"
                            Write-Information "Successfully unregistered iSCSI session for address $address and session $session.SessionIdentifier"
                            $count++
                        } catch {
                            Write-Information "Failed to unregister iSCSI session for address $address and session $session.SessionIdentifier. Error message: $_.Exception.Message"
                            $perAddress.status = "failed"
                            $perAddress.error = $_.Exception.Message
                        }
                    }
                    if($count -eq ($sessionsPersistentConnectedCount - 5)) {
                        $perAddress.status = "success"
                        $perAddress.error = $null
                        break
                }
            }
        }
        
    }
        elseif($sessionsCount -lt 5) {
            if($sessionsCount -ne 0 -and $sessionsPersistentConnected.Count -lt 5) {
                $sessionsCount = 5 - $sessionsPersistentConnected.Count
            }
            try{
            $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
            $data = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4" -Headers @{"X-aws-ec2-metadata-token" = $token } -ErrorAction Stop -UseBasicParsing
            $LocaliSCSIAddress = $data.Content
            #Establish iSCSI connection. Creating 5 iSCSI sessions per target interface for optimum performance
            1..(5 - $sessionsCount) | % { $null = Get-IscsiTarget | Connect-IscsiTarget -IsMultipathEnabled $true -TargetPortalAddress $address -InitiatorPortalAddress $LocaliSCSIAddress -IsPersistent $true }
            $perAddress.status = "success"
            Write-Information "Successfully created iSCSI session for address $address."
            } catch {
                Write-Information "Failed to create iSCSI session for address $address. Error message: $_.Exception.Message"
                $perAddress.status = "failed"
                $perAddress.error = $_.Exception.Message
                    }
            }
        $result += $perAddress
        }
    ConvertTo-Json -InputObject $result
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
