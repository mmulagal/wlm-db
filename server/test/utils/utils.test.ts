import { faker } from '@faker-js/faker';
import { createSecrets } from '../../src/operations/aws/secrets-manager-operations';
import { DEFAULT_AWS_REGION, FCI } from '../../src/utils/consts';
import '../simulator/scopes/aws/secrets-manager-scope';
import secretManagerResponse from '../simulator/responses/aws/secrets-manager-create.json';
import {
    checkAndRetrieveJsonObject,
    generateHash,
    getFsxArn,
    isNetworkConfigurationViolated,
    splitDomainUsername,
    getCollationForMSSQLVersion
} from '../../src/utils/utils';
import { ACTIVE_INSTANCE_ID, STANDBY_INSTANCE_ID } from './consts';

const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
const networkConfiguration = {
    vpcId: `vpc-${faker.string.alpha(6)}`,
    vpcCidr: '172.31.0.0/16',
    availabilityZone1: 'availability-zone-3',
    privateSubnet1Id: `subnet-${faker.string.alpha(6)}`,
    routeTable1Id: `rtb-${faker.string.alpha(6)}`,
    availabilityZone2: 'availability-zone-1',
    privateSubnet2Id: `subnet-${faker.string.alpha(6)}`,
    routeTable2Id: `rtb-${faker.string.alpha(6)}`
};

vi.mock('../../src/lib/aws/secrets-manager', () => ({
    createSecret: vi.fn().mockImplementation(async () => secretManagerResponse)
}));

const awsAccountId = `${faker.datatype.number({ min: 100000000 })}`;
const fsxId = `fs-${faker.string.alpha(8)}`;
const fsxArn = `arn:aws:fsx:${DEFAULT_AWS_REGION}:${awsAccountId}:file-system/${fsxId}`;

describe(' Secrets Manager string', () => {
    it(' Create Secrets Manager String', async () => {
        const response = await createSecrets(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [{ secretName: 'test-string-1', username: 'username', password: 'password' }],
            'sample-rolearn'
        );
        expect(response).toBeDefined();
    });

    it(' Check if valid json string', async () => {
        const response = checkAndRetrieveJsonObject(
            '[{ "secretName": "test-string-1", "username": "username", "password": "password" }]'
        );
        expect(response.isValid).toBeTruthy();
    });
    it(' Check if valid json string - negative', async () => {
        const response = checkAndRetrieveJsonObject('[{ abcde,ghij }]');
        expect(response.isValid).toBeFalsy();
    });

    it('Generate hash', async () => {
        const response = generateHash(ACTIVE_INSTANCE_ID + STANDBY_INSTANCE_ID);
        expect(response).toBeDefined();
    });

    it('Generate Fsx ARN', async () => {
        const response = getFsxArn(awsAccountId, DEFAULT_AWS_REGION, fsxId);
        expect(response).toBe(fsxArn);
    });
    it('Generate Fsx ARN', async () => {
        const response = await isNetworkConfigurationViolated(networkConfiguration, FCI);
        expect(response.isViolated).toBe(false);
    });
    it('Split domain from username', async () => {
        const response = splitDomainUsername('thisdomain\\thatuser');
        expect(response.username).toBe('thatuser');
    });
    it('Get collation details for mssql version', async () => {
        const resp = getCollationForMSSQLVersion(
            '2017',
            'Microsoft SQL Server 2016 (SP3-OD) (KB5006943) - 13.0.6404.1 (X64)'
        );
        expect(resp).toBeDefined();
    });
});
