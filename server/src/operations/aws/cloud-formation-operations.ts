import { Parameter } from '@aws-sdk/client-cloudformation';
import { listStacks, createStack } from '../../lib/aws/cloud-formation';
import { getMissingPermissionsList } from '../../lib/aws/iam';
import { createSecrets } from './secrets-manager-operations';
import { getPreSignedUrl } from '../../lib/aws/s3';
import getLogger from '../../utils/logger';
import { generateFsxParams } from '../../utils/utils';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../../routes/types/deployment.types';
import { TEMPLATE_CONFIGURATION_MAPPING, CLOUD_FORMATION_STACK_URL, MASTER_TEMPLATE_URL } from '../../utils/consts';

const logger = getLogger();

async function currentCfStacksCount(credentialsId: string, region: string) {
    logger.info('Fetching cloudformation stacks in region ', region);
    const currentStacksCount = (await listStacks(credentialsId, region)).StackSummaries?.length;
    logger.debug('Completed stacks count ', currentStacksCount);
    return { currentStacksCount: currentStacksCount };
}

async function createCloudFormationTemplateForUserDeployment(
    credentialsId: string,
    region: string,
    vpcId: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
): Promise<{ cloudFormationUrl: string }> {
    logger.info('Create cloud formation template for user deployment', {
        credentialsId,
        region,
        vpcId,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration
    });

    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    // logger.info('permissions', permissions);
    if (permissions?.length) {
        logger.error('Required permissions are not available to create the cloud formation template');
    }
    const data = await generateFsxParams(fsxConfiguration.databaseSize);
    const signedURL = await getPreSignedUrl(credentialsId, region);

    let params: string = `stackName=${data.StackName}`;
    Object.entries(data).forEach(([key, value]) => {
        if (key !== 'StackName') {
            params += `&param_${key}=${value}`;
        }
    });
    // logger.info(params);
    const signedTemplateURL = `${CLOUD_FORMATION_STACK_URL}?region=${region}#/stacks/create/review?templateURL=${signedURL}${params}`;
    return { cloudFormationUrl: signedTemplateURL };
}

async function deploySqlTemplate(
    credentialsId: string,
    region: string,
    vpcId: string,
    networkConfiguration: CFNetworkConfigurationType,
    ec2Configuration: EC2ConfigurationType,
    adConfiguration: ADConfigurationType,
    fsxConfiguration: FSXConfigurationType,
    sqlConfiguration: SQLConfigurationType
): Promise<{ cloudFormationStackId: string }> {
    logger.info('Deploy sql cloud formation template ', {
        credentialsId,
        region,
        vpcId,
        networkConfiguration,
        ec2Configuration,
        adConfiguration,
        fsxConfiguration,
        sqlConfiguration
    });

    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    if (permissions?.length) {
        // throw {
        //     statusCode: 400,
        //     message: `Required permissions are not available to deploy cloud formation template. Missing permissions: ${permissions}.`
        // };
    }

    const derivedParams = generateFsxParams(fsxConfiguration.databaseSize);

    await createSecrets(credentialsId, region, [
        {
            secretName: derivedParams.DomainAdminSecretName,
            username: adConfiguration.domainUsername,
            password: adConfiguration.domainPassword
        },
        {
            secretName: derivedParams.FSxAdministratorPasswordSecret,
            username: fsxConfiguration.fsxUsername,
            password: fsxConfiguration.fsxPassword
        },
        {
            secretName: derivedParams.SQLServiceAccountSecret,
            username: sqlConfiguration.serviceAccountName,
            password: sqlConfiguration.serviceAccountPassword
        }
    ]);

    const templateParams: Array<Parameter> = [];

    Object.entries(derivedParams).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: key,
            ParameterValue: value.toString()
        });
    });

    const clubbedParamList = {
        ...networkConfiguration,
        ...adConfiguration,
        ...networkConfiguration,
        ...sqlConfiguration,
        ...ec2Configuration
    };

    Object.entries(clubbedParamList).forEach(([key, value]) => {
        templateParams.push({
            ParameterKey: TEMPLATE_CONFIGURATION_MAPPING[key],
            ParameterValue: value.toString()
        });
    });

    logger.info(`Stack ${derivedParams.StackName} parameters ${JSON.stringify(templateParams)}.`);

    const deployStackResponse = await createStack(
        credentialsId,
        region,
        derivedParams.StackName,
        MASTER_TEMPLATE_URL,
        templateParams
    );

    logger.debug(`Stack ${derivedParams.StackName} response ${deployStackResponse}`);
    return { cloudFormationStackId: deployStackResponse.StackId! };
}

export { currentCfStacksCount, createCloudFormationTemplateForUserDeployment, deploySqlTemplate };
