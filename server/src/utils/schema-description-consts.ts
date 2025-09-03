const API_DESCRIPTION = {
    ACCOUNT_ID_DESC: 'Workload Factory account ID.',
    CREDENTIALS_ID_DESC: 'Workload Factory credentials ID.',
    AWS_REGION_DESC: 'AWS region hosting EC2 instances.',
    AWS_REGION_CODE_DESC: 'Region code for AWS region.',
    AWS_REGION_NAME_DESC: 'Region name for AWS region.',
    DATABASE_HOST_ID_DESC:
        'Unique identifier for database hosts managed by Workload Factory. The value for databaseHostId can be found using the GET database hosts API under Resources section in Database.',
    DATABASE_INSTANCE_ID_DESC:
        'Unique identifier for database instances managed by Workload Factory. The value for databaseInstanceId can be found using the GET database instances API under Resources section in Database.',
    DATABASE_INSTANCE_NAME_DESC: 'SQL Server instance name.',
    ORACLE_DATABASE_INSTANCES_DESC: 'List of Oracle database instances.',
    SQL_DATABASE_INSTANCES_DESC: 'List of SQL Server database instances.',
    EC2_INSTANCE_ID_DESC: 'EC2 instance id.',
    BEDROCK_SUPPORTED_DESC: 'Indicates if AWS Bedrock is available in the region.'
};

const API_DESCRIPTION_EXAMPLES = {
    CREDENTIALS_ID_EX: ['123e4567-e89b-12d3-a456-426614174000']
};

export { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES };
