[CmdletBinding()]
param(
[Parameter(Mandatory=$true)]
[string[]]$DriveLetters

)

try{
	foreach($letter in $DriveLetters) {
		$currentSize = (Get-Partition -DriveLetter $letter).size
		$size = Get-PartitionSupportedSize -DriveLetter $letter
		if($size.SizeMax -gt $currentSize) {
			Resize-Partition -DriveLetter $letter -Size $size.SizeMax
	        Start-Sleep -s 1
	    }
	}
	
} catch {
    Write-Host $_.Exception.Message
    $_ | Write-AWSLaunchWizardException
}