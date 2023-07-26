import nock from 'nock';

async function initiateSimulator() {
    nock.disableNetConnect();
    nock.enableNetConnect('0.0.0.0');

    await import('./scopes/jwt-scope');
    await import('./scopes/cloud-manager/cloud-manager-credentials-scope');
    await import('./scopes/aws/ec2-scope');
    await import('./scopes/aws/directory-service-scope');
    // Load server
    await import('../../src/index');
}

initiateSimulator();
