import createError from 'http-errors';
import { cloneDeep, compact, groupBy, isEmpty } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import { STORAGE_TYPE } from '@prisma/client';
import throat from 'throat';
import {
    ENT_ENGINE_EDITION,
    FINDING,
    HOURS_IN_MONTH,
    HttpErrorCodes,
    PRICING_LICENSE_KEYS,
    SQL_SERVICE_STATE,
    STD_ENGINE_EDITION,
    SqlServerDeploymentModel,
    WIN_SQL_EC2_USAGE_OPERATION
} from '../utils/consts';
import { getInstanceRecommendations } from './aws/compute-optimizer-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { ENTERPRISE_CHECK_QUERY } from './workloads/mssql/queries';
import {
    deriveInstanceCountPricingDetails,
    getPricingByLicenseType,
    getSqlInstancePricingDetails
} from './aws/pricing-operations';
import getLogger from '../utils/logger';
import { determineSmallerInstance, getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { NodeDetails } from '../utils/common-types';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import { getDatabaseInstanceName, getMonthlyPriceFromHourlyPrice } from '../utils/utils';
import { getEnrollmentStatus } from '../lib/aws/compute-optimizer';
import { sqlQueryExecution } from './workloads/mssql/ssm-script-utils';
import {
    ComputeDetailsType,
    LicenseDetailsType,
    ManualStorageSavingsRequestBodyType
} from '../routes/types/storage-savings.types';

const logger = getLogger();

async function isUsingEnterpriseConfiguration(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    sqlServerInstanceInfo: SqlServerInstanceInfoType
) {
    logger.debug('Checking if the instance is using any enterprise features', {
        accountId,
        credentialsId,
        region,
        instanceId,
        sqlServerInstanceInfo
    });

    const { isDefaultInstance, sqlServerInstance, sqlServerAuthentication, windowsDomainUserAuthentication } =
        sqlServerInstanceInfo;
    const sqlServerName = getDatabaseInstanceName(sqlServerInstance, isDefaultInstance);

    const command = [
        sqlQueryExecution(
            sqlServerInstance,
            sqlServerName,
            ENTERPRISE_CHECK_QUERY,
            sqlServerAuthentication || windowsDomainUserAuthentication || false
        )
    ];

    const checkEnterpriseConfigurationList = await callSsmExecution(
        credentialsId,
        region,
        command,
        instanceId,
        'Check SQL Enterprise Configuration',
        accountId,
        false
    );

    if (checkEnterpriseConfigurationList) {
        const jsonResult = JSON.parse(checkEnterpriseConfigurationList);
        const isUsingAnyEnterpriseFeature = jsonResult?.some(
            (checkEnterpriseConfiguration: { IsUsingFeature: number; FeatureDescription: string }) =>
                checkEnterpriseConfiguration.IsUsingFeature === 1
        );

        return isUsingAnyEnterpriseFeature;
    }

    return false;
}

async function getLicenseRecommendations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    sqlServerInstances: SqlServerInstanceInfoType[],
    sqlServerDeploymentType: string
) {
    logger.info('Getting license recommendations', {
        accountId,
        credentialsId,
        region,
        instanceId,
        sqlServerInstances,
        sqlServerDeploymentType
    });
    /*
           if the existing license engine is Enterprise but the instance is not using any enterprise features, recommend Standard

           EngineEdition	Database Engine edition of the instance of SQL Server installed on the server.

           2 = Standard (For Standard, Web, and Business Intelligence.)https://learn.microsoft.com/en-us/sql/t-sql/functions/serverproperty-transact-sql?view=sql-server-ver16#:~:text=data%20type%3A%20bigint-,EngineEdition,-Database%20Engine%20edition
           3 = Enterprise (For Evaluation, Developer, and Enterprise editions.)

    */

    let licenseFinding = FINDING.OPTIMIZED;
    const runningEnterpriseEditionSqlServerInstances = sqlServerInstances.filter(
        sqlServerInstance =>
            sqlServerInstance.sqlServerEngineEdition === ENT_ENGINE_EDITION &&
            sqlServerInstance.sqlServerState === SQL_SERVICE_STATE.RUNNING &&
            sqlServerInstance.sqlServerDeploymentType === sqlServerDeploymentType
    );

    const enterpriseUsageResults = await Promise.all(
        runningEnterpriseEditionSqlServerInstances.map(
            throat(5, async sqlServerInstance =>
                isUsingEnterpriseConfiguration(accountId, credentialsId, region, instanceId, sqlServerInstance)
            )
        )
    );
    const usingEnterpriseConfiguration = enterpriseUsageResults.some(result => result);

    let recommendedLicenseType = PRICING_LICENSE_KEYS.SQL_ENT;
    if (!usingEnterpriseConfiguration) {
        licenseFinding = FINDING.NOT_OPTIMIZED;
        recommendedLicenseType = PRICING_LICENSE_KEYS.SQL_STD;
    }
    return { licenseFinding, recommendedLicenseType, sqlServerInstances };
}

/* The function processes the SQL Server instances based on the edition and deployment type. If there are multiple sql server instances of a certain edition with both AOAG and Standalone configuration, then AOAG configuration is given preference fist */
function processSqlInstances(sqlInstances: SqlServerInstanceInfoType[], edition: string) {
    logger.debug('Processing SQL Server instances', { sqlInstances, edition });

    const filteredInstances = sqlInstances.filter(({ sqlServerEdition = '' }) => sqlServerEdition.includes(edition));
    if (filteredInstances.length > 0) {
        const groupByDeploymentType = groupBy(filteredInstances, 'sqlServerDeploymentType');
        return (
            groupByDeploymentType[SqlServerDeploymentModel.SQL_AOAG_SHORT]?.[0] ||
            groupByDeploymentType[SqlServerDeploymentModel.SQL_FCI_SHORT]?.[0] ||
            filteredInstances[0]
        );
    }
}

