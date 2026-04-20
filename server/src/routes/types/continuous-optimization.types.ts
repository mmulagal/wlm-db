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

const oracleAllowedFields = [...new Set([...allowedFields, ...Object.values(AssessmentCategoriesOracle)])];
const OracleContinuousOptimizationQueryString = Type.Object({
    fields: Type.Optional(
        Type.String({
            description: `Comma separated list of fields to include in the response. Allowed fields: ${oracleAllowedFields.join(
                ', '
            )}`,
            pattern: `^(${oracleAllowedFields.join('|')})(,(${oracleAllowedFields.join('|')}))*$`
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

const ErrorResponse = Type.Object({ name: Type.Optional(Type.String()), errorMessage: Type.String() });
type ErrorResponseType = Static<typeof ErrorResponse>;

const GenericParameterDriftResponse = Type.Object({
    name: Type.String(),
    status: Type.Enum(AssessmentStatus),
    recommended: Type.String(),
    severity: Type.String(),
    recommendation: Type.String(),
    objectsInViolation: Type.Optional(Type.Array(Type.Union([Type.String(), OntapVolume]))),
    violationDetails: Type.Optional(Type.Array(GenericViolationResponse)),
    tags: Type.Array(Type.Enum(AwsWellArchitecturedPillars)),
    missingPermissions: Type.Optional(Type.Array(Type.String())),
    recommendedSizeInGib: Type.Optional(Type.Number()),
    current: Type.Optional(Type.String()),
    totalObjectsAssessed: Type.Optional(Type.Number()),
    totalObjectsInViolation: Type.Optional(Type.Number()),
    resourceType: Type.Optional(Type.String())
});

const GenericAssessmentResponse = Type.Union([GenericParameterDriftResponse, ErrorResponse]);
type GenericAssessmentResponseType = Static<typeof GenericAssessmentResponse>;

const FsxBackupOptimizationFields = Type.Object({
    fsxFileSystemId: Type.Optional(Type.String()),
    backupRetentionDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 90, default: 7 })),
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

export {
    OntapVolume,
    OntapVolumeType,
    GenericViolationResponse,
    GenericViolationResponseType,
    GenericAssessmentResponse,
    GenericAssessmentResponseType,
    ContinuousOptimizationQueryString,
    OracleContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    OracleAssessmentQueryStringPerAccount,
    GenericParameterDriftResponse,
    ErrorResponse,
    ErrorResponseType,
    DismissedConfigurationsResponse,
    DismissedConfigurationsResponseType,
    CloneDetailSchema,
    ClonedVolumeDetailSchema,
    FsxBackupOptimizationFields,
    FsxBackupOptimizationFieldsType
};
