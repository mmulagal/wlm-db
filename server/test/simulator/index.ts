import nock from 'nock';
import sinon from 'sinon';
import jwtOperation from '../../src/utils/jwt';

async function initiateSimulator() {
    nock.disableNetConnect();
    nock.enableNetConnect('0.0.0.0');

    // mocking the verifyToken by directly sending a fake response for simulator purpose only
    sinon.stub(jwtOperation, 'verifyToken').callsFake(async () => 'verified');

    await import('./scopes/cloud-manager/cloud-manager-credentials-scope');
    await import('./scopes/aws/ec2-scope');
    // Load server
    await import('../../src/index');
}

initiateSimulator();
