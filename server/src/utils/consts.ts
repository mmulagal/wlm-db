import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';

//General
export const APP_NAME = 'Workload Manager for DB';
export const API_TITLE = 'Workload Manager for DB API';

// local storage keys
export const USER_TOKEN = 'USER_TOKEN';
export const REQUEST_ID = 'REQUEST_ID';
export const ACCOUNT_ID = 'ACCOUNT_ID';
export const AGENT_ID = 'AGENT_ID';
export const AUDIT_GROUP = 'AUDIT_GROUP';
export const WORKSPACE_ID = 'WORKSPACE_ID';

// version
export const VERSION: string = JSON.parse(readFileSync(join(process.cwd(), 'package.json')).toString()).version;

export const AUTH0_SERVER_ADDRESS = process.env.AUTH0_ENDPOINT
    ? `https://${process.env.AUTH0_ENDPOINT}`
    : config.get<string>('urls.auth0');

export enum HEADERS {
    AGENT_ID = 'x-agent-id',
    AUTHORIZATION = 'authorization',
    REQUEST_ID = 'x-request-id',
    SERVICE_REQUEST_ID = 'x-service-request-id',
    TENANCY_ACCOUNT_ID = 'x-tenancy-account-id',
    CERTIFICATE_AUTHORITY = 'x-certificate-authority',
    WORKSPACE_ID = 'x-workspace-id',
    TOKEN = 'x-token',
    ENDPOINT = 'x-endpoint',
    CERTIFICATE = 'x-certificate',
    KEY = 'x-key',
    REGION = 'x-region',
    NETAPP_WLMSQL_REQUEST_ID = 'x-netapp-wlmsql-request-id',
    SIMULATOR = 'x-simulator'
}

export const API_PATH_HEALTH: string = '/health';

export const CONNECTOR_ENDPOINT: string = process.env.CLOUD_MANAGER_ENDPOINT
    ? `http://${process.env.CLOUD_MANAGER_ENDPOINT}`
    : !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
    ? config.get<string>('urls.local-connector')
    : config.get<string>('urls.cloud-manager');

export const CLOUD_MANAGER_SERVER_ADDRESS = config.get<string>('urls.cloud-manager');

// Audit
export const DEFAULT_AWS_REGION = 'us-east-1';

export const CLOUD_MANAGER_ENDPOINT: string = config.get<string>('urls.cloud-manager');
export const TENANCY_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/tenancy`;
export const AGENTS_MANAGEMENT_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/agents-mgmt`;
export const SIGNOZ_ENDPOINT: string = config.get<string>('urls.signoz');

export const CREDENTIALS_ENDPOINT: string = config.get<string>('urls.cloud-manager');

export const CLOUD_MANAGER_GET_CVO_WE_PREFIX = '/occm/api/working-environments';

export const RESOURCE_CLASS = 'STORAGE_SERVICES';

// Kinesis
export const KINESIS_STREAM_NAME = 'audit-service-staging-stream';

export enum CredentialsType {
    AWS = 'aws_assume_role',
    AZURE = 'azure_service_principal'
}

export enum CloudProviders {
    AWS = 'AWS',
    AZURE = 'AZURE',
    GCP = 'GCP'
}

export enum RouteTags {
    AWS = 'AWS',
    GENERIC = 'Generic',
    SYSTEM = 'System'
}

export const CARGO = 'cargo';

export const AUTH0_AUDIENCE = config.get<string>('jwt.audience.tenancy');

export const KEY_VAULT_URL: string = process.env.KEY_VAULT_URL as string;

export const SECRETS: Record<string, string | undefined> = {
    CLIENT_ID: process.env.CLIENT_ID
        ? process.env.CLIENT_ID
        : config.has('service-token.client_id')
        ? config.get('service-token.client_id')
        : undefined,
    CLIENT_SECRET: process.env.CLIENT_SECRET
        ? process.env.CLIENT_SECRET
        : config.has('service-token.client_secret')
        ? config.get('service-token.client_secret')
        : undefined,
    AUDIT_ACCESS_KEY: process.env.AUDIT_ACCESS_KEY
        ? process.env.AUDIT_ACCESS_KEY
        : config.has('audit.access-key')
        ? config.get('audit.access-key')
        : undefined,
    AUDIT_SECRET_KEY: process.env.AUDIT_SECRET_KEY
        ? process.env.AUDIT_SECRET_KEY
        : config.has('audit.secret-key')
        ? config.get('audit.secret-key')
        : undefined
};

