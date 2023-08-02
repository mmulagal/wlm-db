import createError from 'http-errors';
import { listStacks } from '../../lib/aws/cloud-formation';
import { getMissingPermissionsList } from '../../lib/aws/iam';
import getLogger from '../../utils/logger';
import { generateFsxParams } from '../../utils/utils';
import {
    CFNetworkConfigurationType,
    EC2ConfigurationType,
    ADConfigurationType,
    FSXConfigurationType,
    SQLConfigurationType
} from '../../routes/types/aws.types';
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

    // StackName: `${prefix.toUpperCase()}-SQLFCIStack-${suffix}`,
    // VpcName: `${prefix}-vpc-${suffix}`,
    // WSFClusterName: `WLMWSFC-${generateRandomNumberInRange(10000, 99999)}`,
    // FSxFileSystemName: `${prefix}-fsx-${suffix}`,
    // FSxDataVolumeName: `${prefix}-sqldata-${suffix}`,
    // FSxDataVolumeSize,
    // FSxLogVolumeName: `${prefix}-sqllog-${suffix}`,
    // FSxLogVolumeSize: 0.25 * FSxDataVolumeSize, // 25% of FSxDataVolumeSize
    // FSxTempDBVolumeName: `${prefix}-sqltemp-${suffix}`,
    // FSxTempDBVolumeSize: 0.1 * FSxDataVolumeSize, // 10% of FSxDataVolumeSize
    // FSxQuorumVolumeName: `${prefix}-quorum-${suffix}`,
    // FSxSvmName: `${prefix}-svm-${suffix}`,
    // SQLigroupname: `${prefix}-sqligroup-${suffix}`,
    // SQLSvmName: `${prefix}-sqlsvm-${suffix}`,
    // NodeNetBIOSNames: [`${prefix}-node1-${suffix}`, `${prefix}-node2-${suffix}`]

    //     &stackName=WLM-DB-VPC2

    //    &param_VPCName=krithi_vpc

    //    &param_VPCCIDR=10.0.0.0/16

    //    &param_AvailabilityZones=ap-southeast-1a,ap-southeast-1c

    //    &param_PrivateSubnetCIDRs=10.0.0.0/20,10.0.0.0/20

    //    &param_PublicSubnetCIDR=10.0.128.0/20

    //    &param_NumberOfPublicSubnets=1
    const { permissions } = await getMissingPermissionsList(credentialsId, region);
    if (permissions?.length) {
        throw createError(404, 'Required permissions are not available to create the cloud formation template');
    }
    const data = generateFsxParams(fsxConfiguration.databaseSize);
    // domainPassword
    logger.info(data);
    return { cloudFormationUrl: 'test url' };
}

export { currentCfStacksCount, createCloudFormationTemplateForUserDeployment };
