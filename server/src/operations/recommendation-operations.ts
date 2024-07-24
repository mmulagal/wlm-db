import createError from 'http-errors';
import { compact, groupBy } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import { STORAGE_TYPE } from '@prisma/client';
import {
    FINDING,
    HOURS_IN_MONTH,
    HttpErrorCodes,
    SQL_SERVICE_STATE,
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

const logger = getLogger();

const SQL_ENT = 'SQL Ent';
const SQL_STD = 'SQL Std';
const SQL_WEB = 'SQL Web';

/*
sqlServerEngineEdition = EngineEdition	Database Engine edition of the instance of SQL Server installed on the server.
    2 = Standard (For Standard, Web, and Business Intelligence.)
    3 = Enterprise (For Evaluation, Developer, and Enterprise editions.)
    */
const ENT_ENGINE_EDITION = 3;
const STD_ENGINE_EDITION = 2;

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

    const { isDefaultInstance, sqlServerInstance } = sqlServerInstanceInfo;
    const sqlServerName = getDatabaseInstanceName(sqlServerInstance, isDefaultInstance);

    const command = [`sqlcmd -S "${sqlServerName}" -Q "${ENTERPRISE_CHECK_QUERY}" -y 0`];

    const checkEnterpriseConfigurationList = await callSsmExecution(
        credentialsId,
        region,
        command,
        instanceId,
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
        runningEnterpriseEditionSqlServerInstances.map(sqlServerInstance =>
            isUsingEnterpriseConfiguration(accountId, credentialsId, region, instanceId, sqlServerInstance)
        )
    );
    const usingEnterpriseConfiguration = enterpriseUsageResults.some(result => result);

    let recommendedLicenseType = SQL_ENT;
    if (!usingEnterpriseConfiguration) {
        licenseFinding = FINDING.NOT_OPTIMIZED;
        recommendedLicenseType = SQL_STD;
    }
    return { licenseFinding, recommendedLicenseType };
}

/* The function processes the SQL Server instances based on the edition and deployment type. If there are multiple sql server instances of a certain edition with both AOAG and Standalone configuration, then AOAG configuration is given preference fist */
function processSqlInstances(sqlInstances: SqlServerInstanceInfoType[], edition: string) {
    logger.debug('Processing SQL Server instances', { sqlInstances, edition });

    const filteredInstances = sqlInstances.filter(({ sqlServerEdition = '' }) => sqlServerEdition.includes(edition));
    if (filteredInstances.length > 0) {
        const groupByDeploymentType = groupBy(filteredInstances, 'sqlServerDeploymentType');
        return groupByDeploymentType[SqlServerDeploymentModel.SQL_AOAG_SHORT]?.[0] || filteredInstances[0];
    }
}

