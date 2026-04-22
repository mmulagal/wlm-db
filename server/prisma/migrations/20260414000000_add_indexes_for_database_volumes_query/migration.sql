-- CreateIndex
CREATE INDEX `k_wlmdb_db_inst_cfg_acct_id_cfg_type` ON `database_instance_config_data`(`account_id`, `config_data_type`);

-- CreateIndex
CREATE INDEX `k_wlmdb_database_instances_fsxn_ids` ON `database_instances`(`fsxn_ids`);
