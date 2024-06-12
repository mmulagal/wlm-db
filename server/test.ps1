$WarningPreference = 'SilentlyContinue'

$resp = @{}
try {
    Function Test {
        Write-Host "Test"
    
        throw "Error"
    }

    Test
} catch {
    write-host $_.Exception.Message
    $resp['error'] = $_.Exception.Message
}

$resp | ConvertTo-Json
