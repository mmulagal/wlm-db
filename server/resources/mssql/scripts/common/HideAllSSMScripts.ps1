Get-ChildItem -path 'C:\SSM' -Recurse -Force | foreach {$_.attributes = "Hidden"}
Get-ChildItem -path 'C:\SSM' -Recurse -Force | foreach {$_.IsReadOnly = $true} 

$FILE=Get-Item 'C:\SSM' -Force
$FILE.attributes='Hidden' 

