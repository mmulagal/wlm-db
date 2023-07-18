import { describeVpc, describeSecurityGroups, describeSubnets } from '../../lib/aws/ec2';

import getLogger from '../../utils/logger';

const logger = getLogger();


async function getVpcsList(credentialsId: string, region: string) {
    logger.info('List vpcs in a region', { credentialsId, region });
    const { Vpcs } = await describeVpc(credentialsId, region, {}) || [];
    const vpcs: any = [];

    await Promise.all(Vpcs!?.map(async vpc => {
        try {
            const { VpcId: id, State: state, Tags: tags, CidrBlockAssociationSet: cidrBlock, IsDefault: isDefault } = vpc;
            const params = {
                'Filters': [
                  {
                    'Name': 'vpc-id',
                    'Values': [
                        id
                    ]
                  }
                ]
            };
    
            const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
            const subnetsList: any = [];
            subnets?.forEach((subnet) => {
                const { SubnetId: id, State: state, VpcId: vpcId, Tags: tags, CidrBlock: cidrBlock, AvailabilityZone: availabilityZone, AvailableIpAddressCount: availableIps } = subnet;
                subnetsList.push({ id, state, vpcId, tags, cidrBlock, availabilityZone, availableIps});
            });

            const { SecurityGroups: securityGroups } = await describeSecurityGroups(credentialsId, region, params);
            const securityGroupList: any = [];
            securityGroups?.forEach((sg) => {
                const { GroupId: id, Description: description, VpcId: vpcId, IpPermissions: ipPermissions } = sg;
                securityGroupList.push({ id, description, vpcId, ipPermissions});
            });
            vpcs.push({ id, state, tags, cidrBlock, isDefault, subnets: subnetsList, securityGroups: securityGroupList});
        } catch (err) {
            logger.error('Failed to get the vpc details', { vpc, err });
        }
    }));
    return { vpcs: vpcs };
}

export { getVpcsList };