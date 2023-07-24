import { DescribeSubnetsRequest, DescribeSecurityGroupsRequest, Tag } from '@aws-sdk/client-ec2';
import { AWSQueryFields } from '../../utils/consts';
import { describeVpc, describeSecurityGroups, describeSubnets } from '../../lib/aws/ec2';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface VPC {
    id?: string;
    state?: string;
    cidrBlock?: any;
    tags?: any;
    isDefault?: boolean;
    subnets?: Array<Subnet>;
    securityGroups?: Array<SecurityGroup>;
    name?: string;
}
interface Subnet {
    id?: string;
    name?: string;
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
    name?: string;
}

async function getVpcsList(credentialsId: string, region: string, fields: string) {
    logger.info('List vpcs in a region', { credentialsId, region, fields });

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.replace(/\s+/g, '')?.split(',');
    }

    const { Vpcs } = (await describeVpc(credentialsId, region, {})) || [];

    let vpcs: Array<VPC> = [];

    if (Vpcs?.length && fieldsValues.length === 0) {
        vpcs = Vpcs.map(
            ({ VpcId: id, State: state, Tags: tags, CidrBlockAssociationSet: cidrBlock, IsDefault: isDefault }) => {
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id, state, tags, cidrBlock, isDefault, name };
            }
        );
        return { vpcs: vpcs };
    }

    if (Vpcs?.length) {
        await Promise.all(
            Vpcs.map(async vpc => {
                try {
                    const {
                        VpcId: id,
                        State: state,
                        Tags: tags,
                        CidrBlockAssociationSet: cidrBlock,
                        IsDefault: isDefault
                    } = vpc;

                    let name = '-';
                    if (tags?.length) {
                        name = findNameFromTags(tags);
                    }

                    const subnetParams: DescribeSubnetsRequest = {
                        Filters: [
                            {
                                Name: 'vpc-id',
                                Values: [id as string]
                            }
                        ]
                    };

                    let subnetsList: Array<Subnet> = [];
                    if (fields?.includes(AWSQueryFields.SUBNET)) {
                        subnetsList = await getSubnetsList(credentialsId, region, subnetParams);
                    }

                    const sgParams: DescribeSecurityGroupsRequest = {
                        Filters: [
                            {
                                Name: 'vpc-id',
                                Values: [id as string]
                            }
                        ]
                    };
                    let securityGroupList: Array<SecurityGroup> = [];
                    if (fields?.includes(AWSQueryFields.SECURITY_GROUP)) {
                        securityGroupList = await getSecurityGroupsList(credentialsId, region, sgParams);
                    }
                    vpcs.push({
                        id,
                        state,
                        tags,
                        cidrBlock,
                        isDefault,
                        subnets: subnetsList,
                        securityGroups: securityGroupList,
                        name
                    });
                } catch (err) {
                    logger.error('Failed to get the vpc details', { vpc, err });
                }
            })
        );
    }
    return { vpcs: vpcs };
}

async function getSubnetsList(credentialsId: string, region: string, params: DescribeSubnetsRequest) {
    logger.info('List Subnets in a region', { credentialsId, region, params });

    const { Subnets: subnets } = await describeSubnets(credentialsId, region, params);
    let subnetsList: Array<Subnet> = [];
    if (subnets?.length) {
        subnetsList = subnets.map(
            ({
                SubnetId: id,
                State: state,
                VpcId: vpcId,
                Tags: tags,
                CidrBlock: cidrBlock,
                AvailabilityZone: availabilityZone,
                AvailableIpAddressCount: availableIps
            }) => {
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id, state, vpcId, tags, cidrBlock, availabilityZone, availableIps, name };
            }
        );
    }
    return subnetsList;
}

async function getSecurityGroupsList(credentialsId: string, region: string, params: DescribeSecurityGroupsRequest) {
    logger.info('List Security Groups in a region', { credentialsId, region, params });

    const { SecurityGroups: securityGroups } = await describeSecurityGroups(credentialsId, region, params);
    let securityGroupList: Array<SecurityGroup> = [];
    if (securityGroups?.length) {
        securityGroupList = securityGroups.map(
            ({ GroupId: id, Description: description, VpcId: vpcId, IpPermissions: ipPermissions, Tags: tags }) => {
                let name = '-';
                if (tags?.length) {
                    name = findNameFromTags(tags);
                }
                return { id: id, description: description, vpcId: vpcId, ipPermissions, name };
            }
        );
    }
    return securityGroupList;
}

function findNameFromTags(tags: Tag[]) {
    logger.info('Find name from the tags', { tags });
    const { Value: name } = tags?.find(tag => tag.Key?.toLowerCase() === 'name') || {};
    return name ? name : '-';
}

export { getVpcsList };
