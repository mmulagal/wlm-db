import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import { STORAGE_TYPE } from '@prisma/client';
import { getHostAndSqlServerInfo } from './discover-operations';
import { HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import { StorageSavingsRequestBodyType } from '../routes/types/storage-savings.types';
import { getInstanceRecommendations } from './aws/compute-optimizer-operations';
import { performStorageSavingsCalculations } from './cloud-manager/marketing-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { ENTERPRISE_CHECK_QUERY } from './workloads/mssql/queries';
import { getSqlInstancePricingDetails } from './aws/pricing-operations';
import getLogger from '../utils/logger';
import { determineSmallerInstance, getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { NodeDetails } from '../utils/common-types';

const logger = getLogger();

async function isUsingEnterpriseConfiguration(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string
) {
    logger.debug('Checking if the instance is using any enterprise features', {
        accountId,
        credentialsId,
        region,
        instanceId
    });

    const command = [`sqlcmd -Q "${ENTERPRISE_CHECK_QUERY}" -y 0`];

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

async function getLicenseRecommendations(accountId: string, credentialsId: string, region: string, instanceId: string) {
    logger.info('Getting license recommendations', { accountId, credentialsId, region, instanceId });
    /*
           if the existing license engine is Enterprise but the instance is not using any enterprise features, recommend Standard

           EngineEdition	Database Engine edition of the instance of SQL Server installed on the server.

           2 = Standard (For Standard, Web, and Business Intelligence.)https://learn.microsoft.com/en-us/sql/t-sql/functions/serverproperty-transact-sql?view=sql-server-ver16#:~:text=data%20type%3A%20bigint-,EngineEdition,-Database%20Engine%20edition
           3 = Enterprise (For Evaluation, Developer, and Enterprise editions.)

    */

    const usingEnterpriseConfiguration = await isUsingEnterpriseConfiguration(
        accountId,
        credentialsId,
        region,
        instanceId
    );

    if (!usingEnterpriseConfiguration) {
        return 'SQL Std';
    }
    return 'SQL Ent';
}

export default async function getStorageSavingsBreakdown(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params: StorageSavingsRequestBodyType
) {
    logger.info('Getting storage savings breakdown', { accountId, credentialsId, region, instanceId, params });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances;
    const [{ sqlServerEngineEdition, sqlServerEdition, sqlServerVersion, sqlServerDeploymentType, nodeIps }] =
        ec2HostDetails?.sqlServerInstances || []; // considering only the first sql server instance from now as the sqlServerEngineEdition;sqlServerEdition;sqlServerVersion are going to be the same for all the sql server instances within an AWS AMI.

    let nodeInstanceTypes = [ec2HostDetails?.ec2InstanceType];

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

    if (ec2HostDetails?.ec2UsageOperation && sqlServerEngineEdition && sqlServerEdition && sqlServerDeploymentType) {
        const ebsVolumeIds = compact(
            sqlServerInstances?.flatMap(server =>
                server?.storage?.filter(storage => storage.type === STORAGE_TYPE.EBS).map(storage => storage.id)
            )
        );
        if (!ebsVolumeIds.length) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No EBS volumes found for the provided instance: ${instanceId}`
            );
        }

        const marketingSavingsPromise = performStorageSavingsCalculations(
            accountId,
            credentialsId,
            region,
            instanceId,
            params
        );

        let instanceIdToUseForRecommendations = instanceId;

        if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && nodeIps && nodeIps.length > 1) {
            // in case of AOAG, we need to consider the smaller instance type for recommendations; as the AOAG is a combination of 2 or more instances
            let clusterNodeDetails: NodeDetails[] = [];
            clusterNodeDetails = (await getInstanceDetailsByPrivateIp(credentialsId, region, nodeIps)) || [];
            nodeInstanceTypes = clusterNodeDetails.map(node => node.ec2InstanceType);

            if (nodeInstanceTypes[0] !== nodeInstanceTypes[1]) {
                const smallerInstanceType = await determineSmallerInstance(
                    region,
                    credentialsId,
                    nodeInstanceTypes as _InstanceType[]
                );
                const smallerInstance = clusterNodeDetails.find(node => node.ec2InstanceType === smallerInstanceType);
                instanceIdToUseForRecommendations = smallerInstance?.ec2InstanceId || instanceId;
            }
        }

        const instanceRecommendationsPromise = getInstanceRecommendations(
            region,
            credentialsId,
            accountId,
            instanceIdToUseForRecommendations,
            ebsVolumeIds,
            sqlServerDeploymentType
        );

        const [marketingSavings, instanceRecommendations] = await Promise.all([
            marketingSavingsPromise,
            instanceRecommendationsPromise
        ]);

        const { ebs, fsx, fsxCalculation } = marketingSavings;

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

        const existingSqlServerEditionLowerCase = sqlServerEdition.toLowerCase();
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
                ? 'SQL Ent'
                : existingSqlServerEditionLowerCase.includes('web')
                ? 'SQL Web'
                : 'SQL Std';
            const existingInstanceMonthlyPrice = existingInstanceTypePricingDetails?.[existingLicenseType]?.pricePerUnit
                ? existingInstanceTypePricingDetails[existingLicenseType].pricePerUnit * 24 * 30
                : undefined;
            const existingInstanceMonthlyPriceWithoutLicense = existingInstanceTypePricingDetails?.NA?.pricePerUnit
                ? existingInstanceTypePricingDetails.NA.pricePerUnit * 24 * 30
                : undefined;

            let recommendedInstancePricingDetails = existingInstanceTypePricingDetails; // assuming no instance change; gets updated when a diff instance is recommended
            let recommendedInstanceMonthlyPrice = existingInstanceMonthlyPrice;
            let recommendedInstanceMonthlyPriceWithoutLicense = existingInstanceMonthlyPriceWithoutLicense;

            const recommendedSqlLicenseType =
                sqlServerEngineEdition === 3
                    ? await getLicenseRecommendations(region, credentialsId, accountId, instanceId)
                    : undefined;

            // existing compute and license details
            ebs.compute = {
                cost: existingInstanceMonthlyPrice, // could be undefined if the pricing information is not available for a certain instance type
                instanceType: ec2HostDetails.ec2InstanceType
            };

            ebs.license = {
                sqlEdition: existingLicenseType, // SQL Ent or SQL Std or SQL Web
                sqlServerVersion,
                licenseCost:
                    existingInstanceMonthlyPrice && existingInstanceMonthlyPriceWithoutLicense
                        ? existingInstanceMonthlyPrice - existingInstanceMonthlyPriceWithoutLicense
                        : undefined
            };

            // instance recommendation logic
            const [{ recommendations: [firstRecommendationOption] = [] }] = instanceRecommendations || [];
            const { instanceType: recommendedInstanceType } = firstRecommendationOption;
            if (recommendedInstanceType && ec2HostDetails.ec2InstanceType !== recommendedInstanceType) {
                recommendedInstancePricingDetails = await getSqlInstancePricingDetails(
                    region,
                    recommendedInstanceType as _InstanceType,
                    undefined, // not using usage operation as a filter; usage operation is related to standard/enterprise but not for an operating system
                    'windows' // TODO: fetch operating system from existing instance when supporting other instance operating systems
                );
                recommendedInstanceMonthlyPrice =
                    recommendedSqlLicenseType &&
                    recommendedInstancePricingDetails?.[recommendedSqlLicenseType]?.pricePerUnit
                        ? recommendedInstancePricingDetails[recommendedSqlLicenseType].pricePerUnit * 24 * 30
                        : existingLicenseType && recommendedInstancePricingDetails?.[existingLicenseType]?.pricePerUnit
                        ? recommendedInstancePricingDetails[existingLicenseType].pricePerUnit * 24 * 30
                        : undefined;

                recommendedInstanceMonthlyPriceWithoutLicense = recommendedInstancePricingDetails?.NA?.pricePerUnit
                    ? recommendedInstancePricingDetails.NA.pricePerUnit * 24 * 30
                    : undefined;

                fsx.compute = {
                    cost: recommendedInstanceMonthlyPrice,
                    instanceType: recommendedInstanceType || ec2HostDetails.ec2InstanceType
                };
            } else {
                const message = isEmpty(recommendedInstanceType)
                    ? 'Instance Recommendation Preferences are not updated yet, please come back after a day for better recommendations'
                    : ec2HostDetails.ec2InstanceType === recommendedInstanceType
                    ? 'No instance change recommended as per Compute Optimizer'
                    : 'Instance Recommendations not available for the instance';

                fsx.compute = {
                    cost: existingInstanceMonthlyPrice,
                    instanceType: ec2HostDetails.ec2InstanceType,
                    message
                };
            }

            // sql license recommendation logic; applicable only if the current instance is enterprise edition(sqlServerEngineEdition === 3)
            if (
                sqlServerEngineEdition === 3 &&
                recommendedSqlLicenseType &&
                recommendedSqlLicenseType !== existingLicenseType
            ) {
                fsx.license = {
                    sqlEdition: recommendedSqlLicenseType, // SQL Ent or SQL Std
                    sqlServerVersion,
                    licenseCost:
                        recommendedInstanceMonthlyPrice && recommendedInstanceMonthlyPriceWithoutLicense
                            ? recommendedInstanceMonthlyPrice - recommendedInstanceMonthlyPriceWithoutLicense
                            : undefined
                };
            } else {
                const message =
                    sqlServerEngineEdition === 3
                        ? 'No license change recommended as you are already using a non-enterprise edition'
                        : recommendedSqlLicenseType === existingLicenseType
                        ? 'Need not change the license as the recommended type is the same as the existing license type'
                        : 'License Recommendations not available for the instance';

                fsx.license = {
                    sqlEdition: existingLicenseType, // SQL Ent or SQL Std or SQL Web
                    sqlServerVersion,
                    licenseCost:
                        existingInstanceMonthlyPrice && existingInstanceMonthlyPriceWithoutLicense
                            ? existingInstanceMonthlyPrice - existingInstanceMonthlyPriceWithoutLicense
                            : undefined,
                    message
                };
            }
        }

        return {
            ebs,
            fsx,
            fsxCalculation
        };
    }
}
