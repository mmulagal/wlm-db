param(
        [Parameter(Mandatory=$true)]
        $FilePath,
        [Parameter(Mandatory=$true)]
        $SignatureFilePath,
        [Parameter(Mandatory=$true)]
        $PubFilePath
    )

$ErrorActionPreference = "Stop"
$LogFilePath = "C:\cfn\log\$($MyInvocation.MyCommand.Name).log"
Start-Transcript -Path $LogFilePath -Append

try 
    {
        & "C:\cfn\OpenSSL-Win64\bin\openssl.exe" dgst -sha256 -verify $PubFilePath -signature $SignatureFilePath  $FilePath > $LogFilePath 2>&1
    }
catch 
    {
        Write-Host "Error while verifying signature for $FilePath"
     } 
    

Add-Type -TypeDefinition $code -Language CSharp
$VerifySig = [Crypto.CryptoHelper]::VerifySignature($FilePath,$SignatureFilePath)
#$VerifySig = Invoke-Expression $code
If ($VerifySig)
{
    Write-Output " Signature Verified for "+$FilePath
}
else {
     Write-Output "Signature verification failed "+$FilePath
     exit 1
}



