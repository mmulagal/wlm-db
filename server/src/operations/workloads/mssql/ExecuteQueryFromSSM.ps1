param(
    [Parameter(Mandatory=$true)]
    [string]$Query,
    [Parameter(Mandatory=$false)]
    [string]$Database
)

if($DATABASE){
$results = sqlcmd -d $Database -Q $Query -y 0
}
else{
$results = sqlcmd -Q $Query -y 0
}
Write-Output $results 