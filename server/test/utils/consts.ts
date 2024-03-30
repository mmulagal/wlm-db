/* eslint-disable quotes */
import { faker } from '@faker-js/faker';

const DEFAULT_AWS_VPC_ID = 'vpc-84b3afe6';
const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';
const DEFAULT_AWS_CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const DEFAULT_AWS_REGION = 'us-east-1';

const NETWORKING_CONFIGURATION = {
    vpcId: 'vpc-84b3afe6',
    vpcCidr: '172.31.0.0/16',
    privateSubnet1Id: 'subnet-f4484e80',
    routeTable1Id: 'rtb-65aeb107',
    availabilityZone1: 'string',
    privateSubnet2Id: 'subnet-4cdd3b29',
    routeTable2Id: 'rtb-65aeb108',
    availabilityZone2: 'string'
};
const EC2_CONFIGURATION = {
    workloadInstanceType: 'm4.xlarge',
    keyPairName: 'krithi_new_key'
};

const AD_CONFIGURATION = {
    adScenarioType: 'AWS_MANAGED_AD',
    domainUsername: 'Admin',
    domainPassword: 'Collector@123',
    domainDnsname: 'dbsdev.com',
    dnsIpaddress: '172.31.7.45,172.31.43.182',
    securityGroupId: 'sg-0d6f82bcd4a2e05d6'
};

const FSX_CONFIGURATION = {
    fsxDeploymentMode: 'MULTI_AZ_1',
    fsxFileSystemId: 'fs-05a228ef446b34d27',
    fsxUsername: 'fsxadmin',
    fsxPassword: 'netapp1!',
    databaseSize: 1024,
    fsxVolThroughput: 128,
    fsxIOPS: 3072,
    encryptionKey: '',
    ontapSgGroupId: ['sg-3924c15c']
};

const SQL_CONFIGURATION = {
    sqlDeploymentMode: 'fci',
    sqlAmiId: 'ami-0e0f179ddde359def',
    serviceAccountName: 'sqladmin',
    serviceAccountPassword: 'netapp1!',
    sqlServerName: 'SampleFci',
    sqlAmiName: 'Windows_Server-2016-English-Full-SQL_2019_Standard-2024.01.16'
};

const SSM_PARAMS = {
    DocumentName: 'AWS-RunPowerShellScript',
    Documentversion: '1',
    Parameters: {
        commands: [
            ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT\n' +
                '                                (processmem.physical_memory_in_use_kb * 1024) AS used,\n' +
                '                                (sysmem.total_physical_memory_kb * 1024) AS total,\n' +
                '                                ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n' +
                '                                 ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n' +
                '                                 FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem;"'
        ]
    },
    InstanceIds: ['i-07e76a4b916548dc0']
};

const DEPLOYMENT_JOBS_COUNT_RESPONSE = [
    {
        _count: {
            deployment_status: 31
        },
        deployment_status: 'UPDATE_COMPLETE'
    },
    {
        _count: {
            deployment_status: 39
        },
        deployment_status: 'CREATE_IN_PROGRESS'
    },
    {
        _count: {
            deployment_status: 28
        },
        deployment_status: 'CREATE_COMPLETE'
    },
    {
        _count: {
            deployment_status: 27
        },
        deployment_status: 'UPDATE_IN_PROGRESS'
    },
    {
        _count: {
            deployment_status: 21
        },
        deployment_status: 'CREATE_FAILED'
    }
];

