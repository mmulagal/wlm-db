import { Type } from '@fastify/type-provider-typebox';
import { OracleDeployment, OracleDeploymentTenacy } from './consts';

interface OracleInstanceMountpointResponse {
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
    diskName?: string;
}
enum OracleSysFileTypes {
    REDO_LOGS = 'REDO_LOGS',
    ARCHIVE_LOGS = 'ARCHIVE_LOGS',
    DATA_FILES = 'DATA_FILES',
    TEMP_FILES = 'TEMP_FILES',
    CONTROL_FILES = 'CONTROL_FILES',
    FRA = 'FRA'
}

interface OracleVolumeRecord {
    volumeId: string;
    volumeName: string;
    svmUuid?: string;
    svmName?: string;
    lunName?: string;
    lunId?: string;
    diskName?: string;
    diskGroup?: string;
}
interface OracleMappedOntapVolumeRecord {
    isCDB?: boolean;
    ontapVolumes?: Record<string, OracleVolumeRecord[]> | Record<string, Record<string, OracleVolumeRecord[]>>;
}
interface OracleMappedOntapVolumesResponse {
    isASMManaged?: boolean;
    protocol?: string;
    lunRecords?: any[];
    volumeMappings?: [Record<string, OracleMappedOntapVolumeRecord>];
}

const OracleDeploymentType = Type.Enum(OracleDeployment);
const OracleDeploymentTenacyType = Type.Enum(OracleDeploymentTenacy);

export {
    OracleInstanceMountpointResponse,
    MountPointDetails,
    OracleSysFileTypes,
    OracleMappedOntapVolumesResponse,
    OracleMappedOntapVolumeRecord,
    OracleVolumeRecord,
    OracleDeploymentType,
    OracleDeploymentTenacyType
};
