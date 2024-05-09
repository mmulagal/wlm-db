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
    getServicesWithNoEndpoint,
    getValidationNodeInstanceType,
    enableVpcDnsAttributes,
    isEbsAwsBackupEnabled
} from '../../../src/operations/aws/ec2-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_CREDENTIALS_TYPE, ACCOUNT_ID } from '../../utils/consts';

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
        const resp = await getInstanceTypes(credentialsId, 'us-east-1');
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
        const response = await getServicesWithNoEndpoint(credentialsId, DEFAULT_AWS_REGION, 'vpc-123445', [
            'rtb-1',
            'rtb-2'
        ]);
        expect(response).toBeDefined();
    });

    it('Get validation node instance tyoe', async () => {
        const response = await getValidationNodeInstanceType(credentialsId, DEFAULT_AWS_REGION, [
            'availability-zone-1',
            'availability-zone-2'
        ]);
        expect(response).toEqual('t3.micro');
    });

    it('Modify vpc dns attributes', async () => {
        const response = await enableVpcDnsAttributes(credentialsId, DEFAULT_AWS_REGION, 'vpc-123445');
        expect(response).toBeDefined();
    });

    it('Check if EBS backup is available', async () => {
        const response = await isEbsAwsBackupEnabled(credentialsId, DEFAULT_AWS_REGION, ['vol-123445']);
        expect(response).toEqual(true);
    });
});