function fetchSqlServerInstanceConfiguration(sqlServerInstances: SqlServerInstanceInfoType[]) {
    logger.info('Fetching SQL Server instance configuration', { sqlServerInstances });
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

function getExistingAsRecommended(
    totalNodesCount: number,
    existingInstanceType: string,
    existingInstanceHourlyPrice?: number,
    existingInstanceHourlyPriceWithoutLicense?: number,
    message?: string
) {
    const recommendedNodeInstanceTypes = Array(totalNodesCount).fill(existingInstanceType);
    const rinstanceMonthlyPrice = existingInstanceHourlyPrice
        ? getMonthlyPriceFromHourlyPrice(existingInstanceHourlyPrice)
        : undefined;
    const rcomputeMonthlyPrice = existingInstanceHourlyPriceWithoutLicense
        ? getMonthlyPriceFromHourlyPrice(existingInstanceHourlyPriceWithoutLicense)
        : undefined;
    return {
        price: existingInstanceHourlyPrice,
        baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
        instanceType: recommendedNodeInstanceTypes.join(', '),
        machineDetails: recommendedNodeInstanceTypes.map(instanceType => ({
            instanceType,
            price: existingInstanceHourlyPrice,
            basePrice: existingInstanceHourlyPriceWithoutLicense,
            computeMonthlyPrice: rcomputeMonthlyPrice,
            instanceMonthlyPrice: rinstanceMonthlyPrice,
            licenseMonthlyPrice:
                rcomputeMonthlyPrice !== undefined && rinstanceMonthlyPrice !== undefined
                    ? rinstanceMonthlyPrice - rcomputeMonthlyPrice
                    : undefined,
            hoursInMonth: HOURS_IN_MONTH,
            licenseIncluded: true // recommending an instance with the license included
        })),
        message,
        recommendationOptions: []
    };
}

async function handleInstanceRecommendation(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIdToUseForRecommendations: string,
    ebsVolumeIds: string[],
    sqlServerDeploymentType: string,
    recommendedSqlLicenseType: any,
    existingInstanceType: string,
    totalNodesCount: number,
    existingInstanceHourlyPrice?: number,
    existingInstanceHourlyPriceWithoutLicense?: number
) {
    logger.info('Handling instance recommendations', {
        accountId,
        credentialsId,
        region,
        instanceIdToUseForRecommendations,
        ebsVolumeIds,
        sqlServerDeploymentType,
        recommendedSqlLicenseType,
        existingInstanceType,
        existingInstanceHourlyPrice,
        existingInstanceHourlyPriceWithoutLicense,
        totalNodesCount
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
            ebsVolumeIds,
            sqlServerDeploymentType
        );
        const [{ instanceType: recommendedInstanceType = '' } = {}] = instanceRecommendations || [];

        if (recommendedInstanceType && existingInstanceType !== recommendedInstanceType) {
            const recommendedInstancePricingDetails = await getSqlInstancePricingDetails(
                region,
                recommendedInstanceType as _InstanceType,
                'windows', // TODO: fetch operating system from existing instance when supporting other instance operating systems
                undefined // not using usage operation as a filter; usage operation is related to standard/enterprise but not for an operating system
            );
            const recommendedInstanceHourlyPrice = recommendedInstancePricingDetails?.[recommendedSqlLicenseType]
                ?.pricePerUnit
                ? recommendedInstancePricingDetails[recommendedSqlLicenseType].pricePerUnit
                : undefined;

            const recommendedInstanceHourlyPriceWithoutLicense = recommendedInstancePricingDetails?.NA?.pricePerUnit
                ? recommendedInstancePricingDetails.NA.pricePerUnit
                : undefined;

            computeFinding = finding;
            const recommendedNodeInstanceTypes = Array(totalNodesCount).fill(recommendedInstanceType);
            const rinstanceMonthlyPrice = recommendedInstanceHourlyPrice
                ? getMonthlyPriceFromHourlyPrice(recommendedInstanceHourlyPrice)
                : undefined;
            const rcomputeMonthlyPrice = recommendedInstanceHourlyPriceWithoutLicense
                ? getMonthlyPriceFromHourlyPrice(recommendedInstanceHourlyPriceWithoutLicense)
                : undefined;
            recommendedCompute = {
                price: recommendedInstanceHourlyPrice
                    ? recommendedInstanceHourlyPrice * totalNodesCount
                    : recommendedInstanceHourlyPrice,
                baseInstancePrice: recommendedInstanceHourlyPriceWithoutLicense
                    ? recommendedInstanceHourlyPriceWithoutLicense * totalNodesCount
                    : recommendedInstanceHourlyPriceWithoutLicense,
                instanceType: recommendedNodeInstanceTypes.join(', '),
                machineDetails: recommendedNodeInstanceTypes.map(instanceType => ({
                    instanceType,
                    price: recommendedInstanceHourlyPrice,
                    basePrice: recommendedInstanceHourlyPriceWithoutLicense,
                    computeMonthlyPrice: rcomputeMonthlyPrice,
                    instanceMonthlyPrice: rinstanceMonthlyPrice,
                    licenseMonthlyPrice:
                        rcomputeMonthlyPrice !== undefined && rinstanceMonthlyPrice !== undefined
                            ? rinstanceMonthlyPrice - rcomputeMonthlyPrice
                            : undefined,
                    hoursInMonth: HOURS_IN_MONTH,
                    licenseIncluded: true // recommending an instance with the license included; TODO: change this logic when supporting BYOL; i.e if the recommended Standard instance with license included is expensive than the existing Enterprise instance with BYOL; change the licenseIncluded to false
                })),
                recommendationOptions: instanceRecommendations?.map(({ instanceType, pricingDetails }) => {
                    const basePrice = pricingDetails?.NA?.pricePerUnit;
                    const price = pricingDetails[recommendedSqlLicenseType]?.pricePerUnit;
                    const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(price);
                    const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(basePrice);
                    return {
                        instanceType,
                        price,
                        basePrice,
                        computeMonthlyPrice,
                        instanceMonthlyPrice,
                        licenseMonthlyPrice:
                            computeMonthlyPrice !== undefined && instanceMonthlyPrice !== undefined
                                ? instanceMonthlyPrice - computeMonthlyPrice
                                : undefined,
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
                existingInstanceHourlyPrice,
                existingInstanceHourlyPriceWithoutLicense,
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
            existingInstanceHourlyPrice,
            existingInstanceHourlyPriceWithoutLicense,
            error.message
        );
    }

    return { computeFinding, recommendedCompute };
}

function getPricingByLicenseType(
    licenseType: string,
    existingInstanceTypePricingsDetails: Map<
        string,
        { count: number; pricingDetails: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } } }
    >
): number | undefined {
    logger.info('Getting pricing by license type', { licenseType, existingInstanceTypePricingsDetails });
    let instanceHourlyPrice: number | undefined;
    for (const [, { count, pricingDetails }] of existingInstanceTypePricingsDetails) {
        if (pricingDetails[licenseType]?.pricePerUnit) {
            instanceHourlyPrice = Number(instanceHourlyPrice || 0) + pricingDetails[licenseType].pricePerUnit * count;
        }
    }

    return instanceHourlyPrice;
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

export default async function getSqlInstanceLicenseRecommendations(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2HostDetails: DiscoverResponseInfoType,
    partnerNodeDetails?: DiscoverResponseInfoType[]
) {
    logger.info('Getting sql instance and license recommendations', {
        accountId,
        credentialsId,
        region,
        ec2HostDetails,
        partnerNodeDetails
    });

    let { ec2InstanceId: instanceId, sqlServerInstances, ec2InstanceType, ec2UsageOperation } = ec2HostDetails;
    // considering EC2 instances with all SQL server instances with EBS volumes ONLY, as we are calculating EBS savings; if there is any other storage then NOT considering such an instance; not even a combination of EBS and FSX too

    partnerNodeDetails?.forEach(partnerNode => {
        const { sqlServerInstances: partnerSqlServerInstances } = partnerNode;
        if (partnerSqlServerInstances && partnerSqlServerInstances?.length > 0) {
            sqlServerInstances = sqlServerInstances?.concat(partnerSqlServerInstances);
        }
    });

    sqlServerInstances?.forEach(server => {
        if (
            server?.storage?.some(storage => storage.type === STORAGE_TYPE.FSXW || storage.type === STORAGE_TYPE.FSXN)
        ) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'FSx storage is not supported for storage savings breakdown.'
            );
        }
    });

    const ebsVolumeIds = compact(
        sqlServerInstances?.flatMap(server =>
            server?.storage?.filter(storage => storage.type === STORAGE_TYPE.EBS).map(storage => storage.id)
        )
    );

    if (ebsVolumeIds.length === 0) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'No EBS volumes found for the provided instance.');
    }

    if (sqlServerInstances && sqlServerInstances?.length > 0) {
        const { sqlServerEngineEdition, sqlServerEdition, sqlServerVersion, sqlServerDeploymentType, nodeIps } =
            fetchSqlServerInstanceConfiguration(sqlServerInstances) || {};
        if (ec2UsageOperation && sqlServerEngineEdition && sqlServerEdition && sqlServerDeploymentType) {
            let nodeInstances = [{ ec2InstanceType, ec2InstanceId: instanceId, ec2UsageOperation }];

            if (!ebsVolumeIds.length) {
                throw createError(
                    HttpErrorCodes.NOT_FOUND,
                    `No EBS volumes found for the provided instance: ${instanceId}`
                );
            }

            let instanceIdToUseForRecommendations = instanceId;

            let nodeInstanceTypes = [ec2InstanceType];
            if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && nodeIps && nodeIps.length > 1) {
                // in case of AOAG, we need to consider the smaller instance type for recommendations; as the AOAG is a combination of 2 or more instances

                const clusterNodeDetails: NodeDetails[] =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
                nodeInstances = clusterNodeDetails.map(node => ({
                    ec2InstanceType: node.ec2InstanceType,
                    ec2InstanceId: node.ec2InstanceId,
                    ec2UsageOperation: node.ec2UsageOperation!
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
                (existingSqlServerEditionLowerCase.includes('enterprise') &&
                    !existingSqlServerEditionLowerCase.includes('evaluation')) ||
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
                    ? SQL_ENT
                    : existingSqlServerEditionLowerCase.includes('web')
                    ? SQL_WEB
                    : SQL_STD;
                const existingInstanceHourlyPrice = getPricingByLicenseType(
                    existingLicenseType,
                    existingInstanceTypesPricingDetails
                );

                const { licenseFinding: currentLicenseFinding, recommendedLicenseType: recommendedSqlLicenseType } =
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
                licenseFinding = currentLicenseFinding;

                let recommendedInstanceHourlyPrice: number | undefined = getPricingByLicenseType(
                    recommendedSqlLicenseType,
                    existingInstanceTypesPricingDetails
                );

                let recommendedInstanceHourlyPriceWithoutLicense: number | undefined = getPricingByLicenseType(
                    'NA',
                    existingInstanceTypesPricingDetails
                );
                // existing compute and license details
                existingCompute = {
                    price: existingInstanceHourlyPrice, // could be undefined if the pricing information is not available for a certain instance type
                    baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                    instanceType: nodeInstanceTypes.join(', '),
                    finding: computeFinding,
                    machineDetails: nodeInstances.map(
                        ({ ec2InstanceType: instanceType, ec2UsageOperation: usageOperation }) => {
                            const instanceMonthlyPrice = getMonthlyPriceFromHourlyPrice(
                                existingInstanceTypesPricingDetails.get(instanceType)?.pricingDetails[
                                    existingLicenseType
                                ]?.pricePerUnit
                            );
                            const computeMonthlyPrice = getMonthlyPriceFromHourlyPrice(
                                existingInstanceTypesPricingDetails.get(instanceType)?.pricingDetails.NA?.pricePerUnit
                            );

                            return {
                                instanceType,
                                price: existingInstanceTypesPricingDetails.get(instanceType)?.pricingDetails[
                                    existingLicenseType
                                ]?.pricePerUnit,
                                basePrice:
                                    existingInstanceTypesPricingDetails.get(instanceType)?.pricingDetails.NA
                                        ?.pricePerUnit,
                                computeMonthlyPrice,
                                instanceMonthlyPrice,
                                licenseMonthlyPrice:
                                    computeMonthlyPrice !== undefined && instanceMonthlyPrice !== undefined
                                        ? instanceMonthlyPrice - computeMonthlyPrice
                                        : undefined,
                                hoursInMonth: HOURS_IN_MONTH,
                                licenseIncluded: WIN_SQL_EC2_USAGE_OPERATION.includes(usageOperation)
                            };
                        }
                    )
                };

                existingLicense = {
                    sqlServerEdition,
                    sqlServerVersion,
                    price:
                        existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                            ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                            : undefined,
                    finding: licenseFinding
                };

                // instance recommendation logic
                ({ computeFinding, recommendedCompute } = await handleInstanceRecommendation(
                    accountId,
                    credentialsId,
                    region,
                    instanceIdToUseForRecommendations,
                    ebsVolumeIds,
                    sqlServerDeploymentType,
                    recommendedSqlLicenseType,
                    ec2InstanceType,
                    nodeInstanceTypes.length,
                    recommendedInstanceHourlyPrice, // license type is already identified, so use the price for the recommended license type which is essentially existingInstanceTypePricingDetails?.[recommendedSqlLicenseType]?.pricePerUnit
                    recommendedInstanceHourlyPriceWithoutLicense
                ));
                existingCompute.finding = computeFinding;
                recommendedInstanceHourlyPrice = recommendedCompute.price;
                recommendedInstanceHourlyPriceWithoutLicense = recommendedCompute.baseInstancePrice;

                // sql license recommendation logic; applicable only if the current instance is enterprise edition(sqlServerEngineEdition === 3)
                // it either returns SQL Ent or SQL Std
                if (
                    sqlServerEngineEdition === ENT_ENGINE_EDITION &&
                    recommendedSqlLicenseType === SQL_STD &&
                    recommendedSqlLicenseType !== existingLicenseType
                ) {
                    recommendedLicense = {
                        sqlServerEdition: `Standard Edition (${processorArchitecture})`,
                        sqlServerVersion,
                        price:
                            recommendedInstanceHourlyPrice && recommendedInstanceHourlyPriceWithoutLicense
                                ? recommendedInstanceHourlyPrice - recommendedInstanceHourlyPriceWithoutLicense
                                : undefined
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
                        price:
                            existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                                ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                                : undefined,
                        message
                    };
                }
            } else {
                // for enterprise evaluation, express, developer, business intelligence, azure sql, azure sql edge, azure sql edge developer editions
                ({ computeFinding, recommendedCompute } = await handleInstanceRecommendation(
                    accountId,
                    credentialsId,
                    region,
                    instanceIdToUseForRecommendations,
                    ebsVolumeIds,
                    sqlServerDeploymentType,
                    'NA',
                    ec2InstanceType,
                    nodeInstanceTypes.length,
                    existingInstanceHourlyPriceWithoutLicense,
                    existingInstanceHourlyPriceWithoutLicense
                ));
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
