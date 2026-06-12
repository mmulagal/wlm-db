import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentCategories,
    AssessmentStatus,
    DISMISS_STATUS_ENUM,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeCloneParams,
    OptimizeComputeParams,
    OptimizeHighAvailabilityParams,
    OptimizeMaxDopParams,
    OptimizeOperatingSystemParams,
    OptimizeStorageRequestParams,
    OptimizeStorageTierParams
} from '../../utils/continous-optimization-consts';
import {
    ErrorResponse,
    GenericParameterDriftResponse,
    OntapVolume,
    CloneDetailSchema,
    ClonedVolumeDetailSchema,
    FsxBackupOptimizationFields,
    BaseAssessmentItem,
    AssessmentErrorItem,
    DismissedConfiguration,
    AssessmentMetadata,
    GenericAssessmentResponseV1,
    DismissedConfigurationsResponse
} from './continuous-optimization.types';
import { CLONE_ACTION } from '../../utils/consts';

const CloneDetails = Type.Intersect([
    CloneDetailSchema,
    Type.Object({
        tags: Type.Optional(Type.String()),
        clonedVolumeDetails: Type.Optional(
            Type.Array(
                Type.Intersect([
                    ClonedVolumeDetailSchema,
                    Type.Object({
                        cloneVolumeType: Type.Optional(Type.String())
                    })
                ])
            )
        )
    })
]);

const SizingViolationResponse = Type.Object({
    databases: Type.Optional(Type.Array(Type.String())),
    dataAccessPath: Type.Optional(Type.Array(Type.String())),
    dataDriveTotalSizeMB: Type.Optional(Type.Number()),
    logAccessPath: Type.Optional(Type.String()),
    logDriveTotalSizeMB: Type.Optional(Type.Number()),
    svmName: Type.Optional(Type.String()),
    ontapVolumeName: Type.Optional(Type.String()),
    ontapVolumeUuid: Type.Optional(Type.String()),
    lunUuid: Type.Optional(Type.String()),
    lunPath: Type.Optional(Type.String()),
    tempdbAccessPath: Type.Optional(Type.String()),
    tempdbDriveTotalSizeMB: Type.Optional(Type.Number()),
    diskSerialNumber: Type.Optional(Type.String()),
    sizePercentToDataDrive: Type.Optional(Type.Number())
});
type SizingViolationResponseType = Static<typeof SizingViolationResponse>;

const ParameterDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        sizingViolations: Type.Optional(
            Type.Object({
                overProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
                underProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
                ignoredDrives: Type.Optional(Type.Array(SizingViolationResponse))
            })
        )
    })
]);
type ParameterDriftResponseType = Static<typeof ParameterDriftResponse>;

const StorageParameterErrorResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    errorMessage: Type.String()
});

const StorageParameterDriftResponse = Type.Object({
    configuration: Type.Object({
        volumes: Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse])),
        luns: Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse])),
        os: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse]))
    }),
    sizing: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse])),
    layout: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse])),
    fileSystems: Type.Array(Type.String())
});

type StorageParameterDriftResponseType = Static<typeof StorageParameterDriftResponse>;

const RssConfigDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        rssAdapters: Type.Optional(
            Type.Array(
                Type.Object({
                    adapterName: Type.String(),
                    rssEnabled: Type.Boolean(),
                    rssProfile: Type.String(),
                    baseProcessorNumber: Type.Number({ nullable: true }),
                    numberOfReceiveQueues: Type.Number()
                })
            )
        ),
        recommendedAdapterSettings: Type.Optional(
            Type.Object({
                recommendedRssProfile: Type.Optional(Type.String()),
                recommendedBaseProcessorNumber: Type.Optional(Type.Number()),
                recommendedReceiveQueues: Type.Optional(Type.Number())
            })
        ),
        tcpOffloadState: Type.Optional(Type.String()),
        rssConfigFinding: Type.Optional(Type.String())
    })
]);

type RssConfigDriftResponseType = Static<typeof RssConfigDriftResponse>;

const ComputeDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        recommendationOptions: Type.Optional(
            Type.Array(
                Type.Object({
                    instanceType: Type.String(),
                    rank: Type.Number(),
                    savingsOpportunity: Type.Optional(
                        Type.Object({
                            savingsOpportunityPercentage: Type.Optional(Type.Number()),
                            estimatedMonthlySavings: Type.Optional(
                                Type.Object({
                                    currency: Type.Optional(Type.String()),
                                    value: Type.Optional(Type.Number())
                                })
                            )
                        })
                    )
                })
            )
        )
    })
]);
type ComputeDriftResponseType = Static<typeof ComputeDriftResponse>;

const LicenseDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        sqlServerInstances: Type.Optional(
            Type.Array(
                Type.Object({
                    sqlServerInstance: Type.String(),
                    sqlServerState: Type.String(),
                    sqlServerVersion: Type.Optional(Type.String()),
                    sqlServerProductYear: Type.Optional(Type.Number()),
                    sqlServerEdition: Type.Optional(Type.String()),
                    sqlServerEngineEdition: Type.Optional(Type.Number()),
                    sqlServerName: Type.Optional(Type.String())
                })
            )
        )
    })
]);
type LicenseDriftResponseType = Static<typeof LicenseDriftResponse>;

const HostOsPatchDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
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
    kbId: Type.String(),
    severity: Type.String(),
    state: Type.String(),
    title: Type.String()
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

const MSSQLPatchMissingPatch = Type.Object({
    classification: Type.Optional(Type.String()),
    severity: Type.Optional(Type.String()),
    releaseDate: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    kbId: Type.Optional(Type.String())
});

const MSSQLPatchScanInstance = Type.Object({
    ec2InstanceId: Type.String(),
    missingPatchDetails: Type.Optional(Type.Array(MSSQLPatchMissingPatch))
});

const MSSQLPatchScanResponse = Type.Object({
    status: Type.Enum(AssessmentStatus),
    ec2InstancesToPatch: Type.Array(MSSQLPatchScanInstance)
});
type MSSQLPatchScanResponseType = Static<typeof MSSQLPatchScanResponse>;

const MssqlPatchScanFields = [AssessmentCategories.MSSQL_PATCH, AssessmentCategories.HOST_OS_PATCH];

const MssqlPatchScanField = Type.Enum(MssqlPatchScanFields, {
    description: `Assessment category to calculate on demand. Allowed values: ${MssqlPatchScanFields.join(', ')}.`
});
type MssqlPatchScanFieldType = Static<typeof MssqlPatchScanField>;

const MSSQLPatchDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        missingPatchesInEc2Instances: Type.Optional(
            Type.Array(
                Type.Object({
                    criticalMissingPatchesCount: Type.Number(),
                    importantMissingPatchesCount: Type.Number(),
                    ec2InstanceId: Type.String(),
                    ec2InstanceName: Type.String(),
                    missingPatchesCount: Type.Number()
                })
            )
        )
    })
]);
type MSSQLPatchDriftResponseType = Static<typeof MSSQLPatchDriftResponse>;

const CloneDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        cloneDetails: Type.Optional(Type.Array(CloneDetails)),
        oldCloneDetails: Type.Optional(Type.Array(CloneDetails)),
        cloneDriftMessage: Type.Optional(Type.String())
    })
]);
type CloneDriftResponseType = Static<typeof CloneDriftResponse>;

const MtuAlignmentDriftResponse = Type.Intersect([
    GenericParameterDriftResponse,
    Type.Object({
        ec2InterfacesToFix: Type.Optional(
            Type.Array(
                Type.Object({
                    ec2InstanceId: Type.String(),
                    name: Type.String(),
                    currentMTU: Type.Number(),
                    recommendedMTU: Type.Number(),
                    interfaceIndex: Type.Number()
                })
            )
        )
    })
]);
type MtuAlignmentDriftResponseType = Static<typeof MtuAlignmentDriftResponse>;

/** SQL Server instance details carried by the sql-license assessment. */
const SqlServerInstanceInfo = Type.Object({
    sqlServerInstance: Type.Optional(Type.String()),
    sqlServerState: Type.Optional(Type.String()),
    sqlServerVersion: Type.Optional(Type.String()),
    sqlServerProductYear: Type.Optional(Type.Number()),
    sqlServerEdition: Type.Optional(Type.String()),
    sqlServerEngineEdition: Type.Optional(Type.Number()),
    sqlServerName: Type.Optional(Type.String())
});