function fetchSqlServerInstanceConfiguration(sqlServerInstances: SqlServerInstanceInfoType[]) {
    logger.info('Fetching SQL Server instance configuration', { sqlServerInstancesCount: sqlServerInstances.length });
    /*

sqlServerEngineEdition = EngineEdition	Database Engine edition of the instance of SQL Server installed on the server.
    2 = Standard (For Standard, Web, and Business Intelligence.)
    3 = Enterprise (For Evaluation, Developer, and Enterprise editions.)


sqlServerEdition = Edition =	Installed product edition of the instance of SQL Server. Use the value of this property to determine the features and the limits, such as Compute capacity limits by edition of SQL Server. 64-bit versions of the Database Engine append (64-bit) to the version.
    'Enterprise Edition','Enterprise Edition: Core-based Licensing','Enterprise Evaluation Edition','Business Intelligence Edition'
    'Developer Edition','Express Edition','Express Edition with Advanced Services'
    'Standard Edition','Web Edition','SQL Azure' indicates SQL Database or Azure Synapse Analytics
    'Azure SQL Edge Developer' indicates the development only edition for Azure SQL Edge
    'Azure SQL Edge' indicates the paid edition for Azure SQL Edge

*/
    const sqlCombination = groupBy(sqlServerInstances, 'sqlServerEngineEdition');

    if (sqlCombination[ENT_ENGINE_EDITION]?.length > 0) {
        const enterpriseResult = processSqlInstances(sqlCombination[ENT_ENGINE_EDITION], 'Enterprise');
        if (enterpriseResult) {
            return enterpriseResult;
        }
    }

    if (sqlCombination[STD_ENGINE_EDITION]?.length > 0) {
        const standardResult = processSqlInstances(sqlCombination[STD_ENGINE_EDITION], 'Standard');
        if (standardResult) {
            return standardResult;
        }

        const webResult = processSqlInstances(sqlCombination[STD_ENGINE_EDITION], 'Web');
        if (webResult) {
            return webResult;
        }
    }

    // if no enterprise,standard or web edition found, return any sql server instance with windows authentication
    return sqlServerInstances.find(sqlServerInstance => sqlServerInstance.windowsAuthentication === true);
}

function getMachineDetails(
    nodeInstances: NodeDetails[],
    instanceTypesPricingDetails: Map<string, any>,
    licenseType: string,
    monthlySqlByolCost?: number
) {
    logger.info('Getting machine details', {
        nodeInstances,
        instanceTypesPricingDetails,
        licenseType,
        monthlySqlByolCost
    });

    const byolHourlyPricePerHost = monthlySqlByolCost ? monthlySqlByolCost / HOURS_IN_MONTH : undefined;
    return nodeInstances.map(({ ec2InstanceType: instanceType, ec2UsageOperation = '' }) => {
        const computeHourlyPrice = instanceTypesPricingDetails?.get(instanceType)?.pricingDetails
            ? instanceTypesPricingDetails?.get(instanceType)?.pricingDetails.NA?.pricePerUnit
            : 0.192; // for regions where pricing details are not available, use a default price for m5.xlarge instance type, earlier we'd throw an error here
        const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(computeHourlyPrice); // compute price is exclusive of license price

        const nodeInstanceByolPrice =
            byolHourlyPricePerHost && computeHourlyPrice ? computeHourlyPrice + byolHourlyPricePerHost : undefined;

        const instanceHourlyPrice =
            nodeInstanceByolPrice || instanceTypesPricingDetails?.get(instanceType)?.pricingDetails
                ? instanceTypesPricingDetails?.get(instanceType)?.pricingDetails[licenseType]?.pricePerUnit
                : 0.192; // instance price is inclusive of license price (priority to BYOL price if available)
        const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(instanceHourlyPrice);

        const licenseMonthlyPrice = WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation)
            ? computeMonthlyPrice !== undefined && instanceMonthlyPrice !== undefined
                ? instanceMonthlyPrice - computeMonthlyPrice
                : undefined
            : monthlySqlByolCost || 0;

        return {
            instanceType,
            price: instanceHourlyPrice,
            basePrice: computeHourlyPrice,
            computeMonthlyPrice,
            instanceMonthlyPrice,
            licenseMonthlyPrice,
            hoursInMonth: HOURS_IN_MONTH,
            licenseIncluded: monthlySqlByolCost ? false : WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation)
        };
    });
}
function getExistingAsRecommended(
    totalNodesCount: number,
    existingInstanceType: string,
    ec2UsageOperation: string,
    existingLicenseType: string,
    existingInstanceTypesPricingDetails: Map<string, any>,
    existingInstanceHourlyPrice?: number,
    existingInstanceHourlyPriceWithoutLicense?: number,
    monthlySqlByolCost?: number,
    message?: string
) {
    const recommendedNodeInstances = Array(totalNodesCount).fill({
        ec2InstanceType: existingInstanceType,
        ec2UsageOperation
    });
    return {
        price: existingInstanceHourlyPrice,
        baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
        instanceType: recommendedNodeInstances.map(({ ec2InstanceType }) => ec2InstanceType).join(', '),
        machineDetails: getMachineDetails(
            recommendedNodeInstances,
            existingInstanceTypesPricingDetails,
            existingLicenseType,
            monthlySqlByolCost
        ),
        message,
        recommendationOptions: []
    };
}

