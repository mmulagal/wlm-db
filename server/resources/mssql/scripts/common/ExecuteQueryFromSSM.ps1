param(
    [Parameter(Mandatory=$true)]
    [string]$Query,
    [Parameter(Mandatory=$false)]
    [string]$Database
)

if($DATABASE){
$results = sqlcmd -d $Database -C -Q $Query -y 0
}
else{
$results = sqlcmd -C -Q $Query -y 0
}
Write-Output $results 