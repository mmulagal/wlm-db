param(
    [Parameter(Mandatory=$true)]
    [string]$Query
)
 
$results = Invoke-Sqlcmd -Query $Query | ConvertTo-Json
$objects = ConvertFrom-Json $results
$objects | ForEach-Object {

    $_.PSObject.Properties.Remove('RowError')
    $_.PSObject.Properties.Remove('RowState')
    $_.PSObject.Properties.Remove('Table')
    $_.PSObject.Properties.Remove('ItemArray')
    $_.PSObject.Properties.Remove('HasErrors')

}

$updatedJson = $objects | ConvertTo-Json
Write-Output $updatedJson