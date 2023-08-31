
$username = "fsxadmin"
$password = "Jayusc1992"
##Create Volume with ONTAP RestAPI via PowerShell 7.0
#$fslist = Get-FSXFileSystem|?{$_.Tags.Key -eq 'aws:cloudformation:stack-name' -and $_.Tags.Value -eq $Stackname}
$fslist = Get-FSXFileSystem -FileSystemId 'fs-0a654bf561f9b10a6'
$MgmtIP = $fslist.ontapconfiguration.Endpoints.Management.IpAddresses
$volume="SQLCluster01"
$pair = "$($username):$($password)"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

#Start ONTAP configuration
$UriDynamicPart='private/cli/volume'
$Params = @{
    "URI"     = "https://$MgmtIP/api/$UriDynamicPart"
    "Method"  = "GET"
    "Headers" = @{"Authorization" = "Basic $base64"}
    "ContentType" = "application/json"
}
Invoke-RestMethod @Params -SkipCertificateCheck