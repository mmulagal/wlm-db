import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT, WORKLOAD_FACTORY_ENDPOINT } from '../../src/utils/consts';

// The simulated WAD scan talks to the real storage service and ONTAP simulator, so the workload
// factory host must stay reachable instead of being blocked by disableNetConnect().
const workloadFactoryHost = new URL(WORKLOAD_FACTORY_ENDPOINT).hostname;

async function initiateSimulator() {
    nock.disableNetConnect();
    nock.enableNetConnect(
        host =>
            host.includes('0.0.0.0') ||
            host.includes('bedrock-runtime') ||
            host.includes('sts.') ||
            host.includes('pricing.') ||
            host.includes('secretsmanager.') ||
            host.includes(workloadFactoryHost) ||
            host === CLOUD_MANAGER_ENDPOINT
    );
    await import('./scopes/jwt-scope');
    await import('./scopes/cloud-manager/cloud-manager-tenancy-scope');
    await import('./scopes/aws/ec2-scope');
    await import('./scopes/aws/directory-service-scope');
    await import('./scopes/aws/kms-scope');
    await import('./scopes/aws/sns-scope');
    await import('./scopes/aws/fsx-scope');
    await import('./scopes/aws/cloud-formation-scope');
    await import('./scopes/aws/service-quota-scope');
    await import('./scopes/aws/s3-scope');
    await import('./scopes/aws/iam-scope');
    await import('./scopes/aws/ssm-scope');
    await import('./scopes/aws/sns-scope');
    await import('./scopes/aws/sqs-scope');
    await import('./scopes/cloud-manager/cloud-manager-notification-scope');
    // Credentials must resolve for real: gg-skywalker's own FSx listing resolves the simulator
    // tenant from the credential's decrypted IAM role ARN, so faking this response here would
    // point every simulated WAD scan at the same made-up (empty) tenant regardless of which
    // account/credential was actually requested.
    await import('./scopes/cloud-manager/wlmdb-scope');
    await import('./scopes/cloud-manager/link-service-scope');
    await import('./scopes/cloud-manager/ubr-scope');
    await import('./scopes/cloud-manager/proxy-forwarder-scope');
    await import('./scopes/cloud-manager/tracker-scope');
    await import('./scopes/cloud-manager/wlm-hosts-scope');

    if (process.env.NODE_ENV === 'simulator') {
        // local development and testing environment
        await import('./scopes/aws/secrets-manager-scope');
        await import('./scopes/cloud-manager/marketing-scope');
        await import('./scopes/cloud-manager/cloud-manager-audit-scope');
        await import('./scopes/aws/pricing-scope');
    }
    await import('./scopes/aws/cost-explorer-scope');
    await import('./scopes/aws/tags-scope');
    await import('./scopes/aws/cloud-watch-scope');
    await import('./scopes/aws/cloud-watch-logs-scope');
    await import('./scopes/aws/compute-optimizer-scope');
    await import('./scopes/aws/bedrock-scope');
    // Load server
    await import('../../src/index');
}

initiateSimulator();
