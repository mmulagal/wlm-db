export const AUTH_STATUS = {
    AUTH_STATUS_SUCCESS: 'AUTH_SUCCESS',
    AUTH_STATUS_ERROR: 'AUTH_ERROR',
    AUTH_STATUS_PROGRESS: 'AUTH_PROGRESS'
};

//Environments names should be aligned with .env files
export const PRODUCTION = 'PRODUCTION';
export const STAGING = 'STAGING';
export const LOCAL = 'LOCAL';

// Input for credentials API
export const AWS_ASSUME_ROLE = 'aws_assume_role';

// VPC API default query fields
export const VPC_API_FIELDS = 'subnet,securityGroup';

// Default query fields value for AMI API
export const OS_TYPE = 'windows';
export const DATABASE_TYPE = 'sql';

// Default username for FSxN when creating new
export const FSXADMIN = 'fsxadmin';

// Default database name
export const SQL_DATABASE = 'sqldatabase';
export const SQL_USERNAME = 'sqlsa';

// Active Directory scenario type
export const AWS_MANAGED_AD = 'AWS_MANAGED_AD';
export const USER_MANAGED_AD = 'USER_MANAGED_AD';

// KMS status/state
export const ENABLED_STATE = 'Enabled';
export const DISABLED_STATE = 'Disabled';
export const PENDING_DELETION = 'PendingDeletion';
export const DEFAULT_MASTER_KEY = 'aws/fsx';

// Default instance type
export const DEAFULT_INSTANCE_VALUE = 'm5.xlarge';

// Add credentials link
export const CREDENTIAL_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/credentials/account-credentials';
export const CREDENTIAL_PROD_LINK = 'https://cloudmanager.netapp.com/credentials/account-credentials';

// Add WF credentials link
export const CREDENTIAL_WF_STAGE_LINK = 'https://staging.console.workloads.netapp.com/credentials';
export const CREDENTIAL_WF_PROD_LINK = 'https://console.workloads.netapp.com/credentials';

// Add timeline link
export const TIMELINE_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/timeline';
export const TIMELINE_PROD_LINK = 'https://cloudmanager.netapp.com/timeline';

//Retry API on gateway timeout
export const API_MAX_RETRIES = 2;

//License URL
export const LICENSE_URL =
    'https://docs.aws.amazon.com/launchwizard/latest/userguide/launch-wizard-setting-up.html#launch-wizard-custom-ami';

// Regions code list in a fixed order
export const REGIONS_CODE_LIST = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'eu-central-2',
    'ap-south-1',
    'ap-south-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-southeast-3',
    'ap-southeast-4',
    'ap-northeast-1',
    'ap-northeast-2',
    'sa-east-1',
    'ca-central-1',
    'eu-west-2',
    'eu-west-3',
    'eu-north-1',
    'us-gov-west-1',
    'us-gov-east-1',
    'cn-northwest-1',
    'cn-north-1',
    'ap-east-1',
    'me-south-1',
    'af-south-1',
    'eu-south-1',
    'eu-south-2',
    'ap-northeast-3',
    'me-central-1'
];

export const DATABASE_SERVICE_PATH = 'database-services';

export const FROM_DIALOG = {
    LOAD_CONFIG: 'load_config',
    SAVE_CONFIG: 'save_config',
    HEADER_CROSS: 'header_cross'
};

export const API_NAME = {
    REGION: 'region',
    VPC: 'vpc',
    ADS: 'ads',
    SNS: 'sns',
    KMS: 'kms',
    KEYPAIR: 'keypair',
    INSTANCE: 'instance',
    AMI: 'ami',
    FSXN: 'fsxn'
};

export const FSX_DEPLOYMENT_MODE = {
    SINGLE_AZ_1: 'SINGLE_AZ_1',
    MULTI_AZ_1: 'MULTI_AZ_1'
};

export const SQL_DEPLOYMENT_MODE = {
    FAILOVER_CLUSTER_VALUE: 'fci',
    SINGLE_INSTANCE_VALUE: 'standalone'
};

export const API_ERRORS = {
    DUPLICATE_CONFIG_NAME: 'An unique key constraint violated uk_wlmdb_config_account_id_name_user'
};

export const STATUS_CONST = {
    UP: 'Up',
    DOWN: 'Down',
    INITIALIZING: 'Initializing',
    FAILED: 'Failed'
};

export const MAX_SAVED_CONFIG = 100;

export const WLF_TO_FORM_NAVIGATE = '../add-working-environment/database-services/mssql/create';

