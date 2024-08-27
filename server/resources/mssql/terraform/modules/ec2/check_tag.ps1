param(
    [Parameter(Mandatory = $true)]
    [string]$instance_id,
    
    [Parameter(Mandatory = $true)]
    [string]$region
)

# Import the AWS module
Import-Module AWSPowerShell.NetCore

# Get the tags for the instance
$tags = Get-EC2Tag -Filters @{ Name = "resource-id"; Values = $instance_id } -Region $region

# Initialize a flag to indicate whether the 'user_data' tag was found
$user_data_found = $false

# Find the 'user_data' tag and print its value
foreach ($tag in $tags) {
    if ($tag.Key -eq "user_data" -and $tag.Value -eq "completed") {
        Write-Output "completed"
        $user_data_found = $true
        break
    }
}

# If the 'user_data' tag was not found, print a message
if (-not $user_data_found) {
    Write-Output "The 'user_data' tag was not found."
}