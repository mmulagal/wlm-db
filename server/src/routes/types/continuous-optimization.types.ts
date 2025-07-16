import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    DISMISS_STATUS_ENUM,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeCloneParams,
    OptimizeComputeParams,
    OptimizeMaxDopParams,
    OptimizeOperatingSystemParams,
    OptimizeStorageConfigs,
    OptimizeStorageTierParams
} from '../../utils/continous-optimization-consts';
import { CLONE_ACTION } from '../../utils/consts';

const allowedFields = Object.values(AssessmentCategories);
// Query parameter to fetch database, protection
const ContinuousOptimizationQueryString = Type.Object({
    fields: Type.Optional(
        Type.String({
            description: `Comma separated list of fields to include in the response. Allowed fields: ${allowedFields.join(
                ', '
            )}`,
            pattern: `^(${allowedFields.join('|')})(,(${allowedFields.join('|')}))*$`
        })
    ),
    nextToken: Type.Optional(Type.String())
});

const AssessmentQueryStringPerAccount = Type.Composite([
    ContinuousOptimizationQueryString,
    Type.Object({
        pageSize: Type.Optional(Type.Integer())
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
    tempdbAccessPath: Type.Optional(Type.String()),
    tempdbDriveTotalSizeMB: Type.Optional(Type.Number()),
    diskSerialNumber: Type.Optional(Type.String()),
    sizePercentToDataDrive: Type.Optional(Type.Number())
});
type SizingViolationResponseType = Static<typeof SizingViolationResponse>;

const GenericViolationResponse = Type.Object({
    objectName: Type.String(),
    value: Type.String(),
    objectType: Type.String()
});

type GenericViolationResponseType = Static<typeof GenericViolationResponse>;

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

const OntapVolume = Type.Object({
    ontapVolumeName: Type.Optional(Type.String()),
    ontapVolumeUuid: Type.Optional(Type.String())
});
type OntapVolumeType = Static<typeof OntapVolume>;

const ErrorResponse = Type.Object({ errorMessage: Type.String() });
const ParameterDriftResponse = Type.Object({
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
    sizingViolations: Type.Optional(
        Type.Object({
            overProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            underProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            ignoredDrives: Type.Optional(Type.Array(SizingViolationResponse))
        })
    ),
    violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
    tags: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    current: Type.Optional(Type.String()),
    totalObjectsAssessed: Type.Optional(Type.Number()),
    totalObjectsInViolation: Type.Optional(Type.Number()),
    resourceType: Type.Optional(Type.String())
});
type ParameterDriftResponseType = Static<typeof ParameterDriftResponse>;

const GenericAssessmentResponse = Type.Union([ParameterDriftResponse, ErrorResponse]);
type GenericAssessmentResponseType = Static<typeof GenericAssessmentResponse>;

const AdditionalComputeParameterDriftResponse = Type.Optional(
    Type.Object({
        recommendationOptions: Type.Array(
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
    })
);

const AdditionalLicenseParameterDriftResponse = Type.Optional(
    Type.Object({
        sqlServerInstances: Type.Array(
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
    })
);

const AdditionalHostOsParameterDriftResponse = Type.Optional(
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
);

const AdditionalMSSQLPatchParameterDriftResponse = Type.Optional(
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
);

const AdditionalRssConfigParameterDriftResponse = Type.Optional(
    Type.Object({
        rssAdapters: Type.Array(
            Type.Object({
                adapterName: Type.String(),
                rssEnabled: Type.Boolean(),
                rssProfile: Type.String(),
                baseProcessorNumber: Type.Number({ nullable: true }),
                numberOfReceiveQueues: Type.Number()
            })
        ),
        recommendedAdapterSettings: Type.Optional(
            Type.Object({
                recommendedRssProfile: Type.String(),
                recommendedBaseProcessorNumber: Type.Number(),
                recommendedReceiveQueues: Type.Number()
            })
        ),
        tcpOffloadState: Type.String()
    })
);

const AdditionalCloneParameterDriftResponse = Type.Optional(
    Type.Object({
        cloneDetails: Type.Optional(Type.Array(CloneDetails)),
        oldCloneDetails: Type.Optional(Type.Array(CloneDetails)),
        cloneDriftMessage: Type.Optional(Type.String())
    })
);

const ComputeDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalComputeParameterDriftResponse]);
type ComputeDriftResponseType = Static<typeof ComputeDriftResponse>;

const LicenseDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalLicenseParameterDriftResponse]);
type LicenseDriftResponseType = Static<typeof LicenseDriftResponse>;

const HostOsPatchDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalHostOsParameterDriftResponse]);
type HostOsPatchDriftResponseType = Static<typeof HostOsPatchDriftResponse>;

const RssConfigDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalRssConfigParameterDriftResponse]);
type RssConfigDriftResponseType = Static<typeof RssConfigDriftResponse>;

const MSSQLPatchDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalMSSQLPatchParameterDriftResponse]);
type MSSQLPatchDriftResponseType = Static<typeof MSSQLPatchDriftResponse>;

const CloneDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalCloneParameterDriftResponse]);
type CloneDriftResponseType = Static<typeof CloneDriftResponse>;

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

// const HighAvailabilityDriftResponse = Type.Object({
//     highAvailability: Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse]))
// });

// type HighAvailabilityDriftResponseType = Static<typeof HighAvailabilityDriftResponse>;

const InstanceDismissResponse = Type.Object({
    configurationName: Type.String(),
    configState: Type.String(),
    endTime: Type.Optional(Type.Number())
});

const dismissedConfigurationsResponse = Type.Object({
    storage: Type.Optional(
        Type.Object({
            configuration: Type.Optional(
                Type.Object({
                    volumes: Type.Optional(Type.Array(InstanceDismissResponse)),
                    luns: Type.Optional(Type.Array(InstanceDismissResponse)),
                    os: Type.Optional(Type.Array(InstanceDismissResponse))
                })
            ),
            sizing: Type.Optional(Type.Array(InstanceDismissResponse)),
            layout: Type.Optional(Type.Array(InstanceDismissResponse))
        })
    ),
    compute: Type.Optional(InstanceDismissResponse),
    license: Type.Optional(InstanceDismissResponse),
    hostOsPatch: Type.Optional(InstanceDismissResponse),
    rssConfig: Type.Optional(InstanceDismissResponse),
    maxDOP: Type.Optional(InstanceDismissResponse),
    mssqlPatch: Type.Optional(InstanceDismissResponse),
    crr: Type.Optional(InstanceDismissResponse),
    clone: Type.Optional(InstanceDismissResponse),
    snapshotPolicy: Type.Optional(InstanceDismissResponse),
    awsBackup: Type.Optional(InstanceDismissResponse)
});
type dismissedConfigurationsResponseType = Static<typeof dismissedConfigurationsResponse>;

const DriftAssessmentResponse = Type.Object({
    storage: Type.Optional(Type.Union([StorageParameterDriftResponse, ErrorResponse])),
    compute: Type.Optional(Type.Union([ComputeDriftResponse, ErrorResponse])),
    license: Type.Optional(Type.Union([LicenseDriftResponse, ErrorResponse])),
    hostOsPatch: Type.Optional(Type.Union([HostOsPatchDriftResponse, ErrorResponse])),
    rssConfig: Type.Optional(Type.Union([RssConfigDriftResponse, ErrorResponse])),
    maxDOP: Type.Optional(Type.Union([ParameterDriftResponse, ErrorResponse])),
    mssqlPatch: Type.Optional(Type.Union([MSSQLPatchDriftResponse, ErrorResponse])),
    clone: Type.Optional(Type.Union([CloneDriftResponse, ErrorResponse])),
    snapshotPolicy: Type.Optional(GenericAssessmentResponse),
    crr: Type.Optional(GenericAssessmentResponse),
    awsBackup: Type.Optional(GenericAssessmentResponse),
    highAvailability: Type.Optional(Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse]))),
    lastAssessmentTimestamp: Type.Optional(Type.Number()),
    dismissedConfigurations: Type.Optional(dismissedConfigurationsResponse),
    fileSystemId: Type.Optional(Type.String()),
    ec2InstanceId: Type.Optional(Type.String()),
    databaseInstanceName: Type.Optional(Type.String())
});
type DriftAssessmentResponseType = Static<typeof DriftAssessmentResponse>;

const DriftAssessmentResponsePerInstance = Type.Object({
    databaseInstanceId: Type.String({ minLength: 1 }),
    databaseInstanceName: Type.String(),
    assessments: Type.Optional(DriftAssessmentResponse),
    error: Type.Optional(Type.String())
});

const DriftAssessmentResponsePerHost = Type.Object({
    databaseHostId: Type.String({ minLength: 1 }),
    databaseHostName: Type.String(),
    instancesAssessment: Type.Array(DriftAssessmentResponsePerInstance)
});

type DriftAssessmentResponsePerHostType = Static<typeof DriftAssessmentResponsePerHost>;

