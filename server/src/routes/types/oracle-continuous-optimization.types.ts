import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentCategoriesOracle,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleNFSStorageOperatingSystem,
    OptimizeOracleStorageSizing,
    OptimizeOracleTypes,
    ORACLE_OPTIMIZE_STORAGE_CONFIGURATION_FIX_API_CONFIG_NAMES,
    ORACLE_OPTIMIZE_STORAGE_LAYOUT_FIX_API_CONFIG_NAMES
} from '../../utils/continous-optimization-consts';
import { CLONE_ACTION, OTHER_CLONE } from '../../utils/consts';
import {
    OntapVolume,
    GenericViolationResponse,
    ErrorResponse,
    CloneDetailSchema,
    ClonedVolumeDetailSchema,
    FsxBackupOptimizationFields,
    BaseAssessmentItem,
    AssessmentErrorItem,
    DismissedConfiguration,
    AssessmentMetadata,
    GenericParameterDriftResponseV1,
    DismissedConfigurationsResponse,
    ConfigDetail
} from './continuous-optimization.types';

const OracleGenericParameterDriftResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
    violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
    categories: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    // v1 exposed the AWS Well-Architected pillars as `tags`; v2 renamed it to `categories`.
    tags: Type.Optional(Type.Array(Type.Enum(AwsWellArchitecturedPillars))),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    current: Type.Optional(Type.String()),
    totalObjectsAssessed: Type.Optional(Type.Number()),
    totalObjectsInViolation: Type.Optional(Type.Number()),
    resourceType: Type.Optional(Type.String()),
    // Set only by aggregate configs (storage-efficiencies, tiering-tco-optimization).
    // Catalogue of every sub-parameter the entry assessed, with each one's recommended
    // target value and source resource type. Flows to v1 via Type.Omit below.
    configDetails: Type.Optional(Type.Array(ConfigDetail))
});
type OracleGenericParameterDriftResponseType = Static<typeof OracleGenericParameterDriftResponse>;

// v1 omits the v2-only `id`/`categories` (renamed to `name`/`tags` in v1); keep the strict base for v2 typing.
const OracleGenericParameterDriftResponseV1 = Type.Omit(OracleGenericParameterDriftResponse, ['id', 'categories']);

const genericParameterDriftResponse = Type.Union([OracleGenericParameterDriftResponse, ErrorResponse]);
type GenericParameterDriftResponseType = Static<typeof genericParameterDriftResponse>;

const genericParameterDriftResponseV1 = Type.Union([OracleGenericParameterDriftResponseV1, ErrorResponse]);

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

const StorageParameterDriftResponseV1 = Type.Object({
    configuration: Type.Object({
        volumes: Type.Array(genericParameterDriftResponseV1),
        luns: Type.Optional(Type.Array(genericParameterDriftResponseV1)),
        os: Type.Optional(Type.Array(genericParameterDriftResponseV1))
    }),
    layout: Type.Array(genericParameterDriftResponseV1),
    sizing: Type.Array(genericParameterDriftResponseV1)
});

const HostOsPatchDriftResponse = Type.Intersect([
    OracleGenericParameterDriftResponse,
    Type.Object({
        ec2InstancesToPatch: Type.Optional(
            Type.Array(
                Type.Object({
                    baselineId: Type.String(),
                    criticalNonCompliantCount: Type.Number(),
                    otherNonCompliantCount: Type.Optional(Type.Number()),
                    ec2InstanceId: Type.String(),
                    ec2InstanceName: Type.Optional(Type.String()),
                    operationStartTime: Type.Number(),
                    operationEndTime: Type.Number(),
                    securityNonCompliantCount: Type.Number()
                })
            )
        )
    })
]);
type HostOsPatchDriftResponseType = Static<typeof HostOsPatchDriftResponse>;

const HostOsPatchMissingPatch = Type.Object({
    classification: Type.String(),
    cveIds: Type.String(),
    state: Type.String(),
    title: Type.String(),
    severity: Type.String()
});

const HostOsPatchScanInstance = Type.Object({
    ec2InstanceId: Type.String(),
    missingPatchDetails: Type.Array(HostOsPatchMissingPatch)
});

const HostOsPatchScanResponse = Type.Object({
    status: Type.Enum(AssessmentStatus),
    ec2InstancesToPatch: Type.Array(HostOsPatchScanInstance)
});
type HostOsPatchScanResponseType = Static<typeof HostOsPatchScanResponse>;

