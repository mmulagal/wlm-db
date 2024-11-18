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
    $sqlDeploymentType = "${mpioParams.sqlDeploymentType}"
    $runningOnPrimaryNode = [System.Convert]::ToBoolean('${runningOnPrimaryNode}')
    $currentPolicy = "${
        runningOnPrimaryNode ? mpioParams.activeNodeCurrentPolicy : mpioParams.standbyNodeCurrentPolicy
    }"
    $changeClusterOwnership = [System.Convert]::ToBoolean('${mpioParams.changeClusterOwnership}')

    if($currentPolicy -ne "RR") {
        Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR 
    }
   
    if($sqlDeploymentType -eq "standalone") {
        ${RESTART_INSTANCE}
    }
    elseif($sqlDeploymentType -eq "fci")  {
        if($changeClusterOwnership -eq $true) {

            $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server (${mpioParams.instanceName})")
            $SQLGroup = $SQLRoleGroup[0]
            Move-ClusterGroup -Name $SQLGroup -Node ${
                runningOnPrimaryNode ? mpioParams.standbyNodeName : mpioParams.activeNodeName
            }

        }
        
        if($currentPolicy -ne "RR") {
            ${RESTART_INSTANCE}
        }       
    }
`;

export { REMEDIATE_MPIO_POLICY, CHECK_MPIO_POLICY, RESTART_INSTANCE };