/** EC2 instance carried by host-os-patch assessments. */
const Ec2InstanceToPatch = Type.Object({
    baselineId: Type.Optional(Type.String()),
    criticalNonCompliantCount: Type.Optional(Type.Number()),
    otherNonCompliantCount: Type.Optional(Type.Number()),
    ec2InstanceId: Type.String(),
    ec2InstanceName: Type.Optional(Type.String()),
    operationStartTime: Type.Optional(Type.Number()),
    operationEndTime: Type.Optional(Type.Number()),
    securityNonCompliantCount: Type.Optional(Type.Number())
});

/** Network adapter carried by the rss-config assessment. */
const RssAdapterDetail = Type.Object({
    adapterName: Type.String(),
    rssEnabled: Type.Boolean(),
    rssProfile: Type.String(),
    baseProcessorNumber: Type.Optional(Type.Number()),
    numberOfReceiveQueues: Type.Number()
});

const RecommendedAdapterSettings = Type.Object({
    recommendedRssProfile: Type.Optional(Type.String()),
    recommendedBaseProcessorNumber: Type.Optional(Type.Number()),
    recommendedReceiveQueues: Type.Optional(Type.Number())
});

/** Network interface carried by the mtu-alignment assessment. */
const Ec2InterfaceToFix = Type.Object({
    ec2InstanceId: Type.Optional(Type.String()),
    name: Type.String(),
    currentMTU: Type.Number(),
    recommendedMTU: Type.Number(),
    interfaceIndex: Type.Number()
});

/** EC2 instance carried by the mssql-patch assessment. */
const MissingPatchInEc2Instance = Type.Object({
    criticalMissingPatchesCount: Type.Optional(Type.Number()),
    importantMissingPatchesCount: Type.Optional(Type.Number()),
    ec2InstanceId: Type.String(),
    ec2InstanceName: Type.Optional(Type.String()),
    missingPatchesCount: Type.Optional(Type.Number())
});

const SizingViolations = Type.Optional(
    Type.Object(
        {
            overProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            underProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            ignoredDrives: Type.Optional(Type.Array(SizingViolationResponse))
        },
        { description: 'storage-sizing (tempdb-drive-size, log-drive-size)' }
    )
);

const RecommendationOptions = Type.Optional(
    Type.Array(
        Type.Object({
            instanceType: Type.Optional(Type.String()),
            rank: Type.Optional(Type.Number()),
            savingsOpportunity: Type.Optional(
                Type.Object({
                    savingsOpportunityPercentage: Type.Optional(Type.Number()),
                    estimatedMonthlySavings: Type.Optional(
                        Type.Object({
                            currency: Type.Optional(Type.String()),
                            value: Type.Optional(Type.Number())
                        })
                    )
                })
            ),
            platformDifferences: Type.Optional(Type.Array(Type.String()))
        }),
        { description: 'EC2 instance type recommendations with cost savings' }
    )
);

/** MSSQL-specific assessment item with storage sizing and compute/license/patch properties. */
const MssqlAssessmentItem = Type.Intersect([
    BaseAssessmentItem,
    Type.Object({
        sizingViolations: SizingViolations,
        recommendationOptions: RecommendationOptions,
        sqlServerInstances: Type.Optional(
            Type.Array(SqlServerInstanceInfo, { description: 'SQL Server instances and their license information' })
        ),
        ec2InstancesToPatch: Type.Optional(
            Type.Array(Ec2InstanceToPatch, { description: 'EC2 instances requiring OS patches' })
        ),
        rssAdapters: Type.Optional(
            Type.Array(RssAdapterDetail, { description: 'Network adapters and their RSS configuration' })
        ),
        recommendedAdapterSettings: Type.Optional(RecommendedAdapterSettings),
        tcpOffloadState: Type.Optional(Type.String({ description: 'TCP offload state for network optimization' })),
        ec2InterfacesToFix: Type.Optional(
            Type.Array(Ec2InterfaceToFix, { description: 'Network interfaces requiring MTU alignment' })
        ),
        missingPatchesInEc2Instances: Type.Optional(
            Type.Array(MissingPatchInEc2Instance, { description: 'MSSQL patches missing in EC2 instances' })
        ),
        missingPatchesCount: Type.Optional(Type.Number({ description: 'Count of missing security patches' }))
    })
]);
type MssqlAssessmentItemType = Static<typeof MssqlAssessmentItem>;

