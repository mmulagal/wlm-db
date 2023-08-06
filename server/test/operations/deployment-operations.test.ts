import { faker } from '@faker-js/faker';
import {
    createCloudFormationTemplateForUserDeployment,
    deploySqlTemplate
} from '../../src/operations/deployment-operations';

import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../src/utils/consts';

const credentialsid = `${faker.string.alphanumeric(20)}`;
const network_conf = {
    vpcId: 'vpc-84b3afe6',
    vpcCidr: '172.31.0.0/16',
    privateSubnet1Id: 'subnet-f4484e80',
    routeTable1Id: 'rtb-65aeb107',
    availabilityZone1: 'string',
    privateSubnet2Id: 'subnet-4cdd3b29',
    routeTable2Id: 'rtb-65aeb107',
    availabilityZone2: 'string'
};
const ec2_conf = {
    workloadInstanceType: 'm4.xlarge',
    keyPairName: 'krithi_new_key'
};

const ad_conf = {
    adScenarioType: 'AWS_MANAGED_AD',
    domainUsername: 'Admin',
    domainPassword: 'Collector@123',
    domainDnsname: 'dbsdev.com',
    dnsIpaddress: '172.31.7.45,172.31.43.182',
    securityGroupId: 'sg-0d6f82bcd4a2e05d6'
};

const fsx_conf = {
    fsxFileSystemId: 'fs-05a228ef446b34d27',
    fsxUsername: 'fsxadmin',
    fsxPassword: 'netapp1!',
    databaseSize: 1024,
    fsxVolThroughput: 128,
    fsxIOPS: 3072,
    encryptionKey: '',
    ontapSgGroupId: 'sg-3924c15c'
};

const sql_conf = {
    sqlAmiId: 'ami-0e0f179ddde359def',
    serviceAccountName: 'sqladmin',
    serviceAccountPassword: 'netapp1!',
    sqlFciName: 'SampleFci'
};
describe('Cloud formation operations', () => {
    it('Create the cloud formation template url for user deployment', async () => {
        const resp = await createCloudFormationTemplateForUserDeployment(
            credentialsid,
            'ap-southeast-1',
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
    it('Deploys cloud formation template - missing permissions', async () => {
        try {
            await deploySqlTemplate(
                credentialsid,
                DEFAULT_AWS_REGION,
                network_conf,
                ec2_conf,
                ad_conf,
                fsx_conf,
                sql_conf
            );
        } catch (error: any) {
            expect(
                error.message.includes(
                    'Required permissions are not available to deploy cloud formation template. Missing permissions'
                )
            ).toBeTruthy();
        }
    });
});
