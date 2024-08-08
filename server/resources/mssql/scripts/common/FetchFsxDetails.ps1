[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$FsxFileSystemId
)

Start-Transcript -Path C:\cfn\log\FetchFsxDetails.ps1.txt -Append

$details = $null
try
{     
   $details = Get-FSXFileSystem -FileSystemId $FsxFileSystemId
} catch {
    if($_.Exception.Message -match "Rate Limit exceeded") {
        Write-Output "Encountered Rate Limit exceeded while fetching SSM parameter. Reattempting after 5 seconds..."
        Start-Sleep 5
        $details = Get-FSXFileSystem -FileSystemId $FsxFileSystemId
    }
}

if([string]::IsNullOrEmpty($details)) {
    throw "Unable to fetch details for $FsxFileSystemId."
}

$details 
