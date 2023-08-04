import { faker } from '@faker-js/faker';
import { createCloudFormationTemplateForUserDeployment } from '../../../src/operations/aws/cloud-formation-operations';

import '../../simulator/scopes/aws/iam-scope';
import '../../simulator/scopes/aws/secrets-manager-scope';
import '../../simulator/scopes/aws/cloud-formation-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Cloud formation operations', () => {
    it('Create the cloud formation template url for user deployment', async () => {
        const resp = await createCloudFormationTemplateForUserDeployment(
            credentialsid,
            'ap-southeast-1',
            'test-vpc',
            {
                vpcId: 'vpc-84b3afe6',
                vpcCidr: '172.31.0.0/16',
                privateSubnet1Id: 'subnet-f4484e80',
                routeTable1Id: 'rtb-65aeb107',
                availabilityZone1: 'string',
                privateSubnet2Id: 'subnet-4cdd3b29',
                routeTable2Id: 'rtb-65aeb107',
                availabilityZone2: 'string'
            },
            {
                workloadInstanceType: 'm4.xlarge',
                keyPairName: 'krithi_new_key'
            },
            {
                adScenarioType: 'AWS_MANAGED_AD',
                domainUsername: 'Admin',
                domainPassword: 'Collector@123',
                domainDnsname: 'dbsdev.com',
                dnsIpaddress: '172.31.7.45,172.31.43.182',
                securityGroupId: 'sg-0d6f82bcd4a2e05d6'
            },
            {
                fsxFileSystemId: 'fs-05a228ef446b34d27',
                fsxUsername: 'fsxadmin',
                fsxPassword: 'netapp1!',
                databaseSize: 1024,
                fsxVolThroughput: 128,
                fsxIOPS: 3072,
                encryptionKey: '',
                ontapSgGroupId: 'sg-3924c15c'
            },
            {
                sqlAmiId: 'ami-0e0f179ddde359def',
                serviceAccountName: 'sqladmin',
                serviceAccountPassword: 'netapp1!',
                sqlFciName: 'SampleFci'
            }
        );
        expect(resp).toBeDefined();
    });
});
