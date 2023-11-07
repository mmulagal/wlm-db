import { faker } from '@faker-js/faker';
import {
    getAmis,
    describeRegions,
    describeKeyPairs,
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    describeInstanceTypes,
    describeRouteTable
} from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES, DEFAULT_AWS_REGION } from '../../../src/utils/consts';

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
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';

const REGION = DEFAULT_AWS_REGION;

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
});
