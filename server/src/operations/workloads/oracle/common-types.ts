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

interface OracleVolumeRecord {
    volumeId: string;
    volumeName: string;
    svmId?: string;
    svmName?: string;
    lunName?: string;
    lunId?: string;
    diskName?: string;
    diskGroup?: string;
    copiesCount?: number;
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
                role: Type.Optional(Type.String({ description: 'Data Guard role (PRIMARY, PHYSICAL STANDBY, etc.)' }))
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
        error: Type.Optional(Type.String({ description: 'Error message if DataGuard details retrieval failed' }))
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
