-- Drop unique key uk_wlmdb_resource_resource_id_account_id constraint of resource table.
ALTER TABLE `resource` DROP CONSTRAINT uk_wlmdb_resource_resource_id_account_id;

-- Create unique constraint of 'resource_id', 'account_id' and 'credentials_id' on resource table.
ALTER TABLE `resource` ADD CONSTRAINT `uk_wlmdb_resource_resource_id_account_id_credentials_id` UNIQUE(`resource_id`, `account_id`, `credentials_id`);
