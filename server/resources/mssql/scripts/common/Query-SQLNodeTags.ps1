
[CmdletBinding()]
param(

    [Parameter(Mandatory=$true)]
    [string]$StackName,

    [Parameter(Mandatory=$true)]
    [string]
    $NumberOfNodes
)
    Start-Transcript -Path C:\cfn\log\Query-SQLNodeTags.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    
    try
    {
        #Query EC2 Tags for SQL nodes information
        $count = 0
        while ($count -le 15)
        {
        $result = Get-EC2Tag -Filter @{Name="tag:CF-WLMDB-StackName";Values=$StackName}
        Write-Output $result.count
        $nodenumber = [int]$numberOfNodes
        if ($result.count -lt $nodenumber)
            {
                $count++
                Write-OutPut " Count is $count"
                Write-Output " Number of Nodes is $($result.count)"
                sleep 180
            }
            else
            {
                Write-Output " Number of Nodes is $($result.count)"
                break
            }
        }
        If ($count -gt 15)
        {
            throw "SQL Node Tags count does not match Node count. Exiting"
        }
    }catch{
            $_ | Write-AWSLaunchWizardException
    }