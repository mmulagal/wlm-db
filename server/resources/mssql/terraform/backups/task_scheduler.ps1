Function New-ScheduledTask {
    try {
        $Action = New-ScheduledTaskAction -Execute '%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe' -Argument 'C:\cfn\scripts\Sql-Setup.ps1 -deployment_name "wlmdb-poc-terraform-SqlStandalone-deployment" -region "ap-southeast-1" -sql_server_name "sqldbspt7e" -sql_svm_name "wlmdb_sqlsvm_1724065163786" -fsx_data_volume_name "wlmdb_sqldata_1724065163786" -fsx_log_volume_name "wlmdb_sqllog_1724065163786" -fsx_file_system_id "fs-07120e598080fa151" -fsx_temp_db_volume_name "wlmdb_sqltemp_1724065163786" -fsx_data_lun_size "204800" -sql_igroup_name "wlmdb_sqligroup_1724065163786" -fsx_volume_snapshot_policy "daily_weekretention" -ad_dns_ip_addresses "10.0.140.140" -domain_dns_name "wlmqa2.com" -domain_admin_user "admin" -sql_admin_accounts "sqladminaje7m" -sql_collation "SQL_Latin1_General_CP1_CI_AS" | Out-File "C:\sqloutput2.txt"'
        $currentTime = Get-Date
        $newTime = $currentTime.AddSeconds(20)
        $Trigger = New-ScheduledTaskTrigger -Once -At $newTime 
        $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        #$Settings = New-ScheduledTaskSettingsSet -DontStopIfGoingOnBatteries -StopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 1)
        #$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -DisallowStartIfOnBatteries -StopIfGoingOnBatteries -AllowHardTerminate -StartWhenAvailable $false -RunOnlyIfNetworkAvailable $false -IdleSettings (New-ScheduledTaskIdleSettings -StopOnIdleEnd -RestartOnIdle $false) -AllowStartOnDemand -Enabled -Hidden $false -RunOnlyIfIdle $false -WakeToRun $false -ExecutionTimeLimit "P1D" -Priority 7 -RestartOnFailure (New-ScheduledTaskRestartOnFailure -Interval (New-TimeSpan -Minutes 15) -Count 3)
        Register-ScheduledTask -TaskName "sqlsetupps" -Action $Action -Trigger $Trigger -Principal $Principal -Description "test setup ps" -TaskPath "\sqlsetup"
    }
    catch {
        Write-Error "Failed to create scheduled task: $_"
    }
}
New-ScheduledTask

 
