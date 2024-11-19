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

export { REMEDIATE_MPIO_POLICY, CHECK_MPIO_POLICY, RESTART_INSTANCE };
