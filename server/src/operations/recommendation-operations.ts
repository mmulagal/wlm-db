import createError from 'http-errors';
import { compact, groupBy } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import { STORAGE_TYPE } from '@prisma/client';
import { HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import { getInstanceRecommendations } from './aws/compute-optimizer-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { ENTERPRISE_CHECK_QUERY } from './workloads/mssql/queries';
import { getSqlInstancePricingDetails } from './aws/pricing-operations';
import getLogger from '../utils/logger';
import { determineSmallerInstance, getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { NodeDetails } from '../utils/common-types';
import { DiscoverResponseInfoType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import { getDatabaseInstanceName } from '../utils/utils';

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

    const runningEnterpriseEditionSqlServerInstances = sqlServerInstances.filter(
        sqlServerInstance =>
            sqlServerInstance.sqlServerEngineEdition === ENT_ENGINE_EDITION &&
            sqlServerInstance.sqlServerState === 'Running' &&
            sqlServerInstance.sqlServerDeploymentType === sqlServerDeploymentType
    );

    const usingEnterpriseConfiguration = runningEnterpriseEditionSqlServerInstances.some(async sqlServerInstance =>
        isUsingEnterpriseConfiguration(accountId, credentialsId, region, instanceId, sqlServerInstance)
    );

    if (!usingEnterpriseConfiguration) {
        return SQL_STD;
    }
    return SQL_ENT;
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
        return processSqlInstances(sqlCombination[ENT_ENGINE_EDITION], 'Enterprise');
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

    return sqlServerInstances[0];
}

export default async function getSqlInstanceLicenseRecommendations(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2HostDetails: DiscoverResponseInfoType
) {
    logger.info('Getting sql instance and license recommendations', {
        accountId,
        credentialsId,
        region,
        ec2HostDetails
    });

    const { ec2InstanceId: instanceId, sqlServerInstances } = ec2HostDetails;
    // considering EC2 instances with all SQL server instances with EBS volumes ONLY, as we are calculating EBS savings; if there is any other storage then NOT considering such an instance; not even a combination of EBS and FSX too
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

    if (ec2HostDetails?.sqlServerInstances && ec2HostDetails?.sqlServerInstances?.length > 0) {
        const { sqlServerEngineEdition, sqlServerEdition, sqlServerVersion, sqlServerDeploymentType, nodeIps } =
            fetchSqlServerInstanceConfiguration(ec2HostDetails?.sqlServerInstances) || {};
        if (
            ec2HostDetails?.ec2UsageOperation &&
            sqlServerEngineEdition &&
            sqlServerEdition &&
            sqlServerDeploymentType
        ) {
            let nodeInstanceTypes = [ec2HostDetails?.ec2InstanceType];

            if (!ebsVolumeIds.length) {
                throw createError(
                    HttpErrorCodes.NOT_FOUND,
                    `No EBS volumes found for the provided instance: ${instanceId}`
                );
            }

            let instanceIdToUseForRecommendations = instanceId;

            if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && nodeIps && nodeIps.length > 1) {
                // in case of AOAG, we need to consider the smaller instance type for recommendations; as the AOAG is a combination of 2 or more instances
                const clusterNodeDetails: NodeDetails[] =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
                nodeInstanceTypes = clusterNodeDetails.map(node => node.ec2InstanceType);

                if (nodeInstanceTypes[0] !== nodeInstanceTypes[1]) {
                    const smallerInstanceType = await determineSmallerInstance(
                        region,
                        credentialsId,
                        nodeInstanceTypes as _InstanceType[]
                    );
                    const smallerInstance = clusterNodeDetails.find(
                        node => node.ec2InstanceType === smallerInstanceType
                    );
                    instanceIdToUseForRecommendations = smallerInstance?.ec2InstanceId || instanceId;
                }
            }

            const existingInstanceTypePricingDetails = await getSqlInstancePricingDetails(
                region,
                ec2HostDetails.ec2InstanceType as _InstanceType,
                'windows'
                // ec2HostDetails.ec2UsageOperation // use usage operation as a filter when supporting other OS; edition has a value like `Enterprise Evaluation Edition (64-bit)` does not narrow down operating system
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
            const existingSqlServerEditionLowerCase = sqlServerEdition.toLowerCase();

            const existingInstanceHourlyPriceWithoutLicense = existingInstanceTypePricingDetails?.NA?.pricePerUnit
                ? existingInstanceTypePricingDetails.NA.pricePerUnit
                : undefined;

            const processorArchitecture =
                sqlServerEdition.match(/\((?<architecture>.*?)\)/)?.groups?.architecture || '';
            if (
                existingSqlServerEditionLowerCase.includes('enterprise') ||
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
                const existingInstanceHourlyPrice = existingInstanceTypePricingDetails?.[existingLicenseType]
                    ?.pricePerUnit
                    ? existingInstanceTypePricingDetails[existingLicenseType].pricePerUnit
                    : undefined;

                const recommendedSqlLicenseType =
                    sqlServerEngineEdition === ENT_ENGINE_EDITION
                        ? await getLicenseRecommendations(
                              accountId,
                              credentialsId,
                              region,
                              instanceId,
                              ec2HostDetails.sqlServerInstances,
                              sqlServerDeploymentType
                          ) // returns SQL Ent or SQL Std
                        : existingLicenseType;

                let recommendedInstancePricingDetails = existingInstanceTypePricingDetails; // assuming no instance type change; gets updated when a diff instance is recommended

                let recommendedInstanceHourlyPrice = existingInstanceTypePricingDetails?.[recommendedSqlLicenseType]
                    ?.pricePerUnit
                    ? existingInstanceTypePricingDetails[recommendedSqlLicenseType].pricePerUnit
                    : undefined;
                let recommendedInstanceHourlyPriceWithoutLicense = existingInstanceTypePricingDetails?.NA?.pricePerUnit
                    ? existingInstanceTypePricingDetails.NA.pricePerUnit
                    : undefined;

                // existing compute and license details
                existingCompute = {
                    price: existingInstanceHourlyPrice, // could be undefined if the pricing information is not available for a certain instance type
                    baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                    instanceType: ec2HostDetails.ec2InstanceType
                };

                existingLicense = {
                    sqlServerEdition,
                    sqlServerVersion,
                    price:
                        existingInstanceHourlyPrice && existingInstanceHourlyPriceWithoutLicense
                            ? existingInstanceHourlyPrice - existingInstanceHourlyPriceWithoutLicense
                            : undefined
                };

                // instance recommendation logic
                try {
                    const instanceRecommendation = await getInstanceRecommendations(
                        region,
                        credentialsId,
                        accountId,
                        instanceIdToUseForRecommendations,
                        ebsVolumeIds,
                        sqlServerDeploymentType
                    );
                    const { instanceType: recommendedInstanceType } = instanceRecommendation;

                    if (recommendedInstanceType && ec2HostDetails.ec2InstanceType !== recommendedInstanceType) {
                        recommendedInstancePricingDetails = await getSqlInstancePricingDetails(
                            region,
                            recommendedInstanceType as _InstanceType,
                            'windows', // TODO: fetch operating system from existing instance when supporting other instance operating systems
                            undefined // not using usage operation as a filter; usage operation is related to standard/enterprise but not for an operating system
                        );
                        recommendedInstanceHourlyPrice =
                            recommendedSqlLicenseType &&
                            recommendedInstancePricingDetails?.[recommendedSqlLicenseType]?.pricePerUnit
                                ? recommendedInstancePricingDetails[recommendedSqlLicenseType].pricePerUnit
                                : undefined;

                        recommendedInstanceHourlyPriceWithoutLicense = recommendedInstancePricingDetails?.NA
                            ?.pricePerUnit
                            ? recommendedInstancePricingDetails.NA.pricePerUnit
                            : undefined;
                        recommendedCompute = {
                            price: recommendedInstanceHourlyPrice,
                            baseInstancePrice: recommendedInstanceHourlyPriceWithoutLicense,
                            instanceType: recommendedInstanceType
                        };
                    } else {
                        const message =
                            ec2HostDetails.ec2InstanceType === recommendedInstanceType
                                ? 'No instance change recommended as per Compute Optimizer'
                                : 'Instance Recommendations not available for the instance';

                        recommendedCompute = {
                            price: existingInstanceHourlyPrice,
                            baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                            instanceType: ec2HostDetails.ec2InstanceType,
                            message
                        };
                    }
                } catch (error: any) {
                    logger.error('Error getting instance recommendations', {
                        error: error.message,
                        accountId,
                        region,
                        instanceId
                    });

                    recommendedCompute = {
                        price: existingInstanceHourlyPrice,
                        baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                        instanceType: ec2HostDetails.ec2InstanceType,
                        message: error.message
                    };
                }

                // sql license recommendation logic; applicable only if the current instance is enterprise edition(sqlServerEngineEdition === 3)
                // it either returns SQL Ent or SQL Std
                if (
                    sqlServerEngineEdition === ENT_ENGINE_EDITION &&
                    recommendedSqlLicenseType === SQL_STD &&
                    recommendedSqlLicenseType !== existingLicenseType
                ) {
                    recommendedLicense = {
                        sqlServerEdition: `Standard Edition ${processorArchitecture}`,
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
                // for express, developer, business intelligence, azure sql, azure sql edge, azure sql edge developer editions
                existingCompute = {
                    price: existingInstanceHourlyPriceWithoutLicense, // could be undefined if the pricing information is not available for a certain instance type
                    baseInstancePrice: existingInstanceHourlyPriceWithoutLicense,
                    instanceType: ec2HostDetails.ec2InstanceType
                };
                existingLicense = {
                    sqlServerEdition,
                    sqlServerVersion,
                    price: 0
                };
                recommendedCompute = existingCompute;
                recommendedLicense = existingLicense;
            }

            return {
                existingCompute,
                existingLicense,
                recommendedCompute,
                recommendedLicense
            };
        }
    }
    throw createError('No SQL Server instances found for the provided EC2 instance.');
}
