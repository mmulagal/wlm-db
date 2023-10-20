[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FSxSecret,

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

$SecretInfo = ConvertFrom-Json -InputObject (Get-SECSecretValue -SecretId ${FSxSecret}).SecretString
$FSxUserName = $SecretInfo.username
$FSxPassword = $SecretInfo.password

function makeRestCall {
    $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("$(${FSxUserName}):$(${FSxPassword})"))

    # Get region Certificateificate for FSx
    $FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
    Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
    $Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
    $regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | ? { $_.Subject -like $Certificate.Subject }

    $Ampersand = ""
    if ($OntapResourceFilter -ne "" -and $OntapResourceQuery -ne "") {
        $Ampersand = '&';
    }

    $JsonBody = $Body | ConvertTo-Json
    $Params = @{
        "URI"         = "https://management.${FSxID}.fsx.${FSxRegion}.amazonaws.com/api/${OntapResourceEndpoint}?${OntapResourceFilter}${Ampersand}${OntapResourceQuery}"
        "Method"      = "GET"
        "Headers"     = @{"Authorization" = "Basic $FSxCredentialsInBase64" }
        "ContentType" = "application/json"
    }

    Invoke-RestMethod @Params -Certificate $regionCertificateificate | ConvertTo-Json -Depth 100
}

makeRestCall
