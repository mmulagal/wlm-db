import { faker } from '@faker-js/faker';
import {
    getAmis,
    describeRegions,
    describeKeyPairs,
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    describeInstanceTypes,
    describeRouteTable,
    describeInstance,
    createTag,
    describeEndpoints,
    describeInstanceTypeOfferings,
    modifyVpcAttributes,
    describeVolumes,
    stopInstance,
    startInstance,
    modifyInstanceType,
    waitForInstanceOk
} from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES, DEFAULT_AWS_REGION } from '../../../src/utils/consts';

// This file.  describeRegions is there.  Add similarly for describeInstance.
import ec2Images from '../../simulator/responses/aws/ec2-images.json';
import fsxRegions from '../../simulator/responses/aws/list-fsx-regions.json';
import routeTables from '../../simulator/responses/aws/list-route-tables.json';
import vpcList from '../../simulator/responses/aws/list-vpcs.json';
import subnetsList from '../../simulator/responses/aws/list-subnets.json';
import sgList from '../../simulator/responses/aws/list-security-groups.json';
import ec2instanceTypes from '../../simulator/responses/aws/ec2-instance-types.json';
import ec2Instances from '../../simulator/responses/aws/describe-instance.json';
import vpcEndpoints from '../../simulator/responses/aws/describe-endpoints.json';
import instanceTypeOfferings from '../../simulator/responses/aws/describe-instancetype-offerings.json';
import modifyVpcAttributesResponse from '../../simulator/responses/aws/modify-vpc-attributes.json';

import { DEFAULT_AWS_CREDENTIALS_TYPE, ACCOUNT_ID } from '../../utils/consts';

const REGION = DEFAULT_AWS_REGION;

const ec2Id = faker.string.alphanumeric(8);
const tag = [{ Key: 'key', Value: 'value' }];

describe('EC2 Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('should return a list of EC2 AMIs', async () => {
        const params = {
            Filters: [
                { Name: 'name', Values: SQL_AMI_NAMES },
                { Name: 'owner-alias', Values: ['amazon'] }
            ]
        };
        const resp = await getAmis(CREDENTIALS_ID, REGION, params);
        expect(resp).toEqual(ec2Images.windowsImages);
    });

    it('should return a list of VPCs', async () => {
        const resp = await describeVpc(CREDENTIALS_ID, DEFAULT_AWS_REGION, {});
        expect(resp).toEqual(vpcList);
    });

    it('should return a list of Subnets', async () => {
        const params = {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-7d4a2818']
                }
            ]
        };
        const resp = await describeSubnets(CREDENTIALS_ID, DEFAULT_AWS_REGION, params);
        expect(resp).toEqual(subnetsList);
    });

    it('should return a list of Security Groups', async () => {
        const params = {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-7d4a2818']
                }
            ]
        };
        const resp = await describeSecurityGroups(CREDENTIALS_ID, DEFAULT_AWS_REGION, params);
        expect(resp).toEqual(sgList);
    });

    it('Lists Route tables for a subnet', async () => {
        const params = {
            Filters: [{ Name: 'association.subnet-id', Values: ['subnet-5a37222d'] }]
        };

        const response = await describeRouteTable(CREDENTIALS_ID, REGION, params);
        expect(response).toEqual(routeTables);
    });

    it('List of AWS regions', async () => {
        const input = {
            AllRegions: false, // Describe only the regions enabled for the account
            DryRun: false
        };

        const response = await describeRegions(input, DEFAULT_AWS_CREDENTIALS_TYPE);
        expect(response).toEqual(fsxRegions);
    });

    it('List EC2 instance types forn specific region', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await describeInstanceTypes(credentialsId, 'us-east-1');
        expect(resp).toEqual(ec2instanceTypes.InstanceTypes);
    });

    it('List of key-pairs in a given AWS region', async () => {
        const response = await describeKeyPairs(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION, {});
        expect(response).toBeDefined();
    });

    it('Describe an EC2 instance', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await describeInstance(credentialsId, DEFAULT_AWS_REGION, {
            InstanceIds: ['i-0880a21327284f67c']
        });

        expect(response).toEqual(ec2Instances);
    });

    it('Create tag for given resource', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        await expect(createTag(credentialsId, REGION, ACCOUNT_ID, [ec2Id], tag)).resolves.not.toThrow();
    });

    it('Describe vpc endpoints', async () => {
        const params = {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-7d4a2818']
                }
            ]
        };
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await describeEndpoints(credentialsId, DEFAULT_AWS_REGION, params);

        expect(response).toEqual(vpcEndpoints);
    });

    it('Describe instance type offerings', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await describeInstanceTypeOfferings(credentialsId, DEFAULT_AWS_REGION, {
            LocationType: 'region',
            Filters: [{ Name: 'instance-type', Values: ['t2.micro', 't3.micro'] }]
        });

        expect(response).toEqual(instanceTypeOfferings);
    });

    it('Modify vpc attributes', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await modifyVpcAttributes(credentialsId, DEFAULT_AWS_REGION, {
            VpcId: 'vpc-123445',
            EnableDnsSupport: { Value: true }
        });

        expect(response).toEqual(modifyVpcAttributesResponse);
    });

    it('Describe volumes response', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await describeVolumes(credentialsId, DEFAULT_AWS_REGION, { VolumeIds: ['test-volume-id'] });
        expect(response?.Volumes?.[0]?.VolumeId).toEqual('test-volume-id');
    });

    it('Stop instance', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await stopInstance(credentialsId, 'ap-southeast-1', 'i-03325779d5dfa1649');
        expect(response.StoppingInstances).toBeDefined();
    });

    it('Start instance', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await startInstance(credentialsId, 'ap-southeast-1', 'i-03325779d5dfa1649');
        expect(response.StartingInstances).toBeDefined();
    });

    it('Modify instance type', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await modifyInstanceType(credentialsId, 'ap-southeast-1', 'i-03325779d5dfa1649', 't2.micro');
        expect(response).toBeDefined();
    });

    it('Wait for instance to be in ok state', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const response = await waitForInstanceOk(credentialsId, 'ap-southeast-1', 'i-03325779d5dfa1649');
        expect(response).toBeDefined();
    });
});