const OptimizeStorageRequestParams = Type.Object({
    configurationName: Type.String(Type.Enum(OptimizeStorageConfigs)),
    objectsToOptimize: Type.Array(Type.String({ minLength: 1 }))
});

const OptimizeStorageRequestBody = Type.Object({
    assessments: Type.Optional(Type.Array(OptimizeStorageRequestParams))
});

type OptimizeStorageRequestBodyType = Static<typeof OptimizeStorageRequestBody>;

type OptimizeStorageRequestParamsType = Static<typeof OptimizeStorageRequestParams>;

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

const OptimizePerHostRequestBody = Type.Intersect([
    Type.Object({
        id: Type.String({ minLength: 1 }),
        sqlServerInstances: Type.Array(Type.String({ minLength: 1 })),
        credentialsId: Type.String(),
        region: Type.String(),
        instanceType: Type.Optional(Type.String()),
        networkAdapters: Type.Optional(Type.Array(Type.String()))
    }),
    UpdateFSxNBackupRequestBody
]);

type OptimizePerHostRequestBodyType = Static<typeof OptimizePerHostRequestBody>;

const OptimizeOperatingSystemRequestBody = Type.Object({
    configurationName: Type.String(Type.Enum(OptimizeOperatingSystemParams))
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
        ...OPTIMIZE_RESILIENCY_CONFIGS
    }),
    databaseHosts: Type.Array(OptimizePerHostRequestBody)
});

type BulkOptimizeGeneralPerHostRequestBodyType = Static<typeof BulkOptimizeGeneralPerHostRequestBody>;

const BulkOptimizeGeneralRequestBody = Type.Object({
    hostsToOptimize: Type.Array(BulkOptimizeGeneralPerHostRequestBody)
});

type BulkOptimizeGeneralRequestBodyType = Static<typeof BulkOptimizeGeneralRequestBody>;

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

const BulkDismissConfiguration = Type.Object({
    configurationName: Type.String(),
    configState: Type.String(),
    databaseHosts: Type.Array(DatabaseHostsWithInstances)
});

type BulkDismissConfigurationType = Static<typeof BulkDismissConfiguration>;

const BulkDismissConfigurationBody = Type.Object({
    configurationName: Type.String(),
    configState: Type.Enum(DISMISS_STATUS_ENUM),
    databaseHosts: Type.Array(DatabaseHostsWithInstances)
});

type BulkDismissConfigurationBodyType = Static<typeof BulkDismissConfigurationBody>;

const BulkDismissConfigurationRequestBody = Type.Object({
    configurationsToDismiss: Type.Array(BulkDismissConfigurationBody)
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

export {
    DriftAssessmentResponse,
    DriftAssessmentResponseType,
    ParameterDriftResponseType,
    ComputeDriftResponseType,
    LicenseDriftResponseType,
    HostOsPatchDriftResponseType,
    RssConfigDriftResponseType,
    StorageParameterDriftResponseType,
    SizingViolationResponseType,
    OptimizeStorageRequestBody,
    OptimizeStorageRequestBodyType,
    OptimizeStorageRequestParamsType,
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
    OntapVolumeType,
    AvailableSnapshotPoliciesResponse,
    AvailableSnapshotPoliciesResponseType,
    BulkOptimizeSnapshotPolicyRequestBody,
    BulkOptimizeStorageRequestBody,
    BulkOptimizeStorageRequestBodyType,
    BulkOptimizePerHostRequestBodyType,
    BulkOptimizeGeneralRequestBody,
    BulkOptimizeGeneralRequestBodyType,
    OptimizePerHostRequestBody,
    OptimizePerHostRequestBodyType,
    BulkOptimizeGeneralPerHostRequestBodyType,
    GenericViolationResponseType,
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
    GenericAssessmentResponse,
    GenericAssessmentResponseType,
    BulkOptimizeCloneBodyType,
    BulkOptimizeCloneInHostRequestBodyType,
    BulkOptimizeCloneBody,
    OptimizeClonesPerHostRequestBodyType,
    CloneDetailType,
    BulkDismissConfigurationType,
    BulkDismissConfigurationRequestBodyType,
    BulkDismissConfigurationResponseType,
    BulkDismissConfigurationRequestBody,
    BulkDismissConfigurationResponse,
    dismissedConfigurationsResponseType,
    BulkDismissConfigurationBodyType,
    ContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    DriftAssessmentResponsePerHostType
    // HighAvailabilityDriftResponse,
    // HighAvailabilityDriftResponseType
};
