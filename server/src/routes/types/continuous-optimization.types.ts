import { Static, Type } from '@fastify/type-provider-typebox';
import {
    AssessmentCategories,
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

const AssessmentQueryStringPerAccount = Type.Composite([
    ContinuousOptimizationQueryString,
    Type.Object({
        pageSize: Type.Optional(Type.Integer())
    })
]);

const GenericViolationResponse = Type.Object({
    objectName: Type.String(),
    value: Type.String(),
    objectType: Type.String()
});

type GenericViolationResponseType = Static<typeof GenericViolationResponse>;

const OntapVolume = Type.Object({
    ontapVolumeName: Type.Optional(Type.String()),
    ontapVolumeUuid: Type.Optional(Type.String())
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

const InstanceDismissResponse = Type.Object({
    configurationName: Type.String(),
    configState: Type.String(),
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
    rssConfig: Type.Optional(InstanceDismissResponse),
    maxDOP: Type.Optional(InstanceDismissResponse),
    mssqlPatch: Type.Optional(InstanceDismissResponse),
    crr: Type.Optional(InstanceDismissResponse),
    clone: Type.Optional(InstanceDismissResponse),
    snapshotPolicy: Type.Optional(InstanceDismissResponse),
    awsBackup: Type.Optional(InstanceDismissResponse)
});
type DismissedConfigurationsResponseType = Static<typeof DismissedConfigurationsResponse>;

export {
    OntapVolume,
    OntapVolumeType,
    GenericViolationResponse,
    GenericViolationResponseType,
    GenericAssessmentResponse,
    GenericAssessmentResponseType,
    ContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    GenericParameterDriftResponse,
    ErrorResponse,
    ErrorResponseType,
    DismissedConfigurationsResponse,
    DismissedConfigurationsResponseType
};
