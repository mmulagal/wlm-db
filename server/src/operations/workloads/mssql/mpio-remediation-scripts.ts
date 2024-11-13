const CHECK_MPIO_POLICY = `

$currentMpioPolicy = Get-MSDSMGlobalDefaultLoadBalancePolicy
if ($currentMpioPolicy -ceq "RR") {
   return @{"remediated" = $true
             "policy" = $currentMpioPolicy} | ConvertTo-Json
}
   return @{"remediated" = $false
             "policy" = $currentMpioPolicy} | ConvertTo-Json

`;
const REMEDIATE_MPIO_POLICY = (sqlDeploymentType: string) =>
    `
    $sqlDeploymentType = "${sqlDeploymentType}"
    
    Set-MSDSMGlobalDefaultLoadBalancePolicy -Policy RR 
   
    if($sqlDeploymentType -ceq "standalone") {
        Start-Process -FilePath "shutdown.exe" -ArgumentList @("/r") -Wait -NoNewWindow
    }
`;

export { REMEDIATE_MPIO_POLICY, CHECK_MPIO_POLICY };