/** MSSQL-specific assessment response that preserves all MSSQL-specific assessment fields. */
const MssqlAssessmentResponse = Type.Object({
    assessments: Type.Array(Type.Union([MssqlAssessmentItem, AssessmentErrorItem])),
    dismissedConfigurations: Type.Array(DismissedConfiguration),
    metadata: AssessmentMetadata
});
type MssqlAssessmentResponseType = Static<typeof MssqlAssessmentResponse>;

// v1 omits the v2-only `id`/`categories` fields (renamed to `name`/`tags` in v1). Derive v1 item
// schemas from their v2 counterparts via `Type.Omit` so the strict v2 schemas stay intact.
const ParameterDriftResponseV1 = Type.Omit(ParameterDriftResponse, ['id', 'categories']);
const ComputeDriftResponseV1 = Type.Omit(ComputeDriftResponse, ['id', 'categories']);
const LicenseDriftResponseV1 = Type.Omit(LicenseDriftResponse, ['id', 'categories']);
const HostOsPatchDriftResponseV1 = Type.Omit(HostOsPatchDriftResponse, ['id', 'categories']);
const RssConfigDriftResponseV1 = Type.Omit(RssConfigDriftResponse, ['id', 'categories']);
const MSSQLPatchDriftResponseV1 = Type.Omit(MSSQLPatchDriftResponse, ['id', 'categories']);
const MtuAlignmentDriftResponseV1 = Type.Omit(MtuAlignmentDriftResponse, ['id', 'categories']);
const CloneDriftResponseV1 = Type.Omit(CloneDriftResponse, ['id', 'categories']);
const StorageParameterErrorResponseV1 = Type.Omit(StorageParameterErrorResponse, ['id']);
const StorageParameterDriftResponseV1 = Type.Object({
    configuration: Type.Object({
        volumes: Type.Array(Type.Union([ParameterDriftResponseV1, ErrorResponse])),
        luns: Type.Array(Type.Union([ParameterDriftResponseV1, ErrorResponse])),
        os: Type.Array(Type.Union([ParameterDriftResponseV1, StorageParameterErrorResponseV1]))
    }),
    sizing: Type.Array(Type.Union([ParameterDriftResponseV1, StorageParameterErrorResponseV1])),
    layout: Type.Array(Type.Union([ParameterDriftResponseV1, StorageParameterErrorResponseV1])),
    fileSystems: Type.Array(Type.String())
});

const MssqlAssessmentResponseV1 = Type.Object({
    storage: Type.Optional(Type.Union([StorageParameterDriftResponseV1, ErrorResponse])),
    compute: Type.Optional(Type.Union([ComputeDriftResponseV1, ErrorResponse])),
    snapshotPolicy: Type.Optional(GenericAssessmentResponseV1),
    crr: Type.Optional(GenericAssessmentResponseV1),
    awsBackup: Type.Optional(GenericAssessmentResponseV1),
    highAvailability: Type.Optional(Type.Array(Type.Union([ParameterDriftResponseV1, ErrorResponse]))),
    license: Type.Optional(Type.Union([LicenseDriftResponseV1, ErrorResponse])),
    hostOsPatch: Type.Optional(Type.Union([HostOsPatchDriftResponseV1, ErrorResponse])),
    rssConfig: Type.Optional(Type.Union([RssConfigDriftResponseV1, ErrorResponse])),
    maxDOP: Type.Optional(Type.Union([ParameterDriftResponseV1, ErrorResponse])),
    mssqlPatch: Type.Optional(Type.Union([MSSQLPatchDriftResponseV1, ErrorResponse])),
    mtuAlignment: Type.Optional(Type.Union([MtuAlignmentDriftResponseV1, ErrorResponse])),
    clone: Type.Optional(Type.Union([CloneDriftResponseV1, ErrorResponse])),
    lastAssessmentTimestamp: Type.Optional(Type.Number()),
    dismissedConfigurations: Type.Optional(DismissedConfigurationsResponse),
    fileSystemId: Type.Optional(Type.String()),
    storageEndpoint: Type.Optional(Type.String()),
    ec2InstanceId: Type.Optional(Type.String()),
    databaseInstanceName: Type.Optional(Type.String()),
    deploymentType: Type.Optional(Type.String()),
    baseDeploymentType: Type.Optional(Type.String()),
    replicaRole: Type.Optional(Type.String()),
    databaseHostName: Type.Optional(Type.String())
});

