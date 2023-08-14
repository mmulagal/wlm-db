
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

//Retry API on gateway timeout
export const API_MAX_RETRIES = 2;
