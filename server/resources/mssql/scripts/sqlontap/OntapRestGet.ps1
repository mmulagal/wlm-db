[CmdletBinding()]
param(
    
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

add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(
        ServicePoint srvPoint, X509Certificate certificate,
        WebRequest request, int certificateProblem) {
            return true;
        }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

$SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
$FSxUserName = $SsmParameter.fsx.username
$FSxPassword = $SsmParameter.fsx.password

$FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("$(${FSxUserName}):$(${FSxPassword})"))

# Get region Certificateificate for FSx
$isprivatesubnet = $False
$FSxCertificateificateUri = "https://fsx-aws-Certificates.s3.amazonaws.com/bundle-${FSxRegion}.pem"
try {
        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\cfn\FSxCertificate.pem
        $Certificate = Import-Certificate -FilePath C:\cfn\FSxCertificate.pem -CertStoreLocation Cert:\LocalMachine\Root
        $regionCertificateificate = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like $Certificate.Subject }
    }
catch {
        $isprivatesubnet = $True      
    }

Write-output "Private subnet $isprivatesubnet"

$Ampersand = ""
if ($OntapResourceFilter -ne "" -and $OntapResourceQuery -ne "") {
    $Ampersand = '&';
}

$Params = @{
    "URI"         = "https://management.${FSxID}.fsx.${FSxRegion}.amazonaws.com/api/${OntapResourceEndpoint}?${OntapResourceFilter}${Ampersand}${OntapResourceQuery}"
    "Method"      = "GET"
    "Headers"     = @{"Authorization" = "Basic $FSxCredentialsInBase64" }
    "ContentType" = "application/json"
}

if($isprivatesubnet -eq $False) {
        Invoke-RestMethod @Params -Certificate $regionCertificateificate | ConvertTo-Json -Depth 100
    }else {
        Invoke-RestMethod @Params | ConvertTo-Json -Depth 100
    }
