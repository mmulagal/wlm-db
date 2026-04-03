import { Static, Type } from '@fastify/type-provider-typebox';
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

enum OracleDataguardProtectionLevel {
    MAXIMUM_PROTECTION = 'MAXIMUM PROTECTION',
    MAXIMUM_AVAILABILITY = 'MAXIMUM AVAILABILITY',
    MAXIMUM_PERFORMANCE = 'MAXIMUM PERFORMANCE',
    UNKNOWN = 'UNKNOWN' // Added UNKNOWN to handle cases where protection level cannot be determined
}

enum OracleOpenModes {
    READ_WRITE = 'READ WRITE',
    READ_ONLY = 'READ ONLY',
    MOUNTED = 'MOUNTED',
    NOMOUNT = 'NOMOUNT',
    READ_ONLY_WITH_APPLY = 'READ ONLY WITH APPLY',
    UNKNOWN = 'UNKNOWN' // Added UNKNOWN to handle cases where open mode cannot be determined
}

interface OracleVolumeRecord {
    volumeId: string;
    volumeName: string;
    svmId?: string;
    svmName?: string;
    lunName?: string;
    lunId?: string;
    junctionPath?: string;
    lunPath?: string;
    diskName?: string;
    diskGroup?: string;
    copiesCount?: number;
}
interface OracleMappedOntapVolumeRecord {
    isCDB?: boolean;
    error?: string;
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

const DataguardStatusResponse = Type.Object({
    status: Type.Optional(Type.String({ description: 'Current sync status of the DataGuard instance' })),
    transportLag: Type.Optional(Type.String({ description: 'Transport lag in DD HH:MI:SS format' })),
    applyLag: Type.Optional(Type.String({ description: 'Apply lag in DD HH:MI:SS format' }))
});
type DataguardStatusResponse = Static<typeof DataguardStatusResponse>;

const OracleDataguardDiscoveryDetails = Type.Object({
    dbUniqueName: Type.Optional(Type.String({ description: 'Database unique name' })),
    dbName: Type.Optional(Type.String({ description: 'Database name' })),
    associatedHosts: Type.Optional(
        Type.Array(
            Type.Object({
                serviceName: Type.Optional(Type.String({ description: 'Data Guard service name' })),
                hostIp: Type.Optional(Type.String({ description: 'Data Guard host IP address' })),
                ec2InstanceId: Type.Optional(Type.String({ description: 'Data Guard host EC2 instance ID' })),
                listenerPort: Type.Optional(Type.String({ description: 'Data Guard listen port' })),
                sidName: Type.Optional(Type.String({ description: 'Data Guard SID name' })),
                role: Type.Optional(Type.String({ description: 'Data Guard role (PRIMARY, PHYSICAL STANDBY, etc.)' })),
                hostName: Type.Optional(Type.String({ description: 'Data Guard host EC2 instance private DNS name' })),
                databaseHostId: Type.Optional(Type.String({ description: 'Data Guard database host WLM database ID' })),
                databaseInstanceId: Type.Optional(
                    Type.String({ description: 'Data Guard database instance WLM database ID' })
                )
            })
        )
    ),
    isPrimaryNode: Type.Optional(
        Type.Boolean({
            description: 'Is this primary Oracle instance'
        })
    )
});
type OracleDataguardDiscoveryDetailsType = Static<typeof OracleDataguardDiscoveryDetails>;

const DataguardDetailsResponse = Type.Intersect([
    Type.Object({
        role: Type.Optional(Type.String({ description: 'DataGuard role (PRIMARY, PHYSICAL STANDBY, etc.)' })),
        status: Type.Optional(DataguardStatusResponse),
        error: Type.Optional(Type.String({ description: 'Error message if DataGuard details retrieval failed' })),
        isActiveDataguard: Type.Optional(
            Type.Boolean({
                description:
                    'Indicates if Active Data Guard is enabled. True when a Physical Standby database is open in READ ONLY WITH APPLY mode.'
            })
        ),
        protectionLevel: Type.Optional(
            Type.Enum(OracleDataguardProtectionLevel, {
                description:
                    'Data Guard protection mode: MAXIMUM PROTECTION, MAXIMUM AVAILABILITY, or MAXIMUM PERFORMANCE'
            })
        ),
        openMode: Type.Optional(
            Type.Enum(OracleOpenModes, {
                description:
                    'Oracle instance open mode: READ WRITE, READ ONLY, MOUNTED, NOMOUNT, or READ ONLY WITH APPLY'
            })
        )
    }),
    OracleDataguardDiscoveryDetails
]);
type DataguardDetailsResponseType = Static<typeof DataguardDetailsResponse>;

export {
    OracleInstanceMountpointResponse,
    MountPointDetails,
    OracleSysFileTypes,
    OracleMappedOntapVolumesResponse,
    OracleMappedOntapVolumeRecord,
    OracleVolumeRecord,
    OracleDeploymentType,
    OracleDeploymentTenacyType,
    DataguardDetailsResponse,
    DataguardStatusResponse,
    OracleDataguardDiscoveryDetails,
    DataguardDetailsResponseType,
    OracleDataguardDiscoveryDetailsType
};
