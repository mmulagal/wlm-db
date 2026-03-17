/**
 * Constants for One-Time Assessment (Offline Assessment)
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

### Example 1: Using Management FQDN (Default Instance)
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageManagementAddress management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com -SqlInstanceName MSSQLSERVER
\`\`\`

This example:
- Uses the ONTAP management FQDN (Fully Qualified Domain Name) directly
- Assesses the default SQL Server instance (MSSQLSERVER)
- Saves output to the current working directory

### Example 2: Using Management IP Address (Named Instance)
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageManagementAddress 10.0.1.100 -SqlInstanceName SQLInstance1
\`\`\`

This example:
- Uses the ONTAP management IP address directly
- Assesses a named SQL Server instance called "SQLInstance1"
- Saves output to the current working directory

### Example 3: Using FSx File System ID (Default Instance)
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageManagementAddress fs-0123456789abcdef0 -SqlInstanceName MSSQLSERVER
\`\`\`

This example:
- Uses the FSx file system ID to identify the storage system
- Assesses the default SQL Server instance (MSSQLSERVER)
- Saves output to the current working directory

### Example 4: Custom Output Directory
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageManagementAddress fs-0123456789abcdef0 -SqlInstanceName MSSQLSERVER -OutputPath "C:\\AssessmentResults"
\`\`\`

This example:
- Runs the assessment with a custom output directory
- Creates the directory if it doesn't exist
- Saves JSON output files to the specified path

### Example 5: Named Instance with Custom Path
\`\`\`powershell
.\\NetApp_WF_MSSQL_Assessment_v1.0.0.ps1 -StorageManagementAddress 192.168.1.50 -SqlInstanceName PROD -OutputPath "D:\\Reports\\SQLAssessment"
\`\`\`

## Parameters

### -StorageManagementAddress (Required)
The storage system identifier. Can be provided in one of three formats:

**Option 1: FSx Management FQDN (Fully Qualified Domain Name)**
- Format: Valid domain name
- Example: \`management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com\`
- Must be DNS-resolvable from the host where the script is running
- You can find the management FQDN in the AWS Console under FSx file system details (ONTAP Configuration > Management Endpoint), or by using the AWS CLI: \`aws fsx describe-file-systems --file-system-id <fsx-id> --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.DNSName'\`

**Option 2: FSx Management IP Address**
- Format: Valid IPv4 address
- Example: \`10.0.1.100\` or \`192.168.1.50\`
- Must be reachable from the host where the script is running

**Option 3: FSx File System ID**
- Format: \`fs-xxxxxxxxxxxxxxxxx\` (where x is alphanumeric)
- Example: \`fs-0123456789abcdef0\`
- The script automatically constructs the management endpoint
- Falls back to management IP if domain cannot be resolved

### -SqlInstanceName (Required)
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
- ONTAP credentials: Use the StorageManagementAddress (FQDN, Management IP, or FSx ID) as the secret name

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
- Verify the StorageManagementAddress is correct (FQDN, Management IP, or FSx ID)
- Check network connectivity to the management endpoint
- If using FQDN, verify DNS resolution is working (try \`nslookup <fqdn>\`)
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

const ORACLE_ONE_TIME_ASSESSMENT_README = `
# Oracle One-Time Assessment Script

**Copyright (c) 2026 NetApp, Inc. All rights reserved.**

## Overview

This Python script performs a comprehensive assessment of your Oracle database environment and its storage configuration on NetApp ONTAP storage systems (Amazon FSx for NetApp ONTAP). The script collects Oracle instance configuration, mapped ONTAP volumes and LUN details, storage configuration best practices analysis, FRA/RMAN status, Direct NFS (dNFS) configuration, OS/NFS settings, Pluggable Database (PDB) details, Automatic Storage Management (ASM) configuration, Data Guard deployment information, and protocol-specific assessments for both NFS and iSCSI storage.

## Prerequisites

### Required
- **Python 2.7+ or Python 3.x** - The script requires Python 2.7 minimum (Python 3.x recommended)
- **Oracle Database** - Oracle database instance must be running and accessible
- **sqlplus utility** - Must be installed and accessible in the system PATH
- **Linux/Unix Server** - Script must run on a Linux/Unix server with Oracle database installed
- **Network connectivity** - Access to the FSx for ONTAP management endpoint
- **Oracle database access** - SYSDBA or appropriate database credentials for the Oracle instance
- **ONTAP storage credentials** - Credentials for accessing the FSx for ONTAP storage system

### Oracle Database Instance Access
- The script requires access to the Oracle database instance you want to assess
- For SYSDBA access: The user running the script must have SYSDBA privileges or be able to connect as SYSDBA
- For normal database access: You will be prompted for Oracle username and password if not available in credential stores
- The script will attempt to connect using the ORACLE_SID environment variable or the provided Oracle SID

### ONTAP Storage Access
- The script requires ONTAP storage system credentials
- Credentials can be provided via:
  - AWS Secrets Manager (recommended for EC2 instances)
  - Interactive prompt (fallback)

## Usage Examples

### Example 1: Using Management FQDN
\`\`\`bash
python NetApp_WF_Oracle_Assessment.py --StorageManagementAddress management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com --OracleSid ORCL
\`\`\`

This example:
- Uses the ONTAP management FQDN (Fully Qualified Domain Name) directly
- Assesses the Oracle instance with SID "ORCL"
- Saves output to the current working directory

### Example 2: Using Management IP Address
\`\`\`bash
python NetApp_WF_Oracle_Assessment.py --StorageManagementAddress 10.0.1.100 --OracleSid PROD
\`\`\`

This example:
- Uses the ONTAP management IP address directly
- Assesses an Oracle instance with SID "PROD"
- Saves output to the current working directory

### Example 3: Using FSx File System ID
\`\`\`bash
python NetApp_WF_Oracle_Assessment.py --StorageManagementAddress fs-0123456789abcdef0 --OracleSid ORCL
\`\`\`

This example:
- Uses the FSx file system ID to identify the storage system
- Assesses the Oracle instance with SID "ORCL"
- Saves output to the current working directory

### Example 4: Custom Output Directory
\`\`\`bash
python NetApp_WF_Oracle_Assessment.py --StorageManagementAddress fs-0123456789abcdef0 --OracleSid ORCL --OutputPath /tmp/assessment
\`\`\`

This example:
- Runs the assessment with a custom output directory
- Creates the directory if it doesn't exist
- Saves JSON output files to the specified path

### Example 5: Named Instance with Custom Path
\`\`\`bash
python NetApp_WF_Oracle_Assessment.py --StorageManagementAddress 192.168.1.50 --OracleSid PROD --OutputPath /home/oracle/reports
\`\`\`

## Parameters

### --StorageManagementAddress (Required)
The storage system identifier. Can be provided in one of three formats:

**Option 1: FSx Management FQDN (Fully Qualified Domain Name)**
- Format: Valid domain name
- Example: \`management.fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com\`
- Must be DNS-resolvable from the host where the script is running
- You can find the management FQDN in the AWS Console under FSx file system details (ONTAP Configuration > Management Endpoint), or by using the AWS CLI: \`aws fsx describe-file-systems --file-system-id <fsx-id> --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.DNSName'\`

**Option 2: FSx Management IP Address**
- Format: Valid IPv4 address
- Example: \`10.0.1.100\` or \`192.168.1.50\`
- Must be reachable from the host where the script is running
- You can find the management IP in the AWS Console under FSx file system details (ONTAP Configuration > Management Endpoint), or by using the AWS CLI: \`aws fsx describe-file-systems --file-system-id <fsx-id> --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]'\`

**Option 3: FSx File System ID**
- Format: \`fs-xxxxxxxxxxxxxxxxx\` (where x is alphanumeric)
- Example: \`fs-0123456789abcdef0\`
- The script automatically constructs the management endpoint
- Falls back to management IP if domain cannot be resolved

### --OracleSid (Required)
The Oracle System Identifier (SID) to assess:
- Use the exact SID as configured in your Oracle environment
- Examples: \`ORCL\`, \`PROD\`, \`DEV\`, \`TEST\`
- The SID is case-sensitive and must match the value in your \`/etc/oratab\` file

### --OutputPath (Optional)
The directory path where JSON output files should be created:
- If not specified, files are saved in the current working directory
- If the path doesn't exist, it will be created automatically
- If the path cannot be used (e.g., permission denied), files will be created in the current working directory instead

## Good to Have: Instance Profile Permissions

If running on an EC2 instance, the following IAM instance profile permissions are recommended for optimal functionality:

### AWS Secrets Manager Access (Recommended when using AWS Secrets Manager)
Allows the script to automatically retrieve Oracle and ONTAP credentials from AWS Secrets Manager:

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
- Oracle credentials: \`<Hostname>/<OracleSid>\`
- ONTAP credentials: Use the StorageManagementAddress (FQDN, Management IP, or FSx ID) as the secret name

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
\`Oracle_Assessment_v1_<OracleSid>_<Timestamp>.json\`

The output includes:
- **Metadata**: EC2 instance details, region, hostname, assessment timestamp, Oracle SID, Oracle Home, deployment type (Standalone/Clustered)
- **Instance Level Details**: Oracle database configuration, version, CDB status, mapped ONTAP volumes, storage configuration, pluggable database details, Data Guard information
- **Host Level Details**: Operating system configuration, protocol-specific assessment data (NFS or iSCSI), kernel parameters, storage headroom information
- **Assessment Results**: FRA/RMAN status, dNFS servers (for NFS), Oracle parameters, ADR information, ASM configuration (for iSCSI), LUN configuration

## Collected Assessment Details

### Pluggable Database (PDB) Information

For Container Databases (CDB), the script collects:
- PDB name, PDB ID, and status from DBA_PDBS view
- Storage mount points per PDB for data files, temp files, redo logs, archive logs, control files, and FRA
- ONTAP volume mappings per PDB

**Note**: PDB$SEED is automatically excluded from the assessment.

### Automatic Storage Management (ASM) Information

The script automatically detects ASM-managed storage and collects:
- ASM detection (file paths starting with '+')
- ASM disk groups: names, redundancy type, state, disk paths, and LUN mappings
- ASM OS configuration (for iSCSI): external redundancy assessment, AFD/ASMLib logical block size parameters
- ASM-to-ONTAP mapping: diskgroups mapped to ONTAP volumes and LUNs

**Storage Protocol**: Automatically determined as NFS (non-ASM) or iSCSI (ASM-managed) based on file path patterns.

### Data Guard Information

The script detects and collects:
- Data Guard deployment status (checks database role, FAL parameters, log archive config, V$DATAGUARD_CONFIG)
- Database unique name, database name, current role, and primary/standby identification

**Note**: Run on the primary node when possible for accurate assessment.

### NFS Assessment

For NFS storage protocol, the script collects:

**OS-Level**: Kernel parameters (SunRPC TCP slots), NFS mount options, NFS exports, idmapd domain config, hostname domain

**Oracle dNFS**: dNFS servers from V$DNFS_SERVERS, oranfstab configuration, DNS resolution for dNFS servers

**ADR**: ADR home location, mount point, and NFS mount options (if applicable)

**ONTAP**: NFSv4 domain data and rootonly export policy settings

### iSCSI Assessment

For iSCSI storage protocol (typically with ASM), the script collects:

**OS-Level**: Multipath I/O status and configuration, NetApp SANLUN utility, iSCSI targets/sessions, transparent hugepages, SELinux, iSCSI replacement timeout, TCP advanced options (SACK, timestamps, window scaling), multipath configuration

**Oracle Parameters**: filesystemio_options, db_file_multiblock_read_count, and init file parameters (SPFILE/PFILE)

**ASM OS Config**: ASM setup verification, external redundancy assessment, AFD/ASMLib logical block size parameters

**ONTAP LUNs**: LUN UUIDs, names, serial numbers, volume mappings, OS type, space reservation settings, LUN-to-ASM disk mapping

## Credential Resolution Order

The script attempts to retrieve credentials in the following order:

1. **AWS Secrets Manager** (if running on EC2 with instance profile)
2. **Interactive Prompt** (fallback)

## Troubleshooting

### Common Issues

**Issue: Cannot connect to Oracle database**
- Verify the Oracle SID is correct (check \`/etc/oratab\`)
- Ensure Oracle database instance is running (\`ps aux | grep pmon\`)
- Check Oracle listener is running (\`lsnrctl status\`)
- Verify Oracle environment variables are set correctly (ORACLE_HOME, ORACLE_SID)
- Ensure sqlplus is accessible in PATH
- Check Oracle authentication (SYSDBA vs normal user)

**Issue: Cannot connect to ONTAP storage**
- Verify the StorageManagementAddress is correct (FQDN, Management IP, or FSx ID)
- Check network connectivity to the management endpoint
- If using FQDN, verify DNS resolution is working (try \`nslookup <fqdn>\` or \`host <fqdn>\`)
- Ensure ONTAP credentials are correct
- Verify security group rules allow access to the management endpoint
- Check if HTTPS/HTTP access is enabled on the management endpoint

**Issue: Script fails with permission errors**
- Run the script as the Oracle user or with appropriate permissions
- Verify the output directory has write permissions
- Check Oracle database permissions for the user account
- Ensure the Oracle user has read access to Oracle configuration files

**Issue: AWS Secrets Manager access denied**
- Verify the EC2 instance has an IAM instance profile attached
- Check the instance profile has Secrets Manager permissions
- Ensure the secret names match the expected format

**Issue: Python version compatibility**
- The script supports both Python 2.7+ and Python 3.x
- Python 3.x is recommended for better compatibility
- Check Python version: \`python --version\` or \`python3 --version\`
- Ensure required Python modules are available (json, subprocess, etc.)

**Issue: Missing Oracle binaries or sqlplus**
- Verify Oracle client or database is installed
- Check that sqlplus is in the system PATH
- Ensure ORACLE_HOME environment variable is set correctly
- Try running sqlplus manually to verify connectivity

## Support

For additional support and documentation, please refer to the NetApp Workload Factory documentation or contact your NetApp representative.

## Version

Script Version: 1.0.0

---

**Copyright (c) 2026 NetApp, Inc. All rights reserved.**
`;

export { MSSQL_ONE_TIME_ASSESSMENT_README, ORACLE_ONE_TIME_ASSESSMENT_README };
