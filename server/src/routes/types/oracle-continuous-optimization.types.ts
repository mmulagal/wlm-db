import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleNFSStorageOperatingSystem,
    OptimizeOracleStorageSizing,
    OptimizeOracleTypes
} from '../../utils/continous-optimization-consts';
import {
    OntapVolume,
    GenericViolationResponse,
    ErrorResponse,
    DismissedConfigurationsResponse
} from './continuous-optimization.types';

const OracleGenericParameterDriftResponse = Type.Object({
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
    violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
    tags: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    current: Type.Optional(Type.String()),
    totalObjectsAssessed: Type.Optional(Type.Number()),
    totalObjectsInViolation: Type.Optional(Type.Number()),
    resourceType: Type.Optional(Type.String())
});
type OracleGenericParameterDriftResponseType = Static<typeof OracleGenericParameterDriftResponse>;

const genericParameterDriftResponse = Type.Union([OracleGenericParameterDriftResponse, ErrorResponse]);
type GenericParameterDriftResponseType = Static<typeof genericParameterDriftResponse>;

const StorageParameterDriftResponse = Type.Object({
    configuration: Type.Object({
        volumes: Type.Array(genericParameterDriftResponse),
        luns: Type.Optional(Type.Array(genericParameterDriftResponse)),
        os: Type.Optional(Type.Array(genericParameterDriftResponse))
    }),
    layout: Type.Array(genericParameterDriftResponse),
    sizing: Type.Array(genericParameterDriftResponse)
});

type StorageParameterDriftResponseType = Static<typeof StorageParameterDriftResponse>;

const OracleDriftAssessmentResponse = Type.Object({
    storage: Type.Optional(Type.Union([StorageParameterDriftResponse, ErrorResponse])),
    dismissedConfigurations: Type.Optional(DismissedConfigurationsResponse),
    lastAssessmentTimestamp: Type.Optional(Type.Number()),
    fileSystemId: Type.Optional(Type.String()),
    ec2InstanceId: Type.Optional(Type.String()),
    ec2InstanceName: Type.Optional(Type.String()),
    databaseInstanceName: Type.Optional(Type.String()),
    deploymentType: Type.Optional(Type.String()),
    storageProtocol: Type.Optional(Type.String()),
    isASMManaged: Type.Optional(Type.Boolean()),
    databaseHostName: Type.Optional(Type.String())
});
type OracleDriftAssessmentResponseType = Static<typeof OracleDriftAssessmentResponse>;

const DriftAssessmentResponsePerInstance = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(OracleDriftAssessmentResponse),
    error: Type.Optional(Type.String())
});

const DriftAssessmentResponsePerHost = Type.Object({
    databaseHostId: Type.String({ minLength: 1 }),
    databaseHostName: Type.String(),
    instancesAssessment: Type.Array(DriftAssessmentResponsePerInstance)
});

type DriftAssessmentResponsePerHostType = Static<typeof DriftAssessmentResponsePerHost>;

const DriftAssessmentResponsePerAccount = Type.Object({
    count: Type.Number(),
    assessmentsPerAccount: Type.Array(DriftAssessmentResponsePerHost),
    nextToken: Type.Optional(Type.String())
});

type DriftAssessmentResponsePerAccountType = Static<typeof DriftAssessmentResponsePerAccount>;

const OptimizePerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1, description: 'WLMDB registered database host identifier' }),
    region: Type.String({ minLength: 1, description: 'AWS region of the database host' }),
    credentialsId: Type.String({ minLength: 1, description: 'WLMDB registered credentials identifier' }),
    databases: Type.Array(Type.String({ minLength: 1, description: 'Oracle database sid' }))
});

const HostsToOptimize = Type.Array(
    Type.Object({
        configurationName: Type.String({
            enum: [
                ...Object.values(OptimizeOracleiSCSIStorageOperatingSystem),
                ...Object.values(OptimizeOracleNFSStorageOperatingSystem),
                ...Object.values(OptimizeOracleStorageSizing)
            ],
            description:
                'Optimization configuration name for the type specified.\n\n' +
                'For iscsi-storage-operating-system type, valid values are:\n' +
                '- tcp-advanced-options\n' +
                '- host-utilities\n' +
                '- thp-disable\n' +
                '- iscsi-replacement-timeout\n' +
                '- multipath-io-sessions\n' +
                '- multipath-configuration\n' +
                '- multipath-friendly-names\n' +
                '- multiblock-readcount\n\n' +
                'For nfs-storage-operating-system type, valid values are:\n' +
                '- kernel-parameters\n'
        }),
        databaseHosts: Type.Array(OptimizePerHostRequestBody)
    })
);

type HostsToOptimizeType = Static<typeof HostsToOptimize>;

const OptimizeRequestBody = Type.Object({
    type: Type.String({
        enum: Object.values(OptimizeOracleTypes),
        description: 'Type of optimization to perform',
        examples: ['storage-operating-system']
    }),
    hostsToOptimize: HostsToOptimize
});

type OptimizeRequestBodyType = Static<typeof OptimizeRequestBody>;

export {
    OracleGenericParameterDriftResponse,
    OracleGenericParameterDriftResponseType,
    OracleDriftAssessmentResponse,
    GenericParameterDriftResponseType,
    OracleDriftAssessmentResponseType,
    StorageParameterDriftResponseType,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerHostType,
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerAccountType,
    OptimizeRequestBody,
    OptimizeRequestBodyType,
    HostsToOptimizeType
};
