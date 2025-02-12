# SQL Server Data Collection Script

## Overview

This PowerShell script, `SQLServerDataCollector.ps1`, collects detailed information about the Windows system and SQL Server instances on a specified remote computer. The data includes OS edition, CPU count, RAM size, network configuration, disk details, and SQL Server instance details. The script outputs the collected data in JSON format.

## Prerequisites

-   PowerShell 3.0 or later
-   Necessary permissions to access Windows Management Instrumentation (WMI) and SQL Server on the remote computer
-   Network connectivity to the remote computer

## Usage

1. Download the script file `SQLServerDataCollector.ps1`.
2. Open PowerShell with administrative privileges.
3. Navigate to the directory where the script is downloaded.
4. Run the script without any parameters to assess all instances with Windows configuration.
5. Run the script by passing the SQL instances to be assessed using the `-InstanceNames` parameter.
6. Run the script by passing the SQL username with the `-SqlUserName` parameter for instances with SQL authentication specified with the `-InstanceNames` parameter.
7. Run the script with the following required parameters: `-InstanceNames`and `-SqlUserName`.

### Parameters

-   `-InstanceNames`: (Optional) Array of SQL Server instance names to query. If not specified, the script will attempt to gather information from all available SQL Server instances on the remote computer
-   `-SqlUserName`: (Optional) SQL Server username for authentication. If not specified, Windows Authentication will be used.

### Example

```powershell
.\SQLServerDataCollector.ps1 -InstanceNames "MSSQLSERVER", "SALES" -SqlUserName "sa"
```
