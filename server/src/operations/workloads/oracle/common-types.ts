interface GetOracleInstanceMountpointResponse {
    isCDB?: boolean;
    isASMManaged?: boolean;
    mountDetails?: Record<string, MountPointDetails[]>;
    pdbMountDetails?: Record<string, Record<string, MountPointDetails[]>>;
}
interface MountPointDetails {
    isAsmManaged?: boolean;
    mountIP?: string;
    mountPoint?: string;
    protocol?: string;
}
enum OracleSysFileTypes {
    REDO_LOGS = 'REDO_LOGS',
    ARCHIVE_LOGS = 'ARCHIVE_LOGS',
    DATA_FILES = 'DATA_FILES',
    TEMP_FILES = 'TEMP_FILES',
    CONTROL_FILES = 'CONTROL_FILES'
}

export { GetOracleInstanceMountpointResponse, MountPointDetails, OracleSysFileTypes };