async function handleInstanceRecommendation(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIdToUseForRecommendations: string,
    nodeInstances: NodeDetails[],
    ebsVolumeIds: string[],
    sqlServerDeploymentType: string,
    recommendedSqlLicenseType: any,
    existingInstanceType: string,
    existingLicenseType: string,
    existingInstanceTypesPricingDetails: Map<string, any>,
    totalNodesCount: number,
    existingInstanceHourlyPrice?: number,
    existingInstanceHourlyPriceWithoutLicense?: number,
    isAwsLicenseIncluded: boolean = true,
    ec2UsageOperation: string = '',
    monthlySqlByolCostPerHost?: number
) {
    logger.info('Handling instance recommendations', {
        accountId,
        credentialsId,
        region,
        instanceIdToUseForRecommendations,
        nodeInstances,
        ebsVolumeIds,
        sqlServerDeploymentType,
        recommendedSqlLicenseType,
        existingInstanceType,
        existingLicenseType,
        existingInstanceTypesPricingDetails,
        existingInstanceHourlyPrice,
        existingInstanceHourlyPriceWithoutLicense,
        totalNodesCount,
        isAwsLicenseIncluded,
        ec2UsageOperation,
        monthlySqlByolCostPerHost
    });

    let recommendedCompute;
    let computeFinding = FINDING.OPTIMIZED;
    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);
        const {
            finding,
            message: recommendationMessage,
            instanceRecommendations
        } = await getInstanceRecommendations(
            region,
            credentialsId,
            accountId,
            instanceIdToUseForRecommendations,
            nodeInstances,
            ebsVolumeIds,
            sqlServerDeploymentType
        );
        const [{ instanceType: recommendedInstanceType = '' } = {}] = instanceRecommendations || [];

        if (recommendedInstanceType && existingInstanceType !== recommendedInstanceType) {
            const { [recommendedInstanceType]: recommendedInstancePricingDetails } = await getSqlInstancePricingDetails(
                region,
                recommendedInstanceType as _InstanceType,
                'windows', // TODO: fetch operating system from existing instance when supporting other instance operating systems
                undefined // not using usage operation as a filter; usage operation is related to standard/enterprise but not for an operating system
            );

            let recommendedInstanceHourlyPrice: number | undefined;
            let recommendedInstanceHourlyPriceWithoutLicense: number | undefined;
            if (isAwsLicenseIncluded) {
                // if the existing instance is using AWS license included, then get the AWS license included price for the recommended instance type
                recommendedInstanceHourlyPrice = recommendedInstancePricingDetails?.[recommendedSqlLicenseType]
                    ?.pricePerUnit
                    ? recommendedInstancePricingDetails[recommendedSqlLicenseType].pricePerUnit * totalNodesCount
                    : undefined;

                recommendedInstanceHourlyPriceWithoutLicense = recommendedInstancePricingDetails?.NA?.pricePerUnit
                    ? recommendedInstancePricingDetails.NA.pricePerUnit * totalNodesCount
                    : undefined;
            } else {
                // if the existing instance is using BYOL, then use the BYOL price for the recommended instance type; assumption: BYOL price is the same for recommended ec2 instance types
                recommendedInstanceHourlyPrice = existingInstanceHourlyPrice;
                recommendedInstanceHourlyPriceWithoutLicense = existingInstanceHourlyPriceWithoutLicense;
            }
            computeFinding = finding;
            const recommendedNodeInstanceTypes = Array(totalNodesCount).fill(recommendedInstanceType);
            const rinstanceMonthlyPrice = recommendedInstanceHourlyPrice
                ? (getMonthlyPriceFromHourlyPrice(recommendedInstanceHourlyPrice) || 0) / totalNodesCount
                : undefined;
            const rcomputeMonthlyPrice = recommendedInstanceHourlyPriceWithoutLicense
                ? (getMonthlyPriceFromHourlyPrice(recommendedInstanceHourlyPriceWithoutLicense) || 0) / totalNodesCount
                : undefined;
            recommendedCompute = {
                price: recommendedInstanceHourlyPrice,
                baseInstancePrice: recommendedInstanceHourlyPriceWithoutLicense,
                instanceType: recommendedNodeInstanceTypes.join(', '),
                machineDetails: recommendedNodeInstanceTypes.map(instanceType => ({
                    instanceType,
                    price: recommendedInstanceHourlyPrice
                        ? recommendedInstanceHourlyPrice / totalNodesCount
                        : undefined,
                    basePrice: recommendedInstanceHourlyPriceWithoutLicense
                        ? recommendedInstanceHourlyPriceWithoutLicense / totalNodesCount
                        : undefined,
                    computeMonthlyPrice: rcomputeMonthlyPrice,
                    instanceMonthlyPrice: rinstanceMonthlyPrice,
                    licenseMonthlyPrice: isAwsLicenseIncluded
                        ? rcomputeMonthlyPrice !== undefined && rinstanceMonthlyPrice !== undefined
                            ? rinstanceMonthlyPrice - rcomputeMonthlyPrice
                            : undefined
                        : monthlySqlByolCostPerHost || 0,
                    hoursInMonth: HOURS_IN_MONTH,
                    licenseIncluded: isAwsLicenseIncluded
                })),
                recommendationOptions: instanceRecommendations
                    ?.filter(({ instanceType }) => instanceType !== existingInstanceType)
                    ?.map(({ instanceType, pricingDetails }) => {
                        const basePrice = pricingDetails?.NA?.pricePerUnit;
                        const price =
                            !isAwsLicenseIncluded && monthlySqlByolCostPerHost !== undefined
                                ? basePrice + monthlySqlByolCostPerHost / HOURS_IN_MONTH
                                : pricingDetails[recommendedSqlLicenseType]?.pricePerUnit;
                        const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(basePrice);
                        const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(price);
                        return {
                            instanceType,
                            price,
                            basePrice,
                            computeMonthlyPrice,
                            instanceMonthlyPrice,
                            licenseMonthlyPrice: isAwsLicenseIncluded
                                ? computeMonthlyPrice !== undefined && instanceMonthlyPrice !== undefined
                                    ? instanceMonthlyPrice - computeMonthlyPrice
                                    : undefined
                                : monthlySqlByolCostPerHost || 0,
                            hoursInMonth: HOURS_IN_MONTH
                        };
                    }),
                message: recommendationMessage
            };
        } else {
            const message =
                existingInstanceType === recommendedInstanceType
                    ? 'No instance change recommended as per Compute Optimizer'
                    : 'Instance Recommendations not available for the instance';
            computeFinding = finding || FINDING.OPTIMIZED;

            recommendedCompute = getExistingAsRecommended(
                totalNodesCount,
                existingInstanceType,
                ec2UsageOperation,
                existingLicenseType,
                existingInstanceTypesPricingDetails,
                existingInstanceHourlyPrice,
                existingInstanceHourlyPriceWithoutLicense,
                monthlySqlByolCostPerHost,
                message
            );
        }
    } catch (error: any) {
        logger.error('Error getting instance recommendations', {
            error: error.message,
            accountId,
            region,
            instanceId: instanceIdToUseForRecommendations
        });

        computeFinding = FINDING.INSUFFICIENT_DATA;
        if (
            error?.message?.includes('Compute Optimizer is not enabled for the account') ||
            error?.message?.includes('not authorized')
        ) {
            computeFinding = FINDING.INSUFFICIENT_PERMISSIONS;
        }
        recommendedCompute = getExistingAsRecommended(
            totalNodesCount,
            existingInstanceType,
            ec2UsageOperation,
            existingLicenseType,
            existingInstanceTypesPricingDetails,
            existingInstanceHourlyPrice,
            existingInstanceHourlyPriceWithoutLicense,
            monthlySqlByolCostPerHost,
            error.message
        );
    }

    return { computeFinding, recommendedCompute };
}

