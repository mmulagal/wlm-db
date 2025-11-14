import { faker } from '@faker-js/faker';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    getCloudformationTemplate,
    deployStackOrCreateTemplateURL,
    getCollationDetailsForDeployment,
    getTerraformSetup,
    getPGSQLTerraformSetup
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
