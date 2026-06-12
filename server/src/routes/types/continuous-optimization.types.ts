import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentStatus,
    AwsWellArchitecturedPillars
} from '../../utils/continous-optimization-consts';

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

const OracleAllowedFields = [...new Set([...allowedFields, ...Object.values(AssessmentCategoriesOracle)])];
const OracleContinuousOptimizationQueryString = Type.Object({
    fields: Type.Optional(
        Type.String({
            description: `Comma separated list of fields to include in the response. Allowed fields: ${OracleAllowedFields.join(
                ', '
            )}`,
            pattern: `^(${OracleAllowedFields.join('|')})(,(${OracleAllowedFields.join('|')}))*$`
        })
    ),
    nextToken: Type.Optional(Type.String())
});

const AssessmentQueryStringPerAccount = Type.Intersect([
    ContinuousOptimizationQueryString,
    Type.Object({
        pageSize: Type.Optional(Type.Integer())
    })
]);

const OracleAssessmentQueryStringPerAccount = Type.Intersect([
    OracleContinuousOptimizationQueryString,
    Type.Object({
        pageSize: Type.Optional(Type.Integer())
    })
]);

const GenericViolationResponse = Type.Object({
    objectName: Type.String(),
    value: Type.String(),
    objectType: Type.String(),
    recommended: Type.Optional(Type.String()),
    dataCategory: Type.Optional(Type.String()), // Applicable in volume assessment for Oracle
    additionalInfo: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

type GenericViolationResponseType = Static<typeof GenericViolationResponse>;

const OntapVolume = Type.Object({
    ontapVolumeName: Type.Optional(Type.String()),
    ontapVolumeUuid: Type.Optional(Type.String()),
    fsxVolumeId: Type.Optional(Type.String())
});
type OntapVolumeType = Static<typeof OntapVolume>;

const ErrorResponse = Type.Object({
    id: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    errorMessage: Type.String()
});
type ErrorResponseType = Static<typeof ErrorResponse>;

const GenericParameterDriftResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
    violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
    categories: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    // v1 exposed the AWS Well-Architected pillars as `tags`; v2 renamed it to `categories`.
    tags: Type.Optional(Type.Array(Type.Enum(AwsWellArchitecturedPillars))),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    current: Type.Optional(Type.String()),
    totalObjectsAssessed: Type.Optional(Type.Number()),
    totalObjectsInViolation: Type.Optional(Type.Number()),
    resourceType: Type.Optional(Type.String())
});

const GenericAssessmentResponse = Type.Union([GenericParameterDriftResponse, ErrorResponse]);
type GenericAssessmentResponseType = Static<typeof GenericAssessmentResponse>;

// v1 responses rename `id`->`name` and `categories`->`tags`, so they never carry `id`/`categories`.
// Derive v1 schemas by omitting those fields, keeping the strict base intact for v2 item typing.
const GenericParameterDriftResponseV1 = Type.Omit(GenericParameterDriftResponse, ['id', 'categories']);
const GenericAssessmentResponseV1 = Type.Union([GenericParameterDriftResponseV1, ErrorResponse]);

const FsxBackupOptimizationFields = Type.Object({
    fsxFileSystemId: Type.Optional(Type.String()),
    backupRetentionDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 90 })),
    backupStartTime: Type.Optional(
        Type.String({
            description: '00:00 to 23:59 padded UTC timestamp',
            pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
        })
    )
});
type FsxBackupOptimizationFieldsType = Static<typeof FsxBackupOptimizationFields>;

const InstanceDismissResponse = Type.Object({
    configurationName: Type.String(),
    configState: Type.String(),
    startTime: Type.Optional(Type.Number()),
    endTime: Type.Optional(Type.Number())
});

const DismissedConfigurationsResponse = Type.Object({
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
    oracleSecurityPatch: Type.Optional(InstanceDismissResponse),
    // Oracle compute host/OS dismiss configs (GH-8882-1)
    transparentHugepages: Type.Optional(InstanceDismissResponse),
    tcpAdvancedOptions: Type.Optional(InstanceDismissResponse),
    filesystemsIoOptions: Type.Optional(InstanceDismissResponse),
    multiblockReadcount: Type.Optional(InstanceDismissResponse),
    rssConfig: Type.Optional(InstanceDismissResponse),
    maxDOP: Type.Optional(InstanceDismissResponse),
    mssqlPatch: Type.Optional(InstanceDismissResponse),
    crr: Type.Optional(InstanceDismissResponse),
    clone: Type.Optional(InstanceDismissResponse),
    snapshotPolicy: Type.Optional(InstanceDismissResponse),
    awsBackup: Type.Optional(InstanceDismissResponse),
    mtuAlignment: Type.Optional(InstanceDismissResponse),
    snapcenterSnapshot: Type.Optional(InstanceDismissResponse),
    highAvailability: Type.Optional(Type.Array(Type.Optional(InstanceDismissResponse)))
});
type DismissedConfigurationsResponseType = Static<typeof DismissedConfigurationsResponse>;

const ClonedVolumeDetailSchema = Type.Object({
    cloneVolumeUuid: Type.Optional(Type.String()),
    cloneVolumeName: Type.Optional(Type.String()),
    cloneVolumeCreateTime: Type.Optional(Type.String()),
    sourceVolumeName: Type.Optional(Type.String()),
    cloneDatabaseName: Type.Optional(Type.String())
});

