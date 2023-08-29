import { faker } from '@faker-js/faker';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate
} from '../../src/operations/deployment-operations';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/opentelemetry-scope';
import {
    DEFAULT_AWS_REGION,
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION
} from '../utils/consts';
import { mockClient } from 'aws-sdk-client-mock';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Cloud formation operations', () => {
    it('Create the cloud formation template url for user deployment', async () => {
        const s3Client = mockClient(S3Client);
        s3Client.on(PutObjectCommand).resolves({});
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
    it('Deploy cloud formation template', async () => {
        const resp = await deployCloudFormationTemplate(
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
});
