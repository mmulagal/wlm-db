import { DescribeInstancesCommandInput, DescribeVpcsCommandInput } from '@aws-sdk/client-ec2';
import { describeInstance, describeVpc } from '../../lib/aws/ec2';
import { DiscoverMsSqlSummarySuccessResponseType } from '../../routes/types/discover.types';
import getLogger from '../../utils/logger';
import { findResourceNameFromTags } from '../aws/ec2-operations';

const logger = getLogger();

async function discoveryMSSQLSummary(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    nextToken?: string
) {
    logger.info('Discover MSSQL Summary details', { accountId, region, credentialsId, instanceId, nextToken });

    try {
        const instanceParams: DescribeInstancesCommandInput = {
            InstanceIds: [instanceId]
        };
        const { Reservations: reservations } = await describeInstance(credentialsId, region, instanceParams);

        const instanceTags = (reservations || [])[0]?.Instances?.[0]?.Tags;
        const instanceName = findResourceNameFromTags(instanceTags);

        const vpcId = (reservations || [])[0]?.Instances?.[0]?.VpcId;

        const vpcParams: DescribeVpcsCommandInput = {
            VpcIds: [vpcId!]
        };

        const { Vpcs: vpcs } = await describeVpc(credentialsId, region, vpcParams);

        const cidr = (vpcs || [])[0]?.CidrBlock;
        const vpcTags = (vpcs || [])[0].Tags;
        const vpcName = findResourceNameFromTags(vpcTags);

        const discoveryResponse: DiscoverMsSqlSummarySuccessResponseType = {
            instanceId,
            instanceName,
            vpc: {
                vpcId,
                cidr,
                vpcName
            }
        };
        return discoveryResponse;
    } catch (error) {
        logger.error(`Discovery summary failed for instance ${instanceId} with error ${error}`);
        throw error;
    }
}

export default discoveryMSSQLSummary;
