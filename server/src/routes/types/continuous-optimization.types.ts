import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeOperatingSystemParams,
    OptimizeStorageConfigs
} from '../../utils/continous-optimization-consts';

const SizingViolationResponse = Type.Object({
    dataAccessPath: Type.Optional(Type.String()),
    dataDriveTotalSizeMB: Type.Optional(Type.Number()),
    logAccessPath: Type.Optional(Type.String()),
    logDriveTotalSizeMB: Type.Optional(Type.Number()),
    svmName: Type.Optional(Type.String()),
    ontapVolumeName: Type.Optional(Type.String()),
    ontapVolumeUuid: Type.Optional(Type.String()),
    lunUuid: Type.Optional(Type.String()),
    tempdbAccessPath: Type.Optional(Type.String()),
    tempdbDriveTotalSizeMB: Type.Optional(Type.Number()),
    diskSerialNumber: Type.Optional(Type.String())
});
type SizingViolationResponseType = Static<typeof SizingViolationResponse>;

const ErrorResponse = Type.Object({ errorMessage: Type.String() });
const ParameterDriftResponse = Type.Object({
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.String())),
    sizingViolations: Type.Optional(
        Type.Object({
            overProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            underProvisionedDrives: Type.Optional(Type.Array(SizingViolationResponse)),
            ignoredDrives: Type.Optional(Type.Array(SizingViolationResponse))
        })
    ),
    tags: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    current: Type.Optional(Type.String())
});
type ParameterDriftResponseType = Static<typeof ParameterDriftResponse>;

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
                sqlServerVersion: Type.String(),
                sqlServerProductYear: Type.Number(),
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
                    otherNonCompliantCount: Type.Number(),
                    ec2InstanceId: Type.String(),
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

const AdditionalRssConfigParameterDriftResponse = Type.Optional(
    Type.Object({
        rssAdapters: Type.Array(
            Type.Object({
                adapterName: Type.String(),
                rssEnabled: Type.Boolean(),
                rssProfile: Type.String(),
                baseProcessorNumber: Type.Number(),
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

const ComputeDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalComputeParameterDriftResponse]);
type ComputeDriftResponseType = Static<typeof ComputeDriftResponse>;

const LicenseDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalLicenseParameterDriftResponse]);
type LicenseDriftResponseType = Static<typeof LicenseDriftResponse>;

const HostOsPatchDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalHostOsParameterDriftResponse]);
type HostOsPatchDriftResponseType = Static<typeof HostOsPatchDriftResponse>;

const RssConfigDriftResponse = Type.Intersect([ParameterDriftResponse, AdditionalRssConfigParameterDriftResponse]);
type RssConfigDriftResponseType = Static<typeof RssConfigDriftResponse>;

const StorageParameterErrorResponse = Type.Object({
    name: Type.String(),
    errorMessage: Type.String()
});
const StorageParameterDriftResponse = Type.Object({
    timestamp: Type.Number(),
    configuration: Type.Object({
        volumes: Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse])),
        luns: Type.Array(Type.Union([ParameterDriftResponse, ErrorResponse])),
        os: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse]))
    }),
    sizing: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse])),
    layout: Type.Array(Type.Union([ParameterDriftResponse, StorageParameterErrorResponse]))
});
type StorageParameterDriftResponseType = Static<typeof StorageParameterDriftResponse>;
const DriftAssessmentResponse = Type.Object({
    storage: Type.Optional(StorageParameterDriftResponse),
    compute: Type.Optional(Type.Union([ComputeDriftResponse, ErrorResponse])),
    license: Type.Optional(Type.Union([LicenseDriftResponse, ErrorResponse])),
    hostOsPatch: Type.Optional(Type.Union([HostOsPatchDriftResponse, ErrorResponse])),
    rssConfig: Type.Optional(Type.Union([RssConfigDriftResponse, ErrorResponse])),
    maxDOP: Type.Optional(Type.Union([ParameterDriftResponse, ErrorResponse]))
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

const OptimizeStorageRequestParams = Type.Object({
    configurationName: Type.String(Type.Enum(OptimizeStorageConfigs)),
    objectsToOptimize: Type.Array(Type.String({ minLength: 1 }))
});

const OptimizeStorageRequestBody = Type.Object({
    assessments: Type.Optional(Type.Array(OptimizeStorageRequestParams))
});

type OptimizeStorageRequestBodyType = Static<typeof OptimizeStorageRequestBody>;

type OptimizeStorageRequestParamsType = Static<typeof OptimizeStorageRequestParams>;

const OptimizeComputeRequestBody = Type.Object({
    instanceType: Type.String()
});

type OptimizeComputeRequestBodyType = Static<typeof OptimizeComputeRequestBody>;
const OptimizeSizingRequestBody = Type.Object({
    type: Type.Array(Type.Enum(OPTIMIZE_SIZING_CONFIGS))
});

type OptimizeSizingRequestBodyType = Static<typeof OptimizeSizingRequestBody>;

const OptimizeOperatingSystemRequestBody = Type.Object({
    configurationName: Type.String(Type.Enum(OptimizeOperatingSystemParams))
});

const DriftAssessmentResponsePerAccount = Type.Object({
    count: Type.Number(),
    assessmentsPerAccount: Type.Array(DriftAssessmentResponsePerHost),
    nextToken: Type.Optional(Type.String())
});

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
    DriftAssessmentResponsePerAccount
};
