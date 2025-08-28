import { DatabaseTypes } from './consts';
import getLogger from './logger';

const logger = getLogger();
function getConfigParameters(databaseType: DatabaseTypes.MS_SQL_SERVER | DatabaseTypes.PG_SQL) {
    logger.info('Getting configuration parameters for database type', databaseType);
    const dbEngineType = databaseType === DatabaseTypes.MS_SQL_SERVER ? 'SQL' : databaseType;

    const PARAMETERS = [
        {
            name: 'DeploymentMode',
            description: 'Deployment mode for the FSx for ONTAP file system',
            type: 'String',
            default: 'MULTI_AZ_1',
            allowedValues: ['SINGLE_AZ_1', 'MULTI_AZ_1', 'SINGLE_AZ_2', 'MULTI_AZ_2']
        },
        {
            name: 'SqlVersion',
            description: `Version for the ${dbEngineType}`,
            type: 'String',
            default: 'postgresql16',
            allowedValues: ['postgresql15', 'postgresql16']
        },
        {
            name: 'SQLDeploymentMode',
            description: `${dbEngineType} Server deployment mode`,
            type: 'String',
            default: 'fci',
            allowedValues: ['fci', 'standalone', 'ha']
        },
        {
            name: 'CfDeployRoleName',
            description: 'CloudFormation deployment role name',
            type: 'String'
        },
        {
            name: 'UniqueID',
            description: 'Automation execution unique ID',
            type: 'String'
        },
        {
            name: 'ADScenarioType',
            description:
                'Select the type of Active Directory Domain Services deployment to use: AWS Directory Service for Microsoft AD or management of your own Amazon EC2 AD instances.',
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
                'User name for the account that will be added as Domain Administrator. This is separate from the  "default Windows Administrator" account. Note: This user will always default to "Admin" when using AWS Directory Service regardless of the value provided.',
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
            description: 'Fully qualified domain name (FQDN) of the forest root domain. For example, example.com',
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
            name: 'MSSQLMediaBucketName',
            description: 'S3 bucket name for SQL Server resources.',
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
            description: `${dbEngineType} node AMI image ID.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'SQLServiceAccountName',
            description: `User name for the ${dbEngineType} Server Service Account. This Account is a Domain User.`,
            type: 'String',
            minLength: 5,
            maxLength: 20,
            pattern: '([a-zA-Z0-9]+(\\.|_|-|@)*)+'
        },
        {
            name: 'SQLServiceAccountPassword',
            description: `Password for the ${dbEngineType} Server Service Account ${
                dbEngineType === DatabaseTypes.PG_SQL ? '(postgres)' : ''
            }.`,
            type: 'String',
            minLength: 8,
            noEcho: true
        },
        {
            name: 'SQLigroupname',
            description: `${dbEngineType} igroupname.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'SqlServerName',
            description: `${dbEngineType} Server Name.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'SqlFSxWSFCName',
            description: 'Windows Server Failover Cluster name.',
            type: 'String',
            minLength: 4,
            maxLength: 15,
            default: 'WSFCluster1',
            pattern: '[a-zA-Z0-9\\-]+'
        },
        {
            name: 'SqlCollation',
            description: `${dbEngineType} Server Collation.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'VPCCIDR',
            description: 'CIDR Block for the VPC.',
            constraintDescription: 'CIDR block parameter must be in the form x.x.x.x/16-28',
            type: 'String',
            default: '10.0.0.0/16',
            pattern:
                '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\\/(1[6-9]|2[0-8]))$'
        },
        {
            name: 'PrivateSubnet1ID',
            description: `ID of the private subnet 1 in Availability Zone 1 for the ${dbEngineType} Server (for example, subnet-a0246dcd).`,
            type: 'AWS::EC2::Subnet::Id',
            minLength: 1
        },
        {
            name: 'PrivateSubnet2ID',
            description: `ID of the private subnet 2 in Availability Zone 2 for the ${dbEngineType} Server (for example, subnet-a0246dcd). This field is required for ${dbEngineType} Server failover instances, but not required for standalone instances.`,
            type: 'String'
        },
        {
            name: 'RouteTable1Id',
            description: `Comma separated list of all route table ids for ${dbEngineType} subnets.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'RouteTable2Id',
            description: `Comma seperated list of all route table ids for ${dbEngineType} subnets.`,
            type: 'String'
        },
        {
            name: 'PrivateSubnet1Cidrblock',
            description: 'CIDR Block for private subnet 1',
            constraintDescription: 'CIDR block parameter must be in the form x.x.x.x/16-28',
            type: 'String',
            default: '10.0.0.0/16',
            pattern:
                '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\\/(1[6-9]|2[0-8]))$'
        },
        {
            name: 'PrivateSubnet2Cidrblock',
            description: 'CIDR Block for private subnet 2',
            constraintDescription: 'CIDR block parameter must be in the form x.x.x.x/16-28',
            type: 'String'
        },
        {
            name: 'SQLSvmName',
            description: `${dbEngineType} Storage Machine Virtual Name.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'WorkloadInstanceType',
            description: 'Amazon EC2 instance type for the WSFC Nodes.',
            type: 'String',
            minLength: 1
        },
        {
            name: 'NodeNetBIOSNames',
            description: 'NetBIOS name of Nodes (each one up to 15 characters).',
            type: 'String',
            minLength: 1
        },
        {
            name: 'FSxStorageCapacity',
            description: 'Storage capacity of the file system. The minimum is 1024 GiB. The maximum is 192 TiB.',
            type: 'Number',
            minValue: 1024,
            maxValue: 196608
        },
        {
            name: 'FSxDataVolumeSize',
            description: 'The size of the data volume in megabytes (MiB).',
            type: 'Number'
        },
        {
            name: 'FSxDataVolumeName',
            description: `The name of the volume for ${dbEngineType} Server data.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'FSxLogVolumeName',
            description: `${dbEngineType} log volume name.`,
            type: 'String',
            minLength: 1
        },
        {
            name: 'FSxLogVolumeSize',
            description: 'The size of the log volume in megabytes (MiB).',
            type: 'Number'
        },
        {
            name: 'FSxTempDbVolumeName',
            description: 'The name of the volume for the tempdb system database.',
            type: 'String',
            minLength: 1
        },
        {
            name: 'FSxTempDbVolumeSize',
            description: 'The size of the tempdb volume in megabytes (MiB).',
            type: 'Number'
        },
        {
            name: 'FSxQuorumVolumeName',
            description: 'The name of the volume for cluster quorum.',
            type: 'String',
            default: 'wlmdb_quorum'
        },
        {
            name: 'FSxQuorumVolumeSize',
            description: 'The size of the cluster quorum volume in megabytes (MiB).',
            type: 'Number',
            default: 100
        },
        {
            name: 'FSxDataLunSize',
            description: `The size of the ${dbEngineType} Server data LUN in megabytes (MiB).`,
            type: 'Number'
        },
        {
            name: 'FSxAdminUsername',
            description: 'The user name for the FSx for ONTAP file system.',
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
            description: 'The name for the FSx for ONTAP storage virtual machine (SVM).',
            type: 'String',
            minLength: 1,
            maxLength: 47
        },
        {
            name: 'FSxFileSystemName',
            description: 'The name for the FSx for ONTAP file system.',
            type: 'String'
        },
        {
            name: 'FSxFileSystemId',
            description: 'The ID of the FSx for ONTAP file system.',
            type: 'String'
        },
        {
            name: 'FSxDiskIops',
            description: 'The total number of SSD IOPS provisioned for the file system. The maximum is 1,60,000 IOPS.',
            type: 'Number',
            default: 3,
            minValue: 3,
            maxValue: 160000
        },
        {
            name: 'FSxVolumeThroughputCapacity',
            description: 'Throughput capacity for the FSx for ONTAP volume.',
            type: 'Number',
            default: 128,
            allowedValues: [
                128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 4608, 6144, 7680, 9216, 10752, 12288, 13824,
                15360, 16896, 18432, 21504, 24576, 27648, 30720, 33792, 36864, 43008, 49152, 55296, 61440, 67584, 73728
            ]
        },
        {
            name: 'FileSystemEncryptionKeyId',
            description: 'ID of the AWS Key Management Service key.',
            type: 'String'
        },
        {
            name: 'FsxVolumeSnapshotPolicy',
            description: 'Snapshot policy for the volume. Can be either daily_weekretention or none.',
            type: 'String',
            default: 'daily_weekretention',
            allowedValues: ['daily_weekretention', 'none']
        },
        {
            name: 'VPCID',
            description: 'Existing VPC ID for deployment.',
            type: 'AWS::EC2::VPC::Id',
            minLength: 1
        },
        {
            name: 'ONTAPSecurityGroupID',
            description: 'ONTAP Security Group ID.',
            type: 'String'
        },
        {
            name: 'EnableCloudWatchLogFeature',
            description: 'Enable CloudWatch Log Feature.',
            type: 'String',
            default: true,
            allowedValues: [true, false]
        },
        {
            name: 'NotificationARN',
            description: ' (optional) Amazon SNS topic ARNs to publish stack related events.',
            type: 'String'
        },
        {
            name: 'ValidationAmi',
            description: 'Validation node AMI image ID.',
            type: 'String',
            minLength: 1
        },
        {
            name: 'ValidationNodeInstanceType',
            description: 'Validation node instance type.',
            type: 'String',
            minLength: 1
        },
        {
            name: 'RoleCredentialsId',
            description: 'WLM account credentials ID to deploy and manage resources (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'AccountId',
            description: 'WLM tenancy account ID (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'CloudProviderAccountId',
            description: 'AWS CloudProviderAccountId ID (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'JwtToken',
            description: 'JWT Token to grant access to a resource (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'EncryptedFsxPassword',
            description:
                'Encrypted value of FSx for ONTAP password entered in the database deployment wizard (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'WlmdbAwsAccountId',
            description: 'WLMDB AWS Account ID (DO NOT EDIT).',
            type: 'String',
            noEcho: true
        },
        {
            name: 'Metrics',
            description: 'Metrics used for internal audit( DO NOT EDIT).',
            type: 'CommaDelimitedList',
            noEcho: true
        },
        {
            name: 'S3EndpointExists',
            description: 'Boolean to convey if an S3 endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'CloudformationEndpointExists',
            description: 'Boolean to convey if a Cloudformation endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'SsmEndpointExists',
            description: 'Boolean to convey if a SSM endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'SqsEndpointExists',
            description: 'Boolean to convey if a SQS endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'CloudwatchLogsEndpointExists',
            description: 'Boolean to convey if a Cloudwatch Logs endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'FsxEndpointExists',
            description: 'Boolean to convey if a FSxN endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'Ec2EndpointExists',
            description: 'Boolean to convey if a EC2 endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'Ec2MessagesEndpointExists',
            description: 'Boolean to convey if EC2 messages endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'SSMMessagesEndpointExists',
            description: 'Boolean to convey if SSM messages endpoint exists in the vpc.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'S3EndpointRouteTables',
            description: 'Route table ids to attach to S3 gateway endpoint.',
            type: 'String'
        },
        {
            name: 'IsCustomAmi',
            description: 'Boolean to indicate if AMI includes SQL license or BYOL license.',
            type: 'String',
            default: 'false'
        },
        {
            name: 'EBSVolumeSize',
            description: 'Size of the EBS Volume in GiB.',
            type: 'Number',
            minValue: 100
        },
        {
            name: 'PreferredDomainController',
            description: '(optional) Preferred domain controller to use to join AD Domain',
            type: 'String',
            default: 'default'
        },
        {
            name: 'OUPath',
            description: '(optional) Preferred organizational unit in the AD to join.',
            type: 'String',
            default: 'default'
        }
    ];

    return PARAMETERS;
}

export default getConfigParameters;
