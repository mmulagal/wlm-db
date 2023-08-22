
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
export const AWS_ASSUME_ROLE = 'aws_assume_role'

// VPC API default query fields
export const VPC_API_FIELDS = 'subnet,securityGroup'

// Default query fields value for AMI API
export const OS_TYPE = 'windows'
export const DATABASE_TYPE = 'sql'

// Default username for FSxN when creating new
export const FSXADMIN = 'fsxadmin'

// Default database name
export const SQL_DATABASE = 'sqldatabase_1'

// Active Directory scenario type
export const AWS_MANAGED_AD= 'AWS_MANAGED_AD'

// KMS status/state
export const EXPIRED_STATUS = 'expired'
export const EXPIRING_STATUS = 'expiring'
export const ENABLED_STATE = 'Enabled'
export const DEFAULT_MASTER_KEY = 'aws/fsx'

// Add credentials link
export const CREDENTIAL_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/credentials/account-credentials';
export const CREDENTIAL_PROD_LINK = 'https://cloudmanager.netapp.com/credentials/account-credentials';

// Add timeline link
export const TIMELINE_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/timeline';
export const TIMELINE_PROD_LINK = 'https://cloudmanager.netapp.com/timeline';

//Retry API on gateway timeout
export const API_MAX_RETRIES = 2;

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
]