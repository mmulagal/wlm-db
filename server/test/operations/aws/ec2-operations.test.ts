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
    getInstanceTypesFromInstanceRequirementsForOracle,
    waitForInstanceToBeStopped,
    instanceTypeChangePreReqs,
    getAmazonLinux2023AmiList,
    validateVpcEndpoints
} from '../../../src/operations/aws/ec2-operations';
import * as ec2Lib from '../../../src/lib/aws/ec2';
import {
    DEFAULT_AWS_REGION,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
} from '../../../src/utils/consts';
import {
    DEFAULT_AWS_CREDENTIALS_ID,
    DEFAULT_AWS_CREDENTIALS_TYPE,
    ACCOUNT_ID,
    TEST_STOPPED_EC2_INSTANCE_ID
} from '../../utils/consts';

const WINDOWS = 'windows';
const SQL = 'sql';
const credentialsId = `${faker.string.alpha(20)}`;
const ec2Id = `i-${faker.string.fromCharacters('abcdef0123456789', 17)}`;

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

            [{ subnetId: 'subnet-f4484e80', cidr: '172.31.0.0/20', routeTableId: 'rtb-1' }]
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

    it('Get instance details by private IP with falsy values', async () => {
        const ips = ['10.0.6.118', null, undefined] as string[];
        const response = await getInstanceDetailsByPrivateIp(credentialsId, DEFAULT_AWS_REGION, ips);
        expect(response[0].ec2InstanceId).toBeDefined();
        expect(response.length).toBe(1);
    });

    it('Get instance details by private IP with empty array', async () => {
        const ips = [] as string[];
        const response = await getInstanceDetailsByPrivateIp(credentialsId, DEFAULT_AWS_REGION, ips);
        expect(response).toBeDefined();
        expect(response.length).toBe(0);
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

    it('should resolve Oracle instance types from instance requirements for Data Guard deployment', async () => {
        const response = await getInstanceTypesFromInstanceRequirementsForOracle(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ['i-12345'],
            ['vol-1234s'],
            ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
        );
        expect(response).toBeDefined();
    });

    it('should resolve Oracle instance types from instance requirements for standalone deployment', async () => {
        const response = await getInstanceTypesFromInstanceRequirementsForOracle(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ['i-12345'],
            ['vol-1234s'],
            ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
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
});

describe('validateVpcEndpoints – security group CIDR matching', () => {
    // The endpoint mock (vpce-0583307c1aea1a02b) links to network interface eni-0f536a2c38e431a6a
    // which belongs to security group sg-ad2b38d1. We control its ipPermissions per test.
    const VPC_ID = 'vpc-84b3afe6';
    const VPC_CIDR = '172.31.0.0/16';
    const SUBNET1 = { subnetId: 'subnet-f4484e80', cidr: '172.31.0.0/20', routeTableId: 'rtb-1' };
    const SUBNET2 = { subnetId: 'subnet-4cdd3b29', cidr: '172.31.16.0/20', routeTableId: 'rtb-2' };

    function mockSgWith(ipPermissions: object[]) {
        vi.spyOn(ec2Lib, 'describeSecurityGroups').mockResolvedValueOnce({
            SecurityGroups: [{ GroupId: 'sg-ad2b38d1', IpPermissions: ipPermissions }],
            $metadata: {}
        });
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('passes when a single port-443 rule covers the VPC CIDR', async () => {
        mockSgWith([{ FromPort: 443, ToPort: 443, IpProtocol: 'tcp', IpRanges: [{ CidrIp: VPC_CIDR }] }]);

        await expect(
            validateVpcEndpoints(credentialsId, DEFAULT_AWS_REGION, { vpcId: VPC_ID, vpcCidr: VPC_CIDR }, [SUBNET1])
        ).resolves.not.toThrow();
    });

    it('passes when a port-443 rule uses a broad CIDR that contains the VPC', async () => {
        mockSgWith([{ FromPort: 443, ToPort: 443, IpProtocol: 'tcp', IpRanges: [{ CidrIp: '0.0.0.0/0' }] }]);

        await expect(
            validateVpcEndpoints(credentialsId, DEFAULT_AWS_REGION, { vpcId: VPC_ID, vpcCidr: VPC_CIDR }, [SUBNET1])
        ).resolves.not.toThrow();
    });

    it('passes when multiple port-443 rules each cover a different deployment subnet', async () => {
        mockSgWith([
            { FromPort: 443, ToPort: 443, IpProtocol: 'tcp', IpRanges: [{ CidrIp: SUBNET1.cidr }] },
            { FromPort: 443, ToPort: 443, IpProtocol: 'tcp', IpRanges: [{ CidrIp: SUBNET2.cidr }] }
        ]);

        await expect(
            validateVpcEndpoints(credentialsId, DEFAULT_AWS_REGION, { vpcId: VPC_ID, vpcCidr: VPC_CIDR }, [
                SUBNET1,
                SUBNET2
            ])
        ).resolves.not.toThrow();
    });
});
