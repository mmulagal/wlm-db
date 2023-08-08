import { faker } from '@faker-js/faker';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate
} from '../../src/operations/deployment-operations';

import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import {
    DEFAULT_AWS_REGION,
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION
} from '../utils/consts';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Cloud formation operations', () => {
    it('Create the cloud formation template url for user deployment', async () => {
        const resp = await createCloudFormationTemplateForUserDeployment(
            credentialsid,
            DEFAULT_AWS_REGION,
            NETWORKING_CONFIGURATION,
            EC2_CONFIGURATION,
            AD_CONFIGURATION,
            FSX_CONFIGURATION,
            SQL_CONFIGURATION
        );
        expect(resp).toBeDefined();
    });
    it('Deploys cloud formation template - missing permissions', async () => {
        try {
            await deployCloudFormationTemplate(
                credentialsid,
                DEFAULT_AWS_REGION,
                NETWORKING_CONFIGURATION,
                EC2_CONFIGURATION,
                AD_CONFIGURATION,
                FSX_CONFIGURATION,
                SQL_CONFIGURATION
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