export const SECRETS_KEY_VAULT_KEYS: Record<string, string> = {
    CLIENT_ID: 'WLM-DB-CLIENT-ID',
    CLIENT_SECRET: 'WLM-DB-CLIENT-SECRET',
    AUDIT_ACCESS_KEY: 'WLM-DB-AUDIT-ACCESS-KEY',
    AUDIT_SECRET_KEY: 'WLM-DB-AUDIT-SECRET-KEY'
};

export const DEMO_ACCOUNT_ID = 'account-j3aZttuL';

export const SECRET_WORDS = [
    'credentials',
    'passphrase',
    'certificateAuthority',
    'clientCertificate',
    'authorization',
    'secretAccessKey',
    'accessKeyId',
    'sessionToken',
    'token',
    'secretkey',
    'accesskey',
    'password',
    'clientSecret',
    'clientId',
    'x-token',
    'x-certificate-authority',
    'clientKey',
    'client_id',
    'client_secret',
    'access_token',
    'secretAccessKey',
    'accessKeyId',
    'authorization',
    'SessionToken',
    'AccessKeyId',
    'SecretAccessKey',
    'username'
];

export const SQL_AMI_NAMES = [
    'Windows_Server-2016-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2019_Standard*',
    'Windows_Server-2019-English-Full-SQL_2019_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2019_Standard*',
    'Windows_Server-2022-English-Full-SQL_2017_Standard*',
    'Windows_Server-2022-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2019_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2019_Standard*',
    'Windows_Server-2019-English-Full-SQL_2022_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2022_Standard*',
    'Windows_Server-2022-English-Full-SQL_2022_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2016_SP*_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2022_Standard*',
    'Windows_Server-2019-English-Full-SQL_2016_SP*_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2017_Standard*',
    'Windows_Server-2016-English-Full-SQL_2016_SP*_Standard*',
    'Windows_Server-2019-English-Full-SQL_2016_SP*_Standard*',
    'Windows_Server-2019-English-Full-SQL_2017_Standard*',
    'Windows_Server-2016-English-Full-SQL_2019_Enterprise*'
];

export enum AWSQueryFields {
    SUBNET = 'subnet',
    SECURITY_GROUP = 'securitygroup'
}

// List of regions having "Amazon FSx for NetApp ONTAP" service.
// List taken from https://www.aws-services.info/fsx-ontap.html
export const FSX_SUPPORTED_REGIONS = new Map<string, string>([
    // "Region Name"    "Descriptive Region Name"
    // -------------    -------------------------
    ['af-south-1', 'Africa (Cape Town)'],
    ['ap-east-1', 'Asia Pacific (Hong Kong)'],
    ['ap-northeast-1', 'Asia Pacific (Tokyo)'],
    ['ap-northeast-2', 'Asia Pacific (Seoul)'],
    ['ap-south-1', 'Asia Pacific (Mumbai)'],
    ['ap-south-2', 'Asia Pacific (Hyderabad)'],
    ['ap-southeast-1', 'Asia Pacific (Singapore)'],
    ['ap-southeast-2', 'Asia Pacific (Sydney)'],
    ['ap-southeast-3', 'Asia Pacific (Jakarta)'],
    ['ap-southeast-4', 'Asia Pacific (Melbourne)'],
    ['ca-central-1', 'Canada (Central)'],
    ['eu-central-1', 'Europe (Frankfurt)'],
    ['eu-central-2', 'Europe (Zurich)'],
    ['eu-north-1', 'Europe (Stockholm)'],
    ['eu-south-1', 'Europe (Milan)'],
    ['eu-south-2', 'Europe (Spain)'],
    ['eu-west-1', 'Europe (Ireland)'],
    ['eu-west-2', 'Europe (London)'],
    ['eu-west-3', 'Europe (Paris)'],
    ['me-central-1', 'Middle East (UAE)'],
    ['me-south-1', 'Middle East (Bahrain)'],
    ['sa-east-1', 'South America (Sao Paulo)'],
    ['us-east-1', 'US East (N. Virginia)'],
    ['us-east-2', 'US East (Ohio)'],
    ['us-gov-east-1', 'AWS GovCloud (US-East)'],
    ['us-gov-west-1', 'AWS GovCloud (US-West)'],
    ['us-west-1', 'US West (N. California)'],
    ['us-west-2', 'US West (Oregon)']
]);
