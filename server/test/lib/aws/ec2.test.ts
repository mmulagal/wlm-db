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
    describeInstanceTypeOfferings,
    createTag
} from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES, DEFAULT_AWS_REGION } from '../../../src/utils/consts';

// This file.  describeRegions is there.  Add similarly for describeInstance.

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import ec2Images from '../../simulator/responses/aws/ec2-images.json';
import fsxRegions from '../../simulator/responses/aws/list-fsx-regions.json';
import routeTables from '../../simulator/responses/aws/list-route-tables.json';
import vpcList from '../../simulator/responses/aws/list-vpcs.json';
import subnetsList from '../../simulator/responses/aws/list-subnets.json';
import sgList from '../../simulator/responses/aws/list-security-groups.json';
import ec2instanceTypes from '../../simulator/responses/aws/ec2-instance-types.json';
import ec2Instances from '../../simulator/responses/aws/describe-instance.json';
import instanceTypeOfferings from '../../simulator/responses/aws/describe-instance-type-offerings.json';
import describeInstanceTypeOfferingsInvalidParameters from '../../simulator/responses/aws/describe-instance-type-offerings-invalid-parameters.json';
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
        expect(resp).toEqual(ec2Images);
    });

    it('should return a list of Vpis', async () => {
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

    it('Describe EC2 instance type offerings in regions', async () => {
        const response = await describeInstanceTypeOfferings(
            DEFAULT_AWS_CREDENTIALS_TYPE,
            'ap-southeast-1',
            'm5.xlarge'
        );
        expect(response).toEqual(instanceTypeOfferings);
    });

    it('Desribe EC2 instance type offerings for invalid region and instance-type', async () => {
        try {
            await describeInstanceTypeOfferings(
                DEFAULT_AWS_CREDENTIALS_TYPE,
                'INVALID_REGION',
                'INVALID_INSTANCE_TYPE'
            );
        } catch (error) {
            const { message } = error as { message: string };
            expect(message).toEqual(describeInstanceTypeOfferingsInvalidParameters.message);
        }
    });

    it('Create tag for given resource', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        await expect(createTag(credentialsId, REGION, ACCOUNT_ID, [ec2Id], tag)).resolves.not.toThrow();
    });
});