const ACCOUNT_ID = 'account-test';
const CREDENTIALS_ID = `${faker.string.alphanumeric(20)}`;
const ACTIVE_INSTANCE_ID = `${faker.string.alphanumeric(10)}`;
const STANDBY_INSTANCE_ID = `${faker.string.alphanumeric(10)}`;

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const MAP_ONTAP_VOLUMES_SCRIPT =
    '\n' +
    "    $WarningPreference = 'SilentlyContinue';\n" +
    '    #Requires -Module AWS.Tools.SimpleSystemsManagement\n' +
    '\n' +
    "    $FSxID = 'fs-03773e21b2f0e39b4'\n" +
    "    $FSxRegion = 'us-east-1'\n" +
    '\n' +
    '    if ($responeObject -eq $null) {\n' +
    '        $responeObject = @{}\n' +
    '    }\n' +
    '\n' +
    '    try {\n' +
    '        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json\n' +
    '        $FSxUserName = $SsmParameter.fsx.username\n' +
    '        $FSxPassword = $SsmParameter.fsx.password\n' +
    "        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))\n" +
    '        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"\n' +
    '\n' +
    "        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'\n" +
    '        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\\cfn\\FSxCertificate.pem\n' +
    '        $Certificate = Import-Certificate -FilePath C:\\cfn\\FSxCertificate.pem -CertStoreLocation Cert:\\LocalMachine\\Root\n' +
    '        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }\n' +
    '\n' +
    '        $sqlquery = @"\n' +
    '            SET NOCOUNT ON;\n' +
    '            SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf\n' +
    '            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs\n' +
    "            WHERE vs.volume_mount_point != 'C:\\'\n" +
    "            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) = 'MDF'\n" +
    "            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) != 'TEMPDB'\n" +
    '            FOR JSON PATH;\n' +
    '"@\n' +
    '\n' +
    '        $sqlresponse =  sqlcmd -Q $sqlquery -y 0;\n' +
    '\n' +
    '        if (!($sqlresponse.count -gt 0)) {\n' +
    `            write-error "Couldn't get database windows volumes"\n` +
    '            return\n' +
    '        }\n' +
    '\n' +
    '        Function Get-SerialNumberOfWinVolumes {\n' +
    '            param(\n' +
    '                [Parameter(Mandatory = $true)]\n' +
    '                [string[]]$sqlresponse\n' +
    '            )\n' +
    '\n' +
    '            $winvolumes = $sqlresponse | convertFrom-Json\n' +
    '\n' +
    "            $filterString = ''\n" +
    '            foreach ($winvolume in $winvolumes) {\n' +
    '                $volname = $winvolume.volumename\n' +
    "                if ($volname -ne '') {\n" +
    `                    $filterString += "VolumeName = '$volname' or "\n` +
    '                }\n' +
    '            }\n' +
    '\n' +
    "            $filterString = $filterString.TrimEnd(' or ')\n" +
    '\n' +
    '            $volumes = Get-CimInstance -Query "SELECT DeviceID, VolumeName FROM Win32_LogicalDisk where $filterString"\n' +
    '            $Lunserialnumbers = @()\n' +
    '            foreach ($volume in $volumes) {\n' +
    `                $partitions = Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($volume.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"\n` +
    '                foreach ($partition in $partitions) {\n' +
    `                    $diskdrives = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"\n` +
    '                    foreach ($diskdrive in $diskdrives) {\n' +
    '                        $Lunserialnumbers += $diskdrives.SerialNumber\n' +
    '                    }\n' +
    '                }\n' +
    '            }\n' +
    '\n' +
    '            $Lunserialnumbers\n' +
    '        }\n' +
    '\n' +
    '        Function Invoke-ONTAPGetRequest {\n' +
    '            param(\n' +
    '                [Parameter(Mandatory = $false)]\n' +
    '                [string]$ApiEndpoint,\n' +
    '\n' +
    '                [Parameter(Mandatory = $false)]\n' +
    '                [string]$ApiQueryFilter\n' +
    '            )\n' +
    '\n' +
    '            $Params = @{\n' +
    `                "URI"     = 'https://' + $FSxHostName + '/api' + $ApiEndpoint + '?' + $ApiQueryFilter\n` +
    '                "Method"  = "GET"\n' +
    '                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}\n' +
    '                "ContentType" = "application/json"\n' +
    '            }\n' +
    '\n' +
    '            return Invoke-RestMethod @Params -Certificate $regionCertificateificate\n' +
    '        }\n' +
    '\n' +
    '        Function Get-LunFromSerialNumber($SerialNumbers) {\n' +
    '            Write-Debug "Get ONTAP lun name from serial numbers for: $SerialNumbers"\n' +
    '\n' +
    "            $QueryFilter = ''\n" +
    '            foreach ($SerialNumber in $SerialNumbers) {\n' +
    "                if ($SerialNumber -ne '') {\n" +
    "                    $QueryFilter += $SerialNumber + '|'\n" +
    '                }\n' +
    '            }\n' +
    "            $QueryFilter = $QueryFilter.TrimEnd('|')\n" +
    '\n' +
    '            $Params = @{\n' +
    '                "ApiEndPoint" = "/storage/luns"\n' +
    '            }\n' +
    '\n' +
    "            if ($QueryFilter -ne '') {\n" +
    '                $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}\n' +
    '            }\n' +
    '\n' +
    '            $Response = Invoke-ONTAPGetRequest @Params\n' +
    '\n' +
    '            $LunRecords = $Response.records\n' +
    '\n' +
    '            [string[]]$LunNames = @()\n' +
    '            foreach ($record in $LunRecords) {\n' +
    '                $LunNames += $record.name\n' +
    '            }\n' +
    '\n' +
    '            Write-Debug "Lun names: $LunNames"\n' +
    '            return $LunNames\n' +
    '        }\n' +
    '\n' +
    '        Function Get-VolumeIdFromName($Names) {\n' +
    '            Write-Debug "Get Volume Id from name: $Names"\n' +
    '\n' +
    "            $QueryFilter = ''\n" +
    '            foreach ($Name in $Names) {\n' +
    "                if ($Name -ne '') {\n" +
    "                    $QueryFilter += $Name + '|'\n" +
    '                }\n' +
    '            }\n' +
    "            $QueryFilter = $QueryFilter.TrimEnd('|')\n" +
    '\n' +
    '            $Params = @{\n' +
    '                "ApiEndPoint" = "/storage/volumes"\n' +
    '            }\n' +
    '\n' +
    "            if ($QueryFilter -ne '') {\n" +
    '                $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}\n' +
    '            }\n' +
    '\n' +
    '            return Invoke-ONTAPGetRequest @Params\n' +
    '        }\n' +
    '\n' +
    '        $SerialNumbers = Get-SerialNumberOfWinVolumes $sqlresponse\n' +
    '\n' +
    '        if (!($SerialNumbers.count -gt 0)) {\n' +
    `            write-error "Couldn't get windows volume serial numbers"\n` +
    '            return\n' +
    '        }\n' +
    '\n' +
    '        $VolumeNames = Get-LunFromSerialNumber $SerialNumbers\n' +
    '\n' +
    '        if (!($VolumeNames.count -gt 0)) {\n' +
    `            write-error "Couldn't get associated Ontap LUN volume names"\n` +
    '            return\n' +
    '        }\n' +
    '\n' +
    '        $volumes = Get-VolumeIdFromName $VolumeNames\n' +
    '\n' +
    '        return ($volumes | ConvertTo-Json)\n' +
    '    } catch {\n' +
    '        Write-Error $_.Exception.Message\n' +
    '    }\n';