const OraclePatchScanFields = [
    AssessmentCategoriesOracle.HOST_OS_PATCH,
    AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH
];
const OraclePatchScanField = Type.String({
    enum: OraclePatchScanFields,
    description: `Assessment category to calculate on demand. Allowed values: ${OraclePatchScanFields.join(', ')}.`
});
type OraclePatchScanFieldType = Static<typeof OraclePatchScanField>;

const OraclePatchScanDocResponse = Type.Object({
    status: Type.Optional(Type.String({ enum: Object.values(AssessmentStatus) })),
    ec2InstancesToPatch: Type.Optional(
        Type.Array(
            Type.Object({
                ec2InstanceId: Type.String(),
                database: Type.Optional(Type.String()),
                missingPatchDetails: Type.Optional(
                    Type.Array(
                        Type.Object({
                            classification: Type.Optional(Type.String()),
                            cveIds: Type.Optional(Type.String()),
                            state: Type.Optional(Type.String()),
                            title: Type.Optional(Type.String()),
                            severity: Type.Optional(Type.String()),
                            cveId: Type.Optional(Type.String()),
                            component: Type.Optional(Type.String()),
                            description: Type.Optional(Type.String()),
                            releaseDate: Type.Optional(Type.String()),
                            releaseName: Type.Optional(Type.String())
                        })
                    )
                )
            })
        )
    ),
    id: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String())
});

type OraclePatchScanDocResponseType = Static<typeof OraclePatchScanDocResponse>;

const OracleSecurityPatchMissingPatch = Type.Object({
    cveId: Type.String(),
    component: Type.String(),
    description: Type.String(),
    releaseDate: Type.String(),
    releaseName: Type.String()
});
type OracleSecurityPatchMissingPatchType = Static<typeof OracleSecurityPatchMissingPatch>;

const OracleSecurityPatchScanInstance = Type.Object({
    ec2InstanceId: Type.String(),
    database: Type.String(),
    missingPatchDetails: Type.Optional(Type.Array(OracleSecurityPatchMissingPatch))
});

const OracleSecurityPatchScanResponse = Type.Object({
    status: Type.Enum(AssessmentStatus),
    ec2InstancesToPatch: Type.Array(OracleSecurityPatchScanInstance)
});
type OracleSecurityPatchScanResponseType = Static<typeof OracleSecurityPatchScanResponse>;

const OracleSecurityPatchDriftResponse = Type.Intersect([
    OracleGenericParameterDriftResponse,
    Type.Object({
        missingPatchesCount: Type.Number()
    })
]);
type OracleSecurityPatchDriftResponseType = Static<typeof OracleSecurityPatchDriftResponse>;

const OracleCloneDetail = Type.Intersect([
    CloneDetailSchema,
    Type.Object({
        clonedVolumeDetails: Type.Optional(Type.Array(ClonedVolumeDetailSchema))
    })
]);

const OracleCloneDriftResponse = Type.Intersect([
    OracleGenericParameterDriftResponse,
    Type.Object({
        cloneDetails: Type.Optional(Type.Array(OracleCloneDetail)),
        oldCloneDetails: Type.Optional(Type.Array(OracleCloneDetail)),
        cloneDriftMessage: Type.Optional(Type.String())
    })
]);
type OracleCloneDriftResponseType = Static<typeof OracleCloneDriftResponse>;

/** Oracle-specific assessment item with patch properties. */
const OracleAssessmentItem = Type.Intersect([
    BaseAssessmentItem,
    Type.Object({
        missingPatchesCount: Type.Optional(Type.Number({ description: 'Count of missing security patches' })),
        ec2InstancesToPatch: Type.Optional(
            Type.Array(
                Type.Object({
                    baselineId: Type.Optional(Type.String()),
                    criticalNonCompliantCount: Type.Optional(Type.Number()),
                    otherNonCompliantCount: Type.Optional(Type.Number()),
                    ec2InstanceId: Type.String(),
                    ec2InstanceName: Type.Optional(Type.String()),
                    operationStartTime: Type.Optional(Type.Number()),
                    operationEndTime: Type.Optional(Type.Number()),
                    securityNonCompliantCount: Type.Optional(Type.Number())
                }),
                { description: 'EC2 instances requiring OS patches for Oracle' }
            )
        )
    })
]);
type OracleAssessmentItemType = Static<typeof OracleAssessmentItem>;

