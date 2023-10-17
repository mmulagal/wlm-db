[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FSxUserName,

    [Parameter(Mandatory = $true)]
    [SecureString]$FSxPassword,

    [Parameter(Mandatory = $true)]
    [string]$FSxID,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion,

    [Parameter(Mandatory = $true)]
    [string]$OntapResourceEndpoint,

    [Parameter(Mandatory = $false)]
    [string]$OntapResourceFilter,

    [Parameter(Mandatory = $false)]
    [string]$OntapResourceQuery

)

<#
$SecretInfo = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId ${secrentId}).SecretString
$username = $SecretInfo.username
$password = $SecretInfo.password
#>

$ManagementEndpointDnsName = "management.${FSxID}.fsx.${FSxRegion}.amazonaws.com"
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("$($FSxUserName):$($FSxPassword)"))

function makeRestCall {
    # Get region Certificateificate for FSx
    $FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
    Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
    $Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
    $regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | ? { $_.Subject -like $Certificate.Subject }

    $OntapRestUri = "https://$ManagementEndpointDnsName/api/";
    if ($OntapResourceEndpoint -ne "") {
        $OntapRestUri += $OntapResourceEndpoint
    }

    if ($OntapResourceFilter -ne "" -and $OntapResourceQuery -ne "") {
        $OntapRestUri += "?${OntapResourceFilter}&${OntapResourceQuery}";
    }
    elseif ($OntapResourceFilter -ne "") {
        $OntapRestUri += "?${OntapResourceFilter}";
    }
    elseif ($OntapResourceQuery -ne "") {
        $OntapRestUri += "?{OntapResourceQuery}";
    }

    $JsonBody = $Body | ConvertTo-Json
    $Params = @{
        "URI"         = "${OntapRestUri}"
        "Method"      = "GET"
        "Headers"     = @{"Authorization" = "Basic $FSxCredentialsInBase64" }
        "ContentType" = "application/json"
    }

    Invoke-RestMethod @Params -Certificate $regionCertificateificate | ConvertTo-Json -Depth 100
}

makeRestCall
