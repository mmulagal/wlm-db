import { DescribeSubnetsRequest } from '@aws-sdk/client-ec2';
import { describeVpc, describeSecurityGroups, describeSubnets } from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';

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

export async function getVpcsList(credentialsId: string, region: string, fields: string) {
    logger.info('List vpcs in a region', { credentialsId, region, fields });

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.replace(/\s+/g, '')?.split(',');
    }

    const { Vpcs } = (await describeVpc(credentialsId, region, {})) || [];

    const vpcs: Array<VPC> = [];

    if (Vpcs?.length && fieldsValues.length === 0) {
        Vpcs.forEach((vpc) => {
            const { VpcId: id, State: state, Tags: tags, CidrBlockAssociationSet: cidrBlock, IsDefault: isDefault } = vpc;
            vpcs.push({ id, state, tags, cidrBlock, isDefault });
        });
    }

    if (Vpcs?.length) {
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

                    let subnetsList: Array<Subnet> = [];
                    if (fields?.includes('subnet')) {
                        subnetsList = await getSubnetsList(credentialsId, region, params);
                    }

                    let securityGroupList: Array<SecurityGroup> = [];
                    if (fields?.includes('securitygroup')) {
                        securityGroupList = await getSecurityGroupsList(credentialsId, region, params);
                    }
                    vpcs.push({ id, state, tags, cidrBlock, isDefault, subnets: subnetsList, securityGroups: securityGroupList });
                } catch (err) {
                    logger.error('Failed to get the vpc details', { vpc, err });
                }
            })
        );
    }
    return { vpcs: vpcs };
}

async function getSubnetsList(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
    const subnetsList: Array<Subnet> = [];
    subnets?.forEach((subnet) => {
        const { SubnetId: id, State: state, VpcId: vpcId, Tags: tags, CidrBlock: cidrBlock, AvailabilityZone: availabilityZone, AvailableIpAddressCount: availableIps } = subnet;
        subnetsList.push({ id, state, vpcId, tags, cidrBlock, availabilityZone, availableIps });
    });
    return subnetsList;
}

async function getSecurityGroupsList(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    const { SecurityGroups: securityGroups } = await describeSecurityGroups(credentialsId, region, params);
    const securityGroupList: Array<SecurityGroup> = [];
    securityGroups?.forEach((sg) => {
        const { GroupId: id, Description: description, VpcId: vpcId, IpPermissions: ipPermissions } = sg;
        securityGroupList.push({ id: id!, description: description!, vpcId: vpcId!, ipPermissions });
    });
    return securityGroupList;
}
