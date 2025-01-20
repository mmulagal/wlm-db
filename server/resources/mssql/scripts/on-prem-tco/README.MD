# On-Prem TCO Data Collection Script

## Overview

This PowerShell script, `OnPremTCOCollector.ps1`, collects detailed information about the Windows system and SQL Server instances on a specified remote computer. The data includes OS edition, CPU count, RAM size, network configuration, disk details, and SQL Server instance details. The script outputs the collected data in JSON format.

## Prerequisites

-   PowerShell 3.0 or later
-   Necessary permissions to access WMI and SQL Server on the remote computer
-   Network connectivity to the remote computer

## Usage

1. Download the script file `OnPremTCOCollector.ps1`.
2. Open PowerShell with administrative privileges.
3. Navigate to the directory where the script is downloaded.
4. Run the script with the required parameters.

### Parameters

-   `-instanceNames`: (Optional) Array of SQL Server instance names to query.
-   `-SqlUserName`: (Optional) SQL Server username for authentication.

### Example

```powershell
.\OnPremTCOCollector.ps1 -instanceNames "MSSQLSERVER", "SALES" -SqlUserName "sa"
```
