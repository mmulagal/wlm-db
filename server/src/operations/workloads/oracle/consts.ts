const SSM_RUN_SHELL_SCRIPT_DOC = 'AWS-RunShellScript';
const SSM_RUN_SHELL_SCRIPT_DOC_VERSION = '1';
const ORACLE_DEFAULT_PDB = 'PDB$SEED';

enum OracleDeployment {
    STANDALONE = 'standalone',
    DATA_GUARD = 'data_guard'
}

enum OracleDeploymentTenacy {
    SINGLE_TENANT = 'SINGLE_TENANT',
    MULTI_TENANT = 'MULTI_TENANT' // for CDB
}

enum OracleSysFileTypes {
    REDO_LOGS = 'REDO_LOGS',
    ARCHIVE_LOGS = 'ARCHIVE_LOGS',
    DATA_FILES = 'DATA_FILES',
    TEMP_FILES = 'TEMP_FILES',
    CONTROL_FILES = 'CONTROL_FILES'
}
export {
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION,
    OracleDeployment,
    OracleDeploymentTenacy,
    OracleSysFileTypes,
    ORACLE_DEFAULT_PDB
};