async function checkComputeOptimizerEnrollmentStatus(accountId: string, credentialsId: string, region: string) {
    logger.info('Checking Compute Optimizer enrollment status', { accountId, credentialsId, region });

    const { status: enrollmentStatus } = await getEnrollmentStatus(region, credentialsId, accountId);

    if (enrollmentStatus?.toLowerCase() !== 'active') {
        const errMsg =
            'Compute Optimizer is not enabled for the account. Please enable Compute Optimizer and try again.';
        logger.error(errMsg, { accountId, credentialsId, region });
        throw createError(HttpErrorCodes.BAD_REQUEST, errMsg);
    }
}

async function manualModeComputeLicenseDetails(
    region: string,
    params: ManualStorageSavingsRequestBodyType,
    nodeCount: number = 2,
    isOnpremTcoFlow: boolean = false
) {
    logger.info('Getting manual mode compute and license details ', { region, params, nodeCount });

    const { sqlServerDeploymentType, sqlServerEdition, monthlySqlByolCost, ec2Instances } = params;

    let instanceTypes = ec2Instances.map((instance: { ec2InstanceType: any }) => instance.ec2InstanceType);

    if (sqlServerDeploymentType?.toLowerCase() === 'fci' || sqlServerDeploymentType?.toLowerCase() === 'aoag') {
        instanceTypes = instanceTypes.length === nodeCount ? instanceTypes : Array(nodeCount).fill(instanceTypes[0]);
    }

    const existingInstanceTypesPricingDetails = await deriveInstanceCountPricingDetails(instanceTypes, region);

    const existingInstanceHourlyPriceWithoutLicense = getPricingByLicenseType(
        'NA',
        existingInstanceTypesPricingDetails
    );

    const existingComputePrice = existingInstanceHourlyPriceWithoutLicense;

    let existingInstanceHourlyPrice = existingInstanceHourlyPriceWithoutLicense;
    let existingLicensePrice: number | undefined;

    const existingSqlServerEditionLowerCase = sqlServerEdition?.toLowerCase();

    let awsInstanceLicenseMonthlyPrice;
    let existingLicenseType = 'NA';
    if (
        existingSqlServerEditionLowerCase &&
        (isNonFreeEnterpriseEdition(existingSqlServerEditionLowerCase) ||
            existingSqlServerEditionLowerCase.includes('web') ||
            existingSqlServerEditionLowerCase.includes('standard'))
    ) {
        existingLicenseType = existingSqlServerEditionLowerCase?.includes('enterprise')
            ? PRICING_LICENSE_KEYS.SQL_ENT
            : existingSqlServerEditionLowerCase?.includes('web')
            ? PRICING_LICENSE_KEYS.SQL_WEB
            : PRICING_LICENSE_KEYS.SQL_STD;

        existingInstanceHourlyPrice = getPricingByLicenseType(existingLicenseType, existingInstanceTypesPricingDetails);

        const awsInstanceLicenseHourlyPrice =
            existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                : undefined;

        awsInstanceLicenseMonthlyPrice = getMonthlyPriceFromHourlyPrice(awsInstanceLicenseHourlyPrice);
        ({ licenseHourlyPrice: existingLicensePrice } = getByolOrLicenseIncludedDetails(
            monthlySqlByolCost,
            awsInstanceLicenseHourlyPrice
        ));
    }

    const { licenseIncluded, licenseFinding } = getByolOrLicenseIncludedDetails(
        monthlySqlByolCost,
        existingLicensePrice
    );
    const computeDetails = {
        instanceType: instanceTypes.join(', '),
        computeHourlyPrice: existingComputePrice,
        computeMonthlyPrice: existingComputePrice ? getMonthlyPriceFromHourlyPrice(existingComputePrice) : undefined,
        instanceMonthlyPrice: existingInstanceHourlyPrice
            ? getMonthlyPriceFromHourlyPrice(existingInstanceHourlyPrice)
            : undefined,
        hoursInMonth: HOURS_IN_MONTH,
        machineDetails: instanceTypes.map((instanceType: string) => {
            const pricingDetails = existingInstanceTypesPricingDetails.get(instanceType);
            const { pricePerUnit: priceWithoutLicense } = pricingDetails?.pricingDetails.NA || {};
            const { pricePerUnit: priceWithLicense } = pricingDetails?.pricingDetails[existingLicenseType] || {};
            const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(priceWithoutLicense);
            const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(priceWithLicense);
            return {
                instanceType,
                price: priceWithLicense,
                basePrice: priceWithoutLicense,
                computeMonthlyPrice,
                instanceMonthlyPrice,
                licenseMonthlyPrice: instanceTypes.length
                    ? getMonthlyPriceFromHourlyPrice(existingLicensePrice)! / instanceTypes.length
                    : undefined,
                hoursInMonth: HOURS_IN_MONTH,
                licenseIncluded
            };
        })
    };

    const licenseDetails = {
        finding: licenseFinding,
        licenseHourlyPrice: existingLicensePrice,
        licenseIncluded,
        licenseMonthlyPrice:
            existingLicensePrice && existingLicensePrice >= 0
                ? existingLicensePrice * HOURS_IN_MONTH
                : existingLicensePrice,
        hoursInMonth: HOURS_IN_MONTH,
        sqlServerEdition
    };

    const { recommendedComputeDetails, recommendedLicenseDetails } = handleManualModeRecommendations(
        sqlServerDeploymentType!,
        sqlServerEdition!,
        monthlySqlByolCost!,
        computeDetails,
        licenseDetails,
        existingInstanceTypesPricingDetails,
        awsInstanceLicenseMonthlyPrice!,
        isOnpremTcoFlow
    );

    return {
        compute: {
            existing: computeDetails,
            recommended: recommendedComputeDetails
        },
        license: {
            existing: licenseDetails,
            recommended: recommendedLicenseDetails
        }
    };
}

