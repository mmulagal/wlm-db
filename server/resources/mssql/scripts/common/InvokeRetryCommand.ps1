function Invoke-WithRetry {
   param(
       [scriptblock]$Command,
       [int]$RetryCount = 3,
       [int]$WaitSeconds = 5
   )



   $attempt = 0
   while ($true) {
       try {
           $attempt++
           return & $Command
       } catch {
           if ($_.Exception.Message -match "Rate Limit exceeded" -and $attempt -le $RetryCount) {
               Write-Output "Encountered Rate Limit exceeded. Reattempting after $WaitSeconds seconds..."
               Start-Sleep -Seconds $WaitSeconds
           } else {
               throw
           }
       }
   }
}

 