// v1 item variants omit the v2-only `id`/`categories` fields (renamed to `name`/`tags` in v1).
const HostOsPatchDriftResponseV1 = Type.Omit(HostOsPatchDriftResponse, ['id', 'categories']);
const OracleSecurityPatchDriftResponseV1 = Type.Omit(OracleSecurityPatchDriftResponse, ['id', 'categories']);
const OracleCloneDriftResponseV1 = Type.Omit(OracleCloneDriftResponse, ['id', 'categories']);

const OracleDriftAssessmentResponse = Type.Object({
    storage: Type.Optional(Type.Union([StorageParameterDriftResponseV1, ErrorResponse])),
    transparentHugepages: Type.Optional(genericParameterDriftResponseV1),
    tcpAdvancedOptions: Type.Optional(genericParameterDriftResponseV1),
    filesystemsIoOptions: Type.Optional(genericParameterDriftResponseV1),
    multiblockReadcount: Type.Optional(genericParameterDriftResponseV1),
    hostOsPatch: Type.Optional(Type.Union([HostOsPatchDriftResponseV1, ErrorResponse])),
    awsBackup: Type.Optional(genericParameterDriftResponseV1),
    oracleSecurityPatch: Type.Optional(Type.Union([OracleSecurityPatchDriftResponseV1, ErrorResponse])),
    crr: Type.Optional(Type.Union([GenericParameterDriftResponseV1, ErrorResponse])),
    snapcenterSnapshot: Type.Optional(Type.Union([OracleGenericParameterDriftResponseV1, ErrorResponse])),
    clone: Type.Optional(Type.Union([OracleCloneDriftResponseV1, ErrorResponse])),
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

/** Oracle-specific assessment response that preserves patch fields (ec2InstancesToPatch, missingPatchesCount). */
const OracleAssessmentResponse = Type.Object({
    assessments: Type.Array(Type.Union([OracleAssessmentItem, AssessmentErrorItem])),
    dismissedConfigurations: Type.Array(DismissedConfiguration),
    metadata: AssessmentMetadata
});
type OracleAssessmentResponseType = Static<typeof OracleAssessmentResponse>;

const DriftAssessmentResponsePerInstance = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(OracleAssessmentResponse),
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

const DriftAssessmentResponsePerInstanceV1 = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(OracleDriftAssessmentResponse),
    error: Type.Optional(Type.String())
});

const DriftAssessmentResponsePerHostV1 = Type.Object({
    databaseHostId: Type.String({ minLength: 1 }),
    databaseHostName: Type.String(),
    instancesAssessment: Type.Array(DriftAssessmentResponsePerInstanceV1)
});

const DriftAssessmentResponsePerAccountV1 = Type.Object({
    count: Type.Number(),
    assessmentsPerAccount: Type.Array(DriftAssessmentResponsePerHostV1),
    nextToken: Type.Optional(Type.String())
});

type DriftAssessmentResponsePerAccountV1Type = Static<typeof DriftAssessmentResponsePerAccountV1>;

const OptimizePerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1, description: 'WLMDB registered database host identifier' }),
    region: Type.String({ minLength: 1, description: 'AWS region of the database host' }),
    credentialsId: Type.String({ minLength: 1, description: 'WLMDB registered credentials identifier' }),
    databases: Type.Array(Type.String({ minLength: 1, description: 'Oracle database sid' }))
});

const BackupOptimizePerHostRequestBody = Type.Intersect([OptimizePerHostRequestBody, FsxBackupOptimizationFields]);

type BackupOptimizePerHostRequestBodyType = Static<typeof BackupOptimizePerHostRequestBody>;

const OracleCloneAction = Type.Object({
    cloneDatabaseName: Type.String({ minLength: 1 }),
    clonedBy: Type.String({ enum: [OTHER_CLONE] }),
    action: Type.String({ enum: [CLONE_ACTION.DELETE] })
});
type OracleCloneActionType = Static<typeof OracleCloneAction>;

const CloneOptimizePerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1, description: 'WLMDB registered database host identifier' }),
    region: Type.String({ minLength: 1, description: 'AWS region of the database host' }),
    credentialsId: Type.String({ minLength: 1, description: 'WLMDB registered credentials identifier' }),
    oracleInstances: Type.Array(
        Type.Object({
            instanceId: Type.String({ minLength: 1 }),
            clones: Type.Array(OracleCloneAction)
        })
    )
});
type CloneOptimizePerHostRequestBodyType = Static<typeof CloneOptimizePerHostRequestBody>;