function updateRecommendedComputeMachineDetails(recommendedComputeDetails: any, licenseMonthlyPrice?: number) {
    const recommendedMachineDetails = cloneDeep(recommendedComputeDetails?.machineDetails);
    if (!isEmpty(recommendedMachineDetails)) {
        recommendedMachineDetails.forEach((machineDetail: any) => {
            machineDetail.licenseMonthlyPrice = licenseMonthlyPrice! / recommendedMachineDetails.length;
        });
        return recommendedMachineDetails;
    }
}

function handleManualModeRecommendations(
    sqlServerDeploymentType: string,
    sqlServerEdition: string,
    monthlySqlByolCost: number,
    existingComputeDetails: ComputeDetailsType,
    existingLicenseDetails: LicenseDetailsType,
    existingInstanceTypePricingDetails: Map<
        string,
        { count: number; pricingDetails: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } } }
    >,
    awsInstanceLicenseMonthlyPrice?: number,
    isOnpremTcoFlow: boolean = false
) {
    logger.info('Handling manual mode recommendations ', {
        sqlServerDeploymentType,
        sqlServerEdition,
        monthlySqlByolCost,
        existingComputeDetails,
        existingLicenseDetails,
        existingInstanceTypePricingDetails,
        awsInstanceLicenseMonthlyPrice,
        isOnpremTcoFlow
    });
    const existingInstanceHourlyPriceWithoutLicense = getPricingByLicenseType('NA', existingInstanceTypePricingDetails);

    const recommendedLicenseDetails = cloneDeep(existingLicenseDetails);
    recommendedLicenseDetails.finding = undefined;

    const recommendedComputeDetails = cloneDeep(existingComputeDetails);
    recommendedComputeDetails.finding = undefined;
    if (
        SqlServerDeploymentModel.SQL_AOAG_SHORT === sqlServerDeploymentType &&
        sqlServerEdition?.toLowerCase().includes('enterprise')
    ) {
        const licenseType = isNonFreeEnterpriseEdition(sqlServerEdition)
            ? PRICING_LICENSE_KEYS.SQL_ENT
            : PRICING_LICENSE_KEYS.SQL_STD;
        let instanceHourlyPrice;
        if (isOnpremTcoFlow) {
            instanceHourlyPrice = getPricingByLicenseType(licenseType, existingInstanceTypePricingDetails);
        } else {
            // As per requirement DBS-2753: Downgrade Enterprise to Standard could be suggested in case of AOAG config.
            instanceHourlyPrice = getPricingByLicenseType(
                PRICING_LICENSE_KEYS.SQL_STD,
                existingInstanceTypePricingDetails
            );
        }
        awsInstanceLicenseMonthlyPrice =
            instanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? (instanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense) * HOURS_IN_MONTH
                : undefined;
        recommendedComputeDetails.instanceHourlyPrice = instanceHourlyPrice;
        recommendedComputeDetails.instanceMonthlyPrice = instanceHourlyPrice
            ? getMonthlyPriceFromHourlyPrice(instanceHourlyPrice)
            : undefined;

        const licenseHourlyPrice =
            instanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                ? instanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                : undefined;
        recommendedLicenseDetails.licenseHourlyPrice = licenseHourlyPrice;

        const licenseMonthlyPrice = licenseHourlyPrice ? getMonthlyPriceFromHourlyPrice(licenseHourlyPrice) : undefined;
        const recommendedMachineDetails = updateRecommendedComputeMachineDetails(
            recommendedComputeDetails,
            licenseMonthlyPrice
        );
        recommendedComputeDetails.machineDetails = recommendedMachineDetails;
        recommendedLicenseDetails.licenseMonthlyPrice = licenseMonthlyPrice;
        recommendedLicenseDetails.licenseIncluded = true;
        if (isOnpremTcoFlow) {
            recommendedLicenseDetails.sqlServerEdition = sqlServerEdition;
        } else {
            // As per requirement DBS-2753: Downgrade Enterprise to Standard could be suggested in case of AOAG config.
            recommendedLicenseDetails.sqlServerEdition = 'Standard Edition';
            recommendedLicenseDetails.message =
                'Downgrade Enterprise Edition to Standard Edition if you are not using any of the enterprise features';
        }
    }

    // As per requirement DBS-2753 : In case of BYOL License, please suggest the equivalent license included cost, in case it's cheaper than the BYOL cost mentioned. otherwise, do not compare SQL License costs and mention N/A in the cost breakdown.
    if (monthlySqlByolCost && monthlySqlByolCost > 0) {
        if (awsInstanceLicenseMonthlyPrice && monthlySqlByolCost > awsInstanceLicenseMonthlyPrice) {
            recommendedLicenseDetails.licenseHourlyPrice = awsInstanceLicenseMonthlyPrice / HOURS_IN_MONTH;
            recommendedLicenseDetails.licenseMonthlyPrice = awsInstanceLicenseMonthlyPrice;
            const recommendedMachineDetails = updateRecommendedComputeMachineDetails(
                recommendedComputeDetails,
                awsInstanceLicenseMonthlyPrice
            );
            recommendedComputeDetails.machineDetails = recommendedMachineDetails;
            recommendedLicenseDetails.licenseIncluded = true;
            recommendedLicenseDetails.message = 'License included cost from AWS is cheaper than the BYOL cost';
        } else {
            recommendedLicenseDetails.licenseHourlyPrice = undefined;
            recommendedLicenseDetails.licenseIncluded = false;
            recommendedLicenseDetails.message = 'We could not find a cheaper license included cost';
        }
    }

    return { recommendedComputeDetails, recommendedLicenseDetails };
}

function getByolOrLicenseIncludedDetails(monthlySqlByolCost?: number, awsInstanceLicenseHourlyPrice?: number) {
    const licenseHourlyPrice =
        monthlySqlByolCost && monthlySqlByolCost > 0
            ? monthlySqlByolCost / HOURS_IN_MONTH
            : awsInstanceLicenseHourlyPrice;
    const licenseIncluded =
        monthlySqlByolCost && monthlySqlByolCost > 0
            ? false
            : !!(awsInstanceLicenseHourlyPrice && awsInstanceLicenseHourlyPrice > 0);
    const licenseFinding =
        monthlySqlByolCost &&
        awsInstanceLicenseHourlyPrice &&
        monthlySqlByolCost > awsInstanceLicenseHourlyPrice * HOURS_IN_MONTH
            ? FINDING.NOT_OPTIMIZED
            : undefined;

    return { licenseHourlyPrice, licenseIncluded, licenseFinding };
}

async function getSqlInstanceLicenseRecommendations(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2HostDetails: DiscoverResponseInfoType,
    monthlySqlByolCostPerHost?: number,
    isFsxwCalcs: boolean = false
) {
    logger.info('Getting sql instance and license recommendations', {
        accountId,
        credentialsId,
        region,
        ec2HostDetails
    });

    const { ec2InstanceId: instanceId, sqlServerInstances, ec2InstanceType, ec2UsageOperation } = ec2HostDetails;
    if (monthlySqlByolCostPerHost && ec2UsageOperation && WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation)) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'We dont support BYOL configuration for EC2 instances with pre-installed SQL Server license.'
        );
    }

    if (!isFsxwCalcs) {
        sqlServerInstances?.forEach(server => {
            if (
                server?.storage?.some(
                    storage => storage.type === STORAGE_TYPE.FSXW || storage.type === STORAGE_TYPE.FSXN
                )
            ) {
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    'FSx storage is not supported for storage savings breakdown.'
                );
            }
        });
    }

    const ebsVolumeIds = compact(
        sqlServerInstances?.flatMap(server =>
            server?.storage?.filter(storage => storage.type === STORAGE_TYPE.EBS).map(storage => storage.id)
        )
    );

    if (!isFsxwCalcs && ebsVolumeIds.length === 0) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'No EBS volumes found for the provided instance.');
    }

    if (sqlServerInstances && sqlServerInstances?.length > 0) {
        const { sqlServerEngineEdition, sqlServerEdition, sqlServerVersion, sqlServerDeploymentType, nodeIps } =
            fetchSqlServerInstanceConfiguration(sqlServerInstances) || {};
        if (ec2UsageOperation && sqlServerEngineEdition && sqlServerEdition && sqlServerDeploymentType) {
            let nodeInstances = [
                { ec2InstanceType, ec2InstanceId: instanceId, ec2UsageOperation, ec2InstancePrivateIpAddress: '' }
            ];

            if (!isFsxwCalcs && !ebsVolumeIds.length) {
                throw createError(
                    HttpErrorCodes.NOT_FOUND,
                    `No EBS volumes found for the provided instance: ${instanceId}`
                );
            }

            let instanceIdToUseForRecommendations = instanceId;

            let nodeInstanceTypes = [ec2InstanceType];
            if (
                (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT ||
                    (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT && isFsxwCalcs)) &&
                nodeIps &&
                nodeIps.length > 1
            ) {
                // in case of AOAG, we need to consider the smaller instance type for recommendations; as the AOAG is a combination of 2 or more instances

                const clusterNodeDetails: NodeDetails[] =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];

                nodeInstances = clusterNodeDetails.map(node => ({
                    ec2InstanceId: node.ec2InstanceId,
                    ec2InstanceType: node.ec2InstanceType,
                    ec2UsageOperation: node.ec2UsageOperation!,
                    ec2InstancePrivateIpAddress: node.ec2InstancePrivateIpAddress
                }));

                nodeInstanceTypes = clusterNodeDetails.map(node => node.ec2InstanceType);

                if (nodeInstances[0].ec2InstanceType !== nodeInstances[1].ec2InstanceType) {
                    const smallerInstanceType = await determineSmallerInstance(
                        region,
                        nodeInstanceTypes as _InstanceType[]
                    );
                    const smallerInstance = clusterNodeDetails.find(
                        node => node.ec2InstanceType === smallerInstanceType
                    );
                    instanceIdToUseForRecommendations = smallerInstance?.ec2InstanceId || instanceId;
                }
            }

            const monthlySqlByolCost = monthlySqlByolCostPerHost
                ? monthlySqlByolCostPerHost * nodeInstanceTypes.length
                : 0;
            const existingInstanceTypesPricingDetails = await deriveInstanceCountPricingDetails(
                nodeInstanceTypes,
                region
            );

            /*
            Edition: SERVERPROPERTY('Edition')
                        Edition	Installed product edition of the instance of SQL Server.Use the value of this property to determine the features and the limits, such as Compute capacity limits by edition of SQL Server. 64 - bit versions of the Database Engine append(64 - bit) to the version.
            Returns:
            'Enterprise Edition'
            'Enterprise Edition: Core-based Licensing'
            'Enterprise Evaluation Edition'
            'Business Intelligence Edition'
            'Developer Edition'
            'Express Edition'
            'Express Edition with Advanced Services'
            'Standard Edition'
            'Web Edition'
            'SQL Azure' indicates SQL Database or Azure Synapse Analytics
            'Azure SQL Edge Developer' indicates the development only edition for Azure SQL Edge
            'Azure SQL Edge' indicates the paid edition for Azure SQL Edge
            Base data type: nvarchar(128)

            */
            let existingCompute;
            let existingLicense;
            let recommendedCompute;
            let recommendedLicense;

            let computeFinding = FINDING.OPTIMIZED;
            let licenseFinding = FINDING.OPTIMIZED;
            const existingSqlServerEditionLowerCase = sqlServerEdition.toLowerCase();

            const existingInstanceHourlyPriceWithoutLicense = getPricingByLicenseType(
                'NA',
                existingInstanceTypesPricingDetails
            );

            const processorArchitecture =
                sqlServerEdition.match(/\((?<architecture>.*?)\)/)?.groups?.architecture || '';
            if (
                isNonFreeEnterpriseEdition(existingSqlServerEditionLowerCase) ||
                existingSqlServerEditionLowerCase.includes('web') ||
                existingSqlServerEditionLowerCase.includes('standard')
                /* CONSIDERING only instances with edition to lower case including
                    enterprise : 'Enterprise Edition','Enterprise Edition: Core-based Licensing','Enterprise Evaluation Edition'
                    standard : 'Standard Edition'
                    web : 'Web Edition'
                */
            ) {
                // pricing infor is only available for SQL Ent, SQL Std, SQL Web
                const existingLicenseType = existingSqlServerEditionLowerCase.includes('enterprise')
                    ? PRICING_LICENSE_KEYS.SQL_ENT
                    : existingSqlServerEditionLowerCase.includes('web')
                    ? PRICING_LICENSE_KEYS.SQL_WEB
                    : PRICING_LICENSE_KEYS.SQL_STD;

                let { licenseFinding: currentLicenseFinding, recommendedLicenseType: recommendedSqlLicenseType } =
                    sqlServerEngineEdition === ENT_ENGINE_EDITION
                        ? await getLicenseRecommendations(
                              accountId,
                              credentialsId,
                              region,
                              instanceId,
                              sqlServerInstances,
                              sqlServerDeploymentType
                          ) // returns SQL Ent or SQL Std
                        : { licenseFinding, recommendedLicenseType: existingLicenseType };

                const byolHourlyPrice = monthlySqlByolCost ? monthlySqlByolCost / HOURS_IN_MONTH : undefined;
                const byolInstancePrice =
                    byolHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                        ? existingInstanceHourlyPriceWithoutLicense + byolHourlyPrice
                        : undefined;

                let existingInstanceHourlyPrice = existingInstanceHourlyPriceWithoutLicense;
                if (byolInstancePrice || WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation)) {
                    existingInstanceHourlyPrice =
                        byolInstancePrice ||
                        getPricingByLicenseType(existingLicenseType, existingInstanceTypesPricingDetails); // existingInstanceHourlyPrice in inclusive of BYOL price or AWS license price
                }
                licenseFinding = currentLicenseFinding;

                // existing compute and license details
                existingCompute = {
                    price: existingInstanceHourlyPrice, // could be undefined if the pricing information is not available for a certain instance type
                    baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                    instanceType: nodeInstanceTypes.join(', '),
                    finding: computeFinding,
                    machineDetails: getMachineDetails(
                        nodeInstances,
                        existingInstanceTypesPricingDetails,
                        existingLicenseType,
                        monthlySqlByolCostPerHost
                    )
                };

                existingLicense = {
                    sqlServerEdition,
                    sqlServerVersion,
                    price:
                        existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                            ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                            : undefined, // existingInstanceHourlyPrice in inclusive of BYOL price or AWS license price
                    finding: licenseFinding
                };

                let recommendedInstanceHourlyPriceWithoutLicense: number | undefined = getPricingByLicenseType(
                    'NA',
                    existingInstanceTypesPricingDetails
                );

                let recommendedInstanceHourlyPrice: number | undefined = getPricingByLicenseType(
                    recommendedSqlLicenseType,
                    existingInstanceTypesPricingDetails
                ); // AWS instance pricing details for the recommended license type

                const recommendedLicenseHourlyPrice =
                    recommendedInstanceHourlyPrice && recommendedInstanceHourlyPriceWithoutLicense
                        ? recommendedInstanceHourlyPrice - recommendedInstanceHourlyPriceWithoutLicense
                        : undefined; // license price for the recommended license type for the current instance type from AWS license included machine

                let awsLicenseIncluded = WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation);

                let recommendedLicenseMessage;

                if (byolHourlyPrice) {
                    if (
                        existingLicenseType === PRICING_LICENSE_KEYS.SQL_ENT &&
                        recommendedSqlLicenseType !== existingLicenseType &&
                        recommendedLicenseHourlyPrice! < byolHourlyPrice
                    ) {
                        // change to AWS AMI with license included is cheaper than BYOL
                        awsLicenseIncluded = true;
                        recommendedLicenseMessage =
                            'SQL license costs for SQL on FSx for ONTAP are based on the Standard SQL license with AWS ami based while SQL license costs for SQL on Elastic Block Store are based on the Enterprise license with BYOL. According to our findings, the SQL license cost is optimal when using FSx for ONTAP.';
                    } else {
                        // return existing BYOL as recommended
                        awsLicenseIncluded = false;
                        recommendedInstanceHourlyPrice =
                            byolHourlyPrice + recommendedInstanceHourlyPriceWithoutLicense!;
                        // User shall view in the cost breakdown the compared sql license included only if src edition was Ent and we recommend using Stan
                        // if the recommended license type is SQL Std ; but the BYOL price is cheaper than the recommended SQL Std price, then do not recommend the license change
                        recommendedSqlLicenseType = existingLicenseType;
                    }
                }

                // instance recommendation logic, applicable only for ebs storage savings calculations
                ({ computeFinding, recommendedCompute } = !isFsxwCalcs
                    ? await handleInstanceRecommendation(
                          accountId,
                          credentialsId,
                          region,
                          instanceIdToUseForRecommendations,
                          nodeInstances,
                          ebsVolumeIds,
                          sqlServerDeploymentType,
                          recommendedSqlLicenseType,
                          ec2InstanceType,
                          existingLicenseType,
                          existingInstanceTypesPricingDetails,
                          nodeInstanceTypes.length,
                          recommendedInstanceHourlyPrice, // license type is already identified, so use the price for the recommended license type which is essentially existingInstanceTypePricingDetails?.[recommendedSqlLicenseType]?.pricePerUnit || byolHourlyPrice
                          recommendedInstanceHourlyPriceWithoutLicense,
                          awsLicenseIncluded,
                          ec2UsageOperation,
                          monthlySqlByolCostPerHost
                      )
                    : {
                          computeFinding,
                          recommendedCompute: getExistingAsRecommended(
                              nodeInstanceTypes.length,
                              ec2InstanceType,
                              ec2UsageOperation,
                              recommendedSqlLicenseType,
                              existingInstanceTypesPricingDetails,
                              recommendedInstanceHourlyPrice,
                              recommendedInstanceHourlyPriceWithoutLicense,
                              monthlySqlByolCostPerHost,
                              'No Instance change recommended'
                          )
                      });
                existingCompute.finding = computeFinding;

                // applicable only in case of EBS storage savings calculations
                if (!isFsxwCalcs) {
                    recommendedInstanceHourlyPrice = recommendedCompute.price;
                    recommendedInstanceHourlyPriceWithoutLicense = recommendedCompute.baseInstancePrice;
                }
                // sql license recommendation logic; applicable only if the current instance is enterprise edition(sqlServerEngineEdition === 3)
                // it either returns SQL Ent or SQL Std

                let recommendedLicensePrice = 0; // license price is relevant only if BYOL or SQL based AMI is used
                if (byolInstancePrice || WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation)) {
                    recommendedLicensePrice =
                        recommendedInstanceHourlyPrice && recommendedInstanceHourlyPriceWithoutLicense
                            ? recommendedInstanceHourlyPrice - recommendedInstanceHourlyPriceWithoutLicense
                            : 0;
                }
                if (
                    sqlServerEngineEdition === ENT_ENGINE_EDITION &&
                    recommendedSqlLicenseType === PRICING_LICENSE_KEYS.SQL_STD &&
                    recommendedSqlLicenseType !== existingLicenseType
                ) {
                    recommendedLicense = {
                        sqlServerEdition: `Standard Edition (${processorArchitecture})`,
                        sqlServerVersion,
                        price: recommendedLicensePrice,
                        message: recommendedLicenseMessage
                    };
                } else {
                    const message =
                        sqlServerEngineEdition !== ENT_ENGINE_EDITION
                            ? 'No license change recommended as you are already using a non-enterprise edition'
                            : recommendedSqlLicenseType === existingLicenseType
                            ? 'Need not change the license as the recommended type is the same as the existing license type'
                            : 'License Recommendations not available for the instance';

                    recommendedLicense = {
                        sqlServerEdition,
                        sqlServerVersion,
                        price: recommendedLicensePrice, // recommendedInstanceHourlyPrice is considering the recommendedSqlLicenseType which in this case is what was existing previously, ( existingInstanceTypePricingDetails?.[recommendedSqlLicenseType]?.pricePerUnit )
                        message
                    };
                }
            } else {
                // for enterprise evaluation, express, developer, business intelligence, azure sql, azure sql edge, azure sql edge developer editions; license price is O.. hence no license price and no license recommendation (NA), only compute recommendation based on existing instance usage pattern
                if (monthlySqlByolCost) {
                    throw createError(
                        HttpErrorCodes.BAD_REQUEST,
                        'BYOL License is not supported for the provided SQL server edition.'
                    );
                }
                ({ computeFinding, recommendedCompute } = !isFsxwCalcs
                    ? await handleInstanceRecommendation(
                          accountId,
                          credentialsId,
                          region,
                          instanceIdToUseForRecommendations,
                          nodeInstances,
                          ebsVolumeIds,
                          sqlServerDeploymentType,
                          'NA',
                          ec2InstanceType,
                          'NA',
                          existingInstanceTypesPricingDetails,
                          nodeInstanceTypes.length,
                          existingInstanceHourlyPriceWithoutLicense,
                          existingInstanceHourlyPriceWithoutLicense
                      )
                    : {
                          computeFinding,
                          recommendedCompute: getExistingAsRecommended(
                              nodeInstanceTypes.length,
                              ec2InstanceType,
                              ec2UsageOperation,
                              'NA',
                              existingInstanceTypesPricingDetails,
                              existingInstanceHourlyPriceWithoutLicense,
                              existingInstanceHourlyPriceWithoutLicense,
                              monthlySqlByolCostPerHost,
                              'No Instance change recommended'
                          )
                      });
                existingCompute = {
                    finding: computeFinding,
                    price: existingInstanceHourlyPriceWithoutLicense, // could be undefined if the pricing information is not available for a certain instance type
                    baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                    instanceType: ec2InstanceType
                };
                existingLicense = {
                    finding: licenseFinding,
                    sqlServerEdition,
                    sqlServerVersion,
                    price: 0
                };
                recommendedLicense = existingLicense;
            }

            return {
                existingCompute,
                existingLicense,
                recommendedCompute,
                recommendedLicense
            };
        }
        const errMsg = `Unable to determine the SQL Server instance configuration. Instance ID: ${instanceId}`;
        logger.error(errMsg);
        throw createError(errMsg);
    }
    throw createError('No SQL Server instances found for the provided EC2 instance.');
}

function isNonFreeEnterpriseEdition(sqlServerEdition: string) {
    const existingSqlServerEditionLowerCase = sqlServerEdition.toLowerCase();
    return (
        existingSqlServerEditionLowerCase.includes('enterprise') &&
        !existingSqlServerEditionLowerCase.includes('evaluation') &&
        !existingSqlServerEditionLowerCase.includes('developer')
    );
}

export {
    getLicenseRecommendations,
    fetchSqlServerInstanceConfiguration,
    manualModeComputeLicenseDetails,
    getSqlInstanceLicenseRecommendations,
    checkComputeOptimizerEnrollmentStatus,
    isNonFreeEnterpriseEdition
};
