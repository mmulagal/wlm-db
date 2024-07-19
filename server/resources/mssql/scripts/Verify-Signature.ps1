#The following command was used to sign the file
#aws kms sign --key-id alias/sample-sign-verify-key --message-type RAW --signing-algorithm RSASSA_PKCS1_V1_5_SHA_256 --message fileb://../unsigned.txt --output text --query Signature | base64 --decode > sig.dat
#The public key was extracted using the following command (it's available via the Console as well):
#aws kms get-public-key --key-id alias/ScriptSigningKey --output text --query PublicKey | base64 --decode > SamplePublicKey.der
#It was then processed further to extract the raw modulus and exponent for convenience

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
        & "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" dgst -sha256 -verify $PubFilePath -signature $SignatureFilePath  $FilePath > $LogFilePath 2>&1
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