const HostsToOptimize = Type.Array(
    Type.Object({
        configurationName: Type.String({
            enum: [
                ...Object.values(OptimizeOracleiSCSIStorageOperatingSystem),
                ...Object.values(OptimizeOracleNFSStorageOperatingSystem),
                ...Object.values(OptimizeOracleStorageSizing),
                'aws-backup',
                'clone'
            ],
            description:
                'Optimization configuration name for the type specified.\n\n' +
                'For compute-host-os type, valid values are:\n' +
                '- transparent-hugepages\n' +
                '- tcp-advanced-options\n' +
                '- filesystems-io-options\n' +
                '- multiblock-readcount\n\n' +
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
                '- kernel-parameters\n\n' +
                'For aws-backup type, valid values are:\n' +
                '- aws-backup\n\n' +
                'For clone type, valid values are:\n' +
                '- clone\n'
        }),
        databaseHosts: Type.Array(Type.Union([BackupOptimizePerHostRequestBody, CloneOptimizePerHostRequestBody]))
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

const OracleOptimizeStorageConfigurationRequestParams = Type.Object({
    configurationName: Type.String({ enum: ORACLE_OPTIMIZE_STORAGE_CONFIGURATION_FIX_API_CONFIG_NAMES }),
    objectsToOptimize: Type.Array(Type.String({ minLength: 1 }))
});

const OracleOptimizeStorageLayoutRequestParams = Type.Object({
    configurationName: Type.String({ enum: ORACLE_OPTIMIZE_STORAGE_LAYOUT_FIX_API_CONFIG_NAMES }),
    objectsToOptimize: Type.Array(Type.String({ minLength: 1 }))
});

const OptimizeStorageConfigurationRequestBody = Type.Object({
    assessments: Type.Optional(Type.Array(OracleOptimizeStorageConfigurationRequestParams))
});
type OptimizeStorageConfigurationRequestBodyType = Static<typeof OptimizeStorageConfigurationRequestBody>;

const OptimizeStorageLayoutRequestBody = Type.Object({
    assessments: Type.Optional(Type.Array(OracleOptimizeStorageLayoutRequestParams))
});
type OptimizeStorageLayoutRequestBodyType = Static<typeof OptimizeStorageLayoutRequestBody>;

export {
    OracleAssessmentItem,
    OracleAssessmentItemType,
    OracleAssessmentResponse,
    OracleAssessmentResponseType,
    OracleGenericParameterDriftResponse,
    OracleGenericParameterDriftResponseType,
    GenericParameterDriftResponseType,
    StorageParameterDriftResponseType,
    HostOsPatchDriftResponse,
    HostOsPatchDriftResponseType,
    HostOsPatchScanResponse,
    HostOsPatchScanResponseType,
    OraclePatchScanField,
    OraclePatchScanFieldType,
    OraclePatchScanDocResponse,
    OraclePatchScanDocResponseType,
    OracleSecurityPatchScanResponse,
    OracleSecurityPatchScanResponseType,
    OracleSecurityPatchMissingPatchType,
    OracleSecurityPatchDriftResponse,
    OracleSecurityPatchDriftResponseType,
    OracleCloneDriftResponse,
    OracleCloneDriftResponseType,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerHostType,
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerAccountType,
    DriftAssessmentResponsePerInstanceV1,
    DriftAssessmentResponsePerHostV1,
    DriftAssessmentResponsePerAccountV1,
    DriftAssessmentResponsePerAccountV1Type,
    OracleDriftAssessmentResponse,
    OracleDriftAssessmentResponseType,
    OptimizeRequestBody,
    OptimizeRequestBodyType,
    HostsToOptimizeType,
    OptimizeStorageConfigurationRequestBody,
    OptimizeStorageConfigurationRequestBodyType,
    OptimizeStorageLayoutRequestBody,
    OptimizeStorageLayoutRequestBodyType,
    BackupOptimizePerHostRequestBodyType,
    OracleCloneAction,
    OracleCloneActionType,
    CloneOptimizePerHostRequestBody,
    CloneOptimizePerHostRequestBodyType
};
