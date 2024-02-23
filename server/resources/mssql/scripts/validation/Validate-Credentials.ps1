    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$DomainName,

        [Parameter(Mandatory=$false)]
        [string]$UserName,

        [Parameter(Mandatory=$true)]
        [boolean]$isSecretManagerSupported,

        [Parameter(Mandatory=$false)]
        [string]$UserCredentials,

        [Parameter(Mandatory=$true)]
        [string]$Stackname,

        [Parameter(Mandatory=$true)]
        [string]$Parentstackname,

        [Parameter(Mandatory=$true)]
        [string]$ResourceID,

        [Parameter(Mandatory=$true)]
        [string]$WaitHandler   
    )
    
    $Failed= $false
    $FailedUsers = @()
    
    Start-Transcript -Path C:\cfn\log\validatecredentials.ps1.txt -Append

    #get Instance ID
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri "http://169.254.169.254/latest/api/token"
    $instanceID = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id

    try
    {
        # Verify Domain Join worked fine

        if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
            Install-WindowsFeature RSAT-AD-PowerShell *>$null
        }
        if ($isSecretManagerSupported) {
            try {
                $secure = Get-SECSecretValue -secretId $DomainAdminSecretName -Select SecretString | ConvertFrom-Json | Select -ExpandProperty password
            }
            catch {
                $Failed = $true
                $FailureReason = '"{0}"' -f "Unable to fetch secret, check secret name $DomainAdminSecretName and access to Secrets Manager"
                Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
                Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
                Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
                exit(1)
            }
        }
        else {
            try {
            $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$Parentstackname" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
            $secure = $SsmParameter.domain.password
            # $secure = (Get-SSMParameterValue -Names $DomainAdminSecretName -WithDecryption $True).Parameters[0].Value
            }
             catch {
                $Failed = $true
                $FailureReason = '"{0}"' -f "Unable to fetch SSM parameter, /netapp/wlmdb/$Parentstackname and access to SSM parameter store"
                Write-Output @{status= "Failed"; reason=$FailureReason} | ConvertTo-Json -Compress
                Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
                Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
                exit(1)
            }
        }
        $pass = ConvertTo-SecureString $secure -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential -ArgumentList $UserName, $pass
        Import-Module ActiveDirectory *>$null
        $domain = (Get-ADDomain -Server $DomainName -Credential $cred).DNSRoot
        if ($UserCredentials -ne $null) {
            # Convert the credentials to Hashtable
            # Example of user credentials: "{"SQL Server Account": {"user":"sqlsa", "password":"ssm.parameter.store.key1"}, "Some other account": {"user": "someuser", "password":"ssm.parameter.store.key2"}}"
            $UserCredentialsJson = ConvertFrom-Json $UserCredentials
            $UserCredentialsHashTable = @{}
            foreach ($property in $UserCredentialsJson.PSObject.Properties) {
                $UserCredentialsHashTable[$property.Name] = $property.Value
            }
            foreach ($Account in $UserCredentialsHashTable.Keys) {
                $credentials = @{}
                foreach ($property in $UserCredentialsHashTable[$Account].PSObject.Properties) {
                    $credentials[$property.Name] = $property.Value
                }

                $User = $credentials["user"]
                $PasswordKey = $credentials["password"]

                try {
                    # Check if user exists in AD
                    if (Get-ADUser -Server $domain -Filter {sAMAccountName -eq $User} -Credential $cred) {
                        # If user exists in AD, check for it credentials. If the user does not exist, provisioning process will create new user
			            $usersecure = (Get-SSMParameterValue -Names $PasswordKey -WithDecryption $True).Parameters[0].Value
			            $userpass = ConvertTo-SecureString $usersecure -AsPlainText -Force
                        $usercred = New-Object System.Management.Automation.PSCredential -ArgumentList $User, $userpass


                        $user = (Get-ADUser -Server $domain -Filter {sAMAccountName -eq $User} -Credential $usercred).Name

                        if (-Not $user) {
                            $Failed = $true
                            $FailedUsers += "$Account (username - $User)"
                        }

                    } else {
                        # Did not find the user in AD, we will create it during Provisioning process
                    }
                } catch {
                    $Failed = $true
                    $FailedUsers += "$Account (username - $User)"
                }
            }
        }
    }
    catch
    {
        $FailureReason = '"{0}"' -f "Failed to join domain with provided Active Directory credentials. Exception: $_" 
        Write-Output @{ status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress
        Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
        Send-CFNResourceSignal -StackName $Stackname -Status FAILURE -LogicalResourceId $ResourceID -UniqueId $instanceId
        exit(1)
    }

    if($Failed -ne $true) {
        Write-Output @{ status= "Completed"; reason= "Done." } | ConvertTo-Json -Compress
        Start-Process "cfn-signal.exe" -ArgumentList "-e 0 $WaitHandler" -Wait -NoNewWindow
    } else {
        $FailureReason = '"{0}"' -f "Incorrect credentials for $($FailedUsers -join ', ')" 
        Write-Output @{ status = "Failed"; reason = $FailureReason } | ConvertTo-Json -Compress       
        Start-Process "cfn-signal.exe" -ArgumentList "-e 1 -r $FailureReason $WaitHandler" -Wait -NoNewWindow
        exit(1)
    }
