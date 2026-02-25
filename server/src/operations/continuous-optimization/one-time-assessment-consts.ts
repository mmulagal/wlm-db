/**
 * Constants for MSSQL One-Time Assessment (Offline Assessment)
 *
 * This file contains constants specific to the one-time assessment functionality,
 * including the README content that is included in the downloadable ZIP file.
 */

const MSSQL_ONE_TIME_ASSESSMENT_README = `
# MSSQL One-Time Assessment Script

**Copyright (c) 2026 NetApp, Inc. All rights reserved.**

## Overview

This PowerShell script performs a comprehensive assessment of your SQL Server environment and its storage configuration on NetApp ONTAP storage systems (Amazon FSx for NetApp ONTAP). The script collects SQL Server instance configuration, mapped ONTAP volumes and LUN details, storage configuration best practices analysis, high availability settings (FCI/AOAG), and enterprise feature usage for license optimization.

## Prerequisites

### Required
- **PowerShell 5.1 or later** - The script requires PowerShell 5.1 minimum
- **SQL Server sqlcmd utility** - Must be installed and accessible in the system PATH
- **Windows Server** - Script must run on a Windows Server with SQL Server installed
- **Network connectivity** - Access to the FSx for ONTAP management endpoint
- **SQL Server access** - Windows Authentication or SQL Authentication credentials for the SQL Server instance
- **ONTAP storage credentials** - Credentials for accessing the FSx for ONTAP storage system

### SQL Server Instance Access
- The script requires access to the SQL Server instance you want to assess
- For Windows Authentication: The user running the script must have appropriate SQL Server permissions
- For SQL Authentication: You will be prompted for SQL Server username and password if not available in credential stores

### High Availability Deployments (FCI and AOAG)
- **Important**: For Failover Cluster Instances (FCI) and Always On Availability Groups (AOAG), the assessment must be run from the **primary node**
- Running the assessment from a secondary/standby node may result in incomplete or inaccurate assessment data

### ONTAP Storage Access
- The script requires ONTAP storage system credentials
- Credentials can be provided via:
  - AWS Secrets Manager (recommended for EC2 instances)
  - Windows Credential Manager
  - Interactive prompt (fallback)

## Usage Examples

### Example 1: Using FSx File System ID (Default Instance)
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageEndpoint fs-0123456789abcdef0 -Instance MSSQLSERVER
\`\`\`

This example:
- Uses the FSx file system ID to identify the storage system
- Assesses the default SQL Server instance (MSSQLSERVER)
- Saves output to the current working directory

### Example 2: Using Management IP Address (Named Instance)
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageEndpoint 10.0.1.100 -Instance SQLInstance1
\`\`\`

This example:
- Uses the ONTAP management IP address directly
- Assesses a named SQL Server instance called "SQLInstance1"
- Saves output to the current working directory

### Example 3: Custom Output Directory
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageEndpoint fs-0123456789abcdef0 -Instance MSSQLSERVER -OutputPath "C:\\AssessmentResults"
\`\`\`

This example:
- Runs the assessment with a custom output directory
- Creates the directory if it doesn't exist
- Saves JSON output files to the specified path

### Example 4: Named Instance with Custom Path
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageEndpoint 192.168.1.50 -Instance PROD -OutputPath "D:\\Reports\\SQLAssessment"
\`\`\`

## Parameters

### -StorageEndpoint (Required)
The storage system identifier. Can be provided in one of two formats:

**Option 1: FSx File System ID**
- Format: \`fs-xxxxxxxxxxxxxxxxx\` (where x is alphanumeric)
- Example: \`fs-0123456789abcdef0\`
- The script automatically constructs the management endpoint
- Falls back to management IP if domain cannot be resolved

**Option 2: FSx Management IP Address**
- Format: Valid IPv4 address
- Example: \`10.0.1.100\` or \`192.168.1.50\`
- Must be reachable from the host where the script is running

### -Instance (Required)
The name of the SQL Server instance to assess:

**Default Instance:**
- Use: \`MSSQLSERVER\` (case-insensitive)

**Named Instance:**
- Use the exact instance name as configured during installation
- Examples: \`PROD\`, \`SQLInstance1\`, \`DEVELOPMENT\`

### -OutputPath (Optional)
The directory path where JSON output files should be created:
- If not specified, files are saved in the current working directory
- If the path doesn't exist, it will be created automatically
- If the path cannot be used (e.g., permission denied), files will be created in the current working directory instead

## Good to Have: Instance Profile Permissions

If running on an EC2 instance, the following IAM instance profile permissions are recommended for optimal functionality:

### AWS Secrets Manager Access (Recommended when using AWS Secrets Manager)
Allows the script to automatically retrieve SQL Server and ONTAP credentials from AWS Secrets Manager:

\`\`\`json
{
    "Effect": "Allow",
    "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
    ],
    "Resource": [
        "arn:aws:secretsmanager:*:*:secret:*"
    ]
}
\`\`\`

**Secret Naming Convention:**
- SQL Server credentials: \`<Hostname>/<InstanceName>\`
- ONTAP credentials: Use the StorageEndpoint (FSx ID or Management IP) as the secret name

### EC2 Metadata Access (Recommended)
Allows the script to automatically detect EC2 instance metadata:

\`\`\`json
{
    "Effect": "Allow",
    "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVpcs"
    ],
    "Resource": "*"
}
\`\`\`

### FSx API Access (Optional but Recommended)
Allows the script to automatically retrieve FSx file system details when using FSx ID:

\`\`\`json
{
    "Effect": "Allow",
    "Action": [
        "fsx:DescribeFileSystems"
    ],
    "Resource": "*"
}
\`\`\`

## Output

The script generates a JSON file with the following naming convention:
\`MSSQL_Assessment_v1_<InstanceName>_<Timestamp>.json\`

The output includes:
- **Metadata**: EC2 instance details, region, hostname, assessment timestamp
- **Instance Level Details**: SQL Server configuration, version, databases, volumes, LUNs
- **Host Level Details**: Operating system configuration, storage settings
- **Assessment Results**: Best practices analysis, optimization recommendations

## Credential Resolution Order

The script attempts to retrieve credentials in the following order:

1. **AWS Secrets Manager** (if running on EC2 with instance profile)
2. **Windows Credential Manager**
3. **Interactive Prompt** (fallback)

## Troubleshooting

### Common Issues

**Issue: Cannot connect to SQL Server**
- Verify the instance name is correct
- Ensure SQL Server service is running
- Check Windows Firewall rules for SQL Server port
- Verify SQL Server authentication mode allows your connection type

**Issue: Cannot connect to ONTAP storage**
- Verify the StorageEndpoint is correct (FSx ID or Management IP)
- Check network connectivity to the management endpoint
- Ensure ONTAP credentials are correct
- Verify security group rules allow access to the management endpoint

**Issue: Script fails with permission errors**
- Run PowerShell as Administrator if needed
- Verify the output directory has write permissions
- Check SQL Server permissions for the user account

**Issue: AWS Secrets Manager access denied**
- Verify the EC2 instance has an IAM instance profile attached
- Check the instance profile has Secrets Manager permissions
- Ensure the secret names match the expected format

**Issue: Incomplete assessment data for FCI/AOAG**
- Ensure you are running the assessment from the primary node
- For FCI: Verify the current owner node using Failover Cluster Manager
- For AOAG: Verify the primary replica status using SQL Server Management Studio
- Secondary/standby nodes may not have access to all required configuration data

## Support

For additional support and documentation, please refer to the NetApp Workload Factory documentation or contact your NetApp representative.

## Version

Script Version: 1.0.0

---

**Copyright (c) 2026 NetApp, Inc. All rights reserved.**
`;

export { MSSQL_ONE_TIME_ASSESSMENT_README };
