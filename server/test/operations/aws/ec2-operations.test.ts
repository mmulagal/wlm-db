import { faker } from '@faker-js/faker';
import {
    getAmiList,
    getVpcsList,
    getInstanceTypes,
    getKeyPairsList,
    getWindowsServerBaseAmi,
    tagEc2Resource,
    getVpcSecurityGroups,
    getVpcEndpoints,
    enableVpcDnsAttributes,
    isEbsAwsBackupEnabled,
    getInstanceDetailsByPrivateIp,
    getInstanceTypesFromInstanceRequirementsForManagedInstances,
    getInstanceTypesFromInstanceRequirements,
    waitForInstanceToBeStopped,
    instanceTypeChangePreReqs,
    getAmazonLinux2023AmiList,
    validateVpcEndpoints,
    getInstanceIPAndFQDN
} from '../../../src/operations/aws/ec2-operations';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import {
    DEFAULT_AWS_CREDENTIALS_ID,
    DEFAULT_AWS_CREDENTIALS_TYPE,
    ACCOUNT_ID,
    TEST_STOPPED_EC2_INSTANCE_ID
} from '../../utils/consts';

const WINDOWS = 'windows';
const SQL = 'sql';
const credentialsId = `${faker.string.alpha(20)}`;
const ec2Id = `i-${faker.string.alpha(8)}`;

describe('EC2 Operations', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;
        const resp = await getAmiList(credentialsType, DEFAULT_AWS_REGION, WINDOWS, SQL);
        expect(resp).toBeDefined();
    });

    it('list of EC2 custom AMIs', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;
        const resp = await getAmiList(
            credentialsType,
            DEFAULT_AWS_REGION,
            WINDOWS,
            undefined,
            undefined,
            undefined,
            undefined,
            true
        );
        expect(resp).toBeDefined();
    });

    it('list of vpc', async () => {
        const resp = await getVpcsList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });

    it('should return a lsist EC2 instance types forn specific region', async () => {
        const resp = await getInstanceTypes('us-east-1', credentialsId);
        expect(resp.instanceTypes).toBeDefined();
    });

    it('List of key-pairs for a given region', async () => {
        const response = await getKeyPairsList(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });

    it('Get Windows Server ImageId in a region', async () => {
        const response = await getWindowsServerBaseAmi(DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });

    it('Tag Ec2 instance', async () => {
        await expect(
            tagEc2Resource(credentialsId, DEFAULT_AWS_REGION, ACCOUNT_ID, [ec2Id], [{ Key: 'key', Value: 'value' }])
        ).resolves.not.toThrow();
    });

    it('Get Vpc Security Groups', async () => {
        const response = await getVpcSecurityGroups(credentialsId, DEFAULT_AWS_REGION, 'vpc-123445');
        expect(response).toBeDefined();
    });

    it('Get Vpc endpoints', async () => {
        const response = await getVpcEndpoints(credentialsId, DEFAULT_AWS_REGION, 'vpc-123445');
        expect(response).toBeDefined();
    });

    it('Get services without endpoints', async () => {
        const response = await validateVpcEndpoints(
            credentialsId,
            DEFAULT_AWS_REGION,
            { vpcId: 'vpc-84b3afe6', vpcCidr: '172.31.0.0/16' },

            [{ subnetId: 'subnet-f4484e80', cidr: '172.31.0.0/16', routeTableId: 'rtb-1' }]
        );
        expect(response).toBeDefined();
    });

    it('Modify vpc dns attributes', async () => {
        const response = await enableVpcDnsAttributes(credentialsId, DEFAULT_AWS_REGION, 'vpc-123445');
        expect(response).toBeDefined();
    });

    it('Check if EBS backup is available', async () => {
        const response = await isEbsAwsBackupEnabled(credentialsId, DEFAULT_AWS_REGION, ['vol-123445']);
        expect(response).toEqual(true);
    });

    it('Get instance details by private IP', async () => {
        const [response] = await getInstanceDetailsByPrivateIp(credentialsId, DEFAULT_AWS_REGION, [
            '10.0.6.118',
            '10.0.28.145'
        ]);
        expect(response.ec2InstanceId).toBeDefined();
    });

    it('Get instance types from instance requirements for managed instances', async () => {
        const response = await getInstanceTypesFromInstanceRequirementsForManagedInstances(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'i-12345'
        );
        expect(response).toBeDefined();
    });

    it('Get instance types from instance requirements for managed instances', async () => {
        const response = await getInstanceTypesFromInstanceRequirements(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ['i-12345'],
            ['vol-1234s'],
            'AOAG'
        );
        expect(response).toBeDefined();
    });

    it('Wait for instance to be stopped', async () => {
        const response = await waitForInstanceToBeStopped(
            credentialsId,
            DEFAULT_AWS_REGION,
            TEST_STOPPED_EC2_INSTANCE_ID
        );
        expect(response).toBeTruthy();
    });

    it('Instance type change pre-reqs', async () => {
        try {
            await instanceTypeChangePreReqs(credentialsId, DEFAULT_AWS_REGION, ACCOUNT_ID, ['i-12345']);
        } catch (error) {
            expect(error).toBeUndefined();
        }
    });

    it('Get Amazon Linux 2023 AMI List', async () => {
        const amiList = await getAmazonLinux2023AmiList(credentialsId, DEFAULT_AWS_REGION);
        expect(Array.isArray(amiList)).toBeTruthy();
        expect(amiList).toBeDefined();
    });
    it('getInstanceIPAndFQDN', async () => {
        const response = await getInstanceIPAndFQDN(credentialsId, 'ap-southeast-1', 'i-03325779d5dfa1649');
        expect(response.fqdn).toBeDefined();
        expect(response.privateIp).toBeDefined();
        expect(response.publicIp).toBeDefined();
    });
});