export const RECOMMENDED_TEMPLATES = {
    DEV_ID: '0',
    PROD_ID: '1',
    DEV_NAME: 'Dev/Test',
    PROD_NAME: 'Production'
};

export const CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    token: string,
    payload: any
) => `
curl --location --request POST '${baseUrl}/credentials/${credentialId}/regions/${region}/cloudformation/stack' \\
--header 'Authorization: Bearer ${token}' \\
--header 'Content-Type: application/json' \\
--data-raw '${payload}'
`;

export const CRED_PLACEHOLDERS = {
    ACCOUNT_ID: '<AccountId>',
    CRED_ID: '<CredentialId>',
    REGION: '<Region>',
    TOKEN: '<Token>'
};

export const MARKETING_PAGE_URL = 'https://workloads.netapp.com/database-workloads';

export const DB_HOME_DATA_TYPE = {
    HOSTS: 'hosts',
    JOBS: 'jobs'
};

export const CODEBOX_REST_RES = {
    API: 'api',
    VIEW: 'view',
    COPY: 'copy'
};

export const PERMISSIONS = {
    'operate': {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "EC2BackendListStatement",
                "Effect": "Allow",
                "Action": [
                    "ec2:DescribeVpcs",
                    "ec2:DescribeSubnets",
                    "ec2:DescribeSecurityGroups",
                    "ec2:DescribeImages",
                    "ec2:DescribeRegions",
                    "ec2:DescribeRouteTables",
                    "ec2:DescribeKeyPairs",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DescribeInstanceTypes"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "EC2DeploymentOperationStatement",
                "Effect": "Allow",
                "Action": [
                    "ec2:StartInstances",
                    "ec2:StopInstances",
                    "ec2:TerminateInstances",
                    "ec2:ModifyInstanceAttribute",
                    "ec2:ModifySubnetAttribute",
                    "ec2:ModifyVolumeAttribute",
                    "ec2:ModifyVpcAttribute",
                    "ec2:ModifyNetworkInterfaceAttribute",
                    "ec2:ModifyVolume",
                    "ec2:ModifyInstancePlacement",
                    "ec2:AttachInternetGateway",
                    "ec2:AttachNetworkInterface",
                    "ec2:AttachVolume",
                    "ec2:DeleteLaunchTemplate",
                    "ec2:DeleteLaunchTemplateVersions",
                    "ec2:DeleteNetworkInterface",
                    "ec2:DeleteTags",
                    "ec2:DeleteVolume",
                    "ec2:DeleteSecurityGroup",
                    "ec2:AuthorizeSecurityGroupIngress",
                    "ec2:ReplaceRouteTableAssociation",
                    "ec2:RevokeSecurityGroupEgress",
                    "ec2:AssignPrivateIpAddresses",
                    "ec2:DisassociateRouteTable",
                    "ec2:RevokeSecurityGroupIngress",
                    "ec2:DisassociateIamInstanceProfile",
                    "ec2:DisassociateAddress",
                    "ec2:ReleaseAddress",
                    "ec2:DisassociateSubnetCidrBlock",
                    "ec2:AllocateHosts",
                    "ec2:AssociateVpcCidrBlock",
                    "ec2:ReplaceRoute",
                    "ec2:DisassociateVpcCidrBlock",
                    "ec2:AssociateRouteTable",
                    "ec2:DetachVolume",
                    "ec2:AssociateSubnetCidrBlock",
                    "ec2:AssociateAddress",
                    "ec2:AuthorizeSecurityGroupEgress",
                    "ec2:DetachNetworkInterface",
                    "ec2:AllocateAddress",
                    "ec2:CreateVolume"
                ],
                "Resource": [
                    "*"
                ],
                "Condition": {
                    "StringLike": {
                        "ec2:ResourceTag/aws:cloudformation:stack-name": [
                            "WLMDB*"
                        ]
                    }
                }
            },
            {
                "Sid": "EC2DeploymentListStatement",
                "Effect": "Allow",
                "Action": [
                    "ec2:Get*",
                    "ec2:DescribeLaunchTemplates",
                    "ec2:DescribeInstances",
                    "ec2:DescribeVolumes",
                    "ec2:CreateNetworkInterface",
                    "ec2:CreateLaunchTemplate",
                    "ec2:CreateLaunchTemplateVersion",
                    "ec2:CreateTags",
                    "ec2:CreateSecurityGroup",
                    "ec2:DescribeSecurityGroups",
                    "ec2:RunInstances"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "SNSListStatement",
                "Effect": "Allow",
                "Action": [
                    "sns:ListTopics"
                ],
                "Resource": "*"
            },
            {
                "Sid": "SNSStatement",
                "Effect": "Allow",
                "Action": [
                    "sns:Publish"
                ],
                "Resource": [
                    "arn:aws:sns:*:*:wlmdb"
                ]
            },
            {
                "Sid": "SecretManagerListStatement",
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:CreateSecret",
                    "secretsmanager:ListSecrets",
                    "secretsmanager:GetSecretValue"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "SecretManagerStatement",
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:DeleteResourcePolicy",
                    "secretsmanager:DeleteSecret",
                    "secretsmanager:TagResource",
                    "secretsmanager:PutResourcePolicy",
                    "secretsmanager:UntagResource"
                ],
                "Resource": [
                    "arn:aws:secretsmanager:*:*:secret:wlmdb*"
                ]
            },
            {
                "Sid": "CloudWatchDeploymentCreateStatement",
                "Effect": "Allow",
                "Action": [
                    "cloudwatch:PutMetricAlarm",
                    "cloudwatch:DeleteAlarms"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudWatchDeploymentListStatement",
                "Effect": "Allow",
                "Action": [
                    "cloudwatch:DescribeAlarms",
                    "cloudwatch:List*",
                    "cloudwatch:Get*",
                    "cloudwatch:Describe*"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudLogDeploymentCreateStatement",
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogStream",
                    "logs:CreateLogGroup",
                    "logs:GetLogEvents",
                    "logs:GetLogDelivery",
                    "logs:GetLogRecord",
                    "logs:ListLogDeliveries"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudLogDeploymentStatement",
                "Effect": "Allow",
                "Action": [
                    "logs:DeleteLogStream",
                    "logs:TagResource",
                    "logs:DeleteLogGroup",
                    "logs:UntagResource",
                    "logs:PutLogEvents"
                ],
                "Resource": [
                    "arn:aws:logs:*:*:log-group:WLMDB*"
                ]
            },
            {
                "Sid": "KMSListStatement",
                "Effect": "Allow",
                "Action": [
                    "kms:ListAliases",
                    "kms:ListKeys",
                    "kms:DescribeKey"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudFormationListStatement",
                "Effect": "Allow",
                "Action": [
                    "cloudformation:ListStacks",
                    "cloudformation:CreateStack",
                    "cloudformation:ValidateTemplate"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudFormationDeploymentStatement",
                "Effect": "Allow",
                "Action": [
                    "cloudformation:DeleteStack",
                    "cloudformation:SignalResource"
                ],
                "Resource": [
                    "arn:aws:cloudformation:*:*:stack/WLMDB*"
                ]
            },
            {
                "Sid": "DirectoryServiceStatement",
                "Effect": "Allow",
                "Action": [
                    "ds:DescribeDirectories"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "FSXListStatement",
                "Effect": "Allow",
                "Action": [
                    "fsx:DescribeVolumes",
                    "fsx:DescribeBackups",
                    "fsx:DescribeStorageVirtualMachines",
                    "fsx:DescribeFileSystems",
                    "fsx:CreateFileSystem",
                    "fsx:CreateVolume",
                    "fsx:CreateStorageVirtualMachine"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "FSXDeploymentStatement",
                "Effect": "Allow",
                "Action": [
                    "fsx:UntagResource",
                    "fsx:TagResource",
                    "fsx:DeleteFileSystem",
                    "fsx:DeleteVolume",
                    "fsx:DeleteStorageVirtualMachine"
                ],
                "Resource": [
                    "*"
                ],
                "Condition": {
                    "StringLike": {
                        "aws:ResourceTag/aws:cloudformation:stack-name": [
                            "WLMDB*"
                        ]
                    }
                }
            },
            {
                "Sid": "ResourceGroupListStatement",
                "Effect": "Allow",
                "Action": [
                    "resource-groups:List*",
                    "resource-groups:Get*",
                    "resource-groups:CreateGroup"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "ResourceGroupStatement",
                "Effect": "Allow",
                "Action": [
                    "resource-groups:DeleteGroup"
                ],
                "Resource": [
                    "arn:aws:resource-groups:*:*:group/WLMDB*"
                ]
            },
            {
                "Sid": "QuotaStatement",
                "Effect": "Allow",
                "Action": [
                    "servicequotas:ListServiceQuotas"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "PricingStatement",
                "Effect": "Allow",
                "Action": [
                    "pricing:GetProducts"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "STSStatement",
                "Effect": "Allow",
                "Action": [
                    "sts:GetCallerIdentity"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "IAMStatement",
                "Effect": "Allow",
                "Action": [
                    "iam:AddRoleToInstanceProfile",
                    "iam:GetRole",
                    "iam:GetPolicy",
                    "iam:GetRolePolicy",
                    "iam:CreateInstanceProfile",
                    "iam:PassRole",
                    "iam:DeleteInstanceProfile",
                    "iam:GetUser",
                    "iam:GetPolicyVersion",
                    "iam:RemoveRoleFromInstanceProfile",
                    "iam:SimulatePrincipalPolicy"
                ],
                "Resource": "*"
            },
            {
                "Sid": "SSMListStatement",
                "Effect": "Allow",
                "Action": [
                    "ssm:DescribeAssociation",
                    "ssm:GetDeployablePatchSnapshotForInstance",
                    "ssm:GetDocument",
                    "ssm:DescribeDocument",
                    "ssm:GetManifest",
                    "ssm:GetParameter",
                    "ssm:GetParameters",
                    "ssm:ListAssociations",
                    "ssm:ListInstanceAssociations",
                    "ssm:GetParametersByPath"
                ],
                "Resource": "*"
            },
            {
                "Sid": "SSMCreateStatement",
                "Effect": "Allow",
                "Action": [
                    "ssmmessages:CreateControlChannel",
                    "ssmmessages:CreateDataChannel",
                    "ssmmessages:OpenControlChannel",
                    "ssmmessages:OpenDataChannel",
                    "ssm:PutInventory",
                    "ssm:PutComplianceItems",
                    "ssm:PutConfigurePackageResult",
                    "ssm:UpdateAssociationStatus",
                    "ssm:UpdateInstanceAssociationStatus",
                    "ssm:UpdateInstanceInformation",
                    "ssm:SendCommand",
                    "ec2messages:GetEndpoint",
                    "ec2messages:GetMessages"
                ],
                "Resource": "*",
                "Condition": {
                    "StringLike": {
                        "ec2:ResourceTag/aws:cloudformation:stack-name": [
                            "WLMDB*"
                        ]
                    }
                }
            },
            {
                "Sid": "EC2MessagesStatement",
                "Effect": "Allow",
                "Action": [
                    "ec2messages:AcknowledgeMessage",
                    "ec2messages:DeleteMessage",
                    "ec2messages:FailMessage",
                    "ec2messages:SendReply"
                ],
                "Resource": "*",
                "Condition": {
                    "StringLike": {
                        "ec2:ResourceTag/aws:cloudformation:stack-name": [
                            "WLMDB*"
                        ]
                    }
                }
            }
        ]
    },
    'view': {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "SecretManagerListStatement",
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:GetSecretValue"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "SNSListStatement",
                "Effect": "Allow",
                "Action": [
                    "sns:ListTopics"
                ],
                "Resource": "*"
            },
            {
                "Sid": "EC2BackendListStatement",
                "Effect": "Allow",
                "Action": [
                    "ec2:DescribeVpcs",
                    "ec2:DescribeSubnets",
                    "ec2:DescribeSecurityGroups",
                    "ec2:DescribeImages",
                    "ec2:DescribeRegions",
                    "ec2:DescribeRouteTables",
                    "ec2:DescribeKeyPairs",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DescribeInstanceTypes"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "KMSListStatement",
                "Effect": "Allow",
                "Action": [
                    "kms:ListAliases",
                    "kms:ListKeys",
                    "kms:DescribeKey"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "CloudFormationListStatement",
                "Effect": "Allow",
                "Action": [
                    "cloudformation:ListStacks"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "DirectoryServiceStatement",
                "Effect": "Allow",
                "Action": [
                    "ds:DescribeDirectories"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "FSXListStatement",
                "Effect": "Allow",
                "Action": [
                    "fsx:DescribeVolumes",
                    "fsx:DescribeBackups",
                    "fsx:DescribeStorageVirtualMachines",
                    "fsx:DescribeFileSystems"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "QuotaStatement",
                "Effect": "Allow",
                "Action": [
                    "servicequotas:ListServiceQuotas"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "PricingStatement",
                "Effect": "Allow",
                "Action": [
                    "pricing:GetProducts"
                ],
                "Resource": [
                    "*"
                ]
            },
            {
                "Sid": "IAMStatement",
                "Effect": "Allow",
                "Action": [
                    "iam:SimulatePrincipalPolicy"
                ],
                "Resource": [
                    "*"
                ]
            }
        ]
    }
}