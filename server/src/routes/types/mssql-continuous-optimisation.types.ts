import { Static, Type } from '@fastify/type-provider-typebox';
import {
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
    DismissedConfigurationsResponse,
    ErrorResponse,
    GenericAssessmentResponse,
    GenericParameterDriftResponse,
    OntapVolume
} from './continuous-optimization.types';
import { CLONE_ACTION } from '../../utils/consts';

const CloneDetails = Type.Object({
    databaseHostName: Type.String(),
    databaseHostId: Type.String(),
    databaseInstanceName: Type.String(),
    sourceDatabaseHostName: Type.Optional(Type.String()),
    sourceDatabaseInstanceName: Type.Optional(Type.String()),
    sourceDatabaseName: Type.Optional(Type.String()),
    cloneDatabaseName: Type.Optional(Type.String()),
    cloneSize: Type.Optional(Type.Number()),
    cloneAge: Type.Optional(Type.Number()),
    clonedBy: Type.Optional(Type.String()),
    tags: Type.Optional(Type.String()),
    clonedVolumeDetails: Type.Optional(
        Type.Array(
            Type.Object({
                cloneVolumeUuid: Type.Optional(Type.String()),
                cloneVolumeName: Type.Optional(Type.String()),
                cloneVolumeCreateTime: Type.Optional(Type.String()),
                sourceVolumeName: Type.Optional(Type.String()),
                cloneDatabaseName: Type.Optional(Type.String()),
                cloneVolumeType: Type.Optional(Type.String())
            })
        )
    )
});

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
                    securityNonCompliantCount: Type.Number(),
                    missingPatchDetails: Type.Optional(
                        Type.Array(
                            Type.Object({
                                classification: Type.String(),
                                kbId: Type.String(),
                                severity: Type.String(),
                                state: Type.String(),
                                title: Type.String()
                            })
                        )
                    )
                })
            )
        )
    })
]);
type HostOsPatchDriftResponseType = Static<typeof HostOsPatchDriftResponse>;

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
                    missingPatchesCount: Type.Number(),
                    missingPatchDetails: Type.Array(
                        Type.Object({
                            classification: Type.String(),
                            kbId: Type.String(),
                            severity: Type.String(),
                            releaseDate: Type.String(),
                            title: Type.String()
                        })
                    )
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

const MSSQLDriftAssessmentResponse = Type.Object({
    storage: Type.Optional(Type.Union([StorageParameterDriftResponse, ErrorResponse])),
    compute: Type.Optional(Type.Union([ComputeDriftResponse, ErrorResponse])),
    snapshotPolicy: Type.Optional(GenericAssessmentResponse),
    crr: Type.Optional(GenericAssessmentResponse),
    awsBackup: Type.Optional(GenericAssessmentResponse),
    highAvailability: Type.Optional(Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse]))),
    license: Type.Optional(Type.Union([LicenseDriftResponse, ErrorResponse])),
    hostOsPatch: Type.Optional(Type.Union([HostOsPatchDriftResponse, ErrorResponse])),
    rssConfig: Type.Optional(Type.Union([RssConfigDriftResponse, ErrorResponse])),
    maxDOP: Type.Optional(Type.Union([ParameterDriftResponse, ErrorResponse])),
    mssqlPatch: Type.Optional(Type.Union([MSSQLPatchDriftResponse, ErrorResponse])),
    mtuAlignment: Type.Optional(Type.Union([MtuAlignmentDriftResponse, ErrorResponse])),
    clone: Type.Optional(Type.Union([CloneDriftResponse, ErrorResponse])),
    lastAssessmentTimestamp: Type.Optional(Type.Number()),
    dismissedConfigurations: Type.Optional(DismissedConfigurationsResponse),
    fileSystemId: Type.Optional(Type.String()),
    storageEndpoint: Type.Optional(Type.String()),
    ec2InstanceId: Type.Optional(Type.String()),
    databaseInstanceName: Type.Optional(Type.String()),
    deploymentType: Type.Optional(Type.String()),
    databaseHostName: Type.Optional(Type.String())
});

type MSSQLDriftAssessmentResponseType = Static<typeof MSSQLDriftAssessmentResponse>;

const DriftAssessmentResponsePerInstance = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(MSSQLDriftAssessmentResponse),
    error: Type.Optional(Type.String())
});

const DriftAssessmentResponsePerHost = Type.Object({
    databaseHostId: Type.String({ minLength: 1 }),
    databaseHostName: Type.String(),
    instancesAssessment: Type.Array(DriftAssessmentResponsePerInstance)
});

type DriftAssessmentResponsePerHostType = Static<typeof DriftAssessmentResponsePerHost>;

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

const UpdateFSxNBackupRequestBody = Type.Object({
    fsxFileSystemId: Type.Optional(Type.String()),
    backupRetentionDays: Type.Optional(Type.Number({ minimum: 1, maximum: 90 })),
    backupStartTime: Type.Optional(
        Type.String({
            description: '00:00 to 23:59 padded UTC timestamp',
            pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
        })
    )
});

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
const BackupOptimizePerHostRequestBody = Type.Intersect([BaseOptimizePerHostRequestBody, UpdateFSxNBackupRequestBody]);

// General type for other optimizations - includes all optional fields
const OptimizePerHostRequestBody = Type.Intersect([
    BaseOptimizePerHostRequestBody,
    Type.Object({
        interfaceNames: Type.Optional(Type.Array(Type.String()))
    }),
    UpdateFSxNBackupRequestBody
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
    MSSQLDriftAssessmentResponse,
    MSSQLDriftAssessmentResponseType,
    ComputeDriftResponseType,
    LicenseDriftResponseType,
    HostOsPatchDriftResponseType,
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
    BulkOptimizeHASharedStorageBody,
    BulkOptimizeHASharedStorageBodyType,
    OptimizeHASharedStorageRequestBodyType,
    OptimizeHASharedStorageRequestBody,
    BulkOptimizeHASharedStorageRequestBodyType,
    BulkOptimizeMTUPerHostRequestBodyType,
    BulkOptimizeBackupPerHostRequestBodyType
};