const GET_ONTAP_VOLUME_SNAPSHOT_COUNT_SCRIPT =
    '\n' +
    "    $WarningPreference = 'SilentlyContinue';\n" +
    '    #Requires -Module AWS.Tools.SimpleSystemsManagement\n' +
    '\n' +
    "    $FSxID = 'test-fsx2345'\n" +
    "    $FSxRegion = 'test-region'\n" +
    "    $APIEndpoint = '/storage/volumes'\n" +
    "    $APIQueryFilter = 'uuid=939a4ec9-7c14-11ee-b185-8329e8fcbf44'\n" +
    "    $ApiQueryFields = 'fields=snapshot_count'\n" +
    '\n' +
    '    if ($responeObject -eq $null) {\n' +
    '        $responeObject = @{}\n' +
    '    }\n' +
    '\n' +
    '    try {\n' +
    '        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json\n' +
    '        $FSxUserName = $SsmParameter.fsx.username\n' +
    '        $FSxPassword = $SsmParameter.fsx.password\n' +
    "        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))\n" +
    '        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"\n' +
    '        \n' +
    "        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'\n" +
    '        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\\cfn\\FSxCertificate.pem\n' +
    '        $Certificate = Import-Certificate -FilePath C:\\cfn\\FSxCertificate.pem -CertStoreLocation Cert:\\LocalMachine\\Root\n' +
    '        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }\n' +
    '\n' +
    '        Function Invoke-ONTAPGetRequest {\n' +
    '            param(\n' +
    '                [Parameter(Mandatory = $false)]\n' +
    '                [string]$ApiEndpoint,\n' +
    '\n' +
    '                [Parameter(Mandatory = $false)]\n' +
    '                [string]$ApiQueryFilter,\n' +
    '\n' +
    '                [Parameter(Mandatory = $false)]\n' +
    '                [string]$ApiQueryFields\n' +
    '            )\n' +
    '\n' +
    "            $Ampersand = ''\n" +
    "            if ($ApiQueryFields -ne '' -and $ApiQueryFilter -ne '') {\n" +
    "                $Ampersand = '&';\n" +
    '            }\n' +
    '            $Params = @{\n' +
    `                "URI"     = 'https://' + $FSxHostName + '/api' + $ApiEndpoint + '?' + $ApiQueryFilter + $Ampersand + $ApiQueryFields\n` +
    '                "Method"  = "GET"\n' +
    '                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}\n' +
    '                "ContentType" = "application/json"\n' +
    '            }\n' +
    '\n' +
    '            return Invoke-RestMethod @Params -Certificate $regionCertificateificate\n' +
    '        }\n' +
    '\n' +
    '        $response = Invoke-ONTAPGetRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields\n' +
    '        $response | ConvertTo-Json\n' +
    '    } catch {\n' +
    '        $responeObject = @{\n' +
    '            error = $_.Exception.Message\n' +
    '        }\n' +
    '    }\n';

export {
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION,
    DEFAULT_AWS_VPC_ID,
    DEFAULT_AWS_CREDENTIALS_TYPE,
    DEFAULT_AWS_CREDENTIALS_ID,
    DEFAULT_AWS_REGION,
    SSM_PARAMS,
    ACCOUNT_ID,
    CREDENTIALS_ID,
    ACTIVE_INSTANCE_ID,
    STANDBY_INSTANCE_ID,
    DEPLOYMENT_JOBS_COUNT_RESPONSE,
    THIRTY_DAYS,
    MAP_ONTAP_VOLUMES_SCRIPT,
    GET_ONTAP_VOLUME_SNAPSHOT_COUNT_SCRIPT
};
