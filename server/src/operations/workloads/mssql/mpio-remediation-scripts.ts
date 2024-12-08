import { OptimizeMpioPolicyParams } from '../../../utils/common-types';

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
    }
    catch {
        $FailureReason = "Error connecting to Iscsi targets"
        Write-Output $FailureReason
    }
`;

export {
    REMEDIATE_MPIO_POLICY,
    CHECK_MPIO_POLICY,
    RESTART_INSTANCE,
    CHECK_IF_MPIO_INSTALLED,
    ENABLE_MPIO_AND_CONFIGURE
};
