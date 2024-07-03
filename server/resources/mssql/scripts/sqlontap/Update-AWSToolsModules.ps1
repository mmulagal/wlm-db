#Requires -Version 7.0

# Sometimes deployments fail with mismatched versions of AWS Tools modules
# You have mismatched versions of the AWS.Tools modules. You can use Update-AWSToolsModule to synchronize the versions of all installed AWS.Tools modules.

Start-Transcript -Path C:\cfn\log\update-awstoolsmodules.ps1.txt -Append

try {
    
    Update-AWSToolsModule -SkipPublisherCheck -AllowClobber -Force

}catch {

    Write-Output "Update-AWSToolsModule failed. Error: $_"

}