const PARAMETERS = [
    {
        name: 'DeploymentMode',
        description: 'File system deployment mode',
        type: 'String',
        default: 'MULTI_AZ_1',
        allowedValues: ['SINGLE_AZ_1', 'MULTI_AZ_1']
    },
    {
        name: 'SQLDeploymentMode',
        description: 'SQL server deployment mode',
        type: 'String',
        default: 'fci',
        allowedValues: ['fci', 'standalone']
    },
    {
        name: 'CfDeployRoleName',
        description: 'Cloud formation deployment role name',
        type: 'String'
    },
    {
        name: 'UniqueID',
        description: 'Automation Execution Unique ID',
        type: 'String'
    },
    {
        name: 'ADScenarioType',
        description:
            'Select the type of AD DS deployment to use: AWS Directory Service for Microsoft AD or managing your own Amazon EC2 AD instances.',
        type: 'String',
        allowedValues: ['AWS_MANAGED_AD', 'USER_MANAGED_AD']
    },
    {
        name: 'DNSIpAddresses',
        description: 'Fixed private IPs for the Active Directory servers',
        type: 'String',
        minLength: 1
    },
    {
        name: 'DomainAdminUser',
        description:
            'User name for the account that will be added as Domain Administrator. This is separate from the default "Administrator" account. Note: This user will always default to "Admin" when using AWS Directory Service regardless of the value provided.',
        type: 'String',
        minLength: 5,
        maxLength: 20,
        pattern: '([a-zA-Z0-9]+(\\.|_|-|@)*)+'
    },
    {
        name: 'DomainAdminPassword',
        description: 'Password for Domain Administrator',
        type: 'String',
        minLength: 8,
        noEcho: true
    },
    {
        name: 'DomainDNSName',
        description: 'Fully qualified domain name (FQDN) of the forest root domain e.g. example.com',
        type: 'String',
        minLength: 2,
        maxLength: 255,
        pattern: '[a-zA-Z0-9\\-]+\\..+'
    },
    {
        name: 'DomainMemberSGID',
        description: 'Security group ID of the members group for existing AD',
        type: 'String'
    },
    {
        name: 'KeyPairName',
        description: 'Public/private key pairs allow you to securely connect to your instance after it launches',
        type: 'AWS::EC2::KeyPair::KeyName'
    },
    {
        name: 'AssetsBucketName',
        description: 'S3 bucket name for WLMDB assets',
        type: 'String',
        default: 'staging.wlmdb.workloads.netapp.com'
    },
    {
        name: 'AssetsS3RegionCode',
        description: 'S3 region code',
        type: 'String',
        default: 's3.us-east-1'
    },
    {
        name: 'AssetsS3KeyPrefix',
        description: 'S3 key prefix for WLMDB assets.',
        type: 'String',
        default: 'templates'
    },
    {
        name: 'MSSQLMediaBucketName',
        description: 'S3 bucket name for MSSQL assets.',
        type: 'String',
        default: 'LaunchWizard-sqlha'
    },
    {
        name: 'MSSQLMediaPathKey',
        description: 'S3 key prefix for the media for SQL Server for FCI.',
        type: 'String',
        default: 'launchwizardscripts/sqlmedia/sqlserver.iso'
    },
    {
        name: 'SQLAMIID',
        description: 'SQL node AMI image id',
        type: 'String',
        minLength: 1
    },
    {
        name: 'SQLServiceAccountName',
        description: 'User name for the SQL Server Service Account. This Account is a Domain User.',
        type: 'String',
        minLength: 5,
        maxLength: 20,
        pattern: '([a-zA-Z0-9]+(\\.|_|-|@)*)+'
    },
    {
        name: 'SQLServiceAccountPassword',
        description: 'Password for the SQL Server Service Account.',
        type: 'String',
        minLength: 8,
        noEcho: true
    },
    {
        name: 'SQLigroupname',
        description: 'SQL igroupname',
        type: 'String',
        minLength: 1
    },
    {
        name: 'SqlServerName',
        description: 'SQL Server Name',
        type: 'String',
        minLength: 1
    },
    {
        name: 'SqlFSxWSFCName',
        description: 'Windows Server Failover Cluster name',
        type: 'String',
        minLength: 4,
        maxLength: 15,
        default: 'WSFCluster1',
        pattern: '[a-zA-Z0-9\\-]+'
    },
    {
        name: 'VPCCIDR',
        description: 'CIDR Block for the VPC',
        constraintDescription: 'CIDR block parameter must be in the form x.x.x.x/16-28',
        type: 'String',
        default: '10.0.0.0/16',
        pattern:
            '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\\/(1[6-9]|2[0-8]))$'
    },
    {
        name: 'PrivateSubnet1ID',
        description: 'ID of private subnet 1 in Availability Zone 1 for the Workload (e.g., subnet-a0246dcd)',
        type: 'AWS::EC2::Subnet::Id',
        minLength: 1
    },
    {
        name: 'PrivateSubnet2ID',
        description: 'ID of private subnet 2 in Availability Zone 2 for the Workload (e.g., subnet-a0246dcd)',
        type: 'String'
    },
    {
        name: 'RouteTable1Id',
        description: 'Comma separated list of all route table ids for SQL subnets.',
        type: 'String',
        minLength: 1
    },
    {
        name: 'RouteTable2Id',
        description: 'Comma seperated list of all route table ids for SQL subnets.',
        type: 'String'
    },
    {
        name: 'SQLSvmName',
        description: 'SQL Storage Machine Virtual Name',
        type: 'String',
        minLength: 1
    },
    {
        name: 'WorkloadInstanceType',
        description: 'Amazon EC2 instance type for the WSFC Nodes',
        type: 'String',
        minLength: 1
    },
    {
        name: 'NodeNetBIOSNames',
        description: 'NetBIOS name of Nodes (each one up to 15 characters)',
        type: 'String',
        minLength: 1
    },
    {
        name: 'FSxStorageCapacity',
        description: 'Storage capacity of the file system. Minimum 1024 GiB, maximum 192 TiB.',
        type: 'Number',
        minValue: 1024,
        maxValue: 196608
    },
    {
        name: 'FSxDataVolumeSize',
        description: 'Size of the data volume, in megabytes (MiB).',
        type: 'Number'
    },
    {
        name: 'FSxDataVolumeName',
        description: 'FSx data volume name',
        type: 'String',
        minLength: 1
    },
    {
        name: 'FSxLogVolumeName',
        description: 'FSx log volume name',
        type: 'String',
        minLength: 1
    },
    {
        name: 'FSxLogVolumeSize',
        description: 'Size of the log volume, in megabytes (MiB).',
        type: 'Number'
    },
    {
        name: 'FSxTempDbVolumeName',
        description: 'FSx TempDB volume name',
        type: 'String',
        minLength: 1
    },
    {
        name: 'FSxTempDbVolumeSize',
        description: 'Size of the TempDB volume, in megabytes (MiB).',
        type: 'Number'
    },
    {
        name: 'FSxQuorumVolumeName',
        description: 'FSx cluster quorum volume name',
        type: 'String',
        default: 'wlmdb-quorum'
    },
    {
        name: 'FSxQuorumVolumeSize',
        description: 'Size of the cluster quorum volume, in megabytes (MiB).',
        type: 'Number',
        default: 100
    },
    {
        name: 'FSxDataLunSize',
        description: 'Size of the SQL data lun, in megabytes (MiB)',
        type: 'Number'
    },
    {
        name: 'FSxAdminUsername',
        description: 'FSxN username',
        type: 'String',
        minLength: 1
    },
    {
        name: 'FSxAdminPassword',
        description: 'Password for FSxAdminUsername.',
        type: 'String',
        minLength: 1,
        noEcho: true
    },
    {
        name: 'FSxSvmName',
        description: 'FSx SVM Name',
        type: 'String',
        minLength: 1,
        maxLength: 47
    },
    {
        name: 'FSxFileSystemName',
        description: 'Fsx Filesystem name ',
        type: 'String'
    },
    {
        name: 'FSxFileSystemId',
        description: 'Fsx Filesystem ID ',
        type: 'String'
    },
    {
        name: 'FSxDiskIops',
        description: 'The total number of SSD IOPS provisioned for the file system.  Maximum 80,000 IOPS.',
        type: 'Number',
        default: 3,
        minValue: 3,
        maxValue: 80000
    },
    {
        name: 'FSxVolumeThroughputCapacity',
        description: 'Throughput capacity of FSx volume',
        type: 'Number',
        default: 128,
        allowedValues: [128, 256, 512, 1024, 2048]
    },
    {
        name: 'FileSystemEncryptionKeyId',
        description: 'ID of the AWS Key Management Service key.',
        type: 'String'
    },
    {
        name: 'VPCID',
        description: 'Existing VPC ID for deployment',
        type: 'AWS::EC2::VPC::Id',
        minLength: 1
    },
    {
        name: 'ONTAPSecurityGroupID',
        description: 'ONTAP Security Group ID',
        type: 'String'
    },
    {
        name: 'EnableCloudWatchLogFeature',
        description: 'Enable CloudWatch Log Feature',
        type: 'String',
        default: false,
        allowedValues: [true, false]
    },
    {
        name: 'NotificationARN',
        description: ' (optional) Amazon SNS topic ARNs to publish stack related events',
        type: 'String'
    },
    {
        name: 'ValidationAmi',
        description: 'Validation node AMI image id',
        type: 'String',
        minLength: 1
    },
    {
        name: 'RoleCredentialsId',
        description: 'WLM account credentials id to deploy and manage resources (DO NOT EDIT)',
        type: 'String',
        noEcho: true
    },
    {
        name: 'AccountId',
        description: 'WLM tenancy account id (DO NOT EDIT)',
        type: 'String',
        noEcho: true
    },
    {
        name: 'CloudProviderAccountId',
        description: 'AWS CloudProviderAccountId id (DO NOT EDIT)',
        type: 'String',
        noEcho: true
    },
    {
        name: 'JwtToken',
        description: 'JWT Token to grant access to a resource (DO NOT EDIT)',
        type: 'String',
        noEcho: true
    },
    {
        name: 'WlmdbAwsAccountId',
        description: 'WLMDB AWS Account ID (DO NOT EDIT)',
        type: 'String',
        noEcho: true
    }
];

export default PARAMETERS;