const CloneDetailSchema = Type.Object({
    databaseHostName: Type.String(),
    databaseHostId: Type.String(),
    databaseInstanceName: Type.String(),
    sourceDatabaseHostName: Type.Optional(Type.String()),
    sourceDatabaseInstanceName: Type.Optional(Type.String()),
    sourceDatabaseName: Type.Optional(Type.String()),
    cloneDatabaseName: Type.Optional(Type.String()),
    cloneSize: Type.Optional(Type.Number()),
    cloneAge: Type.Optional(Type.Number()),
    clonedBy: Type.Optional(Type.String())
});

/** Clone entry carried by clone-management assessments (MSSQL and Oracle). */
const CloneDetailItem = Type.Intersect([
    CloneDetailSchema,
    Type.Object({
        tag: Type.Optional(Type.String({ nullable: true })),
        tags: Type.Optional(Type.String()),
        clonedVolumeDetails: Type.Optional(
            Type.Array(
                Type.Intersect([
                    ClonedVolumeDetailSchema,
                    Type.Object({
                        cloneVolumeType: Type.Optional(Type.String()),
                        isFlexClone: Type.Optional(Type.Boolean())
                    })
                ])
            )
        )
    })
]);

/** Golden-config static properties shared across assessment items, error items, and dismissed configurations. */
const BaseAssessmentObject = Type.Object({
    id: Type.String(),
    name: Type.String(),
    type: Type.String(),
    subType: Type.Optional(Type.String()),
    severity: Type.String(),
    recommendation: Type.String(),
    categories: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    resourceType: Type.Optional(Type.String())
});
type GoldenConfigPropertiesType = Static<typeof BaseAssessmentObject>;

/** Base assessment item properties shared by both MSSQL and Oracle. */
const BaseAssessmentItem = Type.Intersect([
    BaseAssessmentObject,
    Type.Object({
        status: Type.Enum(AssessmentStatus),
        recommended: Type.String(),
        objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
        violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
        missingPermissions: Type.Optional(Type.Array(Type.String())),
        recommendedSizeInGib: Type.Optional(Type.Number()),
        current: Type.Optional(Type.String()),
        totalObjectsAssessed: Type.Optional(Type.Number()),
        totalObjectsInViolation: Type.Optional(Type.Number()),
        focusWidgetName: Type.Optional(Type.String()),
        cloneDetails: Type.Optional(
            Type.Array(CloneDetailItem, { description: 'Current clone instances and their details' })
        ),
        oldCloneDetails: Type.Optional(
            Type.Array(CloneDetailItem, { description: 'Previous clone instances for drift comparison' })
        ),
        cloneDriftMessage: Type.Optional(Type.String({ description: 'Message describing clone drift status' }))
    })
]);

/** Type for base assessment items - use MssqlAssessmentItemType or OracleAssessmentItemType for specific implementations */
type AssessmentItemType = Static<typeof BaseAssessmentItem>;

/** Error entry for an assessment area that failed to compute; carries full golden-config static content plus errorMessage. */
const AssessmentErrorItem = Type.Intersect([
    BaseAssessmentObject,
    Type.Object({
        errorMessage: Type.String()
    })
]);
type AssessmentErrorItemType = Static<typeof AssessmentErrorItem>;

/** A dismissed-configuration entry, enriched with the matching golden-config static content. */
const DismissedConfiguration = Type.Intersect([
    BaseAssessmentObject,
    Type.Object({
        configurationName: Type.String(),
        configState: Type.String(),
        startTime: Type.Optional(Type.Number()),
        endTime: Type.Optional(Type.Number())
    })
]);
type DismissedConfigurationType = Static<typeof DismissedConfiguration>;

/** Instance/host identity and timing metadata extracted out of the flattened assessment response. */
const AssessmentMetadata = Type.Object({
    lastAssessmentTimestamp: Type.Optional(Type.Number()),
    fileSystemId: Type.Optional(Type.String()),
    storageEndpoint: Type.Optional(Type.String()),
    ec2InstanceId: Type.Optional(Type.String()),
    ec2InstanceName: Type.Optional(Type.String()),
    databaseInstanceName: Type.Optional(Type.String()),
    deploymentType: Type.Optional(Type.String()),
    baseDeploymentType: Type.Optional(Type.String()),
    replicaRole: Type.Optional(Type.String()),
    databaseHostName: Type.Optional(Type.String()),
    storageProtocol: Type.Optional(Type.String()),
    isASMManaged: Type.Optional(Type.Boolean())
});
type AssessmentMetadataType = Static<typeof AssessmentMetadata>;

export {
    OntapVolume,
    OntapVolumeType,
    GenericViolationResponse,
    GenericViolationResponseType,
    GenericAssessmentResponse,
    GenericAssessmentResponseType,
    GenericAssessmentResponseV1,
    ContinuousOptimizationQueryString,
    OracleContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    OracleAssessmentQueryStringPerAccount,
    GenericParameterDriftResponse,
    GenericParameterDriftResponseV1,
    ErrorResponse,
    ErrorResponseType,
    DismissedConfigurationsResponse,
    DismissedConfigurationsResponseType,
    CloneDetailSchema,
    ClonedVolumeDetailSchema,
    FsxBackupOptimizationFields,
    FsxBackupOptimizationFieldsType,
    BaseAssessmentObject,
    GoldenConfigPropertiesType,
    BaseAssessmentItem,
    AssessmentItemType,
    AssessmentErrorItem,
    AssessmentErrorItemType,
    DismissedConfiguration,
    DismissedConfigurationType,
    AssessmentMetadata,
    AssessmentMetadataType
};