type MssqlAssessmentResponseV1Type = Static<typeof MssqlAssessmentResponseV1>;

const DriftAssessmentResponsePerInstance = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(MssqlAssessmentResponse),
    error: Type.Optional(Type.String())
});

const DriftAssessmentResponsePerHost = Type.Object({
    databaseHostId: Type.String({ minLength: 1 }),
    databaseHostName: Type.String(),
    instancesAssessment: Type.Array(DriftAssessmentResponsePerInstance)
});

type DriftAssessmentResponsePerHostType = Static<typeof DriftAssessmentResponsePerHost>;

const DriftAssessmentResponsePerInstanceV1 = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(MssqlAssessmentResponseV1),
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

const OptimizeStorageRequestBody = Type.Object({
    assessments: Type.Optional(Type.Array(OptimizeStorageRequestParams))
});

type OptimizeStorageRequestBodyType = Static<typeof OptimizeStorageRequestBody>;

const BulkOptimizePerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1 }),
    instances: Type.Array(
        Type.Object({
            id: Type.String({ minLength: 1 }),
            configurations: Type.Array(OptimizeStorageRequestParams)
        })
    )
});

const SnapshotSchedule = Type.Object({
    uuid: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    cron: Type.Optional(
        Type.Object({
            hours: Type.Optional(Type.Array(Type.Number())),
            minutes: Type.Optional(Type.Array(Type.Number())),
            weekdays: Type.Optional(Type.Array(Type.Number())),
            months: Type.Optional(Type.Array(Type.Number())),
            days: Type.Optional(Type.Array(Type.Number()))
        })
    ),
    retention: Type.Optional(Type.String()),
    interval: Type.Optional(Type.String())
});
type SnapshotScheduleType = Static<typeof SnapshotSchedule>;

const SnapshotPolicyDetails = Type.Object({
    uuid: Type.String(),
    name: Type.String(),
    schedules: Type.Optional(Type.Array(SnapshotSchedule))
});
type SnapshotPolicyDetailsType = Static<typeof SnapshotPolicyDetails>;

const SnapshotPolicy = Type.Object({
    uuid: Type.String(),
    name: Type.String()
});
type SnapshotPolicyType = Static<typeof SnapshotPolicy>;

const AvailableSnapshotPoliciesResponse = Type.Object({
    snapshotPolicies: Type.Optional(Type.Array(SnapshotPolicyDetails)),
    errorMessage: Type.Optional(Type.String())
});

type AvailableSnapshotPoliciesResponseType = Static<typeof AvailableSnapshotPoliciesResponse>;

const BulkOptimizeSnapshotPolicyRequestBody = Type.Object({
    snapshotPolicy: SnapshotPolicy,
    volumes: Type.Optional(Type.Array(OntapVolume))
});

const OptimizeResiliencyBody = Type.Object({
    configurationName: Type.Array(Type.Enum(OPTIMIZE_RESILIENCY_CONFIGS)),
    params: Type.Optional(Type.Array(Type.Union([BulkOptimizeSnapshotPolicyRequestBody])))
});
type OptimizeResiliencyBodyType = Static<typeof OptimizeResiliencyBody>;

type BulkOptimizePerHostRequestBodyType = Static<typeof BulkOptimizePerHostRequestBody>;

const BulkOptimizeStorageRequestBody = Type.Object({
    databaseHosts: Type.Array(BulkOptimizePerHostRequestBody)
});

type BulkOptimizeStorageRequestBodyType = Static<typeof BulkOptimizeStorageRequestBody>;

const OptimizeComputeRequestBody = Type.Object({
    instanceType: Type.String()
});

type OptimizeComputeRequestBodyType = Static<typeof OptimizeComputeRequestBody>;
const OptimizeSizingRequestBody = Type.Object({
    configurationName: Type.Array(Type.Enum(OPTIMIZE_SIZING_CONFIGS))
});

type OptimizeSizingRequestBodyType = Static<typeof OptimizeSizingRequestBody>;

const BaseOptimizePerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1 }),
    sqlServerInstances: Type.Array(Type.String({ minLength: 1 })),
    credentialsId: Type.String(),
    region: Type.String(),
    instanceType: Type.Optional(Type.String()),
    networkAdapters: Type.Optional(Type.Array(Type.String()))
});

// For MTU optimization - only requires interfaceNames, no FSx/backup fields
const MTUOptimizePerHostRequestBody = Type.Intersect([
    Type.Omit(BaseOptimizePerHostRequestBody, ['networkAdapters', 'instanceType']),
    Type.Object({
        interfaceNames: Type.Array(Type.String())
    })
]);

// For AWS backup optimization - requires FSx/backup fields, no interfaceNames
const BackupOptimizePerHostRequestBody = Type.Intersect([BaseOptimizePerHostRequestBody, FsxBackupOptimizationFields]);

// General type for other optimizations - includes all optional fields
const OptimizePerHostRequestBody = Type.Intersect([
    BaseOptimizePerHostRequestBody,
    Type.Object({
        interfaceNames: Type.Optional(Type.Array(Type.String()))
    }),
    FsxBackupOptimizationFields
]);

type OptimizePerHostRequestBodyType = Static<typeof OptimizePerHostRequestBody>;
type MTUOptimizePerHostRequestBodyType = Static<typeof MTUOptimizePerHostRequestBody>;
type BackupOptimizePerHostRequestBodyType = Static<typeof BackupOptimizePerHostRequestBody>;

const OptimizeOperatingSystemRequestBody = Type.Object({
    configurationName: Type.String({ enum: Object.values(OptimizeOperatingSystemParams) })
});

const OptimizeGenericRequestBody = Type.Object({
    configurationName: Type.Enum({
        ...OPTIMIZE_SIZING_CONFIGS,
        ...OptimizeStorageTierParams
    }),
    objectsToOptimize: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
});

const DriftAssessmentResponsePerAccount = Type.Object({
    count: Type.Number(),
    assessmentsPerAccount: Type.Array(DriftAssessmentResponsePerHost),
    nextToken: Type.Optional(Type.String())
});

const BulkOptimizeGeneralPerHostRequestBody = Type.Object({
    configurationName: Type.Enum({
        ...OPTIMIZE_SIZING_CONFIGS,
        ...OptimizeOperatingSystemParams,
        ...OptimizeStorageTierParams,
        ...OptimizeComputeParams,
        ...OptimizeMaxDopParams,
        ...OPTIMIZE_RESILIENCY_CONFIGS,
        ...OptimizeHighAvailabilityParams
    }),
    databaseHosts: Type.Array(OptimizePerHostRequestBody)
});

const BulkOptimizeMTUPerHostRequestBody = Type.Object({
    configurationName: Type.Literal('mtu-alignment'),
    databaseHosts: Type.Array(MTUOptimizePerHostRequestBody)
});

const BulkOptimizeBackupPerHostRequestBody = Type.Object({
    configurationName: Type.Literal('aws-backup'),
    databaseHosts: Type.Array(BackupOptimizePerHostRequestBody)
});

type BulkOptimizeGeneralPerHostRequestBodyType = Static<typeof BulkOptimizeGeneralPerHostRequestBody>;
type BulkOptimizeMTUPerHostRequestBodyType = Static<typeof BulkOptimizeMTUPerHostRequestBody>;
type BulkOptimizeBackupPerHostRequestBodyType = Static<typeof BulkOptimizeBackupPerHostRequestBody>;

const BulkOptimizeGeneralRequestBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeGeneralPerHostRequestBody)
});

const BulkOptimizeMTURequestBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeMTUPerHostRequestBody)
});

const BulkOptimizeBackupRequestBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeBackupPerHostRequestBody)
});

type BulkOptimizeGeneralRequestBodyType = Static<typeof BulkOptimizeGeneralRequestBody>;
type BulkOptimizeMTURequestBodyType = Static<typeof BulkOptimizeMTURequestBody>;
type BulkOptimizeBackupRequestBodyType = Static<typeof BulkOptimizeBackupRequestBody>;

const BulkOptimizeSnapshotPolicyParams = Type.Object({
    fsxId: Type.String(),
    region: Type.String(),
    volUuids: Type.String(),
    apiBody: Type.String()
});
type BulkOptimizeSnapshotPolicyParamsType = Static<typeof BulkOptimizeSnapshotPolicyParams>;

