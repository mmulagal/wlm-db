const SSM_RUN_SHELL_SCRIPT_DOC = 'AWS-RunShellScript';
const SSM_RUN_SHELL_SCRIPT_DOC_VERSION = '1';
const ORACLE_DEFAULT_PDB = 'PDB$SEED';
const MAX_LUNS_PER_DG = 8;

const STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS = [
    'data-dg-lun-layout',
    'redolog-dg-lun-layout',
    'fra-dg-lun-layout',
    'archivelog-dg-lun-layout'
];

enum MIN_OPTIMAL_LUN_PER_DG {
    DATA = 4,
    LOG_RECOVERY = 2
}

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
    CONTROL_FILES = 'CONTROL_FILES',
    FRA = 'FRA'
}

const pythonRelativePaths = [
    'wlmdb/oracle/packages/rhel8.9_8.10_python311_rpms.tar.gz',
    'wlmdb/oracle/packages/suse15_python311_rpms.tar.gz'
];

const supportedOracleOsVersions = ['sles15', 'rhel8'];

const CDB = 'CDB';
const PDB = 'PDB';
const ORACLE_DEPLOYMENT_ARCHITECTURE = {
    SINGLE_TENANT: 'Single tenant'
};
export {
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION,
    OracleDeployment,
    OracleDeploymentTenacy,
    OracleSysFileTypes,
    ORACLE_DEFAULT_PDB,
    MIN_OPTIMAL_LUN_PER_DG,
    MAX_LUNS_PER_DG,
    pythonRelativePaths,
    supportedOracleOsVersions,
    CDB,
    PDB,
    ORACLE_DEPLOYMENT_ARCHITECTURE,
    STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS
};
