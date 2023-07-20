import createError from 'http-errors';
import { describeVpc, describeSecurityGroups, describeSubnets, getAmis } from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';
import { DescribeSubnetsRequest } from '@aws-sdk/client-ec2';
import { SQL_AMI_NAMES } from '../../utils/consts';
const logger = getLogger();

export interface VPC {
    id?: string;
    state?: string;
    cidrBlock?: any;
    tags?: any;
    isDefault?: boolean;
    subnets?: Array<Subnet>;
    securityGroups?: Array<SecurityGroup>;
}
interface Subnet {
    id?: string;
    state?: string;
    vpcId?: string;
    tags?: any;
    cidrBlock?: string;
    availabilityZone?: string;
    availableIps?: number;
}
interface SecurityGroup {
    id?: string;
    description?: string;
    vpcId?: string;
    ipPermissions?: any;
}

async function getVpcsList(credentialsId: string, region: string) {
    logger.info('List vpcs in a region', { credentialsId, region });
    const { Vpcs } = (await describeVpc(credentialsId, region, {})) || [];

    const vpcs: Array<VPC> = [];

    if (!Vpcs?.length) {
        return { vpcs }
    }

    await Promise.all(
        Vpcs.map(async (vpc) => {
            try {
                const { VpcId: id, State: state, Tags: tags, CidrBlockAssociationSet: cidrBlock, IsDefault: isDefault } = vpc;
                const params: DescribeSubnetsRequest = {
                    Filters: [
                        {
                            Name: 'vpc-id',
                            Values: [id as string],
                        },
                    ],
                };

                const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
                const subnetsList: Array<Subnet> = [];
                subnets?.forEach((subnet) => {
                    const { SubnetId: id, State: state, VpcId: vpcId, Tags: tags, CidrBlock: cidrBlock, AvailabilityZone: availabilityZone, AvailableIpAddressCount: availableIps } = subnet;
                    subnetsList.push({ id, state, vpcId, tags, cidrBlock, availabilityZone, availableIps });
                });

                const { SecurityGroups: securityGroups } = await describeSecurityGroups(credentialsId, region, params);
                const securityGroupList: Array<SecurityGroup> = [];
                securityGroups?.forEach((sg) => {
                    const { GroupId: id, Description: description, VpcId: vpcId, IpPermissions: ipPermissions } = sg;
                    securityGroupList.push({ id: id!, description: description!, vpcId: vpcId!, ipPermissions });
                });
                vpcs.push({ id, state, tags, cidrBlock, isDefault, subnets: subnetsList, securityGroups: securityGroupList });
            } catch (err) {
                logger.error('Failed to get the vpc details', { vpc, err });
            }
        })
    );

    return { vpcs };
}

async function getAmiList(credentialsId: string, region: string) {
    logger.info('Get AWS Amis', { credentialsId, region });

    try {
        const amis = await getAmis(credentialsId, region, {
            Filters: [
                { Name: 'name', Values: SQL_AMI_NAMES },
                { Name: 'owner-alias', Values: ['amazon'] }
            ] 
        });
        
        if (!amis?.Images) {
            return { amis: [] };
        }
    
        return { 
            amis: amis?.Images?.map(({
                Name,
                Description,
                Architecture,
                ImageId,
                ImageLocation,
                Public,
                Platform,
                PlatformDetails,
                State,
                Hypervisor,
            }) => ({
                name: Name,
                description: Description,
                architecture: Architecture,
                imageId: ImageId,
                imageLocation: ImageLocation,
                public: Public,
                platform: Platform,
                platformDetails: PlatformDetails,
                state: State,
                hypervisor: Hypervisor
            }))
        }
    } catch (error: any) {
        logger.error('Failed to get the aws amis ', error.message);
        throw createError(error.statusCode || error.code || 500, error.message)
    }
}

export { getVpcsList, getAmiList };