const BulkOptimizeComputePerHostRequestBody = Type.Object({
    configurationName: Type.Enum({
        ...OptimizeComputeParams
    }),
    databaseHosts: Type.Array(OptimizePerHostRequestBody)
});
type BulkOptimizeComputePerHostRequestBodyType = Static<typeof BulkOptimizeComputePerHostRequestBody>;

const BulkOptimizeComputeRequestBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeComputePerHostRequestBody)
});
type BulkOptimizeComputeRequestBodyType = Static<typeof BulkOptimizeComputeRequestBody>;

const DatabaseHostsWithInstancesBody = Type.Object({
    id: Type.String({ minLength: 1 }),
    sqlServerInstances: Type.Array(Type.String({ minLength: 1 })),
    credentialsId: Type.String(),
    region: Type.String()
});

const DatabaseHostsWithInstances = Type.Intersect([
    DatabaseHostsWithInstancesBody,
    Type.Object({
        status: Type.Optional(Type.String()),
        failedInstances: Type.Optional(
            Type.Array(
                Type.Object({
                    databaseHostId: Type.String(),
                    instanceId: Type.Optional(Type.String()),
                    errorMessage: Type.String()
                })
            )
        )
    })
]);

const BulkDismissConfigurationRequestBody = Type.Object({
    configurationsToDismiss: Type.Array(
        Type.Object({
            configurationName: Type.String(),
            configState: Type.Enum(DISMISS_STATUS_ENUM),
            databaseHosts: Type.Array(DatabaseHostsWithInstancesBody)
        })
    )
});

type BulkDismissConfigurationRequestBodyType = Static<typeof BulkDismissConfigurationRequestBody>;

const BulkDismissConfigurationResponse = Type.Object({
    dismissedConfigurations: Type.Array(
        Type.Object({
            configurationName: Type.String(),
            configState: Type.String(),
            startTime: Type.Number(),
            endTime: Type.Optional(Type.Number()),
            databaseHosts: Type.Array(DatabaseHostsWithInstances)
        })
    )
});

type BulkDismissConfigurationResponseType = Static<typeof BulkDismissConfigurationResponse>;

const CloneDetail = Type.Object({
    cloneDatabaseName: Type.String(),
    clonedBy: Type.String(),
    action: Type.String({ enum: [CLONE_ACTION.REFRESH, CLONE_ACTION.DELETE] })
});

const OptimizeClonesPerHostRequestBody = Type.Object({
    id: Type.String({ minLength: 1 }),
    region: Type.String(),
    credentialsId: Type.String(),
    sqlServerInstances: Type.Array(
        Type.Object({
            instanceId: Type.String(),
            clones: Type.Array(CloneDetail)
        })
    )
});

type OptimizeClonesPerHostRequestBodyType = Static<typeof OptimizeClonesPerHostRequestBody>;
type CloneDetailType = Static<typeof CloneDetail>;

const BulkOptimizeCloneInHostRequestBody = Type.Object({
    configurationName: Type.Enum({
        ...OptimizeCloneParams
    }),
    databaseHosts: Type.Array(OptimizeClonesPerHostRequestBody)
});
type BulkOptimizeCloneInHostRequestBodyType = Static<typeof BulkOptimizeCloneInHostRequestBody>;

const BulkOptimizeCloneBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeCloneInHostRequestBody)
});
type BulkOptimizeCloneBodyType = Static<typeof BulkOptimizeCloneBody>;

const OptimizeHASharedStorageRequestBody = Type.Object({
    id: Type.String({ minLength: 1 }),
    sqlServerInstances: Type.Array(
        Type.Object({
            databaseInstanceId: Type.String({ minLength: 1 }),
            ontapLunPaths: Type.Array(Type.String({ minLength: 1 }))
        })
    ),
    credentialsId: Type.String({ minLength: 1 }),
    region: Type.String({ minLength: 1 })
});
type OptimizeHASharedStorageRequestBodyType = Static<typeof OptimizeHASharedStorageRequestBody>;

const BulkOptimizeHASharedStorageRequestBody = Type.Object({
    configurationName: Type.Enum(OptimizeHighAvailabilityParams),
    databaseHosts: Type.Array(OptimizeHASharedStorageRequestBody)
});

