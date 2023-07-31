import { faker } from '@faker-js/faker';
import {
    getAmis,
    describeRegions,
    describeVpc,
    describeSecurityGroups,
    describeSubnets,
    getEC2instnaceTypes
} from '../../../src/lib/aws/ec2';
import { SQL_AMI_NAMES, FSX_SUPPORTED_REGIONS, DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import ec2Images from '../../simulator/responses/aws/ec2-images.json';
import fsxRegions from '../../simulator/responses/aws/list-fsx-regions.json';
import vpcList from '../../simulator/responses/aws/list-vpcs.json';
import subnetsList from '../../simulator/responses/aws/list-subnets.json';
import sgList from '../../simulator/responses/aws/list-security-groups.json';
import ec2InstaceTypes from '../../simulator/responses/aws/ec2-instance-types.json';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const REGION = DEFAULT_AWS_REGION;

describe('EC2 Lib', () => {
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
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await describeVpc(credentialsId, DEFAULT_AWS_REGION, {});
        expect(resp).toEqual(vpcList);
    });

    it('should return a list of Subnets', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const params = {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-7d4a2818']
                }
            ]
        };
        const resp = await describeSubnets(credentialsId, DEFAULT_AWS_REGION, params);
        expect(resp).toEqual(subnetsList);
    });

    it('should return a list of Security Groups', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const params = {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-7d4a2818']
                }
            ]
        };
        const resp = await describeSecurityGroups(credentialsId, DEFAULT_AWS_REGION, params);
        expect(resp).toEqual(sgList);
    });
});

describe('List AWS regions supporting Amazon FSx for NetApp ONTAP', () => {
    it('List of AWS regions supporting Amazon FSx for NetApp ONTAP', async () => {
        const credentialsType = 'aws_assume_role';

        const input = {
            AllRegions: false, // Describe only the regions enabled for the account
            DryRun: false,
            Filter: {
                RegionNames: Array.from(FSX_SUPPORTED_REGIONS.keys()) // Limit describe to known FSx regions only
            }
        };

        const response = await describeRegions(credentialsType, input);
        expect(response).toEqual(fsxRegions);
    });
});

describe('List EC2 instance types forn specific region', () => {
    it('List EC2 instance types forn specific region', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getEC2instnaceTypes(credentialsId, 'us-east-1');
        expect(resp).toEqual(ec2InstaceTypes.InstanceTypes);
    });
});
