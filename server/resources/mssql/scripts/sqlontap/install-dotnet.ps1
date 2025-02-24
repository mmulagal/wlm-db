 #Install Dot Net Core Runtime

 Start-Transcript -Path C:\cfn\log\installdotnetcore.ps1.txt -Append
 $ErrorActionPreference = "Stop"
 
 try{
  Start-Process "C:\cfn\Installer\dotnet\dotnet-hosting.exe" -argumentlist "/silent /install" -Wait
 }catch{
     Write-Output $_
     Write-Output "Failed to install .Net runtime Windows hosting bundle on the system. Manually install this dependency for SnapCenter from https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-aspnetcore-8.0.10-windows-hosting-bundle-installer"
 }
  
 