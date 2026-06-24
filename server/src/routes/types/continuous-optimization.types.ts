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

/**
 * Per-offender sub-parameter detail used by aggregate configs (e.g. block-device-space-management)
 * that roll up multiple ONTAP attributes into one assessment entry. Each entry lists the
 * sub-parameter name and the offending object's current (non-optimal) stringified value. The
 * recommended target value is NOT duplicated here — it lives once in the entry-level
 * configDetails[] catalogue, joined by `id`.
 */
const ViolatedConfig = Type.Object({
    id: Type.String(),
    current: Type.String()
});
type ViolatedConfigType = Static<typeof ViolatedConfig>;

/** Oracle volume data categories used in recommendedByDataCategory (and violation dataCategory). */
const DATA_CATEGORY_PROPERTIES = {
    'log-files': Type.String(),
    'non-log-files': Type.String(),
    mixed: Type.String(),
    'data-control-files': Type.String(),
    'archive-log-files': Type.String()
} as const;

const RecommendedByDataCategory = Type.Partial(Type.Object(DATA_CATEGORY_PROPERTIES));
type RecommendedByDataCategoryType = Static<typeof RecommendedByDataCategory>;

/** Extra context on violationDetails items (MSSQL layout, Oracle export-policy). */
const VIOLATION_ADDITIONAL_INFO_PROPERTIES = {
    lunPath: Type.String(),
    driveLetter: Type.String(),
    vserverName: Type.String(),
    exportPolicyName: Type.String(),
    clients: Type.Array(Type.String())
} as const;

const ViolationAdditionalInfo = Type.Partial(Type.Object(VIOLATION_ADDITIONAL_INFO_PROPERTIES));
type ViolationAdditionalInfoType = Static<typeof ViolationAdditionalInfo>;

/**
 * Catalogue entry used by aggregate configs. configDetails[] on the parent assessment item
 * lists every sub-parameter the entry assessed, paired with its recommended target value and
 * the resource type the sub-parameter belongs to. Always emitted by aggregate configs (even
 * when status is OPTIMIZED) so consumers can render a self-describing
 * "checked X settings, target values Y" view without needing the original golden config.
 *
 * Static sub-parameters (e.g. MSSQL block-device-space-management): `recommended` is the single
 * target; optional fields are omitted.
 *
 * Variable sub-parameters (Oracle combined configs): `recommended` is empty; use
 * `recommendedByDataCategory` and optionally `recommendedNote` for per-category guidance.
 */
const ConfigDetail = Type.Object({
    id: Type.String(),
    recommended: Type.String(),
    objectType: Type.String(),
    recommendedByDataCategory: Type.Optional(RecommendedByDataCategory),
    recommendedNote: Type.Optional(Type.String())
});
type ConfigDetailType = Static<typeof ConfigDetail>;

const GenericViolationResponse = Type.Object({
    objectName: Type.String(),
    value: Type.String(),
    objectType: Type.String(),
    recommended: Type.Optional(Type.String()),
    dataCategory: Type.Optional(Type.String()), // Applicable in volume assessment for Oracle
    additionalInfo: Type.Optional(ViolationAdditionalInfo),
    // Set only by aggregate configs (e.g. block-device-space-management). Lists every
    // sub-parameter this offending object failed; current values only — see configDetails[]
    // on the parent entry for the recommended target.
    violatedConfigs: Type.Optional(Type.Array(ViolatedConfig))
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
    resourceType: Type.Optional(Type.String()),
    // Set only by aggregate configs (e.g. block-device-space-management, storage-efficiencies,
    // tiering-tco-optimization). Catalogue of every sub-parameter the entry assessed, with
    // each one's recommended target value and source resource type. Always emitted by
    // aggregate configs, regardless of status. Flows to v1 via Type.Omit.
    configDetails: Type.Optional(Type.Array(ConfigDetail))
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
        cloneDriftMessage: Type.Optional(Type.String({ description: 'Message describing clone drift status' })),
        // Set only by aggregate configs (e.g. block-device-space-management,
        // storage-efficiencies, tiering-tco-optimization). Catalogue of every sub-parameter
        // the entry assessed, paired with its recommended target value. Flows to v2
        // assessments[] items.
        configDetails: Type.Optional(Type.Array(ConfigDetail))
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
    RecommendedByDataCategory,
    RecommendedByDataCategoryType,
    ViolationAdditionalInfo,
    ViolationAdditionalInfoType,
    OntapVolume,
    OntapVolumeType,
    GenericViolationResponse,
    GenericViolationResponseType,
    ViolatedConfig,
    ViolatedConfigType,
    ConfigDetail,
    ConfigDetailType,
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
