import nock from 'nock';

async function initiateSimulator() {
    nock.disableNetConnect();
    nock.enableNetConnect(
        host =>
            host.includes('0.0.0.0') ||
            host.includes('bedrock-runtime') ||
            host.includes('sts.') ||
            host.includes('pricing.')
    );

    await import('./scopes/jwt-scope');
    await import('./scopes/cloud-manager/cloud-manager-credentials-scope');
    await import('./scopes/cloud-manager/cloud-manager-tenancy-scope');
    await import('./scopes/cloud-manager/cloud-manager-audit-scope');
    await import('./scopes/aws/ec2-scope');
    await import('./scopes/aws/directory-service-scope');
    await import('./scopes/aws/kms-scope');
    await import('./scopes/aws/sns-scope');
    await import('./scopes/aws/fsx-scope');
    await import('./scopes/aws/cloud-formation-scope');
    await import('./scopes/aws/service-quota-scope');
    await import('./scopes/aws/secrets-manager-scope');
    await import('./scopes/aws/s3-scope');
    await import('./scopes/aws/iam-scope');
    await import('./scopes/aws/ssm-scope');
    await import('./scopes/aws/sns-scope');
    await import('./scopes/aws/sqs-scope');
    await import('./scopes/batch-scope');
    await import('./scopes/cloud-manager/cloud-manager-notification-scope');
    await import('./scopes/cloud-manager/workload-factory-credentials-scope');
    await import('./scopes/cloud-manager/wlmdb-scope');
    await import('./scopes/cloud-manager/workload-factory-auth-scope');
    await import('./scopes/aws/cost-explorer-scope');
    await import('./scopes/aws/tags-scope');
    // Load server
    await import('../../src/index');
}

initiateSimulator();
