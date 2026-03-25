import { faker } from '@faker-js/faker';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    getCloudformationTemplate,
    deployStackOrCreateTemplateURL,
    getCollationDetailsForDeployment,
    getTerraformSetup,
    getPGSQLTerraformSetup,
    getSubnetsCidr
} from '../../src/operations/deployment-operations';
import {
    DEFAULT_AWS_REGION,
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION,
    ACCOUNT_ID
} from '../utils/consts';
import { SECRETS } from '../../src/utils/consts';
import * as ec2Lib from '../../src/lib/aws/ec2';

const credentialsid = `${faker.string.alphanumeric(20)}`;
SECRETS.AUTH_CLIENT_ID = `${faker.string.alphanumeric(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('Cloud formation operations', () => {
    it('Create the cloud formation template url for user deployment', async () => {
        const resp = await createCloudFormationTemplateForUserDeployment(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'triggered-from:chatbot,instance-type:m5.large'
        );
        expect(resp).toBeDefined();
    });
    it('Create the cloud formation template url or deploy stack', async () => {
        const resp = await deployStackOrCreateTemplateURL(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'chatbot'
        );
        expect(resp).toBeDefined();
    });

    it('Deploy cloud formation template', async () => {
        const resp = await deployCloudFormationTemplate(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'triggered-from:chatbot,instance-type:m5.large'
        );
        expect(resp).toBeDefined();
    });
    it('Get cloud formation template', async () => {
        const resp = await getCloudformationTemplate(
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'chatbot'
        );
        expect(resp).toBeDefined();
    });
    it('Get Collation details for mssql deployment', async () => {
        const resp = await getCollationDetailsForDeployment(ACCOUNT_ID, 2017);
        expect(resp).toBeDefined();
    });
    it('Get terraform setup', async () => {
        const resp = await getTerraformSetup(
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'chatbot'
        );
        expect(resp.url).toBeDefined();
    });
    it('Get pgsql terraform setup', async () => {
        const resp = await getPGSQLTerraformSetup(
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION,
            '',
            false,
            'chatbot'
        );
        expect(resp.url).toBeDefined();
    });
});

describe('getSubnetsCidr', () => {
    const SUBNET1_ID = NETWORKING_CONFIGURATION.privateSubnet1Id;
    const SUBNET2_ID = NETWORKING_CONFIGURATION.privateSubnet2Id!;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns subnet CIDRs as strings for standalone deployment', async () => {
        vi.spyOn(ec2Lib, 'describeSubnets').mockResolvedValueOnce({
            Subnets: [{ SubnetId: SUBNET1_ID, CidrBlock: '10.0.1.0/24' }],
            $metadata: {}
        });

        const { privateSubnet1Cidr, privateSubnet2Cidr } = await getSubnetsCidr(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            'standalone'
        );

        expect(privateSubnet1Cidr).toBe('10.0.1.0/24');
        expect(typeof privateSubnet1Cidr).toBe('string');
        expect(privateSubnet2Cidr).toBe('');
    });

    it('returns subnet CIDRs as strings for FCI deployment', async () => {
        vi.spyOn(ec2Lib, 'describeSubnets').mockResolvedValueOnce({
            Subnets: [
                { SubnetId: SUBNET1_ID, CidrBlock: '10.0.1.0/24' },
                { SubnetId: SUBNET2_ID, CidrBlock: '10.0.2.0/24' }
            ],
            $metadata: {}
        });

        const { privateSubnet1Cidr, privateSubnet2Cidr } = await getSubnetsCidr(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            'fci'
        );

        expect(privateSubnet1Cidr).toBe('10.0.1.0/24');
        expect(typeof privateSubnet1Cidr).toBe('string');
        expect(privateSubnet2Cidr).toBe('10.0.2.0/24');
        expect(typeof privateSubnet2Cidr).toBe('string');
    });

    it('throws when CidrBlock is absent from the AWS response', async () => {
        vi.spyOn(ec2Lib, 'describeSubnets').mockResolvedValueOnce({
            Subnets: [{ SubnetId: SUBNET1_ID }],
            $metadata: {}
        });

        await expect(
            getSubnetsCidr(credentialsid, DEFAULT_AWS_REGION, NETWORKING_CONFIGURATION, 'standalone')
        ).rejects.toThrow(`Failed to determine CIDR block for subnet ${SUBNET1_ID}`);
    });

    it('throws when subnet is not present in the AWS response', async () => {
        vi.spyOn(ec2Lib, 'describeSubnets').mockResolvedValueOnce({
            Subnets: [{ SubnetId: 'subnet-other', CidrBlock: '10.99.0.0/24' }],
            $metadata: {}
        });

        await expect(
            getSubnetsCidr(credentialsid, DEFAULT_AWS_REGION, NETWORKING_CONFIGURATION, 'standalone')
        ).rejects.toThrow(`Failed to determine CIDR block for subnet ${SUBNET1_ID}`);
    });

    it('returns empty strings without calling AWS when subnet IDs are missing', async () => {
        const describeSubnetsSpy = vi.spyOn(ec2Lib, 'describeSubnets');
        const configWithoutSubnet = { ...NETWORKING_CONFIGURATION, privateSubnet1Id: '' };

        const { privateSubnet1Cidr, privateSubnet2Cidr } = await getSubnetsCidr(
            credentialsid,
            DEFAULT_AWS_REGION,
            configWithoutSubnet,
            'standalone'
        );

        expect(privateSubnet1Cidr).toBe('');
        expect(privateSubnet2Cidr).toBe('');
        expect(describeSubnetsSpy).not.toHaveBeenCalled();
    });
});