type BulkOptimizeHASharedStorageRequestBodyType = Static<typeof BulkOptimizeHASharedStorageRequestBody>;

const BulkOptimizeHASharedStorageBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeHASharedStorageRequestBody)
});
type BulkOptimizeHASharedStorageBodyType = Static<typeof BulkOptimizeHASharedStorageBody>;

export {
    MssqlAssessmentItem,
    MssqlAssessmentItemType,
    MssqlAssessmentResponse,
    MssqlAssessmentResponseType,
    ComputeDriftResponseType,
    LicenseDriftResponseType,
    HostOsPatchDriftResponse,
    HostOsPatchDriftResponseType,
    HostOsPatchScanResponse,
    HostOsPatchScanResponseType,
    MSSQLPatchScanResponse,
    MSSQLPatchScanResponseType,
    RssConfigDriftResponseType,
    MtuAlignmentDriftResponseType,
    ParameterDriftResponse,
    ParameterDriftResponseType,
    StorageParameterDriftResponseType,
    SizingViolationResponseType,
    OptimizeStorageRequestBody,
    OptimizeStorageRequestBodyType,
    OptimizeComputeRequestBody,
    OptimizeComputeRequestBodyType,
    OptimizeSizingRequestBody,
    OptimizeSizingRequestBodyType,
    OptimizeOperatingSystemRequestBody,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerAccount,
    MSSQLPatchDriftResponseType,
    SnapshotSchedule,
    SnapshotScheduleType,
    SnapshotPolicy,
    SnapshotPolicyType,
    SnapshotPolicyDetails,
    SnapshotPolicyDetailsType,
    AvailableSnapshotPoliciesResponse,
    AvailableSnapshotPoliciesResponseType,
    BulkOptimizeSnapshotPolicyRequestBody,
    BulkOptimizeStorageRequestBody,
    BulkOptimizeStorageRequestBodyType,
    BulkOptimizePerHostRequestBodyType,
    BulkOptimizeGeneralRequestBody,
    BulkOptimizeGeneralRequestBodyType,
    BulkOptimizeMTURequestBody,
    BulkOptimizeMTURequestBodyType,
    BulkOptimizeBackupRequestBody,
    BulkOptimizeBackupRequestBodyType,
    MTUOptimizePerHostRequestBody,
    MTUOptimizePerHostRequestBodyType,
    BackupOptimizePerHostRequestBody,
    BackupOptimizePerHostRequestBodyType,
    OptimizePerHostRequestBody,
    OptimizePerHostRequestBodyType,
    BulkOptimizeGeneralPerHostRequestBodyType,
    OptimizeResiliencyBodyType,
    OptimizeResiliencyBody,
    BulkOptimizeSnapshotPolicyParams,
    BulkOptimizeSnapshotPolicyParamsType,
    BulkOptimizeComputePerHostRequestBodyType,
    BulkOptimizeComputePerHostRequestBody,
    BulkOptimizeComputeRequestBody,
    BulkOptimizeComputeRequestBodyType,
    OptimizeGenericRequestBody,
    CloneDriftResponseType,
    BulkOptimizeCloneBodyType,
    BulkOptimizeCloneInHostRequestBodyType,
    BulkOptimizeCloneBody,
    OptimizeClonesPerHostRequestBodyType,
    CloneDetailType,
    BulkDismissConfigurationRequestBodyType,
    BulkDismissConfigurationResponseType,
    BulkDismissConfigurationRequestBody,
    BulkDismissConfigurationResponse,
    DriftAssessmentResponsePerHostType,
    DriftAssessmentResponsePerInstanceV1,
    DriftAssessmentResponsePerHostV1,
    DriftAssessmentResponsePerAccountV1,
    DriftAssessmentResponsePerAccountV1Type,
    BulkOptimizeHASharedStorageBody,
    BulkOptimizeHASharedStorageBodyType,
    OptimizeHASharedStorageRequestBodyType,
    OptimizeHASharedStorageRequestBody,
    BulkOptimizeHASharedStorageRequestBodyType,
    BulkOptimizeMTUPerHostRequestBodyType,
    BulkOptimizeBackupPerHostRequestBodyType,
    MssqlPatchScanField,
    MssqlPatchScanFieldType,
    MssqlAssessmentResponseV1,
    MssqlAssessmentResponseV1Type
};
