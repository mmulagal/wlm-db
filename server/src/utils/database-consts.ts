const RESOURCE_DEFAULT_SELECT_FIELDS = [
    'id',
    'account_id',
    'credentials_id',
    'storage_type',
    'resource_id',
    'resource_name',
    'resource_type',
    'cloud_provider_account_id',
    'region',
    'metadata'
];

const INSTANCE_DEFAULT_SELECT_FIELDS = [
    'id',
    'account_id',
    'credentials_id',
    'region',
    'resource_id',
    'database_instance_id',
    'database_instance_name',
    'fsxn_ids',
    'is_default',
    'database_deployment_type',
    'database_type',
    'created_time',
    'updated_time',
    'source',
    'number_of_user_dbs_created',
    'sandbox_created',
    'storage_protocol',
    'fsx_svm_id',
    'metadata',
    'configurations'
];

const INSTANCE_CONFIG_DEFAULT_SELECT_FIELDS = [
    'id',
    'account_id',
    'credentials_id',
    'region',
    'resource_id',
    'database_instance_id',
    'creation_time',
    'last_updated',
    'config_data',
    'config_data_type'
];

export { RESOURCE_DEFAULT_SELECT_FIELDS, INSTANCE_DEFAULT_SELECT_FIELDS, INSTANCE_CONFIG_DEFAULT_SELECT_FIELDS };
